"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Download,
  Bell,
  CheckCircle2,
  AlertCircle,
  Clock,
  Plus,
  Trash2,
  Zap,
  ShoppingBag,
  Tag,
  RotateCcw,
  X,
  SlidersHorizontal,
  Filter,
  Check,
  Sparkles,
  Calculator,
  Search,
  ArrowRight,
  FileText,
  CalendarDays,
  CreditCard,
  User,
  ShieldCheck,
  Volume2,
  ArrowUpRight,
  Layers,
} from "lucide-react";
import { Subscription, CustomCalendarEvent, EventCategoryType } from "@/lib/types";
import { BrandLogo } from "@/lib/logoHelper";
import { useHousehold } from "@/context/HouseholdContext";
import {
  formatDisplayDate,
  parseDateParts,
  getDaysInMonth,
  calculateDaysBetween,
  extractValidityDaysFromText,
  calculateNextRenewalDate,
  addDaysToDate,
  getDaysRemaining,
} from "@/lib/dateCalculator";
import { playMobileNotificationSound } from "@/lib/soundNotification";

interface CalendarViewProps {
  subscriptions: Subscription[];
  onSelectSubscriptionForReminder: (sub: Subscription) => void;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

// Clean preset validity chips for quick selection
const VALIDITY_PRESETS = [
  { label: "28 Days (Telecom)", days: 28 },
  { label: "30 Days (Monthly)", days: 30 },
  { label: "56 Days (2 Months)", days: 56 },
  { label: "84 Days (Telecom)", days: 84 },
  { label: "86 Days (Pack)", days: 86 },
  { label: "90 Days (Quarterly)", days: 90 },
  { label: "365 Days (Annual)", days: 365 },
  { label: "990 Days (Fiber Pack)", days: 990 },
];

export default function CalendarView({
  subscriptions: propSubscriptions,
  onSelectSubscriptionForReminder,
}: CalendarViewProps) {
  const {
    members = [],
    subscriptions: contextSubscriptions,
    handleAddSubscription,
  } = useHousehold();

  // Prefer context subscriptions if available, fallback to props
  const allSubscriptions = useMemo(() => {
    return contextSubscriptions && contextSubscriptions.length > 0
      ? contextSubscriptions
      : propSubscriptions;
  }, [contextSubscriptions, propSubscriptions]);

  // View Mode: Month Grid | Schedule List | Date & Validity Calculator
  const [activeTab, setActiveTab] = useState<"grid" | "schedule" | "calculator">("grid");

  // Calendar Date State (2020 - 2035)
  const now = new Date();
  const [currentYear, setCurrentYear] = useState<number>(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<string>(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
  );

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMember, setFilterMember] = useState<string>("All");
  const [filterCategory, setFilterCategory] = useState<string>("All");

  // Modals & Drawers
  const [isYearMonthPickerOpen, setIsYearMonthPickerOpen] = useState(false);
  const [isDayDrawerOpen, setIsDayDrawerOpen] = useState(false);
  const [isExported, setIsExported] = useState(false);
  const [soundPlayed, setSoundPlayed] = useState(false);

  // Custom Events / Needs state (persisted, zero dummy personas)
  const [customEvents, setCustomEvents] = useState<CustomCalendarEvent[]>([]);

  // Add Event Form inside Day Drawer
  const [eventFormTitle, setEventFormTitle] = useState("");
  const [eventFormCategory, setEventFormCategory] = useState<EventCategoryType>("need");
  const [eventFormCost, setEventFormCost] = useState("");
  const [eventFormAssigned, setEventFormAssigned] = useState("Everyone");
  const [eventFormNote, setEventFormNote] = useState("");

  // Interactive Calculator State
  const [calcServiceName, setCalcServiceName] = useState("Jio 5G Prepaid");
  const [calcCost, setCalcCost] = useState("349");
  const [calcPurchaseDate, setCalcPurchaseDate] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
  );
  const [calcValidityDays, setCalcValidityDays] = useState<number>(28);
  const [calcCustomDaysInput, setCalcCustomDaysInput] = useState<string>("28");
  const [calcWhoUses, setCalcWhoUses] = useState(members[0]?.name || "Me");
  const [calcPasteSnippet, setCalcPasteSnippet] = useState("");
  const [calcSavedSuccess, setCalcSavedSuccess] = useState(false);

  // Load custom events from localStorage (and purge any old dummy records with Alex, Priya, Aarav)
  useEffect(() => {
    try {
      const stored =
        localStorage.getItem("trackmysubs_custom_calendar_events") ||
        localStorage.getItem("kinfolk_custom_calendar_events");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          // Filter out any legacy dummy events
          const sanitized = parsed.filter(
            (e: CustomCalendarEvent) =>
              !e.id?.startsWith("evt-init-") &&
              e.assigned_to !== "Alex" &&
              e.assigned_to !== "Priya" &&
              e.assigned_to !== "Aarav"
          );
          setCustomEvents(sanitized);
          localStorage.setItem("trackmysubs_custom_calendar_events", JSON.stringify(sanitized));
          return;
        }
      }
      setCustomEvents([]);
    } catch {
      setCustomEvents([]);
    }
  }, []);

  const saveEvents = (updated: CustomCalendarEvent[]) => {
    setCustomEvents(updated);
    try {
      localStorage.setItem("trackmysubs_custom_calendar_events", JSON.stringify(updated));
    } catch (err) {
      console.error("Failed to save calendar events to localStorage", err);
    }
  };

  // Helper to determine exact validity days for any subscription with mathematical calendar truth
  const getSubscriptionValidityDays = (sub: Subscription): number => {
    const start = (sub.start_date || "").split("T")[0];
    const next = (sub.next_billing_date || "").split("T")[0];

    // Priority 1: Exact calendar day difference between purchase date and next billing date
    if (start && next && next > start) {
      const diff = calculateDaysBetween(start, next);
      if (diff > 0) return diff;
    }

    if (sub.validity_days && sub.validity_days > 0) return sub.validity_days;
    const parsed = extractValidityDaysFromText(`${sub.plan_tier || ""} ${sub.source_detail || ""}`);
    if (parsed && parsed > 0) return parsed;
    if (sub.name?.toLowerCase().includes("jio") || sub.name?.toLowerCase().includes("airtel")) {
      return 28;
    }
    if (sub.billing_cycle === "yearly") return 365;
    if (sub.billing_cycle === "quarterly") return 90;
    if (sub.billing_cycle === "weekly") return 7;
    return 30; // standard monthly
  };

  // Helper to guarantee purchase date, validity cycle, and renewal date are 100% mathematically consistent
  const getConsistentPurchaseDate = (startDate?: string | null, renewalDate?: string | null, validityDays?: number): string => {
    const cleanRenewal = (renewalDate || "").split("T")[0];
    const cleanStart = (startDate || "").split("T")[0];
    const validity = validityDays && validityDays > 0 ? validityDays : 30;

    if (cleanStart && cleanRenewal) {
      const diff = calculateDaysBetween(cleanStart, cleanRenewal);
      if (diff === validity) return cleanStart;
    }

    if (cleanRenewal) {
      return addDaysToDate(cleanRenewal, -validity);
    }

    return cleanStart || new Date().toISOString().split("T")[0];
  };

  // Filtered subscriptions based on search query, member, and category
  const filteredSubscriptions = useMemo(() => {
    return allSubscriptions.filter((sub) => {
      // Search term
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = sub.name?.toLowerCase().includes(q);
        const matchesWho = sub.who_uses_it?.toLowerCase().includes(q);
        const matchesTier = sub.plan_tier?.toLowerCase().includes(q);
        if (!matchesName && !matchesWho && !matchesTier) return false;
      }
      // Member filter
      if (filterMember !== "All") {
        if (!sub.who_uses_it || !sub.who_uses_it.toLowerCase().includes(filterMember.toLowerCase())) {
          return false;
        }
      }
      // Category filter
      if (filterCategory !== "All") {
        const catName = sub.category?.name || "";
        if (!catName.toLowerCase().includes(filterCategory.toLowerCase())) {
          return false;
        }
      }
      return true;
    });
  }, [allSubscriptions, searchQuery, filterMember, filterCategory]);

  // Check if a subscription renews on a given day (YYYY-MM-DD)
  const getSubscriptionsForDay = (y: number, m: number, d: number) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    const cellDateStr = `${y}-${pad(m + 1)}-${pad(d)}`;

    return filteredSubscriptions.filter((sub) => {
      const startDate = (sub.start_date || "").split("T")[0];
      const cleanNextDate = (sub.next_billing_date || "").split("T")[0];

      // A plan cannot renew before its purchase date
      if (startDate && cellDateStr < startDate) {
        return false;
      }

      // Exact match with its explicit next renewal date
      if (cleanNextDate && cellDateStr === cleanNextDate) {
        return true;
      }

      // Exact recurring cycles forwards from cleanNextDate or startDate
      const validityDays = getSubscriptionValidityDays(sub);

      if (cleanNextDate && cellDateStr > cleanNextDate) {
        const diffDays = calculateDaysBetween(cleanNextDate, cellDateStr);
        if (diffDays > 0 && diffDays % validityDays === 0) {
          return true;
        }
      }

      if (startDate && cellDateStr > startDate && !cleanNextDate) {
        const diffFromStart = calculateDaysBetween(startDate, cellDateStr);
        if (diffFromStart > 0 && diffFromStart % validityDays === 0) {
          return true;
        }
      }

      return false;
    });
  };

  const getCustomEventsForDay = (dateStr: string) => {
    return customEvents.filter((item) => item.date === dateStr);
  };

  // Month navigation
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentYear((prev) => prev - 1);
      setCurrentMonth(11);
    } else {
      setCurrentMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentYear((prev) => prev + 1);
      setCurrentMonth(0);
    } else {
      setCurrentMonth((prev) => prev + 1);
    }
  };

  const handleResetToToday = () => {
    const t = new Date();
    setCurrentYear(t.getFullYear());
    setCurrentMonth(t.getMonth());
    const pad = (n: number) => String(n).padStart(2, "0");
    const todayStr = `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
    setSelectedDate(todayStr);
  };

  // Calendar Grid Cells (Mon - Sun)
  const calendarGrid = useMemo(() => {
    const daysInCurrentMonth = getDaysInMonth(currentYear, currentMonth + 1);
    const daysInPrevMonth = getDaysInMonth(
      currentMonth === 0 ? currentYear - 1 : currentYear,
      currentMonth === 0 ? 12 : currentMonth
    );
    const firstDayIndex = (new Date(currentYear, currentMonth, 1).getDay() + 6) % 7;

    const pad = (n: number) => String(n).padStart(2, "0");
    const cells = [];

    // Prev month padding
    const prevMonthIdx = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevYearVal = currentMonth === 0 ? currentYear - 1 : currentYear;
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const dateStr = `${prevYearVal}-${pad(prevMonthIdx + 1)}-${pad(dayNum)}`;
      const subs = getSubscriptionsForDay(prevYearVal, prevMonthIdx, dayNum);
      const evts = getCustomEventsForDay(dateStr);
      const daySpend = subs.reduce((a, s) => a + s.cost, 0) + evts.reduce((a, e) => a + (e.cost || 0), 0);
      cells.push({
        day: dayNum,
        monthIdx: prevMonthIdx,
        year: prevYearVal,
        isCurrentMonth: false,
        dateString: dateStr,
        subscriptions: subs,
        events: evts,
        daySpend,
      });
    }

    // Current month days
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      const dateStr = `${currentYear}-${pad(currentMonth + 1)}-${pad(d)}`;
      const subs = getSubscriptionsForDay(currentYear, currentMonth, d);
      const evts = getCustomEventsForDay(dateStr);
      const daySpend = subs.reduce((a, s) => a + s.cost, 0) + evts.reduce((a, e) => a + (e.cost || 0), 0);
      cells.push({
        day: d,
        monthIdx: currentMonth,
        year: currentYear,
        isCurrentMonth: true,
        dateString: dateStr,
        subscriptions: subs,
        events: evts,
        daySpend,
      });
    }

    // Next month padding
    const totalCells = cells.length > 35 ? 42 : 35;
    const remaining = totalCells - cells.length;
    const nextMonthIdx = currentMonth === 11 ? 0 : currentMonth + 1;
    const nextYearVal = currentMonth === 11 ? currentYear + 1 : currentYear;
    for (let d = 1; d <= remaining; d++) {
      const dateStr = `${nextYearVal}-${pad(nextMonthIdx + 1)}-${pad(d)}`;
      const subs = getSubscriptionsForDay(nextYearVal, nextMonthIdx, d);
      const evts = getCustomEventsForDay(dateStr);
      const daySpend = subs.reduce((a, s) => a + s.cost, 0) + evts.reduce((a, e) => a + (e.cost || 0), 0);
      cells.push({
        day: d,
        monthIdx: nextMonthIdx,
        year: nextYearVal,
        isCurrentMonth: false,
        dateString: dateStr,
        subscriptions: subs,
        events: evts,
        daySpend,
      });
    }

    return cells;
  }, [currentYear, currentMonth, filteredSubscriptions, customEvents]);

  // Selected Day Items for Drawer
  const selectedDayData = useMemo(() => {
    const parts = selectedDate.split("-");
    if (parts.length !== 3) return { subs: [], evts: [], totalSpend: 0 };
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);

    const subs = getSubscriptionsForDay(y, m, d);
    const evts = getCustomEventsForDay(selectedDate);
    const totalSpend =
      subs.reduce((acc, s) => acc + s.cost, 0) +
      evts.reduce((acc, e) => acc + (e.cost || 0), 0);

    return { subs, evts, totalSpend };
  }, [selectedDate, filteredSubscriptions, customEvents]);

  // Overall Selected Month Statistics
  const monthStats = useMemo(() => {
    const daysInMonth = getDaysInMonth(currentYear, currentMonth + 1);
    const pad = (n: number) => String(n).padStart(2, "0");
    let totalSpend = 0;
    const uniqueSubIds = new Set<string>();
    let totalEvents = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${currentYear}-${pad(currentMonth + 1)}-${pad(d)}`;
      const subs = getSubscriptionsForDay(currentYear, currentMonth, d);
      const evts = getCustomEventsForDay(dateStr);
      subs.forEach((s) => {
        totalSpend += s.cost;
        uniqueSubIds.add(s.id);
      });
      evts.forEach((e) => {
        totalSpend += e.cost || 0;
        totalEvents += 1;
      });
    }

    // Find nearest upcoming renewal in general
    const sorted = [...allSubscriptions].sort(
      (a, b) => new Date(a.next_billing_date).getTime() - new Date(b.next_billing_date).getTime()
    );
    const nextImminent = sorted[0] || null;

    return {
      totalSpend,
      renewalsCount: uniqueSubIds.size,
      eventsCount: totalEvents,
      nextImminent,
      avgPerPlan: uniqueSubIds.size > 0 ? Math.round(totalSpend / uniqueSubIds.size) : 0,
    };
  }, [currentYear, currentMonth, filteredSubscriptions, allSubscriptions, customEvents]);

  // Today Date String
  const todayStr = useMemo(() => {
    const t = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
  }, []);

  // Formatted selected date
  const formattedSelectedDate = useMemo(() => {
    return formatDisplayDate(selectedDate);
  }, [selectedDate]);

  // Handle cell click -> select date & open day drawer
  const handleCellClick = (dateStr: string) => {
    setSelectedDate(dateStr);
    setIsDayDrawerOpen(true);
  };

  // Add Custom Event / Bill to selected date
  const handleAddCustomEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventFormTitle.trim()) return;

    const newEvt: CustomCalendarEvent = {
      id: "evt-" + Date.now(),
      date: selectedDate,
      title: eventFormTitle.trim(),
      category: eventFormCategory,
      cost: eventFormCost ? parseFloat(eventFormCost) : undefined,
      priority: "normal",
      assigned_to: eventFormAssigned,
      note: eventFormNote.trim() || undefined,
      created_at: new Date().toISOString(),
    };

    saveEvents([...customEvents, newEvt]);
    setEventFormTitle("");
    setEventFormCost("");
    setEventFormNote("");
  };

  const handleRemoveEvent = (id: string) => {
    saveEvents(customEvents.filter((e) => e.id !== id));
  };

  // Handle iCal Download
  const handleDownloadCalendar = () => {
    let icsEvents = "";
    filteredSubscriptions.forEach((sub) => {
      const cleanDate = (sub.next_billing_date || "").replace(/-/g, "");
      icsEvents += `BEGIN:VEVENT\nSUMMARY:Renewal: ${sub.name} (₹${sub.cost})\nDESCRIPTION:Renewal for ${sub.name}. Used by: ${sub.who_uses_it || "Family"}. Plan: ${sub.plan_tier || "Standard"}\nDTSTART;VALUE=DATE:${cleanDate}\nDTEND;VALUE=DATE:${cleanDate}\nSTATUS:CONFIRMED\nEND:VEVENT\n`;
    });

    const icsContent = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//TrackmySubs//Renewal Calendar//EN\nCALSCALE:GREGORIAN\n${icsEvents}END:VCALENDAR`;
    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `trackmysubs-renewals-${MONTH_SHORT[currentMonth]}-${currentYear}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setIsExported(true);
    setTimeout(() => setIsExported(false), 3000);
  };

  // Test Sound & Alert
  const handleTestAlert = () => {
    playMobileNotificationSound("bell", 1.0);
    setSoundPlayed(true);
    setTimeout(() => setSoundPlayed(false), 2500);
  };

  // Parse pasted receipt text in calculator
  const handleParseReceipt = () => {
    if (!calcPasteSnippet.trim()) return;
    const text = calcPasteSnippet;

    // Extract days
    const days = extractValidityDaysFromText(text);
    if (days && days > 0) {
      setCalcValidityDays(days);
      setCalcCustomDaysInput(String(days));
    }

    // Extract amount
    const costMatch = text.match(/(?:rs\.?|inr|₹)\s*(\d+(?:\.\d+)?)/i) || text.match(/(\d+)\s*(?:rs|rupees)/i);
    if (costMatch && costMatch[1]) {
      setCalcCost(costMatch[1]);
    }

    // Extract service name
    const lower = text.toLowerCase();
    if (lower.includes("jio")) setCalcServiceName("Jio 5G Prepaid");
    else if (lower.includes("airtel")) setCalcServiceName("Airtel Broadband / 5G");
    else if (lower.includes("vi ") || lower.includes("vodafone")) setCalcServiceName("Vi Unlimited Pack");
    else if (lower.includes("hotstar")) setCalcServiceName("Disney+ Hotstar Super");
    else if (lower.includes("netflix")) setCalcServiceName("Netflix Premium 4K");
    else if (lower.includes("spotify")) setCalcServiceName("Spotify Premium Individual");
    else if (lower.includes("prime") || lower.includes("amazon")) setCalcServiceName("Amazon Prime Annual");
    else if (lower.includes("youtube")) setCalcServiceName("YouTube Premium");

    // Extract date if present
    const dateMatch = text.match(/(\d{4}-\d{2}-\d{2})/);
    if (dateMatch && dateMatch[1]) {
      setCalcPurchaseDate(dateMatch[1]);
    } else {
      const altMatch = text.match(/(\d{1,2})[-\s/]([a-zA-Z]{3,9}|\d{1,2})[-\s/](\d{4})/);
      if (altMatch) {
        const parsed = Date.parse(altMatch[0]);
        if (!isNaN(parsed)) {
          const d = new Date(parsed);
          setCalcPurchaseDate(d.toISOString().split("T")[0]);
        }
      }
    }
  };

  // Calculate live renewal result
  const liveCalculationResult = useMemo(() => {
    const days = calcValidityDays > 0 ? calcValidityDays : 30;
    const renewalDate = addDaysToDate(calcPurchaseDate, days);
    const daysRemaining = getDaysRemaining(renewalDate);
    return {
      renewalDate,
      daysRemaining,
      explanation: `${formatDisplayDate(calcPurchaseDate)} + ${days} calendar days = ${formatDisplayDate(renewalDate)}`,
    };
  }, [calcPurchaseDate, calcValidityDays]);

  // Handle Save from Calculator directly into active subscriptions & calendar
  const handleSaveCalculatedSubscription = async () => {
    if (!calcServiceName.trim()) return;
    const costVal = parseFloat(calcCost) || 0;

    const newSubData = {
      user_id: "user-current",
      name: calcServiceName.trim(),
      cost: costVal,
      currency: "INR",
      billing_cycle: (calcValidityDays === 365 ? "yearly" : calcValidityDays === 90 ? "quarterly" : "monthly") as any,
      status: "active" as const,
      start_date: calcPurchaseDate,
      next_billing_date: liveCalculationResult.renewalDate,
      auto_renew: true,
      validity_days: calcValidityDays,
      who_uses_it: calcWhoUses,
      plan_tier: `${calcValidityDays} Days Validity`,
      source_detail: `Calculated from ${calcValidityDays} days validity`,
      notify_before_days: 1,
      payment_method: "AutoPay",
    };

    await handleAddSubscription(newSubData);
    playMobileNotificationSound("bell", 0.9);
    setCalcSavedSuccess(true);
    setTimeout(() => {
      setCalcSavedSuccess(false);
      // Switch back to grid view focused on the newly calculated renewal month
      const parts = liveCalculationResult.renewalDate.split("-");
      if (parts.length === 3) {
        setCurrentYear(parseInt(parts[0], 10));
        setCurrentMonth(parseInt(parts[1], 10) - 1);
        setSelectedDate(liveCalculationResult.renewalDate);
        setActiveTab("grid");
      }
    }, 1200);
  };

  // Jump to subscription renewal date
  const handleJumpToSubscription = (sub: Subscription) => {
    const cleanDate = (sub.next_billing_date || "").split("T")[0];
    if (!cleanDate) return;
    const parts = cleanDate.split("-");
    if (parts.length === 3) {
      setCurrentYear(parseInt(parts[0], 10));
      setCurrentMonth(parseInt(parts[1], 10) - 1);
      setSelectedDate(cleanDate);
      setIsDayDrawerOpen(true);
    }
  };

  // Chronological upcoming subscriptions for Schedule List
  const timelineUpcoming = useMemo(() => {
    const list = [...filteredSubscriptions].map((sub) => {
      const validity = getSubscriptionValidityDays(sub);
      const daysLeft = getDaysRemaining(sub.next_billing_date);
      return {
        ...sub,
        validity,
        daysLeft,
      };
    });

    list.sort((a, b) => new Date(a.next_billing_date).getTime() - new Date(b.next_billing_date).getTime());
    return list;
  }, [filteredSubscriptions]);

  // Grouped timeline for Schedule View
  const groupedTimeline = useMemo(() => {
    const today = todayStr;
    const dueToday: typeof timelineUpcoming = [];
    const dueThisWeek: typeof timelineUpcoming = [];
    const dueThisMonth: typeof timelineUpcoming = [];
    const dueLater: typeof timelineUpcoming = [];

    timelineUpcoming.forEach((item) => {
      const cleanDate = (item.next_billing_date || "").split("T")[0];
      if (cleanDate <= today) {
        dueToday.push(item);
      } else if (item.daysLeft <= 7) {
        dueThisWeek.push(item);
      } else if (item.daysLeft <= 30) {
        dueThisMonth.push(item);
      } else {
        dueLater.push(item);
      }
    });

    return { dueToday, dueThisWeek, dueThisMonth, dueLater };
  }, [timelineUpcoming, todayStr]);

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* EXECUTIVE HEADER & TOP ACTIONS */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs transition">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          {/* Title & Description */}
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                Renewal Calendar &amp; Schedule
              </span>
              <span className="text-xs font-bold text-slate-400">
                {allSubscriptions.length} Plans Active
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Manage &amp; Forecast Renewals
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
              Clear monthly calendar, smart timeline schedule, and instant date validity calculator.
            </p>
          </div>

          {/* Right Action Group */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* View Mode Switcher */}
            <div className="flex items-center p-1 bg-slate-100 rounded-2xl border border-slate-200/80">
              <button
                type="button"
                onClick={() => setActiveTab("grid")}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  activeTab === "grid"
                    ? "bg-white text-indigo-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <CalendarIcon className="w-3.5 h-3.5" />
                <span>Month Grid</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("schedule")}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  activeTab === "schedule"
                    ? "bg-white text-indigo-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span>Schedule List</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("calculator")}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  activeTab === "calculator"
                    ? "bg-white text-indigo-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Calculator className="w-3.5 h-3.5" />
                <span>Calculator &amp; Paste</span>
              </button>
            </div>

            {/* Test Alert Sound */}
            <button
              type="button"
              onClick={handleTestAlert}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              title="Test the 1-Day Prior Renewal Alert Sound"
            >
              <Volume2 className="w-4 h-4 text-indigo-600" />
              <span className="hidden sm:inline">
                {soundPlayed ? "Alert Sounding!" : "Test Alert"}
              </span>
            </button>

            {/* Export .ICS */}
            <button
              type="button"
              onClick={handleDownloadCalendar}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
              title="Export all renewals as .ICS calendar file for Google Calendar, Apple, or Outlook"
            >
              <Download className="w-4 h-4 text-indigo-300" />
              <span>{isExported ? "Exported!" : "Export Calendar"}</span>
            </button>
          </div>
        </div>

        {/* 4 TOP FINANCIAL & FORECAST STAT CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-5 border-t border-slate-100">
          <div className="bg-slate-50/80 rounded-2xl p-3.5 border border-slate-200/60">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              {MONTH_SHORT[currentMonth]} {currentYear} Spend
            </span>
            <div className="text-xl sm:text-2xl font-black text-slate-900 mt-1 font-mono">
              ₹{monthStats.totalSpend.toLocaleString("en-IN")}
            </div>
            <span className="text-[11px] font-semibold text-slate-500 mt-0.5 block">
              Across renewals this month
            </span>
          </div>

          <div className="bg-slate-50/80 rounded-2xl p-3.5 border border-slate-200/60">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Active Plans Due
            </span>
            <div className="text-xl sm:text-2xl font-black text-indigo-600 mt-1">
              {monthStats.renewalsCount} {monthStats.renewalsCount === 1 ? "Plan" : "Plans"}
            </div>
            <span className="text-[11px] font-semibold text-slate-500 mt-0.5 block">
              Scheduled in {MONTH_SHORT[currentMonth]}
            </span>
          </div>

          <div className="bg-slate-50/80 rounded-2xl p-3.5 border border-slate-200/60">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Next Imminent Due
            </span>
            <div className="text-base sm:text-lg font-black text-slate-900 mt-1 truncate">
              {monthStats.nextImminent ? monthStats.nextImminent.name : "None upcoming"}
            </div>
            <span className="text-[11px] font-semibold text-rose-600 mt-0.5 block truncate">
              {monthStats.nextImminent
                ? `${formatDisplayDate(monthStats.nextImminent.next_billing_date)} (₹${monthStats.nextImminent.cost})`
                : "No renewals recorded"}
            </span>
          </div>

          <div className="bg-slate-50/80 rounded-2xl p-3.5 border border-slate-200/60">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Average Plan Cost
            </span>
            <div className="text-xl sm:text-2xl font-black text-slate-900 mt-1 font-mono">
              ₹{monthStats.avgPerPlan.toLocaleString("en-IN")}
            </div>
            <span className="text-[11px] font-semibold text-slate-500 mt-0.5 block">
              Per renewing service
            </span>
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-3 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search plans (e.g. Netflix, Jio, Spotify)..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-2.5">
          {/* Member Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <User className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={filterMember}
              onChange={(e) => setFilterMember(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="All">All Members</option>
              {members.map((m) => (
                <option key={m.id} value={m.name}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Jump Today Button */}
          <button
            type="button"
            onClick={handleResetToToday}
            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl transition cursor-pointer"
          >
            Jump to Today
          </button>
        </div>
      </div>

      {/* VIEW 1: MONTH GRID VIEW */}
      {activeTab === "grid" && (
        <div className="bg-white border border-slate-200/90 rounded-3xl shadow-sm overflow-hidden">
          {/* Calendar Month Navigation Header */}
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            {/* Month & Year Title with Dropdown Click */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsYearMonthPickerOpen(true)}
                className="flex items-center gap-2 group px-3 py-1.5 rounded-2xl hover:bg-white border border-transparent hover:border-slate-200 transition cursor-pointer text-left"
                title="Click to jump to any Month & Year"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                      {MONTH_NAMES[currentMonth]} {currentYear}
                    </h2>
                    <ChevronDown className="w-4 h-4 text-slate-500 group-hover:text-indigo-600 transition" />
                  </div>
                  <span className="text-[11px] font-bold text-slate-400">
                    {monthStats.renewalsCount} plans · ₹{monthStats.totalSpend.toLocaleString("en-IN")} total
                  </span>
                </div>
              </button>
            </div>

            {/* Navigation Arrows */}
            <div className="flex items-center gap-1.5 bg-white border border-slate-200/80 rounded-2xl p-1 shadow-2xs">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-2 rounded-xl hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition cursor-pointer"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleResetToToday}
                className="px-3 py-1 rounded-xl hover:bg-slate-100 text-slate-700 text-xs font-bold transition cursor-pointer"
              >
                Today
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-2 rounded-xl hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition cursor-pointer"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Days of Week Header Strip */}
          <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/80 text-center py-2.5 text-xs font-black text-slate-500 tracking-wider uppercase">
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
            <span>Sun</span>
          </div>

          {/* Month Calendar Cells */}
          <div className="grid grid-cols-7 gap-px bg-slate-200/70">
            {calendarGrid.map((cell, idx) => {
              const isSelected = selectedDate === cell.dateString;
              const isToday = cell.dateString === todayStr;
              const hasSubs = cell.subscriptions.length > 0;
              const hasEvents = cell.events.length > 0;

              return (
                <div
                  key={idx}
                  onClick={() => handleCellClick(cell.dateString)}
                  className={`min-h-[105px] sm:min-h-[125px] p-2 flex flex-col justify-between transition-all cursor-pointer bg-white relative group ${
                    isSelected
                      ? "ring-2 ring-indigo-600 z-10 bg-indigo-50/20"
                      : !cell.isCurrentMonth
                      ? "bg-slate-50/50 opacity-45 hover:opacity-85"
                      : "hover:bg-slate-50/80"
                  }`}
                >
                  {/* Top Row: Day Number & Spend Total Badge */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition ${
                        isToday
                          ? "bg-rose-500 text-white font-black shadow-xs ring-2 ring-rose-200"
                          : isSelected
                          ? "bg-indigo-600 text-white font-extrabold"
                          : !cell.isCurrentMonth
                          ? "text-slate-400"
                          : "text-slate-700"
                      }`}
                    >
                      {cell.day}
                    </span>

                    {/* Spend pill if any renewals on this day */}
                    {cell.daySpend > 0 && (
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200/80 font-mono">
                        ₹{cell.daySpend.toLocaleString("en-IN")}
                      </span>
                    )}
                  </div>

                  {/* Middle Area: Subscription Chips with Logos */}
                  <div className="mt-1.5 space-y-1 overflow-hidden">
                    {cell.subscriptions.slice(0, 2).map((sub) => (
                      <div
                        key={sub.id}
                        className="flex items-center gap-1.5 px-1.5 py-1 rounded-xl bg-slate-50 hover:bg-indigo-50 border border-slate-200/80 hover:border-indigo-300 transition text-[11px] font-semibold text-slate-800 shadow-2xs group/chip"
                        title={`${sub.name} - ₹${sub.cost} (Purchased: ${formatDisplayDate(getConsistentPurchaseDate(sub.start_date, sub.next_billing_date, sub.validity_days))}, Renews: ${formatDisplayDate(sub.next_billing_date)})`}
                      >
                        <BrandLogo
                          name={sub.name}
                          iconUrl={sub.icon_image}
                          size="xs"
                          rounded="rounded-md"
                          className="w-4 h-4 shrink-0"
                        />
                        <span className="truncate flex-1 font-bold">{sub.name}</span>
                        <span className="text-[10px] text-slate-500 font-mono font-bold shrink-0">
                          ₹{sub.cost}
                        </span>
                      </div>
                    ))}

                    {/* Custom Notes / Events */}
                    {cell.events.slice(0, 1).map((evt) => (
                      <div
                        key={evt.id}
                        className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold truncate"
                      >
                        <span>{evt.category === "need" ? "🛒" : evt.category === "bill" ? "⚡" : "🔔"}</span>
                        <span className="truncate">{evt.title}</span>
                      </div>
                    ))}

                    {/* Overflow pill if more than 2 items */}
                    {cell.subscriptions.length + cell.events.length > 2 && (
                      <span className="text-[9px] font-bold text-slate-400 block text-right pr-1">
                        +{cell.subscriptions.length + cell.events.length - 2} more
                      </span>
                    )}
                  </div>

                  {/* Bottom Indicator Dot */}
                  <div className="flex items-center justify-end gap-1 pt-1">
                    {hasSubs && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />}
                    {hasEvents && <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer Guide Strip */}
          <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                <span className="font-semibold text-slate-700">Subscription Renewal</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <span className="font-semibold text-slate-700">Custom Reminder / Bill</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-rose-200" />
                <span className="font-semibold text-slate-700">Current Day</span>
              </div>
            </div>

            <span className="font-semibold text-indigo-700">
              💡 Tip: Click any date to open details, set 1-day prior alerts, or add a reminder.
            </span>
          </div>
        </div>
      )}

      {/* VIEW 2: SCHEDULE / TIMELINE VIEW (SUPER EASY FOR ALL PEOPLE) */}
      {activeTab === "schedule" && (
        <div className="space-y-6">
          {/* Urgency Section 1: Due Today or Overdue */}
          {groupedTimeline.dueToday.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
                <h3 className="text-sm font-black text-rose-600 uppercase tracking-wider">
                  Due Today or In Renewal Window ({groupedTimeline.dueToday.length})
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {groupedTimeline.dueToday.map((sub) => (
                  <div
                    key={sub.id}
                    className="bg-white border-2 border-rose-300 rounded-3xl p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between gap-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <BrandLogo name={sub.name} iconUrl={sub.icon_image} size="md" rounded="rounded-2xl" />
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-base font-extrabold text-slate-900">{sub.name}</h4>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-700 uppercase">
                              Due Now
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Used by: <strong className="text-slate-800">{sub.who_uses_it || "Family"}</strong> · Plan: {sub.plan_tier || "Standard"}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-lg font-black text-slate-900 font-mono block">
                          ₹{sub.cost.toLocaleString("en-IN")}
                        </span>
                        <span className="text-[11px] font-bold text-slate-400 capitalize">
                          {sub.billing_cycle || "monthly"}
                        </span>
                      </div>
                    </div>

                    {/* Exact Dates & Calculation Breakdown */}
                    <div className="grid grid-cols-3 gap-2 p-3 bg-rose-50/60 rounded-2xl border border-rose-100 text-xs">
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 block uppercase">Purchased</span>
                        <span className="font-extrabold text-slate-800">
                          {formatDisplayDate(getConsistentPurchaseDate(sub.start_date, sub.next_billing_date, sub.validity))}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 block uppercase">Validity</span>
                        <span className="font-extrabold text-slate-800">
                          {sub.validity} Days Pack
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 block uppercase">Next Renewal</span>
                        <span className="font-black text-rose-700">
                          {formatDisplayDate(sub.next_billing_date)}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={() => onSelectSubscriptionForReminder(sub)}
                        className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition cursor-pointer"
                      >
                        <Bell className="w-3.5 h-3.5" />
                        <span>Set 1-Day Prior Alarm</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleJumpToSubscription(sub)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                      >
                        <span>View on Calendar</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Urgency Section 2: Due in Next 7 Days */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                Due Within Next 7 Days ({groupedTimeline.dueThisWeek.length})
              </h3>
            </div>

            {groupedTimeline.dueThisWeek.length === 0 ? (
              <div className="p-6 bg-white border border-slate-200/80 rounded-3xl text-center text-xs text-slate-500">
                No renewals due in the next 7 days. You are all set!
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {groupedTimeline.dueThisWeek.map((sub) => (
                  <div
                    key={sub.id}
                    className="bg-white border border-amber-200 rounded-3xl p-5 shadow-xs hover:shadow-md transition flex flex-col justify-between gap-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <BrandLogo name={sub.name} iconUrl={sub.icon_image} size="md" rounded="rounded-2xl" />
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-base font-extrabold text-slate-900">{sub.name}</h4>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800">
                              In {sub.daysLeft} {sub.daysLeft === 1 ? "day" : "days"}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Used by: <strong className="text-slate-800">{sub.who_uses_it || "Family"}</strong>
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-lg font-black text-slate-900 font-mono block">
                          ₹{sub.cost.toLocaleString("en-IN")}
                        </span>
                        <span className="text-[11px] font-bold text-slate-400 capitalize">
                          {sub.billing_cycle || "monthly"}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 p-3 bg-amber-50/50 rounded-2xl border border-amber-100 text-xs">
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 block uppercase">Purchased</span>
                        <span className="font-extrabold text-slate-800">
                          {formatDisplayDate(getConsistentPurchaseDate(sub.start_date, sub.next_billing_date, sub.validity))}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 block uppercase">Validity</span>
                        <span className="font-extrabold text-slate-800">
                          {sub.validity} Days
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 block uppercase">Renews On</span>
                        <span className="font-black text-amber-900">
                          {formatDisplayDate(sub.next_billing_date)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={() => onSelectSubscriptionForReminder(sub)}
                        className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition cursor-pointer"
                      >
                        <Bell className="w-3.5 h-3.5" />
                        <span>Configure 1-Day Prior Alert</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleJumpToSubscription(sub)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition cursor-pointer"
                      >
                        <span>Jump to Date</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Urgency Section 3: Due Later This Month & Beyond */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                Upcoming Later ({groupedTimeline.dueThisMonth.length + groupedTimeline.dueLater.length})
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {[...groupedTimeline.dueThisMonth, ...groupedTimeline.dueLater].map((sub) => (
                <div
                  key={sub.id}
                  className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs hover:shadow-md transition flex flex-col justify-between gap-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <BrandLogo name={sub.name} iconUrl={sub.icon_image} size="md" rounded="rounded-2xl" />
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-extrabold text-slate-900">{sub.name}</h4>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                            In {sub.daysLeft} days
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Used by: <strong className="text-slate-800">{sub.who_uses_it || "Family"}</strong>
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-lg font-black text-slate-900 font-mono block">
                        ₹{sub.cost.toLocaleString("en-IN")}
                      </span>
                      <span className="text-[11px] font-bold text-slate-400 capitalize">
                        {sub.billing_cycle || "monthly"}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-100 text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 block uppercase">Purchased</span>
                      <span className="font-extrabold text-slate-800">
                        {formatDisplayDate(getConsistentPurchaseDate(sub.start_date, sub.next_billing_date, sub.validity))}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 block uppercase">Validity</span>
                      <span className="font-extrabold text-slate-800">
                        {sub.validity} Days
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 block uppercase">Renews On</span>
                      <span className="font-black text-indigo-700">
                        {formatDisplayDate(sub.next_billing_date)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => onSelectSubscriptionForReminder(sub)}
                      className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition cursor-pointer"
                    >
                      <Bell className="w-3.5 h-3.5" />
                      <span>Set Reminder</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleJumpToSubscription(sub)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      <span>Show on Calendar</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: DATE & VALIDITY CALCULATOR ("CALCULATE & PASTE") */}
      {activeTab === "calculator" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Quick Paste Receipt Parser */}
            <div className="lg:col-span-5 bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Paste Email / Bill Receipt
                  </h3>
                  <span className="text-xs text-slate-500">
                    Paste raw text to auto-extract purchase date &amp; validity
                  </span>
                </div>
              </div>

              {/* Sample Test Chips */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-slate-400 uppercase">
                  Click a Sample to Test:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: "Jio 28d ₹349", text: "Recharge of Rs.349 successful on 12-Oct-2026. Pack validity: 28days. Unlimited 5G." },
                    { label: "Airtel 56d ₹579", text: "Payment of INR 579 confirmed. High-speed 1.5GB/day with 56 days validity." },
                    { label: "Vi 86d ₹859", text: "Vodafone Idea 86 days pack activated on 2026-10-01 for Rs 859." },
                    { label: "Fiber 990d Long Pack", text: "Broadband fiber advance pack activated. Duration: 990 days. Next billing in 2028." },
                    { label: "Netflix 30d ₹649", text: "Netflix Premium membership renewed for ₹649. Valid for 30 days." },
                  ].map((chip) => (
                    <button
                      key={chip.label}
                      type="button"
                      onClick={() => {
                        setCalcPasteSnippet(chip.text);
                      }}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition cursor-pointer"
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Text Area */}
              <textarea
                rows={4}
                value={calcPasteSnippet}
                onChange={(e) => setCalcPasteSnippet(e.target.value)}
                placeholder="Paste receipt, SMS message, or confirmation text here..."
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
              />

              <button
                type="button"
                onClick={handleParseReceipt}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Extract Details &amp; Calculate Dates</span>
              </button>
            </div>

            {/* Right: Live Interactive Date Calculator & Save */}
            <div className="lg:col-span-7 bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs space-y-5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Calculator className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Live Date &amp; Days Arithmetic Engine
                  </h3>
                  <span className="text-xs text-slate-500">
                    Accurately calculate Purchase Date + Validity Days without timezone drift
                  </span>
                </div>
              </div>

              {/* Form Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Service Name *
                  </label>
                  <input
                    type="text"
                    value={calcServiceName}
                    onChange={(e) => setCalcServiceName(e.target.value)}
                    placeholder="e.g. Jio 5G, Netflix, Airtel"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Cost (₹) *
                  </label>
                  <input
                    type="number"
                    value={calcCost}
                    onChange={(e) => setCalcCost(e.target.value)}
                    placeholder="e.g. 349"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-mono focus:outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Purchase Date *
                  </label>
                  <input
                    type="date"
                    value={calcPurchaseDate}
                    onChange={(e) => setCalcPurchaseDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Who Uses It
                  </label>
                  <select
                    value={calcWhoUses}
                    onChange={(e) => setCalcWhoUses(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                  >
                    {members.map((m) => (
                      <option key={m.id} value={m.name}>
                        {m.name} ({m.role})
                      </option>
                    ))}
                    <option value="Everyone">Everyone / Shared</option>
                  </select>
                </div>
              </div>

              {/* Validity Preset Buttons */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">
                    Validity Duration ({calcValidityDays} Days)
                  </label>
                  <span className="text-xs font-bold text-indigo-600 font-mono">
                    +{calcValidityDays} calendar days
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {VALIDITY_PRESETS.map((p) => (
                    <button
                      key={p.days}
                      type="button"
                      onClick={() => {
                        setCalcValidityDays(p.days);
                        setCalcCustomDaysInput(String(p.days));
                      }}
                      className={`px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer text-center ${
                        calcValidityDays === p.days
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {/* Custom days manual input */}
                <div className="flex items-center gap-2 pt-2">
                  <span className="text-xs text-slate-500 font-medium">Or custom days:</span>
                  <input
                    type="number"
                    min={1}
                    max={3650}
                    value={calcCustomDaysInput}
                    onChange={(e) => {
                      setCalcCustomDaysInput(e.target.value);
                      const n = parseInt(e.target.value, 10);
                      if (!isNaN(n) && n > 0) setCalcValidityDays(n);
                    }}
                    className="w-24 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:bg-white"
                  />
                  <span className="text-xs text-slate-400">days</span>
                </div>
              </div>

              {/* LIVE ARITHMETIC PREVIEW BOX */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50/90 to-purple-50/70 border border-indigo-200/90 space-y-3">
                <span className="text-[11px] font-black text-indigo-700 uppercase tracking-wider block">
                  🎯 Calculated Calendar Output
                </span>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[11px]">Purchase Date</span>
                    <strong className="text-slate-900 text-sm">
                      {formatDisplayDate(calcPurchaseDate)}
                    </strong>
                  </div>

                  <div>
                    <span className="text-slate-500 block text-[11px]">Days Added</span>
                    <strong className="text-indigo-600 text-sm font-mono">
                      +{calcValidityDays} Days
                    </strong>
                  </div>

                  <div>
                    <span className="text-slate-500 block text-[11px]">Exact Renewal Date</span>
                    <strong className="text-rose-600 text-sm font-black">
                      {formatDisplayDate(liveCalculationResult.renewalDate)}
                    </strong>
                  </div>
                </div>

                <div className="pt-2 border-t border-indigo-100 flex items-center justify-between text-xs">
                  <span className="text-slate-600 font-medium">
                    {liveCalculationResult.explanation}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-bold font-mono">
                    {liveCalculationResult.daysRemaining} days left
                  </span>
                </div>
              </div>

              {/* Save & Pin Button */}
              <button
                type="button"
                onClick={handleSaveCalculatedSubscription}
                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-extrabold text-xs rounded-2xl shadow-md shadow-indigo-500/20 transition flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {calcSavedSuccess
                    ? "Saved Successfully & Added to Calendar!"
                    : "Add to Subscriptions & Pin on Renewal Calendar"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DAY DETAIL & ACTION DRAWER */}
      {isDayDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col justify-between overflow-hidden animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                  <CalendarIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 leading-tight">
                    {formattedSelectedDate}
                  </h3>
                  <span className="text-xs font-bold text-slate-500">
                    {selectedDayData.subs.length + selectedDayData.evts.length === 0
                      ? "No events on this day"
                      : `${selectedDayData.subs.length} Renewals · ₹${selectedDayData.totalSpend.toLocaleString("en-IN")} Total Spend`}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsDayDrawerOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Content (Scrollable) */}
            <div className="p-5 flex-1 overflow-y-auto space-y-5">
              {/* Renewals on this day */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">
                    Renewing Subscriptions ({selectedDayData.subs.length})
                  </h4>
                  {selectedDayData.subs.length > 0 && (
                    <span className="text-xs font-black text-indigo-600 font-mono">
                      ₹{selectedDayData.totalSpend.toLocaleString("en-IN")}
                    </span>
                  )}
                </div>

                {selectedDayData.subs.length === 0 ? (
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-center text-xs text-slate-500">
                    No subscriptions renewing on {formattedSelectedDate}.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {selectedDayData.subs.map((sub) => {
                      const validity = getSubscriptionValidityDays(sub);
                      const daysLeft = getDaysRemaining(sub.next_billing_date);

                      return (
                        <div
                          key={sub.id}
                          className="p-4 rounded-2xl bg-slate-50 hover:bg-indigo-50/50 border border-slate-200/80 transition space-y-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <BrandLogo name={sub.name} iconUrl={sub.icon_image} size="sm" rounded="rounded-xl" />
                              <div>
                                <h5 className="text-sm font-extrabold text-slate-900">{sub.name}</h5>
                                <p className="text-xs text-slate-500">
                                  Used by: <strong>{sub.who_uses_it || "Family"}</strong>
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-sm font-black text-slate-900 font-mono block">
                                ₹{sub.cost.toLocaleString("en-IN")}
                              </span>
                              <span className="text-[10px] font-bold text-indigo-600 uppercase">
                                {sub.billing_cycle || "monthly"}
                              </span>
                            </div>
                          </div>

                          {/* Date Details Grid */}
                          <div className="grid grid-cols-3 gap-2 p-2.5 bg-white rounded-xl border border-slate-200/70 text-[11px]">
                            <div>
                              <span className="text-[9px] font-bold text-slate-400 block uppercase">Purchased</span>
                              <span className="font-bold text-slate-800">
                                {formatDisplayDate(getConsistentPurchaseDate(sub.start_date, sub.next_billing_date, validity))}
                              </span>
                            </div>
                            <div>
                              <span className="text-[9px] font-bold text-slate-400 block uppercase">Cycle</span>
                              <span className="font-bold text-slate-800">
                                {validity} Days
                              </span>
                            </div>
                            <div>
                              <span className="text-[9px] font-bold text-slate-400 block uppercase">Renewal</span>
                              <span className="font-black text-rose-600">
                                {formatDisplayDate(sub.next_billing_date)}
                              </span>
                            </div>
                          </div>

                          {/* 1-Day Prior Alert Action */}
                          <button
                            type="button"
                            onClick={() => {
                              setIsDayDrawerOpen(false);
                              onSelectSubscriptionForReminder(sub);
                            }}
                            className="w-full py-2 px-3 bg-white hover:bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                          >
                            <Bell className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Set 1-Day Prior Sound &amp; Popup Alert</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Custom Reminders & Bills on this Day */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">
                  Custom Reminders &amp; Bills ({selectedDayData.evts.length})
                </h4>

                {selectedDayData.evts.map((evt) => (
                  <div
                    key={evt.id}
                    className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm">
                        {evt.category === "need" ? "🛒" : evt.category === "bill" ? "⚡" : "🔔"}
                      </span>
                      <div>
                        <strong className="text-slate-900 block">{evt.title}</strong>
                        <span className="text-[11px] text-slate-500">
                          {evt.cost ? `₹${evt.cost} · ` : ""}
                          {evt.assigned_to || "Family"}
                          {evt.note ? ` (${evt.note})` : ""}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveEvent(evt.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                {/* Add Quick Reminder Form */}
                <form onSubmit={handleAddCustomEvent} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2.5">
                  <span className="text-[11px] font-bold text-slate-600 block">
                    + Add a Reminder or Bill on {formattedSelectedDate}
                  </span>
                  <input
                    type="text"
                    required
                    value={eventFormTitle}
                    onChange={(e) => setEventFormTitle(e.target.value)}
                    placeholder="e.g. Electricity bill, Rent, Grocery"
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      value={eventFormCost}
                      onChange={(e) => setEventFormCost(e.target.value)}
                      placeholder="₹ Amount"
                      className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none"
                    />
                    <select
                      value={eventFormCategory}
                      onChange={(e) => setEventFormCategory(e.target.value as any)}
                      className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none cursor-pointer"
                    >
                      <option value="need">🛒 Need</option>
                      <option value="bill">⚡ Utility Bill</option>
                      <option value="reminder">🔔 Reminder</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
                  >
                    Save Reminder
                  </button>
                </form>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setIsDayDrawerOpen(false)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MONTH & YEAR PICKER MODAL */}
      {isYearMonthPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-2xl p-6 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                  Jump to Date
                </span>
                <h3 className="text-lg font-black text-slate-900">
                  Select Month &amp; Year
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsYearMonthPickerOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Year Selector */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Year</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCurrentYear((prev) => Math.max(2020, prev - 1))}
                    className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center"
                  >
                    -
                  </button>
                  <span className="text-base font-black text-indigo-600 font-mono px-2">
                    {currentYear}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentYear((prev) => Math.min(2035, prev + 1))}
                    className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Fast Jump Year Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1">
                {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map((y) => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => setCurrentYear(y)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${
                      currentYear === y
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                    }`}
                  >
                    {y === 2026 ? "★ 2026" : y}
                  </button>
                ))}
              </div>
            </div>

            {/* 12-Month Grid */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <span className="text-xs font-bold text-slate-700 block">Month</span>
              <div className="grid grid-cols-4 gap-2">
                {MONTH_SHORT.map((name, idx) => {
                  const isActive = currentMonth === idx;
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => {
                        setCurrentMonth(idx);
                        setIsYearMonthPickerOpen(false);
                      }}
                      className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isActive
                          ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-xs"
                          : "bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/60"
                      }`}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsYearMonthPickerOpen(false)}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
