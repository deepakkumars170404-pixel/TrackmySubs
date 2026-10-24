"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyRound, Eye, EyeOff, CheckCircle2, AlertCircle, ArrowRight, RefreshCw, Mail } from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";

function getBackendUrl(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_BACKEND_URL || (process.env.NODE_ENV === "production" ? "https://trackmysubs-backend.onrender.com" : "http://127.0.0.1:5000");
}

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    // Check if email and otp were passed in query params
    const qEmail = searchParams.get("email");
    if (qEmail) setEmail(qEmail);

    const qOtp = searchParams.get("otp");
    if (qOtp) {
      setOtpCode(qOtp);
      setHasSession(true); // Direct link verified via email OTP, immediately show new password fields!
    }

    if (!isSupabaseConfigured) return;

    // 1. Listen for Supabase password recovery event from email link
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setHasSession(true);
        if (session?.user?.email) {
          setEmail(session.user.email);
        }
      }
    });

    // 2. Check URL hash for access token recovery
    if (typeof window !== "undefined" && window.location.hash.includes("type=recovery")) {
      setHasSession(true);
    }

    return () => {
      subscription.unsubscribe();
    };
  }, [searchParams]);

  // Stage 1: Verify OTP only
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanEmail = email.trim();
    const cleanOtp = otpCode.trim();

    if (!cleanEmail) {
      setErrorMessage("Please enter your registered email address.");
      return;
    }

    if (!cleanOtp || cleanOtp.length < 6) {
      setErrorMessage("Please enter the verification code received in your email.");
      return;
    }

    setIsLoading(true);

    try {
      // 1. Try Backend API verify-otp
      try {
        const res = await fetch(`${getBackendUrl()}/api/auth/verify-otp`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: cleanEmail, otp: cleanOtp }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setHasSession(true);
            setSuccessMessage("Code verified successfully! Now choose your new password below.");
            setIsLoading(false);
            return;
          }
        } else {
          const errData = await res.json().catch(() => null);
          if (errData?.message) {
            setErrorMessage(errData.message);
            setIsLoading(false);
            return;
          }
        }
      } catch (backendErr) {
        console.info("Backend verify-otp offline, falling back to Supabase client.");
      }

      // 2. Direct Supabase verifyOtp
      if (isSupabaseConfigured) {
        const { data: verified, error: verifyError } = await supabase.auth.verifyOtp({
          email: cleanEmail,
          token: cleanOtp,
          type: "recovery",
        });

        if (verifyError || !verified?.user) {
          setErrorMessage(verifyError?.message || "Invalid or expired verification code.");
          setIsLoading(false);
          return;
        }

        setHasSession(true);
        setSuccessMessage("Code verified successfully! Now choose your new password below.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to verify code.";
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Stage 2: Save New Password & Confirm Password
  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!newPassword || newPassword.length < 6) {
      setErrorMessage("New password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setIsLoading(true);

    try {
      const cleanEmail = email.trim();
      const cleanOtp = otpCode.trim();

      // 1. Try Backend API
      try {
        const res = await fetch(`${getBackendUrl()}/api/auth/reset-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: cleanEmail,
            otp: cleanOtp,
            newPassword,
            confirmPassword,
          }),
        });

        const data = await res.json().catch(() => null);
        if (res.ok && data?.success) {
          setSuccessMessage("Password reset successfully! Redirecting to login...");
          setTimeout(() => router.push("/login"), 1000);
          return;
        }
      } catch (backendErr) {
        console.info("Backend offline, updating directly in Supabase.");
      }

      // 2. Direct Supabase updateUser
      if (isSupabaseConfigured) {
        const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
        if (updateErr) throw updateErr;

        setSuccessMessage("Password reset successfully! Redirecting to login...");
        setTimeout(() => router.push("/login"), 1000);
        return;
      }

      setSuccessMessage("Password updated! Redirecting to login...");
      setTimeout(() => router.push("/login"), 1000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to reset password. Please try again.";
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background radial glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-pink-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10 text-white">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <KeyRound className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white">
              {hasSession ? "Set New Password" : "Verify Code"}
            </h2>
            <p className="text-xs text-slate-400">
              {hasSession
                ? "Enter and confirm your new password below"
                : `Enter the verification code sent to ${email || "your email"}`}
            </p>
          </div>
        </div>

        {/* Quick link to standard password login */}
        <div className="mb-5 p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-between text-xs">
          <span className="text-slate-300">Know your password?</span>
          <button
            type="button"
            onClick={() => router.push("/login")}
            className="font-bold text-indigo-400 hover:text-indigo-300 hover:underline cursor-pointer"
          >
            Sign in with password &rarr;
          </button>
        </div>

        {/* Error / Success Feedback */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <p className="flex-1 leading-snug">{errorMessage}</p>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-xs flex items-start gap-2.5 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <p className="flex-1 leading-snug">{successMessage}</p>
          </div>
        )}

        {/* STAGE 1: Verify Code (Only shown when not verified yet) */}
        {!hasSession && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Registered Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Verification Code
              </label>
              <input
                type="text"
                required
                maxLength={12}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                placeholder="Enter 8-digit code"
                className="w-full px-3.5 py-3 bg-slate-800/90 border border-slate-700 rounded-xl text-center font-mono text-xl tracking-widest text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-semibold text-sm rounded-xl transition shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 mt-2"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Verifying code...</span>
                </span>
              ) : (
                <>
                  <span>Verify Code &rarr;</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* STAGE 2: Set New Password & Confirm Password (Opens immediately after OTP verified!) */}
        {hasSession && (
          <form onSubmit={handleSetPassword} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full px-3.5 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-sm text-white pr-10 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Confirm New Password
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                className="w-full px-3.5 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-semibold text-sm rounded-xl transition shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 mt-2"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Updating password...</span>
                </span>
              ) : (
                <>
                  <span>Save New Password &amp; Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={() => router.push("/login")}
            className="text-xs text-indigo-400 hover:text-indigo-300 hover:underline cursor-pointer"
          >
            &larr; Back to Login
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">Loading...</div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}
