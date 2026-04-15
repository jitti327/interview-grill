import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { getSession, generateQuestion, evaluateAnswer, completeSession } from "@/lib/api";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Loader2, Send, SkipForward, Square, Lightbulb,
  CheckCircle, XCircle, AlertTriangle, ArrowRight, BarChart3
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
  const [loadingQuestion, setLoadingQuestion] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [interviewComplete, setInterviewComplete] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      if (scrollRef.current) {
        const el = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
        if (el) el.scrollTop = el.scrollHeight;
      }
    }, 100);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await getSession(sessionId);
        setSession(res.data.session);
        setRounds(res.data.rounds);
        if (res.data.session.status === "completed") {
          setInterviewComplete(true);
        } else if (res.data.rounds.length === 0) {
          fetchNextQuestion();
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
  }, [sessionId]);

  const fetchNextQuestion = async () => {
    setLoadingQuestion(true);
    setShowHint(false);
    try {
      const res = await generateQuestion(sessionId);
      setCurrentRound(res.data);
      setRounds((prev) => [...prev, res.data]);
      scrollToBottom();
    } catch (err) {
      toast.error("Failed to generate question");
    } finally {
      setLoadingQuestion(false);
    }
  };

  const handleSubmitAnswer = async () => {
    if (!answer.trim() || !currentRound) return;
    setEvaluating(true);
    try {
      const res = await evaluateAnswer(sessionId, currentRound.id, answer.trim());
      setRounds((prev) =>
        prev.map((r) => (r.id === currentRound.id ? { ...r, ...res.data } : r))
      );
      setCurrentRound(null);
      setAnswer("");
      scrollToBottom();

      const sess = await getSession(sessionId);
      setSession(sess.data.session);
      if (sess.data.session.questions_asked >= sess.data.session.num_questions) {
        await handleEndInterview();
      }
    } catch (err) {
      toast.error("Failed to evaluate answer");
    } finally {
      setEvaluating(false);
    }
  };

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
          {session.avg_score !== null && <ScoreBadge score={session.avg_score} />}
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
              AI is preparing your next question...
            </motion.div>
          )}

          {/* Evaluating */}
          {evaluating && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 ml-8 text-xs text-zinc-500">
              <Loader2 className="w-3 h-3 animate-spin text-yellow-500" />
              AI is evaluating your answer...
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
            <div className="flex gap-2">
              <textarea
                data-testid="answer-textarea"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder={currentRound ? "Type your answer..." : "Waiting for next question..."}
                disabled={!currentRound || evaluating || loadingQuestion}
                rows={3}
                className="flex-1 bg-[#0A0A0A] border border-[#27272A] text-sm text-white p-3 resize-none focus:outline-none focus:border-yellow-500 placeholder-zinc-600 disabled:opacity-50"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.ctrlKey) handleSubmitAnswer();
                }}
              />
              <div className="flex flex-col gap-2">
                {currentRound && !currentRound.answer ? (
                  <button
                    data-testid="submit-answer-btn"
                    onClick={handleSubmitAnswer}
                    disabled={!answer.trim() || evaluating}
                    className="bg-yellow-500 text-black font-bold text-xs px-4 py-2 hover:bg-yellow-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                  >
                    {evaluating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                    SUBMIT
                  </button>
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
