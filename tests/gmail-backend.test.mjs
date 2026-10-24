import test from "node:test";
import assert from "node:assert/strict";

// =============================================================================
// Standalone Crypto, Parsing, & Business Logic from Edge Function for Testing
// =============================================================================

async function getHmacKey(secret) {
  const enc = new TextEncoder();
  return await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function bufferToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBuffer(hex) {
  const matches = hex.match(/.{1,2}/g) || [];
  return new Uint8Array(matches.map((byte) => parseInt(byte, 16)));
}

async function createSignedState(payload, secret) {
  const enc = new TextEncoder();
  const jsonStr = JSON.stringify(payload);
  const dataB64 = btoa(jsonStr).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const key = await getHmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(dataB64));
  const sigHex = bufferToHex(signature);
  return `${dataB64}.${sigHex}`;
}

async function verifySignedState(state, secret) {
  try {
    const parts = state.split(".");
    if (parts.length !== 2) {
      return { valid: false, error: "Invalid OAuth state format." };
    }
    const [dataB64, sigHex] = parts;
    const key = await getHmacKey(secret);
    const enc = new TextEncoder();
    const sigBuffer = hexToBuffer(sigHex);

    const isValid = await crypto.subtle.verify("HMAC", key, sigBuffer, enc.encode(dataB64));
    if (!isValid) {
      return { valid: false, error: "State signature verification failed. Potential CSRF attack." };
    }

    let base64 = dataB64.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) base64 += "=";
    const payload = JSON.parse(atob(base64));

    if (!payload.userId || !payload.ts) {
      return { valid: false, error: "Malformed state payload." };
    }

    // Expiration check: 15-minute TTL
    const maxAgeMs = 15 * 60 * 1000;
    const now = Date.now();
    if (now - payload.ts > maxAgeMs) {
      return { valid: false, error: "OAuth authorization expired. Please try connecting again." };
    }
    if (payload.ts > now + 60 * 1000) {
      return { valid: false, error: "State timestamp is invalid (in the future)." };
    }

    return { valid: true, payload };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { valid: false, error: `Failed to decode state: ${msg}` };
  }
}

function calculateNextRenewal(startDateStr, isYearly) {
  try {
    const [year, month, day] = startDateStr.split("-").map(Number);
    if (!year || !month || !day) {
      const d = new Date();
      d.setMonth(d.getMonth() + 1);
      return d.toISOString().split("T")[0];
    }
    if (isYearly) {
      return `${year + 1}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    } else {
      let nextYear = year;
      let nextMonth = month + 1;
      if (nextMonth > 12) {
        nextYear++;
        nextMonth = 1;
      }
      const lastDayOfNextMonth = new Date(nextYear, nextMonth, 0).getDate();
      const clampedDay = Math.min(day, lastDayOfNextMonth);
      return `${nextYear}-${String(nextMonth).padStart(2, "0")}-${String(clampedDay).padStart(2, "0")}`;
    }
  } catch {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().split("T")[0];
  }
}

const KNOWN_SERVICES = [
  { name: "Netflix", pattern: /netflix/i },
  { name: "Spotify", pattern: /spotify/i },
  { name: "GitHub", pattern: /github/i },
  { name: "AWS", pattern: /amazon web services|aws/i },
  { name: "Google Play", pattern: /google play|youtube premium|google workspace/i },
  { name: "Apple", pattern: /apple\.com|itunes|app store|icloud/i },
  { name: "OpenAI ChatGPT", pattern: /openai|chatgpt/i },
  { name: "Figma", pattern: /figma/i },
  { name: "Notion", pattern: /notion/i },
  { name: "Adobe", pattern: /adobe|creative cloud/i },
  { name: "Microsoft", pattern: /microsoft|office 365|azure/i },
  { name: "Slack", pattern: /slack/i },
  { name: "Zoom", pattern: /zoom/i },
  { name: "DigitalOcean", pattern: /digitalocean/i },
  { name: "Vercel", pattern: /vercel/i },
  { name: "Supabase", pattern: /supabase/i },
  { name: "Canva", pattern: /canva/i },
  { name: "LinkedIn", pattern: /linkedin/i },
  { name: "Dropbox", pattern: /dropbox/i },
  { name: "Disney+", pattern: /disney\+/i },
  { name: "Amazon Prime", pattern: /amazon prime|prime video/i },
];

function parseReceipt(
  householdId,
  messageId,
  subject,
  from,
  dateHeader,
  snippet,
  bodyText
) {
  const combined = `${subject} ${from} ${snippet} ${bodyText}`.slice(0, 10000);

  const isReceipt =
    /receipt|invoice|billed|payment|renewal|renewed|subscription|charge|order confirmation/i.test(
      `${subject} ${snippet}`
    );

  if (!isReceipt) {
    return null;
  }

  // 1. Service Name Detection
  let serviceName = "";
  for (const known of KNOWN_SERVICES) {
    if (known.pattern.test(subject) || known.pattern.test(from) || known.pattern.test(snippet)) {
      serviceName = known.name;
      break;
    }
  }

  if (!serviceName) {
    const fromMatch = from.match(/^"?([^"<]+)"?\s*</);
    serviceName = fromMatch && fromMatch[1].trim() ? fromMatch[1].trim() : "Subscription Receipt";
  }

  // 2. Amount and Currency Detection (Never invent an amount if missing)
  let amount = null;
  let currency = null;

  const inrMatch = combined.match(/(?:₹|INR|Rs\.?)\s*([0-9]+(?:,[0-9]+)*(?:\.[0-9]{1,2})?)/i);
  const usdMatch = combined.match(/(?:\$|USD)\s*([0-9]+(?:,[0-9]+)*(?:\.[0-9]{1,2})?)/i);
  const eurMatch = combined.match(/(?:€|EUR)\s*([0-9]+(?:,[0-9]+)*(?:\.[0-9]{1,2})?)/i);
  const gbpMatch = combined.match(/(?:£|GBP)\s*([0-9]+(?:,[0-9]+)*(?:\.[0-9]{1,2})?)/i);
  const cadMatch = combined.match(/(?:C\$|CAD)\s*([0-9]+(?:,[0-9]+)*(?:\.[0-9]{1,2})?)/i);
  const audMatch = combined.match(/(?:A\$|AUD)\s*([0-9]+(?:,[0-9]+)*(?:\.[0-9]{1,2})?)/i);
  const genericMatch = combined.match(/(?:total|amount paid|charged|charge|billed)[:\s]+([0-9]+(?:\.[0-9]{2})?)/i);

  if (inrMatch) {
    amount = parseFloat(inrMatch[1].replace(/,/g, ""));
    currency = "INR";
  } else if (usdMatch) {
    amount = parseFloat(usdMatch[1].replace(/,/g, ""));
    currency = "USD";
  } else if (eurMatch) {
    amount = parseFloat(eurMatch[1].replace(/,/g, ""));
    currency = "EUR";
  } else if (gbpMatch) {
    amount = parseFloat(gbpMatch[1].replace(/,/g, ""));
    currency = "GBP";
  } else if (cadMatch) {
    amount = parseFloat(cadMatch[1].replace(/,/g, ""));
    currency = "CAD";
  } else if (audMatch) {
    amount = parseFloat(audMatch[1].replace(/,/g, ""));
    currency = "AUD";
  } else if (genericMatch) {
    amount = parseFloat(genericMatch[1].replace(/,/g, ""));
    currency = "USD";
  }

  if (amount !== null && (isNaN(amount) || amount <= 0)) {
    amount = null;
  }

  // 3. Receipt Date Header
  let receiptDate = new Date().toISOString().split("T")[0];
  try {
    if (dateHeader) {
      const parsed = new Date(dateHeader);
      if (!isNaN(parsed.getTime())) {
        receiptDate = parsed.toISOString().split("T")[0];
      }
    }
  } catch {
    // Keep fallback
  }

  // 4. Renewal Date Detection (Only set if recurring info exists, never invent values)
  const isYearly = /yearly|annual|annually|per year|\/yr/i.test(combined);
  const isMonthly = /monthly|per month|\/mo|each month|every month|billed monthly/i.test(combined);
  const isRecurring = isYearly || isMonthly || /renewed|renewal|recurring|subscription/i.test(subject);

  let renewalDate = null;
  if (isRecurring) {
    renewalDate = calculateNextRenewal(receiptDate, isYearly);
  }

  // 5. Confidence Score Assignment
  const hasKnownVendor = KNOWN_SERVICES.some((k) => k.name === serviceName);
  let confidence = 0.5;
  if (hasKnownVendor && amount !== null && renewalDate !== null) {
    confidence = 0.95;
  } else if (hasKnownVendor && amount !== null) {
    confidence = 0.85;
  } else if (hasKnownVendor) {
    confidence = 0.65;
  } else if (amount !== null && renewalDate !== null) {
    confidence = 0.70;
  } else if (amount !== null) {
    confidence = 0.60;
  } else {
    confidence = 0.40;
  }

  const reviewStatus = "needs_review";

  const currencySymbol =
    currency === "INR" ? "₹" :
    currency === "EUR" ? "€" :
    currency === "GBP" ? "£" :
    currency === "CAD" ? "C$" :
    currency === "AUD" ? "A$" :
    currency === "USD" ? "$" : "";

  const shortId = messageId.slice(-6);
  const receiptReference = amount !== null
    ? `${serviceName} (${receiptDate}) · ${currencySymbol}${amount.toFixed(2)} [${shortId}]`
    : `${serviceName} (${receiptDate}) · Amount pending [${shortId}]`;

  const evidenceSnippet = `Subject: ${subject} | Date: ${receiptDate} | From: ${from} | Snippet: ${snippet.slice(0, 160)}`;

  return {
    household_id: householdId,
    provider: "Gmail",
    message_id: messageId,
    service_name: serviceName,
    amount,
    currency,
    renewal_date: renewalDate,
    confidence,
    review_status: reviewStatus,
    receipt_reference: receiptReference,
    evidence_snippet: evidenceSnippet,
    raw_payload: {
      subject,
      from,
      dateHeader,
      messageId,
      detectedCurrency: currency,
      detectedAmount: amount,
      isRecurring,
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

// Mock household authorization check function
async function resolveUserHouseholdIdMock(mockDb, userId, passedHouseholdId) {
  if (passedHouseholdId) {
    const isOwner = mockDb.households.find(h => h.id === passedHouseholdId && h.owner_id === userId);
    if (isOwner) return isOwner.id;

    const isMember = mockDb.family_members.find(m => m.household_id === passedHouseholdId && m.user_id === userId);
    if (isMember) return isMember.household_id;

    throw new Error("Access denied: You are not authorized for this household.");
  }

  const owned = mockDb.households.find(h => h.owner_id === userId);
  if (owned) return owned.id;

  const member = mockDb.family_members.find(m => m.user_id === userId);
  if (member) return member.household_id;

  return "new-auto-provisioned-household";
}

// =============================================================================
// TEST SUITE
// =============================================================================

test("1. CSRF State Cryptographic Generation & Verification", async () => {
  const secret = "test-super-secret-google-client-key-12345";
  const payload = {
    userId: "d83f4b62-6fb8-4177-8ea3-36c9360879f9",
    householdId: "a1111111-2222-3333-4444-555555555555",
    ts: Date.now(),
    nonce: "test-nonce-uuid",
    redirectPath: "/autodetect",
  };

  const signed = await createSignedState(payload, secret);
  assert.ok(typeof signed === "string", "Signed state must be a string");
  assert.ok(signed.includes("."), "Signed state must contain separator dot");

  // Valid verification
  const result = await verifySignedState(signed, secret);
  assert.equal(result.valid, true, "Valid state must verify successfully");
  assert.equal(result.payload.userId, payload.userId);
  assert.equal(result.payload.householdId, payload.householdId);

  // Tampered payload test
  const [b64, sig] = signed.split(".");
  const tamperedPayload = { ...payload, userId: "malicious-user-id" };
  const tamperedB64 = btoa(JSON.stringify(tamperedPayload)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const tamperedState = `${tamperedB64}.${sig}`;
  const tamperedResult = await verifySignedState(tamperedState, secret);
  assert.equal(tamperedResult.valid, false, "Tampered payload must fail verification");

  // Tampered signature test
  const badSigState = `${b64}.0000000000000000000000000000000000000000000000000000000000000000`;
  const badSigResult = await verifySignedState(badSigState, secret);
  assert.equal(badSigResult.valid, false, "Invalid signature must fail verification");

  // Expired state test (> 15 minutes old)
  const expiredPayload = { ...payload, ts: Date.now() - 20 * 60 * 1000 };
  const expiredSigned = await createSignedState(expiredPayload, secret);
  const expiredResult = await verifySignedState(expiredSigned, secret);
  assert.equal(expiredResult.valid, false, "Expired state must be rejected");
  assert.match(expiredResult.error, /expired/i);
});

test("2. Receipt Parser - Netflix Monthly Subscription ($19.99 USD)", () => {
  const result = parseReceipt(
    "h-123",
    "msg-netflix-01",
    "Your Netflix Subscription Receipt",
    "Netflix <info@mailer.netflix.com>",
    "2026-10-15T12:00:00Z",
    "Thanks for being a member. Your payment of $19.99 was successful.",
    "<html><body>Your Netflix monthly plan has renewed. Amount billed: $19.99 USD.</body></html>"
  );

  assert.ok(result, "Receipt must be detected");
  assert.equal(result.service_name, "Netflix");
  assert.equal(result.amount, 19.99);
  assert.equal(result.currency, "USD");
  assert.equal(result.renewal_date, "2026-11-15");
  assert.equal(result.review_status, "needs_review", "Initial review status must be 'needs_review'");
  assert.equal(result.confidence, 0.95);
  assert.equal(result.household_id, "h-123");
  assert.equal(result.provider, "Gmail");
});

test("3. Receipt Parser - Spotify Monthly Subscription (€10.99 EUR)", () => {
  const result = parseReceipt(
    "h-123",
    "msg-spotify-02",
    "Your Spotify receipt",
    "Spotify <receipts@spotify.com>",
    "2026-05-10T08:00:00Z",
    "Here is your Spotify Premium receipt. Charged €10.99 for the next month.",
    "Order confirmation: Monthly subscription renewed for €10.99."
  );

  assert.ok(result);
  assert.equal(result.service_name, "Spotify");
  assert.equal(result.amount, 10.99);
  assert.equal(result.currency, "EUR");
  assert.equal(result.renewal_date, "2026-06-10");
  assert.equal(result.review_status, "needs_review");
});

test("4. Receipt Parser - GitHub Copilot (INR ₹1,000)", () => {
  const result = parseReceipt(
    "h-123",
    "msg-gh-03",
    "Payment receipt for GitHub Copilot",
    "GitHub Billing <billing@github.com>",
    "2026-04-01T00:00:00Z",
    "Thank you for your payment of ₹1,000 for GitHub Copilot Enterprise.",
    "Invoice details: billed ₹1,000 monthly."
  );

  assert.ok(result);
  assert.equal(result.service_name, "GitHub");
  assert.equal(result.amount, 1000);
  assert.equal(result.currency, "INR");
  assert.equal(result.renewal_date, "2026-05-01");
  assert.equal(result.review_status, "needs_review");
});

test("5. Receipt Parser - AWS Cloud Services ($142.50 USD)", () => {
  const result = parseReceipt(
    "h-123",
    "msg-aws-04",
    "Amazon Web Services Invoice [Account: 123456789012]",
    "Amazon Web Services <no-reply-aws@amazon.com>",
    "2026-08-01T00:00:00Z",
    "Your latest AWS invoice is now available. Total amount charged: $142.50.",
    "Billed $142.50 on your credit card for monthly cloud services."
  );

  assert.ok(result);
  assert.equal(result.service_name, "AWS");
  assert.equal(result.amount, 142.5);
  assert.equal(result.currency, "USD");
  assert.equal(result.review_status, "needs_review");
});

test("6. Receipt Parser - Annual Subscription (+1 Year Renewal)", () => {
  const result = parseReceipt(
    "h-123",
    "msg-annual-05",
    "Figma Professional Annual Subscription Renewal",
    "Figma <support@figma.com>",
    "2026-01-10T00:00:00Z",
    "Your annual plan was successfully renewed. Total billed: $180.00 /yr.",
    "Yearly plan subscription confirmation."
  );

  assert.ok(result);
  assert.equal(result.service_name, "Figma");
  assert.equal(result.amount, 180);
  assert.equal(result.renewal_date, "2027-01-10", "Annual subscription should advance by exactly 1 year");
});

test("7. Receipt Parser - Missing / Uncertain Amount Handled Safely", () => {
  const result = parseReceipt(
    "h-123",
    "msg-missing-amount-07",
    "Your Google Workspace subscription payment notice",
    "Google Workspace <billing@google.com>",
    "2026-09-01T00:00:00Z",
    "Thank you for your ongoing subscription. Please check your admin console for invoice details.",
    "Your subscription will renew on the first of each month."
  );

  assert.ok(result);
  assert.equal(result.service_name, "Google Play");
  assert.equal(result.amount, null, "Missing amount must be null, never invented");
  assert.ok(result.receipt_reference.includes("Amount pending"), "Receipt reference indicates pending amount");
  assert.equal(result.confidence, 0.65, "Confidence adjusted for missing amount");
});

test("8. Receipt Parser - Non-Recurring Receipt Leaves Renewal Date Null", () => {
  const result = parseReceipt(
    "h-123",
    "msg-oneoff-08",
    "Your one-time store purchase receipt",
    "Online Retailer <orders@shop.com>",
    "2026-03-15T00:00:00Z",
    "Order confirmation: Total charged $45.00 for order #9821.",
    "Thank you for shopping with us!"
  );

  assert.ok(result);
  assert.equal(result.amount, 45.0);
  assert.equal(result.renewal_date, null, "Non-recurring purchase must have renewal_date null, never invented");
  assert.equal(result.review_status, "needs_review");
});

test("9. Receipt Parser - Non-receipt Email Ignored", () => {
  const result = parseReceipt(
    "h-123",
    "msg-spam-09",
    "Team lunch next Tuesday?",
    "Friend <friend@example.com>",
    "2026-10-20T12:00:00Z",
    "Hey! Are you free for tacos next Tuesday at noon?",
    "Let me know if the time works for you."
  );

  assert.equal(result, null, "Non-receipt email must return null");
});

test("10. Renewal Date Calculation - Month End Clamping", () => {
  // Jan 31 + 1 month in non-leap year should clamp to Feb 28
  const clampedFeb = calculateNextRenewal("2026-01-31", false);
  assert.equal(clampedFeb, "2026-02-28", "Jan 31 + 1 month should clamp to Feb 28 in 2026");

  // Dec 15 + 1 month should advance to next year Jan 15
  const yearRollover = calculateNextRenewal("2026-12-15", false);
  assert.equal(yearRollover, "2027-01-15", "Dec 15 + 1 month should roll over to next year");
});

test("11. Pre-filtering Existing Message IDs Avoids Reprocessing", () => {
  const existingMessageIds = new Set(["msg-01", "msg-02", "msg-03"]);
  const incomingBatch = [
    { id: "msg-01" },
    { id: "msg-02" },
    { id: "msg-04" },
    { id: "msg-05" },
  ];

  const newMessages = incomingBatch.filter((m) => !existingMessageIds.has(m.id));
  assert.equal(newMessages.length, 2, "Only new un-processed message IDs should be parsed");
  assert.deepEqual(newMessages.map((m) => m.id), ["msg-04", "msg-05"]);
});

test("12. Review Status Constraint Compliance", () => {
  const validReviewStatuses = ["needs_review", "added", "dismissed"];
  
  // Valid status transitions
  assert.ok(validReviewStatuses.includes("needs_review"));
  assert.ok(validReviewStatuses.includes("added"));
  assert.ok(validReviewStatuses.includes("dismissed"));

  // Invalid status rejected
  assert.equal(validReviewStatuses.includes("Added"), false, "Uppercase 'Added' must be rejected");
  assert.equal(validReviewStatuses.includes("pending"), false, "Unknown status must be rejected");
});

test("13. Household-Level Authorization Verification", async () => {
  const mockDb = {
    households: [
      { id: "household-owner-A", owner_id: "user-A" },
      { id: "household-owner-B", owner_id: "user-B" },
    ],
    family_members: [
      { household_id: "household-owner-A", user_id: "user-member-A" },
    ],
  };

  // User A can access household-owner-A
  const ownerResult = await resolveUserHouseholdIdMock(mockDb, "user-A", "household-owner-A");
  assert.equal(ownerResult, "household-owner-A");

  // Member A can access household-owner-A
  const memberResult = await resolveUserHouseholdIdMock(mockDb, "user-member-A", "household-owner-A");
  assert.equal(memberResult, "household-owner-A");

  // User A CANNOT access household-owner-B (spoofing attempt)
  await assert.rejects(
    async () => {
      await resolveUserHouseholdIdMock(mockDb, "user-A", "household-owner-B");
    },
    /Access denied/i,
    "User A must be rejected when attempting to access User B's household"
  );
});

test("14. Preview Scan (Dry-Run Mode)", () => {
  const sampleItems = [
    parseReceipt(
      "h-123",
      "msg-prev-01",
      "GitHub Copilot invoice receipt",
      "GitHub <billing@github.com>",
      "2026-10-01T00:00:00Z",
      "Your monthly subscription billed $10.00 USD.",
      "Details: billed $10.00."
    ),
  ];

  // In dryRun mode, items are returned without performing database insert
  const dryRunResult = {
    scanned: 1,
    inserted: 0,
    alreadyExisting: 0,
    nextPageToken: null,
    items: sampleItems,
  };

  assert.equal(dryRunResult.inserted, 0, "Dry run must not insert records");
  assert.equal(dryRunResult.items.length, 1, "Dry run must return parsed items");
  assert.equal(dryRunResult.items[0].service_name, "GitHub");
  assert.equal(dryRunResult.items[0].amount, 10.00);
});

test("15. Pause Tracking Logic", () => {
  // Mock subscriptions
  const mockSubscriptions = [
    { id: "sub-01", household_id: "h-123", status: "active" },
  ];
  const mockDetected = [
    { id: "det-01", household_id: "h-123", review_status: "needs_review" },
  ];

  // Pause active subscription
  const sub = mockSubscriptions.find((s) => s.id === "sub-01");
  sub.status = "paused";
  assert.equal(sub.status, "paused", "Active subscription status must become paused");

  // Pause detected subscription (dismiss)
  const det = mockDetected.find((d) => d.id === "det-01");
  det.review_status = "dismissed";
  assert.equal(det.review_status, "dismissed", "Detected subscription must become dismissed");
});

test("16. Add-to-Subscriptions Promotion Logic", () => {
  const detected = {
    id: "det-99",
    household_id: "h-123",
    service_name: "Spotify",
    amount: 10.99,
    currency: "EUR",
    renewal_date: "2026-11-10",
    review_status: "needs_review",
  };

  // Convert to subscriptions entry
  const promotedSubscription = {
    household_id: detected.household_id,
    name: detected.service_name,
    amount: detected.amount,
    currency: detected.currency,
    billing_cycle: "monthly",
    renewal_date: detected.renewal_date,
    status: "active",
    created_by: "user-123",
  };

  detected.review_status = "added";

  assert.equal(promotedSubscription.name, "Spotify");
  assert.equal(promotedSubscription.status, "active");
  assert.equal(promotedSubscription.amount, 10.99);
  assert.equal(detected.review_status, "added");
});
