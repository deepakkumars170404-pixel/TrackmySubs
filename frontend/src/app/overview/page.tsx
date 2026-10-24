"use client";

import React from "react";
import { useRouter } from "next/navigation";
import DashboardShell from "@/components/DashboardShell";
import OverviewView from "@/components/OverviewView";
import { useHousehold } from "@/context/HouseholdContext";

export default function OverviewPage() {
  const router = useRouter();
  const {
    subscriptions,
    members,
    currentUser,
    setIsAddModalOpen,
    setIsInboxModalOpen,
    setSelectedSubscriptionForReminder,
  } = useHousehold();

  return (
    <DashboardShell currentTab="overview">
      <OverviewView
        subscriptions={subscriptions}
        members={members}
        currentUser={currentUser}
        onOpenAddModal={() => setIsAddModalOpen(true)}
        onOpenInboxModal={() => setIsInboxModalOpen(true)}
        onGoToCalendar={() => router.push("/calendar")}
        onSelectSubscriptionForReminder={(sub) =>
          setSelectedSubscriptionForReminder(sub)
        }
      />
    </DashboardShell>
  );
}
