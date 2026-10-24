"use client";

import React, { useState } from "react";
import {
  X,
  Sparkles,
  Check,
  Calculator,
  MessageSquare,
  FileText,
  Calendar,
  ShieldCheck,
  Send,
  Zap,
} from "lucide-react";
import { Subscription, BillingCycle } from "@/lib/types";
import { BrandLogo, getBrandLogo, getBrandColor } from "@/lib/logoHelper";
import { addDaysToDate, formatDisplayDate } from "@/lib/dateCalculator";
import {
  parseSubscriptionMessage,
  SAMPLE_MESSAGES,
  ParsedSubscriptionResult,
} from "@/lib/messageParser";
import { useHousehold } from "@/context/HouseholdContext";

interface AddSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (sub: Omit<Subscription, "id" | "created_at" | "updated_at">) => void;
}

const POPULAR_SERVICES = [
  {
    name: "MyJio",
    tier: "Prepaid 2GB/Day · 28 Days",
    cost: "349",
    cycle: "monthly" as BillingCycle,
    validityDays: 28,
  },
  {
    name: "Google Gemini",
    tier: "Advanced · Monthly",
    cost: "1950",
    cycle: "monthly" as BillingCycle,
    validityDays: 30,
  },
  {
    name: "Duolingo",
    tier: "Super · Monthly",
    cost: "249",
    cycle: "monthly" as BillingCycle,
    validityDays: 30,
  },
  {
    name: "Netflix",
    tier: "Standard HD (2 Screens)",
    cost: "499",
    cycle: "monthly" as BillingCycle,
    validityDays: 30,
  },
  {
    name: "Spotify",
    tier: "Family (6 Accounts)",
    cost: "179",
    cycle: "monthly" as BillingCycle,
    validityDays: 30,
  },
  {
    name: "Prime Video",
    tier: "Amazon Prime Annual",
    cost: "1499",
    cycle: "yearly" as BillingCycle,
    validityDays: 365,
  },
  {
    name: "Airtel Thanks",
    tier: "Unlimited 5G · 28 Days",
    cost: "299",
    cycle: "monthly" as BillingCycle,
    validityDays: 28,
  },
  {
    name: "ChatGPT Plus",
    tier: "Plus Subscription (GPT-4o)",
    cost: "1999",
    cycle: "monthly" as BillingCycle,
    validityDays: 30,
  },
  {
    name: "ZEE5",
    tier: "Premium 4K · Quarterly",
    cost: "293",
    cycle: "quarterly" as BillingCycle,
    validityDays: 90,
  },
  {
    name: "HBO Max",
    tier: "Ad-Free · Monthly",
    cost: "1250",
    cycle: "monthly" as BillingCycle,
    validityDays: 30,
  },
];

export default function AddSubscriptionModal({
  isOpen,
  onClose,
  onAdd,
}: AddSubscriptionModalProps) {
  const { members = [], currentUser } = useHousehold();
  const today = new Date().toISOString().split("T")[0];

  // Entry Mode: "paste" (Smart Message Parser) or "manual" (Standard Form)
  const [activeTab, setActiveTab] = useState<"paste" | "manual">("paste");

  // Raw Message Paste State
  const [rawMessage, setRawMessage] = useState("");
  const [parsedResult, setParsedResult] = useState<ParsedSubscriptionResult | null>(null);

  // Manual Form State
  const [name, setName] = useState("");
  const [tier, setTier] = useState("Standard · Monthly");
  const [cost, setCost] = useState("");
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [startDate, setStartDate] = useState(today);
  const [validityDays, setValidityDays] = useState<number>(30);
  const [nextBillingDate, setNextBillingDate] = useState(() => addDaysToDate(today, 30));
  const [whoUsesIt, setWhoUsesIt] = useState("Everyone");
  const [autopay, setAutopay] = useState(true);
  const [serviceUrl, setServiceUrl] = useState("");
  const [customLogoUrl, setCustomLogoUrl] = useState("");
  const [autoCalcNotice, setAutoCalcNotice] = useState<string>("");

  if (!isOpen) return null;

  // Handle message paste / change
  const handleMessageChange = (text: string) => {
    setRawMessage(text);
    if (text.trim().length > 6) {
      const parsed = parseSubscriptionMessage(text);
      setParsedResult(parsed);
    } else {
      setParsedResult(null);
    }
  };

  // Quick 1-click sample button
  const handleLoadSample = (key: keyof typeof SAMPLE_MESSAGES) => {
    const text = SAMPLE_MESSAGES[key];
    setRawMessage(text);
    const parsed = parseSubscriptionMessage(text);
    setParsedResult(parsed);
  };

  // Submit from Parsed Message
  const handleAddFromParsed = () => {
    if (!parsedResult) return;
    const numCost = parsedResult.cost;
    const monthlyEquivalent =
      parsedResult.billingCycle === "yearly"
        ? Math.round(numCost / 12)
        : parsedResult.billingCycle === "quarterly"
        ? Math.round(numCost / 3)
        : parsedResult.billingCycle === "weekly"
        ? Math.round((numCost * 52) / 12)
        : numCost;

    onAdd({
      user_id: currentUser?.email || "current-user",
      name: parsedResult.name,
      plan_tier: parsedResult.planTier,
      cost: numCost,
      monthly_cost: monthlyEquivalent,
      currency: "INR",
      billing_cycle: parsedResult.billingCycle,
      status: "active",
      start_date: parsedResult.startDate,
      next_billing_date: parsedResult.nextBillingDate,
      auto_renew: true,
      autopay_state: "on",
      who_uses_it: whoUsesIt,
      source: "receipt",
      source_detail: parsedResult.sourceDetail,
      brand_letter: parsedResult.name.charAt(0).toUpperCase(),
      brand_color: parsedResult.brandColor,
      icon_image: parsedResult.iconImage,
      validity_days: parsedResult.validityDays,
      purchase_date: parsedResult.startDate,
      evidence_snippet: parsedResult.evidenceSnippet,
      receipt_id: `REC-${parsedResult.name.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-6)}`,
      notify_before_days: 1,
      tags: ["Auto-Detected", parsedResult.name],
    });

    setRawMessage("");
    setParsedResult(null);
    onClose();
  };

  // Manual Validity Chip Selection
  const handleValiditySelect = (days: number) => {
    setValidityDays(days);
    const calculated = addDaysToDate(startDate, days);
    setNextBillingDate(calculated);
    setAutoCalcNotice(
      `⚡ Auto-calculated renewal: ${formatDisplayDate(startDate)} + ${days} days valid → ${formatDisplayDate(calculated)} (Visible on Calendar)`
    );
  };

  const handleStartDateChange = (newStartDate: string) => {
    setStartDate(newStartDate);
    if (validityDays > 0) {
      const calculated = addDaysToDate(newStartDate, validityDays);
      setNextBillingDate(calculated);
      setAutoCalcNotice(
        `⚡ Auto-calculated renewal: ${formatDisplayDate(newStartDate)} + ${validityDays} days valid → ${formatDisplayDate(calculated)} (Visible on Calendar)`
      );
    }
  };

  // Manual Form Preset Selection
  const handleSelectPreset = (serv: typeof POPULAR_SERVICES[0]) => {
    setName(serv.name);
    setTier(serv.tier);
    setCost(serv.cost);
    setBillingCycle(serv.cycle);
    handleValiditySelect(serv.validityDays);
  };

  // Manual Form Submit
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !cost || !nextBillingDate) return;

    const numCost = parseFloat(cost);
    const monthlyEquivalent =
      billingCycle === "yearly"
        ? Math.round(numCost / 12)
        : billingCycle === "quarterly"
        ? Math.round(numCost / 3)
        : billingCycle === "weekly"
        ? Math.round((numCost * 52) / 12)
        : numCost;
    const finalLogo = getBrandLogo(name, customLogoUrl);
    const finalColor = getBrandColor(name);

    onAdd({
      user_id: currentUser?.email || "current-user",
      name: name.trim(),
      plan_tier: tier,
      cost: numCost,
      monthly_cost: monthlyEquivalent,
      currency: "INR",
      billing_cycle: billingCycle,
      status: "active",
      start_date: startDate,
      next_billing_date: nextBillingDate,
      auto_renew: autopay,
      autopay_state: autopay ? "on" : "off",
      who_uses_it: whoUsesIt,
      source: "manual",
      source_detail: `Manually added · ${validityDays} days valid`,
      brand_letter: name.trim().charAt(0).toUpperCase(),
      brand_color: finalColor,
      icon_image: finalLogo,
      validity_days: validityDays,
      purchase_date: startDate,
      receipt_id: `REC-${name.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-6)}`,
      notify_before_days: 1,
      service_url: serviceUrl || undefined,
      tags: ["Household", name.trim()],
    });

    setName("");
    setCost("");
    setAutoCalcNotice("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden p-6 sm:p-7 space-y-4 max-h-[92vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <span className="text-[10px] font-bold tracking-wider text-indigo-600 uppercase flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-pink-500" />
              Automatic Message Parser & Calendar Sync
            </span>
            <h3 className="text-xl font-black text-slate-900 leading-tight">
              Add Subscription
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Toggle: Paste Message vs Standard Form */}
        <div className="flex items-center p-1 bg-slate-100 rounded-2xl">
          <button
            type="button"
            onClick={() => setActiveTab("paste")}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === "paste"
                ? "bg-white text-indigo-700 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-indigo-600" />
            <span>Paste Message / Receipt</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("manual")}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === "manual"
                ? "bg-white text-indigo-700 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-slate-500" />
            <span>Standard Form</span>
          </button>
        </div>

        {/* TAB 1: PASTE ANY RECEIPT / MESSAGE */}
        {activeTab === "paste" && (
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* Quick 1-Click Samples for Easy Testing */}
            <div>
              <span className="text-[11px] font-bold text-slate-600 mb-1.5 block">
                Quick Test Samples (Click to auto-populate):
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleLoadSample("jio_sunnxt")}
                  className="px-2.5 py-1 bg-orange-100 hover:bg-orange-200 text-orange-950 border border-orange-300 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1"
                >
                  <span>☀️ Jio + Sun NXT ₹549 (56 Days)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleLoadSample("zee5")}
                  className="px-2.5 py-1 bg-purple-100 hover:bg-purple-200 text-purple-950 border border-purple-300 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1"
                >
                  <span>📺 ZEE5 ₹399 (90 Days)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleLoadSample("myjio")}
                  className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1"
                >
                  <span>📱 MyJio ₹349 (28 Days)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleLoadSample("gemini")}
                  className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1"
                >
                  <span>✨ Google Gemini ₹1,950</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleLoadSample("airtel")}
                  className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1"
                >
                  <span>📶 Airtel ₹299 (28 Days)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleLoadSample("netflix")}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition cursor-pointer"
                >
                  <span>🎬 Netflix ₹649</span>
                </button>
              </div>
            </div>

            {/* Raw Message Text Area */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Paste message from invoice, receipt, or email:
              </label>
              <textarea
                rows={3}
                value={rawMessage}
                onChange={(e) => handleMessageChange(e.target.value)}
                placeholder="Paste message e.g.: 'Dear Jio user, your recharge of ₹349 is successful on 22 Oct 2026. Pack validity 28 days.'"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono transition"
              />
            </div>

            {/* Real-time Parsed Preview Card */}
            {parsedResult ? (
              <div className="p-4 bg-gradient-to-r from-indigo-50/90 via-purple-50/60 to-pink-50/50 border border-indigo-200 rounded-2xl space-y-3 animate-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <BrandLogo
                      name={parsedResult.name}
                      iconUrl={parsedResult.iconImage}
                      size="md"
                      rounded="rounded-2xl"
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-black tracking-wider text-indigo-600 uppercase">
                          Auto-Detected
                        </span>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded-full">
                          Valid
                        </span>
                      </div>
                      <h4 className="text-base font-black text-slate-900 leading-tight">
                        {parsedResult.name}
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        {parsedResult.planTier}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Amount
                    </span>
                    <span className="text-xl font-black text-slate-900 font-mono">
                      ₹{parsedResult.cost.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>

                {/* Parsed Metadata Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  <div className="p-2.5 bg-white/90 rounded-xl border border-indigo-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">
                      Purchase Date
                    </span>
                    <span className="font-bold text-slate-800">
                      {formatDisplayDate(parsedResult.startDate)}
                    </span>
                  </div>

                  <div className="p-2.5 bg-white/90 rounded-xl border border-indigo-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">
                      Plan Validity
                    </span>
                    <span className="font-bold text-indigo-700">
                      {parsedResult.validityDays} Days Valid
                    </span>
                  </div>

                  <div className="p-2.5 bg-white/90 rounded-xl border border-indigo-100 col-span-2 sm:col-span-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">
                      Renewal Date (Calendar)
                    </span>
                    <span className="font-mono font-bold text-purple-700">
                      {formatDisplayDate(parsedResult.nextBillingDate)}
                    </span>
                  </div>
                </div>

                {/* Calendar Confirmation Notice */}
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800 font-semibold">
                  <Calendar className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    {parsedResult.calculationNote}
                  </span>
                </div>

                {/* Who Uses Plan */}
                <div className="flex items-center justify-between pt-1">
                  <label className="text-xs font-bold text-slate-700">
                    Assign Household Member:
                  </label>
                  <select
                    value={whoUsesIt}
                    onChange={(e) => setWhoUsesIt(e.target.value)}
                    className="px-3 py-1 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 cursor-pointer"
                  >
                    <option value="Everyone">Everyone</option>
                    <option value="Family Plan">Family Plan</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.name}>
                        {m.name} ({m.role})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Add to Subscriptions & Calendar Button */}
                <button
                  type="button"
                  onClick={handleAddFromParsed}
                  className="w-full py-3 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:to-pink-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-500/20 transition active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  <span>Add to Subscriptions Ledger &amp; Calendar</span>
                </button>
              </div>
            ) : (
              <div className="p-5 border border-dashed border-slate-200 rounded-2xl text-center text-xs text-slate-400 bg-slate-50/50">
                Paste any confirmation email, receipt, or recharge SMS above to calculate renewal dates automatically.
              </div>
            )}
          </div>
        )}

        {/* TAB 2: MANUAL FORM WITH VALIDITY CALCULATOR */}
        {activeTab === "manual" && (
          <form onSubmit={handleManualSubmit} className="space-y-3.5 animate-in fade-in duration-150">
            {/* Real Logo Live Preview */}
            <div className="flex items-center gap-4 p-3.5 bg-gradient-to-r from-indigo-50/80 via-purple-50/50 to-pink-50/40 border border-indigo-100/90 rounded-2xl">
              <BrandLogo
                name={name.trim() || "Service"}
                iconUrl={getBrandLogo(name, customLogoUrl)}
                size="lg"
                rounded="rounded-2xl"
              />
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-black tracking-wider text-indigo-600 uppercase block">
                  Real Logo Auto-Detected
                </span>
                <h4 className="text-base font-extrabold text-slate-900 truncate">
                  {name.trim() || "Type service (e.g. MyJio, Google Gemini)"}
                </h4>
                <p className="text-xs text-slate-500 truncate">
                  Official brand SVG &amp; favicon dynamically resolved
                </p>
              </div>
            </div>

            {/* Quick Pick Popular Services */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Popular Services (1-Click Fill)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {POPULAR_SERVICES.map((serv) => {
                  const isSelected = name.toLowerCase() === serv.name.toLowerCase();
                  return (
                    <button
                      key={serv.name}
                      type="button"
                      onClick={() => handleSelectPreset(serv)}
                      className={`p-2 rounded-2xl border transition flex flex-col items-center gap-1 cursor-pointer ${
                        isSelected
                          ? "bg-indigo-50 border-indigo-600 ring-2 ring-indigo-500/30 shadow-xs"
                          : "bg-slate-50 hover:bg-white border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <BrandLogo name={serv.name} size="sm" rounded="rounded-xl" />
                      <span className="text-[10px] font-bold text-slate-700 truncate w-full text-center">
                        {serv.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Plan Name & Tier */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Service / Provider *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. MyJio, Google Gemini"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Plan Tier
                </label>
                <input
                  type="text"
                  value={tier}
                  onChange={(e) => setTier(e.target.value)}
                  placeholder="e.g. 28 Days, Advanced"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Cost & Billing Cadence */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Amount (₹) *
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  placeholder="e.g. 349"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-mono focus:outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Billing Cadence
                </label>
                <select
                  value={billingCycle}
                  onChange={(e) => {
                    const cycle = e.target.value as BillingCycle;
                    setBillingCycle(cycle);
                    if (cycle === "yearly") handleValiditySelect(365);
                    else if (cycle === "quarterly") handleValiditySelect(90);
                    else handleValiditySelect(30);
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly / Annual</option>
                  <option value="quarterly">Quarterly</option>
                </select>
              </div>
            </div>

            {/* Validity Days & Renewal Calculator */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Calculator className="w-3.5 h-3.5 text-indigo-600" />
                  Intelligent Validity &amp; Calendar Calculator
                </span>
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                  Adds to Calendar
                </span>
              </div>

              {/* Quick Validity Chips */}
              <div className="flex flex-wrap items-center gap-1.5">
                {[28, 29, 30, 84, 90, 365].map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => handleValiditySelect(days)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                      validityDays === days
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {days === 365 ? "1 Year" : `${days} Days`}
                  </button>
                ))}
              </div>

              {/* Date Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Start / Purchase Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Next Renewal Date (Calendar) *
                  </label>
                  <input
                    type="date"
                    required
                    value={nextBillingDate}
                    onChange={(e) => setNextBillingDate(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-indigo-300 rounded-xl text-xs text-indigo-900 font-bold font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {autoCalcNotice && (
                <div className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl p-2 flex items-center gap-1.5 animate-in fade-in">
                  <span>{autoCalcNotice}</span>
                </div>
              )}
            </div>

            {/* Website or Custom Logo URL */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Website or Custom Logo URL (Optional)
              </label>
              <input
                type="text"
                value={customLogoUrl}
                onChange={(e) => setCustomLogoUrl(e.target.value)}
                placeholder="e.g. canva.com or https://example.com/logo.png"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500 font-mono"
              />
              <p className="text-[10px] text-slate-400 mt-0.5">
                Leave empty to auto-detect the official high-res logo from Google / favicon.
              </p>
            </div>

            {/* Who Uses It */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Who Uses It
              </label>
              <select
                value={whoUsesIt}
                onChange={(e) => setWhoUsesIt(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="Everyone">Everyone</option>
                <option value="Family Plan">Family Plan</option>
                {members.map((m) => (
                  <option key={m.id} value={m.name}>
                    {m.name} ({m.role})
                  </option>
                ))}
              </select>
            </div>

            {/* Modal Actions */}
            <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition shadow-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:to-pink-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-500/20 transition cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Add Plan &amp; Sync to Calendar</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
