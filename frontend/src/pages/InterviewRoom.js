"use client";

import { useRouter } from "next/router";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  getSession,
  completeSession,
  createBookmark,
  uploadAnswerAudio,
  deleteAnswerAudio,
  getQuestions,
  createRound,
  generateQuestion,
  submitAnswer,
  updateSubmittedAnswer,
  runCode,
} from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import CodeEditor from "@/components/CodeEditor";
import InterviewTimer from "@/components/InterviewTimer";
import {
  Loader2, Send, SkipForward, Square, Lightbulb,
  CheckCircle, XCircle, AlertTriangle, ArrowRight, BarChart3,
  Bookmark, FileText,
  Mic, MicOff, Volume2, VolumeX, Pencil, Trash2
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

function EvaluationSourceBadge({ feedback }) {
  const text = String(feedback || "");
  const isDbFallback =
    text.includes("DB-backed fallback evaluator") || text.includes("[evaluation_source: database_fallback]");
  if (isDbFallback) {
    return (
      <span className="text-[10px] tracking-[0.12em] font-bold px-2 py-0.5 border text-blue-300 bg-blue-500/10 border-blue-500/30">
        DB FALLBACK
      </span>
    );
  }
  return (
    <span className="text-[10px] tracking-[0.12em] font-bold px-2 py-0.5 border text-yellow-300 bg-yellow-500/10 border-yellow-500/30">
      AI
    </span>
  );
}

function normalizeStack(stack = "") {
  const s = stack.toLowerCase();
  if (s.includes("python")) return "python";
  if (s.includes("java") && !s.includes("javascript")) return "java";
  if (s.includes("javascript")) return "javascript";
  if (s.includes(".net") || s.includes("c#") || s.includes("dotnet")) return "dotnet";
  if (s.includes("angular")) return "angular";
  if (s.includes("react")) return "react";
  if (s.includes("vue")) return "vue";
  if (s.includes("ember")) return "ember";
  if (s.includes("next")) return "nextjs";
  if (s.includes("express")) return "express";
  return "nodejs";
}

function defaultLanguageForStack(stack = "") {
  const normalized = normalizeStack(stack);
  if (normalized === "python") return "python";
  if (normalized === "java") return "java";
  if (normalized === "dotnet") return "csharp";
  if (normalized === "angular") return "typescript";
  return "javascript";
}

function defaultStarterCodeForStack(stack = "") {
  const normalized = normalizeStack(stack);
  const starters = {
    nodejs: `function solve(input) {
  // TODO: parse input and implement solution
  return input.trim();
}

const fs = require("fs");
const input = fs.readFileSync(0, "utf8");
const output = solve(input);
process.stdout.write(String(output));`,
    react: `function solve(input) {
  // TODO: parse input and implement solution
  return input.trim();
}

const fs = require("fs");
const input = fs.readFileSync(0, "utf8");
console.log(solve(input));`,
    vue: `function solve(input) {
  // TODO: parse input and implement solution
  return input.trim();
}

const fs = require("fs");
const input = fs.readFileSync(0, "utf8");
console.log(solve(input));`,
    ember: `function solve(input) {
  // TODO: parse input and implement solution
  return input.trim();
}

const fs = require("fs");
const input = fs.readFileSync(0, "utf8");
console.log(solve(input));`,
    nextjs: `function solve(input) {
  // TODO: parse input and implement solution
  return input.trim();
}

const fs = require("fs");
const input = fs.readFileSync(0, "utf8");
console.log(solve(input));`,
    express: `function solve(input) {
  // TODO: parse input and implement solution
  return input.trim();
}

const fs = require("fs");
const input = fs.readFileSync(0, "utf8");
console.log(solve(input));`,
    angular: `function solve(input: string): string {
  // TODO: parse input and implement solution
  return input.trim();
}

import * as fs from "fs";
const input = fs.readFileSync(0, "utf8");
console.log(solve(input));`,
    python: `def solve(input_text: str) -> str:
    # TODO: parse input and implement solution
    return input_text.strip()

if __name__ == "__main__":
    import sys
    data = sys.stdin.read()
    print(solve(data))`,
    java: `import java.io.*;

public class Main {
    static String solve(String input) {
        // TODO: parse input and implement solution
        return input.trim();
    }

    public static void main(String[] args) throws Exception {
        String input = new String(System.in.readAllBytes());
        System.out.print(solve(input));
    }
}`,
    dotnet: `using System;

public class Program {
    static string Solve(string input) {
        // TODO: parse input and implement solution
        return input.Trim();
    }

    public static void Main() {
        var input = Console.In.ReadToEnd();
        Console.Write(Solve(input));
    }
}`,
    javascript: `function solve(input) {
  // TODO: parse input and implement solution
  return input.trim();
}

const fs = require("fs");
const input = fs.readFileSync(0, "utf8");
process.stdout.write(String(solve(input)));`,
  };
  return starters[normalized] || starters.nodejs;
}

function defaultTestCasesForStack(stack = "") {
  const normalized = normalizeStack(stack);
  const common = [
    { label: "Case 1", input: "hello world\n", expectedOutput: "hello world" },
    { label: "Case 2", input: "  sample text  \n", expectedOutput: "sample text" },
  ];
  if (normalized === "java" || normalized === "dotnet") {
    return common;
  }
  return common;
}

export default function InterviewRoom({ sessionId }) {
  const router = useRouter();
  const resolvedSessionId =
    sessionId || (typeof router.query?.sessionId === "string" ? router.query.sessionId : "");
  const { user } = useAuth();
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
  const [showEditorForExamples, setShowEditorForExamples] = useState(false);
  const [codeRunLoading, setCodeRunLoading] = useState(false);
  const [codeRunOutput, setCodeRunOutput] = useState("");
  const [codeStdin, setCodeStdin] = useState("");
  const [codeTestCases, setCodeTestCases] = useState([]);
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
  const voiceCommittedRef = useRef("");
  const [recordedAudioBlob, setRecordedAudioBlob] = useState(null);
  const [recordedAudioDurationMs, setRecordedAudioDurationMs] = useState(null);
  const [deletingAudioRoundId, setDeletingAudioRoundId] = useState("");

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
    voiceCommittedRef.current = (answerRef.current || "").trim();
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
      else setInterimTranscript("");
      if (finalTranscript) {
        const next = (voiceCommittedRef.current + (voiceCommittedRef.current ? " " : "") + finalTranscript).trim();
        voiceCommittedRef.current = next;
        setAnswer(next);
      }
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
    let cancelled = false;
    const load = async () => {
      try {
        if (!resolvedSessionId) return;
        const res = await getSession(resolvedSessionId);
        if (cancelled) return;
        const fetchedSession = res.data.session;
        setSession(fetchedSession);
        setRounds(res.data.rounds);
        if (res.data.usage?.hints?.length) {
          const lines = {
            other_active_guest_session_same_network:
              "Another guest interview is open on this network. Finish it or this session may share the same question quota.",
            possible_different_client_same_network:
              "We see another browser or private window on the same network (different client id).",
            other_active_session_same_account: "You have another active interview in another tab or window.",
          };
          for (const h of res.data.usage.hints) {
            if (lines[h]) {
              toast.info(lines[h], { duration: 7000 });
            }
          }
        }
        setUsedQuestionIds(
          (res.data.rounds || [])
            .map((round) => round.question_id)
            .filter(Boolean)
        );

        let localQuestions = [];
        if (fetchedSession.status !== "completed") {
          try {
            const questionPoolLimit = Math.max((fetchedSession.num_questions || 10) * 3, 20);
            const qRes = await getQuestions(
              fetchedSession.tech_stack,
              questionPoolLimit,
              fetchedSession.difficulty,
            );
            localQuestions = qRes.data || [];
            if (localQuestions.length === 0) {
              const fallbackRes = await getQuestions(undefined, questionPoolLimit, fetchedSession.difficulty);
              localQuestions = fallbackRes.data || [];
            }
            if (!cancelled) {
              setCachedQuestions(localQuestions);
              setQuestionLoadError("");
            }
          } catch (error) {
            if (!cancelled) {
              setQuestionLoadError("Failed to load interview questions.");
              toast.error("Failed to load interview questions");
            }
          }
        }

        if (cancelled) return;
        if (fetchedSession.status === "completed") {
          setInterviewComplete(true);
        } else if (res.data.rounds.length === 0) {
          await fetchNextQuestion(localQuestions, fetchedSession);
        } else {
          const lastRound = res.data.rounds[res.data.rounds.length - 1];
          if (!lastRound.answer) {
            setCurrentRound(lastRound);
            setUseCodeEditor(lastRound.question_type === "coding");
            if (lastRound.question_type === "coding" && !lastRound.answer) {
              setAnswer(lastRound.coding_template || defaultStarterCodeForStack(fetchedSession.tech_stack || ""));
              setCodeTestCases(lastRound.coding_test_cases || defaultTestCasesForStack(fetchedSession.tech_stack || ""));
            }
          }
        }
      } catch (err) {
        if (!cancelled) toast.error("Failed to load session");
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedSessionId]);

  const fetchNextQuestion = useCallback(async (customQuestionsList = null, curSession = null) => {
    setLoadingQuestion(true);
    setShowHint(false);
    setTimerActive(false);
    try {
      const s = curSession || session;
      const res = await generateQuestion(resolvedSessionId);
      setCurrentRound(res.data);
      setRounds((prev) => [...prev, res.data]);
      setUseCodeEditor(res.data.question_type === "coding");
      setShowEditorForExamples(false);
      setCodeRunOutput("");
      setCodeStdin("");
      setCodeTestCases(
        res.data?.coding_test_cases || defaultTestCasesForStack(s?.tech_stack || session?.tech_stack || ""),
      );
      if (res.data.question_type === "coding") {
        setAnswer(
          res.data?.coding_template ||
            defaultStarterCodeForStack(s?.tech_stack || session?.tech_stack || ""),
        );
      }
      setSession((prev) => ({ ...prev, questions_asked: res.data.order }));
      if (res.data?.question_id) {
        setUsedQuestionIds((prev) => [...new Set([...prev, res.data.question_id])]);
      }

      if (s?.timed_mode) setTimerActive(true);
      scrollToBottom();
    } catch (err) {
      const raw = err?.response?.data?.message;
      const msg = Array.isArray(raw)
        ? raw.join(" ")
        : raw || err?.response?.data?.detail || "Failed to load question. Please try again.";
      toast.error(msg);
    } finally {
      setLoadingQuestion(false);
    }
  }, [resolvedSessionId, scrollToBottom, session]);

  const handleRunCode = useCallback(async () => {
    if (!answer.trim()) {
      toast.error("Write code first to run it.");
      return;
    }
    setCodeRunLoading(true);
    setCodeRunOutput("");
    try {
      const res = await runCode(session?.tech_stack || "nodejs", answer, codeStdin);
      const payload = res?.data || {};
      const output = [
        payload.compile_output ? `Compile:\n${payload.compile_output}` : "",
        payload.output ? `Output:\n${payload.output}` : "",
        payload.stderr && !payload.output ? `Errors:\n${payload.stderr}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");
      setCodeRunOutput(output || "Execution completed with no output.");
    } catch (err) {
      const msg = err?.response?.data?.message || "Failed to run code.";
      setCodeRunOutput(`Error:\n${msg}`);
      toast.error("Code execution failed.");
    } finally {
      setCodeRunLoading(false);
    }
  }, [answer, codeStdin, session?.tech_stack]);

  const handleRunAllTests = useCallback(async () => {
    if (!answer.trim()) {
      toast.error("Write code first to run test cases.");
      return;
    }
    if (!codeTestCases.length) {
      toast.error("Add at least one test case.");
      return;
    }
    setCodeRunLoading(true);
    try {
      const results = [];
      for (const t of codeTestCases) {
        const res = await runCode(session?.tech_stack || "nodejs", answer, t.input || "");
        const out = String(res?.data?.output || "").trim();
        const expected = String(t.expectedOutput || "").trim();
        results.push({
          label: t.label || "Case",
          passed: out === expected,
          expected,
          got: out,
        });
      }
      const passCount = results.filter((r) => r.passed).length;
      const lines = results.map((r) =>
        `${r.passed ? "PASS" : "FAIL"} ${r.label}\nExpected: ${r.expected}\nGot: ${r.got}`,
      );
      setCodeRunOutput(`Test Summary: ${passCount}/${results.length} passed\n\n${lines.join("\n\n")}`);
      if (passCount === results.length) toast.success("All test cases passed.");
      else toast.warning(`${passCount}/${results.length} tests passed.`);
    } catch (err) {
      const msg = err?.response?.data?.message || "Failed to run test cases.";
      setCodeRunOutput(`Error:\n${msg}`);
      toast.error("Test run failed.");
    } finally {
      setCodeRunLoading(false);
    }
  }, [answer, codeTestCases, session?.tech_stack]);

  const handleSubmitAnswer = useCallback(async () => {
    const round = currentRoundRef.current;
    const answerText = (answerRef.current || "").trim();
    if (!answerText || !round) return;

    setEvaluating(true);
    setTimerActive(false);

    stopRecording();
    try {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    } catch {}

    const maybeUploadAudio = async () => {
      if (!recordedAudioBlob) return null;
      try {
        const audioRes = await uploadAnswerAudio(
          resolvedSessionId,
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
      const submittedRes = round.answer
        ? await updateSubmittedAnswer(resolvedSessionId, round.id, answerText)
        : await submitAnswer(resolvedSessionId, round.id, answerText);
      const submittedRound = submittedRes.data;
      setCurrentRound(null);
      setAnswer("");
      setRecordedAudioBlob(null);
      setRecordedAudioDurationMs(null);
      if (recordedAudioUrl) {
        URL.revokeObjectURL(recordedAudioUrl);
        setRecordedAudioUrl("");
      }
      setRounds((prev) =>
        prev.map((r) => (r.id === round.id ? { ...r, ...(uploadedAudio || {}), ...submittedRound } : r)),
      );
      scrollToBottom();
      setSession((prev) => ({ ...prev, questions_asked: submittedRound.order }));

      const isLastQuestion = submittedRound.order >= (session?.num_questions || 0);
      if (isLastQuestion) {
        try {
          const res = await completeSession(resolvedSessionId);
          setSession(res.data.session);
          setRounds(res.data.rounds || []);
          setInterviewComplete(true);
          if (res.data.ai_status === "db_only") {
            toast.success("Interview completed and evaluated using DB feedback.");
          } else if (res.data.ai_status === "not_configured") {
            toast.warning("Interview completed. AI evaluation skipped because Gemini API key is not configured.");
          } else if (res.data.ai_status === "rate_limited") {
            toast.warning(
              "Interview completed. AI hit limits, but your answers were still scored with the database reference model.",
            );
          } else if (res.data.session?.avg_score === null) {
            toast.warning("Interview completed. Answers were saved, but AI scoring is currently unavailable.");
          } else {
            toast.success("Interview completed and evaluated!");
          }
        } catch {
          toast.error("Answer saved, but failed to complete session.");
        }
      }
    } catch {
      toast.error("Failed to save answer. Please try again.");
    } finally {
      setEvaluating(false);
    }
  }, [
    resolvedSessionId,
    stopRecording,
    scrollToBottom,
    recordedAudioBlob,
    recordedAudioDurationMs,
    recordedAudioUrl,
    session,
  ]);

  const clearRecordedAudioPreview = useCallback(() => {
    setRecordedAudioBlob(null);
    setRecordedAudioDurationMs(null);
    if (recordedAudioUrl) {
      URL.revokeObjectURL(recordedAudioUrl);
      setRecordedAudioUrl("");
    }
  }, [recordedAudioUrl]);

  const handleEditRound = useCallback((round) => {
    if (!round?.answer) return;
    if (round.score !== null) {
      toast.error("Answer can no longer be edited after evaluation.");
      return;
    }
    if (currentRound && !currentRound.answer && currentRound.id !== round.id) {
      toast.error("Submit the current draft question first.");
      return;
    }
    setCurrentRound(round);
    setUseCodeEditor(round.question_type === "coding");
    setShowEditorForExamples(false);
    setCodeRunOutput("");
    setCodeStdin("");
    setCodeTestCases(round.coding_test_cases || defaultTestCasesForStack(session?.tech_stack || ""));
    setAnswer(
      round.answer ||
        (round.question_type === "coding"
          ? round.coding_template || defaultStarterCodeForStack(session?.tech_stack || "")
          : ""),
    );
    clearRecordedAudioPreview();
    setShowHint(false);
    if (session?.timed_mode) setTimerActive(true);
    scrollToBottom();
  }, [clearRecordedAudioPreview, currentRound, scrollToBottom, session]);

  const handleDeleteRoundAudio = useCallback(async (roundId) => {
    if (!roundId || deletingAudioRoundId) return;
    setDeletingAudioRoundId(roundId);
    try {
      const res = await deleteAnswerAudio(resolvedSessionId, roundId);
      setRounds((prev) => prev.map((r) => (r.id === roundId ? { ...r, ...res.data } : r)));
      if (currentRound?.id === roundId) clearRecordedAudioPreview();
      toast.success("Audio clip deleted.");
    } catch {
      toast.error("Failed to delete audio clip.");
    } finally {
      setDeletingAudioRoundId("");
    }
  }, [clearRecordedAudioPreview, currentRound, deletingAudioRoundId, resolvedSessionId]);

  const handleEndInterview = async () => {
    try {
      const res = await completeSession(resolvedSessionId);
      setSession(res.data.session);
      setInterviewComplete(true);
      toast.success("Interview completed!");
    } catch (err) {
      toast.error("Failed to complete session");
    }
  };

  const effectiveUseCodeEditor = useCodeEditor || showEditorForExamples;
  const editorLanguage = defaultLanguageForStack(session?.tech_stack || "");

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
      await createBookmark(resolvedSessionId, roundId);
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
              onClick={() => router.push(`/report/${resolvedSessionId}`)}
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
                    {round.answer && user && (
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
                        {!interviewComplete && round.score === null && (
                          <button
                            onClick={() => handleEditRound(round)}
                            className="ml-auto text-zinc-500 hover:text-yellow-500 transition-colors"
                            title="Edit this answer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
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
                          {!interviewComplete && round.score === null && (
                            <button
                              onClick={() => handleDeleteRoundAudio(round.id)}
                              disabled={deletingAudioRoundId === round.id}
                              className="mt-2 text-[11px] text-red-400 hover:text-red-300 disabled:opacity-60 inline-flex items-center gap-1"
                            >
                              <Trash2 className="w-3 h-3" />
                              {deletingAudioRoundId === round.id ? "Deleting..." : "Delete audio"}
                            </button>
                          )}
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
                          <EvaluationSourceBadge feedback={round.feedback} />
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

          {/* Saving answer */}
          {evaluating && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="ml-8">
              <div className="flex items-center gap-2 mb-2 text-xs text-zinc-500">
                <Loader2 className="w-3 h-3 animate-spin text-yellow-500" />
                Saving your answer...
              </div>
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
                  onClick={() => router.push("/setup")}
                  className="bg-yellow-500 text-black font-bold text-xs px-4 py-2 hover:bg-yellow-400 transition-colors flex items-center gap-1"
                >
                  NEW INTERVIEW <ArrowRight className="w-3 h-3" />
                </button>
                <button
                  data-testid="view-report-link"
                  onClick={() => router.push(`/report/${resolvedSessionId}`)}
                  className="border border-yellow-500/50 text-yellow-500 font-bold text-xs px-4 py-2 hover:bg-yellow-500/10 transition-colors flex items-center gap-1"
                >
                  <FileText className="w-3 h-3" /> VIEW REPORT
                </button>
                <button
                  data-testid="view-dashboard-btn"
                  onClick={() => router.push("/dashboard")}
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
                <button
                  onClick={clearRecordedAudioPreview}
                  className="mt-2 text-[11px] text-red-400 hover:text-red-300 inline-flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  Delete clip
                </button>
              </div>
            )}
            <div className="flex gap-2">
              {effectiveUseCodeEditor && currentRound && !currentRound.answer ? (
                <div className="flex-1">
                  <CodeEditor
                    value={answer}
                    onChange={(val) => setAnswer(val || "")}
                    language={editorLanguage}
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
                    {currentRound.question_type !== "coding" && (
                      <button
                        onClick={() => setShowEditorForExamples((v) => !v)}
                        className="bg-zinc-800 text-white font-bold text-xs px-4 py-2 hover:bg-zinc-700 transition-colors flex items-center gap-1"
                      >
                        {effectiveUseCodeEditor ? "HIDE EDITOR" : "SHOW EDITOR"}
                      </button>
                    )}
                    {effectiveUseCodeEditor && (
                      <button
                        onClick={handleRunCode}
                        disabled={codeRunLoading || evaluating || loadingQuestion}
                        className="bg-blue-600 text-white font-bold text-xs px-4 py-2 hover:bg-blue-500 transition-colors disabled:opacity-50 flex items-center gap-1"
                      >
                        {codeRunLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : "RUN CODE"}
                      </button>
                    )}
                    {effectiveUseCodeEditor && (
                      <button
                        onClick={handleRunAllTests}
                        disabled={codeRunLoading || evaluating || loadingQuestion}
                        className="bg-emerald-600 text-white font-bold text-xs px-4 py-2 hover:bg-emerald-500 transition-colors disabled:opacity-50 flex items-center gap-1"
                      >
                        {codeRunLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : "RUN TESTS"}
                      </button>
                    )}
                    {effectiveUseCodeEditor && !answer.trim() && (
                      <button
                        onClick={() => setAnswer(defaultStarterCodeForStack(session?.tech_stack || ""))}
                        className="bg-zinc-700 text-white font-bold text-xs px-4 py-2 hover:bg-zinc-600 transition-colors"
                      >
                        INSERT STARTER
                      </button>
                    )}
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
                      {currentRound?.answer ? "UPDATE" : "SUBMIT"}
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
            {effectiveUseCodeEditor && codeRunOutput && (
              <pre className="mt-3 bg-[#0A0A0A] border border-[#27272A] text-xs text-zinc-300 p-3 whitespace-pre-wrap max-h-48 overflow-auto">
                {codeRunOutput}
              </pre>
            )}
            {effectiveUseCodeEditor && (
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] tracking-[0.15em] text-zinc-500 block mb-1">STDIN (single run)</label>
                  <textarea
                    value={codeStdin}
                    onChange={(e) => setCodeStdin(e.target.value)}
                    rows={4}
                    className="w-full bg-[#0A0A0A] border border-[#27272A] text-xs text-white p-2 resize-y"
                    placeholder="Input for RUN CODE..."
                  />
                </div>
                <div>
                  <label className="text-[10px] tracking-[0.15em] text-zinc-500 block mb-1">TEST CASES</label>
                  <div className="space-y-2 max-h-52 overflow-auto pr-1">
                    {codeTestCases.map((t, idx) => (
                      <div key={`${t.label}-${idx}`} className="border border-[#27272A] p-2">
                        <div className="text-[10px] text-zinc-500 mb-1">{t.label}</div>
                        <textarea
                          value={t.input}
                          onChange={(e) =>
                            setCodeTestCases((prev) =>
                              prev.map((x, i) => (i === idx ? { ...x, input: e.target.value } : x)),
                            )
                          }
                          rows={2}
                          className="w-full bg-[#0A0A0A] border border-[#27272A] text-[11px] text-white p-2 mb-1"
                          placeholder="stdin"
                        />
                        <input
                          value={t.expectedOutput}
                          onChange={(e) =>
                            setCodeTestCases((prev) =>
                              prev.map((x, i) => (i === idx ? { ...x, expectedOutput: e.target.value } : x)),
                            )
                          }
                          className="w-full bg-[#0A0A0A] border border-[#27272A] text-[11px] text-white p-2"
                          placeholder="expected output"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            <p className="text-[10px] text-zinc-600 mt-1">Ctrl+Enter to submit</p>
          </div>
        </div>
      )}
    </div>
  );
}
