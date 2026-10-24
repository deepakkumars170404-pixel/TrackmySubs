"use client";

import React from "react";

export type BadgeVariant = 
  | "connected" 
  | "review_needed" 
  | "estimated" 
  | "action_required" 
  | "receipt" 
  | "autopay_on" 
  | "autopay_off" 
  | "owner" 
  | "member";

interface BadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export function TrackBadge({ variant, children, className = "", onClick }: BadgeProps) {
  const base = "inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-tight transition-colors";
  
  let styles = "";
  switch (variant) {
    case "connected":
    case "autopay_on":
      styles = "bg-indigo-50 text-indigo-700 border border-indigo-200/80";
      break;
    case "review_needed":
      styles = "bg-amber-50 text-amber-800 border border-amber-200";
      break;
    case "estimated":
      styles = "bg-sky-50 text-sky-700 border border-sky-200";
      break;
    case "action_required":
    case "autopay_off":
      styles = "bg-rose-50 text-rose-700 border border-rose-200";
      break;
    case "receipt":
      styles = "bg-slate-100 text-slate-700 border border-slate-200";
      break;
    case "owner":
      styles = "bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 text-indigo-900 border border-indigo-200/90 font-bold shadow-2xs";
      break;
    case "member":
      styles = "bg-slate-100 text-slate-600 border border-slate-200";
      break;
    default:
      styles = "bg-slate-100 text-slate-700 border border-slate-200";
  }

  return (
    <span 
      onClick={onClick}
      className={`${base} ${styles} ${onClick ? "cursor-pointer hover:opacity-85" : ""} ${className}`}
    >
      {children}
    </span>
  );
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "subtle" | "danger";
  size?: "sm" | "md" | "lg";
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export function TrackButton({
  variant = "primary",
  size = "md",
  icon,
  children,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  const sizeClasses = {
    sm: "px-3 py-1.5 text-[12px]",
    md: "px-4 py-2 text-[13px]",
    lg: "px-5 py-2.5 text-[14px]"
  };

  let variantClasses = "";
  switch (variant) {
    case "primary":
      variantClasses = "bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-semibold shadow-sm shadow-indigo-500/20 active:scale-[0.98]";
      break;
    case "secondary":
      variantClasses = "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 hover:text-slate-900 shadow-2xs active:scale-[0.98]";
      break;
    case "subtle":
      variantClasses = "bg-indigo-50 text-indigo-700 hover:bg-indigo-100/80 active:bg-indigo-200/60 font-semibold";
      break;
    case "danger":
      variantClasses = "bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 font-semibold";
      break;
  }

  return (
    <button
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${sizeClasses[size]} ${variantClasses} ${className}`}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </button>
  );
}

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export function TrackCard({ children, className = "", onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs transition-all ${
        onClick ? "cursor-pointer hover:border-indigo-500/40 hover:shadow-md" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

// Aliases for seamless backward compatibility
export const KinBadge = TrackBadge;
export const KinButton = TrackButton;
export const KinCard = TrackCard;

