"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import DashboardShell from "@/components/DashboardShell";
import OverviewView from "@/components/OverviewView";
import LoginPage from "@/components/LoginPage";
import { useHousehold } from "@/context/HouseholdContext";

export default function HomePage() {
  const router = useRouter();
  const {
    isLoggedIn,
    isAuthLoading,
    handleLoginSuccess,
    subscriptions,
    members,
    currentUser,
    setIsAddModalOpen,
    setIsInboxModalOpen,
    setSelectedSubscriptionForReminder,
  } = useHousehold();

  useEffect(() => {
    if (!isAuthLoading && isLoggedIn) {
      if (typeof window !== "undefined") {
        window.location.href = "/overview";
      } else {
        router.replace("/overview");
      }
    }
  }, [isLoggedIn, isAuthLoading, router]);

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 text-white flex items-center justify-center font-black text-lg animate-pulse shadow-md shadow-indigo-500/20">
            K
          </div>
          <span className="text-xs text-slate-500 font-semibold tracking-wide">
            Loading your family hub...
          </span>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <LoginPage
        onLoginSuccess={(email) => {
          handleLoginSuccess(email);
          if (typeof window !== "undefined") {
            window.location.href = "/overview";
          } else {
            router.replace("/overview");
          }
        }}
      />
    );
  }

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
