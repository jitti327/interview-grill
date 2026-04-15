import { useState, useEffect, useRef, useCallback } from "react";
import { Clock, AlertTriangle } from "lucide-react";

export default function InterviewTimer({ timePerQuestion, onTimeUp, isActive }) {
  const [seconds, setSeconds] = useState(timePerQuestion);
  const intervalRef = useRef(null);

  const reset = useCallback(() => {
    setSeconds(timePerQuestion);
  }, [timePerQuestion]);

  useEffect(() => {
    reset();
  }, [timePerQuestion, reset]);

  useEffect(() => {
    if (!isActive) {
      clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          onTimeUp?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [isActive, onTimeUp]);

  // Expose reset via ref pattern
  useEffect(() => {
    if (!isActive && seconds !== timePerQuestion) {
      reset();
    }
  }, [isActive, seconds, timePerQuestion, reset]);

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const pct = (seconds / timePerQuestion) * 100;
  const isLow = seconds < 60;
  const isCritical = seconds < 30;

  return (
    <div
      data-testid="interview-timer"
      className={`flex items-center gap-2 px-3 py-1.5 border transition-colors ${
        isCritical
          ? "border-red-400/50 bg-red-400/10 animate-pulse"
          : isLow
          ? "border-yellow-500/50 bg-yellow-500/10"
          : "border-[#27272A] bg-[#121212]"
      }`}
    >
      {isCritical ? (
        <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
      ) : (
        <Clock className={`w-3.5 h-3.5 ${isLow ? "text-yellow-500" : "text-zinc-500"}`} />
      )}
      <span
        className={`text-sm font-bold font-mono ${
          isCritical ? "text-red-400" : isLow ? "text-yellow-500" : "text-white"
        }`}
      >
        {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
      </span>
      <div className="w-16 h-1 bg-[#0A0A0A] ml-1">
        <div
          className={`h-full transition-all ${isCritical ? "bg-red-400" : isLow ? "bg-yellow-500" : "bg-green-400"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
