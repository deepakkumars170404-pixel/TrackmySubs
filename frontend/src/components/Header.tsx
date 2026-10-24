"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Search,
  Menu,
  Settings,
  Mail,
  LogOut,
  ChevronDown,
  Database,
  X,
  Bell,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { NavTab } from "@/types/trackmysubs";
import { triggerLiveRenewalAlert } from "./RenewalAlertPopup";
import { playMobileNotificationSound } from "@/lib/soundNotification";

export interface CurrentUser {
  name: string;
  email: string;
  role: string;
  initials: string;
}

interface HeaderProps {
  currentTab?: NavTab;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  isSupabaseConfigured?: boolean;
  onOpenSupabaseModal?: () => void;
  onOpenMobileSidebar?: () => void;
  onOpenInboxModal?: () => void;
  onOpenAuthPreview?: () => void;
  currentUser?: CurrentUser | null;
  onSignOut?: () => void;
  onLogout?: () => void;
  onOpenLogin?: () => void;
  onSelectTab?: (tab: NavTab) => void;
}

const SECTION_TITLES: Record<NavTab, { tag: string; title: string }> = {
  overview: { tag: "WORKSPACE & HOME", title: "Overview & Analytics" },
  subscriptions: { tag: "ACTIVE PLANS", title: "All Subscriptions" },
  calendar: { tag: "RENEWAL CALENDAR", title: "Renewal Dates & Events" },
  family: { tag: "TEAM & FAMILY", title: "Members & Collaborators" },
  autodetect: { tag: "AUTOMATIC TRACKING", title: "Auto-detect Subscriptions" },
  settings: { tag: "PREFERENCES", title: "Account & Preferences" },
};

export default function Header({
  currentTab,
  searchQuery,
  onSearchChange,
  isSupabaseConfigured = false,
  onOpenSupabaseModal,
  onOpenMobileSidebar,
  onOpenInboxModal,
  onOpenAuthPreview,
  currentUser,
  onSignOut,
  onLogout,
  onOpenLogin,
  onSelectTab,
}: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const pathTab = pathname?.replace("/", "").split("/")[0] as NavTab | undefined;
  const effectiveTab = currentTab || (pathTab && pathTab.length > 0 ? pathTab : "overview");

  const currentSection = SECTION_TITLES[effectiveTab] || {
    tag: "WORKSPACE & HOME",
    title: "Subscriptions Hub",
  };
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSignOut = () => {
    setIsMenuOpen(false);
    if (onSignOut) {
      onSignOut();
    } else if (onLogout) {
      onLogout();
    } else if (onOpenAuthPreview) {
      onOpenAuthPreview();
    }
  };

  const userDisplayName = currentUser?.name || "Account Owner";
  const userInitials = currentUser?.initials || "AO";
  const userEmail = currentUser?.email || "user@trackmysubs.com";
  const userRole = currentUser?.role || "Family Admin";

  return (
    <header className="h-[72px] min-h-[72px] border-b border-slate-200/80 bg-white/95 backdrop-blur-md px-4 sm:px-6 md:px-8 flex items-center justify-between sticky top-0 z-20">
      {/* Left side: Mobile Toggle & Page Section Tag */}
      <div className="flex items-center gap-3">
        {onOpenMobileSidebar && (
          <button
            onClick={onOpenMobileSidebar}
            className="md:hidden p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
            aria-label="Open sidebar navigation"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div className="hidden sm:block">
          <span className="text-[10px] font-extrabold tracking-widest bg-gradient-to-r from-indigo-600 to-pink-600 bg-clip-text text-transparent uppercase">
            {currentSection.tag}
          </span>
          <h2 className="text-[15px] font-bold text-slate-800 leading-tight">
            {currentSection.title}
          </h2>
        </div>
      </div>

      {/* Middle: TrackmySubs Search Field */}
      <div className="flex-1 max-w-md mx-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search subscriptions, plans, or members..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-9 py-2 text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-2xs"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Right side: Supabase Live & User Profile */}
      <div className="flex items-center gap-2 sm:gap-3">


        {/* Supabase PostgreSQL & RLS Status Button */}
        {onOpenSupabaseModal && (
          <button
            onClick={onOpenSupabaseModal}
            className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all border cursor-pointer ${
              isSupabaseConfigured
                ? "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100/70"
                : "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100/70"
            }`}
            title="Supabase PostgreSQL & RLS status"
          >
            <Database className="w-3.5 h-3.5 text-indigo-600" />
            <span>{isSupabaseConfigured ? "Supabase Live" : "Supabase: Local Demo"}</span>
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isSupabaseConfigured ? "bg-indigo-500" : "bg-amber-500 animate-pulse"
              }`}
            />
          </button>
        )}

        {/* User Profile Avatar with Dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setIsMenuOpen((prev) => !prev)}
            aria-label="User profile menu"
            aria-expanded={isMenuOpen}
            className="flex items-center gap-2 p-1 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <div
              className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 text-white flex items-center justify-center font-bold text-xs shadow-md shadow-indigo-500/20"
              title={`${userDisplayName} & family`}
            >
              {userInitials}
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-500 hidden sm:block" />
          </button>

          {/* User Dropdown Menu */}
          {isMenuOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95">
              {/* User Header */}
              <div className="px-4 py-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 text-white flex items-center justify-center text-xs font-bold shadow-xs">
                    {userInitials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-slate-900 text-[13px] truncate">
                      {userDisplayName}
                    </div>
                    <div className="text-slate-500 text-[11px] truncate">
                      {userEmail}
                    </div>
                  </div>
                </div>
                <div className="mt-2.5">
                  <span className="inline-block px-2.5 py-0.5 text-[10px] font-bold bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100">
                    {userRole}
                  </span>
                </div>
              </div>

              {/* Navigation Shortcuts */}
              <div className="py-1">
                {onSelectTab && (
                  <button
                    onClick={() => {
                      onSelectTab("settings");
                      setIsMenuOpen(false);
                    }}
                    className="w-full px-4 py-2 text-left text-[13px] text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <Settings className="w-4 h-4 text-slate-400" />
                    <span>Workspace &amp; Preferences</span>
                  </button>
                )}

                {onOpenInboxModal && (
                  <button
                    onClick={() => {
                      onOpenInboxModal();
                      setIsMenuOpen(false);
                    }}
                    className="w-full px-4 py-2 text-left text-[13px] text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <Mail className="w-4 h-4 text-slate-400" />
                    <span>Connected Inboxes</span>
                  </button>
                )}
              </div>

              {/* Sign Out */}
              <div className="pt-1 mt-1 border-t border-slate-100">
                <button
                  onClick={handleSignOut}
                  className="w-full px-4 py-2 text-left text-[13px] text-rose-600 hover:bg-rose-50 flex items-center gap-2.5 transition-colors cursor-pointer font-semibold"
                >
                  <LogOut className="w-4 h-4 text-rose-500" />
                  <span>Sign out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
