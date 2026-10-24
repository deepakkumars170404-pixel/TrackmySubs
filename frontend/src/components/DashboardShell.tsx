"use client";

import React from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import LoginPage from "@/components/LoginPage";
import AddSubscriptionModal from "@/components/AddSubscriptionModal";
import ConnectInboxModal from "@/components/ConnectInboxModal";
import ReminderModal from "@/components/ReminderModal";
import SupabaseModal from "@/components/SupabaseModal";
import InviteMemberModal from "@/components/InviteMemberModal";
import ReviewMatchModal from "@/components/ReviewMatchModal";
import AuthModal from "@/components/AuthModal";
import RenewalTesterModal from "@/components/RenewalTesterModal";
import RenewalAlertPopup from "@/components/RenewalAlertPopup";
import BulkImportModal from "@/components/BulkImportModal";
import { useHousehold } from "@/context/HouseholdContext";
import { NavTab } from "@/types/trackmysubs";

interface DashboardShellProps {
  currentTab: NavTab;
  children: React.ReactNode;
}

export default function DashboardShell({
  currentTab,
  children,
}: DashboardShellProps) {
  const router = useRouter();
  const {
    isLoggedIn,
    isAuthLoading,
    handleLoginSuccess,
    handleLogout,
    searchQuery,
    setSearchQuery,
    mobileSidebarOpen,
    setMobileSidebarOpen,
    subscriptions,
    totalMonthlySpend,
    members,
    currentUser,
    isSupabaseConfigured,
    // Modals
    isAddModalOpen,
    setIsAddModalOpen,
    isInboxModalOpen,
    setIsInboxModalOpen,
    isSupabaseModalOpen,
    setIsSupabaseModalOpen,
    isInviteModalOpen,
    setIsInviteModalOpen,
    isBulkImportOpen,
    setIsBulkImportOpen,
    isAuthModalOpen,
    setIsAuthModalOpen,
    isRenewalTesterOpen,
    setIsRenewalTesterOpen,
    initialTesterSub,
    setInitialTesterSub,
    selectedSubscriptionForReminder,
    setSelectedSubscriptionForReminder,
    reviewingMatch,
    setReviewingMatch,
    handleAddSubscription,
    handleImportBulkSubscriptions,
    handleConnectInbox,
    handleInviteMember,
    handleJoinHousehold,
    handleConfirmMatch,
  } = useHousehold();

  const activeCount = subscriptions.length;

  const handleTabChange = (tab: NavTab) => {
    if (currentTab !== tab) {
      router.push(`/${tab}`);
    }
  };

  // Wait for auth check from localStorage / Supabase so we never flash the login page
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 text-white flex items-center justify-center font-black text-lg animate-pulse shadow-md shadow-indigo-500/20">
            T
          </div>
          <span className="text-xs text-slate-500 font-semibold tracking-wide">
            Loading TrackmySubs...
          </span>
        </div>
      </div>
    );
  }

  // If not logged in, render the login page
  const isAcceptParam = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("accept");
  if (!isLoggedIn && !isAcceptParam) {
    return (
      <LoginPage
        onLoginSuccess={(email) => {
          handleLoginSuccess(email);
          router.replace(`/${currentTab}`);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-row antialiased selection:bg-indigo-600 selection:text-white">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={handleTabChange}
        totalMonthlySpend={totalMonthlySpend}
        activeCount={activeCount}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        householdSpendTotal={totalMonthlySpend}
        memberCount={members.length}
      />

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        {/* Global Header */}
        <Header
          currentTab={currentTab}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          isSupabaseConfigured={isSupabaseConfigured}
          onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
          onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
          onOpenInboxModal={() => setIsInboxModalOpen(true)}
          onOpenAuthPreview={() => setIsAuthModalOpen(true)}
          currentUser={currentUser}
          onSignOut={async () => {
            await handleLogout();
            router.replace("/login");
          }}
          onLogout={async () => {
            await handleLogout();
            router.replace("/login");
          }}
          onOpenLogin={() => setIsAuthModalOpen(true)}
          onSelectTab={handleTabChange}
        />

        {/* Dynamic Page Views Container */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl w-full mx-auto pb-24 md:pb-8">
          {children}
        </main>
      </div>

      {/* Shared Modals */}
      <AddSubscriptionModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddSubscription}
      />

      <ConnectInboxModal
        isOpen={isInboxModalOpen}
        onClose={() => setIsInboxModalOpen(false)}
        onConnect={handleConnectInbox}
      />

      <ReminderModal
        subscription={selectedSubscriptionForReminder}
        onClose={() => setSelectedSubscriptionForReminder(null)}
      />

      <SupabaseModal
        isOpen={isSupabaseModalOpen}
        onClose={() => setIsSupabaseModalOpen(false)}
        isConfigured={isSupabaseConfigured}
      />

      <InviteMemberModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        onInvite={handleInviteMember}
        onJoinHousehold={handleJoinHousehold}
      />

      <ReviewMatchModal
        receipt={reviewingMatch}
        onClose={() => setReviewingMatch(null)}
        onConfirm={handleConfirmMatch}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />

      <RenewalTesterModal
        isOpen={isRenewalTesterOpen}
        onClose={() => {
          setIsRenewalTesterOpen(false);
          setInitialTesterSub(null);
        }}
        initialSubscription={initialTesterSub}
      />

      <BulkImportModal
        isOpen={isBulkImportOpen}
        onClose={() => setIsBulkImportOpen(false)}
        onImportBulk={handleImportBulkSubscriptions}
        availableMembers={members.map((m) => m.name || m.email || "Member")}
      />

      <RenewalAlertPopup />
    </div>
  );
}
