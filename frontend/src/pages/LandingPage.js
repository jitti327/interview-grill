import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Code2, Server, Layers, Box, Binary,
  ChevronRight, ArrowRight
} from "lucide-react";

const categories = [
  {
    id: "frontend",
    label: "Frontend",
    icon: Code2,
    stacks: ["React", "Angular", "Vue", "Ember"],
    desc: "Build pixel-perfect interfaces",
  },
  {
    id: "backend",
    label: "Backend",
    icon: Server,
    stacks: ["Node.js", "Java", ".NET", "Python"],
    desc: "Design robust server architectures",
  },
  {
    id: "fullstack",
    label: "Full Stack",
    icon: Layers,
    stacks: ["MERN", "MEAN", "Django+React", "Spring+Angular"],
    desc: "Master end-to-end development",
  },
  {
    id: "system_design",
    label: "System Design",
    icon: Box,
    stacks: ["Distributed Systems", "Scalability", "Microservices"],
    desc: "Architect systems at scale",
  },
  {
    id: "dsa",
    label: "DSA",
    icon: Binary,
    stacks: ["Arrays", "Trees", "Graphs", "Dynamic Programming"],
    desc: "Crack algorithmic challenges",
  },
];

const stagger = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      {/* Hero */}
      <section className="relative overflow-hidden" data-testid="hero-section">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `url(https://images.unsplash.com/photo-1754738381772-897447d10eb6?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Njl8MHwxfHNlYXJjaHwyfHxhYnN0cmFjdCUyMHRlY2hub2xvZ3klMjBkYXJrfGVufDB8fHx8MTc3NjI3ODk4OHww&ixlib=rb-4.1.0&q=85)`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0A0A0A]/60 to-[#0A0A0A]" />

        <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-8 lg:px-12 pt-24 pb-16">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="max-w-3xl"
          >
            <div className="text-xs tracking-[0.2em] uppercase font-bold text-yellow-500 mb-4">
              AI-POWERED INTERVIEW PREP
            </div>
            <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl tracking-tighter leading-none font-bold text-white mb-6">
              Get grilled by AI.
              <br />
              <span className="text-yellow-500">Get hired by humans.</span>
            </h1>
            <p className="text-sm md:text-base leading-relaxed text-zinc-400 max-w-xl mb-8">
              Simulate real technical interviews with an AI that adapts to your
              skill level. From gentle guidance to aggressive deep-dives — prepare
              for anything.
            </p>
            <div className="flex items-center gap-4">
              <motion.button
                data-testid="hero-start-btn"
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate("/setup")}
                className="bg-yellow-500 text-black font-bold text-sm tracking-wide px-6 py-3 flex items-center gap-2 hover:bg-yellow-400 transition-colors"
              >
                START INTERVIEW <ArrowRight className="w-4 h-4" />
              </motion.button>
              <motion.button
                data-testid="hero-dashboard-btn"
                whileHover={{ y: -1 }}
                onClick={() => navigate("/dashboard")}
                className="border border-zinc-700 text-white font-bold text-sm px-6 py-3 hover:bg-zinc-800 transition-colors"
              >
                VIEW DASHBOARD
              </motion.button>
            </div>
          </motion.div>

          {/* Terminal snippet */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="mt-12 max-w-lg bg-[#121212] border border-[#27272A] p-4"
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2.5 h-2.5 bg-red-500" />
              <div className="w-2.5 h-2.5 bg-yellow-500" />
              <div className="w-2.5 h-2.5 bg-green-500" />
              <span className="text-xs text-zinc-600 ml-2">devgrill.terminal</span>
            </div>
            <div className="text-xs text-zinc-400 space-y-1">
              <p>
                <span className="text-yellow-500">$</span> devgrill --start --stack react --level advanced
              </p>
              <p className="text-zinc-500">
                Initializing AI interviewer...
              </p>
              <p className="text-green-400">
                Ready. Prepare to be grilled.
              </p>
              <p className="text-yellow-500 cursor-blink">_</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Categories */}
      <section className="max-w-7xl mx-auto px-6 md:px-8 lg:px-12 pb-24" data-testid="categories-section">
        <div className="mb-8">
          <div className="text-xs tracking-[0.2em] uppercase font-bold text-yellow-500 mb-2">
            CHOOSE YOUR PATH
          </div>
          <h2 className="font-heading text-2xl sm:text-3xl tracking-tight font-semibold text-white">
            Interview Categories
          </h2>
        </div>

        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4"
        >
          {categories.map((cat) => {
            const Icon = cat.icon;
            return (
              <motion.div
                key={cat.id}
                variants={fadeUp}
                data-testid={`category-card-${cat.id}`}
                onClick={() => navigate(`/setup?category=${cat.id}`)}
                className="tech-card bg-[#121212] border border-[#27272A] p-5 cursor-pointer group"
              >
                <Icon className="w-6 h-6 text-yellow-500 mb-3" />
                <h3 className="font-heading text-base font-semibold text-white mb-1">
                  {cat.label}
                </h3>
                <p className="text-xs text-zinc-500 mb-3">{cat.desc}</p>
                <div className="flex flex-wrap gap-1 mb-3">
                  {cat.stacks.slice(0, 3).map((s) => (
                    <span
                      key={s}
                      className="text-[10px] px-1.5 py-0.5 bg-[#0A0A0A] border border-[#27272A] text-zinc-400"
                    >
                      {s}
                    </span>
                  ))}
                  {cat.stacks.length > 3 && (
                    <span className="text-[10px] px-1.5 py-0.5 text-zinc-600">
                      +{cat.stacks.length - 3}
                    </span>
                  )}
                </div>
                <div className="flex items-center text-xs text-zinc-600 group-hover:text-yellow-500 transition-colors">
                  Select <ChevronRight className="w-3 h-3 ml-1" />
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </section>
    </div>
  );
}
