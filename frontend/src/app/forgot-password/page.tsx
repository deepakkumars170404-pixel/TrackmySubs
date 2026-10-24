"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

function getBackendUrl(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_BACKEND_URL || (process.env.NODE_ENV === "production" ? "https://trackmysubs-backend.onrender.com" : "http://127.0.0.1:5000");
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    setIsSubmitting(true);
    try {
      const response = await fetch(`${getBackendUrl()}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() })
      });
      const result = (await response.json()) as { success?: boolean; message?: string };

      if (!response.ok || !result.success) {
        setError(result.message || "Could not send the reset email. Please try again.");
        return;
      }

      setMessage(result.message || "If an account exists for this email, a reset code and link have been sent.");
    } catch (requestError) {
      console.error("Password reset email request failed:", requestError);
      setError("Could not send the reset email. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#090a0f] px-4 py-12 text-slate-100">
      <section className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-8 shadow-2xl">
        <p className="text-sm font-semibold text-indigo-400">TrackmySubs account</p>
        <h1 className="mt-2 text-2xl font-bold text-white">Forgot your password?</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Enter your account email. We will send a one-time code and a link to reset your password.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-300">
              Email address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-500"
              placeholder="you@example.com"
            />
          </div>

          {message && (
            <p role="status" className="rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-300">
              {message}
            </p>
          )}
          {error && (
            <p role="alert" className="rounded-lg bg-red-500/10 p-3 text-sm text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Sending..." : "Send reset code and link"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          <Link href="/" className="font-medium text-indigo-300 hover:text-indigo-200">
            Back to home
          </Link>
        </p>
      </section>
    </main>
  );
}
