import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Terminal, BarChart3, Clock, Zap } from "lucide-react";

export default function Navbar() {
  const location = useLocation();
  const isActive = (path) => location.pathname === path;

  const links = [
    { path: "/", label: "HOME", icon: Terminal },
    { path: "/dashboard", label: "DASHBOARD", icon: BarChart3 },
    { path: "/history", label: "HISTORY", icon: Clock },
  ];

  return (
    <nav
      data-testid="main-navbar"
      className="sticky top-0 z-50 bg-[#0A0A0A] border-b border-[#27272A] px-6 md:px-8 lg:px-12"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between h-14">
        <Link to="/" data-testid="nav-logo" className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-500" />
          <span className="font-heading text-lg font-bold tracking-tight text-white">
            DEV<span className="text-yellow-500">GRILL</span>
          </span>
        </Link>

        <div className="flex items-center gap-1">
          {links.map(({ path, label, icon: Icon }) => (
            <Link
              key={path}
              to={path}
              data-testid={`nav-link-${label.toLowerCase()}`}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs tracking-[0.15em] font-bold transition-colors ${
                isActive(path)
                  ? "text-yellow-500 border-b-2 border-yellow-500"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </Link>
          ))}
        </div>

        <Link to="/setup" data-testid="nav-start-interview-btn">
          <motion.button
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
            className="bg-yellow-500 text-black font-bold text-xs tracking-[0.1em] px-4 py-2 hover:bg-yellow-400 transition-colors"
          >
            START INTERVIEW
          </motion.button>
        </Link>
      </div>
    </nav>
  );
}
