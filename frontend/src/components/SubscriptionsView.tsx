"use client";


import React, { useState } from "react";
import {
  Plus,
  Search,
  Trash2,
  Receipt,
  FileQuestion,
  AlertCircle,
  Eye,
  Check,
  FileText,
  Sparkles,
  Smartphone,
  Send,
  Zap,
  Calendar as CalendarIcon,
  CheckCircle2,
  X,
  Clock,
  ChevronDown,
  ChevronUp,
  Radio,
  FileSpreadsheet,
  Download,
  Upload,
} from "lucide-react";
import { Subscription } from "@/lib/types";
import { BrandLogo } from "@/lib/logoHelper";
import { getSubscriptionMonthlyCost, useHousehold } from "@/context/HouseholdContext";
import ReceiptBillModal from "./ReceiptBillModal";
import { formatDisplayDate, getDaysRemaining } from "@/lib/dateCalculator";
import {
  parseSubscriptionMessage,
  isSubscriptionMessage,
  SAMPLE_MESSAGES,
  ParsedSubscriptionResult,
} from "@/lib/messageParser";

interface SubscriptionsViewProps {
  subscriptions: Subscription[];
  onOpenAddModal: () => void;
  onDeleteSubscription: (id: string) => void;
  onSelectSubscriptionForReminder: (sub: Subscription) => void;
  onAddSubscription?: (sub: any) => Promise<any> | void;
}

type FilterCategory = "all" | "renewing_soon" | "needs_review";
type SortOption = "renewal_date" | "cost_desc" | "cost_asc" | "name";

export default function SubscriptionsView({
  subscriptions,
  onOpenAddModal,
  onDeleteSubscription,
  onSelectSubscriptionForReminder,
  onAddSubscription,
}: SubscriptionsViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterCategory>("all");
  const [sortBy, setSortBy] = useState<SortOption>("renewal_date");
  const [selectedReceiptSub, setSelectedReceiptSub] = useState<Subscription | null>(null);
  const { setIsBulkImportOpen } = useHousehold();

  const handleExportCSV = () => {
    const headers = [
      "Name",
      "Cost (INR)",
      "Monthly Equivalent",
      "Billing Cycle",
      "Validity Days",
      "Start Date",
      "Next Renewal Date",
      "Assigned Member",
      "Status",
      "Payment Method",
      "Source",
    ];
    const rows = subscriptions.map((s) => [
      `"${s.name.replace(/"/g, '""')}"`,
      s.cost,
      s.monthly_cost,
      s.billing_cycle,
      s.validity_days || 30,
      s.start_date || "",
      s.next_billing_date || "",
      `"${(s.who_uses_it || "Everyone").replace(/"/g, '""')}"`,
      s.status,
      `"${(s.payment_method || "AutoPay").replace(/"/g, '""')}"`,
      `"${(s.source_detail || s.source || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `trackmysubs_subscriptions_${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtering
  const filteredList = subscriptions.filter((sub) => {
    const matchSearch =
      sub.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (sub.who_uses_it && sub.who_uses_it.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (sub.plan_tier && sub.plan_tier.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (sub.tags && sub.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())));

    if (!matchSearch) return false;

    if (activeFilter === "all") return true;
    if (activeFilter === "renewing_soon") {
      if (!sub.next_billing_date) return false;
      const days = getDaysRemaining(sub.next_billing_date);
      return days >= 0 && days <= 14;
    }
    if (activeFilter === "needs_review") {
      return sub.autopay_state === "review" || sub.source === "needs_review";
    }
    return true;
  });

  // Sorting
  const sortedList = [...filteredList].sort((a, b) => {
    if (sortBy === "renewal_date") {
      return new Date(a.next_billing_date).getTime() - new Date(b.next_billing_date).getTime();
    }
    if (sortBy === "cost_desc") {
      return (b.monthly_cost || b.cost) - (a.monthly_cost || a.cost);
    }
    if (sortBy === "cost_asc") {
      return (a.monthly_cost || a.cost) - (b.monthly_cost || b.cost);
    }
    if (sortBy === "name") {
      return a.name.localeCompare(b.name);
    }
    return 0;
  });

  const totalMonthlySpend = subscriptions.reduce(
    (acc, s) => acc + getSubscriptionMonthlyCost(s),
    0
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold tracking-wider text-indigo-600 uppercase flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-pink-500" />
            Office &amp; Home Plans &amp; Mail Receipts
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 leading-tight">
            Subscriptions Ledger
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Every plan in one list with live brand logos, email receipt bills, and renewal calculators.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition active:scale-[0.98] cursor-pointer"
            title="Download full CSV spreadsheet of active subscriptions"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={() => setIsBulkImportOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl border border-indigo-200 transition active:scale-[0.98] cursor-pointer"
            title="Import 20+ subscriptions from spreadsheet or CSV"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-600" />
            <span>Bulk Import (CSV)</span>
          </button>

          <button
            onClick={onOpenAddModal}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-pink-500/25 transition active:scale-[0.98] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add subscription</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar with Multi-Color Badges */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-3 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by service, member, or tag..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setActiveFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeFilter === "all"
                ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-sm shadow-indigo-600/30"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"
            }`}
          >
            All {subscriptions.length}
          </button>
          <button
            onClick={() => setActiveFilter("renewing_soon")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeFilter === "renewing_soon"
                ? "bg-rose-600 text-white shadow-sm shadow-rose-600/30"
                : "bg-rose-50 text-rose-700 hover:bg-rose-100/70 border border-rose-200"
            }`}
          >
            Renewing soon
          </button>
          <button
            onClick={() => setActiveFilter("needs_review")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
              activeFilter === "needs_review"
                ? "bg-amber-600 text-white shadow-sm"
                : "bg-amber-50 text-amber-800 hover:bg-amber-100/70 border border-amber-200"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span>Needs review</span>
          </button>
        </div>

        {/* Sort Dropdown */}
        <div className="flex items-center gap-1.5 text-xs text-slate-600 pl-1">
          <span className="text-slate-400">Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="bg-transparent font-bold text-slate-800 border-none focus:outline-none cursor-pointer"
          >
            <option value="renewal_date">Renewal date</option>
            <option value="cost_desc">Cost (High to Low)</option>
            <option value="cost_asc">Cost (Low to High)</option>
            <option value="name">Service Name</option>
          </select>
        </div>
      </div>

      {/* Main Table with Service Brand Logos & Receipt Bill Icons */}
      <div className="bg-white border border-slate-200/80 rounded-3xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold text-slate-400 tracking-wider uppercase">
                <th className="py-3.5 px-6">Service / Brand</th>
                <th className="py-3.5 px-4">Who uses it</th>
                <th className="py-3.5 px-4">Next Renewal</th>
                <th className="py-3.5 px-4">Monthly Cost</th>
                <th className="py-3.5 px-4">Source / Bill</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[13px]">
              {sortedList.map((item) => (
                <tr
                  key={item.id}
                  className="hover:bg-slate-50/80 transition-colors group"
                >
                  {/* Service Real Brand Logo & Plan */}
                  <td className="py-3.5 px-6">
                    <div className="flex items-center gap-3">
                      <BrandLogo
                        name={item.name}
                        iconUrl={item.icon_image}
                        size="md"
                        rounded="rounded-2xl"
                      />
                      <div>
                        <div className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors flex items-center gap-1.5">
                          <span>{item.name}</span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {item.plan_tier || `${item.billing_cycle} plan`}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Who uses it with colorful tags */}
                  <td className="py-3.5 px-4 font-medium">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        item.who_uses_it?.includes("Alex") || item.who_uses_it?.includes("Owner")
                          ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                          : item.who_uses_it?.includes("Priya")
                          ? "bg-pink-50 text-pink-700 border border-pink-200"
                          : item.who_uses_it?.includes("Aarav")
                          ? "bg-cyan-50 text-cyan-700 border border-cyan-200"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {item.who_uses_it || "Everyone"}
                    </span>
                  </td>

                  {/* Next Renewal Date */}
                  <td className="py-3.5 px-4 text-slate-700 font-mono text-xs font-semibold">
                    {formatDisplayDate(item.next_billing_date)}
                  </td>

                  {/* Monthly Cost */}
                  <td className="py-3.5 px-4">
                    <div className="font-black text-slate-900 font-mono text-sm">
                      ₹{(item.monthly_cost || item.cost).toLocaleString("en-IN")}
                    </div>
                    {item.billing_cycle === "yearly" && (
                      <div className="text-[10px] text-slate-400 font-mono">
                        ₹{item.cost.toLocaleString("en-IN")}/yr
                      </div>
                    )}
                  </td>

                  {/* Source & View Bill Link */}
                  <td className="py-3.5 px-4">
                    {item.source === "receipt" ? (
                      <button
                        onClick={() => setSelectedReceiptSub(item)}
                        className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-cyan-800 bg-cyan-50 hover:bg-cyan-100 px-2.5 py-1 rounded-lg border border-cyan-200/90 transition cursor-pointer"
                        title="Click to view verified mail receipt and tax bill"
                      >
                        <Receipt className="w-3.5 h-3.5 text-cyan-600" />
                        <span>Receipt</span>
                      </button>
                    ) : item.source === "estimate" ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-800 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-200">
                        <FileQuestion className="w-3 h-3 text-indigo-600" />
                        <span>Estimate</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200">
                        <AlertCircle className="w-3 h-3 text-amber-600" />
                        <span>Needs review</span>
                      </span>
                    )}
                  </td>

                  {/* Actions (View Bill, Reminder, Delete) */}
                  <td className="py-3.5 px-6 text-right">
                    <div className="flex items-center justify-end gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
                      {/* NEW: Dedicated Bill / Receipt Icon Button */}
                      <button
                        onClick={() => setSelectedReceiptSub(item)}
                        className="p-1.5 rounded-lg bg-indigo-50/80 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-900 transition cursor-pointer border border-indigo-200/70 shadow-2xs flex items-center gap-1"
                        title="View Mail Receipt & Tax Bill"
                      >
                        <Receipt className="w-4 h-4 text-indigo-600" />
                        <span className="hidden xl:inline text-[11px] font-bold">Bill</span>
                      </button>

                      <button
                        onClick={() => onSelectSubscriptionForReminder(item)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-indigo-600 transition cursor-pointer"
                        title="View reminder details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => onDeleteSubscription(item.id)}
                        className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                        title="Delete subscription"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Table Summary Footer with Gradient Highlight */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-600">
          <div>
            <span className="font-bold text-slate-800">
              {subscriptions.length} subscriptions tracked
            </span>
            <span className="mx-2 text-slate-300">·</span>
            <span>
              Total monthly spend{" "}
              <strong className="bg-gradient-to-r from-indigo-600 to-pink-600 bg-clip-text text-transparent font-black font-mono">
                ₹{totalMonthlySpend.toLocaleString("en-IN")} / month
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-2 text-slate-400 font-mono text-xs">
            <span>‹ 1 of 1 ›</span>
          </div>
        </div>
      </div>

      {/* Bill & Mail Receipt Modal */}
      <ReceiptBillModal
        isOpen={Boolean(selectedReceiptSub)}
        subscription={selectedReceiptSub}
        onClose={() => setSelectedReceiptSub(null)}
      />

    </div>
  );
}
