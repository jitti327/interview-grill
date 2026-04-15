import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import api from "@/lib/api";
import { Bell, Check, CheckCheck, Clock, Trophy, BookOpen, Sparkles } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";

const ICON_MAP = {
  session_complete: Check,
  achievement: Trophy,
  weekly_summary: BookOpen,
  study_reminder: Sparkles,
};

export default function NotificationBell() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const [notifs, count] = await Promise.all([
        api.get("/notifications?unread=false"),
        api.get("/notifications/count"),
      ]);
      setNotifications(notifs.data.slice(0, 8));
      setUnread(count.data.count);
    } catch {}
  }, [user]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const markAllRead = async () => {
    try {
      await api.post("/notifications/mark-all-read");
      setUnread(0);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch {}
  };

  const generateSummary = async () => {
    try {
      await api.post("/notifications/weekly-summary");
      fetchNotifications();
    } catch {}
  };

  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger data-testid="notification-bell" className="relative p-1.5 text-zinc-500 hover:text-zinc-300 transition-colors">
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-yellow-500 text-black text-[9px] font-bold flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 bg-[#121212] border-[#27272A] text-white rounded-sm p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b border-[#27272A]">
          <span className="text-xs font-bold tracking-[0.1em] text-zinc-400">NOTIFICATIONS</span>
          <div className="flex gap-2">
            <button
              data-testid="generate-summary-btn"
              onClick={generateSummary}
              className="text-[10px] text-yellow-500 hover:underline"
            >
              Weekly Summary
            </button>
            {unread > 0 && (
              <button
                data-testid="mark-all-read-btn"
                onClick={markAllRead}
                className="text-[10px] text-zinc-500 hover:text-zinc-300 flex items-center gap-1"
              >
                <CheckCheck className="w-3 h-3" /> Read All
              </button>
            )}
          </div>
        </div>

        {notifications.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-zinc-600">No notifications yet</div>
        ) : (
          <div className="max-h-80 overflow-y-auto scrollbar-thin">
            {notifications.map((n) => {
              const Icon = ICON_MAP[n.type] || Bell;
              return (
                <div
                  key={n.id}
                  data-testid={`notification-${n.id}`}
                  className={`px-3 py-2.5 border-b border-[#1A1A1A] hover:bg-[#18181B] transition-colors ${
                    !n.read ? "bg-yellow-500/5" : ""
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${!n.read ? "text-yellow-500" : "text-zinc-600"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-white truncate">{n.title}</div>
                      <div className="text-[11px] text-zinc-500 mt-0.5 line-clamp-2">{n.message}</div>
                      <div className="flex items-center gap-1 mt-1">
                        <Clock className="w-2.5 h-2.5 text-zinc-700" />
                        <span className="text-[10px] text-zinc-700">
                          {new Date(n.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    {!n.read && <div className="w-1.5 h-1.5 bg-yellow-500 mt-1.5 shrink-0" />}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
