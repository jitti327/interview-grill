import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Zap } from "lucide-react";

function formatError(detail) {
  if (!detail) return "Something went wrong.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map(e => e?.msg || JSON.stringify(e)).join(" ");
  return String(detail);
}

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setLoading(true);
    try {
      await register(email, password, name);
      navigate("/dashboard");
    } catch (err) {
      setError(formatError(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center px-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-8 justify-center">
          <Zap className="w-6 h-6 text-yellow-500" />
          <span className="font-heading text-2xl font-bold text-white">DEV<span className="text-yellow-500">GRILL</span></span>
        </div>

        <div className="bg-[#121212] border border-[#27272A] p-6">
          <h2 className="font-heading text-xl font-bold text-white mb-1">Create Account</h2>
          <p className="text-xs text-zinc-500 mb-6">Join DevGrill to track your progress</p>

          {error && (
            <div data-testid="register-error" className="mb-4 p-3 bg-red-400/10 border border-red-400/30 text-xs text-red-400">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-[10px] tracking-[0.2em] uppercase font-bold text-zinc-500 block mb-1">NAME</label>
              <input
                data-testid="register-name-input"
                type="text" value={name} onChange={(e) => setName(e.target.value)} required
                className="w-full bg-[#0A0A0A] border border-[#27272A] text-sm text-white p-2.5 focus:outline-none focus:border-yellow-500 placeholder-zinc-600"
                placeholder="Your name"
              />
            </div>
            <div>
              <label className="text-[10px] tracking-[0.2em] uppercase font-bold text-zinc-500 block mb-1">EMAIL</label>
              <input
                data-testid="register-email-input"
                type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                className="w-full bg-[#0A0A0A] border border-[#27272A] text-sm text-white p-2.5 focus:outline-none focus:border-yellow-500 placeholder-zinc-600"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="text-[10px] tracking-[0.2em] uppercase font-bold text-zinc-500 block mb-1">PASSWORD</label>
              <input
                data-testid="register-password-input"
                type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                className="w-full bg-[#0A0A0A] border border-[#27272A] text-sm text-white p-2.5 focus:outline-none focus:border-yellow-500 placeholder-zinc-600"
                placeholder="Min 6 characters"
              />
            </div>
            <button
              data-testid="register-submit-btn"
              type="submit" disabled={loading}
              className="w-full bg-yellow-500 text-black font-bold text-xs tracking-[0.1em] py-2.5 hover:bg-yellow-400 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "CREATE ACCOUNT"}
            </button>
          </form>

          <p className="text-xs text-zinc-500 mt-4 text-center">
            Already have an account?{" "}
            <Link to="/login" data-testid="goto-login-link" className="text-yellow-500 hover:underline">Sign in</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
