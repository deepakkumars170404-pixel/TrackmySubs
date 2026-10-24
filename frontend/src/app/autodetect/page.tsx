"use client";

import React from "react";
import DashboardShell from "@/components/DashboardShell";
import AutoDetectView from "@/components/AutoDetectView";
import { useHousehold } from "@/context/HouseholdContext";

export default function AutoDetectPage() {
  const {
    inboxes,
    detectedList,
    members,
    setIsInboxModalOpen,
    setReviewingMatch,
    handlePreviewScan,
    handleAddSubscription,
    handleAutoDetectAddPerson,
    handleScanMemberMailbox,
  } = useHousehold();

  return (
    <DashboardShell currentTab="autodetect">
      <AutoDetectView
        inboxes={inboxes}
        detectedList={detectedList}
        members={members}
        onOpenInboxModal={() => setIsInboxModalOpen(true)}
        onReviewMatch={setReviewingMatch}
        onPreviewScan={handlePreviewScan}
        onAddSubscription={handleAddSubscription}
        onAutoDetectAddPerson={handleAutoDetectAddPerson}
        onScanMemberMailbox={handleScanMemberMailbox}
      />
    </DashboardShell>
  );
}
