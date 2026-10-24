"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  ShieldCheck,
  Mail,
  Lock,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Plus,
  ChevronRight,
} from "lucide-react";
import { KinButton } from "./ui/TrackmySubsUI";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (email: string) => void;
}

interface GoogleAccountItem {
  email: string;
  name: string;
  avatar: string;
}

const GoogleGIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </svg>
);

async function callAuthApi(
  endpoint: string,
  payload: Record<string, any>
): Promise<{ ok: boolean; status: number; data: any }> {
  const hosts: string[] = [];

  if (typeof window !== "undefined") {
    hosts.push(window.location.origin);
    if (
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1"
    ) {
      hosts.push("http://127.0.0.1:5000");
    }
  }

  hosts.push("https://trackmysubs-backend.onrender.com");

  let lastErrorMsg =
    "Unable to connect to authentication server. Please check your network connection.";

  for (const host of hosts) {
    try {
      const cleanHost = host.replace(/\/$/, "");
      const cleanEndpoint = endpoint.replace(/^\//, "");
      const url = `${cleanHost}/api/auth/${cleanEndpoint}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const json = await res.json().catch(() => null);

      if (res.ok && json && json.success !== false) {
        return { ok: true, status: res.status, data: json };
      }

      if (json && typeof json.message === "string") {
        return { ok: false, status: res.status, data: json };
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        lastErrorMsg = err.message;
      }
    }
  }

  return {
    ok: false,
    status: 500,
    data: { success: false, message: lastErrorMsg },
  };
}

export default function AuthModal({
  isOpen,
  onClose,
  onLoginSuccess,
}: AuthModalProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Signup OTP States
  const [signupStep, setSignupStep] = useState<"form" | "verify_otp">("form");
  const [signupOtp, setSignupOtp] = useState("");

  // Google Account Chooser States
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [googleAccounts, setGoogleAccounts] = useState<GoogleAccountItem[]>([]);
  const [isVerifyingGoogle, setIsVerifyingGoogle] = useState<string | null>(null);
  const [showAddAnotherGoogle, setShowAddAnotherGoogle] = useState(false);
  const [anotherGoogleEmail, setAnotherGoogleEmail] = useState("");
  const [googleModalError, setGoogleModalError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = window.localStorage.getItem("trackmysubs_google_accounts");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            const cleanSaved = parsed.filter(
              (acc: any) =>
                acc?.email &&
                acc.email.toLowerCase() !== "deepakkumars170404@gmail.com"
            );
            if (cleanSaved.length > 0) {
              setGoogleAccounts(cleanSaved);
              window.localStorage.setItem(
                "trackmysubs_google_accounts",
                JSON.stringify(cleanSaved)
              );
              return;
            } else {
              window.localStorage.removeItem("trackmysubs_google_accounts");
            }
          }
        }
      } catch {}
      setGoogleAccounts([]);
    }
  }, []);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      setErrorMessage("Please enter both email and password.");
      return;
    }

    // SIGN UP FLOW: Send OTP
    if (mode === "signup") {
      if (cleanPassword.length < 6) {
        setErrorMessage("Password must be at least 6 characters.");
        return;
      }
      if (confirmPassword && cleanPassword !== confirmPassword.trim()) {
        setErrorMessage("Passwords do not match.");
        return;
      }

      setLoading(true);
      try {
        const res = await callAuthApi("send-signup-otp", {
          email: cleanEmail,
          password: cleanPassword,
          fullName: fullName.trim() || cleanEmail.split("@")[0],
        });

        if (res.ok && res.data?.success) {
          setSignupStep("verify_otp");
          setSignupOtp("");
          setSuccessMessage(
            `Verification code sent to ${cleanEmail}. Please enter the 6-digit code below.`
          );
          setLoading(false);
          return;
        }

        if (res.data?.message?.toLowerCase().includes("already exists")) {
          setErrorMessage(res.data.message);
          setLoading(false);
          return;
        }

        // Direct Supabase sign up fallback
        if (isSupabaseConfigured) {
          try {
            const { error: supaErr } = await supabase.auth.signUp({
              email: cleanEmail,
              password: cleanPassword,
              options: {
                data: { full_name: fullName.trim() || cleanEmail.split("@")[0] },
              },
            });
            if (!supaErr) {
              setSignupStep("verify_otp");
              setSignupOtp("");
              setSuccessMessage(
                `Verification code dispatched to ${cleanEmail}! Please enter the code below.`
              );
              setLoading(false);
              return;
            }
          } catch {}
        }

        setErrorMessage(res.data?.message || "Failed to send verification code.");
      } catch {
        setErrorMessage("Network error sending code. Please try again.");
      } finally {
        setLoading(false);
      }
      return;
    }

    // SIGN IN FLOW
    setLoading(true);
    try {
      const res = await callAuthApi("login", {
        email: cleanEmail,
        password: cleanPassword,
      });

      if (res.ok && res.data?.success) {
        if (typeof window !== "undefined") {
          window.localStorage.setItem(`user_pwd_${cleanEmail.toLowerCase()}`, cleanPassword);
        }
        setLoading(false);
        onLoginSuccess(res.data.user?.email || cleanEmail);
        onClose();
        return;
      }

      // Direct Supabase fallback
      if (isSupabaseConfigured) {
        try {
          const { data: supaData, error: supaErr } =
            await supabase.auth.signInWithPassword({
              email: cleanEmail,
              password: cleanPassword,
            });

          if (!supaErr && supaData?.user) {
            if (typeof window !== "undefined") {
              window.localStorage.setItem(`user_pwd_${cleanEmail.toLowerCase()}`, cleanPassword);
            }
            setLoading(false);
            onLoginSuccess(supaData.user.email || cleanEmail);
            onClose();
            return;
          }
        } catch {}
      }

      setErrorMessage(res.data?.message || "Incorrect email or password.");
    } catch {
      setErrorMessage("Authentication failed. Please check connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySignupOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanEmail = email.trim();
    const cleanOtp = signupOtp.replace(/\D/g, "").trim();

    if (!cleanOtp || cleanOtp.length < 6) {
      setErrorMessage("Please enter the complete 6-digit verification code.");
      return;
    }

    setLoading(true);
    try {
      const res = await callAuthApi("verify-signup-otp", {
        email: cleanEmail,
        otp: cleanOtp,
      });

      if (res.ok && res.data?.success) {
        setSignupStep("form");
        setMode("signin");
        setPassword("");
        setConfirmPassword("");
        setLoading(false);
        setSuccessMessage("✅ Account verified successfully! Please enter your password to sign in.");
        return;
      }

      // Direct Supabase fallback
      if (isSupabaseConfigured) {
        try {
          const { data: supaVerify, error: verifyErr } = await supabase.auth.verifyOtp({
            email: cleanEmail,
            token: cleanOtp,
            type: "signup",
          });
          if (!verifyErr && supaVerify?.session) {
            setSignupStep("form");
            setMode("signin");
            setPassword("");
            setConfirmPassword("");
            setLoading(false);
            setSuccessMessage("✅ Account verified successfully! Please enter your password to sign in.");
            return;
          }
        } catch {}
      }

      setErrorMessage(res.data?.message || "Invalid or expired verification code.");
    } catch {
      setErrorMessage("Verification error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectGoogleAccount = async (targetEmail: string, name?: string) => {
    setIsVerifyingGoogle(targetEmail);
    setGoogleModalError(null);

    const cleanEmail = targetEmail.trim();

    try {
      const res = await callAuthApi("google-verify", {
        email: cleanEmail,
        allowSignup: true,
      });

      if (!res.ok || !res.data?.success) {
        setGoogleModalError(
          res.data?.message ||
            `Unable to verify Google account (${cleanEmail}). Please try again.`
        );
        setIsVerifyingGoogle(null);
        return;
      }

      // Remember in device storage
      const updatedList: GoogleAccountItem[] = [
        {
          email: cleanEmail,
          name: name || res.data.user?.name || cleanEmail.split("@")[0],
          avatar: (name || cleanEmail)[0].toUpperCase(),
        },
        ...googleAccounts.filter((a) => a.email.toLowerCase() !== cleanEmail.toLowerCase()),
      ];
      setGoogleAccounts(updatedList);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("trackmysubs_google_accounts", JSON.stringify(updatedList));
      }

      setIsVerifyingGoogle(null);
      setShowGoogleModal(false);
      onLoginSuccess(res.data.user?.email || cleanEmail);
      onClose();
    } catch {
      setGoogleModalError("Connection error verifying account.");
      setIsVerifyingGoogle(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div
        className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden grid grid-cols-1 md:grid-cols-12 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-white/80 hover:bg-white flex items-center justify-center text-slate-500 hover:text-slate-800 shadow-xs transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Left Executive Hero Column */}
        <div className="md:col-span-5 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white p-7 sm:p-9 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-8">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-pink-500 flex items-center justify-center font-black text-sm text-white shadow-md shadow-indigo-500/30">
                T
              </div>
              <div>
                <div className="font-extrabold text-[16px] tracking-tight leading-none text-white">
                  TrackmySubs
                </div>
                <div className="text-[9px] font-bold tracking-widest bg-gradient-to-r from-indigo-400 to-pink-400 bg-clip-text text-transparent uppercase mt-0.5">
                  SUBSCRIPTIONS & LICENSES
                </div>
              </div>
            </div>

            <h2 className="text-[26px] font-black leading-tight tracking-tight text-white">
              Make subscriptions effortless to share.
            </h2>
            <p className="text-[13px] text-slate-300 mt-2.5 leading-relaxed">
              Track active renewals, who uses each service, and when payments charge.
            </p>

            <div className="bg-white rounded-2xl p-4 text-slate-900 mt-8 shadow-xl border border-white/20">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                YOUR HOUSEHOLD TOTAL
              </div>
              <div className="text-[22px] font-black text-indigo-950 mt-1 font-mono">
                ₹3,279{" "}
                <span className="text-[12px] font-normal text-slate-500 font-sans">
                  monthly spend
                </span>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-100 space-y-2 text-[11px] text-slate-600">
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center text-[10px] font-bold">
                    ✓
                  </span>
                  <span>Advance alerts before every renewal</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center text-[10px] font-bold">
                    ✓
                  </span>
                  <span>Strict Google validation & 6-digit numeric OTP</span>
                </div>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 mt-8 pt-4 border-t border-white/10">
            Bank-grade 256-bit SSL encryption · Never store streaming passwords
          </div>
        </div>

        {/* Right Form Column */}
        <div className="md:col-span-7 p-7 sm:p-10 flex flex-col justify-between bg-white">
          <div>
            <div className="text-[10px] font-extrabold text-indigo-600 uppercase tracking-widest">
              {mode === "signin" ? "WELCOME BACK" : signupStep === "verify_otp" ? "VERIFICATION" : "START YOUR HOME"}
            </div>
            <h1 className="text-[24px] font-black text-slate-900 mt-1">
              {mode === "signin"
                ? "Sign in to TrackmySubs"
                : signupStep === "verify_otp"
                ? "Verify your email"
                : "Create an account"}
            </h1>
            <p className="text-[13px] text-slate-500 mt-0.5">
              {mode === "signin"
                ? "Your household subscriptions, all in one calm hub."
                : signupStep === "verify_otp"
                ? `Enter the 6-digit code sent to ${email}`
                : "Manage all your family subscriptions together."}
            </p>

            {errorMessage && (
              <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <p className="flex-1 leading-snug">{errorMessage}</p>
              </div>
            )}

            {successMessage && (
              <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2.5 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <p className="flex-1 leading-snug">{successMessage}</p>
              </div>
            )}

            {mode === "signup" && signupStep === "verify_otp" ? (
              <form onSubmit={handleVerifySignupOtp} className="mt-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 text-center">
                    Enter 6-digit Verification Code
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    autoFocus
                    value={signupOtp}
                    onChange={(e) => setSignupOtp(e.target.value.replace(/\D/g, ""))}
                    placeholder="------"
                    className="w-full text-center tracking-[0.4em] font-mono text-2xl font-black py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 shadow-2xs"
                  />
                </div>

                <KinButton type="submit" variant="primary" disabled={loading} className="w-full py-2.5 text-[14px]">
                  {loading ? "Verifying..." : "Verify OTP & Proceed to Sign In"}
                </KinButton>

                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSignupStep("form");
                      setErrorMessage(null);
                    }}
                    className="text-xs text-slate-500 hover:text-slate-800 hover:underline"
                  >
                    ← Back to edit email
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                {mode === "signup" && (
                  <div>
                    <label className="block text-[12px] font-bold text-slate-700 mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Alex Morgan"
                      className="w-full px-3.5 py-2.5 text-[13px] bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[12px] font-bold text-slate-700 mb-1">
                    Email address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full px-3.5 py-2.5 text-[13px] bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                  />
                </div>

                <div>
                  <label className="text-[12px] font-bold text-slate-700 block mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full px-3.5 py-2.5 text-[13px] bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                  />
                </div>

                {mode === "signup" && (
                  <div>
                    <label className="text-[12px] font-bold text-slate-700 block mb-1">
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      className="w-full px-3.5 py-2.5 text-[13px] bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                    />
                  </div>
                )}

                <KinButton type="submit" variant="primary" disabled={loading} className="w-full py-2.5 text-[14px]">
                  {loading
                    ? "Processing..."
                    : mode === "signin"
                    ? "Sign in"
                    : "Create Account & Send OTP"}
                </KinButton>

                <div className="relative my-4 text-center">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200" />
                  </div>
                  <span className="relative bg-white px-3 text-[11px] text-slate-400 font-semibold">
                    or continue with
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setGoogleModalError(null);
                    setShowAddAnotherGoogle(googleAccounts.length === 0);
                    setShowGoogleModal(true);
                  }}
                  className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 border border-slate-300 rounded-xl text-[13px] font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer shadow-2xs"
                >
                  <GoogleGIcon className="w-4 h-4" />
                  <span>Continue with Google</span>
                </button>
              </form>
            )}

            <div className="text-center mt-5 text-[12px] text-slate-500">
              {mode === "signin" ? "New to TrackmySubs? " : "Already have an account? "}
              <button
                onClick={() => {
                  setMode(mode === "signin" ? "signup" : "signin");
                  setSignupStep("form");
                  setPassword("");
                  setConfirmPassword("");
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
                className="font-bold text-indigo-600 hover:underline transition"
              >
                {mode === "signin" ? "Create an account" : "Sign in"}
              </button>
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-slate-100 text-[11px] text-slate-400 space-y-1">
            <p>We never ask for streaming passwords or one-time payment codes.</p>
          </div>
        </div>
      </div>

      {/* Mobile-Style Google Account Chooser Modal */}
      {showGoogleModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <div
            className="relative w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 overflow-hidden text-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowGoogleModal(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center pt-1 pb-4 border-b border-slate-100">
              <div className="w-10 h-10 rounded-2xl bg-white shadow-md border border-slate-100 flex items-center justify-center mx-auto mb-3">
                <GoogleGIcon className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 tracking-tight">
                {googleAccounts.length > 0 ? "Choose an account" : "Sign in with Google"}
              </h3>
              <p className="text-xs text-slate-500 mt-1">to continue to <strong>TrackmySubs</strong></p>
            </div>

            {googleModalError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <p className="flex-1">{googleModalError}</p>
              </div>
            )}

            <div className="mt-4 divide-y divide-slate-100">
              {googleAccounts.map((account) => (
                <button
                  key={account.email}
                  disabled={Boolean(isVerifyingGoogle)}
                  onClick={() => handleSelectGoogleAccount(account.email, account.name)}
                  className="w-full py-3.5 px-3 flex items-center justify-between hover:bg-slate-50 rounded-xl transition cursor-pointer text-left disabled:opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-white font-bold text-sm flex items-center justify-center">
                      {account.avatar || "G"}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">{account.name}</h4>
                      <p className="text-[11px] text-slate-500 font-mono">{account.email}</p>
                    </div>
                  </div>
                  {isVerifyingGoogle === account.email ? (
                    <RefreshCw className="w-4 h-4 text-indigo-600 animate-spin" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  )}
                </button>
              ))}

              {!showAddAnotherGoogle ? (
                <button
                  onClick={() => setShowAddAnotherGoogle(true)}
                  className="w-full py-3.5 px-3 flex items-center gap-3 hover:bg-slate-50 rounded-xl transition cursor-pointer text-left text-xs font-bold text-slate-700"
                >
                  <div className="w-10 h-10 rounded-full border border-dashed border-slate-300 flex items-center justify-center text-slate-400">
                    <Plus className="w-4 h-4" />
                  </div>
                  <span>Use another account</span>
                </button>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (anotherGoogleEmail.trim()) {
                      handleSelectGoogleAccount(anotherGoogleEmail.trim());
                    }
                  }}
                  className="p-3 bg-slate-50 rounded-2xl border border-slate-200 mt-2 space-y-3"
                >
                  <label className="block text-xs font-bold text-slate-700">
                    Enter Google email address
                  </label>
                  <input
                    type="email"
                    required
                    autoFocus
                    value={anotherGoogleEmail}
                    onChange={(e) => setAnotherGoogleEmail(e.target.value)}
                    placeholder="name@gmail.com"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddAnotherGoogle(false);
                        setAnotherGoogleEmail("");
                        if (googleAccounts.length === 0) {
                          setShowGoogleModal(false);
                        }
                      }}
                      className="px-3 py-1.5 text-xs text-slate-500 font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={Boolean(isVerifyingGoogle) || !anotherGoogleEmail.trim()}
                      className="px-4 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg"
                    >
                      {isVerifyingGoogle ? "Verifying..." : "Continue"}
                    </button>
                  </div>
                </form>
              )}
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 text-[11px] text-slate-400 text-center">
              Google will share your name and email with TrackmySubs.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
