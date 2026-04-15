import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import api from "@/lib/api";
import { Trophy, Medal, Star, ArrowRight, Users } from "lucide-react";

function RankBadge({ rank }) {
  if (rank === 1) return <div className="w-8 h-8 bg-yellow-500 flex items-center justify-center"><Trophy className="w-4 h-4 text-black" /></div>;
  if (rank === 2) return <div className="w-8 h-8 bg-zinc-400 flex items-center justify-center"><Medal className="w-4 h-4 text-black" /></div>;
  if (rank === 3) return <div className="w-8 h-8 bg-amber-700 flex items-center justify-center"><Medal className="w-4 h-4 text-black" /></div>;
  return <div className="w-8 h-8 bg-[#0A0A0A] border border-[#27272A] flex items-center justify-center text-xs font-bold text-zinc-500">#{rank}</div>;
}

export default function LeaderboardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/leaderboard").then(r => setData(r.data)).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center"><div className="w-5 h-5 border-2 border-yellow-500 border-t-transparent animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-[#0A0A0A]" data-testid="leaderboard-page">
      <div className="max-w-3xl mx-auto px-6 md:px-8 pt-8 pb-24">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-xs tracking-[0.2em] uppercase font-bold text-yellow-500 mb-2">RANKINGS</div>
          <h1 className="font-heading text-2xl sm:text-3xl lg:text-4xl tracking-tighter font-bold text-white mb-8">Leaderboard</h1>
        </motion.div>

        {data.length === 0 ? (
          <div className="text-center py-20">
            <Users className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
            <p className="text-sm text-zinc-500 mb-4">No ranked users yet. Complete interviews while logged in to appear here.</p>
            <button data-testid="leaderboard-start-btn" onClick={() => navigate("/setup")} className="bg-yellow-500 text-black font-bold text-xs px-6 py-2 hover:bg-yellow-400 transition-colors inline-flex items-center gap-1">
              START INTERVIEW <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {data.map((entry, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                data-testid={`leaderboard-entry-${idx}`}
                className={`flex items-center gap-4 p-4 border transition-colors ${
                  entry.rank <= 3 ? "bg-yellow-500/5 border-yellow-500/20" : "bg-[#121212] border-[#27272A]"
                }`}
              >
                <RankBadge rank={entry.rank} />
                <div className="flex-1">
                  <div className="text-sm font-bold text-white">{entry.user_name}</div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-[10px] text-zinc-500">{entry.total_sessions} sessions</span>
                    <span className="text-[10px] text-zinc-500">Best: {entry.best_score}/10</span>
                    <div className="flex gap-1">
                      {entry.categories?.slice(0, 3).map(c => (
                        <span key={c} className="text-[9px] px-1 py-0.5 bg-[#0A0A0A] border border-[#27272A] text-zinc-600">{c}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-xl font-bold ${entry.avg_score >= 7 ? "text-green-400" : entry.avg_score >= 5 ? "text-yellow-500" : "text-red-400"}`}>
                    {entry.avg_score}
                  </div>
                  <div className="text-[10px] text-zinc-600">avg score</div>
                </div>
                {entry.rank <= 3 && <Star className="w-4 h-4 text-yellow-500" />}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
