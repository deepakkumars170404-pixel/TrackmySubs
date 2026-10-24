"use client";

import React, { useState } from "react";
import {
  Sparkles,
  Mail,
  CheckCircle2,
  AlertTriangle,
  Shield,
  RefreshCw,
  Plus,
  ExternalLink,
  MessageSquare,
  Check,
  Calendar,
  Zap,
  UserPlus,
  Users,
  Send,
  Clock,
  ArrowRight
} from "lucide-react";
import { KinCard, KinButton, KinBadge } from "./ui/TrackmySubsUI";
import { ConnectedInbox, DetectedReceipt, FamilyMember } from "@/types/trackmysubs";
import { BrandLogo } from "@/lib/logoHelper";
import { formatDisplayDate } from "@/lib/dateCalculator";
import {
  parseSubscriptionMessage,
  SAMPLE_MESSAGES,
  ParsedSubscriptionResult,
} from "@/lib/messageParser";

interface AutoDetectViewProps {
  inboxes: ConnectedInbox[];
  detectedList: DetectedReceipt[];
  members?: FamilyMember[];
  onOpenInboxModal: () => void;
  onReviewMatch: (item: DetectedReceipt) => void;
  onPreviewScan: (options?: { deepScan?: boolean; maxEmails?: number }) => Promise<void> | void;
  onToggleTracking?: () => void;
  onAddSubscription?: (sub: any) => Promise<void> | void;
  onAutoDetectAddPerson?: (name: string, email: string, role?: string) => Promise<{ success: boolean; member?: any; scannedCount: number; message: string }>;
  onScanMemberMailbox?: (memberId: string, email: string, name: string) => Promise<{ success: boolean; scannedSubscriptions: any[]; message: string }>;
}

export default function AutoDetectView({
  inboxes,
  detectedList,
  members = [],
  onOpenInboxModal,
  onReviewMatch,
  onPreviewScan,
  onToggleTracking,
  onAddSubscription,
  onAutoDetectAddPerson,
  onScanMemberMailbox,
}: AutoDetectViewProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [trackingActive, setTrackingActive] = useState(true);

  // Add person on AutoDetect page state
  const [personName, setPersonName] = useState("");
  const [personEmail, setPersonEmail] = useState("");
  const [isAddingPerson, setIsAddingPerson] = useState(false);
  const [scanningMemberId, setScanningMemberId] = useState<string | null>(null);

  // Instant Message / Receipt Scanner State
  const [instantMessage, setInstantMessage] = useState("");
  const [parsedInstant, setParsedInstant] = useState<ParsedSubscriptionResult | null>(null);
  const [successToast, setSuccessToast] = useState<string>("");
  const [showQuickPaste, setShowQuickPaste] = useState(false);

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(""), 7000);
  };

  const handleScanClick = async () => {
    setIsScanning(true);
    try {
      await onPreviewScan();
    } finally {
      setIsScanning(false);
    }
  };

  const handleAddPersonSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personName.trim() || !personEmail.trim()) return;

    setIsAddingPerson(true);
    try {
      if (onAutoDetectAddPerson) {
        const res = await onAutoDetectAddPerson(personName.trim(), personEmail.trim(), "member");
        if (res.success) {
          showToast(res.message);
          setPersonName("");
          setPersonEmail("");
        } else {
          showToast(`⚠️ ${res.message}`);
        }
      }
    } catch {
      showToast("Error adding person and scanning mailbox.");
    } finally {
      setIsAddingPerson(false);
    }
  };

  const handleScanMemberClick = async (member: FamilyMember) => {
    if (!member.email) {
      showToast(`⚠️ ${member.name} does not have an email address configured.`);
      return;
    }
    setScanningMemberId(member.id);
    try {
      if (onScanMemberMailbox) {
        const res = await onScanMemberMailbox(member.id, member.email, member.name);
        showToast(res.message || `📬 Scanned previous emails for ${member.name}! Subscriptions updated.`);
      }
    } catch {
      showToast("Failed to scan member mailbox.");
    } finally {
      setScanningMemberId(null);
    }
  };

  const handleMessageChange = (text: string) => {
    setInstantMessage(text);
    if (text.trim().length > 6) {
      const parsed = parseSubscriptionMessage(text);
      setParsedInstant(parsed);
    } else {
      setParsedInstant(null);
    }
  };

  const handleLoadSample = (key: keyof typeof SAMPLE_MESSAGES) => {
    const text = SAMPLE_MESSAGES[key];
    setInstantMessage(text);
    const parsed = parseSubscriptionMessage(text);
    setParsedInstant(parsed);
  };

  const handleAddInstant = async () => {
    if (!parsedInstant || !onAddSubscription) return;
    const numCost = parsedInstant.cost;
    const monthlyEquivalent =
      parsedInstant.billingCycle === "yearly" ? Math.round(numCost / 12) : numCost;

    await onAddSubscription({
      user_id: null,
      name: parsedInstant.name,
      plan_tier: parsedInstant.planTier,
      cost: numCost,
      monthly_cost: monthlyEquivalent,
      currency: "INR",
      billing_cycle: parsedInstant.billingCycle,
      status: "active",
      start_date: parsedInstant.startDate,
      next_billing_date: parsedInstant.nextBillingDate,
      auto_renew: true,
      autopay_state: "on",
      who_uses_it: "Everyone",
      source: "receipt",
      source_detail: parsedInstant.sourceDetail,
      brand_letter: parsedInstant.name.charAt(0).toUpperCase(),
      brand_color: parsedInstant.brandColor,
      icon_image: parsedInstant.iconImage,
      validity_days: parsedInstant.validityDays,
      purchase_date: parsedInstant.startDate,
      evidence_snippet: parsedInstant.evidenceSnippet,
      receipt_id: `REC-${parsedInstant.name.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-6)}`,
      notify_before_days: 1,
      tags: ["Auto-Detected", parsedInstant.name],
    });

    showToast(
      `✅ ${parsedInstant.name} (₹${parsedInstant.cost}) added! Purchase date ${formatDisplayDate(parsedInstant.startDate)} + ${parsedInstant.validityDays} days → Renewal: ${formatDisplayDate(parsedInstant.nextBillingDate)} is live on your Subscriptions page.`
    );
    setInstantMessage("");
    setParsedInstant(null);
  };

  const addedCount = detectedList.filter((d) => d.actionTaken === "Added").length;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed top-6 right-6 z-50 bg-slate-900 text-white px-5 py-3.5 rounded-xl shadow-2xl border border-slate-700 text-sm font-semibold flex items-center gap-2.5 animate-in slide-in-from-top-4 max-w-lg">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="leading-snug">{successToast}</span>
        </div>
      )}

      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="text-[10px] font-extrabold tracking-widest bg-gradient-to-r from-indigo-600 to-pink-600 bg-clip-text text-transparent uppercase mb-1 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-pink-500" />
            Auto-Detect &amp; Mailbox History Parser
          </div>
          <h1 className="text-[28px] font-black text-slate-900 tracking-tight leading-tight">
            Auto-detect subscriptions
          </h1>
          <p className="text-[13px] text-slate-500 mt-1">
            Add any person&apos;s email to scan their previous emails for billing receipts. Exact validity periods (28, 30, 56, 86, 990 days) are calculated from the purchase date and added to your subscriptions page.
          </p>
        </div>

        <KinButton
          variant="primary"
          icon={<RefreshCw className={`w-4 h-4 ${isScanning ? "animate-spin" : ""}`} />}
          onClick={handleScanClick}
          disabled={isScanning}
        >
          {isScanning ? "Scanning Gmail Inbox..." : "Sync Gmail Now"}
        </KinButton>
      </div>

      {/* Primary Card: Add Person & Auto-Scan Mailbox */}
      <KinCard className="p-5 sm:p-6 bg-gradient-to-br from-white via-indigo-50/20 to-purple-50/30 border-indigo-200/80 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="max-w-md">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-indigo-100 text-indigo-800 mb-2">
              <UserPlus className="w-3 h-3 text-indigo-600" />
              <span>Automated Person Mailbox Scanner</span>
            </div>
            <h3 className="text-[18px] font-black text-slate-900 leading-tight">
              Add any person to automatically scan previous mails
            </h3>
            <p className="text-[13px] text-slate-600 mt-1 leading-relaxed">
              Enter any person&apos;s email. The engine sends their confirmation email and immediately searches their past email receipts. It matches terms like <strong>28 days, 56 days, 86 days, 990 days</strong>, calculates the purchase and renewal dates accurately, and adds them to your subscription page.
            </p>
          </div>

          <form onSubmit={handleAddPersonSubmit} className="flex-1 max-w-lg space-y-3 bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Person Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={personName}
                  onChange={(e) => setPersonName(e.target.value)}
                  placeholder="e.g. Rohini Kumar"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={personEmail}
                  onChange={(e) => setPersonEmail(e.target.value)}
                  placeholder="e.g. rohini@gmail.com"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isAddingPerson}
              className="w-full py-2.5 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isAddingPerson ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Scanning Previous Mails &amp; Adding Subscriptions...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-pink-300" />
                  <span>Add Person &amp; Auto-Scan Previous Mails</span>
                </>
              )}
            </button>
          </form>
        </div>
      </KinCard>

      {/* Connected Persons & Mailboxes List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[16px] font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-600" />
            <span>Connected Person Mailboxes ({members.length})</span>
          </h3>
          <span className="text-xs text-slate-500">
            Click &quot;Scan Previous Mails&quot; to re-check any person&apos;s receipts
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {members.map((member) => (
            <KinCard key={member.id} className="p-4 bg-white hover:border-indigo-200 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shadow-2xs ${member.avatarColor}`}>
                      {member.avatarInitials}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-[14px]">
                        {member.name}
                      </h4>
                      <p className="text-[11px] text-slate-500 truncate max-w-[180px]">
                        {member.email || "No email"}
                      </p>
                    </div>
                  </div>

                  <KinBadge variant={member.role === "Owner" ? "owner" : "member"}>
                    {member.role}
                  </KinBadge>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">
                    Plans: <strong className="text-slate-800">{member.planCount || 0}</strong>
                  </span>
                  <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/80">
                    {member.inboxStatus}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleScanMemberClick(member)}
                disabled={scanningMemberId === member.id}
                className="mt-3 w-full py-1.5 bg-slate-50 hover:bg-indigo-50 text-indigo-700 border border-slate-200 hover:border-indigo-200 rounded-xl text-[11px] font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${scanningMemberId === member.id ? "animate-spin text-indigo-600" : "text-slate-500"}`} />
                <span>{scanningMemberId === member.id ? "Scanning..." : "Scan Previous Mails Now"}</span>
              </button>
            </KinCard>
          ))}
        </div>
      </div>

      {/* Quick Paste Receipt / Message Parser */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center font-bold shrink-0 shadow-sm">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-[15px] font-bold text-slate-900">
              Receipt &amp; SMS Parser with Calendar Math
            </div>
            <div className="text-[13px] text-slate-500 mt-0.5">
              Paste recharge SMS, invoice text, or billing alert to verify exact calendar renewal date calculation.
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowQuickPaste((prev) => !prev)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition cursor-pointer shadow-2xs shrink-0"
        >
          <Zap className="w-3.5 h-3.5 text-indigo-600" />
          <span>{showQuickPaste ? "Hide Parser Drawer" : "Open Receipt Parser"}</span>
        </button>
      </div>

      {/* Quick Paste Drawer */}
      {showQuickPaste && (
        <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 rounded-3xl p-5 text-white shadow-xl shadow-indigo-950/20 border border-white/10 space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold tracking-widest text-cyan-300 uppercase flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-pink-400" />
              Receipt Validity Calculator (28d, 30d, 56d, 86d, 990d)
            </span>
            <button
              type="button"
              onClick={() => setShowQuickPaste(false)}
              className="text-xs text-indigo-200 hover:text-white cursor-pointer font-bold"
            >
              Close ✕
            </button>
          </div>

          <textarea
            rows={2}
            value={instantMessage}
            onChange={(e) => handleMessageChange(e.target.value)}
            placeholder="Paste any receipt, invoice, or recharge SMS (e.g. 'Recharge of ₹349 on 12-Oct-2026. Validity 28days.')..."
            className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-2xl text-xs text-white placeholder-indigo-200/60 focus:outline-none focus:bg-white/15 focus:ring-2 focus:ring-cyan-400/50 font-mono transition"
          />

          {/* Quick 1-Click Test Receipts for Requested Validity Terms */}
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span className="text-[10px] text-indigo-200 font-bold uppercase tracking-wider mr-1">
              Test Terms:
            </span>
            <button
              type="button"
              onClick={() => handleLoadSample("myjio")}
              className="px-2.5 py-1 bg-white/15 hover:bg-white/25 border border-white/20 text-white rounded-lg text-[11px] font-semibold transition cursor-pointer"
            >
              📱 28 Days (Jio ₹349)
            </button>
            <button
              type="button"
              onClick={() => handleLoadSample("jio_sunnxt")}
              className="px-2.5 py-1 bg-white/15 hover:bg-white/25 border border-white/20 text-white rounded-lg text-[11px] font-semibold transition cursor-pointer"
            >
              ☀️ 56 Days (Sun NXT ₹549)
            </button>
            <button
              type="button"
              onClick={() => {
                const text = "Vi Unlimited Recharge of ₹859 successful on 01-Oct-2026. 86days validity with 2GB/Day.";
                setInstantMessage(text);
                setParsedInstant(parseSubscriptionMessage(text));
              }}
              className="px-2.5 py-1 bg-white/15 hover:bg-white/25 border border-white/20 text-white rounded-lg text-[11px] font-semibold transition cursor-pointer"
            >
              📶 86 Days (Vi/Airtel ₹859)
            </button>
            <button
              type="button"
              onClick={() => {
                const text = "Enterprise Cloud license order ₹8,999 on 01-Jan-2026. Pack validity 990 days.";
                setInstantMessage(text);
                setParsedInstant(parseSubscriptionMessage(text));
              }}
              className="px-2.5 py-1 bg-white/15 hover:bg-white/25 border border-white/20 text-white rounded-lg text-[11px] font-semibold transition cursor-pointer"
            >
              🚀 990 Days (Enterprise ₹8999)
            </button>
            <button
              type="button"
              onClick={() => handleLoadSample("zee5")}
              className="px-2.5 py-1 bg-white/15 hover:bg-white/25 border border-white/20 text-white rounded-lg text-[11px] font-semibold transition cursor-pointer"
            >
              📺 92 Days (ZEE5 ₹399)
            </button>
            <button
              type="button"
              onClick={() => {
                const text = "Netflix Standard subscription invoice. Billed on 03-Oct-2026. 30 days valid. ₹649.";
                setInstantMessage(text);
                setParsedInstant(parseSubscriptionMessage(text));
              }}
              className="px-2.5 py-1 bg-white/15 hover:bg-white/25 border border-white/20 text-white rounded-lg text-[11px] font-semibold transition cursor-pointer"
            >
              🎬 30 Days (Netflix ₹649)
            </button>
          </div>

          {parsedInstant && (
            <div className="p-4 bg-white rounded-2xl text-slate-900 border border-indigo-100 shadow-lg space-y-3 animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <BrandLogo
                    name={parsedInstant.name}
                    iconUrl={parsedInstant.iconImage}
                    size="md"
                    rounded="rounded-2xl"
                  />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-black tracking-wider text-indigo-600 uppercase">
                        Auto-Detected Plan
                      </span>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded-full border border-emerald-200">
                        {parsedInstant.validityDays} Days Valid
                      </span>
                    </div>
                    <h4 className="text-base font-black text-slate-900 leading-tight">
                      {parsedInstant.name}
                    </h4>
                    <p className="text-xs text-slate-500">
                      {parsedInstant.planTier}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Amount
                  </span>
                  <span className="text-xl font-black text-slate-900 font-mono">
                    ₹{parsedInstant.cost.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>

              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-900 font-semibold">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Purchased: <strong>{formatDisplayDate(parsedInstant.startDate)}</strong> + {parsedInstant.validityDays} days validity
                  </span>
                </div>
                <span className="font-mono font-bold text-indigo-700">
                  Next Renewal: {formatDisplayDate(parsedInstant.nextBillingDate)}
                </span>
              </div>

              <button
                type="button"
                onClick={handleAddInstant}
                className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-bold rounded-xl shadow-md transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Add to Subscriptions Ledger &amp; Calendar</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Detected Subscriptions Table */}
      <KinCard className="p-0 overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/50">
          <div>
            <h3 className="text-[16px] font-bold text-slate-900">
              Auto-Detected Subscriptions &amp; Receipts
            </h3>
            <p className="text-[12px] text-slate-500">
              Scanned from connected mailboxes with calculated calendar renewal dates.
            </p>
          </div>
          <span className="text-[12px] font-bold bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full border border-indigo-200/80 w-fit">
            {detectedList.length} receipts scanned
          </span>
        </div>

        {detectedList.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3">
              <Mail className="w-6 h-6" />
            </div>
            <h4 className="text-[15px] font-bold text-slate-800">
              No dummy receipts
            </h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
              Use &quot;Add Person &amp; Auto-Scan Previous Mails&quot; above or click &quot;Sync Gmail Now&quot; to detect live subscription receipts.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-5">SUBSCRIPTION</th>
                  <th className="py-3.5 px-4">PURCHASE DATE</th>
                  <th className="py-3.5 px-4">CALCULATED RENEWAL</th>
                  <th className="py-3.5 px-4">CONFIDENCE</th>
                  <th className="py-3.5 px-5 text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80">
                {detectedList.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Subscription Name */}
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-3">
                        <BrandLogo
                          name={item.serviceName}
                          size="sm"
                          rounded="rounded-xl"
                        />
                        <div>
                          <div className="font-bold text-slate-900">
                            {item.serviceName}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            ₹{item.extractedCost} · {item.receiptName}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Purchase Date */}
                    <td className="py-3.5 px-4 text-slate-700 font-medium text-[12px]">
                      {item.receiptDate ? formatDisplayDate(item.receiptDate) : "—"}
                    </td>

                    {/* Renewal Date */}
                    <td className="py-3.5 px-4 text-slate-800 font-mono text-[12px] font-semibold">
                      {item.chargeDateNote}
                    </td>

                    {/* Match Confidence */}
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                        <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                        {item.confidence}
                      </span>
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-5 text-right">
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200/80">
                        Added to Page
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </KinCard>

      {/* Notices & Privacy Section */}
      <div className="space-y-2 text-[12px] text-slate-500 pt-2">
        <p className="text-slate-600">
          Calendar date math matches terms like 28d, 30d, 56d, 86d, and 990d from purchase dates without timezone drift.
        </p>
        <p className="text-slate-400 text-[11px] flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
          <span>
            Privacy Guarantee: message content is processed strictly to extract subscription line items and validity dates only. Personal conversations are never stored.
          </span>
        </p>
      </div>
    </div>
  );
}
