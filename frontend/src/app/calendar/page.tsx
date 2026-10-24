"use client";

import React from "react";
import DashboardShell from "@/components/DashboardShell";
import CalendarView from "@/components/CalendarView";
import { useHousehold } from "@/context/HouseholdContext";

export default function CalendarPage() {
  const { subscriptions, setSelectedSubscriptionForReminder } = useHousehold();

  return (
    <DashboardShell currentTab="calendar">
      <CalendarView
        subscriptions={subscriptions}
        onSelectSubscriptionForReminder={(sub) =>
          setSelectedSubscriptionForReminder(sub)
        }
      />
    </DashboardShell>
  );
}

