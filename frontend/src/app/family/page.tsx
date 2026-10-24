"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import DashboardShell from "@/components/DashboardShell";
import FamilyView from "@/components/FamilyView";
import { useHousehold, getBackendUrl } from "@/context/HouseholdContext";

function FamilyPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const {
    subscriptions,
    members,
    sharedPlans,
    setIsInviteModalOpen,
    setSearchQuery,
    handleConnectMemberInbox,
    handleResendMemberInvite,
    handleRequestMemberConnect,
    handleAcceptMemberInvite,
    handleRemoveMember,
  } = useHousehold();

  const [acceptedBannerName, setAcceptedBannerName] = useState<string | null>(null);

  // Read search parameters reliably across SSR and client
  const acceptId = searchParams.get("accept");
  const acceptName = searchParams.get("name") || "";
  const acceptEmail = searchParams.get("email") || "";
  const provider = searchParams.get("provider") || "Gmail";

  // Guard against re-triggering acceptance in an infinite render loop
  const hasAcceptedRef = useRef<string | null>(null);

  // Background sync for acceptance
  useEffect(() => {
    if (!acceptId || hasAcceptedRef.current === acceptId) return;
    hasAcceptedRef.current = acceptId;

    if (handleAcceptMemberInvite) {
      handleAcceptMemberInvite(acceptId, acceptEmail || undefined, provider, acceptName || undefined);
    } else if (handleConnectMemberInbox) {
      handleConnectMemberInbox(
        acceptId,
        provider.toLowerCase().includes("outlook") ? "Outlook connected" : "Gmail connected",
        acceptEmail || undefined
      );
    }

    setAcceptedBannerName(acceptName || acceptEmail || "Family Member");
  }, [acceptId, acceptName, acceptEmail, provider, handleAcceptMemberInvite, handleConnectMemberInbox]);

  return (
    <DashboardShell currentTab="family">
      <FamilyView
        members={members}
        sharedPlans={sharedPlans}
        subscriptions={subscriptions}
        onOpenInviteModal={() => setIsInviteModalOpen(true)}
        onSelectMemberPlans={(memberName) => {
          setSearchQuery(memberName);
          // Do not navigate away: FamilyView opens an in-page popup modal displaying only this member's plans
        }}
        onConnectInbox={handleConnectMemberInbox}
        onRequestConnect={handleRequestMemberConnect}
        onAcceptInvite={handleAcceptMemberInvite}
        onResendInvite={handleResendMemberInvite}
        onRemoveMember={handleRemoveMember}
        acceptedBannerName={acceptedBannerName}
        onDismissAcceptedBanner={() => setAcceptedBannerName(null)}
      />
    </DashboardShell>
  );
}

export default function FamilyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
            <span className="text-xs text-slate-500 font-semibold">Loading household...</span>
          </div>
        </div>
      }
    >
      <FamilyPageContent />
    </Suspense>
  );
}
