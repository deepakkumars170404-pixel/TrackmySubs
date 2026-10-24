import { getBrandLogo, getBrandColor, getBrandInfo } from "./logoHelper";
import { calculateNextRenewalDate, addDaysToDate, formatDisplayDate } from "./dateCalculator";
import { BillingCycle } from "./types";

export interface ParsedSubscriptionResult {
  name: string;
  cost: number;
  planTier: string;
  startDate: string;
  nextBillingDate: string;
  validityDays: number;
  billingCycle: BillingCycle;
  paymentMethod: string;
  iconImage: string;
  brandColor: string;
  sourceDetail: string;
  evidenceSnippet: string;
  calculationNote: string;
  tags?: string[];
}

export function isSubscriptionMessage(text: string): boolean {
  if (!text || text.trim().length < 6) return false;
  const lower = text.toLowerCase();
  const hasKeyword = /(?:recharge|subscription|renew|validity|plan|pack|debited|charged|autopay|mandate|membership|bill|paid|voucher)/i.test(lower);
  const hasAmountOrDays = /(?:₹|rs\.?|inr|\d+\s*days?|\d{2,})/i.test(lower);
  return hasKeyword && hasAmountOrDays;
}

/**
 * Known keyword matching for popular Indian and global services
 */
const KNOWN_SERVICES_RULES: Array<{
  keywords: string[];
  canonicalName: string;
  defaultTier: string;
  defaultPayment: string;
}> = [
  {
    keywords: ["sunnxt", "sun nxt", "jio sunnxt", "jio + sun nxt", "sun tv"],
    canonicalName: "Jio + Sun NXT",
    defaultTier: "Standard 1.5GB/Day · 56 Days",
    defaultPayment: "UPI AutoPay",
  },
  {
    keywords: ["jio hotstar", "jio+hotstar", "jio disney", "hotstar jio"],
    canonicalName: "Jio + Disney+ Hotstar",
    defaultTier: "Standard 1.5GB/Day · 56 Days",
    defaultPayment: "UPI AutoPay",
  },
  {
    keywords: ["myjio", "jio", "reliance jio", "jio fiber"],
    canonicalName: "MyJio",
    defaultTier: "Prepaid 2GB/Day · 28 Days",
    defaultPayment: "JioPay / UPI AutoPay",
  },
  {
    keywords: ["gemini", "google gemini", "gemini advanced"],
    canonicalName: "Google Gemini Advanced",
    defaultTier: "Advanced · Monthly (GPT-4o/Ultra)",
    defaultPayment: "Google Play Store",
  },
  {
    keywords: ["netflix"],
    canonicalName: "Netflix",
    defaultTier: "Standard HD (2 Screens)",
    defaultPayment: "AutoPay Mandate",
  },
  {
    keywords: ["spotify"],
    canonicalName: "Spotify",
    defaultTier: "Family · Monthly",
    defaultPayment: "UPI AutoPay",
  },
  {
    keywords: ["prime", "amazon prime", "prime video"],
    canonicalName: "Prime Video",
    defaultTier: "Amazon Prime Annual",
    defaultPayment: "Amazon Pay ICICI",
  },
  {
    keywords: ["youtube", "youtube premium", "youtube music"],
    canonicalName: "YouTube Premium",
    defaultTier: "Family Plan · Monthly",
    defaultPayment: "Google Play AutoPay",
  },
  {
    keywords: ["hotstar", "disney", "disney+ hotstar"],
    canonicalName: "Disney+ Hotstar",
    defaultTier: "Super Annual (2 Screens)",
    defaultPayment: "Paytm AutoPay",
  },
  {
    keywords: ["airtel", "airtel thanks"],
    canonicalName: "Airtel Thanks",
    defaultTier: "Unlimited 5G · 28 Days",
    defaultPayment: "Airtel Payments Bank",
  },
  {
    keywords: ["swiggy", "swiggy one"],
    canonicalName: "Swiggy One",
    defaultTier: "One Membership · 3 Months",
    defaultPayment: "UPI AutoPay",
  },
  {
    keywords: ["zomato", "zomato gold"],
    canonicalName: "Zomato Gold",
    defaultTier: "Gold Membership · 3 Months",
    defaultPayment: "UPI AutoPay",
  },
  {
    keywords: ["chatgpt", "openai"],
    canonicalName: "ChatGPT Plus",
    defaultTier: "Plus Subscription (GPT-4o)",
    defaultPayment: "Credit Card",
  },
  {
    keywords: ["github", "copilot"],
    canonicalName: "GitHub Copilot",
    defaultTier: "Copilot Pro Individual",
    defaultPayment: "GitHub Billing",
  },
  {
    keywords: ["apple", "icloud"],
    canonicalName: "Apple iCloud+",
    defaultTier: "200 GB Storage Family",
    defaultPayment: "Apple ID Balance",
  },
  {
    keywords: ["canva"],
    canonicalName: "Canva Pro",
    defaultTier: "Pro Team Design",
    defaultPayment: "Card AutoPay",
  },
  {
    keywords: ["duolingo"],
    canonicalName: "Duolingo Super",
    defaultTier: "Super · Monthly",
    defaultPayment: "UPI AutoPay",
  },
];

/**
 * Extracts amount in INR (₹) or standard numeric currency
 */
function extractAmount(text: string): number | null {
  // Pattern 1: ₹349, ₹1,950, ₹ 1950.00
  const inrMatch = text.match(/(?:₹|rs\.?|inr)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i);
  if (inrMatch && inrMatch[1]) {
    const parsed = parseFloat(inrMatch[1].replace(/,/g, ""));
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }

  // Pattern 2: "amount: 349", "charged 1950"
  const amountMatch = text.match(/(?:amount|charged|recharge|debited|paid|price|fee)\s*(?:of|is)?\s*[:\s]*([0-9,]+(?:\.[0-9]{1,2})?)/i);
  if (amountMatch && amountMatch[1]) {
    const parsed = parseFloat(amountMatch[1].replace(/,/g, ""));
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }

  return null;
}

/**
 * Extracts purchase or start date from message, defaulting to today
 */
function extractPurchaseDate(text: string): string {
  const todayStr = new Date().toISOString().split("T")[0];

  // Match e.g. "22-Oct-2026", "22 Oct 2026", "22/10/2026", "2026-10-22"
  const dateRegexes = [
    /(?:on|dated|date[:\s]*|debited on[:\s]*|charged on[:\s]*)(\d{1,2}[-\s][A-Za-z]{3,9}[-\s]\d{4})/i,
    /(?:on|dated|date[:\s]*|debited on[:\s]*|charged on[:\s]*)(\d{4}-\d{2}-\d{2})/i,
    /(\d{1,2}[-\s][A-Za-z]{3,9}[-\s]\d{4})/i,
    /(\d{4}-\d{2}-\d{2})/,
  ];

  for (const regex of dateRegexes) {
    const match = text.match(regex);
    if (match && match[1]) {
      const parsed = Date.parse(match[1]);
      if (!isNaN(parsed)) {
        return new Date(parsed).toISOString().split("T")[0];
      }
    }
  }

  return todayStr;
}

/**
 * Master parser function
 */
export function parseSubscriptionMessage(rawText: string): ParsedSubscriptionResult {
  const cleaned = (rawText || "").trim();
  const lower = cleaned.toLowerCase();

  // 1. Identify service
  let detectedName = "";
  let detectedTier = "Standard Plan";
  let detectedPayment = "AutoPay Mandate";

  for (const rule of KNOWN_SERVICES_RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      detectedName = rule.canonicalName;
      detectedTier = rule.defaultTier;
      detectedPayment = rule.defaultPayment;
      break;
    }
  }

  // Fallback: If not in known services, extract first capitalized word or brand name
  if (!detectedName) {
    const brandMatch = cleaned.match(/(?:recharge of|subscription to|membership of|plan for|payment to|invoice for|order from)\s+([A-Za-z0-9\s+]+?)(?:\s+(?:is|was|has|for|of|on|successful|confirmed|receipt|active))/i);
    if (brandMatch && brandMatch[1]) {
      detectedName = brandMatch[1].trim();
    } else {
      const words = cleaned.split(/\s+/).filter((w) => w.length > 2);
      detectedName = words[0] || "Custom Subscription";
    }
  }

  // 2. Extract cost
  const detectedCost = extractAmount(cleaned) || 299;

  // 3. Extract purchase date
  const purchaseDate = extractPurchaseDate(cleaned);

  // 4. Calculate next renewal date using date calculator
  const renewalCalc = calculateNextRenewalDate({
    purchaseDate,
    textSnippet: cleaned,
    cycle: "monthly",
  });

  const nextBillingDate = renewalCalc.renewalDate;
  const validityDays = renewalCalc.validityDays;

  // Determine billing cycle
  let billingCycle: BillingCycle = "monthly";
  if (validityDays >= 300) billingCycle = "yearly";
  else if (validityDays >= 80 && validityDays <= 95) billingCycle = "quarterly";
  else if (validityDays === 28 || validityDays === 29 || validityDays === 30) billingCycle = "monthly";

  // Brand Logo and color
  const iconImage = getBrandLogo(detectedName);
  const brandColor = getBrandColor(detectedName);

  // Explanation note for Calendar
  const calculationNote = `⚡ Calculated from ${validityDays} days validity: ${formatDisplayDate(purchaseDate)} + ${validityDays} days → ${formatDisplayDate(nextBillingDate)} (Visible on Calendar)`;

  return {
    name: detectedName,
    cost: detectedCost,
    planTier: detectedTier,
    startDate: purchaseDate,
    nextBillingDate,
    validityDays,
    billingCycle,
    paymentMethod: detectedPayment,
    iconImage,
    brandColor,
    sourceDetail: `Auto-parsed from receipt/message · ${validityDays} days validity`,
    evidenceSnippet: cleaned,
    calculationNote,
    tags: ["Auto-Detected", detectedName],
  };
}

/**
 * Pre-packaged sample messages for 1-click user testing
 */
export const SAMPLE_MESSAGES = {
  jio_sunnxt: "Dear Jio user your recharge of ₹549 for Jio + Sun NXT is successful on 22 Oct 2026. Pack validity 56 days. Next renewal date: 17 Dec 2026. Enjoy 1.5GB/day + Sun NXT Premium activated.",
  zee5: "Dear Customer your ZEE5 Premium subscription of ₹399 is active from 20 Oct 2026. Pack validity 92 days. Next renewal date: 20 Jan 2027. Enjoy 4K streaming & Live TV.",
  jio_hotstar: "Dear Jio user your recharge of ₹549 for Jio + Disney+ Hotstar is successful on 22 Oct 2026. Pack validity 56 days. Next renewal date: 17 Dec 2026. Enjoy 1.5GB/day + Disney+ Hotstar Mobile.",
  myjio: "Dear Jio user, your recharge of ₹349 is successful on 22 Oct 2026. Pack validity 28 days. Next renewal date: 19 Nov 2026. Enjoy 2GB/day high-speed data and unlimited 5G with Jio True 5G.",
  gemini: "Google Gemini Advanced subscription confirmed! Charged ₹607/mo on 22 Oct 2026. Pack validity 30 days. Next billing date: 21 Nov 2026. Billed to Google Play Store.",
  airtel: "Airtel Thanks: Unlimited 5G pack of ₹299 recharged successfully on 22-Oct-2026. 28 days validity. Next renewal date: 19-Nov-2026. Billed via UPI AutoPay.",
  netflix: "Dear Customer, UPI AutoPay Mandate executed for Netflix ₹649 on 03-10-2026. Standard HD monthly plan active. 30 days validity. Next renewal date: 02-Nov-2026.",
  swiggy: "Your Swiggy One membership of ₹149 is active! Valid for 90 days validity until Jan 2027.",
};

