"use client";

import React, { useState } from "react";
import { X, Sparkles, RefreshCw, Lock, Trash2, CheckCircle2 } from "lucide-react";
import { ConnectedInbox } from "@/types/trackmysubs";
import { useHousehold } from "@/context/HouseholdContext";

interface ConnectInboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect?: (inbox: ConnectedInbox) => void;
}

export default function ConnectInboxModal({
  isOpen,
  onClose,
  onConnect,
}: ConnectInboxModalProps) {
  const { inboxes, members, setInboxes } = useHousehold();

  const [provider, setProvider] = useState<"Gmail" | "Outlook" | "Yahoo">("Gmail");
  const [email, setEmail] = useState("");
  const [member, setMember] = useState(members[0]?.name || "Account Owner");
  const [consentChecked, setConsentChecked] = useState(true);
  const [activeTab, setActiveTab] = useState<"add" | "connected">("add");
  const [isScanning, setIsScanning] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !consentChecked) return;

    const newInbox: ConnectedInbox = {
      id: `inbox-${Date.now()}`,
      provider,
      email: email.trim(),
      connectedBy: member,
      lastChecked: "Just now",
      status: "Connected",
      historyDaysScanned: 30,
    };

    if (onConnect) {
      onConnect(newInbox);
    }
    setStatusMessage(`✅ Connected ${email.trim()} for ${member}!`);
    setTimeout(() => {
      setStatusMessage(null);
      setEmail("");
      setActiveTab("connected");
    }, 1200);
  };

  const handleScanNow = () => {
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      alert("Receipt sync complete! Inboxes scanned for Netflix, Spotify, Sun NXT, ZEE5 receipts.");
    }, 1200);
  };

  const handleRemoveInbox = (inboxId: string) => {
    setInboxes((prev) => prev.filter((i) => i.id !== inboxId));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden p-6 sm:p-7 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <span className="text-[10px] font-bold tracking-wider text-indigo-600 uppercase">
              Automatic Tracking
            </span>
            <h3 className="text-[20px] font-bold text-slate-900 leading-tight">
              Connect billing inboxes
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Message */}
        {statusMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Tab switch between Add Inbox and Connected Inboxes */}
        <div className="flex border-b border-slate-100 text-[13px] font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab("add")}
            className={`pb-2.5 px-3 border-b-2 transition cursor-pointer ${
              activeTab === "add"
                ? "border-indigo-600 text-indigo-600 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Connect New Inbox
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("connected")}
            className={`pb-2.5 px-3 border-b-2 transition cursor-pointer ${
              activeTab === "connected"
                ? "border-indigo-600 text-indigo-600 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Active Inboxes ({inboxes.length})
          </button>
        </div>

        {activeTab === "add" ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[12px] font-semibold text-slate-700 mb-2">
                Select Email Provider
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                {(["Gmail", "Outlook", "Yahoo"] as const).map((p) => (
                  <button
                    type="button"
                    key={p}
                    onClick={() => setProvider(p)}
                    className={`p-3 rounded-xl border text-center text-[13px] font-semibold transition-all cursor-pointer ${
                      provider === p
                        ? "border-indigo-600 bg-indigo-50/80 text-indigo-900 shadow-xs ring-1 ring-indigo-500/20"
                        : "border-slate-200 hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-slate-700 mb-1">
                Email Address to Connect
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. yourname@gmail.com"
                className="w-full px-3.5 py-2.5 text-[13px] bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
              />
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-slate-700 mb-1">
                Belongs to Family Member
              </label>
              <select
                value={member}
                onChange={(e) => setMember(e.target.value)}
                className="w-full px-3.5 py-2.5 text-[13px] bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition cursor-pointer"
              >
                {members.map((m) => (
                  <option key={m.id} value={m.name}>
                    {m.name} ({m.role})
                  </option>
                ))}
              </select>
            </div>

            {/* Privacy Consent Box */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-2">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consentChecked}
                  onChange={(e) => setConsentChecked(e.target.checked)}
                  className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-[12px] text-slate-700 leading-tight">
                  I give consent for TrackmySubs to scan billing receipts and subscription confirmations only. Personal conversations will never be accessed or stored.
                </span>
              </label>
              <div className="text-[11px] text-slate-500 flex items-center gap-1.5 pl-6">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                <span>We never ask for passwords or one-time passcodes.</span>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!consentChecked || !email.trim()}
                className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 rounded-xl shadow-sm transition disabled:opacity-50 cursor-pointer"
              >
                Connect &amp; Scan
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <p className="text-[13px] text-slate-600">
              Connected inboxes are actively monitored for renewal receipts, charges, and plan changes.
            </p>

            {/* Connected Accounts List */}
            <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
              {inboxes.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
                  No billing inboxes connected yet. Click &quot;Connect New Inbox&quot; to link one.
                </div>
              ) : (
                inboxes.map((inbox) => (
                  <div
                    key={inbox.id}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-lg font-bold flex items-center justify-center text-sm shadow-2xs ${
                          inbox.provider === "Gmail"
                            ? "bg-red-100 text-red-600"
                            : inbox.provider === "Outlook"
                            ? "bg-blue-100 text-blue-600"
                            : "bg-purple-100 text-purple-600"
                        }`}
                      >
                        {inbox.provider.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-[13px] font-semibold text-slate-900">
                            {inbox.provider} · {inbox.email}
                          </h4>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200">
                            {inbox.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Connected by {inbox.connectedBy} · {inbox.lastChecked} · Last {inbox.historyDaysScanned || 30} days scanned
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveInbox(inbox.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                      title="Disconnect inbox"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Scan Status */}
            <div className="p-3.5 rounded-xl bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 border border-indigo-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span className="text-[12px] font-semibold text-indigo-900">
                  Receipt scanning active for {inboxes.length} inboxes
                </span>
              </div>
              <button
                type="button"
                onClick={handleScanNow}
                disabled={isScanning}
                className="flex items-center gap-1.5 text-[12px] font-bold text-indigo-700 hover:text-indigo-900 transition px-3 py-1.5 rounded-lg bg-white/90 shadow-2xs hover:bg-white cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? "animate-spin" : ""}`} />
                <span>{isScanning ? "Scanning..." : "Scan now"}</span>
              </button>
            </div>

            {/* Privacy Promise */}
            <div className="text-[11px] text-slate-500 space-y-1 pt-2 border-t border-slate-100">
              <p className="font-semibold text-slate-700">Privacy by design:</p>
              <p>• TrackmySubs only searches for billing receipts and subscription confirmations.</p>
              <p>• We never read personal messages, passwords, or one-time codes.</p>
              <p>• Each family member connects their own inbox with individual consent.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
