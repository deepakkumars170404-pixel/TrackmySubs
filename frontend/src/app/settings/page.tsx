"use client";

import React from "react";
import DashboardShell from "@/components/DashboardShell";
import SettingsView from "@/components/SettingsView";
import { useHousehold } from "@/context/HouseholdContext";

export default function SettingsPage() {
  const {
    preferences,
    setPreferences,
    setIsInboxModalOpen,
    handleExportData,
    handleExportCsv,
    handleDeleteHousehold,
    currentUser,
    setCurrentUser,
    subscriptions,
  } = useHousehold();

  return (
    <DashboardShell currentTab="settings">
      <SettingsView
        preferences={preferences}
        onUpdatePreferences={setPreferences}
        onOpenInboxModal={() => setIsInboxModalOpen(true)}
        onExportData={handleExportData}
        onExportCsv={handleExportCsv}
        onDeleteHousehold={handleDeleteHousehold}
        currentUser={currentUser}
        onUpdateCurrentUser={setCurrentUser}
        subscriptions={subscriptions}
      />
    </DashboardShell>
  );
}
