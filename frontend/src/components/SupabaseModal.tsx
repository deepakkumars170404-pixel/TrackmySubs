"use client";

import React from "react";
import { X, Database } from "lucide-react";

interface SupabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  isConfigured: boolean;
}

export default function SupabaseModal({ isOpen, onClose, isConfigured }: SupabaseModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-white border border-[#E5E9E3] rounded-2xl shadow-xl overflow-hidden p-6 sm:p-7 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-[#E5E9E3]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-bold tracking-wider text-stone-400 uppercase">
                Backend Services
              </span>
              <h3 className="text-[18px] font-semibold text-stone-900 leading-tight">
                Supabase PostgreSQL &amp; Auth
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div
            className={`p-3.5 rounded-xl border flex items-center justify-between ${
              isConfigured
                ? "bg-cyan-50 border-cyan-200 text-cyan-800"
                : "bg-amber-50 border-amber-200 text-amber-800"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isConfigured ? "bg-cyan-500" : "bg-amber-500 animate-pulse"
                }`}
              />
              <span className="text-[13px] font-semibold">
                {isConfigured ? "Connected to Supabase" : "Running on Local Starter Data"}
              </span>
            </div>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-white/70">
              {isConfigured ? "RLS Active" : "Fallback Mode"}
            </span>
          </div>

          <p className="text-[12px] text-stone-600 leading-relaxed">
            {isConfigured
              ? "Your household plans and member profiles are synced directly with Supabase PostgreSQL and protected by Row Level Security (RLS)."
              : "To link your live Supabase database, set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in frontend/.env.local. The app seamlessly falls back to rich family mock data so you can test all screens immediately."}
          </p>

          <div className="p-3 rounded-xl bg-[#F5F7F4] border border-[#E5E9E3] text-[11px] font-mono text-stone-600 space-y-1">
            <p>NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co</p>
            <p>NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJh......</p>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:via-purple-700 hover:to-pink-700 text-white text-[13px] font-semibold rounded-xl transition shadow-md shadow-indigo-500/20"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
