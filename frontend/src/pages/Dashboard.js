import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { getDashboardOverview, getSkillRadar, getScoreTrend, getWeakTopics } from "@/lib/api";
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  BarChart, Bar
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
      <div className={`font-heading text-2xl font-bold ${accent ? "text-yellow-500" : "text-white"}`}>
        {value}
      </div>
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
  const navigate = useNavigate();
  const [overview, setOverview] = useState(null);
  const [radarData, setRadarData] = useState([]);
  const [trendData, setTrendData] = useState([]);
  const [weakTopics, setWeakTopics] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [ov, rd, td, wt] = await Promise.all([
          getDashboardOverview(),
          getSkillRadar(),
          getScoreTrend(),
          getWeakTopics(),
        ]);
        setOverview(ov.data);
        setRadarData(
          rd.data.map((r) => ({
            ...r,
            category: CATEGORY_LABELS[r.category] || r.category,
          }))
        );
        setTrendData(
          td.data.map((t, i) => ({
            ...t,
            label: `#${i + 1}`,
          }))
        );
        setWeakTopics(wt.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
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
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <div className="text-xs tracking-[0.2em] uppercase font-bold text-yellow-500 mb-2">
            PERFORMANCE
          </div>
          <h1 className="font-heading text-2xl sm:text-3xl lg:text-4xl tracking-tighter font-bold text-white mb-8">
            Dashboard
          </h1>
        </motion.div>

        {!hasData ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-24"
          >
            <Target className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
            <h3 className="font-heading text-lg font-semibold text-zinc-400 mb-2">
              No completed sessions yet
            </h3>
            <p className="text-sm text-zinc-600 mb-6">
              Complete your first interview to see performance analytics.
            </p>
            <button
              data-testid="dashboard-start-btn"
              onClick={() => navigate("/setup")}
              className="bg-yellow-500 text-black font-bold text-xs px-6 py-2 hover:bg-yellow-400 transition-colors inline-flex items-center gap-1"
            >
              START INTERVIEW <ArrowRight className="w-3 h-3" />
            </button>
          </motion.div>
        ) : (
          <>
            {/* Stats Grid */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
            >
              <StatCard icon={Target} label="Total Sessions" value={overview.total_sessions} />
              <StatCard icon={Award} label="Completed" value={overview.completed_sessions} />
              <StatCard icon={TrendingUp} label="Avg Score" value={`${overview.overall_avg_score}/10`} accent />
              <StatCard
                icon={Activity}
                label="Active"
                value={overview.total_sessions - overview.completed_sessions}
              />
            </motion.div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
              {/* Skill Radar */}
              {radarData.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="bg-[#121212] border border-[#27272A] p-6"
                  data-testid="skill-radar-chart"
                >
                  <h3 className="text-xs tracking-[0.2em] uppercase font-bold text-zinc-400 mb-4">
                    SKILL RADAR
                  </h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="#27272A" />
                      <PolarAngleAxis
                        dataKey="category"
                        tick={{ fill: "#A1A1AA", fontSize: 11, fontFamily: "JetBrains Mono" }}
                      />
                      <PolarRadiusAxis
                        domain={[0, 10]}
                        tick={{ fill: "#52525B", fontSize: 10 }}
                        axisLine={false}
                      />
                      <Radar
                        name="Score"
                        dataKey="avg_score"
                        stroke="#EAB308"
                        fill="#EAB308"
                        fillOpacity={0.15}
                        strokeWidth={2}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </motion.div>
              )}

              {/* Score Trend */}
              {trendData.length > 1 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="bg-[#121212] border border-[#27272A] p-6"
                  data-testid="score-trend-chart"
                >
                  <h3 className="text-xs tracking-[0.2em] uppercase font-bold text-zinc-400 mb-4">
                    SCORE TREND
                  </h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={trendData}>
                      <CartesianGrid stroke="#1A1A1A" strokeDasharray="3 3" />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: "#52525B", fontSize: 10, fontFamily: "JetBrains Mono" }}
                        axisLine={{ stroke: "#27272A" }}
                      />
                      <YAxis
                        domain={[0, 10]}
                        tick={{ fill: "#52525B", fontSize: 10 }}
                        axisLine={{ stroke: "#27272A" }}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Line
                        type="monotone"
                        dataKey="avg_score"
                        stroke="#EAB308"
                        strokeWidth={2}
                        dot={{ fill: "#EAB308", r: 3 }}
                        activeDot={{ fill: "#EAB308", r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </motion.div>
              )}
            </div>

            {/* Recent Sessions */}
            {overview.recent_sessions?.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                data-testid="recent-sessions-list"
              >
                <h3 className="text-xs tracking-[0.2em] uppercase font-bold text-zinc-400 mb-4">
                  RECENT SESSIONS
                </h3>
                <div className="space-y-2">
                  {overview.recent_sessions.map((s) => (
                    <div
                      key={s.id}
                      data-testid={`session-card-${s.id}`}
                      onClick={() => navigate(`/interview/${s.id}`)}
                      className="flex items-center justify-between bg-[#121212] border border-[#27272A] p-4 cursor-pointer hover:border-zinc-600 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-bold text-white">{s.tech_stack}</span>
                        <span className="text-[10px] tracking-[0.15em] px-2 py-0.5 bg-[#0A0A0A] border border-[#27272A] text-zinc-500">
                          {s.difficulty?.toUpperCase()}
                        </span>
                        <span className="text-xs text-zinc-600">
                          {CATEGORY_LABELS[s.category] || s.category}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className={`text-sm font-bold ${
                            (s.avg_score || 0) >= 7
                              ? "text-green-400"
                              : (s.avg_score || 0) >= 5
                              ? "text-yellow-500"
                              : "text-red-400"
                          }`}
                        >
                          {s.avg_score || 0}/10
                        </span>
                        <span className="text-xs text-zinc-600">
                          {s.completed_at
                            ? new Date(s.completed_at).toLocaleDateString()
                            : ""}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Weak Topics */}
            {weakTopics.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="bg-[#121212] border border-[#27272A] p-6 mb-8"
                data-testid="weak-topics-section"
              >
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <h3 className="text-xs tracking-[0.2em] uppercase font-bold text-zinc-400">
                    WEAK TOPICS - NEEDS IMPROVEMENT
                  </h3>
                </div>
                <ResponsiveContainer width="100%" height={Math.min(weakTopics.length * 35, 300)}>
                  <BarChart data={weakTopics.slice(0, 8)} layout="vertical" margin={{ left: 80 }}>
                    <CartesianGrid stroke="#1A1A1A" strokeDasharray="3 3" horizontal={false} />
                    <XAxis
                      type="number"
                      domain={[0, 10]}
                      tick={{ fill: "#52525B", fontSize: 10 }}
                      axisLine={{ stroke: "#27272A" }}
                    />
                    <YAxis
                      type="category"
                      dataKey="topic"
                      tick={{ fill: "#A1A1AA", fontSize: 11, fontFamily: "JetBrains Mono" }}
                      axisLine={{ stroke: "#27272A" }}
                      width={80}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="avg_score" fill="#EF4444" radius={[0, 2, 2, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </motion.div>
            )}

            {/* Quick Actions */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="flex gap-3"
            >
              <button
                data-testid="dashboard-compare-btn"
                onClick={() => navigate("/compare")}
                className="flex items-center gap-1 px-4 py-2 border border-[#27272A] text-xs font-bold text-zinc-400 hover:border-yellow-500 hover:text-yellow-500 transition-colors"
              >
                <ArrowLeftRight className="w-3 h-3" /> COMPARE SESSIONS
              </button>
              <button
                data-testid="dashboard-new-btn"
                onClick={() => navigate("/setup")}
                className="bg-yellow-500 text-black font-bold text-xs px-4 py-2 hover:bg-yellow-400 transition-colors flex items-center gap-1"
              >
                NEW INTERVIEW <ArrowRight className="w-3 h-3" />
              </button>
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
}
