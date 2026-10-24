"use client";

import React from "react";
import { X, ExternalLink, Check } from "lucide-react";
import { Subscription } from "@/lib/types";
import { BrandLogo } from "@/lib/logoHelper";
import { formatDisplayDate } from "@/lib/dateCalculator";

interface ReminderModalProps {
  subscription: Subscription | null;
  onClose: () => void;
}

export default function ReminderModal({ subscription, onClose }: ReminderModalProps) {
  if (!subscription) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/35 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-white border border-[#E5E9E3] rounded-2xl shadow-xl overflow-hidden p-6 sm:p-7 space-y-5">
        {/* Top bar */}
        <div className="flex items-center justify-between pb-3 border-b border-[#E5E9E3]">
          <div>
            <span className="text-[10px] font-bold tracking-wider text-stone-400 uppercase">
              Reminder Detail
            </span>
            <h3 className="text-[19px] font-semibold text-stone-900 leading-tight">
              A plan is renewing tomorrow
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Alert Banner */}
        <div className="p-3.5 rounded-xl bg-[#FFF1E4] border border-[#FFE0C2] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-[#9A4B12] text-white flex items-center justify-center font-bold text-xs shrink-0">
              !
            </div>
            <div>
              <h4 className="text-[13px] font-semibold text-[#9A4B12]">
                Renewal reminder
              </h4>
              <p className="text-[11px] text-[#B45309]">
                Tomorrow · 9:00 AM alert scheduled
              </p>
            </div>
          </div>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-white text-[#9A4B12] border border-amber-200">
            1 day before
          </span>
        </div>

        {/* Plan Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BrandLogo
              name={subscription.name}
              iconUrl={subscription.icon_image}
              size="md"
              rounded="rounded-2xl"
            />
            <div>
              <h4 className="text-[16px] font-bold text-slate-900">
                {subscription.name} {subscription.plan_tier?.split("·")[0]}
              </h4>
              <p className="text-[12px] text-slate-500">
                Used by {subscription.who_uses_it || "Family"} · Billing from {subscription.name}
              </p>
            </div>
          </div>

          <span className="text-[12px] font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
            Auto-renew on
          </span>
        </div>

        {/* Charge and Provenance Details */}
        <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
          <div>
            <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              Next Charge
            </p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-[20px] font-bold text-slate-900 font-mono">
                ₹{subscription.cost.toLocaleString("en-IN")}
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                {formatDisplayDate(subscription.next_billing_date)}




              </span>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              Date Source
            </p>
            <div className="mt-1">
              <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-cyan-800 bg-cyan-50 px-2.5 py-1 rounded-md border border-cyan-200">
                <Check className="w-3.5 h-3.5 text-cyan-600" />
                <span>
                  {subscription.source === "receipt"
                    ? "Confirmed from receipt"
                    : subscription.source === "estimate"
                    ? "Estimated from history"
                    : "Review requested"}
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Call to action buttons */}
        <div>
          <p className="text-[12px] font-medium text-slate-700 mb-2">
            What would you like to do?
          </p>
          <div className="flex flex-col sm:flex-row gap-2.5">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 px-4 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-[13px] font-medium rounded-xl transition text-center shadow-xs"
            >
              Review plan details
            </button>
            <a
              href={subscription.service_url || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-2.5 px-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:via-purple-700 hover:to-pink-700 text-white text-[13px] font-semibold rounded-xl transition text-center flex items-center justify-center gap-1.5 shadow-md shadow-indigo-500/20"
            >
              <span>Open {subscription.name} billing</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Honest Controls Principle Notice */}
        <div className="text-[11px] text-stone-400 space-y-1 pt-2 border-t border-stone-100">
          <p>• TrackmySubs cannot change {subscription.name} billing or cancel this plan for you.</p>
          <p>• The reminder can be turned off for this plan in its settings.</p>
          <p>• The reminder is sent once. If the renewal date changes from a new receipt, TrackmySubs updates the date and adjusts future alerts.</p>
        </div>
      </div>
    </div>
  );
}
