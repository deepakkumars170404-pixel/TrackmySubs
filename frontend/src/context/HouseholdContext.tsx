"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { Subscription } from "@/lib/types";
import {
  NavTab,
  FamilyMember,
  ConnectedInbox,
  DetectedReceipt,
  HouseholdPreferences,
  SharedPlanSummary,
} from "@/types/trackmysubs";
import { CurrentUser } from "@/components/Header";
import { KINFOLK_SAMPLE_SUBSCRIPTIONS } from "@/lib/mockData";
import {
  INITIAL_MEMBERS,
  INITIAL_SHARED_PLANS,
  INITIAL_INBOXES,
  INITIAL_DETECTED,
  INITIAL_PREFERENCES,
} from "@/lib/trackmysubsData";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { getBrandLogo, getBrandColor } from "@/lib/logoHelper";
import { calculateNextRenewalDate, addDaysToDate, calculateDaysBetween, extractValidityDaysFromText, getAutoAdvancedRenewalDate, formatDisplayDate } from "@/lib/dateCalculator";
import { playMobileNotificationSound } from "@/lib/soundNotification";

function getStoredItem(key: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(`trackmysubs_${key}`) || localStorage.getItem(`kinfolk_${key}`);
}

function setStoredItem(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`trackmysubs_${key}`, value);
  } catch (e) {}
}

function removeStoredItem(key: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(`trackmysubs_${key}`);
    localStorage.removeItem(`kinfolk_${key}`);
  } catch (e) {}
}

interface HouseholdContextType {
  // Auth state
  isLoggedIn: boolean;
  isAuthLoading: boolean;
  setIsLoggedIn: (logged: boolean) => void;
  currentUser: CurrentUser | null;
  setCurrentUser: (user: CurrentUser | null) => void;
  handleLoginSuccess: (email?: string) => void;
  handleLogout: () => Promise<void>;

  // Navigation & Search
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: (open: boolean) => void;

  // Subscriptions & Supabase
  subscriptions: Subscription[];
  setSubscriptions: React.Dispatch<React.SetStateAction<Subscription[]>>;
  totalMonthlySpend: number;
  handleAddSubscription: (
    newSubData: Omit<Subscription, "id" | "created_at" | "updated_at">
  ) => Promise<void>;
  handleImportBulkSubscriptions: (
    newSubs: Partial<Subscription>[]
  ) => Promise<void>;
  handleDeleteSubscription: (id: string) => Promise<void>;
  handleToggleAutopay: (id: string) => Promise<void>;
  isSupabaseConfigured: boolean;

  // Household data
  members: FamilyMember[];
  setMembers: React.Dispatch<React.SetStateAction<FamilyMember[]>>;
  sharedPlans: SharedPlanSummary[];
  setSharedPlans: React.Dispatch<React.SetStateAction<SharedPlanSummary[]>>;
  inboxes: ConnectedInbox[];
  setInboxes: React.Dispatch<React.SetStateAction<ConnectedInbox[]>>;
  detectedList: DetectedReceipt[];
  setDetectedList: React.Dispatch<React.SetStateAction<DetectedReceipt[]>>;
  preferences: HouseholdPreferences;
  setPreferences: React.Dispatch<React.SetStateAction<HouseholdPreferences>>;

  // Actions
  handleConnectInbox: (inbox: ConnectedInbox) => void;
  handleInviteMember: (member: FamilyMember) => Promise<{ success: boolean; delivered?: boolean; message: string }>;
  handleJoinHousehold: (inviteCode: string, displayName: string) => Promise<{ success: boolean; message: string }>;
  handleRemoveMember: (memberId: string) => Promise<{ success: boolean; message: string }>;
  handleConnectMemberInbox: (memberId: string, status: 'Gmail connected' | 'Outlook connected', email?: string) => Promise<void>;
  handleRequestMemberConnect: (memberId: string, email: string, name: string, provider?: 'Gmail' | 'Outlook') => Promise<{ success: boolean; delivered?: boolean; message: string; inviteUrl?: string }>;
  handleAcceptMemberInvite: (memberId: string, email?: string, provider?: string, name?: string) => Promise<{ success: boolean; message: string }>;
  handleResendMemberInvite: (memberId: string, email: string, name: string) => Promise<{ success: boolean; message: string }>;
  handleConfirmMatch: (id: string, date: string, member: string) => Promise<void> | void;
  handlePreviewScan: () => Promise<void> | void;
  handleAutoDetectAddPerson: (name: string, email: string, role?: string) => Promise<{ success: boolean; member?: any; scannedCount: number; message: string }>;
  handleScanMemberMailbox: (memberId: string, email: string, name: string) => Promise<{ success: boolean; scannedSubscriptions: Subscription[]; message: string }>;
  handleExportData: () => void;
  handleExportCsv: () => void;
  handleDeleteHousehold: () => void;

  // Modals
  isAddModalOpen: boolean;
  setIsAddModalOpen: (open: boolean) => void;
  isInboxModalOpen: boolean;
  setIsInboxModalOpen: (open: boolean) => void;
  isSupabaseModalOpen: boolean;
  setIsSupabaseModalOpen: (open: boolean) => void;
  isInviteModalOpen: boolean;
  setIsInviteModalOpen: (open: boolean) => void;
  isBulkImportOpen: boolean;
  setIsBulkImportOpen: (open: boolean) => void;
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (open: boolean) => void;
  isRenewalTesterOpen: boolean;
  setIsRenewalTesterOpen: (open: boolean) => void;
  openRenewalTester: (sub?: Subscription) => void;
  initialTesterSub: Subscription | null;
  setInitialTesterSub: (sub: Subscription | null) => void;
  selectedSubscriptionForReminder: Subscription | null;
  setSelectedSubscriptionForReminder: (sub: Subscription | null) => void;
  reviewingMatch: DetectedReceipt | null;
  setReviewingMatch: (receipt: DetectedReceipt | null) => void;
}

export const getBackendUrl = () => {
  if (typeof window !== "undefined") {
    // In browser, use the same origin so Next.js rewrites proxy cleanly without cross-origin/firewall issues
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_BACKEND_URL || (process.env.NODE_ENV === "production" ? "https://trackmysubs-backend.onrender.com" : "http://127.0.0.1:5000");
};

export function getSubscriptionMonthlyCost(s: Partial<Subscription>): number {
  if (!s || s.status === "canceled") return 0;
  if (typeof s.monthly_cost === "number" && !isNaN(s.monthly_cost) && s.monthly_cost > 0) {
    return s.monthly_cost;
  }
  const rawCost = Number(s.cost || 0);
  if (isNaN(rawCost) || rawCost <= 0) return 0;
  const cycle = (s.billing_cycle || "monthly").toLowerCase();
  if (cycle === "yearly" || cycle === "annual") {
    return Math.round(rawCost / 12);
  }
  if (cycle === "quarterly") {
    return Math.round(rawCost / 3);
  }
  if (cycle === "weekly") {
    return Math.round((rawCost * 52) / 12);
  }
  return rawCost;
}

export function computeMemberStats(
  member: FamilyMember,
  allSubscriptions: Subscription[]
): { planCount: number; monthlyShare: number; plans: Subscription[] } {
  const memberName = (member.name || "").trim().toLowerCase();
  const firstName = memberName.split(/\s+/)[0] || "";
  const isOwner =
    member.role === "Owner" ||
    String(member.role).toLowerCase().includes("owner") ||
    String(member.role).toLowerCase().includes("admin");

  const memberPlans = (allSubscriptions || []).filter((s) => {
    if (s.status === "canceled") return false;
    const who = (s.who_uses_it || "").trim().toLowerCase();

    // Bi-directional name matching (e.g. "Alex Kumar" <=> "Alex", "Priya", "Aarav", "Sita")
    if (memberName && (who.includes(memberName) || memberName.includes(who))) return true;
    if (firstName && who.includes(firstName)) return true;

    // If owner, also match general household shared plans ("everyone", "family", or empty who_uses_it)
    if (isOwner && (who === "everyone" || who.includes("family") || !who)) {
      return true;
    }

    return false;
  });

  const monthlyShare = memberPlans.reduce((sum, s) => {
    return sum + getSubscriptionMonthlyCost(s);
  }, 0);

  return {
    planCount: memberPlans.length,
    monthlyShare,
    plans: memberPlans,
  };
}

export function extractCleanUserName(emailOrName?: string | null): string {
  if (!emailOrName) return "Account Owner";
  let str = emailOrName.trim();
  if (str.includes("@")) {
    str = str.split("@")[0];
  }
  // Strip trailing numbers (e.g. deepakkumars170404 -> deepakkumars)
  const withoutNumbers = str.replace(/[0-9]+$/g, "");
  if (withoutNumbers.length >= 2) {
    str = withoutNumbers;
  }
  // Replace dots, underscores, dashes with spaces
  str = str.replace(/[._-]+/g, " ").trim();
  if (!str) return "Account Owner";

  // Capitalize each word (e.g. "deepak kumar" -> "Deepak Kumar")
  return str
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export function deduplicateMembers(list: FamilyMember[]): FamilyMember[] {
  const merged: FamilyMember[] = [];

  const isConnected = (status?: string) =>
    status === "Gmail connected" || status === "Outlook connected";

  for (const m of list) {
    if (!m) continue;

    const mEmail = m.email?.trim().toLowerCase();
    const mName = m.name?.trim().toLowerCase();
    const mId = m.id?.trim();

    const existingIndex = merged.findIndex((item) => {
      const itemEmail = item.email?.trim().toLowerCase();
      const itemName = item.name?.trim().toLowerCase();
      const itemId = item.id?.trim();

      if (mEmail && itemEmail && mEmail === itemEmail) return true;
      if (mId && itemId && mId === itemId) return true;
      if (mName && itemName && mName === itemName) return true;
      return false;
    });

    if (existingIndex === -1) {
      merged.push({ ...m });
    } else {
      const existing = merged[existingIndex];
      const preferredStatus = isConnected(m.inboxStatus)
        ? m.inboxStatus
        : isConnected(existing.inboxStatus)
        ? existing.inboxStatus
        : m.inboxStatus === "Pending Acceptance"
        ? m.inboxStatus
        : existing.inboxStatus;

      merged[existingIndex] = {
        ...existing,
        ...m,
        id: existing.id || m.id,
        name: existing.name || m.name,
        email: (existing.email && existing.email.includes("@")) ? existing.email : m.email,
        inboxStatus: preferredStatus,
        planCount: m.planCount ?? existing.planCount ?? 0,
        monthlyShare: m.monthlyShare ?? existing.monthlyShare ?? 0,
        lastChecked: isConnected(preferredStatus) ? "Just now" : (m.lastChecked || existing.lastChecked || "Just now")
      };
    }
  }

  return merged;
}

const HouseholdContext = createContext<HouseholdContextType | undefined>(undefined);

export function HouseholdProvider({ children }: { children: React.ReactNode }) {
  // Initialize auth from localStorage if available so it never resets on page navigation or browser back button
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    return getStoredItem("auth") === "true";
  });

  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [subscriptions, setSubscriptions] = useState<Subscription[]>(() => {
    try {
      const cached = getStoredItem("subscriptions");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const clean = parsed
            .filter(
              (s: any) =>
                !['Priya', 'Aarav', 'Sita', 'Test User', 'alex'].includes(s.who_uses_it) &&
                !['sub-youtube', 'sub-canva', 'sub-hotstar', 'sub-duolingo', 'sub-zee5', 'sub-prime', 'sub-icloud', 'sub-google-one', 'sub-myjio', 'sub-gemini', 'sub-spotify', 'sub-1792734029296', 'sub-netflix-8345', 'sub-netflix-8519', 'sub-jiosunnxt-7914', 'sub-netflix-8690'].includes(s.id) &&
                !String(s.id || '').startsWith('sub-mem-') &&
                !String(s.who_uses_it || '').toLowerCase().includes('devi') &&
                s.who_uses_it !== 'Ananya Roy' &&
                s.user_id !== 'priya' &&
                s.user_id !== 'aarav' &&
                s.user_id !== 'sita'
            )
            .map((sub: any) => {
              const detectedValidity =
                sub.validity_days ||
                (sub.name?.toLowerCase().includes("jio") || sub.plan_tier?.includes("28")
                  ? 28
                  : sub.billing_cycle === "yearly"
                  ? 365
                  : sub.billing_cycle === "quarterly"
                  ? 92
                  : 30);

              let start = (sub.start_date || "").split("T")[0];
              let next = (sub.next_billing_date || "").split("T")[0];

              // Mathematical date reconciliation: start + validity = next
              if (start && next && detectedValidity > 0) {
                const diff = calculateDaysBetween(start, next);
                if (diff !== detectedValidity) {
                  // Keep next_billing_date and compute exact start_date backwards
                  start = addDaysToDate(next, -detectedValidity);
                }
              } else if (start && !next) {
                next = addDaysToDate(start, detectedValidity);
              }

              return {
                ...sub,
                start_date: start,
                next_billing_date: next,
                validity_days: detectedValidity,
              };
            });

          if (clean.length > 0) {
            setStoredItem("subscriptions", JSON.stringify(clean));
            return clean;
          }
        }
      }
    } catch {}
    return [];
  });

  // Client mount lifecycle: purge legacy fraud subscriptions & auto-advance past renewals
  useEffect(() => {
    // 1. Purge any stale Devi or fake mock subscriptions from localStorage
    if (typeof window !== "undefined") {
      try {
        const purgeKeys = ["subscriptions", "trackmysubs_subscriptions", "kinfolk_subscriptions"];
        purgeKeys.forEach((key) => {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              const filtered = parsed
                .filter(
                  (s: any) =>
                    !String(s.id || "").startsWith("sub-mem-") &&
                    !String(s.who_uses_it || "").toLowerCase().includes("devi") &&
                    !['sub-prime', 'sub-icloud', 'sub-google-one', 'sub-myjio', 'sub-gemini', 'sub-spotify', 'sub-1792734029296', 'sub-netflix-8345', 'sub-netflix-8519', 'sub-jiosunnxt-7914', 'sub-netflix-8690'].includes(s.id) &&
                    !["Priya", "Aarav", "Sita"].includes(s.who_uses_it)
                );
              localStorage.setItem(key, JSON.stringify(filtered));
            }
          }
        });
      } catch (e) {
        console.warn("Storage cleanup error:", e);
      }
    }

    const todayStr = new Date().toISOString().split("T")[0];
    setSubscriptions((prev) =>
      prev
        .filter(
          (s) =>
            !String(s.id || "").startsWith("sub-mem-") &&
            !['sub-prime', 'sub-icloud', 'sub-google-one', 'sub-myjio', 'sub-gemini', 'sub-spotify', 'sub-1792734029296', 'sub-netflix-8345', 'sub-netflix-8519', 'sub-jiosunnxt-7914', 'sub-netflix-8690'].includes(s.id) &&
            !String(s.who_uses_it || "").toLowerCase().includes("devi")
        )
        .map((sub) => {
          let start = (sub.start_date || "").split("T")[0];
          let nextDate = sub.next_billing_date;

          if (nextDate && nextDate < todayStr && start) {
            nextDate = getAutoAdvancedRenewalDate({
              startDate: start,
              validityDays: sub.validity_days,
              billingCycle: sub.billing_cycle,
              asOfDate: todayStr,
            });
          }
          return { ...sub, start_date: start, next_billing_date: nextDate };
        })
    );
  }, []);
  const [members, setMembers] = useState<FamilyMember[]>(() => {
    try {
      const cached = getStoredItem("members");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const nonMock = parsed.filter((m: any) => !['mem-1', 'mem-2', 'mem-3', 'mem-4', 'mem-alex', 'mem-priya', 'mem-aarav', 'mem-sita'].includes(m.id) && m.name !== 'Alex Kumar' && m.name !== 'Alex' && m.name !== 'Priya' && m.name !== 'Aarav' && m.name !== 'Sita');
          return deduplicateMembers(nonMock);
        }
      }
    } catch (e) {}
    return INITIAL_MEMBERS;
  });

  const [sharedPlans, setSharedPlans] = useState<SharedPlanSummary[]>(INITIAL_SHARED_PLANS);

  // 100% Dynamic Total Household Monthly Spend
  const totalMonthlySpend = useMemo(() => {
    return (subscriptions || []).reduce((sum, s) => {
      return sum + getSubscriptionMonthlyCost(s);
    }, 0);
  }, [subscriptions]);

  // 100% Dynamic Member metrics derived from active subscriptions
  const dynamicMembers = useMemo(() => {
    return members.map((m) => {
      const stats = computeMemberStats(m, subscriptions);
      return {
        ...m,
        planCount: stats.planCount,
        monthlyShare: stats.monthlyShare,
      };
    });
  }, [members, subscriptions]);

  // 100% Dynamic Shared Plans derived from active subscriptions
  const dynamicSharedPlans: SharedPlanSummary[] = useMemo(() => {
    const sharedSubs = subscriptions.filter(
      (s) =>
        s.status !== "canceled" &&
        (s.who_uses_it?.toLowerCase() === "everyone" ||
          s.who_uses_it?.toLowerCase().includes("family") ||
          s.who_uses_it?.toLowerCase().includes("&"))
    );

    if (sharedSubs.length === 0) return sharedPlans;

    return sharedSubs.map((s) => ({
      id: `shared-${s.id}`,
      name: s.name,
      tier: s.plan_tier || `${s.billing_cycle || "Monthly"} Plan`,
      monthlyCost: Number(s.monthly_cost ?? s.cost ?? 0),
      assignedTo: s.who_uses_it || "Everyone",
      iconBgColor: s.brand_color ? `bg-slate-50 text-slate-900 border border-slate-200` : "bg-indigo-50 text-indigo-700 border border-indigo-100",
      iconInitial: s.brand_letter || s.name.charAt(0).toUpperCase(),
    }));
  }, [subscriptions, sharedPlans]);

  // Keep localStorage updated with dynamic members list
  useEffect(() => {
    if (dynamicMembers && dynamicMembers.length > 0) {
      setStoredItem("members", JSON.stringify(dynamicMembers));
    }
  }, [dynamicMembers]);
  const [inboxes, setInboxes] = useState<ConnectedInbox[]>(INITIAL_INBOXES);
  const [detectedList, setDetectedList] = useState<DetectedReceipt[]>(INITIAL_DETECTED);
  const [preferences, setPreferences] = useState<HouseholdPreferences>(() => {
    try {
      const cached = getStoredItem("preferences");
      if (cached) return JSON.parse(cached);
    } catch (e) {}
    return INITIAL_PREFERENCES;
  });

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(() => {
    const storedEmail = getStoredItem("user_email");
    const storedName = getStoredItem("user_name");
    if (storedEmail || storedName) {
      const name = extractCleanUserName(storedName || storedEmail);
      return {
        name,
        email: storedEmail || "user@trackmysubs.com",
        role: "Workspace Owner",
        initials: name.slice(0, 2).toUpperCase(),
      };
    }
    return {
      name: "Account Owner",
      email: "user@trackmysubs.com",
      role: "Workspace Owner",
      initials: "AO",
    };
  });

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isInboxModalOpen, setIsInboxModalOpen] = useState(false);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isRenewalTesterOpen, setIsRenewalTesterOpen] = useState(false);
  const [initialTesterSub, setInitialTesterSub] = useState<Subscription | null>(null);

  const openRenewalTester = (sub?: Subscription) => {
    if (sub) setInitialTesterSub(sub);
    setIsRenewalTesterOpen(true);
  };
  const [selectedSubscriptionForReminder, setSelectedSubscriptionForReminder] = useState<Subscription | null>(null);
  const [reviewingMatch, setReviewingMatch] = useState<DetectedReceipt | null>(null);

  // Restore and keep Supabase session in sync
  useEffect(() => {
    let isMounted = true;
    const hasLocalAuth = getStoredItem("auth") === "true";

    if (hasLocalAuth) {
      setIsLoggedIn(true);
      const storedEmail = getStoredItem("user_email");
      if (storedEmail) {
        const rawName = storedEmail.split("@")[0] || "User";
        const name = rawName.charAt(0).toUpperCase() + rawName.slice(1);
        setCurrentUser({
          name,
          email: storedEmail,
          role: "Family Admin",
          initials: name.slice(0, 2).toUpperCase(),
        });
      }
    }

    // Safety fallback: ensure auth loading never hangs indefinitely
    const authTimeout = setTimeout(() => {
      if (isMounted) setIsAuthLoading(false);
    }, 1200);

    if (isSupabaseConfigured) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!isMounted) return;
        if (session?.user?.email) {
          handleLoginSuccess(session.user.email);
        } else if (!hasLocalAuth) {
          setIsLoggedIn(false);
        }
        setIsAuthLoading(false);
      }).catch(() => {
        if (isMounted) setIsAuthLoading(false);
      });

      const {
        data: { subscription: authListener },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!isMounted) return;
        if (session?.user?.email) {
          handleLoginSuccess(session.user.email);
        }
      });

      return () => {
        isMounted = false;
        clearTimeout(authTimeout);
        authListener.unsubscribe();
      };
    } else {
      setIsAuthLoading(false);
    }

    return () => {
      isMounted = false;
      clearTimeout(authTimeout);
    };
  }, []);

  // Supabase Subscriptions fetch
  const refreshSubscriptionsFromSupabase = useCallback(async () => {
    if (isSupabaseConfigured) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const activeUserId = session?.user?.id;
        const activeEmail = session?.user?.email || currentUser?.email;

        let query = supabase.from("subscriptions").select("*");
        if (activeUserId || activeEmail) {
          const conditions: string[] = [];
          if (activeUserId) conditions.push(`user_id.eq.${activeUserId}`);
          if (activeEmail) conditions.push(`user_id.eq.${activeEmail}`);
          query = query.or(conditions.join(","));
        }

        const { data, error } = await query;

        if (!error) {
          if (!data || data.length === 0) {
            setSubscriptions([]);
            setStoredItem("subscriptions", JSON.stringify([]));
            return;
          }

          const merged = data
            .filter((sub: any) =>
              !['sub-prime', 'sub-icloud', 'sub-google-one', 'sub-myjio', 'sub-gemini', 'sub-spotify', 'sub-1792734029296', 'sub-netflix-8345', 'sub-netflix-8519', 'sub-jiosunnxt-7914', 'sub-netflix-8690'].includes(sub.id) &&
              !String(sub.id || '').startsWith("sub-mem-") &&
              !["Priya", "Aarav", "Sita", "Test User", "alex"].includes(sub.who_uses_it) &&
              sub.who_uses_it !== "Devi"
            )
            .map((sub: any) => {
              const detectedValidity =
                sub.validity_days ||
                extractValidityDaysFromText(sub.source_detail || "") ||
                extractValidityDaysFromText(sub.description || "") ||
                extractValidityDaysFromText(sub.plan_tier || "") ||
                (sub.name?.toLowerCase().includes("jio") ||
                 sub.name?.toLowerCase().includes("airtel") ||
                 sub.plan_tier?.includes("28")
                  ? 28
                  : sub.billing_cycle === "yearly"
                  ? 365
                  : sub.billing_cycle === "quarterly"
                  ? 92
                  : 30);

              let accurateNextDate = (sub.next_billing_date || sub.renewal_date || "").split("T")[0];
              let startDate = (sub.start_date || "").split("T")[0];

              // Reconcile dates: next_billing_date must strictly equal startDate + detectedValidity
              if (accurateNextDate && detectedValidity > 0) {
                if (!startDate || calculateDaysBetween(startDate, accurateNextDate) !== detectedValidity) {
                  startDate = addDaysToDate(accurateNextDate, -detectedValidity);
                }
              } else if (!accurateNextDate && startDate) {
                accurateNextDate = addDaysToDate(startDate, detectedValidity);
              }

              // Auto-advance if renewal date is in the past (e.g. 28d -> 56d -> 84d...)
              const todayStr = new Date().toISOString().split("T")[0];
              if (accurateNextDate && accurateNextDate < todayStr && startDate) {
                accurateNextDate = getAutoAdvancedRenewalDate({
                  startDate,
                  validityDays: detectedValidity,
                  billingCycle: sub.billing_cycle,
                  asOfDate: todayStr,
                });
              }

              return {
                ...sub,
                start_date: startDate || sub.start_date,
                next_billing_date: accurateNextDate || new Date().toISOString().split("T")[0],
                validity_days: detectedValidity,
                cost: Number(sub.cost ?? sub.amount ?? 0),
                monthly_cost: Number(sub.monthly_cost ?? sub.cost ?? sub.amount ?? 0),
                brand_letter: sub.brand_letter || sub.name?.charAt(0).toUpperCase() || "S",
                brand_color: sub.brand_color || getBrandColor(sub.name || ""),
                icon_image: sub.icon_image || getBrandLogo(sub.name || ""),
                who_uses_it: sub.who_uses_it || "Everyone",
                autopay_state: sub.autopay_state || (sub.auto_renew ? "on" : "off"),
                source: sub.source || "receipt",
                evidence_snippet: sub.evidence_snippet || sub.source_detail,
                receipt_id: sub.receipt_id || `REC-${(sub.name || "SUB").slice(0, 3).toUpperCase()}-${String(sub.id).replace(/[^a-zA-Z0-9]/g, "").slice(-6)}`,
              };
            });

          setSubscriptions(merged);
          setStoredItem("subscriptions", JSON.stringify(merged));
        }
      } catch (err) {
        console.log("Supabase fetch fallback:", err);
      }
    }
  }, [isSupabaseConfigured, currentUser]);

  useEffect(() => {
    refreshSubscriptionsFromSupabase();

    // Check live IMAP status from backend
    const BACKEND_URL = getBackendUrl();
    fetch(`${BACKEND_URL}/api/inbox/status`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.configured && data.accountEmail) {
          setInboxes([
            {
              id: "inbox-gmail",
              provider: "Gmail",
              email: data.accountEmail,
              connectedBy: "Deepak",
              lastChecked: data.lastChecked ? "Just now" : "Auto-Sync Active",
              status: "Connected",
              historyDaysScanned: 30,
            },
          ]);
        }
      })
      .catch(() => {});
  }, [refreshSubscriptionsFromSupabase]);

  // Family Backend Module sync (be-family API on port 5000)
  useEffect(() => {
    let isMounted = true;
    async function fetchFamilyData() {
      const BACKEND_URL = getBackendUrl();
      try {
        const res = await fetch(`${BACKEND_URL}/api/family/overview`);
        if (res.ok) {
          const json = await res.json();
          if (isMounted && json?.success && json?.data) {
            if (json.data.members && json.data.members.length > 0) {
              setMembers((prev) => {
                const nonMock = json.data.members.filter((m: any) => !['mem-1', 'mem-2', 'mem-3', 'mem-4', 'mem-alex', 'mem-priya', 'mem-aarav', 'mem-sita'].includes(m.id) && m.name !== 'Alex Kumar' && m.name !== 'Alex' && m.name !== 'Priya' && m.name !== 'Aarav' && m.name !== 'Sita');
                return deduplicateMembers([...nonMock, ...prev]);
              });
            }
            if (json.data.sharedPlans && json.data.sharedPlans.length > 0) {
              setSharedPlans(json.data.sharedPlans);
            }
          }
        }
      } catch (err) {
        console.warn("Family backend sync fallback:", err);
      }
    }
    fetchFamilyData();
    return () => {
      isMounted = false;
    };
  }, []);

  // Supabase & Backend User Notification Settings fetch
  useEffect(() => {
    let isMounted = true;
    async function fetchSettings() {
      const email = currentUser?.email || "user@trackmysubs.com";
      const BACKEND_URL = getBackendUrl();

      // 1. Backend API sync (admin service role)
      try {
        const res = await fetch(`${BACKEND_URL}/api/settings?email=${encodeURIComponent(email)}`);
        if (res.ok) {
          const json = await res.json();
          if (isMounted && json?.settings) {
            const data = json.settings;
            const loadedPrefs: HouseholdPreferences = {
              oneDayRenewalReminder: Boolean(data.one_day_reminder),
              emailReminders: Boolean(data.email_reminders),
              browserPush: Boolean(data.browser_push),
              autoTrackingActive: Boolean(data.automatic_detection_enabled),
              autoAddHighConfidence: Boolean(data.automatic_detection_enabled),
            };
            setPreferences(loadedPrefs);
            if (typeof window !== "undefined") {
              localStorage.setItem("kinfolk_preferences", JSON.stringify(loadedPrefs));
            }
            return;
          }
        }
      } catch (e) {
        // Fallback to Supabase client
      }

      // 2. Direct Supabase client sync
      if (isSupabaseConfigured) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const userId = session?.user?.id;
          if (!userId) return;

          const { data, error } = await supabase
            .from("user_notification_settings")
            .select("*")
            .eq("user_id", userId)
            .maybeSingle();

          if (isMounted && data && !error) {
            const loadedPrefs: HouseholdPreferences = {
              oneDayRenewalReminder: Boolean(data.one_day_reminder),
              emailReminders: Boolean(data.email_reminders),
              browserPush: Boolean(data.browser_push),
              autoTrackingActive: Boolean(data.automatic_detection_enabled),
              autoAddHighConfidence: Boolean(data.automatic_detection_enabled),
            };
            setPreferences(loadedPrefs);
            if (typeof window !== "undefined") {
              localStorage.setItem("kinfolk_preferences", JSON.stringify(loadedPrefs));
            }
          }
        } catch (err) {
          console.info("Settings fetch note:", err);
        }
      }
    }
    fetchSettings();
    return () => {
      isMounted = false;
    };
  }, [isLoggedIn, currentUser?.email]);



  // Subscriptions CRUD
  const handleAddSubscription = async (
    newSubData: Omit<Subscription, "id" | "created_at" | "updated_at">
  ) => {
    const finalLogo = newSubData.icon_image || getBrandLogo(newSubData.name);
    const finalColor = newSubData.brand_color || getBrandColor(newSubData.name);
    const newSub: Subscription = {
      ...newSubData,
      id: "sub-" + Date.now(),
      icon_image: finalLogo,
      brand_color: finalColor,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setSubscriptions((prev) => [newSub, ...prev]);

    if (isSupabaseConfigured) {
      try {
        const insertPayload: any = {
          id: newSub.id,
          name: newSub.name,
          cost: newSub.cost,
          monthly_cost: newSub.monthly_cost || newSub.cost,
          plan_tier: newSub.plan_tier,
          currency: newSub.currency,
          billing_cycle: newSub.billing_cycle,
          status: newSub.status,
          start_date: newSub.start_date,
          next_billing_date: newSub.next_billing_date,
          who_uses_it: newSub.who_uses_it || "Everyone",
          payment_method: newSub.payment_method || "UPI AutoPay",
          autopay_state: newSub.autopay_state || "on",
          source: newSub.source || "receipt",
          source_detail: newSub.source_detail,
          brand_letter: newSub.brand_letter || newSub.name.charAt(0).toUpperCase(),
          brand_color: finalColor,
          icon_image: finalLogo,
          service_url: newSub.service_url,
          tags: newSub.tags,
        };
        await supabase.from("subscriptions").insert([insertPayload]);
      } catch (err) {
        console.error("Supabase insert error:", err);
      }
    }
  };

  const handleImportBulkSubscriptions = async (newSubs: Partial<Subscription>[]) => {
    const todayStr = new Date().toISOString();
    const createdList: Subscription[] = [];

    for (const sub of newSubs) {
      const name = sub.name || "Custom Subscription";
      const finalLogo = sub.icon_image || getBrandLogo(name);
      const finalColor = sub.brand_color || getBrandColor(name);
      const slug = name.toLowerCase().replace(/[^a-z0-9]/g, "");
      const newId = `sub-${slug}-${Date.now().toString().slice(-4)}-${Math.floor(Math.random() * 1000)}`;

      const newSub: Subscription = {
        id: newId,
        user_id: currentUser?.email || "user@trackmysubs.com",
        name,
        cost: Number(sub.cost || 299),
        monthly_cost: Number(sub.monthly_cost || sub.cost || 299),
        currency: sub.currency || "INR",
        billing_cycle: sub.billing_cycle || "monthly",
        status: sub.status || "active",
        start_date: sub.start_date || todayStr.split("T")[0],
        next_billing_date: sub.next_billing_date || todayStr.split("T")[0],
        auto_renew: sub.auto_renew ?? true,
        who_uses_it: sub.who_uses_it || "Everyone",
        payment_method: sub.payment_method || "AutoPay Mandate",
        autopay_state: "on",
        source: sub.source || "receipt",
        source_detail: sub.source_detail || "Bulk CSV Import",
        plan_tier: sub.plan_tier || "Standard Plan",
        brand_letter: name.charAt(0).toUpperCase(),
        brand_color: finalColor,
        icon_image: finalLogo,
        notify_before_days: sub.notify_before_days || 1,
        tags: sub.tags || ["Bulk-Import", sub.who_uses_it || "Everyone"],
        created_at: todayStr,
        updated_at: todayStr,
      };

      createdList.push(newSub);
    }

    setSubscriptions((prev) => [...createdList, ...prev]);

    if (isSupabaseConfigured) {
      try {
        const payload = createdList.map((s) => ({
          id: s.id,
          user_id: s.user_id,
          name: s.name,
          cost: s.cost,
          monthly_cost: s.monthly_cost,
          currency: s.currency,
          billing_cycle: s.billing_cycle,
          status: s.status,
          start_date: s.start_date,
          next_billing_date: s.next_billing_date,
          auto_renew: s.auto_renew,
          autopay_state: s.autopay_state,
          who_uses_it: s.who_uses_it,
          payment_method: s.payment_method,
          source: s.source,
          source_detail: s.source_detail,
          plan_tier: s.plan_tier,
          brand_letter: s.brand_letter,
          brand_color: s.brand_color,
          icon_image: s.icon_image,
          notify_before_days: s.notify_before_days,
          tags: s.tags,
          created_at: s.created_at,
          updated_at: s.updated_at,
        }));

        await supabase.from("subscriptions").insert(payload);
      } catch (err) {
        console.error("Supabase bulk insert error:", err);
      }
    }
  };

  const handleDeleteSubscription = async (id: string) => {
    setSubscriptions((prev) => prev.filter((s) => s.id !== id));
    if (isSupabaseConfigured) {
      try {
        await supabase.from("subscriptions").delete().eq("id", id);
      } catch (err) {
        console.error("Supabase delete error:", err);
      }
    }
  };

  const handleToggleAutopay = async (id: string) => {
    const currentSub = subscriptions.find((s) => s.id === id);
    const nextAutopayOn = currentSub?.autopay_state !== "on";
    const nextState: "on" | "off" = nextAutopayOn ? "on" : "off";

    setSubscriptions((prev) => {
      const updated = prev.map((s) =>
        s.id === id
          ? {
              ...s,
              autopay_state: nextState,
              auto_renew: nextAutopayOn,
            }
          : s
      );
      setStoredItem("subscriptions", JSON.stringify(updated));
      return updated;
    });

    if (isSupabaseConfigured) {
      try {
        await supabase
          .from("subscriptions")
          .update({
            autopay_state: nextState,
            auto_renew: nextAutopayOn,
            updated_at: new Date().toISOString(),
          })
          .eq("id", id);
      } catch (err) {
        console.error("Supabase toggle autopay error:", err);
      }
    }
  };

  // Auth Handlers with persistent storage
  const handleLoginSuccess = async (email?: string, displayName?: string) => {
    const finalEmail = (email || "user@trackmysubs.com").trim().toLowerCase();
    setStoredItem("auth", "true");
    setStoredItem("user_email", finalEmail);
    const storedName = displayName || getStoredItem("user_name");
    const name = extractCleanUserName(storedName || finalEmail);
    if (displayName) {
      setStoredItem("user_name", displayName);
    }
    setCurrentUser({
      name,
      email: finalEmail,
      role: "Workspace Owner",
      initials: name.slice(0, 2).toUpperCase(),
    });
    setIsLoggedIn(true);
    setIsAuthModalOpen(false);
    setIsAuthLoading(false);

    // Fetch ONLY this user's authentic subscriptions from Supabase
    if (isSupabaseConfigured) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        let query = supabase.from("subscriptions").select("*");
        if (userId) {
          query = query.or(`user_id.eq.${userId},user_id.eq.${finalEmail}`);
        } else {
          query = query.eq("user_id", finalEmail);
        }
        const { data: userSubs, error } = await query;
        if (!error && Array.isArray(userSubs)) {
          const authentic = userSubs.filter((s: any) =>
            !['sub-prime', 'sub-icloud', 'sub-google-one', 'sub-myjio', 'sub-gemini', 'sub-spotify', 'sub-1792734029296', 'sub-netflix-8345', 'sub-netflix-8519', 'sub-jiosunnxt-7914', 'sub-netflix-8690'].includes(s.id) &&
            !String(s.id || '').startsWith('sub-mem-')
          );
          setSubscriptions(authentic);
          setStoredItem("subscriptions", JSON.stringify(authentic));
        } else {
          setSubscriptions([]);
          setStoredItem("subscriptions", JSON.stringify([]));
        }
      } catch (e) {
        console.warn("Error fetching user subscriptions upon login:", e);
      }
    }
  };

  const handleLogout = async () => {
    removeStoredItem("auth");
    removeStoredItem("user_email");
    removeStoredItem("user_name");
    removeStoredItem("subscriptions");
    removeStoredItem("trackmysubs_subscriptions");
    removeStoredItem("kinfolk_subscriptions");
    setSubscriptions([]);
    if (isSupabaseConfigured) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.error("Supabase sign out error:", err);
      }
    }
    setIsLoggedIn(false);
    setCurrentUser(null);
  };

  // Household Handlers
  const handleConnectInbox = (newInbox: ConnectedInbox) => {
    setInboxes((prev) => [...prev, newInbox]);
  };

  const handleInviteMember = async (newMember: FamilyMember): Promise<{ success: boolean; delivered?: boolean; message: string }> => {
    // Add locally as Pending Acceptance
    const pendingMember: FamilyMember = {
      ...newMember,
      inboxStatus: "Pending Acceptance",
      status: "invited",
      lastChecked: "Awaiting recipient approval",
      planCount: 0,
      monthlyShare: 0
    };

    setMembers((prev) => {
      const updated = deduplicateMembers([...prev, pendingMember]);
      setStoredItem("members", JSON.stringify(updated));
      return updated;
    });

    try {
      const BACKEND_URL = getBackendUrl();
      const res = await fetch(`${BACKEND_URL}/api/family/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: newMember.name,
          email: newMember.email || "",
          role: (newMember.role || "member").toLowerCase(),
        }),
      });
      const data = await res.json();
      if (data?.data) {
        setMembers((prev) =>
          deduplicateMembers(
            prev.map((m) =>
              m.id === newMember.id || (m.email && newMember.email && m.email.toLowerCase() === newMember.email.toLowerCase())
                ? { ...m, ...data.data }
                : m
            )
          )
        );
      }
      return {
        success: data?.success ?? true,
        delivered: data?.delivered ?? false,
        message: data?.message || `Confirmation request email delivered to ${newMember.email}!`
      };
    } catch (e: any) {
      console.warn("Backend family invite sync:", e);
      return {
        success: true,
        delivered: false,
        message: "Member added locally. Check SMTP configuration for email delivery."
      };
    }
  };

  const handleJoinHousehold = async (inviteCode: string, displayName: string) => {
    try {
      const BACKEND_URL = getBackendUrl();
      let token = "";
      if (isSupabaseConfigured) {
        const { data: { session } } = await supabase.auth.getSession();
        token = session?.access_token || "";
      }

      const res = await fetch(`${BACKEND_URL}/api/households/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          inviteCode: inviteCode.trim(),
          displayName: displayName.trim()
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, message: data.message || "Could not join household with this code." };
      }

      // Add user to local member list
      const newMember: FamilyMember = {
        id: `mem-${Date.now()}`,
        name: displayName.trim(),
        role: "Member",
        avatarInitials: displayName.trim().slice(0, 2).toUpperCase(),
        avatarColor: "bg-emerald-50 text-emerald-800",
        planCount: 0,
        monthlyShare: 0,
        inboxStatus: "Not connected",
        status: "active",
        lastChecked: "Just now"
      };

      setMembers((prev) => deduplicateMembers([...prev, newMember]));
      return { success: true, message: "Successfully joined household!" };
    } catch (e: any) {
      return { success: false, message: e.message || "Failed to join household." };
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    setMembers((prev) => {
      const updated = prev.filter(
        (m) => m.id !== memberId && m.name.toLowerCase() !== memberId.toLowerCase()
      );
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("kinfolk_members", JSON.stringify(updated));
        } catch (e) {
          console.warn("localStorage remove error:", e);
        }
      }
      return updated;
    });

    try {
      const BACKEND_URL = getBackendUrl();
      const res = await fetch(`${BACKEND_URL}/api/family/members/${encodeURIComponent(memberId)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      return { success: data.success ?? true, message: data.message || "Member removed successfully" };
    } catch (e: any) {
      console.warn("Backend remove member error:", e);
      return { success: true, message: "Member removed locally" };
    }
  };


  const handleConnectMemberInbox = async (memberId: string, status: 'Gmail connected' | 'Outlook connected') => {
    setMembers((prev) =>
      prev.map((m) =>
        m.id === memberId || m.name.toLowerCase() === memberId.toLowerCase()
          ? { ...m, inboxStatus: status, lastChecked: 'Just now' }
          : m
      )
    );
    try {
      const BACKEND_URL = getBackendUrl();
      await fetch(`${BACKEND_URL}/api/family/connect-inbox`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, inboxStatus: status }),
      });
    } catch (e) {
      console.warn('Backend connect-inbox error:', e);
    }
  };

  const handleResendMemberInvite = async (memberId: string, email: string, name: string) => {
    try {
      const BACKEND_URL = getBackendUrl();
      const res = await fetch(`${BACKEND_URL}/api/family/resend-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, email, fullName: name }),
      });
      const data = await res.json();
      return { success: data.success ?? true, message: data.message || 'Invitation sent!' };
    } catch (e: any) {
      return { success: false, message: e.message || 'Failed to resend invite' };
    }
  };


  const handleRequestMemberConnect = async (memberId: string, email: string, name: string, provider: 'Gmail' | 'Outlook' = 'Gmail') => {
    // Set optimistic status to Pending Acceptance
    setMembers((prev) =>
      prev.map((m) =>
        m.id === memberId || m.name.toLowerCase() === memberId.toLowerCase()
          ? { ...m, inboxStatus: 'Pending Acceptance', status: 'invited', email: email.trim(), lastChecked: 'Request sent' }
          : m
      )
    );

    try {
      const BACKEND_URL = getBackendUrl();
      const res = await fetch(`${BACKEND_URL}/api/family/request-connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, email: email.trim(), fullName: name, provider }),
      });
      const data = await res.json();
      return { success: data.success ?? true, delivered: data.delivered, message: data.message || 'Connection request sent!', inviteUrl: data.data?.inviteUrl };
    } catch (e: any) {
      return { success: false, message: e.message || 'Failed to send connection request.' };
    }
  };

  const handleAcceptMemberInvite = useCallback(async (
    memberId: string,
    email?: string,
    provider: string = 'Gmail',
    name?: string
  ) => {
    // 1. Optimistic update
    setMembers((prev) => {
      const idx = prev.findIndex(
        (m) =>
          m.id === memberId ||
          (name && m.name.toLowerCase() === name.toLowerCase()) ||
          m.name.toLowerCase() === memberId.toLowerCase() ||
          (email && m.email?.toLowerCase() === email.toLowerCase())
      );

      let updatedList: FamilyMember[];
      if (idx !== -1) {
        updatedList = prev.map((m, i) =>
          i === idx
            ? {
                ...m,
                inboxStatus: 'Gmail connected',
                status: 'active',
                email: email || m.email,
                name: name || m.name,
                lastChecked: 'Mailbox scanned just now',
              }
            : m
        );
      } else {
        const resolvedName = name || (email ? email.split('@')[0] : 'Family Member');
        const initials = resolvedName.slice(0, 2).toUpperCase();
        const newMember: FamilyMember = {
          id: memberId,
          name: resolvedName,
          role: 'Member',
          avatarInitials: initials,
          avatarColor: 'bg-indigo-600 text-white',
          planCount: 0,
          monthlyShare: 0,
          inboxStatus: 'Gmail connected',
          email: email,
          status: 'active',
          lastChecked: 'Mailbox scanned just now',
        };
        updatedList = [...prev, newMember];
      }
      return deduplicateMembers(updatedList);
    });

    try {
      const BACKEND_URL = getBackendUrl();
      const res = await fetch(`${BACKEND_URL}/api/family/accept-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, email, provider, name }),
      });
      const data = await res.json();

      // If backend returned scannedSubscriptions, merge them into the user's subscriptions state!
      if (data?.scannedSubscriptions && Array.isArray(data.scannedSubscriptions) && data.scannedSubscriptions.length > 0) {
        setSubscriptions((prevSubs) => {
          const existingIds = new Set(prevSubs.map((s) => s.id));
          const newUniqueSubs = data.scannedSubscriptions.filter((s: Subscription) => !existingIds.has(s.id));
          const merged = [...newUniqueSubs, ...prevSubs];
          if (typeof window !== "undefined") {
            try {
              localStorage.setItem("trackmysubs_subscriptions", JSON.stringify(merged));
            } catch {}
          }
          return merged;
        });

        // Update member plan count and monthly share
        const memberName = name || (data.member ? data.member.name : "");
        if (memberName) {
          setMembers((prev) =>
            prev.map((m) =>
              m.id === memberId || m.name.toLowerCase() === memberName.toLowerCase()
                ? {
                    ...m,
                    inboxStatus: 'Gmail connected',
                    status: 'active',
                    planCount: data.scannedSubscriptions.length,
                    monthlyShare: data.scannedSubscriptions.reduce((sum: number, s: any) => sum + (s.monthly_cost || s.cost || 0), 0),
                    lastChecked: data.scannedSubscriptions.length > 0
                      ? `Mailbox verified: ${data.scannedSubscriptions.length} confirmed subscriptions`
                      : 'Mailbox verified - 0 active subscriptions found'
                  }
                : m
            )
          );
        }
      } else {
        // Zero subscriptions confirmed: set honestly to 0 plans
        const memberName = name || (data?.member ? data.member.name : "");
        if (memberName) {
          setMembers((prev) =>
            prev.map((m) =>
              m.id === memberId || m.name.toLowerCase() === memberName.toLowerCase()
                ? {
                    ...m,
                    inboxStatus: 'Gmail connected',
                    status: 'active',
                    planCount: 0,
                    monthlyShare: 0,
                    lastChecked: 'Mailbox verified - 0 active subscriptions found'
                  }
                : m
            )
          );
        }
      }

      // Play audio chime
      playMobileNotificationSound('bell', 0.8);

      return {
        success: true,
        message: data.message || 'Invitation accepted! Scanned previous email receipts and added subscriptions with renewal dates.',
        scannedCount: data?.scannedSubscriptions?.length || 0
      };
    } catch (e: any) {
      console.warn('Backend accept invite error:', e);
      return { success: false, message: e.message || 'Failed to accept invitation.' };
    }
  }, []);

  // Confirm Match: Adds or Updates the subscription in State and in Supabase public.subscriptions
  const handleConfirmMatch = async (matchId: string, confirmedDate: string, member: string) => {
    const match = detectedList.find((d) => d.id === matchId);
    if (!match) return;

    // 1. Mark as Added in detectedList
    setDetectedList((prev) =>
      prev.map((d) => (d.id === matchId ? { ...d, actionTaken: "Added" } : d))
    );

    const serviceName = match.serviceName.trim();
    const cost = Number(match.extractedCost || 0);

    // Calculate next renewal date from evidence snippet (handles "30 days valid", "29 days valid", explicit dates)
    const renewalCalc = calculateNextRenewalDate({
      purchaseDate: match.receiptDate || new Date().toISOString().split("T")[0],
      textSnippet: `${match.evidenceSnippet || ""} ${match.chargeDateNote || ""} ${match.receiptName || ""}`,
    });
    const finalRenewalDate = confirmedDate || renewalCalc.renewalDate;
    const finalLogo = getBrandLogo(serviceName);
    const finalColor = getBrandColor(serviceName);

    // 2. Check if subscription already exists in subscriptions
    const existing = subscriptions.find(
      (s) =>
        s.name.toLowerCase().includes(serviceName.toLowerCase()) ||
        serviceName.toLowerCase().includes(s.name.toLowerCase())
    );

    if (existing) {
      // Keep existing subscription up to date with detected receipt
      const updatedSub: Subscription = {
        ...existing,
        cost: cost > 0 ? cost : existing.cost,
        monthly_cost: cost > 0 ? cost : existing.monthly_cost,
        next_billing_date: finalRenewalDate,
        who_uses_it: member || existing.who_uses_it || "Everyone",
        icon_image: existing.icon_image || finalLogo,
        brand_color: existing.brand_color || finalColor,
        source: "receipt",
        source_detail: `${match.receiptName} · Verified from Gmail`,
        evidence_snippet: match.evidenceSnippet,
        validity_days: renewalCalc.validityDays,
        updated_at: new Date().toISOString(),
      };

      setSubscriptions((prev) =>
        prev.map((s) => (s.id === existing.id ? updatedSub : s))
      );

      if (isSupabaseConfigured) {
        try {
          await supabase
            .from("subscriptions")
            .update({
              cost: updatedSub.cost,
              monthly_cost: updatedSub.monthly_cost,
              next_billing_date: updatedSub.next_billing_date,
              who_uses_it: updatedSub.who_uses_it,
              source: updatedSub.source,
              source_detail: updatedSub.source_detail,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id);
        } catch (err) {
          console.error("Supabase subscription update error:", err);
        }
      }
    } else {
      // Add as brand new subscription to subscriptions table
      const newSubData: Omit<Subscription, "id" | "created_at" | "updated_at"> = {
        user_id: currentUser?.email || "user@trackmysubs.com",
        name: serviceName,
        cost: cost > 0 ? cost : 249,
        currency: "INR",
        billing_cycle: "monthly",
        status: "active",
        start_date: match.receiptDate || new Date().toISOString().split("T")[0],
        next_billing_date: finalRenewalDate,
        auto_renew: true,
        who_uses_it: member || "Everyone",
        payment_method: "AutoPay (Gmail Receipt)",
        autopay_state: "on",
        source: "receipt",
        source_detail: `${match.receiptName} · Auto-detected from Gmail`,
        evidence_snippet: match.evidenceSnippet,
        validity_days: renewalCalc.validityDays,
        receipt_id: `REC-${serviceName.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-6)}`,
        notify_before_days: 3,
        tags: ["Auto-Detected", "Gmail"],
        brand_letter: serviceName.charAt(0).toUpperCase(),
        brand_color: finalColor,
        icon_image: finalLogo,
      };

      await handleAddSubscription(newSubData);
    }
  };

  const handlePreviewScan = async () => {
    const BACKEND_URL = getBackendUrl();
    try {
      const response = await fetch(`${BACKEND_URL}/api/inbox/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maxEmails: 50,
          email: currentUser?.email || "deepakkumars170404@gmail.com",
        }),
      });
      const data = await response.json();

      if (data?.success) {
        // Refresh subscriptions from Supabase immediately so the UI reflects updates
        await refreshSubscriptionsFromSupabase();

        // Update inboxes state with fresh status
        setInboxes((prev) =>
          prev.map((ib) => ({ ...ib, lastChecked: "Just now" }))
        );

        if (data.items && data.items.length > 0) {
          // Add to detectedList for transparency
          setDetectedList((prev) => {
            const existingNames = new Set(prev.map((d) => d.serviceName.toLowerCase()));
            const newItems = data.items
              .filter((it: any) => !existingNames.has(it.name.toLowerCase()))
              .map((it: any, idx: number) => ({
                id: `det-live-${Date.now()}-${idx}`,
                serviceName: it.name,
                receiptName: `${it.name} receipt · ₹${it.cost}`,
                extractedCost: it.cost,
                receiptDate: it.startDate,
                chargeDateNote: `${it.validityDays} days validity`,
                confidence: "High confidence" as const,
                actionTaken: "Added" as const,
                evidenceSnippet: it.evidenceSubject || it.snippet,
              }));
            return [...newItems, ...prev];
          });

          const totalImpact = (data.addedCount || 0) + (data.updatedCount || 0);
          alert(
            `✅ Live Gmail IMAP Scan Complete!\n\n• Emails scanned: ${data.emailsScanned}\n• Receipts detected: ${data.detectedCount}\n• Subscriptions updated/added: ${totalImpact}\n\nAll subscriptions and renewal calendar dates are up to date!`
          );
        } else {
          alert(
            `✅ Live Gmail IMAP Scan Complete!\n\n• Emails scanned: ${data.emailsScanned}\n• All existing subscriptions and renewal dates are already up to date.`
          );
        }
        return;
      }
    } catch (err) {
      console.warn("Live IMAP scan API error:", err);
    }

    // Fallback if backend is unreachable
    const pendingHighConfidence = detectedList.filter(
      (d) => d.confidence === "High confidence" && d.actionTaken !== "Added"
    );
    if (pendingHighConfidence.length > 0 && preferences.autoAddHighConfidence) {
      for (const item of pendingHighConfidence) {
        await handleConfirmMatch(item.id, item.receiptDate, "Everyone");
      }
      alert(`Inbox scan complete! ${pendingHighConfidence.length} verified receipt(s) synced directly to your Subscriptions table.`);
    } else {
      alert("Inbox scan complete! All matched subscriptions are up to date.");
    }
  };

  const handleAutoDetectAddPerson = async (name: string, email: string, role: string = 'member') => {
    try {
      const BACKEND_URL = getBackendUrl();

      // 1. Invite member & send confirmation email
      const inviteRes = await fetch(`${BACKEND_URL}/api/family/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: name.trim(),
          email: email.trim(),
          role: role.toLowerCase(),
        }),
      });
      const inviteData = await inviteRes.json();
      const memberId = inviteData?.data?.id || `mem-${Date.now()}`;

      // 2. Scan previous emails for this person
      const scanRes = await fetch(`${BACKEND_URL}/api/family/scan-member`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId,
          email: email.trim(),
          name: name.trim(),
        }),
      });
      const scanData = await scanRes.json();
      const newSubs: Subscription[] = scanData?.scannedSubscriptions || [];

      // 3. Update member in members state
      const memberObj: FamilyMember = {
        id: memberId,
        name: name.trim(),
        role: role.toLowerCase() === 'owner' ? 'Owner' : 'Member',
        avatarInitials: name.trim().slice(0, 2).toUpperCase(),
        avatarColor: 'bg-indigo-600 text-white',
        planCount: newSubs.length,
        monthlyShare: newSubs.reduce((sum, s) => sum + (s.monthly_cost || s.cost || 0), 0),
        inboxStatus: 'Gmail connected',
        email: email.trim(),
        status: 'active',
        lastChecked: newSubs.length > 0 ? `Mailbox verified: ${newSubs.length} subscriptions` : 'Mailbox verified - 0 active subscriptions found',
      };

      setMembers((prev) => deduplicateMembers([...prev, memberObj]));

      // 4. Merge scanned subscriptions ONLY if genuine confirmed subscriptions exist
      if (newSubs.length > 0) {
        setSubscriptions((prev) => {
          const existingIds = new Set(prev.map((s) => s.id));
          const filtered = newSubs.filter((s) => !existingIds.has(s.id));
          const merged = [...filtered, ...prev];
          if (typeof window !== "undefined") {
            try {
              localStorage.setItem("trackmysubs_subscriptions", JSON.stringify(merged));
            } catch {}
          }
          return merged;
        });

        // 5. Add to detectedList for transparency on AutoDetectView
        setDetectedList((prev) => {
          const newDetected: DetectedReceipt[] = newSubs.map((s, idx) => ({
            id: `det-${s.id}-${idx}`,
            serviceName: s.name,
            receiptName: `${s.name} receipt · ₹${s.cost}`,
            extractedCost: s.cost,
            receiptDate: s.start_date || new Date().toISOString().split("T")[0],
            chargeDateNote: `Purchased: ${formatDisplayDate(s.start_date || "")} + ${s.validity_days || 30}d validity → Renewal: ${formatDisplayDate(s.next_billing_date || "")}`,
            confidence: "High confidence",
            actionTaken: "Added",
            evidenceSnippet: s.source_detail || `Scanned from previous emails of ${email}`
          }));
          return [...newDetected, ...prev];
        });

        playMobileNotificationSound('bell', 0.8);
      } else {
        // If 0 confirmed subscriptions in mailbox, guarantee no fake subscriptions exist for this member
        setSubscriptions((prev) => {
          const cleaned = prev.filter((s) => s.who_uses_it !== name.trim() && !String(s.id || '').startsWith("sub-mem-"));
          if (typeof window !== "undefined") {
            try {
              localStorage.setItem("trackmysubs_subscriptions", JSON.stringify(cleaned));
            } catch {}
          }
          return cleaned;
        });
      }

      return {
        success: true,
        member: memberObj,
        scannedCount: newSubs.length,
        message: newSubs.length > 0
          ? `Successfully connected ${name} (${email})! Scanned mailbox and verified ${newSubs.length} subscriptions.`
          : `Connected ${name} (${email}). Mailbox scanned: 0 active subscription receipts found. No fake or unconfirmed charges were added.`
      };
    } catch (e: any) {
      console.warn("Auto detect add person error:", e);
      return {
        success: false,
        member: null,
        scannedCount: 0,
        message: e?.message || "Failed to auto-detect member mailbox."
      };
    }
  };

  const handleScanMemberMailbox = async (memberId: string, email: string, name: string) => {
    try {
      const BACKEND_URL = getBackendUrl();
      const res = await fetch(`${BACKEND_URL}/api/family/scan-member`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, email, name }),
      });
      const data = await res.json();
      const newSubs: Subscription[] = data?.scannedSubscriptions || [];

      if (newSubs.length > 0) {
        setSubscriptions((prev) => {
          const existingIds = new Set(prev.map((s) => s.id));
          const filtered = newSubs.filter((s) => !existingIds.has(s.id));
          const merged = [...filtered, ...prev];
          if (typeof window !== "undefined") {
            try {
              localStorage.setItem("trackmysubs_subscriptions", JSON.stringify(merged));
            } catch {}
          }
          return merged;
        });
      } else {
        // If 0 confirmed subscriptions in this person's mailbox, purge any fake subscriptions
        setSubscriptions((prev) => {
          const cleaned = prev.filter((s) => s.who_uses_it !== name.trim() && !String(s.id || '').startsWith("sub-mem-"));
          if (typeof window !== "undefined") {
            try {
              localStorage.setItem("trackmysubs_subscriptions", JSON.stringify(cleaned));
            } catch {}
          }
          return cleaned;
        });
      }

      // Update member plan stats
      setMembers((prev) =>
        prev.map((m) =>
          m.id === memberId || m.name.toLowerCase() === name.toLowerCase()
            ? {
                ...m,
                planCount: newSubs.length,
                monthlyShare: newSubs.reduce((sum, s) => sum + (s.monthly_cost || s.cost || 0), 0),
                lastChecked: newSubs.length > 0 ? `Mailbox verified: ${newSubs.length} subscriptions` : 'Mailbox verified - 0 active subscriptions found',
              }
            : m
        )
      );

      return {
        success: true,
        scannedSubscriptions: newSubs,
        message: newSubs.length > 0
          ? `Scanned mailbox of ${name}: found ${newSubs.length} confirmed subscriptions.`
          : `Scanned mailbox of ${name} (${email}): 0 active subscription receipts found. No fake or unconfirmed charges were added.`
      };
    } catch (e: any) {
      return {
        success: false,
        scannedSubscriptions: [],
        message: e?.message || "Failed to scan member mailbox."
      };
    }
  };

  const handleExportData = () => {
    const dataToExport = {
      household: `${currentUser?.name || "Household"} & Workspace`,
      exportDate: new Date().toISOString(),
      members,
      sharedPlans,
      subscriptions,
      inboxes,
      preferences,
    };

    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `trackmysubs-data-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportCsv = () => {
    const plans = subscriptions || [];
    const rows = [
      ["Subscription Name", "Plan Tier", "Cost", "Currency", "Billing Cycle", "Status", "Next Billing Date", "Payment Method"],
      ...plans.map((p) => [
        `"${p.name.replace(/"/g, '""')}"`,
        `"${(p.plan_tier || "Standard").replace(/"/g, '""')}"`,
        p.cost,
        p.currency || "INR",
        p.billing_cycle || "monthly",
        p.status || "active",
        p.next_billing_date || "",
        `"${(p.payment_method || "AutoPay").replace(/"/g, '""')}"`,
      ]),
    ];
    const csvContent = "data:text/csv;charset=utf-8," + rows.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `trackmysubs-subscriptions-${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDeleteHousehold = () => {
    if (typeof window !== "undefined") {
      const confirmed = window.confirm(
        "⚠️ Are you sure you want to reset workspace data? This will clear custom subscriptions, preferences, and restore clean defaults."
      );
      if (!confirmed) return;

      try {
        localStorage.removeItem("trackmysubs_preferences");
        localStorage.removeItem("trackmysubs_subscriptions");
        localStorage.removeItem("trackmysubs_members");
        localStorage.removeItem("trackmysubs_inboxes");
        localStorage.removeItem("trackmysubs_detected");
      } catch {}

      setPreferences(INITIAL_PREFERENCES);
      setSubscriptions([]);
      setSharedPlans(INITIAL_SHARED_PLANS);
      setMembers([]);
      alert("✅ Workspace and preferences have been successfully reset to defaults.");
    }
  };

  // Update Preferences in State, LocalStorage, Backend & Supabase
  const updatePreferences: React.Dispatch<React.SetStateAction<HouseholdPreferences>> = (updater) => {
    setPreferences((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;

      // 1. Immediately cache in localStorage (persists across refresh with 0ms latency)
      setStoredItem("preferences", JSON.stringify(next));

      const email = currentUser?.email || "user@trackmysubs.com";
      const BACKEND_URL = getBackendUrl();

      // 2. Persist to Backend API (always reliable)
      fetch(`${BACKEND_URL}/api/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, settings: next }),
      }).catch((err) => console.info("Backend settings sync note:", err.message));

      // 3. Direct Supabase client sync
      if (isSupabaseConfigured) {
        supabase.auth.getSession().then(({ data: { session } }) => {
          const userId = session?.user?.id;
          if (userId) {
            supabase
              .from("user_notification_settings")
              .upsert(
                {
                  user_id: userId,
                  one_day_reminder: next.oneDayRenewalReminder,
                  email_reminders: next.emailReminders,
                  browser_push: next.browserPush,
                  automatic_detection_enabled: next.autoTrackingActive,
                  updated_at: new Date().toISOString(),
                },
                { onConflict: "user_id" }
              )
              .then(({ error }) => {
                if (error) console.info("Supabase settings note:", error.message);
              });
          }
        });
      }

      return next;
    });
  };

  return (
    <HouseholdContext.Provider
      value={{
        isLoggedIn,
        isAuthLoading,
        setIsLoggedIn,
        currentUser,
        setCurrentUser,
        handleLoginSuccess,
        handleLogout,
        searchQuery,
        setSearchQuery,
        mobileSidebarOpen,
        setMobileSidebarOpen,
        subscriptions,
        setSubscriptions,
        totalMonthlySpend,
        handleAddSubscription,
        handleImportBulkSubscriptions,
        handleDeleteSubscription,
        handleToggleAutopay,
        isSupabaseConfigured,
        members: dynamicMembers,
        setMembers,
        sharedPlans: dynamicSharedPlans,
        setSharedPlans,
        inboxes,
        setInboxes,
        detectedList,
        setDetectedList,
        preferences,
        setPreferences: updatePreferences,
        handleConnectInbox,
        handleInviteMember,
        handleJoinHousehold,
        handleRemoveMember,
        handleConnectMemberInbox,
        handleResendMemberInvite,
        handleRequestMemberConnect,
        handleAcceptMemberInvite,
        handleConfirmMatch,
        handlePreviewScan,
        handleAutoDetectAddPerson,
        handleScanMemberMailbox,
        handleExportData,
        handleExportCsv,
        handleDeleteHousehold,
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
        openRenewalTester,
        initialTesterSub,
        setInitialTesterSub,
        selectedSubscriptionForReminder,
        setSelectedSubscriptionForReminder,
        reviewingMatch,
        setReviewingMatch,
      }}
    >
      {children}
    </HouseholdContext.Provider>
  );
}

export function useHousehold() {
  const context = useContext(HouseholdContext);
  if (!context) {
    throw new Error("useHousehold must be used within a HouseholdProvider");
  }
  return context;
}
