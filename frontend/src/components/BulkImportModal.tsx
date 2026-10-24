"use client";

import React, { useState } from "react";
import {
  X,
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Trash2,
  FileText,
} from "lucide-react";
import { Subscription } from "@/lib/types";
import { calculateNextRenewalDate, formatDisplayDate } from "@/lib/dateCalculator";
import { getBrandColor, getBrandLogo } from "@/lib/logoHelper";

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportBulk: (subscriptions: Partial<Subscription>[]) => Promise<void> | void;
  availableMembers?: string[];
}

interface ParsedImportRow {
  name: string;
  cost: number;
  currency: string;
  billingCycle: "monthly" | "yearly" | "quarterly" | "weekly";
  startDate: string;
  validityDays: number;
  nextRenewalDate: string;
  whoUsesIt: string;
  planTier: string;
  paymentMethod: string;
  isValid: boolean;
  error?: string;
}

const SAMPLE_CSV = `Name,Cost,Billing Cycle,Validity Days,Start Date,Assigned Member,Plan Tier,Payment Method
Netflix,649,monthly,30,2026-10-03,Everyone,Standard HD,UPI AutoPay
Spotify,179,monthly,30,2026-10-22,Everyone,Premium Family,Credit Card
MyJio,349,monthly,28,2026-10-22,Everyone,Prepaid 2GB/Day,JioPay
Jio + Sun NXT,549,monthly,56,2026-10-22,Everyone,Standard 1.5GB/Day,UPI AutoPay
Prime Video,1499,yearly,365,2025-11-16,Everyone,Annual Prime,Amazon Pay
Google One,1300,yearly,365,2025-11-11,Everyone,100 GB Storage,Google Play
ZEE5,399,quarterly,92,2026-10-20,Everyone,Premium 4K,UPI AutoPay`;

export default function BulkImportModal({
  isOpen,
  onClose,
  onImportBulk,
  availableMembers = ["Everyone", "Primary", "Member"],
}: BulkImportModalProps) {
  const [inputText, setInputText] = useState("");
  const [parsedRows, setParsedRows] = useState<ParsedImportRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successCount, setSuccessCount] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleDownloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "trackmysubs_sample_import.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setInputText(text);
        parseContent(text);
      }
    };
    reader.readAsText(file);
  };

  const parseContent = (content: string) => {
    const lines = content
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) {
      setParsedRows([]);
      return;
    }

    const todayStr = new Date().toISOString().split("T")[0];
    const results: ParsedImportRow[] = [];

    // Detect if first line is header
    const firstLineLower = lines[0].toLowerCase();
    const hasHeader =
      firstLineLower.includes("name") ||
      firstLineLower.includes("cost") ||
      firstLineLower.includes("subscription") ||
      firstLineLower.includes("price");

    const dataLines = hasHeader ? lines.slice(1) : lines;

    for (const line of dataLines) {
      // Split by comma or tab (handles TSV copy-pasted from Excel / Google Sheets)
      const delimiter = line.includes("\t") ? "\t" : ",";
      const parts = line.split(delimiter).map((p) => p.trim().replace(/^["']|["']$/g, ""));

      const name = parts[0] || "Custom Subscription";
      const rawCost = parts[1] ? parseFloat(parts[1].replace(/[^0-9.]/g, "")) : 299;
      const cost = isNaN(rawCost) || rawCost <= 0 ? 299 : rawCost;

      const rawCycle = (parts[2] || "monthly").toLowerCase();
      let billingCycle: "monthly" | "yearly" | "quarterly" | "weekly" = "monthly";
      if (rawCycle.includes("year") || rawCycle.includes("annual")) billingCycle = "yearly";
      else if (rawCycle.includes("quarter")) billingCycle = "quarterly";
      else if (rawCycle.includes("week")) billingCycle = "weekly";

      let rawDays = parts[3] ? parseInt(parts[3].replace(/[^0-9]/g, ""), 10) : 0;
      if (!rawDays || isNaN(rawDays)) {
        if (name.toLowerCase().includes("jio") || name.toLowerCase().includes("airtel")) rawDays = 28;
        else if (billingCycle === "yearly") rawDays = 365;
        else if (billingCycle === "quarterly") rawDays = 92;
        else rawDays = 30;
      }
      const validityDays = rawDays;

      const startDate = parts[4] && /^\d{4}-\d{2}-\d{2}$/.test(parts[4]) ? parts[4] : todayStr;

      const renewalCalc = calculateNextRenewalDate({
        purchaseDate: startDate,
        textSnippet: `${name} ${validityDays} days validity`,
        cycle: billingCycle,
      });

      const whoUsesIt = parts[5] || availableMembers[0] || "Everyone";
      const planTier = parts[6] || `${validityDays} Days Plan`;
      const paymentMethod = parts[7] || "AutoPay Mandate";

      results.push({
        name,
        cost,
        currency: "INR",
        billingCycle,
        startDate,
        validityDays,
        nextRenewalDate: renewalCalc.renewalDate,
        whoUsesIt,
        planTier,
        paymentMethod,
        isValid: name.length > 0 && cost > 0,
      });
    }

    setParsedRows(results);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setInputText(text);
    parseContent(text);
  };

  const handleLoadSample = () => {
    setInputText(SAMPLE_CSV);
    parseContent(SAMPLE_CSV);
  };

  const handleExecuteImport = async () => {
    if (parsedRows.length === 0) return;
    setIsProcessing(true);

    const subscriptionsToInsert: Partial<Subscription>[] = parsedRows
      .filter((r) => r.isValid)
      .map((r) => {
        const monthlyCost =
          r.billingCycle === "yearly" ? Math.round(r.cost / 12) : r.cost;
        const brandColor = getBrandColor(r.name);
        const iconImage = getBrandLogo(r.name);

        return {
          name: r.name,
          cost: r.cost,
          monthly_cost: monthlyCost,
          currency: "INR",
          billing_cycle: r.billingCycle,
          status: "active",
          start_date: r.startDate,
          next_billing_date: r.nextRenewalDate,
          auto_renew: true,
          autopay_state: "on",
          who_uses_it: r.whoUsesIt,
          payment_method: r.paymentMethod,
          source: "receipt",
          source_detail: `Bulk CSV Import · ${r.validityDays} days cycle`,
          validity_days: r.validityDays,
          plan_tier: r.planTier,
          brand_letter: r.name.charAt(0).toUpperCase(),
          brand_color: brandColor,
          icon_image: iconImage,
          notify_before_days: 1,
          tags: ["Bulk-Import", r.whoUsesIt],
        };
      });

    try {
      await onImportBulk(subscriptionsToInsert);
      setSuccessCount(subscriptionsToInsert.length);
      setTimeout(() => {
        setSuccessCount(null);
        onClose();
      }, 2000);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-3xl bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-indigo-50/30">
          <div>
            <div className="text-[10px] font-black tracking-widest text-indigo-600 uppercase flex items-center gap-1.5 mb-1">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              Enterprise &amp; Family Import Tool
            </div>
            <h2 className="text-xl font-black text-slate-900">
              Bulk Import Subscriptions (CSV / Excel)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Upload a spreadsheet or paste rows to import 20+ subscriptions &amp; assign them to family members in 1 click.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-slate-900">
          {/* Action Row */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>Upload CSV / Excel File</span>
                <input
                  type="file"
                  accept=".csv,.txt,.tsv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              <button
                type="button"
                onClick={handleDownloadSample}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Download Sample Template</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleLoadSample}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition cursor-pointer"
            >
              Paste 7 Sample Subscriptions
            </button>
          </div>

          {/* Paste Input Area */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Paste Spreadsheet Rows or CSV Content:
            </label>
            <textarea
              rows={4}
              value={inputText}
              onChange={handleTextChange}
              placeholder="Name, Cost, Billing Cycle, Validity Days, Start Date, Assigned Member..."
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition"
            />
          </div>

          {/* Preview Table */}
          {parsedRows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-700 uppercase tracking-wider">
                  Ready to Import ({parsedRows.length} subscriptions detected)
                </span>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  Total Monthly Spend: ₹
                  {parsedRows
                    .reduce((sum, r) => sum + (r.billingCycle === "yearly" ? Math.round(r.cost / 12) : r.cost), 0)
                    .toLocaleString("en-IN")}
                </span>
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-56 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="py-2.5 px-4">Service</th>
                      <th className="py-2.5 px-3">Cost</th>
                      <th className="py-2.5 px-3">Cycle / Validity</th>
                      <th className="py-2.5 px-3">Next Renewal</th>
                      <th className="py-2.5 px-3">Assigned Member</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {parsedRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-4 font-bold text-slate-900">{row.name}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-indigo-700">₹{row.cost}</td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {row.validityDays}d ({row.billingCycle})
                        </td>
                        <td className="py-2.5 px-3 font-mono text-emerald-700 font-semibold">
                          {formatDisplayDate(row.nextRenewalDate)}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-[11px] font-semibold">
                            {row.whoUsesIt}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {successCount !== null && (
            <div className="p-4 bg-emerald-500 text-white rounded-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-5 h-5" />
              <span>✅ Successfully imported {successCount} subscriptions to your table and calendar!</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleExecuteImport}
            disabled={parsedRows.length === 0 || isProcessing}
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-bold rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer"
          >
            {isProcessing ? (
              <span>Importing {parsedRows.length} subscriptions...</span>
            ) : (
              <>
                <span>Import {parsedRows.length} Subscriptions Now</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

