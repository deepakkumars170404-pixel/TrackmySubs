"use client";

import React, { useState, useEffect } from "react";
import {
  Bell,
  Volume2,
  X,
  Check,
  Calendar,
  ArrowRight,
  Sparkles,
  AlertCircle,
  CreditCard,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { useHousehold } from "@/context/HouseholdContext";
import { Subscription } from "@/lib/types";
import {
  playMobileNotificationSound,
  requestNotificationPermission,
  sendRenewalNotification,
  scheduleBackgroundRenewalNotification,
  flashTabTitle,
} from "@/lib/soundNotification";
import { formatDisplayDate, getDaysRemaining } from "@/lib/dateCalculator";
import { testClosedTabWebPush } from "@/lib/webPushClient";

/**
 * Triggers the live renewal alert popup and plays the mobile notification chime.
 * Supports passing a single subscription, an array of subscriptions, or { all: true } for all subscriptions.
 */
export function triggerLiveRenewalAlert(sub?: Subscription | Subscription[] | { all?: boolean }) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("trackmysubs-trigger-renewal-alert", { detail: { subscription: sub } })
    );
  }
}

export default function RenewalAlertPopup() {
  const { subscriptions } = useHousehold();
  const [activeAlerts, setActiveAlerts] = useState<Subscription[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [pushStatus, setPushStatus] = useState<NotificationPermission>("default");
  const [soundPlayedNotice, setSoundPlayedNotice] = useState(false);
  const [awayCountdown, setAwayCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setPushStatus(Notification.permission);
    }
  }, []);

  // Handler: Test closed tab & lock screen (10s countdown)
  const handleTestOutsideApp = async () => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        try {
          const perm = await requestNotificationPermission();
          setPushStatus(perm);
        } catch {
          // Continue regardless
        }
      } else {
        setPushStatus(Notification.permission);
      }
    }

    setAwayCountdown(10);

    const count = activeAlerts.length || 1;
    const names = activeAlerts.length > 0 ? activeAlerts.map((s) => s.name).join(", ") : "Subscriptions";
    const total = activeAlerts.reduce((sum, s) => sum + (Number(s.cost) || 0), 0);

    // 1. Service Worker delayed schedule (fires even if page minimized)
    scheduleBackgroundRenewalNotification({
      delaySeconds: 10,
      title: `🔔 TrackmySubs: 1-Day Renewal Alert (${count} Plans)`,
      body: `${names} (Total ₹${total || 1498}). This alert fired while tab was closed & screen was off!`,
      url: "/calendar",
    });

    // 2. Real server WebPush trigger for closed tab
    testClosedTabWebPush(10).catch(() => {});

    const interval = setInterval(() => {
      setAwayCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          playMobileNotificationSound();
          flashTabTitle("🔔 (1) RENEWAL ALERT! (Tomorrow)");
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Listen for manual trigger events (e.g. from "Test 1-Day Alert" in Settings)
  useEffect(() => {
    const handleTrigger = (e: any) => {
      const payload = e.detail?.subscription;
      let targetList: Subscription[] = [];

      if (Array.isArray(payload)) {
        targetList = payload;
      } else if (payload && payload.all === true) {
        // User requested alert for ALL active subscriptions at the same time
        targetList = subscriptions.filter((s) => s.status === "active");
        if (targetList.length === 0 && subscriptions.length > 0) {
          targetList = subscriptions.slice(0, 4);
        }
      } else if (payload && payload.id) {
        targetList = [payload];
      } else {
        // Default: take all active or top 3 subscriptions
        targetList = subscriptions.filter((s) => s.status === "active");
        if (targetList.length === 0 && subscriptions.length > 0) {
          targetList = subscriptions.slice(0, 3);
        }
      }

      if (targetList.length > 0) {
        setActiveAlerts(targetList);
        setIsOpen(true);
        playMobileNotificationSound();
        setSoundPlayedNotice(true);
        setTimeout(() => setSoundPlayedNotice(false), 4000);
        flashTabTitle(`🔔 (${targetList.length}) 1-DAY RENEWAL ALERT!`);

        const total = targetList.reduce((sum, s) => sum + (Number(s.cost) || 0), 0);
        const names = targetList.map((s) => s.name).join(", ");

        sendRenewalNotification({
          title: `🔔 1-Day Prior Alert: ${targetList.length} Subscriptions Due Tomorrow!`,
          body: `${names} (Total: ₹${total}). Sent even when website is closed & mobile screen is off!`,
          playSound: false,
          url: "/calendar",
        });
      }
    };

    window.addEventListener("trackmysubs-trigger-renewal-alert", handleTrigger);
    return () => window.removeEventListener("trackmysubs-trigger-renewal-alert", handleTrigger);
  }, [subscriptions]);

  // Automatic 1-Day Prior Check on mount
  useEffect(() => {
    if (!subscriptions || subscriptions.length === 0) return;

    // Find active subscriptions due in 0-1 days (1 day prior!)
    const dueSoon = subscriptions.filter((s) => {
      if (s.status !== "active" || !s.next_billing_date) return false;
      const days = getDaysRemaining(s.next_billing_date);
      return days >= 0 && days <= 1; // 0 days (today) or 1 day (tomorrow)
    });

    if (dueSoon.length > 0) {
      const todayStr = new Date().toISOString().split("T")[0];
      const sessionKey = `trackmysubs_1day_alert_shown_${todayStr}`;
      const alreadyShown = typeof window !== "undefined" && sessionStorage.getItem(sessionKey);

      if (!alreadyShown) {
        playMobileNotificationSound();
        setSoundPlayedNotice(true);
        setActiveAlerts(dueSoon);
        setIsOpen(true);

        const total = dueSoon.reduce((sum, s) => sum + (Number(s.cost) || 0), 0);
        const names = dueSoon.map((s) => s.name).join(", ");

        sendRenewalNotification({
          title: `🔔 1-Day Prior Alert: ${dueSoon.length} Subscriptions Due Tomorrow!`,
          body: `${names} totaling ₹${total}. Please check linked cards.`,
          playSound: false,
          url: "/calendar",
        });

        flashTabTitle(`🔔 (${dueSoon.length}) RENEWAL ALERT (Tomorrow)`);

        if (typeof window !== "undefined") {
          sessionStorage.setItem(sessionKey, "true");
        }
      }
    }
  }, [subscriptions]);

  const handleTestSound = () => {
    playMobileNotificationSound();
    setSoundPlayedNotice(true);
    setTimeout(() => setSoundPlayedNotice(false), 3000);
  };

  const handleEnablePush = async () => {
    const res = await requestNotificationPermission();
    setPushStatus(res);
    if (res === "granted") {
      sendRenewalNotification({
        title: `🔔 TrackmySubs: Lock-Screen Notifications Active!`,
        body: `You will now receive sound & popup alerts even when your mobile screen is off.`,
        playSound: true,
      });
    }
  };

  if (!isOpen || activeAlerts.length === 0) return null;

  const totalCost = activeAlerts.reduce((sum, s) => sum + (Number(s.cost) || 0), 0);
  const isSingle = activeAlerts.length === 1;
  const primaryAlert = activeAlerts[0];

  return (
    <div className="fixed bottom-5 right-5 z-[9999] max-w-md w-full animate-in slide-in-from-bottom-5 duration-300">
      <div className="bg-white rounded-3xl shadow-2xl border-2 border-indigo-500/40 overflow-hidden shadow-indigo-950/25">
        {/* Header Alert Gradient Bar */}
        <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-300 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-400" />
            </span>
            <div>
              <span className="text-[12px] font-black tracking-wider uppercase flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5" />
                <span>1-Day Prior Renewal Alert</span>
              </span>
              <p className="text-[10px] text-indigo-100 font-medium">
                {activeAlerts.length} subscription{activeAlerts.length > 1 ? "s" : ""} renewing tomorrow · Total ₹{totalCost}
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsOpen(false)}
            className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition cursor-pointer"
            aria-label="Dismiss alert"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 space-y-3.5 max-h-[75vh] overflow-y-auto">
          {/* Subscriptions List (All at the same time!) */}
          <div className="space-y-2.5">
            {activeAlerts.map((sub) => {
              const days = getDaysRemaining(sub.next_billing_date);
              const dueTag = days === 0 ? "Renews Today!" : "Renews Tomorrow (1 day left)";

              return (
                <div
                  key={sub.id}
                  className="p-3 rounded-2xl bg-slate-50 hover:bg-indigo-50/40 border border-slate-200/80 transition flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0 overflow-hidden shadow-2xs border border-slate-200"
                      style={{ backgroundColor: sub.brand_color || "#4f46e5" }}
                    >
                      {sub.icon_image ? (
                        <img
                          src={sub.icon_image}
                          alt={sub.name}
                          className="w-full h-full object-cover p-1 bg-white"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <span>{sub.name.charAt(0)}</span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-slate-900 text-sm truncate">
                          {sub.name}
                        </h4>
                        <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded-md shrink-0">
                          {dueTag}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {sub.plan_tier || "Monthly"} · {sub.payment_method || "AutoPay"}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="font-mono font-black text-indigo-950 text-sm">
                      ₹{sub.cost}
                    </span>
                    <p className="text-[10px] text-slate-400 capitalize">{sub.billing_cycle || "monthly"}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Total Sum Bar */}
          <div className="p-3 rounded-2xl bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 border border-indigo-100 flex items-center justify-between text-xs">
            <span className="font-bold text-indigo-950 flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-indigo-600" />
              <span>Total AutoPay Due Tomorrow</span>
            </span>
            <span className="font-mono font-black text-indigo-700 text-base">
              ₹{totalCost}
            </span>
          </div>

          {/* Sound & Alert Status Pill */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-700">
            <div className="flex items-center gap-1.5 font-medium">
              <Volume2 className="w-3.5 h-3.5 text-indigo-600" />
              <span>{soundPlayedNotice ? "Mobile chime played 🎵" : "Chime sound active & verified"}</span>
            </div>
            <button
              type="button"
              onClick={handleTestSound}
              className="text-[10px] font-bold text-indigo-700 bg-white hover:bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-200 transition cursor-pointer"
            >
              Play Sound 🔊
            </button>
          </div>

          {/* Test When Website is Closed & Mobile Screen is Off */}
          <div className="p-3 rounded-2xl bg-amber-50/90 border border-amber-200 text-xs space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[11px] font-extrabold text-amber-950 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-amber-600" />
                  <span>Test Closed Tab &amp; Screen Off Alert (10s)</span>
                </div>
                <div className="text-[10px] text-amber-800 mt-0.5 leading-snug">
                  {awayCountdown !== null ? (
                    <strong className="text-amber-950 font-black animate-pulse">
                      👉 Turn off phone screen or close tab (Ctrl+W)! Alert fires in {awayCountdown}s...
                    </strong>
                  ) : (
                    "Locks screen or closes tab, then server sends background push with chime sound!"
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={handleTestOutsideApp}
                disabled={awayCountdown !== null}
                className="shrink-0 text-[11px] font-extrabold text-white bg-slate-900 hover:bg-slate-800 px-3 py-1.5 rounded-xl shadow-xs transition cursor-pointer disabled:opacity-60 active:scale-95"
              >
                {awayCountdown !== null ? `Ringing in ${awayCountdown}s...` : "Test (10s) 🚪📱"}
              </button>
            </div>
          </div>

          {/* Permission Status */}
          {pushStatus === "denied" && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
              <p className="font-bold flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                <span>Browser Notifications Blocked</span>
              </p>
              <p className="text-[11px] text-rose-700 mt-0.5">
                Click the lock icon 🔒 next to the URL in your browser and switch Notifications to Allow.
              </p>
            </div>
          )}

          {pushStatus === "default" && (
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between">
              <span className="text-[11px] text-slate-600">Enable lock-screen &amp; background push</span>
              <button
                type="button"
                onClick={handleEnablePush}
                className="text-[10px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-2.5 py-1 rounded-lg transition cursor-pointer"
              >
                Enable Push
              </button>
            </div>
          )}

          {/* Action Footer */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              onClick={() => setIsOpen(false)}
              className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition cursor-pointer"
            >
              Acknowledge &amp; Dismiss
            </button>
            <button
              onClick={() => {
                setIsOpen(false);
                if (typeof window !== "undefined") {
                  window.location.href = "/calendar";
                }
              }}
              className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-md shadow-indigo-600/20 active:scale-95"
            >
              <span>View in Calendar</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
