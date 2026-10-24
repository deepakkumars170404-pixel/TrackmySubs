/**
 * Intelligent Renewal Date & Validity Days Calculator
 * Automatically calculates next renewal date from:
 * 1. Explicit dates found in receipts or emails (e.g. "22 Nov 2026", "2026-11-22")
 * 2. Validity periods (e.g. "30 days valid", "29 days valid", "valid for 28 days")
 * 3. User-selected duration or billing cycles
 */

export interface RenewalCalculationResult {
  renewalDate: string; // Format: YYYY-MM-DD
  validityDays: number;
  source: "explicit_date" | "validity_days" | "billing_cycle";
  explanation: string;
}

/**
 * Parses validity days from arbitrary email text or snippets
 * e.g., "30 days valid", "29 days validity", "valid for 28 days", "validity: 30 days"
 */
export function extractValidityDaysFromText(text: string): number | null {
  if (!text) return null;

  // Patterns for days: "56d", "56 days", "28 days", "30 days valid", "29 days validity", "pack validity 56 days"
  const dayPatterns = [
    /(\d+)\s*days?\s*valid(?:ity)?/i,
    /valid(?:ity)?\s*(?:for|of)?\s*[:\s]*(\d+)\s*days?/i,
    /valid\s*for\s*(\d+)\s*days?/i,
    /(\d+)[-\s]day\s*valid(?:ity|ation)?/i,
    /duration\s*[:\s]*(\d+)\s*days?/i,
    /pack\s*validity\s*[:\s]*(\d+)\s*days?/i,
    /expires?\s*in\s*(\d+)\s*days?/i,
    /\((\d+)d\)/i, // "(56d)", "(28d)"
    /(\d+)\s*d\b/i, // "56d", "28d", "84d", "90d"
    /(\d+)\s*days?\b/i, // "56 days", "28 days", "90 days"
  ];

  for (const regex of dayPatterns) {
    const match = text.match(regex);
    if (match && match[1]) {
      const days = parseInt(match[1], 10);
      if (!isNaN(days) && days > 0 && days < 1000) {
        return days;
      }
    }
  }

  // Patterns for months: "1 month valid", "valid for 1 month"
  const monthMatch = text.match(/(\d+)\s*months?\s*valid/i) || text.match(/valid\s*for\s*(\d+)\s*months?/i);
  if (monthMatch && monthMatch[1]) {
    const months = parseInt(monthMatch[1], 10);
    if (!isNaN(months) && months > 0) {
      return months * 30; // standard 30-day month
    }
  }

  // Patterns for years: "1 year valid", "365 days valid"
  if (/1\s*year\s*valid/i.test(text) || /annual\s*valid/i.test(text)) {
    return 365;
  }

  return null;
}

/**
 * Parses explicit renewal or due dates in text like:
 * "Next renewal: 22 Nov 2026", "Renews on: 2026-11-22", "Next charge: Nov 22, 2026"
 */
export function extractExplicitDateFromText(text: string): string | null {
  if (!text) return null;

  const datePatterns = [
    /(?:next\s*renewal|renewal\s*date|renews?\s*on|next\s*charge|due\s*on)[\s:]*([A-Za-z0-9\s,\-]+)/i,
    /(?:valid\s*till|valid\s*until|expiry\s*date)[\s:]*([A-Za-z0-9\s,\-]+)/i,
  ];

  for (const regex of datePatterns) {
    const match = text.match(regex);
    if (match && match[1]) {
      const candidate = match[1].trim();
      const parsed = Date.parse(candidate);
      if (!isNaN(parsed)) {
        const d = new Date(parsed);
        return d.toISOString().split("T")[0];
      }
    }
  }

  return null;
}

/**
 * Parses YYYY-MM-DD safely into { year, month (1-12), day } without timezone shifts
 */
export function parseDateParts(baseDate: string | Date): { year: number; month: number; day: number } {
  if (typeof baseDate === "string") {
    const clean = baseDate.split("T")[0];
    const parts = clean.split("-");
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const d = parseInt(parts[2], 10);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        return { year: y, month: m, day: d };
      }
    }
  }
  const d = typeof baseDate === "string" ? new Date(baseDate) : baseDate;
  if (!isNaN(d.getTime())) {
    return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

/**
 * Returns number of days in a specific calendar month (handles 28, 29, 30, 31)
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Adds a specific number of days to a date string (YYYY-MM-DD or Date object)
 * 100% Timezone-safe & UTC accurate: never shifts by +/- 1 day due to local offsets.
 */
export function addDaysToDate(baseDate: string | Date, daysToAdd: number): string {
  const { year, month, day } = parseDateParts(baseDate);
  const result = new Date(Date.UTC(year, month - 1, day + daysToAdd));
  const y = result.getUTCFullYear();
  const m = String(result.getUTCMonth() + 1).padStart(2, "0");
  const d = String(result.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Adds or subtracts calendar months to a date string (YYYY-MM-DD).
 * Clamps days to the maximum days of the target month:
 * e.g. 2026-01-31 + 1 month → 2026-02-28
 * e.g. 2026-10-31 + 1 month → 2026-11-30
 * e.g. 2026-10-03 + 1 month → 2026-11-03
 */
export function addMonthsToDate(baseDate: string | Date, monthsToAdd: number): string {
  const { year, month, day } = parseDateParts(baseDate);
  const totalMonths = month - 1 + monthsToAdd;
  const targetYear = year + Math.floor(totalMonths / 12);
  const targetMonth = ((totalMonths % 12) + 12) % 12 + 1; // 1-12
  const maxDays = getDaysInMonth(targetYear, targetMonth);
  const targetDay = Math.min(day, maxDays);

  return `${targetYear}-${String(targetMonth).padStart(2, "0")}-${String(targetDay).padStart(2, "0")}`;
}

/**
 * Calculates exact calendar difference in days between two date strings (YYYY-MM-DD)
 * Uses Date.UTC for 100% exact integer day counting without DST or timezone shifts.
 */
export function calculateDaysBetween(startDate: string, endDate: string): number {
  try {
    const s = parseDateParts(startDate);
    const e = parseDateParts(endDate);
    const sUtc = Date.UTC(s.year, s.month - 1, s.day);
    const eUtc = Date.UTC(e.year, e.month - 1, e.day);
    const diff = Math.round((eUtc - sUtc) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  } catch {
    return 30;
  }
}

/**
 * Computes the active next renewal date by automatically advancing through
 * successive cycles (e.g. 28 days -> 56 days -> 84 days...) from the start date
 * so the next renewal date is always current and never stuck in the past.
 */
export function getAutoAdvancedRenewalDate({
  startDate,
  validityDays,
  billingCycle = "monthly",
  asOfDate,
}: {
  startDate: string;
  validityDays?: number | null;
  billingCycle?: string;
  asOfDate?: string;
}): string {
  const cleanStart = (startDate || "").split("T")[0];
  if (!cleanStart) return new Date().toISOString().split("T")[0];

  const nowStr = asOfDate || new Date().toISOString().split("T")[0];

  // Resolve true cycle validity in days
  let cycleDays = validityDays && validityDays > 0 ? validityDays : 30;
  if (billingCycle === "yearly" && (!validityDays || validityDays <= 30)) {
    cycleDays = 365;
  } else if (billingCycle === "quarterly" && (!validityDays || validityDays <= 30)) {
    cycleDays = 90;
  } else if (billingCycle === "weekly") {
    cycleDays = 7;
  }

  // If start date is in the future, 1st renewal is cleanStart + cycleDays
  if (cleanStart > nowStr) {
    return addDaysToDate(cleanStart, cycleDays);
  }

  const elapsedDays = calculateDaysBetween(cleanStart, nowStr);
  const completedCycles = Math.floor(elapsedDays / cycleDays);
  const nextCycle = completedCycles + 1;
  const nextRenewalDays = nextCycle * cycleDays; // e.g. 28, 56, 84, 112...

  return addDaysToDate(cleanStart, nextRenewalDays);
}

/**
 * Master calculator: computes next renewal date accurately.
 * Respects explicit dates, custom validity days (e.g. Jio 28 days),
 * or calendar month boundaries (30 vs 31 days).
 */
export function calculateNextRenewalDate({
  purchaseDate,
  validityDays,
  textSnippet,
  cycle = "monthly",
}: {
  purchaseDate?: string | Date;
  validityDays?: number | null;
  textSnippet?: string | null;
  cycle?: "monthly" | "yearly" | "quarterly" | "weekly" | "custom";
}): RenewalCalculationResult {
  const baseDateStr = purchaseDate
    ? typeof purchaseDate === "string"
      ? purchaseDate.split("T")[0]
      : purchaseDate.toISOString().split("T")[0]
    : new Date().toISOString().split("T")[0];

  // 1. Check for explicit validity days (e.g. "28 days valid", "30 days validity", "pack validity 28 days")
  let targetDays = validityDays;
  if (!targetDays && textSnippet) {
    targetDays = extractValidityDaysFromText(textSnippet);
  }

  // Auto-detect telecom 28-day validity for Jio / Airtel recharges
  if (!targetDays && textSnippet && /(?:jio|airtel|vodafone|vi\s|bsnl)/i.test(textSnippet)) {
    targetDays = 28;
  }

  if (targetDays && targetDays > 0) {
    const calculatedDate = addDaysToDate(baseDateStr, targetDays);
    return {
      renewalDate: calculatedDate,
      validityDays: targetDays,
      source: "validity_days",
      explanation: `Calculated from ${targetDays} days validity: ${formatDisplayDate(baseDateStr)} + ${targetDays} days → ${formatDisplayDate(calculatedDate)}`,
    };
  }

  // 2. Check for explicit next renewal date in snippet text (if no validity days specified)
  if (textSnippet) {
    const explicit = extractExplicitDateFromText(textSnippet);
    if (explicit) {
      const parsedDays = calculateDaysBetween(baseDateStr, explicit);
      return {
        renewalDate: explicit,
        validityDays: parsedDays > 0 ? parsedDays : 30,
        source: "explicit_date",
        explanation: `Explicit renewal date verified from email receipt: ${formatDisplayDate(explicit)}`,
      };
    }
  }

  // 3. Calculation based on billing cycle:
  // For monthly (all OTT channels and monthly subscriptions): standard fixed 30-day period
  if (cycle === "monthly") {
    const nextDate = addDaysToDate(baseDateStr, 30);
    return {
      renewalDate: nextDate,
      validityDays: 30,
      source: "billing_cycle",
      explanation: `Calculated from standard 30-day subscription period: ${formatDisplayDate(baseDateStr)} + 30 days → ${formatDisplayDate(nextDate)}`,
    };
  }

  if (cycle === "quarterly") {
    const nextDate = addMonthsToDate(baseDateStr, 3);
    const exactDays = calculateDaysBetween(baseDateStr, nextDate);
    return {
      renewalDate: nextDate,
      validityDays: exactDays,
      source: "billing_cycle",
      explanation: `Calculated from quarterly billing cycle (${exactDays} days): ${formatDisplayDate(baseDateStr)} → ${formatDisplayDate(nextDate)}`,
    };
  }

  if (cycle === "yearly") {
    const nextDate = addMonthsToDate(baseDateStr, 12);
    const exactDays = calculateDaysBetween(baseDateStr, nextDate);
    return {
      renewalDate: nextDate,
      validityDays: exactDays || 365,
      source: "billing_cycle",
      explanation: `Calculated from annual billing cycle (${exactDays || 365} days): ${formatDisplayDate(baseDateStr)} → ${formatDisplayDate(nextDate)}`,
    };
  }

  if (cycle === "weekly") {
    const nextDate = addDaysToDate(baseDateStr, 7);
    return {
      renewalDate: nextDate,
      validityDays: 7,
      source: "billing_cycle",
      explanation: `Calculated from 7-day weekly cycle: ${formatDisplayDate(baseDateStr)} → ${formatDisplayDate(nextDate)}`,
    };
  }

  const defaultCalculated = addDaysToDate(baseDateStr, 30);
  return {
    renewalDate: defaultCalculated,
    validityDays: 30,
    source: "billing_cycle",
    explanation: `Calculated from standard 30-day validity: ${formatDisplayDate(baseDateStr)} → ${formatDisplayDate(defaultCalculated)}`,
  };
}

/**
 * Formats YYYY-MM-DD to "03 Nov, 2026" or "Nov 03, 2026"
 * Timezone-safe: constructs local Date without UTC offset shift.
 */
export function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const { year, month, day } = parseDateParts(dateStr);
    const d = new Date(year, month - 1, day);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

/**
 * Calculates remaining days from today until renewal
 */
export function getDaysRemaining(renewalDate: string): number {
  try {
    const { year, month, day } = parseDateParts(renewalDate);
    const target = new Date(year, month - 1, day).getTime();
    const now = new Date();
    const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return Math.ceil((target - todayMid) / (1000 * 60 * 60 * 24));
  } catch {
    return 30;
  }
}

