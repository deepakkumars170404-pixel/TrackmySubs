"use client";

import React from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Compass,
  CreditCard,
  CalendarDays,
  Users,
  Sparkles,
  Settings,
  UserCheck,
  X,
} from "lucide-react";
import { NavTab } from "@/types/trackmysubs";
import { useHousehold } from "@/context/HouseholdContext";

export type TabType = NavTab;

interface SidebarProps {
  currentTab?: NavTab;
  onSelectTab?: (tab: NavTab) => void;
  totalMonthlySpend?: number;
  activeCount?: number;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
  householdSpendTotal?: number;
  memberCount?: number;
}

export default function Sidebar({
  currentTab,
  onSelectTab,
  totalMonthlySpend,
  activeCount = 0,
  mobileOpen = false,
  onCloseMobile,
  householdSpendTotal,
  memberCount = 0,
}: SidebarProps) {
  const { currentUser } = useHousehold();
  const router = useRouter();
  const pathname = usePathname();
  const pathTab = pathname?.replace("/", "").split("/")[0] as NavTab | undefined;
  const effectiveTab = currentTab || (pathTab && pathTab.length > 0 ? pathTab : "overview");

  const effectiveSpend = typeof totalMonthlySpend === "number" ? totalMonthlySpend : (householdSpendTotal ?? 0);

  const handleNavClick = (tabId: NavTab) => {
    if (effectiveTab !== tabId) {
      router.push(`/${tabId}`);
    }
    if (onSelectTab) onSelectTab(tabId);
    if (onCloseMobile) onCloseMobile();
  };

  const navItems: {
    id: NavTab;
    label: string;
    description: string;
    icon: React.ReactNode;
    badge?: string;
    gradientClasses: string;
  }[] = [
    {
      id: "overview",
      label: "Overview",
      description: "Spend totals & stats",
      icon: <Compass className="w-4 h-4" />,
      badge: "Home",
      gradientClasses: "from-indigo-600 to-indigo-700 text-indigo-600",
    },
    {
      id: "subscriptions",
      label: "Subscriptions",
      description: "All plans & monthly spend",
      icon: <CreditCard className="w-4 h-4" />,
      badge: `${activeCount} Plans`,
      gradientClasses: "from-cyan-600 to-blue-600 text-cyan-600",
    },
    {
      id: "calendar",
      label: "Renewal calendar",
      description: "Upcoming charge dates",
      icon: <CalendarDays className="w-4 h-4" />,
      badge: "Alerts",
      gradientClasses: "from-rose-500 to-pink-600 text-rose-600",
    },
    {
      id: "family",
      label: "Members & Team",
      description: "Family & office users",
      icon: <Users className="w-4 h-4" />,
      badge: `${memberCount} Members`,
      gradientClasses: "from-indigo-600 to-purple-600 text-indigo-600",
    },
    {
      id: "autodetect",
      label: "Auto-detect",
      description: "Receipt & inbox sync",
      icon: <Sparkles className="w-4 h-4" />,
      badge: "Smart",
      gradientClasses: "from-purple-600 to-pink-600 text-purple-600",
    },
    {
      id: "settings",
      label: "Settings",
      description: "Workspace & preferences",
      icon: <Settings className="w-4 h-4" />,
      badge: "Config",
      gradientClasses: "from-slate-700 to-indigo-700 text-slate-700",
    },
  ];

  const sidebarInnerContent = (
    <div className="flex flex-col justify-between h-full px-4 py-5 select-none bg-white">
      <div>
        {/* Brand Header with 3-Color Gradient */}
        <div className="flex items-center justify-between px-2 mb-6">
          <div
            onClick={() => handleNavClick("overview")}
            className="flex items-center gap-2.5 cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 text-white flex items-center justify-center font-black text-lg shadow-md shadow-indigo-500/20">
              T
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-extrabold text-slate-900 tracking-tight text-[17px] leading-tight">
                  TrackmySubs
                </h1>
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-gradient-to-r from-indigo-500 to-pink-500 text-white">
                  PRO
                </span>
              </div>
              <p className="text-[10px] font-bold tracking-wider bg-gradient-to-r from-indigo-600 to-pink-600 bg-clip-text text-transparent uppercase">
                Subscriptions & Licenses
              </p>
            </div>
          </div>

          {onCloseMobile && mobileOpen && (
            <button
              onClick={onCloseMobile}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 md:hidden cursor-pointer"
              aria-label="Close navigation"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation Section */}
        <div className="mb-5">
          <div className="px-2 mb-2 flex items-center justify-between">
            <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              Platform Navigation
            </span>
            <span className="text-[9px] font-semibold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-100">
              6 Routes
            </span>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive = effectiveTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-all group relative cursor-pointer ${
                    isActive
                      ? "bg-gradient-to-r from-indigo-50/90 via-purple-50/50 to-white text-indigo-900 shadow-xs border-l-4 border-indigo-600"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                        isActive
                          ? "bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-sm"
                          : "bg-slate-100 text-slate-500 group-hover:bg-indigo-50 group-hover:text-indigo-600"
                      }`}
                    >
                      {item.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[13px] leading-tight truncate ${
                            isActive
                              ? "font-bold text-indigo-950"
                              : "font-semibold text-slate-800"
                          }`}
                        >
                          {item.label}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 truncate">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  {/* Right Badge / Active Indicator */}
                  <div className="flex items-center gap-1.5 shrink-0 pl-1">
                    {item.badge && (
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                          isActive
                            ? "bg-indigo-100/80 text-indigo-800 font-bold"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Bottom Summary Cards */}
      <div className="space-y-3 pt-3 border-t border-slate-100">
        {/* Total Spend widget */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-indigo-50/90 via-purple-50/50 to-pink-50/40 border border-indigo-100/80 shadow-xs">
          <p className="text-[10px] font-bold tracking-wider uppercase text-indigo-600">
            Total Monthly Spend
          </p>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-[20px] font-black tracking-tight bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent font-mono">
              ₹{effectiveSpend.toLocaleString("en-IN")}
            </span>
            <span className="text-[11px] text-slate-500 font-medium">/ month</span>
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-indigo-700 font-semibold">
            <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
            <span>{activeCount} plans · {memberCount} {memberCount === 1 ? "member" : "members"}</span>
          </div>
        </div>

        {/* User Card with Avatar */}
        <div className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-50 border border-slate-200">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 text-white font-bold text-xs flex items-center justify-center shadow-xs">
            {currentUser?.initials || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-bold text-slate-800 truncate leading-tight">
              {currentUser?.name || "Workspace & Home"}
            </p>
            <p className="text-[10px] text-slate-500 truncate">
              Owner · {memberCount} {memberCount === 1 ? "member" : "members"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden md:flex w-[260px] min-w-[260px] shrink-0 border-r border-slate-200 bg-white flex-col justify-between h-screen sticky top-0 z-30 overflow-y-auto">
        {sidebarInnerContent}
      </aside>

      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 md:hidden animate-in fade-in"
          onClick={onCloseMobile}
        />
      )}

      {/* Mobile Drawer */}
      <div
        className={`fixed inset-y-0 left-0 w-[270px] bg-white z-50 transform transition-transform duration-200 ease-in-out md:hidden shadow-2xl ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebarInnerContent}
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 py-1.5 px-2 flex items-center justify-around shadow-lg">
        {navItems.map((item) => {
          const isActive = effectiveTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`flex flex-col items-center gap-0.5 py-1 px-1.5 rounded-lg transition cursor-pointer min-w-0 ${
                isActive
                  ? "text-indigo-600 font-bold"
                  : "text-slate-500 hover:text-slate-800 font-medium"
              }`}
            >
              <div
                className={`w-6 h-6 rounded-md flex items-center justify-center transition ${
                  isActive
                    ? "bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-xs"
                    : "bg-transparent text-slate-500"
                }`}
              >
                {item.icon}
              </div>
              <span className="text-[9px] leading-tight truncate max-w-[52px]">
                {item.label.split(" ")[0]}
              </span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
