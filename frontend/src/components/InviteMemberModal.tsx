"use client";

import React, { useState } from "react";
import { X, UserPlus, Users, Mail, Shield, Send, Key, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { KinButton } from "./ui/TrackmySubsUI";
import { FamilyMember } from "@/types/trackmysubs";

interface InviteMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInvite: (member: FamilyMember) => Promise<{ success: boolean; delivered?: boolean; message: string }> | void;
  onJoinHousehold?: (inviteCode: string, displayName: string) => Promise<{ success: boolean; message: string }>;
}

export default function InviteMemberModal({
  isOpen,
  onClose,
  onInvite,
  onJoinHousehold,
}: InviteMemberModalProps) {
  const [activeTab, setActiveTab] = useState<"invite" | "join">("invite");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"Member" | "Owner">("Member");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitFeedback, setSubmitFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Join via code form state
  const [joinCode, setJoinCode] = useState("");
  const [joinName, setJoinName] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [joinFeedback, setJoinFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    const initials = name
      .trim()
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

    const targetEmail = email.trim();
    setIsSubmitting(true);
    setSubmitFeedback(null);

    const newMember: FamilyMember = {
      id: `mem-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: name.trim(),
      role,
      avatarInitials: initials || "FM",
      avatarColor: "bg-gradient-to-tr from-indigo-600 via-indigo-700 to-purple-600 text-white shadow-sm",
      planCount: 0,
      monthlyShare: 0,
      inboxStatus: "Pending Acceptance",
      email: targetEmail,
      status: "invited",
      lastChecked: "Awaiting recipient approval",
    };

    try {
      const res = await onInvite(newMember);
      if (res && res.delivered === false) {
        setSubmitFeedback({
          type: "error",
          text: res.message || "Member added, but email delivery had an issue."
        });
        setTimeout(() => {
          onClose();
          setName("");
          setEmail("");
          setSubmitFeedback(null);
        }, 3000);
      } else {
        setSubmitFeedback({
          type: "success",
          text: `📧 Confirmation request email delivered to ${targetEmail}! Status is Pending Acceptance until approved.`
        });
        setTimeout(() => {
          onClose();
          setName("");
          setEmail("");
          setSubmitFeedback(null);
        }, 1800);
      }
    } catch {
      onClose();
      setName("");
      setEmail("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim() || !joinName.trim() || !onJoinHousehold) return;
    setIsJoining(true);
    setJoinFeedback(null);
    try {
      const res = await onJoinHousehold(joinCode.trim(), joinName.trim());
      if (res.success) {
        setJoinFeedback({ type: "success", text: res.message || "Joined household successfully!" });
        setTimeout(() => {
          onClose();
          setJoinCode("");
          setJoinName("");
          setJoinFeedback(null);
        }, 1500);
      } else {
        setJoinFeedback({ type: "error", text: res.message || "Could not join household with this code." });
      }
    } catch {
      setJoinFeedback({ type: "error", text: "Error joining household." });
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100">
          <div>
            <div className="text-[10px] font-extrabold text-indigo-600 uppercase tracking-widest">
              YOUR HOUSEHOLD
            </div>
            <h2 className="text-[18px] font-bold text-slate-900">
              {activeTab === "invite" ? "Add family member" : "Join with Invite Code"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-100 bg-slate-50/60 p-1.5 gap-1.5 mx-6 mt-4 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab("invite")}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === "invite"
                ? "bg-white text-indigo-900 shadow-xs"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add / Invite Member</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("join")}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === "join"
                ? "bg-white text-indigo-900 shadow-xs"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>Join via Code</span>
          </button>
        </div>

        {activeTab === "invite" ? (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-[12px] font-bold text-slate-700 mb-1">
                Member Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Rohini Kumar"
                className="w-full px-3.5 py-2.5 text-[13px] bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
              />
            </div>

            <div>
              <label className="block text-[12px] font-bold text-slate-700 mb-1">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. member@gmail.com"
                className="w-full px-3.5 py-2.5 text-[13px] bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                <span className="text-indigo-600 font-semibold flex items-center gap-1">
                  <Send className="w-3 h-3" />
                  A confirmation request email is sent immediately via Gmail SMTP. Status remains Pending until accepted.
                </span>
              </p>
            </div>

            <div>
              <label className="block text-[12px] font-bold text-slate-700 mb-1">
                Household Role
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setRole("Member")}
                  className={`p-3 rounded-xl border text-center text-[13px] font-semibold transition-all cursor-pointer ${
                    role === "Member"
                      ? "border-indigo-600 bg-indigo-50/80 text-indigo-900 shadow-xs ring-1 ring-indigo-500/20"
                      : "border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  Member
                </button>
                <button
                  type="button"
                  onClick={() => setRole("Owner")}
                  className={`p-3 rounded-xl border text-center text-[13px] font-semibold transition-all cursor-pointer ${
                    role === "Owner"
                      ? "border-indigo-600 bg-indigo-50/80 text-indigo-900 shadow-xs ring-1 ring-indigo-500/20"
                      : "border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  Co-Owner
                </button>
              </div>
            </div>

            {submitFeedback && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                  submitFeedback.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : "bg-red-50 text-red-800 border-red-200"
                }`}
              >
                {submitFeedback.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                )}
                <span>{submitFeedback.text}</span>
              </div>
            )}

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[12px] text-slate-500 leading-relaxed">
              Family members can view shared subscriptions and connect their inboxes to automatically sync shared receipts, subscriptions, and renewal dates.
            </div>

            <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
              <KinButton type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </KinButton>
              <KinButton
                type="submit"
                variant="primary"
                disabled={isSubmitting}
                icon={isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              >
                {isSubmitting ? "Sending Confirmation Email..." : "Add & Send Request Email"}
              </KinButton>
            </div>
          </form>
        ) : (
          <form onSubmit={handleJoinSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-[12px] font-bold text-slate-700 mb-1">
                Household Invite Code (UUID) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="e.g. 7a39acb9-9f08-42a0-863c-3f974abebd81"
                className="w-full px-3.5 py-2.5 text-[13px] font-mono bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Paste the invite code shared by the household owner.
              </p>
            </div>

            <div>
              <label className="block text-[12px] font-bold text-slate-700 mb-1">
                Your Display Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={joinName}
                onChange={(e) => setJoinName(e.target.value)}
                placeholder="e.g. Alex"
                className="w-full px-3.5 py-2.5 text-[13px] bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
              />
            </div>

            {joinFeedback && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                  joinFeedback.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : "bg-red-50 text-red-800 border-red-200"
                }`}
              >
                {joinFeedback.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                )}
                <span>{joinFeedback.text}</span>
              </div>
            )}

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[12px] text-slate-500 leading-relaxed">
              Joining a household links your subscriptions and family shares with this household using backend RLS policies.
            </div>

            <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
              <KinButton type="button" variant="secondary" onClick={onClose}>
                Cancel
              </KinButton>
              <KinButton
                type="submit"
                variant="primary"
                disabled={isJoining}
                icon={isJoining ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
              >
                {isJoining ? "Joining..." : "Join Household"}
              </KinButton>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
