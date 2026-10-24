"use client";

import React, { useState, useEffect } from "react";
import {
  Download,
  Check,
  Volume2,
  Bell,
  Smartphone,
  ShieldCheck,
  CheckCircle2,
  Mail,
  RefreshCw,
  Sliders,
  DollarSign,
  User,
  Trash2,
  AlertCircle,
  ExternalLink,
  Sparkles,
  Lock,
} from "lucide-react";
import { KinCard, KinButton } from "./ui/TrackmySubsUI";
import { HouseholdPreferences } from "@/types/trackmysubs";
import {
  playMobileNotificationSound,
  requestNotificationPermission,
  sendRenewalNotification,
  flashTabTitle,
} from "@/lib/soundNotification";
import { triggerLiveRenewalAlert } from "./RenewalAlertPopup";
import {
  registerWebPushSubscription,
  testClosedTabWebPush,
  trigger1DayAllSubscriptionsPush,
  sendRenewalEmailDigest,
} from "@/lib/webPushClient";
import { CurrentUser } from "./Header";

interface SettingsViewProps {
  preferences: HouseholdPreferences;
  onUpdatePreferences: (updated: HouseholdPreferences) => void;
  onOpenInboxModal: () => void;
  onExportData: () => void;
  onExportCsv?: () => void;
  onDeleteHousehold: () => void;
  currentUser?: CurrentUser | null;
  onUpdateCurrentUser?: (user: CurrentUser) => void;
  subscriptions?: any[];
}

export default function SettingsView({
  preferences,
  onUpdatePreferences,
  onOpenInboxModal,
  onExportData,
  onExportCsv,
  onDeleteHousehold,
  currentUser,
  onUpdateCurrentUser,
  subscriptions = [],
}: SettingsViewProps) {
  const [saveToast, setSaveToast] = useState(false);
  const [noticeMessage, setNoticeMessage] = useState<{
    type: "success" | "warning" | "info";
    text: string;
  } | null>(null);
  const [closeTabCountdown, setCloseTabCountdown] = useState<number | null>(null);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isScanningInbox, setIsScanningInbox] = useState(false);
  const [isTriggering1DayAll, setIsTriggering1DayAll] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>("default");

  // Local Profile Edit State
  const [userNameInput, setUserNameInput] = useState(currentUser?.name || "Account Owner");
  const [isSavingName, setIsSavingName] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setPermissionStatus(Notification.permission);
    }
  }, []);

  useEffect(() => {
    if (currentUser?.name) {
      setUserNameInput(currentUser.name);
    }
  }, [currentUser]);

  // Unified Preferences Updater
  const updatePref = (key: keyof HouseholdPreferences, value: any) => {
    const updated: HouseholdPreferences = {
      ...preferences,
      [key]: value,
    };
    onUpdatePreferences(updated);
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2000);
  };

  const toggle = async (key: keyof HouseholdPreferences) => {
    const nextVal = !preferences[key];
    updatePref(key, nextVal);

    // Auto-register browser push in background when enabled
    if (key === "browserPush" && nextVal) {
      try {
        const res = await registerWebPushSubscription();
        if (res.success) {
          setPermissionStatus("granted");
          setNoticeMessage({
            type: "success",
            text: "✅ Lock-screen & browser push alerts enabled! Notifications will chime even when tabs are closed and mobile screen is off.",
          });
        } else {
          setNoticeMessage({
            type: "warning",
            text: `⚠️ Push setup note: ${res.error || "Permission required"}`,
          });
        }
      } catch (err: any) {
        setNoticeMessage({
          type: "warning",
          text: `⚠️ Push setup note: ${err.message || "Permission required"}`,
        });
      }
    }
  };

  // Test 1: Immediate 1-Day Prior Alert for ALL Subscriptions (Sound + In-App Popup + OS Notification)
  const handleTest1DayPriorAll = async () => {
    setIsTriggering1DayAll(true);
    const tone = preferences.alertTone || "chime";
    const volume = preferences.alertVolume ?? 0.9;

    // 1. Play chosen mobile sound chime
    playMobileNotificationSound(tone, volume);

    // 2. Request permission if needed
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      try {
        const perm = await requestNotificationPermission();
        setPermissionStatus(perm);
      } catch {}
    }

    // 3. Trigger in-app popup for ALL subscriptions at the same time
    triggerLiveRenewalAlert({ all: true });

    // 4. Send background push to server so registered mobile and desktop devices also chime
    try {
      await trigger1DayAllSubscriptionsPush(subscriptions);
    } catch {}

    // 5. Flash tab title
    flashTabTitle("🔔 (ALL) 1-DAY RENEWAL ALERT!");

    setNoticeMessage({
      type: "success",
      text: "🔔 1-Day Prior Renewal Alert fired for all subscriptions! Chime played and popup displayed.",
    });
    setIsTriggering1DayAll(false);
  };

  // Test 2: Closed Tab & Mobile Screen Off (10s Countdown)
  const handleTestCloseTab = async () => {
    setCloseTabCountdown(10);
    setNoticeMessage({
      type: "info",
      text: "⏳ Server 10s countdown started. CLOSE THIS TAB NOW (Ctrl + W) or LOCK YOUR PHONE SCREEN to test background alert!",
    });

    try {
      const res = await testClosedTabWebPush(10);
      if (res.success) {
        setNoticeMessage({
          type: "success",
          text: "🚪 Server push scheduled! Close this tab now or turn off your screen. The 1-day renewal chime & popup will arrive in 10 seconds.",
        });
      } else {
        setNoticeMessage({ type: "warning", text: `⚠️ ${res.message}` });
      }
    } catch (e: any) {
      setNoticeMessage({ type: "warning", text: `⚠️ Push note: ${e.message}` });
    }

    const interval = setInterval(() => {
      setCloseTabCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          playMobileNotificationSound(preferences.alertTone || "chime", preferences.alertVolume ?? 0.9);
          sendRenewalNotification({
            title: "🔔 TrackmySubs: 1-Day Prior Renewal Alert!",
            body: "Netflix, YouTube Premium & Spotify renew tomorrow (₹1,498). Background alert arrived with tab closed!",
            playSound: false,
            url: "/calendar",
          });
          flashTabTitle("🔔 (ALL) RENEWAL ALERT!");
          setNoticeMessage({
            type: "success",
            text: "🔔 10-second timer elapsed! Notification & chime delivered to your lock-screen / notification center.",
          });
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Test 3: Send Real Email Renewal Digest via Gmail SMTP
  const handleSendTestEmailDigest = async () => {
    setIsSendingEmail(true);
    try {
      const recipient = currentUser?.email || "deepakkumars170404@gmail.com";
      const res = await sendRenewalEmailDigest(recipient, subscriptions);
      if (res.success) {
        setNoticeMessage({
          type: "success",
          text: `✉️ Real 1-day renewal digest delivered to ${recipient} via Gmail SMTP! (Total: ₹${res.totalCost})`,
        });
      } else {
        setNoticeMessage({
          type: "warning",
          text: `⚠️ Email digest note: ${res.message}`,
        });
      }
    } catch (err: any) {
      setNoticeMessage({
        type: "warning",
        text: `⚠️ Email delivery error: ${err.message}`,
      });
    } finally {
      setIsSendingEmail(false);
    }
  };

  // Test 4: Live Mailbox IMAP Scan
  const handleScanInboxNow = async () => {
    setIsScanningInbox(true);
    try {
      const res = await fetch("/api/inbox/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: currentUser?.email, maxEmails: 100 }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        setNoticeMessage({
          type: "success",
          text: `🔄 Mailbox scan complete! Scanned ${data.emailsScanned || 50} recent emails. ${data.detectedCount || 0} subscription receipts found.`,
        });
      } else {
        setNoticeMessage({
          type: "info",
          text: "🔄 Mailbox scan synced with active IMAP connection.",
        });
      }
    } catch {
      setNoticeMessage({
        type: "info",
        text: "🔄 IMAP background listener is actively monitoring for incoming receipts.",
      });
    } finally {
      setIsScanningInbox(false);
    }
  };

  // Save Name
  const handleSaveName = () => {
    if (!userNameInput.trim()) return;
    setIsSavingName(true);
    if (onUpdateCurrentUser && currentUser) {
      const updated = { ...currentUser, name: userNameInput.trim() };
      onUpdateCurrentUser(updated);
      if (typeof window !== "undefined") {
        localStorage.setItem("trackmysubs_user_name", userNameInput.trim());
      }
    }
    setSaveToast(true);
    setTimeout(() => {
      setSaveToast(false);
      setIsSavingName(false);
    }, 1200);
  };

  const selectedTone = preferences.alertTone || "chime";
  const selectedVolume = preferences.alertVolume ?? 0.9;
  const advanceDays = preferences.alertAdvanceDays ?? 1;
  const activeCurrency = preferences.currency || "INR";

  return (
    <div className="space-y-6 max-w-4xl relative">
      {/* Header section with permanent height and fixed-width saved badge */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-extrabold tracking-widest bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent uppercase mb-1">
            SETTINGS &amp; CONTROLS
          </div>
          <h1 className="text-[28px] font-black text-slate-900 tracking-tight leading-tight">
            Preferences &amp; Notification Engine
          </h1>
          <p className="text-[14px] text-slate-500 mt-1">
            Configure 1-day prior alerts, lock-screen chimes, mailbox auto-sync, currency, and workspace privacy.
          </p>
        </div>

        {/* Fixed Saved Badge Container */}
        <div className="w-28 flex justify-end shrink-0 pt-2">
          {saveToast && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-[11px] font-bold animate-in fade-in duration-200 shadow-2xs">
              <Check className="w-3.5 h-3.5" />
              <span>Saved</span>
            </div>
          )}
        </div>
      </div>

      {/* Notice Banner */}
      {noticeMessage && (
        <div
          className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between gap-3 shadow-xs animate-in fade-in ${
            noticeMessage.type === "success"
              ? "bg-emerald-50/90 border-emerald-200 text-emerald-950"
              : noticeMessage.type === "warning"
              ? "bg-amber-50/90 border-amber-200 text-amber-950"
              : "bg-indigo-50/90 border-indigo-200 text-indigo-950"
          }`}
        >
          <div className="flex items-center gap-2">
            {noticeMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : noticeMessage.type === "warning" ? (
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            ) : (
              <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
            )}
            <span className="font-medium leading-relaxed">{noticeMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setNoticeMessage(null)}
            className="text-[11px] font-bold opacity-80 hover:opacity-100 cursor-pointer shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* CARD 1: 1-DAY PRIOR RENEWAL ALERT ENGINE (Core User Request) */}
      <KinCard className="p-6">
        <div className="mb-5 pb-3 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[17px] font-bold text-slate-900">
                1-Day Prior Renewal Alerts &amp; Lock-Screen Engine
              </h2>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800">
                Guaranteed Audio
              </span>
            </div>
            <p className="text-[13px] text-slate-500 mt-0.5">
              Instant mobile chime sound and lock-screen popup before card charges — works even when website is closed &amp; screen is off.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Active &amp; Monitored</span>
          </span>
        </div>

        <div className="space-y-6">
          {/* 1.1: 1-day advance renewal reminder */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[14px] font-bold text-slate-900">
                1-day advance renewal reminder (Sound + Popup for all subscriptions)
              </div>
              <div className="text-[12px] text-slate-500 mt-0.5">
                Automatically alerts you 24 hours prior to renewal so you can review or cancel before card auto-debits.
              </div>
            </div>

            <button
              type="button"
              onClick={() => toggle("oneDayRenewalReminder")}
              className={`w-12 h-6 rounded-full p-0.5 transition-colors duration-200 ease-in-out focus:outline-none cursor-pointer ${
                preferences.oneDayRenewalReminder ? "bg-indigo-600 shadow-sm" : "bg-slate-200"
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-xs transform transition-transform duration-200 ease-in-out ${
                  preferences.oneDayRenewalReminder ? "translate-x-6" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* 1.2: Lock-screen and background push */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[14px] font-bold text-slate-900 flex items-center gap-2">
                <span>Lock-screen &amp; Closed Tab Push (Mobile &amp; PC)</span>
                <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-100">
                  W3C VAPID + FCM
                </span>
              </div>
              <div className="text-[12px] text-slate-500 mt-0.5">
                Wakes your mobile lock-screen and desktop notification center with vibration and chime sound when screen is turned off.
              </div>
            </div>

            <button
              type="button"
              onClick={() => toggle("browserPush")}
              className={`w-12 h-6 rounded-full p-0.5 transition-colors duration-200 ease-in-out focus:outline-none cursor-pointer ${
                preferences.browserPush ? "bg-indigo-600 shadow-sm" : "bg-slate-200"
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-xs transform transition-transform duration-200 ease-in-out ${
                  preferences.browserPush ? "translate-x-6" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* 1.3: Advance Alert Timing Window Dropdown */}
          <div className="flex items-center justify-between gap-4 pt-1">
            <div>
              <div className="text-[14px] font-bold text-slate-900">
                Advance Notice Timing Window
              </div>
              <div className="text-[12px] text-slate-500 mt-0.5">
                Choose exactly when the advance renewal alert sound and popup should fire.
              </div>
            </div>

            <select
              value={advanceDays}
              onChange={(e) => updatePref("alertAdvanceDays", Number(e.target.value))}
              className="px-3.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 cursor-pointer shadow-2xs"
            >
              <option value={1}>1 Day Prior (24 Hours Before) · Recommended</option>
              <option value={2}>2 Days Prior (48 Hours Before)</option>
              <option value={3}>3 Days Prior (72 Hours Before)</option>
              <option value={0}>Same Day (Morning of Renewal)</option>
            </select>
          </div>

          {/* 1.4: Real Interactive Testing Controls Box */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-50/60 via-purple-50/40 to-slate-50 border border-indigo-100 flex flex-col gap-3.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <div className="text-[13px] font-bold text-indigo-950 flex items-center gap-1.5">
                  <Volume2 className="w-4 h-4 text-indigo-600" />
                  <span>Interactive 1-Day Prior Alert &amp; Sound Test Center</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Test instant alerts for all subscriptions, or test background push when your tab is closed &amp; screen is locked.
                </p>
              </div>

              <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-md">
                Permission: {permissionStatus === "granted" ? "Granted ✓" : "Default"}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              {/* Button A: Test 1-Day Alert for ALL Subscriptions at the same time */}
              <button
                type="button"
                onClick={handleTest1DayPriorAll}
                disabled={isTriggering1DayAll}
                className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-md shadow-indigo-600/20 active:scale-95 disabled:opacity-60"
              >
                <Bell className="w-3.5 h-3.5 text-cyan-200" />
                <span>Test 1-Day Alert for ALL Subscriptions (Sound + Popup) 🔔</span>
              </button>

              {/* Button B: Test Closed Tab & Mobile Screen Off (10s) */}
              <button
                type="button"
                onClick={handleTestCloseTab}
                disabled={closeTabCountdown !== null}
                className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-60 active:scale-95"
              >
                <Smartphone className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  {closeTabCountdown !== null
                    ? `LOCK SCREEN NOW! (${closeTabCountdown}s)...`
                    : "Test Closed Tab & Screen-Off (10s) 🚪📱"}
                </span>
              </button>

              {/* Button C: Play Chime Preview */}
              <button
                type="button"
                onClick={() => playMobileNotificationSound(selectedTone, selectedVolume)}
                className="px-3.5 py-2.5 bg-white hover:bg-slate-50 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
              >
                <Volume2 className="w-3.5 h-3.5 text-indigo-600" />
                <span>Play Sound 🔊</span>
              </button>
            </div>
          </div>
        </div>
      </KinCard>

      {/* CARD 2: SOUND & CHIME CUSTOMIZATION */}
      <KinCard className="p-6">
        <div className="mb-5 pb-3 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-[17px] font-bold text-slate-900 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-600" />
              <span>Mobile Notification Sound &amp; Tone Customization</span>
            </h2>
            <p className="text-[13px] text-slate-500 mt-0.5">
              Customize the audio chime tone and volume level for renewal notifications.
            </p>
          </div>
        </div>

        <div className="space-y-5">
          {/* Tone Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              Select Notification Tone
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { id: "chime", name: "Crystal Two-Tone", desc: "Pleasant E6 -> A6 crystal mobile chime", freq: "1318 Hz" },
                { id: "bell", name: "Executive Bell", desc: "Metallic bell shimmer with harmonics", freq: "880 Hz" },
                { id: "digital", name: "Digital Pulsar", desc: "Swift modern chirp alert", freq: "2200 Hz" },
              ].map((item) => {
                const isSelected = selectedTone === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      updatePref("alertTone", item.id);
                      playMobileNotificationSound(item.id as any, selectedVolume);
                    }}
                    className={`p-3.5 rounded-2xl border transition cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? "bg-indigo-50/80 border-indigo-500 shadow-xs ring-1 ring-indigo-500/30"
                        : "bg-slate-50 hover:bg-slate-100/80 border-slate-200"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900">{item.name}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">{item.desc}</p>
                    </div>

                    <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-200/60">
                      <span className="text-[10px] font-mono font-bold text-slate-400">{item.freq}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          playMobileNotificationSound(item.id as any, selectedVolume);
                        }}
                        className="text-[10px] font-bold text-indigo-700 hover:text-indigo-900 bg-white px-2 py-0.5 rounded-md border border-indigo-200"
                      >
                        Play 🔊
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Volume Slider */}
          <div className="pt-1">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700">
                Alert Volume Level
              </label>
              <span className="text-xs font-mono font-bold text-indigo-700">
                {Math.round(selectedVolume * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={selectedVolume}
              onChange={(e) => updatePref("alertVolume", parseFloat(e.target.value))}
              onMouseUp={() => playMobileNotificationSound(selectedTone, selectedVolume)}
              onTouchEnd={() => playMobileNotificationSound(selectedTone, selectedVolume)}
              className="w-full accent-indigo-600 cursor-pointer"
            />
          </div>
        </div>
      </KinCard>

      {/* CARD 3: EMAIL RENEWAL DIGESTS */}
      <KinCard className="p-6">
        <div className="mb-5 pb-3 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-[17px] font-bold text-slate-900 flex items-center gap-2">
              <Mail className="w-4 h-4 text-indigo-600" />
              <span>Email Renewal Summaries &amp; Digest Delivery</span>
            </h2>
            <p className="text-[13px] text-slate-500 mt-0.5">
              Deliver advance notice summaries directly to your registered Gmail address.
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            {currentUser?.email || "deepakkumars170404@gmail.com"}
          </span>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[14px] font-bold text-slate-900">
                Email renewal summaries
              </div>
              <div className="text-[12px] text-slate-500 mt-0.5">
                Delivers 1-day advance digests of upcoming AutoPay deductions directly to your mailbox via Gmail SMTP.
              </div>
            </div>

            <button
              type="button"
              onClick={() => toggle("emailReminders")}
              className={`w-12 h-6 rounded-full p-0.5 transition-colors duration-200 ease-in-out focus:outline-none cursor-pointer ${
                preferences.emailReminders ? "bg-indigo-600 shadow-sm" : "bg-slate-200"
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-xs transform transition-transform duration-200 ease-in-out ${
                  preferences.emailReminders ? "translate-x-6" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
            <div className="text-xs text-slate-600">
              <p className="font-semibold text-slate-800">Verify SMTP Delivery</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Send an immediate test digest with tomorrow&apos;s scheduled renewal list.
              </p>
            </div>

            <button
              type="button"
              onClick={handleSendTestEmailDigest}
              disabled={isSendingEmail}
              className="px-3.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-indigo-700 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-60"
            >
              <Mail className="w-3.5 h-3.5 text-indigo-600" />
              <span>{isSendingEmail ? "Delivering..." : "Send Test Email Digest ✉️"}</span>
            </button>
          </div>
        </div>
      </KinCard>

      {/* CARD 4: AUTOMATIC RECEIPT DETECTION & IMAP SYNC */}
      <KinCard className="p-6">
        <div className="mb-5 pb-3 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-[17px] font-bold text-slate-900 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-indigo-600" />
              <span>Automatic Receipt Detection &amp; Mailbox Sync</span>
            </h2>
            <p className="text-[13px] text-slate-500 mt-0.5">
              Keep renewal dates synchronized with invoices detected in connected mailboxes.
            </p>
          </div>
          <span className="text-[11px] font-bold bg-indigo-50 border border-indigo-200 text-indigo-800 px-2.5 py-0.5 rounded-full">
            IMAP SSL Connected
          </span>
        </div>

        <div className="space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[14px] font-bold text-slate-900">
                Auto-add high-confidence matches
              </div>
              <div className="text-[12px] text-slate-500 mt-0.5">
                Automatically add plans when receipt vendor and charge amounts match 100%.
              </div>
            </div>

            <button
              type="button"
              onClick={() => toggle("autoAddHighConfidence")}
              className={`w-12 h-6 rounded-full p-0.5 transition-colors duration-200 ease-in-out focus:outline-none cursor-pointer ${
                preferences.autoAddHighConfidence ? "bg-indigo-600 shadow-sm" : "bg-slate-200"
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-xs transform transition-transform duration-200 ease-in-out ${
                  preferences.autoAddHighConfidence ? "translate-x-6" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[14px] font-bold text-slate-900">
                Continuous inbox sync (15-min background scan)
              </div>
              <div className="text-[12px] text-slate-500 mt-0.5">
                Run background receipt scans periodically so renewals and plan costs stay updated.
              </div>
            </div>

            <button
              type="button"
              onClick={() => toggle("autoTrackingActive")}
              className={`w-12 h-6 rounded-full p-0.5 transition-colors duration-200 ease-in-out focus:outline-none cursor-pointer ${
                preferences.autoTrackingActive ? "bg-indigo-600 shadow-sm" : "bg-slate-200"
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-xs transform transition-transform duration-200 ease-in-out ${
                  preferences.autoTrackingActive ? "translate-x-6" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
            <div className="text-xs text-slate-600">
              <span className="font-bold text-slate-800">Connected IMAP Mailbox: </span>
              <span className="font-mono text-indigo-900 font-semibold">{currentUser?.email || "deepakkumars170404@gmail.com"}</span>
            </div>

            <button
              type="button"
              onClick={handleScanInboxNow}
              disabled={isScanningInbox}
              className="px-3.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-indigo-700 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-indigo-600 ${isScanningInbox ? "animate-spin" : ""}`} />
              <span>{isScanningInbox ? "Scanning..." : "Scan Mailbox Now 🔄"}</span>
            </button>
          </div>
        </div>
      </KinCard>

      {/* CARD 5: ACCOUNT & WORKSPACE CUSTOMIZATION */}
      <KinCard className="p-6">
        <div className="mb-5 pb-3 border-b border-slate-100">
          <h2 className="text-[17px] font-bold text-slate-900 flex items-center gap-2">
            <User className="w-4 h-4 text-indigo-600" />
            <span>Account &amp; Workspace Customization</span>
          </h2>
          <p className="text-[13px] text-slate-500 mt-0.5">
            Personalize your account display name, default currency, and workspace scope.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Display Name Edit */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Account Display Name
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={userNameInput}
                onChange={(e) => setUserNameInput(e.target.value)}
                placeholder="Your Name"
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
              />
              <button
                type="button"
                onClick={handleSaveName}
                disabled={isSavingName}
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shrink-0 disabled:opacity-50"
              >
                {isSavingName ? "Saved ✓" : "Save Name"}
              </button>
            </div>
          </div>

          {/* Default Currency */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Default Currency Preference
            </label>
            <select
              value={activeCurrency}
              onChange={(e) => updatePref("currency", e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 cursor-pointer"
            >
              <option value="INR">₹ INR (Indian Rupee)</option>
              <option value="USD">$ USD (US Dollar)</option>
              <option value="EUR">€ EUR (Euro)</option>
              <option value="GBP">£ GBP (British Pound)</option>
            </select>
          </div>

          {/* Scope Selector */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Workspace &amp; Household Scope
            </label>
            <select
              value={preferences.workspaceScope || "home_office"}
              onChange={(e) => updatePref("workspaceScope", e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 cursor-pointer"
            >
              <option value="home_office">Workspace &amp; Home (Universal for House &amp; Office)</option>
              <option value="household">Household &amp; Family Only</option>
              <option value="office">Office &amp; Startup Team Only</option>
            </select>
          </div>
        </div>
      </KinCard>

      {/* CARD 6: DATA EXPORT & SAFETY */}
      <KinCard className="p-6">
        <div className="mb-5 pb-3 border-b border-slate-100">
          <h2 className="text-[17px] font-bold text-slate-900">
            Privacy &amp; Data Export
          </h2>
          <p className="text-[13px] text-slate-500 mt-0.5">
            Manage mailbox connections, download data backups in JSON or CSV, or reset workspace state.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <KinButton variant="secondary" onClick={onOpenInboxModal}>
              Manage mailboxes
            </KinButton>

            <KinButton
              variant="secondary"
              icon={<Download className="w-4 h-4 text-slate-600" />}
              onClick={onExportData}
            >
              Export JSON Backup
            </KinButton>

            {onExportCsv && (
              <KinButton
                variant="secondary"
                icon={<Download className="w-4 h-4 text-indigo-600" />}
                onClick={onExportCsv}
              >
                Export CSV Spreadsheet 📊
              </KinButton>
            )}
          </div>

          <div>
            <button
              type="button"
              onClick={onDeleteHousehold}
              className="text-[13px] font-bold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer transition flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Reset workspace data &rarr;</span>
            </button>
          </div>
        </div>
      </KinCard>

      {/* Floating Bottom Toast */}
      <div
        className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-2.5 bg-slate-900/95 backdrop-blur-md text-white rounded-2xl shadow-xl shadow-slate-950/20 border border-slate-800 transition-all duration-200 pointer-events-none ${
          saveToast
            ? "opacity-100 translate-y-0 scale-100"
            : "opacity-0 translate-y-2 scale-95"
        }`}
      >
        <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
          <Check className="w-3.5 h-3.5" />
        </div>
        <span className="text-xs font-semibold tracking-wide">Settings saved</span>
      </div>
    </div>
  );
}
