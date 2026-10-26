"use client";

import React, { useState, useEffect } from "react";
import {
  UserPlus,
  Mail,
  ArrowRight,
  CheckCircle2,
  X,
  RefreshCw,
  Send,
  Check,
  Copy,
  Users,
  Clock,
  CreditCard,
  Sparkles,
  UserCheck,
  Trash2,
  Calendar,
  Volume2,
  ShieldCheck,
} from "lucide-react";
import { KinCard, KinButton, KinBadge } from "./ui/TrackmySubsUI";
import { FamilyMember, SharedPlanSummary } from "@/types/trackmysubs";
import { Subscription } from "@/lib/types";
import { getSubscriptionMonthlyCost, computeMemberStats } from "@/context/HouseholdContext";
import { BrandLogo } from "@/lib/logoHelper";
import { formatDisplayDate, getDaysRemaining } from "@/lib/dateCalculator";
import { playMobileNotificationSound } from "@/lib/soundNotification";

interface FamilyViewProps {
  members: FamilyMember[];
  sharedPlans: SharedPlanSummary[];
  subscriptions?: Subscription[];
  onOpenInviteModal: () => void;
  onSelectMemberPlans?: (memberName: string) => void;
  onConnectInbox?: (memberId: string, status: "Gmail connected" | "Outlook connected", email?: string) => Promise<void> | void;
  onRequestConnect?: (memberId: string, email: string, name: string, provider: "Gmail" | "Outlook") => Promise<{ success: boolean; delivered?: boolean; message: string; inviteUrl?: string }>;
  onAcceptInvite?: (memberId: string, email?: string, provider?: string, name?: string) => Promise<{ success: boolean; message: string }> | Promise<void> | void;
  onResendInvite?: (memberId: string, email: string, name: string) => Promise<{ success: boolean; message: string }>;
  onRemoveMember?: (memberId: string) => Promise<{ success: boolean; message: string }> | Promise<void> | void;
  acceptedBannerName?: string | null;
  onDismissAcceptedBanner?: () => void;
}

export default function FamilyView({
  members,
  sharedPlans,
  subscriptions = [],
  onOpenInviteModal,
  onSelectMemberPlans,
  onRequestConnect,
  onAcceptInvite,
  onResendInvite,
  onRemoveMember,
  acceptedBannerName,
  onDismissAcceptedBanner,
}: FamilyViewProps) {
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [connectingMember, setConnectingMember] = useState<FamilyMember | null>(null);
  const [connectEmail, setConnectEmail] = useState("");
  const [selectedProvider, setSelectedProvider] = useState<"Gmail" | "Outlook">("Gmail");
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [isSendingRequest, setIsSendingRequest] = useState(false);
  const [toastMessage, setToMessage] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<"all" | "connected" | "pending">("all");
  const [memberToDelete, setMemberToDelete] = useState<FamilyMember | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [viewingMemberPlans, setViewingMemberPlans] = useState<FamilyMember | null>(null);

  // Close modal on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setViewingMemberPlans(null);
      }
    };
    if (viewingMemberPlans) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [viewingMemberPlans]);

  // Computed household metrics
  const totalMembers = members.length;
  const connectedMembers = members.filter(
    (m) => m.inboxStatus === "Gmail connected" || m.inboxStatus === "Outlook connected"
  ).length;
  const pendingMembers = members.filter(
    (m) => m.inboxStatus === "Pending Acceptance"
  ).length;
  const notConnectedMembers = members.filter(
    (m) => m.inboxStatus === "Not connected"
  ).length;
  const getMemberPlans = (member: FamilyMember) => {
    if (!subscriptions || subscriptions.length === 0) return [];
    return subscriptions.filter(
      (s) =>
        s.status !== "canceled" &&
        (s.who_uses_it?.toLowerCase().includes(member.name.toLowerCase()) ||
          (member.role === "Owner" && (s.who_uses_it === "Everyone" || !s.who_uses_it)))
    );
  };

  const getMemberSpend = (member: FamilyMember) => {
    if (subscriptions && subscriptions.length > 0) {
      return computeMemberStats(member, subscriptions).monthlyShare;
    }
    return Number(member.monthlyShare ?? 0);
  };

  const getMemberPlanCount = (member: FamilyMember) => {
    if (subscriptions && subscriptions.length > 0) {
      return computeMemberStats(member, subscriptions).planCount;
    }
    return Number(member.planCount ?? 0);
  };

  const totalMonthlySpend = subscriptions && subscriptions.length > 0
    ? subscriptions.reduce((sum, s) => sum + getSubscriptionMonthlyCost(s), 0)
    : members.reduce((sum, m) => sum + (Number(m.monthlyShare) || 0), 0);

  const filteredMembers = members.filter((m) => {
    if (filterTab === "connected") {
      return m.inboxStatus === "Gmail connected" || m.inboxStatus === "Outlook connected";
    }
    if (filterTab === "pending") {
      return m.inboxStatus === "Pending Acceptance";
    }
    return true;
  });


  const showToast = (msg: string) => {
    setToMessage(msg);
    setTimeout(() => {
      setToMessage(null);
    }, 7000);
  };

  const handleConfirmDelete = async () => {
    if (!memberToDelete) return;
    setIsDeleting(true);
    try {
      if (onRemoveMember) {
        await onRemoveMember(memberToDelete.id);
      }
      showToast(`🗑️ ${memberToDelete.name} was removed from the team/home.`);
      setMemberToDelete(null);
    } catch {
      showToast(`Failed to remove member. Please try again.`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenConnect = (m: FamilyMember) => {
    setConnectingMember(m);
    setConnectEmail(m.email || "");
    setSelectedProvider("Gmail");
  };

  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!connectingMember || !connectEmail.trim()) return;

    const memberName = connectingMember.name;
    const memberId = connectingMember.id;
    const targetEmail = connectEmail.trim();
    setIsSendingRequest(true);

    try {
      if (onRequestConnect) {
        const res = await onRequestConnect(memberId, targetEmail, memberName, selectedProvider);
        if (res.delivered === false) {
          showToast(
            res.message || `⚠️ Resend Sandbox blocked direct delivery to ${targetEmail}. Copied 1-click invite link to your clipboard!`
          );
          if (res.inviteUrl) {
            navigator.clipboard.writeText(res.inviteUrl);
          }
        } else {
          showToast(res.message || `📨 Connection request email delivered to ${targetEmail}!`);
        }
      } else {
        showToast(`📨 Connection request processed for ${targetEmail}!`);
      }
      setConnectingMember(null);
    } catch {
      showToast(`Failed to send connection request. Please try again.`);
    } finally {
      setIsSendingRequest(false);
    }
  };

  const handleResend = async (member: FamilyMember) => {
    let email = member.email;
    if (!email) {
      const entered = window.prompt(`Enter email address to send the invitation for ${member.name}:`);
      if (!entered || !entered.includes("@")) return;
      email = entered.trim();
    }
    setResendingId(member.id);
    try {
      if (onResendInvite) {
        const res = await onResendInvite(member.id, email, member.name);
        showToast(res.message || `✉️ Request email resent to ${email}!`);
      } else {
        showToast(`✉️ Request email resent to ${email}!`);
      }
    } catch {
      showToast(`Failed to resend request. Please try again.`);
    } finally {
      setResendingId(null);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl border border-slate-700 text-sm font-semibold flex items-center gap-2.5 animate-in slide-in-from-top-4 max-w-lg">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="leading-snug">{toastMessage}</span>
        </div>
      )}

      {/* Acceptance Celebration Banner (when opened via invite email link) */}
      {acceptedBannerName && (
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 text-white p-5 rounded-2xl shadow-xl flex items-center justify-between animate-in slide-in-from-top-3">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-2xl shrink-0">
              🎉
            </div>
            <div>
              <h3 className="font-bold text-[16px] leading-tight text-white">
                Request Approved! Welcome, {acceptedBannerName}!
              </h3>
              <p className="text-[13px] text-emerald-100 mt-0.5">
                The connection request was successfully verified. Previous mailbox receipts have been scanned, and subscriptions with upcoming renewal dates are now added to your dashboard!
              </p>
            </div>
          </div>
          {onDismissAcceptedBanner && (
            <button
              onClick={onDismissAcceptedBanner}
              className="text-white/80 hover:text-white text-xs font-semibold px-3.5 py-1.5 bg-white/10 hover:bg-white/20 rounded-xl transition cursor-pointer"
            >
              Dismiss
            </button>
          )}
        </div>
      )}

      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="text-[10px] font-extrabold tracking-widest bg-gradient-to-r from-indigo-600 to-pink-600 bg-clip-text text-transparent uppercase mb-1">
            MEMBERS & TEAM
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[28px] font-black text-slate-900 tracking-tight leading-tight">
              Family members
            </h1>
            <span className="bg-indigo-50 text-indigo-700 border border-indigo-200/80 text-xs font-bold px-3 py-1 rounded-full shadow-2xs flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-indigo-600" />
              <span>{totalMembers} {totalMembers === 1 ? 'member' : 'members'} joined</span>
            </span>
          </div>
          <p className="text-[13px] text-slate-500 mt-1">
            Invite family members with a connection request email. Inboxes connect only after members accept.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <KinButton
            variant="primary"
            icon={<UserPlus className="w-4 h-4" />}
            onClick={onOpenInviteModal}
          >
            Add member
          </KinButton>
        </div>
      </div>

      {/* Household Overview Metrics Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Metric 1: Total Members Joined */}
        <KinCard className="p-4 bg-white hover:border-indigo-200 transition-all shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Total Members
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-[26px] font-black text-slate-900 leading-none">
              {totalMembers}
            </span>
            <span className="text-[12px] font-medium text-slate-500">
              joined
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            {connectedMembers} active · {pendingMembers} pending
          </p>
        </KinCard>

        {/* Metric 2: Connected Inboxes */}
        <KinCard className="p-4 bg-white hover:border-emerald-200 transition-all shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Connected
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-[26px] font-black text-emerald-600 leading-none">
              {connectedMembers}
            </span>
            <span className="text-[12px] font-medium text-slate-500">
              verified
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Auto-syncing bills &amp; receipts
          </p>
        </KinCard>

        {/* Metric 3: Pending Invites */}
        <KinCard className="p-4 bg-white hover:border-amber-200 transition-all shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Pending Invites
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-[26px] font-black text-amber-600 leading-none">
              {pendingMembers}
            </span>
            <span className="text-[12px] font-medium text-slate-500">
              awaiting
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Waiting for email acceptance
          </p>
        </KinCard>

        {/* Metric 4: Monthly Spend Share */}
        <KinCard className="p-4 bg-white hover:border-purple-200 transition-all shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Monthly Total
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-[22px] font-black text-slate-900 leading-none font-mono">
              ₹{totalMonthlySpend.toLocaleString("en-IN")}
            </span>
            <span className="text-[12px] font-medium text-slate-500">
              / mo
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Distributed across {sharedPlans.length} shared plans
          </p>
        </KinCard>
      </div>

      {/* Filter Tabs & Count */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3 pt-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setFilterTab("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              filterTab === "all"
                ? "bg-slate-900 text-white shadow-2xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All Members ({totalMembers})
          </button>
          <button
            onClick={() => setFilterTab("connected")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              filterTab === "connected"
                ? "bg-emerald-600 text-white shadow-2xs"
                : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/60"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Connected ({connectedMembers})
          </button>
          {pendingMembers > 0 && (
            <button
              onClick={() => setFilterTab("pending")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                filterTab === "pending"
                  ? "bg-amber-600 text-white shadow-2xs"
                  : "bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200/60"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              Pending Acceptance ({pendingMembers})
            </button>
          )}
        </div>

        <span className="text-xs text-slate-500 font-medium">
          Showing <strong>{filteredMembers.length}</strong> of <strong>{totalMembers}</strong> team & family members
        </span>
      </div>

      {/* Member Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filteredMembers.length === 0 && (
          <div className="col-span-1 md:col-span-2 text-center py-12 px-6 bg-slate-50/70 rounded-2xl border-2 border-dashed border-slate-200">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3 shadow-2xs">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-[15px] font-bold text-slate-900">No family members added yet</h3>
            <p className="text-[12px] text-slate-500 mt-1 max-w-sm mx-auto">
              You currently have 0 family members. Click &quot;Add member&quot; above to invite your first family member.
            </p>
            <button
              onClick={onOpenInviteModal}
              className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
            >
              + Add First Member
            </button>
          </div>
        )}
        {filteredMembers.map((member) => (
          <KinCard
            key={member.id}
            className="p-5 flex flex-col justify-between hover:border-indigo-500/30 transition-all hover:shadow-md"
          >
            <div>
              {/* Member Top Row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                  <div
                    className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm shadow-xs ${member.avatarColor}`}
                  >
                    {member.avatarInitials}
                  </div>
                  <div>
                    <div className="text-[16px] font-bold text-slate-900">
                      {member.name}
                    </div>
                    <div className="text-[12px] text-slate-500 flex flex-wrap items-center gap-1">
                      <span>{member.role} · {getMemberPlanCount(member)} plans</span>
                      {member.email && (
                        <span className="text-slate-400">· {member.email}</span>
                      )}
                    </div>
                  </div>
                </div>

                <KinBadge variant={member.role === "Owner" ? "owner" : "member"}>
                  {member.role}
                </KinBadge>
              </div>

              {/* Stats & Inbox Row */}
              <div className="grid grid-cols-2 gap-4 mt-5 pt-4 border-t border-slate-100">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    MONTHLY SHARE
                  </div>
                  <div className="text-[18px] font-black text-slate-900 mt-1 font-mono">
                    ₹{getMemberSpend(member).toLocaleString("en-IN")}{" "}
                    <span className="text-[12px] font-normal text-slate-500 font-sans">
                      / mo
                    </span>
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    INBOX STATUS
                  </div>
                  <div className="mt-1">
                    {member.inboxStatus === "Pending Acceptance" ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                          Pending Acceptance
                        </span>
                        <span className="text-[10px] text-slate-400 pl-0.5">
                          Awaiting recipient acceptance
                        </span>
                      </div>
                    ) : member.inboxStatus !== "Not connected" ? (
                      <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200/80">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                        {member.inboxStatus}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500 bg-slate-100/90 px-2.5 py-1 rounded-full border border-slate-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                        Not connected
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Actions Row */}
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[12px]">
              <div>
                {member.inboxStatus === "Pending Acceptance" ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                      <Clock className="w-3 h-3 text-amber-600 animate-pulse" />
                      <span>Awaiting email approval</span>
                    </span>

                    <button
                      onClick={async () => {
                        setApprovingId(member.id);
                        try {
                          if (onAcceptInvite) {
                            const res: any = await onAcceptInvite(member.id, member.email, 'Gmail', member.name);
                            showToast(res?.message || `🎉 ${member.name} approved! Scanned previous email receipts and added subscriptions.`);
                          }
                        } catch {
                          showToast('Error approving member.');
                        } finally {
                          setApprovingId(null);
                        }
                      }}
                      disabled={approvingId === member.id}
                      className="font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1 rounded-lg flex items-center gap-1 transition cursor-pointer text-[11px] shadow-xs disabled:opacity-50"
                      title="Approve invitation & scan previous email receipts immediately"
                    >
                      {approvingId === member.id ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <Sparkles className="w-3 h-3" />
                      )}
                      <span>{approvingId === member.id ? 'Scanning...' : 'Approve & Scan'}</span>
                    </button>

                    <button
                      onClick={() => {
                        const origin = typeof window !== "undefined" ? window.location.origin : "";
                        const query = `accept=${encodeURIComponent(member.id)}&email=${encodeURIComponent(member.email || "")}&name=${encodeURIComponent(member.name)}&provider=Gmail&action=approve`;
                        const fullUrl = `${origin}/family?${query}`;
                        navigator.clipboard.writeText(fullUrl);
                        setCopiedId(member.id);
                        setTimeout(() => setCopiedId(null), 2500);
                        showToast("Copied direct approval link to clipboard!");
                      }}
                      className="font-medium text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-2 py-1 rounded-lg flex items-center gap-1 transition cursor-pointer text-[11px]"
                      title="Copy invitation link to share via WhatsApp or chat"
                    >
                      {copiedId === member.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span className="text-emerald-700 font-semibold">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-slate-500" />
                          <span>Copy Link</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleResend(member)}
                      disabled={resendingId === member.id}
                      className="font-medium text-amber-800 hover:text-amber-950 bg-amber-50/80 hover:bg-amber-100 border border-amber-200/80 px-2 py-1 rounded-lg flex items-center gap-1 transition cursor-pointer disabled:opacity-50 text-[11px]"
                      title="Resend confirmation request email via Gmail SMTP"
                    >
                      {resendingId === member.id ? (
                        <RefreshCw className="w-3 h-3 animate-spin text-amber-600" />
                      ) : (
                        <Mail className="w-3 h-3 text-amber-600" />
                      )}
                      <span>Resend Email</span>
                    </button>
                  </div>
                ) : member.inboxStatus === "Not connected" ? (
                  <button
                    onClick={() => handleOpenConnect(member)}
                    className="font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5 transition cursor-pointer text-[11px] bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg border border-indigo-200/60"
                  >
                    <Mail className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Send invite email</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Connected &amp; Active
                    </span>
                    <button
                      onClick={async () => {
                        setApprovingId(member.id);
                        try {
                          if (onAcceptInvite) {
                            const res: any = await onAcceptInvite(member.id, member.email, 'Gmail', member.name);
                            showToast(res?.message || `📬 Re-scanned mailbox for ${member.name}! Subscriptions updated.`);
                          }
                        } catch {
                          showToast('Error scanning mailbox.');
                        } finally {
                          setApprovingId(null);
                        }
                      }}
                      disabled={approvingId === member.id}
                      className="text-[10px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/70 px-2 py-0.5 rounded-md flex items-center gap-1 transition cursor-pointer disabled:opacity-50"
                      title="Re-scan mailbox for updated receipts and renewal dates"
                    >
                      <RefreshCw className={`w-2.5 h-2.5 ${approvingId === member.id ? 'animate-spin' : ''}`} />
                      <span>{approvingId === member.id ? 'Scanning...' : 'Re-scan'}</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={() => {
                    setSelectedMember(member.name);
                    setViewingMemberPlans(member);
                    if (onSelectMemberPlans) onSelectMemberPlans(member.name);
                  }}
                  className="font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition cursor-pointer"
                  title={`View ${member.name}'s plans in popup`}
                >
                  <span>View plans</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                {member.role !== "Owner" && (
                  <button
                    onClick={() => setMemberToDelete(member)}
                    className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition cursor-pointer"
                    title={`Remove ${member.name} from household`}
                    aria-label={`Remove ${member.name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </KinCard>
        ))}
      </div>

      {/* Shared Plans Section */}
      <div className="pt-2">
        <div className="mb-4">
          <h2 className="text-[18px] font-bold text-slate-900">
            Shared plans
          </h2>
          <p className="text-[13px] text-slate-500">
            Subscriptions utilized by more than one family member
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sharedPlans.map((plan) => (
            <KinCard key={plan.id} className="p-4 bg-slate-50/70 border-slate-200 hover:bg-white hover:border-indigo-500/30 transition-all">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs shadow-2xs ${plan.iconBgColor}`}
                  >
                    {plan.iconInitial}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-[14px]">
                      {plan.name}
                    </h3>
                    <p className="text-[11px] text-slate-500">{plan.tier}</p>
                  </div>
                </div>
                <span className="text-[14px] font-black text-indigo-900 font-mono">
                  ₹{plan.monthlyCost}/mo
                </span>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-200/80 flex items-center justify-between text-[11px] text-slate-500">
                <span>
                  Used by: <strong className="text-slate-800 font-semibold">{plan.assignedTo}</strong>
                </span>
                <span className="bg-white border border-slate-200 px-2 py-0.5 rounded-full text-indigo-700 font-semibold shadow-2xs">
                  Shared
                </span>
              </div>
            </KinCard>
          ))}
        </div>
      </div>

      {/* Send Connection Request Modal */}
      {connectingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95">
            <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100 bg-slate-50/50">
              <div>
                <div className="text-[10px] font-extrabold text-indigo-600 uppercase tracking-widest">
                  CONNECTION REQUEST
                </div>
                <h2 className="text-[18px] font-bold text-slate-900">
                  Request Connection: {connectingMember.name}
                </h2>
              </div>
              <button
                onClick={() => setConnectingMember(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendRequest} className="p-6 space-y-4">
              <p className="text-[13px] text-slate-600 leading-relaxed">
                Enter the email address for <strong>{connectingMember.name}</strong>. We will send an official connection request email. Their inbox will <strong>remain disconnected until they click Accept</strong>.
              </p>

              <div>
                <label className="block text-[12px] font-bold text-slate-700 mb-1">
                  Recipient Email Address
                </label>
                <input
                  type="email"
                  required
                  value={connectEmail}
                  onChange={(e) => setConnectEmail(e.target.value)}
                  placeholder="e.g. member@gmail.com"
                  className="w-full px-3.5 py-2.5 text-[13px] bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                />
              </div>

              <div>
                <label className="block text-[12px] font-bold text-slate-700 mb-1">
                  Mailbox Provider
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setSelectedProvider("Gmail")}
                    className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition cursor-pointer ${
                      selectedProvider === "Gmail"
                        ? "border-indigo-600 bg-indigo-50/80 text-indigo-900 ring-1 ring-indigo-500/20"
                        : "border-slate-200 hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <div className="w-7 h-7 rounded-lg bg-red-100 text-red-600 font-bold flex items-center justify-center text-xs shrink-0">
                      G
                    </div>
                    <div>
                      <div className="text-[12px] font-bold">Google / Gmail</div>
                      <div className="text-[10px] text-slate-500">@gmail.com</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedProvider("Outlook")}
                    className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition cursor-pointer ${
                      selectedProvider === "Outlook"
                        ? "border-blue-600 bg-blue-50/80 text-blue-900 ring-1 ring-blue-500/20"
                        : "border-slate-200 hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 font-bold flex items-center justify-center text-xs shrink-0">
                      O
                    </div>
                    <div>
                      <div className="text-[12px] font-bold">MS Outlook</div>
                      <div className="text-[10px] text-slate-500">Office 365</div>
                    </div>
                  </button>
                </div>
              </div>

              <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200 text-[11px] text-amber-800 leading-relaxed">
                ⏳ <strong>Pending Acceptance Policy:</strong> {connectingMember.name}&apos;s status will be set to &quot;Pending Acceptance&quot;. Inboxes will not connect until {connectingMember.name} verifies and accepts the email request.
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setConnectingMember(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSendingRequest || !connectEmail.trim()}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 rounded-xl shadow-sm transition disabled:opacity-50 cursor-pointer flex items-center gap-2"
                >
                  {isSendingRequest ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending Request...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Send Request Email</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Remove Member Modal */}
      {memberToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-3 border border-red-100">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 text-center">
              Remove {memberToDelete.name}?
            </h3>
            <p className="text-xs text-slate-500 text-center mt-2 leading-relaxed">
              Are you sure you want to remove <strong>{memberToDelete.name}</strong> from your team or home? They will be unlinked from shared subscriptions and their connected inbox will be disconnected.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setMemberToDelete(null)}
                disabled={isDeleting}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                {isDeleting ? "Removing..." : "Remove Member"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Member Plans Popup Modal - Displays ONLY this person's plans without navigating or disturbing the page */}
      {viewingMemberPlans && (() => {
        const stats = computeMemberStats(viewingMemberPlans, subscriptions);
        const memberPlans = stats.plans;
        const memberSpend = stats.monthlyShare;

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
            onClick={() => setViewingMemberPlans(null)}
          >
            <div
              className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[88vh]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3.5">
                  <div
                    className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm shadow-xs ${viewingMemberPlans.avatarColor}`}
                  >
                    {viewingMemberPlans.avatarInitials}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-[18px] font-bold text-slate-900 leading-tight">
                        {viewingMemberPlans.name}&apos;s Subscriptions
                      </h3>
                      <KinBadge variant={viewingMemberPlans.role === "Owner" ? "owner" : "member"}>
                        {viewingMemberPlans.role}
                      </KinBadge>
                    </div>
                    <p className="text-[12px] text-slate-500 mt-0.5">
                      {viewingMemberPlans.email || "Team/family member"} · Showing only {viewingMemberPlans.name}&apos;s plans
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setViewingMemberPlans(null)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Stats Bar */}
              <div className="px-6 py-3 bg-indigo-50/40 border-b border-indigo-100/60 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                      Assigned Plans
                    </span>
                    <span className="text-sm font-black text-slate-900">
                      {memberPlans.length} {memberPlans.length === 1 ? "plan" : "plans"}
                    </span>
                  </div>
                  <div className="h-6 w-px bg-slate-200" />
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                      Monthly Share
                    </span>
                    <span className="text-sm font-black text-indigo-700 font-mono">
                      ₹{memberSpend.toLocaleString("en-IN")}/mo
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => playMobileNotificationSound()}
                  className="px-2.5 py-1 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200/80 rounded-lg text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  title="Test Renewal Day Sound"
                >
                  <Volume2 className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Test Mobile Sound 🔊</span>
                </button>
              </div>

              {/* Plans Content Body */}
              <div className="p-6 overflow-y-auto space-y-3.5 flex-1">
                {memberPlans.length === 0 ? (
                  <div className="text-center py-12 px-4">
                    <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                      <CreditCard className="w-7 h-7" />
                    </div>
                    <h4 className="text-[16px] font-bold text-slate-800">
                      No active subscriptions for {viewingMemberPlans.name}
                    </h4>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
                      Mailbox ({viewingMemberPlans.email || "email"}) scanned: 0 subscription receipts found. No fake or unconfirmed subscriptions are added.
                    </p>
                  </div>
                ) : (
                  memberPlans.map((sub) => {
                    const daysRemaining = sub.next_billing_date ? getDaysRemaining(sub.next_billing_date) : null;
                    const isDueSoon = daysRemaining !== null && daysRemaining <= 3 && daysRemaining >= 0;
                    const isToday = daysRemaining === 0;

                    return (
                      <div
                        key={sub.id}
                        className="p-4 rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-xs transition bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        {/* Service Logo & Info */}
                        <div className="flex items-center gap-3.5 min-w-0">
                          <BrandLogo
                            name={sub.name}
                            iconUrl={sub.icon_image}
                            size="md"
                            rounded="rounded-xl"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-slate-900 text-[15px] truncate">
                                {sub.name}
                              </h4>
                              {sub.who_uses_it && (
                                <span className="text-[10px] font-semibold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-100">
                                  {sub.who_uses_it}
                                </span>
                              )}
                            </div>
                            <div className="text-[12px] text-slate-500 mt-0.5 flex flex-wrap items-center gap-2">
                              <span>{sub.plan_tier || `${sub.billing_cycle} plan`}</span>
                              {sub.payment_method && (
                                <>
                                  <span className="text-slate-300">·</span>
                                  <span className="text-slate-400">{sub.payment_method}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Cost & Next Renewal */}
                        <div className="flex sm:flex-col items-end justify-between sm:justify-center gap-1 sm:text-right shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                          <div className="font-mono font-black text-slate-900 text-[16px]">
                            ₹{(sub.monthly_cost || sub.cost).toLocaleString("en-IN")}
                            <span className="font-sans text-[11px] font-normal text-slate-400 ml-1">
                              / mo
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            <span className="text-[11px] font-semibold text-slate-600">
                              {sub.next_billing_date ? formatDisplayDate(sub.next_billing_date) : "—"}
                            </span>
                            {daysRemaining !== null && (
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                  isToday
                                    ? "bg-rose-50 text-rose-700 border-rose-200 animate-pulse"
                                    : isDueSoon
                                    ? "bg-amber-50 text-amber-700 border-amber-200"
                                    : "bg-slate-100 text-slate-600 border-slate-200"
                                }`}
                              >
                                {isToday ? "Due Today!" : `in ${daysRemaining}d`}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
                <span className="text-[12px] text-slate-500">
                  {viewingMemberPlans.name}&apos;s Total: <strong className="text-slate-900 font-mono font-bold">₹{memberSpend.toLocaleString("en-IN")}</strong>/month
                </span>

                <button
                  type="button"
                  onClick={() => setViewingMemberPlans(null)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
