"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import { listSessions } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, ArrowRight, CheckCircle, Play } from "lucide-react";

const CATEGORY_LABELS = {
  frontend: "Frontend",
  backend: "Backend",
  fullstack: "Full Stack",
  system_design: "System Design",
  dsa: "DSA",
};

function SessionRow({ session, onClick }) {
  const isCompleted = session.status === "completed";
  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      data-testid={`history-session-${session.id}`}
      className="flex items-center justify-between bg-[#121212] border border-[#27272A] p-4 cursor-pointer hover:border-zinc-600 transition-colors group"
    >
      <div className="flex items-center gap-4">
        <div className={`w-8 h-8 flex items-center justify-center border ${
          isCompleted ? "border-green-400/30 bg-green-400/5" : "border-yellow-500/30 bg-yellow-500/5"
        }`}>
          {isCompleted ? (
            <CheckCircle className="w-4 h-4 text-green-400" />
          ) : (
            <Play className="w-4 h-4 text-yellow-500" />
          )}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">{session.tech_stack}</span>
            <span className="text-[10px] tracking-[0.15em] px-1.5 py-0.5 bg-[#0A0A0A] border border-[#27272A] text-zinc-500 uppercase">
              {session.difficulty}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-zinc-600">
              {CATEGORY_LABELS[session.category] || session.category}
            </span>
            <span className="text-xs text-zinc-700">
              {session.questions_asked}/{session.num_questions} questions
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        {session.avg_score !== null && (
          <span className={`text-lg font-bold ${
            session.avg_score >= 7 ? "text-green-400" : session.avg_score >= 5 ? "text-yellow-500" : "text-red-400"
          }`}>
            {session.avg_score}/10
          </span>
        )}
        <div className="text-right">
          <div className={`text-[10px] tracking-[0.15em] font-bold ${isCompleted ? "text-green-400" : "text-yellow-500"}`}>
            {isCompleted ? "COMPLETED" : "ACTIVE"}
          </div>
          <div className="text-[10px] text-zinc-600">
            {session.created_at ? new Date(session.created_at).toLocaleDateString() : ""}
          </div>
        </div>
        <ArrowRight className="w-4 h-4 text-zinc-700 group-hover:text-yellow-500 transition-colors" />
      </div>
    </motion.div>
  );
}

export default function HistoryPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const res = await listSessions();
        setSessions(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  const filtered = activeTab === "all"
    ? sessions
    : sessions.filter((s) => s.status === activeTab);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-yellow-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-yellow-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A]" data-testid="history-page">
      <div className="max-w-4xl mx-auto px-6 md:px-8 pt-8 pb-24">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <div className="text-xs tracking-[0.2em] uppercase font-bold text-yellow-500 mb-2">
            SESSION LOG
          </div>
          <h1 className="font-heading text-2xl sm:text-3xl lg:text-4xl tracking-tighter font-bold text-white mb-6">
            Interview History
          </h1>
        </motion.div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
          <TabsList className="bg-[#121212] border border-[#27272A] rounded-none p-0.5">
            <TabsTrigger
              value="all"
              data-testid="history-tab-all"
              className="rounded-none text-xs tracking-[0.1em] font-bold data-[state=active]:bg-yellow-500 data-[state=active]:text-black"
            >
              ALL ({sessions.length})
            </TabsTrigger>
            <TabsTrigger
              value="completed"
              data-testid="history-tab-completed"
              className="rounded-none text-xs tracking-[0.1em] font-bold data-[state=active]:bg-yellow-500 data-[state=active]:text-black"
            >
              COMPLETED ({sessions.filter(s => s.status === "completed").length})
            </TabsTrigger>
            <TabsTrigger
              value="active"
              data-testid="history-tab-active"
              className="rounded-none text-xs tracking-[0.1em] font-bold data-[state=active]:bg-yellow-500 data-[state=active]:text-black"
            >
              ACTIVE ({sessions.filter(s => s.status === "active").length})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {filtered.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20">
            <Clock className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
            <h3 className="font-heading text-lg font-semibold text-zinc-400 mb-2">
              No sessions found
            </h3>
            <p className="text-sm text-zinc-600 mb-6">
              {activeTab === "all" ? "Start your first interview to see it here." : `No ${activeTab} sessions.`}
            </p>
            <button
              data-testid="history-start-btn"
              onClick={() => router.push("/setup")}
              className="bg-yellow-500 text-black font-bold text-xs px-6 py-2 hover:bg-yellow-400 transition-colors inline-flex items-center gap-1"
            >
              START INTERVIEW <ArrowRight className="w-3 h-3" />
            </button>
          </motion.div>
        ) : (
          <div className="space-y-2">
            {filtered.map((session) => (
              <SessionRow
                key={session.id}
                session={session}
                onClick={() => router.push(`/interview/${session.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
