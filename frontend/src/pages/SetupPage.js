import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { createSession } from "@/lib/api";
import { ArrowRight, Loader2 } from "lucide-react";

const CATEGORIES = {
  frontend: { label: "Frontend", stacks: ["React", "Angular", "Vue", "Ember"] },
  backend: { label: "Backend", stacks: ["Node.js", "Java", ".NET", "Python"] },
  fullstack: { label: "Full Stack", stacks: ["MERN Stack", "MEAN Stack", "Django + React", "Spring + Angular"] },
  system_design: { label: "System Design", stacks: ["Distributed Systems", "Scalability", "Microservices", "Database Design"] },
  dsa: { label: "DSA", stacks: ["Arrays & Strings", "Trees & Graphs", "Dynamic Programming", "Sorting & Searching"] },
};

const DIFFICULTIES = [
  { id: "beginner", label: "Beginner", tag: "FRESHER", desc: "Fundamentals & core concepts. Encouraging feedback." },
  { id: "intermediate", label: "Intermediate", tag: "MID-LEVEL", desc: "Practical scenarios & real-world problems. Moderate grilling." },
  { id: "advanced", label: "Advanced", tag: "SENIOR", desc: "Deep-dive architecture & edge cases. Aggressive questioning." },
];

const QUESTION_COUNTS = [5, 8, 10, 15];

export default function SetupPage() {
  const [searchParams] = useSearchParams();
  const preCategory = searchParams.get("category") || "";
  const navigate = useNavigate();

  const [category, setCategory] = useState(preCategory);
  const [techStack, setTechStack] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [numQuestions, setNumQuestions] = useState(8);
  const [loading, setLoading] = useState(false);

  const currentStacks = category ? CATEGORIES[category]?.stacks || [] : [];

  const handleStart = async () => {
    if (!category || !techStack || !difficulty) {
      toast.error("Please complete all selections");
      return;
    }
    setLoading(true);
    try {
      const res = await createSession({
        tech_stack: techStack,
        category,
        difficulty,
        num_questions: numQuestions,
      });
      toast.success("Interview session created!");
      navigate(`/interview/${res.data.id}`);
    } catch (err) {
      toast.error("Failed to create session");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      <div className="max-w-3xl mx-auto px-6 md:px-8 pt-12 pb-24">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <div className="text-xs tracking-[0.2em] uppercase font-bold text-yellow-500 mb-2">
            CONFIGURE INTERVIEW
          </div>
          <h1 className="font-heading text-2xl sm:text-3xl lg:text-4xl tracking-tighter font-bold text-white mb-8">
            Set up your session
          </h1>
        </motion.div>

        {/* Category Selection */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <label className="text-xs tracking-[0.2em] uppercase font-bold text-zinc-400 block mb-3">
            CATEGORY
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {Object.entries(CATEGORIES).map(([key, val]) => (
              <button
                key={key}
                data-testid={`setup-category-${key}`}
                onClick={() => { setCategory(key); setTechStack(""); }}
                className={`p-3 border text-left text-xs font-bold tracking-wide transition-all ${
                  category === key
                    ? "border-yellow-500 bg-yellow-500/10 text-yellow-500"
                    : "border-[#27272A] bg-[#121212] text-zinc-400 hover:border-zinc-600"
                }`}
              >
                {val.label}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Tech Stack Selection */}
        {category && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <label className="text-xs tracking-[0.2em] uppercase font-bold text-zinc-400 block mb-3">
              TECH STACK
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {currentStacks.map((stack) => (
                <button
                  key={stack}
                  data-testid={`setup-stack-${stack.toLowerCase().replace(/[\s.+]/g, '-')}`}
                  onClick={() => setTechStack(stack)}
                  className={`p-3 border text-xs font-bold tracking-wide transition-all ${
                    techStack === stack
                      ? "border-yellow-500 bg-yellow-500/10 text-yellow-500"
                      : "border-[#27272A] bg-[#121212] text-zinc-400 hover:border-zinc-600"
                  }`}
                >
                  {stack}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Difficulty Selection */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-8"
        >
          <label className="text-xs tracking-[0.2em] uppercase font-bold text-zinc-400 block mb-3">
            DIFFICULTY LEVEL
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {DIFFICULTIES.map((diff) => (
              <button
                key={diff.id}
                data-testid={`setup-difficulty-${diff.id}`}
                onClick={() => setDifficulty(diff.id)}
                className={`p-4 border text-left transition-all ${
                  difficulty === diff.id
                    ? "border-yellow-500 bg-yellow-500/10"
                    : "border-[#27272A] bg-[#121212] hover:border-zinc-600"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold tracking-wide text-white">
                    {diff.label}
                  </span>
                  <span className="text-[10px] tracking-[0.15em] px-1.5 py-0.5 bg-[#0A0A0A] border border-[#27272A] text-zinc-500">
                    {diff.tag}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500 leading-relaxed">{diff.desc}</p>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Questions Count */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-10"
        >
          <label className="text-xs tracking-[0.2em] uppercase font-bold text-zinc-400 block mb-3">
            NUMBER OF QUESTIONS
          </label>
          <div className="flex gap-2">
            {QUESTION_COUNTS.map((n) => (
              <button
                key={n}
                data-testid={`setup-questions-${n}`}
                onClick={() => setNumQuestions(n)}
                className={`w-12 h-12 border text-sm font-bold transition-all ${
                  numQuestions === n
                    ? "border-yellow-500 bg-yellow-500/10 text-yellow-500"
                    : "border-[#27272A] bg-[#121212] text-zinc-400 hover:border-zinc-600"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Start Button */}
        <motion.button
          data-testid="setup-start-btn"
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleStart}
          disabled={loading || !category || !techStack || !difficulty}
          className={`flex items-center gap-2 px-8 py-3 font-bold text-sm tracking-wide transition-all ${
            category && techStack && difficulty
              ? "bg-yellow-500 text-black hover:bg-yellow-400"
              : "bg-zinc-800 text-zinc-600 cursor-not-allowed"
          }`}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              BEGIN INTERVIEW <ArrowRight className="w-4 h-4" />
            </>
          )}
        </motion.button>

        {/* Summary */}
        {category && techStack && difficulty && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-6 p-4 bg-[#121212] border border-[#27272A]"
          >
            <div className="text-xs text-zinc-500 space-y-1">
              <p>
                <span className="text-yellow-500">Category:</span>{" "}
                {CATEGORIES[category]?.label}
              </p>
              <p>
                <span className="text-yellow-500">Stack:</span> {techStack}
              </p>
              <p>
                <span className="text-yellow-500">Difficulty:</span> {difficulty}
              </p>
              <p>
                <span className="text-yellow-500">Questions:</span> {numQuestions}
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
