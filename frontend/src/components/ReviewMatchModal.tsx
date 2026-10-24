"use client";

import React, { useState, useEffect } from "react";
import { X, AlertTriangle, CheckCircle2, Calculator, Sparkles, Mail, ShieldCheck } from "lucide-react";
import { KinButton } from "./ui/TrackmySubsUI";
import { DetectedReceipt } from "@/types/trackmysubs";
import { BrandLogo } from "@/lib/logoHelper";
import { useHousehold } from "@/context/HouseholdContext";
import {
  calculateNextRenewalDate,
  formatDisplayDate,
  addDaysToDate,
  extractValidityDaysFromText,
} from "@/lib/dateCalculator";

interface ReviewMatchModalProps {
  receipt: DetectedReceipt | null;
  onClose: () => void;
  onConfirm: (id: string, confirmedDate: string, member: string) => void;
}

export default function ReviewMatchModal({
  receipt,
  onClose,
  onConfirm,
}: ReviewMatchModalProps) {
  const { members } = useHousehold();
  const [renewalDate, setRenewalDate] = useState("2026-11-21");
  const [assignedMember, setAssignedMember] = useState("Everyone");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [calculationInfo, setCalculationInfo] = useState<string>("");
  const [selectedDays, setSelectedDays] = useState<number>(30);

  useEffect(() => {
    if (!receipt) return;

    // Use intelligent calculator on raw receipt evidence + notes
    const combinedSnippet = `${receipt.evidenceSnippet || ""} ${receipt.chargeDateNote || ""} ${receipt.receiptName || ""}`;
    const result = calculateNextRenewalDate({
      purchaseDate: receipt.receiptDate || new Date().toISOString().split("T")[0],
      textSnippet: combinedSnippet,
      cycle: "monthly",
    });

    setRenewalDate(result.renewalDate);
    setSelectedDays(result.validityDays);
    setCalculationInfo(result.explanation);
  }, [receipt]);

  if (!receipt) return null;

  const handleDaysChange = (days: number) => {
    setSelectedDays(days);
    const base = receipt.receiptDate || new Date().toISOString().split("T")[0];
    const calculated = addDaysToDate(base, days);
    setRenewalDate(calculated);
    setCalculationInfo(
      `⚡ Auto-calculated renewal: ${formatDisplayDate(base)} + ${days} days valid → ${formatDisplayDate(calculated)}`
    );
  };

  const handleConfirm = async () => {
    setIsSubmitting(true);
    await onConfirm(receipt.id, renewalDate, assignedMember);
    setIsSubmitting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100 bg-slate-50/60">
          <div>
            <div className="text-[10px] font-extrabold text-indigo-600 uppercase tracking-widest flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-pink-500" />
              Receipt Verification & Renewal Calculator
            </div>
            <h2 className="text-lg font-black text-slate-900 leading-tight">
              Confirm detected subscription
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Notification banner */}
          <div className="bg-indigo-50 border border-indigo-200/80 rounded-2xl p-3.5 flex items-start gap-3">
            <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <div className="text-xs text-indigo-900 leading-snug">
              <strong>Gmail receipt detected:</strong> Adding this will sync the subscription and verified tax bill directly to your <strong>Subscriptions</strong> table.
            </div>
          </div>

          {/* Raw Receipt Evidence Card with Real Brand Logo */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <BrandLogo name={receipt.serviceName} size="md" rounded="rounded-xl" />
                <div>
                  <span className="text-base font-extrabold text-slate-900 block leading-tight">
                    {receipt.serviceName}
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium">
                    {receipt.receiptName}
                  </span>
                </div>
              </div>
              <span className="text-base font-black text-indigo-600 font-mono">
                ₹{receipt.extractedCost || 249} / mo
              </span>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Raw Email Receipt Evidence
              </span>
              <div className="text-xs text-slate-700 font-mono bg-white p-3 rounded-xl border border-slate-200 shadow-2xs leading-relaxed">
                {receipt.evidenceSnippet ||
                  `Subject: Receipt for ${receipt.serviceName}. Charged ₹${receipt.extractedCost || 249}.`}
              </div>
            </div>
          </div>

          {/* Intelligent Validity Days Calculator */}
          <div className="p-3.5 bg-indigo-50/50 border border-indigo-200/80 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Calculator className="w-3.5 h-3.5 text-indigo-600" />
                Next Renewal Date Calculator
              </span>
              <span className="text-[10px] font-bold text-indigo-700 bg-white px-2 py-0.5 rounded-full border border-indigo-200 shadow-2xs">
                Auto-calculated
              </span>
            </div>

            {/* Quick Validity Chips */}
            <div className="flex flex-wrap items-center gap-1.5">
              {[28, 29, 30, 84, 90, 365].map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => handleDaysChange(days)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                    selectedDays === days
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {days === 365 ? "1 Year" : `${days} Days`}
                </button>
              ))}
            </div>

            {/* Calculation Explanation */}
            {calculationInfo && (
              <div className="text-[11px] font-semibold text-indigo-900 bg-white/80 border border-indigo-100 rounded-xl p-2 leading-relaxed">
                {calculationInfo}
              </div>
            )}
          </div>

          {/* Form Fields: Next Renewal Date & Member */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Next Renewal Date (Auto) *
              </label>
              <input
                type="date"
                value={renewalDate}
                onChange={(e) => setRenewalDate(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs font-mono font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Who Uses This Plan?
              </label>
              <select
                value={assignedMember}
                onChange={(e) => setAssignedMember(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500 transition cursor-pointer"
              >
                <option value="Everyone">Everyone</option>
                <option value="Family Plan">Family Plan</option>
                {members.map((m) => (
                  <option key={m.id} value={m.name}>
                    {m.name} ({m.role})
                  </option>
                ))}



              </select>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-100">
            <KinButton type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
              Dismiss
            </KinButton>
            <KinButton type="button" variant="primary" onClick={handleConfirm} disabled={isSubmitting}>
              {isSubmitting ? "Syncing..." : "Add to subscriptions table"}
            </KinButton>
          </div>
        </div>
      </div>
    </div>
  );
}
