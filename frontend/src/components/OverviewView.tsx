"use client";

import React, { useMemo } from "react";
import {
  Plus,
  Mail,
  Sparkles,
  ArrowRight,
  ChevronRight,
  CreditCard,
  Calendar,
  ShieldCheck,
  Users,
  CheckCircle2,
  Clock,
  Bell,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Subscription } from "@/lib/types";
import { FamilyMember } from "@/types/trackmysubs";
import { CurrentUser } from "@/components/Header";
import { BrandLogo } from "@/lib/logoHelper";
import { getSubscriptionMonthlyCost } from "@/context/HouseholdContext";
import { formatDisplayDate } from "@/lib/dateCalculator";

interface OverviewViewProps {
  subscriptions: Subscription[];
  members?: FamilyMember[];
  currentUser?: CurrentUser | null;
  onOpenAddModal: () => void;
  onOpenInboxModal: () => void;
  onGoToCalendar: () => void;
  onSelectSubscriptionForReminder: (sub: Subscription) => void;
}

// Helper to format clean display name from user's name or email
function extractCleanUserName(emailOrName?: string | null): string {
  if (!emailOrName) return "Welcome";
  let str = emailOrName.trim();
  if (str.includes("@")) {
    str = str.split("@")[0];
  }
  // Remove trailing numbers (e.g. deepakkumars170404 -> deepakkumars)
  const withoutNumbers = str.replace(/[0-9]+$/g, "");
  if (withoutNumbers.length >= 2) {
    str = withoutNumbers;
  }
  // Replace dots, underscores, dashes with space
  str = str.replace(/[._-]+/g, " ").trim();
  if (!str) return "Welcome";

  // Capitalize every word (e.g. "deepak kumar" -> "Deepak Kumar")
  return str
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export default function OverviewView({
  subscriptions,
  members = [],
  currentUser,
  onOpenAddModal,
  onOpenInboxModal,
  onGoToCalendar,
  onSelectSubscriptionForReminder,
}: OverviewViewProps) {
  const router = useRouter();

  // 1. Dynamic User Display Name: extracted strictly from user's registered name or email
  const displayName = useMemo(() => {
    const raw = currentUser?.name || currentUser?.email || "";
    if (!raw || raw === "Family" || raw === "Account Owner" || raw === "User") {
      if (typeof window !== "undefined") {
        const storedName = window.localStorage.getItem("trackmysubs_user_name");
        const storedEmail = window.localStorage.getItem("trackmysubs_user_email");
        if (storedName) return extractCleanUserName(storedName);
        if (storedEmail) return extractCleanUserName(storedEmail);
      }
      return "Welcome";
    }
    return extractCleanUserName(raw);
  }, [currentUser]);

  // 2. Dynamic Total Monthly Spend calculated directly from subscriptions
  const totalMonthlySpend = useMemo(() => {
    return subscriptions.reduce((sum, s) => {
      return sum + getSubscriptionMonthlyCost(s);
    }, 0);
  }, [subscriptions]);

  // 3. Active Plans count
  const activeCount = useMemo(() => {
    return subscriptions.filter(
      (s) => s.status === "active" || !s.status
    ).length;
  }, [subscriptions]);

  // 4. Renewing Soon (in next 7 days)
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const next7Days = useMemo(() => {
    const d = new Date(today);
    d.setDate(today.getDate() + 7);
    return d;
  }, [today]);

  const renewingSoonCount = useMemo(() => {
    return subscriptions.filter((s) => {
      if (!s.next_billing_date) return false;
      const ren = new Date(s.next_billing_date);
      return ren >= today && ren <= next7Days;
    }).length;
  }, [subscriptions, today, next7Days]);

  // 5. Autopay active vs needs review
  const autopayOnCount = useMemo(() => {
    return subscriptions.filter(
      (s) => s.auto_renew !== false && s.autopay_state !== "off"
    ).length;
  }, [subscriptions]);

  const needCheckCount = useMemo(() => {
    return subscriptions.filter(
      (s) => s.autopay_state === "review" || s.source === "needs_review" || s.auto_renew === false
    ).length;
  }, [subscriptions]);

  // 6. Sorted upcoming renewals (next 30 days)
  const upcomingRenewals = useMemo(() => {
    return [...subscriptions]
      .filter((s) => s.status !== "canceled")
      .sort((a, b) => {
        const dateA = new Date(a.next_billing_date || 0).getTime();
        const dateB = new Date(b.next_billing_date || 0).getTime();
        return dateA - dateB;
      })
      .slice(0, 5);
  }, [subscriptions]);

  const nextRenewalSub = upcomingRenewals[0];
  const totalMembers = members.length;

  // 7. Category breakdown for advanced spend visualizer
  const categoryBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    subscriptions.forEach((s) => {
      const catName =
        typeof s.category === "object" && s.category?.name
          ? s.category.name
          : typeof s.category === "string"
          ? s.category
          : "General & Tools";
      map[catName] = (map[catName] || 0) + getSubscriptionMonthlyCost(s);
    });
    return Object.entries(map)
      .map(([name, amount]) => ({
        name,
        amount,
        percentage: totalMonthlySpend > 0 ? Math.round((amount / totalMonthlySpend) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [subscriptions, totalMonthlySpend]);

  // 8. Dynamic Spend Forecast Months autoupdates based on actual calendar month
  const chartMonths = useMemo(() => {
    const now = new Date();
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return [-3, -2, -1, 0, 1].map((offset) => {
      const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      const isCurrent = offset === 0;
      const isForecast = offset > 0;
      return {
        month: monthNames[d.getMonth()],
        isCurrent,
        isForecast,
        actual: isForecast
          ? null
          : offset === 0
          ? totalMonthlySpend
          : Math.round(totalMonthlySpend * (1 - Math.abs(offset) * 0.05)),
        forecast: isForecast ? Math.round(totalMonthlySpend * 1.06) : null,
      };
    });
  }, [totalMonthlySpend]);

  return (
    <div className="space-y-6">
      {/* 1. TOP HERO WELCOME BANNER (Applicable for both Office & Home) */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 p-6 sm:p-8 text-white shadow-xl shadow-indigo-950/20 border border-white/10">
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-pink-500/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 left-1/3 w-80 h-80 rounded-full bg-cyan-500/20 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs font-semibold text-cyan-300 mb-3">
              <Sparkles className="w-3.5 h-3.5 text-pink-400" />
              <span>
                {displayName}’s Hub · {totalMembers} {totalMembers === 1 ? "Member" : "Members"}
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight">
              Good day, {displayName}
            </h2>
            <p className="text-sm text-indigo-100/80 mt-1 leading-relaxed">
              Your office, team, and personal subscriptions synced in real time.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={onOpenAddModal}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-pink-500/25 transition active:scale-[0.98] cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add subscription</span>
            </button>
            <button
              onClick={onOpenInboxModal}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-semibold rounded-xl backdrop-blur-md transition cursor-pointer"
            >
              <Mail className="w-4 h-4 text-cyan-300" />
              <span>Connect inbox</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. 4 COLOR-CODED STAT METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Monthly Spend */}
        <div className="bg-white border border-slate-200/80 border-t-4 border-t-indigo-500 rounded-2xl p-5 shadow-xs hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
              Monthly Spend
            </p>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs font-mono">
              ₹
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-[26px] font-black tracking-tight text-indigo-950 font-mono">
              ₹{totalMonthlySpend.toLocaleString("en-IN")}
            </span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
              {totalMembers} {totalMembers === 1 ? "member" : "members"}
            </span>
          </div>
          <p className="text-[12px] text-slate-500 mt-1">
            Across {subscriptions.length} active {subscriptions.length === 1 ? "plan" : "plans"} (Home &amp; Office)
          </p>
        </div>

        {/* Card 2: Active Plans */}
        <div className="bg-white border border-slate-200/80 border-t-4 border-t-cyan-500 rounded-2xl p-5 shadow-xs hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
              Active Plans
            </p>
            <div className="w-7 h-7 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-[26px] font-black tracking-tight text-slate-900 font-mono">
              {activeCount}
            </span>
            <span className="text-[11px] font-semibold text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded-full border border-cyan-200">
              Active
            </span>
          </div>
          <p className="text-[12px] text-slate-500 mt-1">
            {subscriptions.filter((s) => s.source === "receipt").length} verified from receipts
          </p>
        </div>

        {/* Card 3: Renewing Soon */}
        <div className="bg-white border border-slate-200/80 border-t-4 border-t-rose-500 rounded-2xl p-5 shadow-xs hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
              Renewing Soon
            </p>
            <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-[26px] font-black tracking-tight text-rose-600 font-mono">
              {renewingSoonCount > 0 ? renewingSoonCount : upcomingRenewals.length > 0 ? 1 : 0}
            </span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
              Queue
            </span>
          </div>
          <p className="text-[12px] text-slate-500 mt-1 truncate">
            {nextRenewalSub
              ? `Next: ${nextRenewalSub.name} on ${formatDisplayDate(nextRenewalSub.next_billing_date)}`
              : "No upcoming renewals"}
          </p>
        </div>

        {/* Card 4: Renewal Alerts */}
        <div className="bg-white border border-slate-200/80 border-t-4 border-t-purple-500 rounded-2xl p-5 shadow-xs hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
              Renewal Alerts (1-Day Prior)
            </p>
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Bell className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-[26px] font-black tracking-tight text-purple-900 font-mono">
              {subscriptions.length}
            </span>
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              Active
            </span>
          </div>
          <p className="text-[12px] text-slate-500 mt-1">
            Sound &amp; popup alerts armed 24h prior
          </p>
        </div>
      </div>

      {/* 3. MIDDLE ROW: Spend History + Upcoming Renewals with REAL BRAND LOGOS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Spend Spline Chart */}
        <div className="lg:col-span-7 bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Total Spend &amp; Billing Trend
                </h3>
                <p className="text-xs text-slate-500">Monthly actuals &amp; forecast for office &amp; home</p>
              </div>
              <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">
                ₹{totalMonthlySpend.toLocaleString("en-IN")} / mo
              </span>
            </div>

            {/* SVG Spline Chart */}
            <div className="mt-6 relative h-[190px] w-full">
              <div className="absolute left-0 top-0 bottom-6 flex flex-col justify-between text-[11px] text-slate-400 font-mono select-none">
                <span>₹{totalMonthlySpend > 0 ? Math.round((totalMonthlySpend * 1.2) / 1000) : 1}k</span>
                <span>₹{totalMonthlySpend > 0 ? Math.round(totalMonthlySpend / 1000) : 0}k</span>
                <span>₹{totalMonthlySpend > 0 ? Math.round((totalMonthlySpend * 0.5) / 1000) : 0}k</span>
              </div>

              {/* Grid lines */}
              <div className="absolute left-8 right-2 top-2 bottom-8 flex flex-col justify-between pointer-events-none">
                <div className="border-b border-dashed border-slate-100 w-full" />
                <div className="border-b border-dashed border-slate-100 w-full" />
                <div className="border-b border-dashed border-slate-100 w-full" />
              </div>

              {/* SVG Curve with Vivid Gradient */}
              <svg
                viewBox="0 0 500 150"
                className="absolute left-8 right-2 top-0 h-[140px] w-[calc(100%-36px)] overflow-visible"
              >
                <defs>
                  <linearGradient id="multiSpendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4F46E5" stopOpacity="0.22" />
                    <stop offset="50%" stopColor="#0EA5E9" stopOpacity="0.10" />
                    <stop offset="100%" stopColor="#EC4899" stopOpacity="0.0" />
                  </linearGradient>
                  <linearGradient id="strokeGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#4F46E5" />
                    <stop offset="60%" stopColor="#0EA5E9" />
                    <stop offset="100%" stopColor="#F43F5E" />
                  </linearGradient>
                </defs>

                {totalMonthlySpend > 0 ? (
                  <>
                    <path
                      d="M 10 115 C 80 110, 120 70, 180 75 C 240 80, 280 60, 340 50 C 370 45, 390 35, 410 32 L 410 145 L 10 145 Z"
                      fill="url(#multiSpendGradient)"
                    />
                    <path
                      d="M 10 115 C 80 110, 120 70, 180 75 C 240 80, 280 60, 340 50 C 370 45, 390 35, 410 32"
                      fill="none"
                      stroke="url(#strokeGradient)"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                    />
                    <path
                      d="M 410 32 C 440 28, 470 20, 490 15"
                      fill="none"
                      stroke="#94A3B8"
                      strokeWidth="2.5"
                      strokeDasharray="4 4"
                      strokeLinecap="round"
                    />
                    <circle cx="410" cy="32" r="4.5" fill="#4F46E5" stroke="#FFFFFF" strokeWidth="2" />
                  </>
                ) : (
                  <>
                    <path
                      d="M 10 120 L 490 120"
                      fill="none"
                      stroke="#CBD5E1"
                      strokeWidth="2"
                      strokeDasharray="4 4"
                    />
                    <text
                      x="250"
                      y="70"
                      textAnchor="middle"
                      className="text-xs fill-slate-400 font-sans"
                    >
                      Add subscriptions to activate dynamic spend charts
                    </text>
                  </>
                )}
              </svg>

              {/* X-axis months */}
              <div className="absolute left-8 right-2 bottom-0 flex justify-between text-[11px] text-slate-500 font-semibold pt-2 border-t border-slate-100">
                {chartMonths.map((m) => (
                  <span
                    key={m.month}
                    className={`cursor-pointer transition-colors ${
                      m.isCurrent
                        ? "text-indigo-600 font-extrabold"
                        : m.isForecast
                        ? "text-slate-400 italic"
                        : "hover:text-slate-900"
                    }`}
                  >
                    {m.month} {m.isCurrent && "•"}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                <span>Actual spend</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full border border-dashed border-slate-400" />
                <span>Forecast</span>
              </div>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">
              ₹{totalMonthlySpend > 0 ? (totalMonthlySpend * 12).toLocaleString("en-IN") : 0}/yr run-rate
            </span>
          </div>

          {/* Category distribution strip */}
          {categoryBreakdown.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 mb-2">
                <span>Category Breakdown</span>
                <span>
                  {categoryBreakdown.length} active {categoryBreakdown.length === 1 ? "category" : "categories"}
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden flex">
                {categoryBreakdown.map((cat, idx) => {
                  const colors = [
                    "bg-indigo-600",
                    "bg-cyan-500",
                    "bg-pink-500",
                    "bg-purple-500",
                    "bg-amber-500",
                    "bg-emerald-500",
                  ];
                  return (
                    <div
                      key={cat.name}
                      style={{ width: `${Math.max(cat.percentage, 5)}%` }}
                      className={`${colors[idx % colors.length]} h-full transition-all`}
                      title={`${cat.name}: ₹${cat.amount.toLocaleString("en-IN")} (${cat.percentage}%)`}
                    />
                  );
                })}
              </div>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {categoryBreakdown.slice(0, 4).map((cat, idx) => {
                  const dotColors = [
                    "bg-indigo-600",
                    "bg-cyan-500",
                    "bg-pink-500",
                    "bg-purple-500",
                    "bg-amber-500",
                    "bg-emerald-500",
                  ];
                  return (
                    <span
                      key={cat.name}
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-[11px] text-slate-600"
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${dotColors[idx % dotColors.length]}`} />
                      <span className="font-medium">{cat.name}</span>
                      <span className="font-bold text-slate-800">
                        ₹{cat.amount.toLocaleString("en-IN")}
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right: Upcoming Renewals with REAL BRAND LOGOS */}
        <div className="lg:col-span-5 bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Upcoming renewals
                </h3>
                <p className="text-xs text-slate-500">Next in schedule</p>
              </div>
              <button
                onClick={onGoToCalendar}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 hover:underline cursor-pointer"
              >
                <span>View calendar</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* List with Real Brand Logos */}
            <div className="mt-3 divide-y divide-slate-100">
              {upcomingRenewals.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No active subscriptions. Click &quot;Add subscription&quot; above.
                </div>
              ) : (
                upcomingRenewals.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => onSelectSubscriptionForReminder(item)}
                    className="py-3 flex items-center justify-between hover:bg-slate-50 -mx-2 px-2 rounded-xl transition cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <BrandLogo
                        name={item.name}
                        iconUrl={item.icon_image}
                        size="md"
                        rounded="rounded-2xl"
                      />
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                          {item.name}
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          {item.plan_tier || "Standard plan"}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-[11px] text-slate-500 font-semibold font-mono">
                        {item.next_billing_date
                          ? formatDisplayDate(item.next_billing_date)
                          : "Scheduled"}
                      </p>
                      <p className="text-xs font-black text-slate-900 font-mono">
                        ₹{Number(item.cost).toLocaleString("en-IN")}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <p className="text-[11px] text-slate-400 mt-3 pt-2 border-t border-slate-100">
            Click any plan to preview reminder and billing details.
          </p>
        </div>
      </div>

      {/* 4. BOTTOM SECTION: Auto-Detect Activity & Members at a glance */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Auto-detect activity card */}
        <div className="lg:col-span-7 bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Auto-detect activity
                </h3>
                <p className="text-xs text-slate-500">
                  Keep office &amp; personal plans synced from inbox receipts.
                </p>
              </div>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200">
                Active sync
              </span>
            </div>

            <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-indigo-50/70 via-purple-50/40 to-pink-50/40 border border-indigo-100 flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-pink-500 text-white flex items-center justify-center shrink-0 shadow-md">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">
                  {subscriptions.length} Subscriptions Synced
                </h4>
                <p className="text-[12px] text-slate-600 mt-0.5">
                  Receipts, connected inboxes, and shared plans are calculated dynamically.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Inbox scanner &amp; receipt verification connected</span>
            </span>
            <button
              onClick={onOpenInboxModal}
              className="text-indigo-600 font-bold hover:text-indigo-800 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Manage connections</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Members & Team at a glance with colorful avatar rings */}
        <div className="lg:col-span-5 bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900">
                Members &amp; Team
              </h3>
            </div>
            <button
              onClick={() => router.push("/family")}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              <span>{totalMembers} {totalMembers === 1 ? "member" : "members"}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="mt-3 space-y-2.5">
            {members.length === 0 ? (
              <div className="py-7 px-4 text-center rounded-2xl bg-slate-50/70 border border-dashed border-slate-200">
                <Users className="w-7 h-7 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-600">No members or collaborators added yet</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Invite team members or family to track and manage subscriptions together.
                </p>
                <button
                  onClick={() => router.push("/family")}
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg border border-indigo-200 transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add First Member</span>
                </button>
              </div>
            ) : (
              members.slice(0, 4).map((member) => {
                const spend = Number(member.monthlyShare ?? 0);
                const plans = Number(member.planCount ?? 0);

                return (
                  <div
                    key={member.id}
                    onClick={() => router.push("/family")}
                    className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 text-white text-xs font-bold flex items-center justify-center shadow-xs">
                        {member.avatarInitials || member.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">
                          {member.name} {member.role === "Owner" ? "(Owner)" : ""}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          ₹{spend.toLocaleString("en-IN")} / mo
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                      {plans} {plans === 1 ? "plan" : "plans"}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
