import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import api from "@/lib/api";
import { BookOpen, Target, TrendingDown, TrendingUp, ArrowRight, Loader2, Sparkles, CheckCircle } from "lucide-react";

export default function StudyPlanPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/coach/study-plan").then(r => setData(r.data)).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
      <div className="flex items-center gap-3">
        <Loader2 className="w-5 h-5 text-yellow-500 animate-spin" />
        <span className="text-sm text-zinc-400">AI Coach is analyzing your performance...</span>
      </div>
    </div>
  );

  if (!data) return <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center text-zinc-500 text-sm">Failed to load study plan</div>;

  const plan = data.plan;
  const hasWeekly = plan?.weekly_plan?.length > 0;

  return (
    <div className="min-h-screen bg-[#0A0A0A]" data-testid="study-plan-page">
      <div className="max-w-4xl mx-auto px-6 md:px-8 pt-8 pb-24">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-yellow-500" />
            <span className="text-xs tracking-[0.2em] uppercase font-bold text-yellow-500">AI COACH</span>
          </div>
          <h1 className="font-heading text-2xl sm:text-3xl lg:text-4xl tracking-tighter font-bold text-white mb-2">
            Your Study Plan
          </h1>
          <p className="text-sm text-zinc-500 mb-8">
            {data.ai_generated ? "Personalized by AI based on your interview performance" : "Based on your interview history"}
          </p>
        </motion.div>

        {data.weak_topics?.length === 0 ? (
          <div className="text-center py-20">
            <BookOpen className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
            <p className="text-sm text-zinc-500 mb-4">{typeof plan === 'string' ? plan : 'Complete some interviews to get a personalized study plan.'}</p>
            <button data-testid="study-start-btn" onClick={() => navigate("/setup")} className="bg-yellow-500 text-black font-bold text-xs px-6 py-2 hover:bg-yellow-400 transition-colors inline-flex items-center gap-1">
              START INTERVIEW <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Topic Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Weak Topics */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="bg-[#121212] border border-red-400/20 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingDown className="w-4 h-4 text-red-400" />
                  <span className="text-xs tracking-[0.2em] uppercase font-bold text-red-400">FOCUS AREAS</span>
                </div>
                <div className="space-y-2">
                  {data.weak_topics?.map((t, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-xs text-zinc-300">{t.topic}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1 bg-[#0A0A0A]">
                          <div className="h-full bg-red-400" style={{ width: `${t.avg_score * 10}%` }} />
                        </div>
                        <span className="text-xs font-bold text-red-400">{t.avg_score}/10</span>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Strong Topics */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                className="bg-[#121212] border border-green-400/20 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-green-400" />
                  <span className="text-xs tracking-[0.2em] uppercase font-bold text-green-400">STRONG AREAS</span>
                </div>
                <div className="space-y-2">
                  {data.strong_topics?.map((t, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-xs text-zinc-300">{t.topic}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1 bg-[#0A0A0A]">
                          <div className="h-full bg-green-400" style={{ width: `${t.avg_score * 10}%` }} />
                        </div>
                        <span className="text-xs font-bold text-green-400">{t.avg_score}/10</span>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>

            {/* Priority Topics */}
            {plan?.priority_topics?.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                className="bg-[#121212] border border-yellow-500/20 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Target className="w-4 h-4 text-yellow-500" />
                  <span className="text-xs tracking-[0.2em] uppercase font-bold text-yellow-500">PRIORITY TOPICS</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {plan.priority_topics.map((t, i) => (
                    <span key={i} className="text-xs px-3 py-1.5 bg-yellow-500/10 border border-yellow-500/30 text-yellow-500 font-bold">
                      {t}
                    </span>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Weekly Plan */}
            {hasWeekly && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                <h3 className="text-xs tracking-[0.2em] uppercase font-bold text-zinc-400 mb-3">
                  {plan.estimated_weeks ? `${plan.estimated_weeks}-WEEK PLAN` : 'WEEKLY PLAN'}
                </h3>
                <div className="space-y-3">
                  {plan.weekly_plan.map((week, i) => (
                    <div key={i} className="bg-[#121212] border border-[#27272A] p-5">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-bold text-yellow-500">WEEK {week.week}</span>
                        <span className="text-xs text-zinc-400">— {week.focus}</span>
                      </div>
                      {week.goal && <p className="text-xs text-zinc-500 mb-3">{week.goal}</p>}
                      <div className="space-y-1.5">
                        {week.tasks?.map((task, j) => (
                          <div key={j} className="flex items-start gap-2">
                            <CheckCircle className="w-3 h-3 text-zinc-600 mt-0.5 shrink-0" />
                            <span className="text-xs text-zinc-300">{task}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Tips */}
            {plan?.tips?.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
                className="bg-[#121212] border border-[#27272A] p-5">
                <span className="text-xs tracking-[0.2em] uppercase font-bold text-zinc-400 block mb-3">COACH TIPS</span>
                <div className="space-y-2">
                  {plan.tips.map((tip, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <Sparkles className="w-3 h-3 text-yellow-500 mt-0.5 shrink-0" />
                      <span className="text-xs text-zinc-300">{tip}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* CTA */}
            <button
              data-testid="study-practice-btn"
              onClick={() => navigate("/setup")}
              className="bg-yellow-500 text-black font-bold text-xs tracking-[0.1em] px-6 py-2.5 hover:bg-yellow-400 transition-colors flex items-center gap-1"
            >
              PRACTICE NOW <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
