"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import { getDashboardOverview, getSkillRadar, getScoreTrend, getWeakTopics } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  BarChart, Bar,
} from "recharts";
import { Target, TrendingUp, Award, Activity, ArrowRight, AlertTriangle, ArrowLeftRight } from "lucide-react";

const CATEGORY_LABELS = {
  frontend: "Frontend",
  backend: "Backend",
  fullstack: "Full Stack",
  system_design: "System Design",
  dsa: "DSA",
};

function StatCard({ icon: Icon, label, value, accent }) {
  return (
    <div className="bg-[#121212] border border-[#27272A] p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${accent ? "text-yellow-500" : "text-zinc-500"}`} />
        <span className="text-[10px] tracking-[0.2em] uppercase font-bold text-zinc-500">{label}</span>
      </div>
      <div className={`font-heading text-2xl font-bold ${accent ? "text-yellow-500" : "text-white"}`}>{value}</div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#121212] border border-[#27272A] px-3 py-2 text-xs">
        <p className="text-zinc-400">{label}</p>
        <p className="text-yellow-500 font-bold">{payload[0].value}/10</p>
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [overview, setOverview] = useState(null);
  const [radarData, setRadarData] = useState([]);
  const [trendData, setTrendData] = useState([]);
  const [weakTopics, setWeakTopics] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const [ov, rd, td, wt] = await Promise.all([
          getDashboardOverview(),
          getSkillRadar(),
          getScoreTrend(),
          getWeakTopics(),
        ]);
        setOverview(ov.data);
        setRadarData(rd.data.map((r) => ({ ...r, category: CATEGORY_LABELS[r.category] || r.category })));
        setTrendData(td.data.map((t, i) => ({ ...t, label: `#${i + 1}` })));
        setWeakTopics(wt.data);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  if (authLoading || !user || loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-yellow-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  const hasData = overview && overview.completed_sessions > 0;

  return (
    <div className="min-h-screen bg-[#0A0A0A]" data-testid="dashboard-page">
      <div className="max-w-7xl mx-auto px-6 md:px-8 lg:px-12 pt-8 pb-24">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-xs tracking-[0.2em] uppercase font-bold text-yellow-500 mb-2">PERFORMANCE</div>
          <h1 className="font-heading text-2xl sm:text-3xl lg:text-4xl tracking-tighter font-bold text-white mb-8">
            Dashboard
          </h1>
        </motion.div>

        {!hasData ? (
          <div className="text-center py-24">
            <Target className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
            <p className="text-sm text-zinc-600 mb-6">Complete your first interview to see analytics.</p>
            <button onClick={() => router.push("/setup")} className="bg-yellow-500 text-black font-bold text-xs px-6 py-2 hover:bg-yellow-400 transition-colors inline-flex items-center gap-1">
              START INTERVIEW <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <StatCard icon={Target} label="Total Sessions" value={overview.total_sessions} />
              <StatCard icon={Award} label="Completed" value={overview.completed_sessions} />
              <StatCard icon={TrendingUp} label="Avg Score" value={`${overview.overall_avg_score}/10`} accent />
              <StatCard icon={Activity} label="Active" value={overview.total_sessions - overview.completed_sessions} />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <StatCard icon={Award} label="Best Score" value={`${overview.best_score || 0}/10`} />
              <StatCard icon={TrendingUp} label="Improvement" value={`${overview.improvement_delta >= 0 ? "+" : ""}${overview.improvement_delta || 0}`} accent={overview.improvement_delta > 0} />
              <StatCard icon={Target} label="Rank" value={overview.user_rank || "-"} />
              <StatCard icon={Activity} label="Percentile" value={overview.percentile ? `${overview.percentile}%` : "-"} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
              {radarData.length > 0 && (
                <div className="bg-[#121212] border border-[#27272A] p-6" data-testid="skill-radar-chart">
                  <h3 className="text-xs tracking-[0.2em] uppercase font-bold text-zinc-400 mb-4">SKILL RADAR</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="#27272A" />
                      <PolarAngleAxis dataKey="category" tick={{ fill: "#A1A1AA", fontSize: 11 }} />
                      <PolarRadiusAxis domain={[0, 10]} tick={{ fill: "#52525B", fontSize: 10 }} axisLine={false} />
                      <Radar dataKey="avg_score" stroke="#EAB308" fill="#EAB308" fillOpacity={0.15} strokeWidth={2} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {trendData.length > 1 && (
                <div className="bg-[#121212] border border-[#27272A] p-6" data-testid="score-trend-chart">
                  <h3 className="text-xs tracking-[0.2em] uppercase font-bold text-zinc-400 mb-4">SCORE TREND</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={trendData}>
                      <CartesianGrid stroke="#1A1A1A" strokeDasharray="3 3" />
                      <XAxis dataKey="label" tick={{ fill: "#52525B", fontSize: 10 }} axisLine={{ stroke: "#27272A" }} />
                      <YAxis domain={[0, 10]} tick={{ fill: "#52525B", fontSize: 10 }} axisLine={{ stroke: "#27272A" }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Line type="monotone" dataKey="avg_score" stroke="#EAB308" strokeWidth={2} dot={{ fill: "#EAB308", r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {weakTopics.length > 0 && (
              <div className="bg-[#121212] border border-[#27272A] p-6 mb-8" data-testid="weak-topics-section">
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <h3 className="text-xs tracking-[0.2em] uppercase font-bold text-zinc-400">WEAK TOPICS</h3>
                </div>
                <ResponsiveContainer width="100%" height={Math.min(weakTopics.length * 35, 300)}>
                  <BarChart data={weakTopics.slice(0, 8)} layout="vertical" margin={{ left: 80 }}>
                    <CartesianGrid stroke="#1A1A1A" strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" domain={[0, 10]} tick={{ fill: "#52525B", fontSize: 10 }} />
                    <YAxis type="category" dataKey="topic" tick={{ fill: "#A1A1AA", fontSize: 11 }} width={80} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="avg_score" fill="#EF4444" radius={[0, 2, 2, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => router.push("/compare")} className="flex items-center gap-1 px-4 py-2 border border-[#27272A] text-xs font-bold text-zinc-400 hover:border-yellow-500 hover:text-yellow-500 transition-colors">
                <ArrowLeftRight className="w-3 h-3" /> COMPARE SESSIONS
              </button>
              <button onClick={() => router.push("/setup")} className="bg-yellow-500 text-black font-bold text-xs px-4 py-2 hover:bg-yellow-400 transition-colors flex items-center gap-1">
                NEW INTERVIEW <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
