"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Loader2, Zap } from "lucide-react";
import { verifyEmail } from "@/lib/api";

function extractError(err) {
  return err?.response?.data?.message || err?.response?.data?.detail || err?.message || "Verification failed.";
}

export default function VerifyEmailPage() {
  const router = useRouter();
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("Verifying your email...");

  useEffect(() => {
    if (!router.isReady) return;
    const token = typeof router.query.token === "string" ? router.query.token : "";
    if (!token) {
      setStatus("error");
      setMessage("Verification token is missing.");
      return;
    }
    verifyEmail(token)
      .then((res) => {
        setStatus("success");
        setMessage(res?.data?.message || "Email verified successfully.");
      })
      .catch((err) => {
        setStatus("error");
        setMessage(extractError(err));
      });
  }, [router.isReady, router.query.token]);

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-[#121212] border border-[#27272A] p-6">
        <div className="flex items-center gap-2 mb-6 justify-center">
          <Zap className="w-6 h-6 text-yellow-500" />
          <span className="font-heading text-2xl font-bold text-white">DEV<span className="text-yellow-500">GRILL</span></span>
        </div>
        <h2 className="font-heading text-xl font-bold text-white mb-2">Email Verification</h2>
        {status === "loading" ? (
          <div className="flex items-center gap-2 text-zinc-300 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>{message}</span>
          </div>
        ) : (
          <p className={`text-sm ${status === "success" ? "text-emerald-400" : "text-red-400"}`}>{message}</p>
        )}
        <div className="mt-6">
          <Link href="/login" className="w-full block text-center bg-yellow-500 text-black font-bold text-xs tracking-[0.1em] py-2.5 hover:bg-yellow-400 transition-colors">
            GO TO LOGIN
          </Link>
        </div>
      </div>
    </div>
  );
}
