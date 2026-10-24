"use client";

import React from "react";
import DashboardShell from "@/components/DashboardShell";
import SubscriptionsView from "@/components/SubscriptionsView";
import { useHousehold } from "@/context/HouseholdContext";

export default function SubscriptionsPage() {
  const {
    subscriptions,
    setIsAddModalOpen,
    handleDeleteSubscription,
    setSelectedSubscriptionForReminder,
    handleAddSubscription,
  } = useHousehold();

  return (
    <DashboardShell currentTab="subscriptions">
      <SubscriptionsView
        subscriptions={subscriptions}
        onOpenAddModal={() => setIsAddModalOpen(true)}
        onDeleteSubscription={handleDeleteSubscription}
        onSelectSubscriptionForReminder={(sub) =>
          setSelectedSubscriptionForReminder(sub)
        }
        onAddSubscription={handleAddSubscription}
      />
    </DashboardShell>
  );
}
