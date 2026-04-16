import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { getSession, generateQuestion, evaluateAnswer, completeSession, createBookmark, uploadAnswerAudio, getQuestions, createRound } from "@/lib/api";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import CodeEditor from "@/components/CodeEditor";
import InterviewTimer from "@/components/InterviewTimer";
import {
  Loader2, Send, SkipForward, Square, Lightbulb,
  CheckCircle, XCircle, AlertTriangle, ArrowRight, BarChart3,
  Bookmark, FileText,
  Mic, MicOff, Volume2, VolumeX
} from "lucide-react";

function ScoreBadge({ score }) {
  const color = score >= 8 ? "text-green-400" : score >= 5 ? "text-yellow-500" : "text-red-400";
  const bg = score >= 8 ? "bg-green-400/10 border-green-400/30" : score >= 5 ? "bg-yellow-500/10 border-yellow-500/30" : "bg-red-400/10 border-red-400/30";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold border ${bg} ${color}`}>
      {score}/10
    </span>
  );
}

function VerdictBadge({ verdict }) {
  const map = {
    strong: { label: "STRONG", color: "text-green-400 bg-green-400/10 border-green-400/30" },
    acceptable: { label: "ACCEPTABLE", color: "text-yellow-500 bg-yellow-500/10 border-yellow-500/30" },
    needs_improvement: { label: "NEEDS WORK", color: "text-orange-400 bg-orange-400/10 border-orange-400/30" },
    poor: { label: "POOR", color: "text-red-400 bg-red-400/10 border-red-400/30" },
  };
  const v = map[verdict] || map.needs_improvement;
  return <span className={`text-[10px] tracking-[0.15em] font-bold px-2 py-0.5 border ${v.color}`}>{v.label}</span>;
}

export default function InterviewRoom() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const scrollRef = useRef(null);

  const [session, setSession] = useState(null);
  const [rounds, setRounds] = useState([]);
  const [currentRound, setCurrentRound] = useState(null);
  const [answer, setAnswer] = useState("");
  const answerRef = useRef(answer);
  const currentRoundRef = useRef(currentRound);
  const [loadingQuestion, setLoadingQuestion] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [interviewComplete, setInterviewComplete] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [useCodeEditor, setUseCodeEditor] = useState(false);
  const [timerActive, setTimerActive] = useState(false);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState("");
  const [cachedQuestions, setCachedQuestions] = useState([]);
  const [questionLoadError, setQuestionLoadError] = useState("");
  const [usedQuestionIds, setUsedQuestionIds] = useState([]);

  useEffect(() => {
    answerRef.current = answer;
  }, [answer]);

  useEffect(() => {
    currentRoundRef.current = currentRound;
  }, [currentRound]);

  useEffect(() => {
    return () => {
      if (recordedAudioUrl) URL.revokeObjectURL(recordedAudioUrl);
    };
  }, [recordedAudioUrl]);

  const [voiceInputEnabled, setVoiceInputEnabled] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("voiceInputEnabled") === "true";
  });
  const [ttsEnabled, setTtsEnabled] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("ttsEnabled") === "true";
  });
  const [isRecording, setIsRecording] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const mediaChunksRef = useRef([]);
  const recordingStartedAtRef = useRef(null);
  const spokenQuestionIdRef = useRef(null);
  const hasSpokenFeedbackRef = useRef(false);
  const [recordedAudioBlob, setRecordedAudioBlob] = useState(null);
  const [recordedAudioDurationMs, setRecordedAudioDurationMs] = useState(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      if (scrollRef.current) {
        const el = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
        if (el) el.scrollTop = el.scrollHeight;
      }
    }, 100);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("voiceInputEnabled", String(voiceInputEnabled));
  }, [voiceInputEnabled]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("ttsEnabled", String(ttsEnabled));
  }, [ttsEnabled]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!ttsEnabled) {
      // Stop any queued/speaking utterances when the user turns TTS off.
      try {
        window.speechSynthesis?.cancel?.();
      } catch {}
    }
  }, [ttsEnabled]);

  const speakText = useCallback(
    (text, { cancelExisting = false } = {}) => {
      if (!ttsEnabled) return false;
      if (typeof window === "undefined") return;
      const synth = window.speechSynthesis;
      if (!synth) return false;
      if (!text || !text.trim()) return;

      if (cancelExisting) synth.cancel(); // Avoid audio pile-up when explicitly requested.
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = navigator.language || "en-US";
      utter.rate = 1.0;
      utter.pitch = 1.0;
      synth.speak(utter);
      return true;
    },
    [ttsEnabled]
  );

  const stopRecording = useCallback(() => {
    try {
      recognitionRef.current?.stop?.();
    } catch {}
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    } catch {}
    try {
      mediaStreamRef.current?.getTracks?.().forEach((track) => track.stop());
    } catch {}
    recognitionRef.current = null;
    mediaRecorderRef.current = null;
    mediaStreamRef.current = null;
    setIsRecording(false);
    setInterimTranscript("");
  }, []);

  const startRecording = useCallback(async () => {
    if (!voiceInputEnabled) return;
    if (typeof window === "undefined") return;
    if (evaluating || loadingQuestion) return;
    if (!currentRound || currentRound.answer) return;
    if (isRecording) return;

    if (window.speechSynthesis?.cancel) {
      window.speechSynthesis.cancel();
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Voice input not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || "en-US";

    setInterimTranscript("");
    setIsRecording(false);
    mediaChunksRef.current = [];
    recordingStartedAtRef.current = Date.now();
    setRecordedAudioBlob(null);
    setRecordedAudioDurationMs(null);
    if (recordedAudioUrl) {
      URL.revokeObjectURL(recordedAudioUrl);
      setRecordedAudioUrl("");
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      if (window.MediaRecorder) {
        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;
        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) mediaChunksRef.current.push(event.data);
        };
        recorder.onstop = () => {
          const mimeType = recorder.mimeType || "audio/webm";
          const blob = new Blob(mediaChunksRef.current, { type: mimeType });
          const durationMs = recordingStartedAtRef.current ? Date.now() - recordingStartedAtRef.current : null;
          if (blob.size > 0) {
            setRecordedAudioBlob(blob);
            setRecordedAudioDurationMs(durationMs);
            const objectUrl = URL.createObjectURL(blob);
            setRecordedAudioUrl(objectUrl);
          }
          try {
            mediaStreamRef.current?.getTracks?.().forEach((track) => track.stop());
          } catch {}
          mediaStreamRef.current = null;
        };
        recorder.start(250);
      }
    } catch {
      toast.error("Unable to access microphone audio.");
      recognitionRef.current = null;
      return;
    }

    recognition.onstart = () => setIsRecording(true);
    recognition.onresult = (event) => {
      let finalTranscript = "";
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        const chunk = (res[0]?.transcript || "").trim();
        if (!chunk) continue;
        if (res.isFinal) finalTranscript += (finalTranscript ? " " : "") + chunk;
        else interim += (interim ? " " : "") + chunk;
      }
      if (interim) setInterimTranscript(interim);
      if (finalTranscript) setAnswer(finalTranscript.trim());
    };

    recognition.onerror = (event) => {
      const msg =
        event?.error === "not-allowed"
          ? "Microphone permission denied."
          : event?.error
            ? `Voice input error: ${event.error}`
            : "Voice input failed.";
      toast.error(msg);
      stopRecording();
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      setIsRecording(false);
      setInterimTranscript("");
    };

    try {
      recognition.start();
    } catch {
      try {
        mediaRecorderRef.current?.stop?.();
      } catch {}
      recognitionRef.current = null;
      toast.error("Failed to start voice recording.");
    }
  }, [
    voiceInputEnabled,
    evaluating,
    loadingQuestion,
    currentRound,
    isRecording,
    stopRecording,
    recordedAudioUrl,
  ]);

  useEffect(() => {
    if (evaluating || loadingQuestion || !currentRound || currentRound.answer) {
      stopRecording();
    }
  }, [evaluating, loadingQuestion, currentRound, stopRecording]);

  useEffect(() => {
    // Speak each new question once when TTS is enabled.
    if (!ttsEnabled) return;
    if (!currentRound || currentRound.answer) return;
    if (!currentRound.question) return;
    if (spokenQuestionIdRef.current === currentRound.id) return;
    spokenQuestionIdRef.current = currentRound.id;
    speakText(currentRound.question, { cancelExisting: true });
  }, [currentRound, ttsEnabled, speakText]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await getSession(sessionId);
        const fetchedSession = res.data.session;
        setSession(fetchedSession);
        setRounds(res.data.rounds);
        setUsedQuestionIds(
          (res.data.rounds || [])
            .map((round) => round.question_id)
            .filter(Boolean)
        );
        
        let localQuestions = [];
        if (fetchedSession.status !== "completed") {
          try {
            const questionPoolLimit = Math.max((fetchedSession.num_questions || 10) * 3, 20);
            const qRes = await getQuestions(fetchedSession.tech_stack, questionPoolLimit);
            localQuestions = qRes.data || [];
            if (localQuestions.length === 0) {
              const fallbackRes = await getQuestions(undefined, questionPoolLimit);
              localQuestions = fallbackRes.data || [];
            }
            setCachedQuestions(localQuestions);
            setQuestionLoadError("");
          } catch (error) {
            setQuestionLoadError("Failed to load interview questions.");
            toast.error("Failed to load interview questions");
          }
        }

        if (fetchedSession.status === "completed") {
          setInterviewComplete(true);
        } else if (res.data.rounds.length === 0) {
          fetchNextQuestion(localQuestions, fetchedSession);
        } else {
          const lastRound = res.data.rounds[res.data.rounds.length - 1];
          if (!lastRound.answer) {
            setCurrentRound(lastRound);
          }
        }
      } catch (err) {
        toast.error("Failed to load session");
      } finally {
        setInitialLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const fetchNextQuestion = async (customQuestionsList = null, curSession = null) => {
    setLoadingQuestion(true);
    setShowHint(false);
    setTimerActive(false);
    try {
      const qs = customQuestionsList || cachedQuestions;
      const s = curSession || session;
      const usedIds = new Set(
        (usedQuestionIds || []).concat((rounds || []).map((r) => r.question_id).filter(Boolean))
      );
      const question = qs.find((q) => q?.id && !usedIds.has(q.id));
      
      if (!question) {
        const msg = questionLoadError || "No more questions available for this interview.";
        toast.error(msg);
        setLoadingQuestion(false);
        return;
      }
      
      const res = await createRound(sessionId, question.id);
      setCurrentRound(res.data);
      setRounds((prev) => [...prev, res.data]);
      setUseCodeEditor(res.data.question_type === "coding");
      setSession(prev => ({ ...prev, questions_asked: res.data.order }));
      setUsedQuestionIds((prev) => [...new Set([...prev, question.id])]);
      setCachedQuestions((prev) => prev.filter((item) => item.id !== question.id));

      if (s?.timed_mode) setTimerActive(true);
      scrollToBottom();
    } catch (err) {
      const msg = err?.response?.data?.detail || "Failed to load question. Please try again.";
      toast.error(msg);
    } finally {
      setLoadingQuestion(false);
    }
  };

  const [streamingFeedback, setStreamingFeedback] = useState("");

  const handleSubmitAnswer = useCallback(async () => {
    const round = currentRoundRef.current;
    const answerText = (answerRef.current || "").trim();
    if (!answerText || !round) return;

    setEvaluating(true);
    setTimerActive(false);
    setStreamingFeedback("");
    hasSpokenFeedbackRef.current = false;

    stopRecording();
    try {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    } catch {}

    const maybeCompleteInterview = async () => {
      const sess = await getSession(sessionId);
      setSession(sess.data.session);
      if (sess.data.session.questions_asked < sess.data.session.num_questions) return;
      try {
        const res = await completeSession(sessionId);
        setSession(res.data.session);
        setInterviewComplete(true);
        toast.success("Interview completed!");
      } catch {
        toast.error("Failed to complete session");
      }
    };

    const maybeUploadAudio = async () => {
      if (!recordedAudioBlob) return null;
      try {
        const audioRes = await uploadAnswerAudio(
          sessionId,
          round.id,
          recordedAudioBlob,
          answerText,
          recordedAudioDurationMs,
        );
        const audioData = audioRes.data;
        setRounds((prev) => prev.map((r) => (r.id === round.id ? { ...r, ...audioData } : r)));
        return audioData;
      } catch {
        toast.error("Answer saved as text, but audio upload failed.");
        return null;
      }
    };

    const uploadedAudio = await maybeUploadAudio();

    try {
      const API_BASE = process.env.REACT_APP_BACKEND_URL;
      const response = await fetch(`${API_BASE}/api/interview/evaluate-stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ session_id: sessionId, round_id: round.id, answer: answerText }),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        throw new Error(`Evaluation failed (${response.status}). ${errText ? errText.slice(0, 200) : ""}`.trim());
      }
      if (!response.body?.getReader) {
        throw new Error("Streaming feedback is not supported by this browser.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let feedbackText = "";
      let completeData = null;
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        buffer += text;
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";
        for (const part of parts) {
          const event = part.trim();
          if (!event.startsWith("data:")) continue;
          const payload = event.replace("data:", "").trim();
          if (payload === "[DONE]") continue;
          try {
            const parsed = JSON.parse(payload);
            if (parsed.type === "text") {
              feedbackText += parsed.text;
              setStreamingFeedback(feedbackText);
              scrollToBottom();
              const didSpeak = speakText(parsed.text, { cancelExisting: false });
              if (didSpeak) hasSpokenFeedbackRef.current = true;
            } else if (parsed.type === "complete") {
              completeData = parsed.data;
            } else if (parsed.type === "error") {
              toast.error(parsed.text);
            }
          } catch {}
        }
      }

      if (completeData) {
        setRounds((prev) => prev.map((r) => (
          r.id === round.id ? { ...r, ...(uploadedAudio || {}), ...completeData } : r
        )));
        const feedbackStr = typeof completeData?.feedback === "string" ? completeData.feedback.trim() : "";
        const followUpStr = typeof completeData?.follow_up_question === "string" ? completeData.follow_up_question.trim() : "";
        if (!hasSpokenFeedbackRef.current && feedbackStr) {
          speakText(feedbackStr, { cancelExisting: false });
        }
        if (followUpStr) {
          speakText(followUpStr, { cancelExisting: false });
        }
      }
      setStreamingFeedback("");
      setCurrentRound(null);
      setAnswer("");
      setRecordedAudioBlob(null);
      setRecordedAudioDurationMs(null);
      if (recordedAudioUrl) {
        URL.revokeObjectURL(recordedAudioUrl);
        setRecordedAudioUrl("");
      }
      scrollToBottom();

      await maybeCompleteInterview();
    } catch (err) {
      // Fallback to regular endpoint
      try {
        const res = await evaluateAnswer(sessionId, round.id, answerText);
        setRounds((prev) => prev.map((r) => (
          r.id === round.id ? { ...r, ...(uploadedAudio || {}), ...res.data } : r
        )));
        setCurrentRound(null);
        setAnswer("");
        setRecordedAudioBlob(null);
        setRecordedAudioDurationMs(null);
        if (recordedAudioUrl) {
          URL.revokeObjectURL(recordedAudioUrl);
          setRecordedAudioUrl("");
        }
        const feedbackStr = typeof res.data?.feedback === "string" ? res.data.feedback.trim() : "";
        const followUpStr = typeof res.data?.follow_up_question === "string" ? res.data.follow_up_question.trim() : "";
        if (!hasSpokenFeedbackRef.current && feedbackStr) {
          speakText(feedbackStr, { cancelExisting: false });
        }
        if (followUpStr) {
          speakText(followUpStr, { cancelExisting: false });
        }
        await maybeCompleteInterview();
      } catch {
        toast.error("Failed to evaluate answer. AI may be busy — try again.");
      }
    } finally {
      setEvaluating(false);
      setStreamingFeedback("");
    }
  }, [
    sessionId,
    stopRecording,
    speakText,
    scrollToBottom,
    recordedAudioBlob,
    recordedAudioDurationMs,
    recordedAudioUrl,
  ]);

  const handleEndInterview = async () => {
    try {
      const res = await completeSession(sessionId);
      setSession(res.data.session);
      setInterviewComplete(true);
      toast.success("Interview completed!");
    } catch (err) {
      toast.error("Failed to complete session");
    }
  };

  const handleTimeUp = useCallback(() => {
    if (currentRoundRef.current) {
      if (answerRef.current.trim()) {
        toast.warning("Time's up! Auto-submitting your answer...");
      } else {
        toast.error("Time's up! Submitting empty answer...");
        answerRef.current = "I ran out of time and couldn't provide an answer.";
      }
      handleSubmitAnswer();
    }
  }, [handleSubmitAnswer]);

  const handleBookmark = async (roundId) => {
    try {
      await createBookmark(sessionId, roundId);
      toast.success("Question bookmarked!");
    } catch {
      toast.error("Failed to bookmark");
    }
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-yellow-500 animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <p className="text-zinc-500 text-sm">Session not found</p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-56px)] bg-[#0A0A0A] flex flex-col" data-testid="interview-room">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#27272A] bg-[#121212]">
        <div className="flex items-center gap-3">
          <span className="text-xs tracking-[0.15em] font-bold text-yellow-500">
            {session.tech_stack}
          </span>
          <Separator orientation="vertical" className="h-4 bg-[#27272A]" />
          <span className="text-xs text-zinc-500 uppercase">{session.difficulty}</span>
          <Separator orientation="vertical" className="h-4 bg-[#27272A]" />
          <span className="text-xs text-zinc-500">
            Q {session.questions_asked}/{session.num_questions}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {session.timed_mode && currentRound && !currentRound.answer && (
            <InterviewTimer
              timePerQuestion={session.time_per_question || 300}
              onTimeUp={handleTimeUp}
              isActive={timerActive}
            />
          )}
          {session.avg_score !== null && <ScoreBadge score={session.avg_score} />}
          {interviewComplete && (
            <button
              data-testid="view-report-btn"
              onClick={() => navigate(`/report/${sessionId}`)}
              className="flex items-center gap-1 px-3 py-1 text-xs font-bold text-zinc-400 border border-[#27272A] hover:border-yellow-500 hover:text-yellow-500 transition-colors"
            >
              <FileText className="w-3 h-3" /> REPORT
            </button>
          )}
          {!interviewComplete && (
            <button
              data-testid="end-interview-btn"
              onClick={handleEndInterview}
              className="flex items-center gap-1 px-3 py-1 text-xs font-bold text-red-400 border border-red-400/30 hover:bg-red-400/10 transition-colors"
            >
              <Square className="w-3 h-3" /> END
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-0.5 bg-[#121212]">
        <div
          className="h-full bg-yellow-500 transition-all duration-300"
          style={{ width: `${(session.questions_asked / session.num_questions) * 100}%` }}
        />
      </div>

      {/* Chat Area */}
      <ScrollArea ref={scrollRef} className="flex-1 overflow-hidden" data-testid="interview-chat">
        <div className="max-w-3xl mx-auto p-6 space-y-6">
          {/* Welcome */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 bg-yellow-500 flex items-center justify-center">
                <span className="text-[10px] font-bold text-black">AI</span>
              </div>
              <span className="text-xs font-bold text-yellow-500">INTERVIEWER</span>
            </div>
            <div className="ml-8 p-3 bg-[#121212] border border-[#27272A] text-sm text-zinc-300">
              Welcome to your <span className="text-yellow-500 font-bold">{session.tech_stack}</span> interview.
              Difficulty: <span className="text-yellow-500 font-bold">{session.difficulty}</span>.
              {session.difficulty === "advanced" && " Prepare to be grilled."}
              {session.difficulty === "beginner" && " I'll guide you through the fundamentals."}
              {session.difficulty === "intermediate" && " Let's test your practical knowledge."}
            </div>
          </motion.div>

          {/* Rounds */}
          <AnimatePresence>
            {rounds.map((round, idx) => (
              <motion.div
                key={round.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                {/* Question */}
                <div className="mb-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 bg-yellow-500 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-black">AI</span>
                    </div>
                    <span className="text-xs font-bold text-yellow-500">QUESTION {round.order}</span>
                    <Badge variant="outline" className="text-[10px] border-[#27272A] text-zinc-500 rounded-sm">
                      {round.question_type}
                    </Badge>
                    <span className="text-[10px] text-zinc-600">{round.topic}</span>
                    {round.answer && (
                      <button
                        data-testid={`bookmark-btn-${round.id}`}
                        onClick={() => handleBookmark(round.id)}
                        className="ml-auto text-zinc-600 hover:text-yellow-500 transition-colors"
                        title="Bookmark question"
                      >
                        <Bookmark className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="ml-8 p-3 bg-[#121212] border border-[#27272A] text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">
                    {round.question}
                    {currentRound?.id === round.id && !round.answer && (
                      <span className="text-yellow-500 animate-blink ml-0.5">_</span>
                    )}
                  </div>
                </div>

                {/* Answer + Evaluation */}
                {round.answer && (
                  <>
                    <div className="mb-3 ml-8">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 bg-zinc-700 flex items-center justify-center">
                          <span className="text-[10px] font-bold text-white">YOU</span>
                        </div>
                        <span className="text-xs font-bold text-zinc-400">YOUR ANSWER</span>
                      </div>
                      <div className="ml-8 p-3 bg-[#0A0A0A] border border-[#27272A] text-sm text-zinc-300 whitespace-pre-wrap">
                        {round.answer}
                      </div>
                      {round.answer_audio_url && (
                        <div className="ml-8 mt-2">
                          <audio
                            controls
                            preload="none"
                            className="w-full max-w-md"
                            src={round.answer_audio_url}
                          >
                            Your browser does not support audio playback.
                          </audio>
                        </div>
                      )}
                    </div>

                    {round.feedback && (
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="ml-8 mb-4"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-6 h-6 bg-yellow-500 flex items-center justify-center">
                            <span className="text-[10px] font-bold text-black">AI</span>
                          </div>
                          <span className="text-xs font-bold text-yellow-500">EVALUATION</span>
                          <ScoreBadge score={round.score} />
                          <VerdictBadge verdict={round.verdict} />
                        </div>
                        <div className="ml-8 space-y-3">
                          <div className="p-3 bg-[#121212] border border-[#27272A] text-xs text-zinc-300 leading-relaxed">
                            {round.feedback}
                          </div>

                          {round.strengths?.length > 0 && (
                            <div className="p-3 bg-green-400/5 border border-green-400/20">
                              <div className="flex items-center gap-1 mb-1">
                                <CheckCircle className="w-3 h-3 text-green-400" />
                                <span className="text-[10px] tracking-[0.15em] font-bold text-green-400">STRENGTHS</span>
                              </div>
                              {round.strengths.map((s, i) => (
                                <p key={i} className="text-xs text-zinc-400 ml-4">+ {s}</p>
                              ))}
                            </div>
                          )}

                          {round.weaknesses?.length > 0 && (
                            <div className="p-3 bg-red-400/5 border border-red-400/20">
                              <div className="flex items-center gap-1 mb-1">
                                <XCircle className="w-3 h-3 text-red-400" />
                                <span className="text-[10px] tracking-[0.15em] font-bold text-red-400">WEAKNESSES</span>
                              </div>
                              {round.weaknesses.map((w, i) => (
                                <p key={i} className="text-xs text-zinc-400 ml-4">- {w}</p>
                              ))}
                            </div>
                          )}

                          {round.follow_up_question && (
                            <div className="p-3 bg-yellow-500/5 border border-yellow-500/20">
                              <div className="flex items-center gap-1 mb-1">
                                <AlertTriangle className="w-3 h-3 text-yellow-500" />
                                <span className="text-[10px] tracking-[0.15em] font-bold text-yellow-500">FOLLOW-UP CHALLENGE</span>
                              </div>
                              <p className="text-xs text-zinc-300 ml-4">{round.follow_up_question}</p>
                            </div>
                          )}

                          {round.improvement_suggestions?.length > 0 && (
                            <div className="p-3 bg-[#121212] border border-[#27272A]">
                              <div className="flex items-center gap-1 mb-1">
                                <Lightbulb className="w-3 h-3 text-zinc-400" />
                                <span className="text-[10px] tracking-[0.15em] font-bold text-zinc-400">SUGGESTIONS</span>
                              </div>
                              {round.improvement_suggestions.map((s, i) => (
                                <p key={i} className="text-xs text-zinc-500 ml-4">{s}</p>
                              ))}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </>
                )}

                {idx < rounds.length - 1 && round.answer && (
                  <Separator className="my-4 bg-[#27272A]" />
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Loading Question */}
          {loadingQuestion && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 ml-8 text-xs text-zinc-500">
              <Loader2 className="w-3 h-3 animate-spin text-yellow-500" />
              Loading next question...
            </motion.div>
          )}

          {!loadingQuestion && questionLoadError && cachedQuestions.length === 0 && !currentRound && !interviewComplete && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="ml-8 text-xs text-red-400">
              {questionLoadError}
            </motion.div>
          )}

          {/* Evaluating with streaming feedback */}
          {evaluating && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="ml-8">
              <div className="flex items-center gap-2 mb-2 text-xs text-zinc-500">
                <Loader2 className="w-3 h-3 animate-spin text-yellow-500" />
                AI is evaluating your answer...
              </div>
              {streamingFeedback && (
                <div className="p-3 bg-[#121212] border border-yellow-500/20 text-xs text-zinc-300 leading-relaxed">
                  {streamingFeedback}<span className="text-yellow-500 animate-blink">_</span>
                </div>
              )}
            </motion.div>
          )}

          {/* Interview Complete */}
          {interviewComplete && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 p-6 bg-[#121212] border border-yellow-500/30"
              data-testid="interview-complete-summary"
            >
              <h3 className="font-heading text-xl font-bold text-white mb-2">Interview Complete</h3>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <div className="text-[10px] tracking-[0.15em] text-zinc-500 mb-1">SCORE</div>
                  <div className="text-2xl font-bold text-yellow-500">{session.avg_score || 0}/10</div>
                </div>
                <div>
                  <div className="text-[10px] tracking-[0.15em] text-zinc-500 mb-1">QUESTIONS</div>
                  <div className="text-2xl font-bold text-white">{session.questions_asked}</div>
                </div>
                <div>
                  <div className="text-[10px] tracking-[0.15em] text-zinc-500 mb-1">CATEGORY</div>
                  <div className="text-sm font-bold text-white">{session.tech_stack}</div>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  data-testid="new-interview-btn"
                  onClick={() => navigate("/setup")}
                  className="bg-yellow-500 text-black font-bold text-xs px-4 py-2 hover:bg-yellow-400 transition-colors flex items-center gap-1"
                >
                  NEW INTERVIEW <ArrowRight className="w-3 h-3" />
                </button>
                <button
                  data-testid="view-report-link"
                  onClick={() => navigate(`/report/${sessionId}`)}
                  className="border border-yellow-500/50 text-yellow-500 font-bold text-xs px-4 py-2 hover:bg-yellow-500/10 transition-colors flex items-center gap-1"
                >
                  <FileText className="w-3 h-3" /> VIEW REPORT
                </button>
                <button
                  data-testid="view-dashboard-btn"
                  onClick={() => navigate("/dashboard")}
                  className="border border-zinc-700 text-white font-bold text-xs px-4 py-2 hover:bg-zinc-800 transition-colors flex items-center gap-1"
                >
                  <BarChart3 className="w-3 h-3" /> DASHBOARD
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </ScrollArea>

      {/* Input Area */}
      {!interviewComplete && (
        <div className="border-t border-[#27272A] bg-[#121212] p-4">
          <div className="max-w-3xl mx-auto">
            {currentRound && !currentRound.answer && (
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <button
                    data-testid="voice-input-toggle"
                    onClick={() => setVoiceInputEnabled((v) => !v)}
                    className={`flex items-center gap-2 px-3 py-2 text-xs font-bold border transition-colors ${
                      voiceInputEnabled
                        ? "border-yellow-500 bg-yellow-500/10 text-yellow-500"
                        : "border-[#27272A] bg-[#0A0A0A] text-zinc-600 hover:border-zinc-600 hover:text-zinc-500"
                    }`}
                  >
                    {voiceInputEnabled ? <Mic className="w-3 h-3" /> : <MicOff className="w-3 h-3" />}
                    {voiceInputEnabled ? "VOICE ON" : "VOICE OFF"}
                  </button>
                  <button
                    data-testid="tts-toggle"
                    onClick={() => setTtsEnabled((v) => !v)}
                    className={`flex items-center gap-2 px-3 py-2 text-xs font-bold border transition-colors ${
                      ttsEnabled
                        ? "border-yellow-500 bg-yellow-500/10 text-yellow-500"
                        : "border-[#27272A] bg-[#0A0A0A] text-zinc-600 hover:border-zinc-600 hover:text-zinc-500"
                    }`}
                  >
                    {ttsEnabled ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
                    {ttsEnabled ? "SPEAK ON" : "SPEAK OFF"}
                  </button>
                </div>
                {isRecording && <span className="text-xs font-bold text-red-400">Listening...</span>}
              </div>
            )}

            {currentRound && !currentRound.answer && (
              <div className="flex items-center gap-2 mb-2">
                {showHint ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-zinc-500">
                    <Lightbulb className="w-3 h-3 inline text-yellow-500 mr-1" />
                    {currentRound.hint}
                  </motion.div>
                ) : (
                  <button
                    data-testid="show-hint-btn"
                    onClick={() => setShowHint(true)}
                    className="text-xs text-zinc-600 hover:text-yellow-500 transition-colors"
                  >
                    Need a hint?
                  </button>
                )}
              </div>
            )}

            {isRecording && interimTranscript && (
              <div className="text-xs text-zinc-500 mb-3 ml-1">
                Transcript: {interimTranscript}
              </div>
            )}
            {!isRecording && recordedAudioUrl && (
              <div className="mb-3">
                <div className="text-[10px] tracking-[0.15em] text-zinc-500 mb-1">RECORDED ANSWER PREVIEW</div>
                <audio controls preload="metadata" className="w-full max-w-md" src={recordedAudioUrl}>
                  Your browser does not support audio playback.
                </audio>
              </div>
            )}
            <div className="flex gap-2">
              {useCodeEditor && currentRound && !currentRound.answer ? (
                <div className="flex-1">
                  <CodeEditor
                    value={answer}
                    onChange={(val) => setAnswer(val || "")}
                    language={(() => {
                      const s = (session?.tech_stack || "").toLowerCase();
                      if (s.includes("python") || s.includes("django")) return "python";
                      if (s.includes("java") && !s.includes("javascript")) return "java";
                      if (s.includes(".net") || s.includes("c#")) return "csharp";
                      if (s.includes("angular") || s.includes("react") || s.includes("vue") || s.includes("node") || s.includes("ember")) return "typescript";
                      return "javascript";
                    })()}
                    height="200px"
                  />
                </div>
              ) : (
                <textarea
                  data-testid="answer-textarea"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder={currentRound ? "Type your answer..." : "Waiting for next question..."}
                  disabled={!currentRound || evaluating || loadingQuestion || isRecording}
                  rows={3}
                  className="flex-1 bg-[#0A0A0A] border border-[#27272A] text-sm text-white p-3 resize-none focus:outline-none focus:border-yellow-500 placeholder-zinc-600 disabled:opacity-50"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && e.ctrlKey) handleSubmitAnswer();
                  }}
                />
              )}
              <div className="flex flex-col gap-2">
                {currentRound && !currentRound.answer ? (
                  <>
                    <button
                      data-testid="voice-record-btn"
                      onClick={() => (isRecording ? stopRecording() : startRecording())}
                      disabled={!voiceInputEnabled || evaluating || loadingQuestion}
                      className="bg-zinc-800 text-white font-bold text-xs px-4 py-2 hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                      title={voiceInputEnabled ? "Record your answer" : "Enable voice input first"}
                    >
                      {isRecording ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                      {isRecording ? "STOP" : "RECORD"}
                    </button>
                    <button
                      data-testid="submit-answer-btn"
                      onClick={handleSubmitAnswer}
                      disabled={!answer.trim() || evaluating || isRecording}
                      className="bg-yellow-500 text-black font-bold text-xs px-4 py-2 hover:bg-yellow-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                      {evaluating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                      SUBMIT
                    </button>
                  </>
                ) : (
                  <button
                    data-testid="next-question-btn"
                    onClick={fetchNextQuestion}
                    disabled={loadingQuestion || session.questions_asked >= session.num_questions}
                    className="bg-yellow-500 text-black font-bold text-xs px-4 py-2 hover:bg-yellow-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                  >
                    {loadingQuestion ? <Loader2 className="w-3 h-3 animate-spin" /> : <SkipForward className="w-3 h-3" />}
                    NEXT
                  </button>
                )}
              </div>
            </div>
            <p className="text-[10px] text-zinc-600 mt-1">Ctrl+Enter to submit</p>
          </div>
        </div>
      )}
    </div>
  );
}
