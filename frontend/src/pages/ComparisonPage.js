"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import { getComparisonData } from "@/lib/api";
import { listSessions } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeftRight, Trophy, TrendingUp, Target } from "lucide-react";

const CATEGORY_LABELS = {
  frontend: "Frontend", backend: "Backend", fullstack: "Full Stack",
  system_design: "System Design", dsa: "DSA",
};

function ScoreBar({ score, label }) {
  const color = score >= 7 ? "bg-green-400" : score >= 5 ? "bg-yellow-500" : "bg-red-400";
  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-zinc-400">{label}</span>
        <span className="text-white font-bold">{score}/10</span>
      </div>
      <div className="h-1.5 bg-[#0A0A0A]">
        <div className={`h-full ${color} transition-all`} style={{ width: `${score * 10}%` }} />
      </div>
    </div>
  );
}

export default function ComparisonPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [session1, setSession1] = useState("");
  const [session2, setSession2] = useState("");
  const [comparison, setComparison] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    listSessions("completed").then((r) => setSessions(r.data)).catch(console.error);
  }, [user]);

  const handleCompare = async () => {
    if (!session1 || !session2) return;
    setLoading(true);
    try {
      const res = await getComparisonData(session1, session2);
      setComparison(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-yellow-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A]" data-testid="comparison-page">
      <div className="max-w-5xl mx-auto px-6 md:px-8 pt-8 pb-24">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-xs tracking-[0.2em] uppercase font-bold text-yellow-500 mb-2">COMPARE</div>
          <h1 className="font-heading text-2xl sm:text-3xl tracking-tighter font-bold text-white mb-8">
            Session Comparison
          </h1>
        </motion.div>

        {/* Session Selector */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-end mb-8">
          <div>
            <label className="text-[10px] tracking-[0.2em] uppercase font-bold text-zinc-500 block mb-2">SESSION A</label>
            <select
              data-testid="compare-session1-select"
              value={session1}
              onChange={(e) => setSession1(e.target.value)}
              className="w-full bg-[#0A0A0A] border border-[#27272A] text-sm text-white p-2.5 focus:outline-none focus:border-yellow-500"
            >
              <option value="">Select session...</option>
              {sessions.filter(s => s.id !== session2).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.tech_stack} - {s.difficulty} ({s.avg_score}/10)
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-center py-2">
            <ArrowLeftRight className="w-5 h-5 text-zinc-600" />
          </div>
          <div>
            <label className="text-[10px] tracking-[0.2em] uppercase font-bold text-zinc-500 block mb-2">SESSION B</label>
            <select
              data-testid="compare-session2-select"
              value={session2}
              onChange={(e) => setSession2(e.target.value)}
              className="w-full bg-[#0A0A0A] border border-[#27272A] text-sm text-white p-2.5 focus:outline-none focus:border-yellow-500"
            >
              <option value="">Select session...</option>
              {sessions.filter(s => s.id !== session1).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.tech_stack} - {s.difficulty} ({s.avg_score}/10)
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          data-testid="compare-btn"
          onClick={handleCompare}
          disabled={!session1 || !session2 || loading}
          className="bg-yellow-500 text-black font-bold text-xs tracking-[0.1em] px-6 py-2.5 hover:bg-yellow-400 transition-colors disabled:opacity-50 mb-8"
        >
          {loading ? "COMPARING..." : "COMPARE SESSIONS"}
        </button>

        {/* Comparison Results */}
        {comparison && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {/* Overall Scores */}
            <div className="grid grid-cols-2 gap-4">
              {[comparison.session_a, comparison.session_b].map((s, i) => (
                <div key={i} className="bg-[#121212] border border-[#27272A] p-6">
                  <div className="text-[10px] tracking-[0.2em] text-zinc-500 mb-1">SESSION {i === 0 ? "A" : "B"}</div>
                  <h3 className="font-heading text-lg font-bold text-white mb-1">{s.tech_stack}</h3>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-[10px] px-1.5 py-0.5 bg-[#0A0A0A] border border-[#27272A] text-zinc-500 uppercase">{s.difficulty}</span>
                    <span className="text-xs text-zinc-600">{CATEGORY_LABELS[s.category] || s.category}</span>
                  </div>
                  <div className={`text-3xl font-bold ${(s.avg_score || 0) >= 7 ? "text-green-400" : (s.avg_score || 0) >= 5 ? "text-yellow-500" : "text-red-400"}`}>
                    {s.avg_score || 0}<span className="text-lg text-zinc-600">/10</span>
                  </div>
                  <div className="text-xs text-zinc-600 mt-1">{s.questions_asked} questions answered</div>
                </div>
              ))}
            </div>

            {/* Winner */}
            {comparison.winner && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 p-4 flex items-center gap-3">
                <Trophy className="w-5 h-5 text-yellow-500" />
                <div>
                  <span className="text-sm font-bold text-yellow-500">
                    Session {comparison.winner === "a" ? "A" : "B"} wins
                  </span>
                  <span className="text-xs text-zinc-400 ml-2">
                    by {Math.abs((comparison.session_a.avg_score || 0) - (comparison.session_b.avg_score || 0)).toFixed(1)} points
                  </span>
                </div>
              </div>
            )}

            {/* Round-by-Round */}
            {comparison.rounds_a && comparison.rounds_b && (
              <div className="bg-[#121212] border border-[#27272A] p-6">
                <h3 className="text-xs tracking-[0.2em] uppercase font-bold text-zinc-400 mb-4">ROUND-BY-ROUND SCORES</h3>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <div className="text-[10px] text-zinc-600 mb-2">SESSION A</div>
                    {comparison.rounds_a.map((r, i) => (
                      <ScoreBar key={i} score={r.score || 0} label={`Q${i + 1}: ${r.topic || 'General'}`} />
                    ))}
                  </div>
                  <div>
                    <div className="text-[10px] text-zinc-600 mb-2">SESSION B</div>
                    {comparison.rounds_b.map((r, i) => (
                      <ScoreBar key={i} score={r.score || 0} label={`Q${i + 1}: ${r.topic || 'General'}`} />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {sessions.length < 2 && (
          <div className="text-center py-16">
            <Target className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
            <p className="text-sm text-zinc-500 mb-4">Complete at least 2 sessions to compare</p>
            <button
              onClick={() => router.push("/setup")}
              className="bg-yellow-500 text-black font-bold text-xs px-4 py-2 hover:bg-yellow-400 transition-colors"
            >
              START INTERVIEW
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
