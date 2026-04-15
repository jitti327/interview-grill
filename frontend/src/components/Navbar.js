import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { Terminal, BarChart3, Clock, Zap, ArrowLeftRight, User, LogOut } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

export default function Navbar() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const isActive = (path) => location.pathname === path;

  const links = [
    { path: "/", label: "HOME", icon: Terminal },
    { path: "/dashboard", label: "DASHBOARD", icon: BarChart3 },
    { path: "/history", label: "HISTORY", icon: Clock },
    { path: "/compare", label: "COMPARE", icon: ArrowLeftRight },
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

        <div className="flex items-center gap-3">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger data-testid="user-menu-trigger" className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-zinc-400 border border-[#27272A] hover:border-zinc-600 transition-colors">
                <User className="w-3.5 h-3.5" />
                {user.name || user.email}
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-[#121212] border-[#27272A] text-white rounded-sm">
                <DropdownMenuItem className="text-xs text-zinc-400 focus:bg-zinc-800 focus:text-white cursor-default">
                  {user.email}
                </DropdownMenuItem>
                <DropdownMenuItem
                  data-testid="logout-btn"
                  onClick={logout}
                  className="text-xs text-red-400 focus:bg-red-400/10 focus:text-red-400 cursor-pointer"
                >
                  <LogOut className="w-3 h-3 mr-2" /> Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link to="/login" data-testid="nav-login-btn">
              <button className="border border-zinc-700 text-white font-bold text-xs tracking-[0.1em] px-3 py-1.5 hover:bg-zinc-800 transition-colors">
                SIGN IN
              </button>
            </Link>
          )}
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
      </div>
    </nav>
  );
}
