"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import { getSession } from "@/lib/api";
import { Share2, Printer, CheckCircle, XCircle, Zap } from "lucide-react";

const CATEGORY_LABELS = {
  frontend: "Frontend", backend: "Backend", fullstack: "Full Stack",
  system_design: "System Design", dsa: "DSA",
};

function EvaluationSourcePill({ feedback }) {
  const text = String(feedback || "");
  const isDbFallback =
    text.includes("DB-backed fallback evaluator") || text.includes("[evaluation_source: database_fallback]");
  if (isDbFallback) {
    return (
      <span className="text-[10px] px-1.5 py-0.5 border text-blue-300 bg-blue-500/10 border-blue-500/30">
        DB FALLBACK
      </span>
    );
  }
  return (
    <span className="text-[10px] px-1.5 py-0.5 border text-yellow-300 bg-yellow-500/10 border-yellow-500/30">
      AI
    </span>
  );
}

export default function ReportPage({ sessionId }) {
  const router = useRouter();
  const resolvedSessionId =
    sessionId || (typeof router.query?.sessionId === "string" ? router.query.sessionId : "");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!resolvedSessionId) return;
    getSession(resolvedSessionId)
      .then((r) => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [resolvedSessionId]);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-yellow-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!data) return <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center text-zinc-500">Report not found</div>;

  const { session, rounds } = data;
  const scored = rounds.filter((r) => r.score !== null);
  const visibleRounds = rounds.filter((r) => r.score !== null || (r.feedback && String(r.feedback).trim()));
  const avgScore = scored.length ? (scored.reduce((a, r) => a + r.score, 0) / scored.length).toFixed(1) : 0;
  const strongCount = scored.filter((r) => r.verdict === "strong").length;
  const weakCount = scored.filter((r) => r.verdict === "poor" || r.verdict === "needs_improvement").length;

  return (
    <div className="min-h-screen bg-[#0A0A0A] print:bg-white print:text-black" data-testid="report-page">
      {/* Action Buttons */}
      <div className="max-w-3xl mx-auto px-6 pt-6 flex items-center gap-2 print:hidden">
        <button
          data-testid="report-share-btn"
          onClick={handleShare}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold border border-[#27272A] text-zinc-400 hover:border-yellow-500 hover:text-yellow-500 transition-colors"
        >
          <Share2 className="w-3 h-3" /> {copied ? "COPIED!" : "SHARE LINK"}
        </button>
        <button
          data-testid="report-print-btn"
          onClick={() => window.print()}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold border border-[#27272A] text-zinc-400 hover:border-yellow-500 hover:text-yellow-500 transition-colors"
        >
          <Printer className="w-3 h-3" /> PRINT / PDF
        </button>
      </div>

      {/* Report Card */}
      <div className="max-w-3xl mx-auto px-6 md:px-8 pt-8 pb-24">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {/* Header */}
          <div className="bg-[#121212] border border-[#27272A] p-8 mb-6 print:bg-white print:border-gray-200">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-5 h-5 text-yellow-500" />
              <span className="font-heading text-lg font-bold text-white print:text-black">
                DEV<span className="text-yellow-500">GRILL</span> Report
              </span>
            </div>

            <div className="grid grid-cols-3 gap-6 mb-6">
              <div>
                <div className="text-[10px] tracking-[0.2em] text-zinc-500 mb-1">TECH STACK</div>
                <div className="font-heading text-lg font-bold text-white print:text-black">{session.tech_stack}</div>
              </div>
              <div>
                <div className="text-[10px] tracking-[0.2em] text-zinc-500 mb-1">CATEGORY</div>
                <div className="font-heading text-lg font-bold text-white print:text-black">
                  {CATEGORY_LABELS[session.category] || session.category}
                </div>
              </div>
              <div>
                <div className="text-[10px] tracking-[0.2em] text-zinc-500 mb-1">DIFFICULTY</div>
                <div className="font-heading text-lg font-bold text-white print:text-black capitalize">{session.difficulty}</div>
              </div>
            </div>

            {/* Score */}
            <div className="flex items-end gap-6 p-4 bg-[#0A0A0A] border border-[#27272A] print:bg-gray-50 print:border-gray-200">
              <div>
                <div className="text-[10px] tracking-[0.2em] text-zinc-500 mb-1">OVERALL SCORE</div>
                <div className={`font-heading text-4xl font-bold ${
                  avgScore >= 7 ? "text-green-400" : avgScore >= 5 ? "text-yellow-500" : "text-red-400"
                }`}>
                  {avgScore}<span className="text-xl text-zinc-600">/10</span>
                </div>
              </div>
              <div className="flex gap-4 text-xs">
                <div>
                  <span className="text-zinc-500">Questions: </span>
                  <span className="text-white print:text-black font-bold">{scored.length}</span>
                </div>
                <div>
                  <span className="text-zinc-500">Strong: </span>
                  <span className="text-green-400 font-bold">{strongCount}</span>
                </div>
                <div>
                  <span className="text-zinc-500">Weak: </span>
                  <span className="text-red-400 font-bold">{weakCount}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Questions Breakdown */}
          <div className="space-y-3">
            <h3 className="text-xs tracking-[0.2em] uppercase font-bold text-zinc-400 mb-2">QUESTION BREAKDOWN</h3>
            {visibleRounds.map((round, idx) => (
              <div key={round.id} className="bg-[#121212] border border-[#27272A] p-4 print:bg-white print:border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white print:text-black">Q{idx + 1}</span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-[#0A0A0A] border border-[#27272A] text-zinc-500 print:bg-gray-100">{round.topic}</span>
                    <span className="text-[10px] text-zinc-600 uppercase">{round.question_type}</span>
                    <EvaluationSourcePill feedback={round.feedback} />
                  </div>
                  <div className="flex items-center gap-2">
                    {round.score !== null ? (
                      <>
                        <span className={`text-sm font-bold ${
                          (round.score || 0) >= 7 ? "text-green-400" : (round.score || 0) >= 5 ? "text-yellow-500" : "text-red-400"
                        }`}>{round.score}/10</span>
                        {round.verdict === "strong" && <CheckCircle className="w-3.5 h-3.5 text-green-400" />}
                        {(round.verdict === "poor" || round.verdict === "needs_improvement") && <XCircle className="w-3.5 h-3.5 text-red-400" />}
                      </>
                    ) : (
                      <span className="text-[11px] text-zinc-500">Feedback only</span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-zinc-400 print:text-gray-600 leading-relaxed">{round.question}</p>
                {round.answer && (
                  <div className="mt-2">
                    <div className="text-[10px] tracking-[0.15em] text-zinc-500 mb-1">YOUR ANSWER</div>
                    <p className="text-[11px] text-zinc-300 print:text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {round.answer}
                    </p>
                  </div>
                )}
                {round.answer_audio_url && (
                  <div className="mt-3 print:hidden">
                    <div className="text-[10px] tracking-[0.15em] text-zinc-500 mb-1">ANSWER AUDIO</div>
                    <audio controls preload="none" className="w-full" src={round.answer_audio_url}>
                      Your browser does not support audio playback.
                    </audio>
                  </div>
                )}
                {round.feedback && (
                  <p className="text-[11px] text-zinc-500 print:text-gray-500 mt-2 pl-3 border-l border-[#27272A] print:border-gray-300">
                    {round.feedback}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="mt-8 text-center text-xs text-zinc-600 print:text-gray-400">
            Generated by DevGrill AI - {new Date().toLocaleDateString()}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
