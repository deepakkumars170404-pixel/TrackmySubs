import { createUserClient } from "../config/supabase.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BILLING_CYCLES = new Set(["weekly", "monthly", "quarterly", "yearly"]);
const SUBSCRIPTION_FIELDS = new Set([
  "name",
  "plan",
  "assigned_to",
  "cost",
  "currency",
  "billing_cycle",
  "next_renewal",
  "auto_renew",
  "status",
  "source"
]);

function isValidDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function validSubscription(input, { partial = false } = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  const keys = Object.keys(input);
  if (!keys.length || keys.some((key) => !SUBSCRIPTION_FIELDS.has(key))) return false;
  if (!partial || "name" in input) {
    if (typeof input.name !== "string" || input.name.trim().length < 1 || input.name.trim().length > 120) return false;
  }
  if ("plan" in input && (typeof input.plan !== "string" || input.plan.length > 120)) return false;
  if ("assigned_to" in input && (typeof input.assigned_to !== "string" || input.assigned_to.length > 120)) return false;
  if ("cost" in input && (typeof input.cost !== "number" || !Number.isFinite(input.cost) || input.cost < 0)) return false;
  if ("currency" in input && (typeof input.currency !== "string" || !/^[A-Z]{3}$/.test(input.currency))) return false;
  if ("billing_cycle" in input && !BILLING_CYCLES.has(input.billing_cycle)) return false;
  if ("next_renewal" in input && !isValidDate(input.next_renewal)) return false;
  if ("auto_renew" in input && typeof input.auto_renew !== "boolean") return false;
  if ("status" in input && !["active", "needs_review"].includes(input.status)) return false;
  if ("source" in input && !["manual", "receipt"].includes(input.source)) return false;
  return partial || (
    typeof input.cost === "number" &&
    BILLING_CYCLES.has(input.billing_cycle) &&
    isValidDate(input.next_renewal)
  );
}

function userClient(req) {
  return createUserClient(req.accessToken);
}

function invalidId(value) {
  return typeof value !== "string" || !UUID_PATTERN.test(value);
}

function sendDatabaseError(res, operation, error) {
  console.error(`${operation} failed:`, error.message);
  const clientErrorCodes = new Set(["P0001", "23503", "23505", "23514", "22P02"]);
  const status = error.code === "42501" ? 403 : clientErrorCodes.has(error.code) ? 400 : 502;
  return res.status(status).json({ success: false, message: `Could not ${operation.toLowerCase()}.` });
}

export async function createHousehold(req, res) {
  const { name, displayName } = req.body || {};
  if (typeof name !== "string" || typeof displayName !== "string" ||
      name.trim().length < 1 || name.trim().length > 80 ||
      displayName.trim().length < 1 || displayName.trim().length > 80) {
    return res.status(400).json({ success: false, message: "Household name and display name must be 1–80 characters." });
  }

  const { data, error } = await userClient(req).rpc("create_household", {
    p_name: name.trim(),
    p_display_name: displayName.trim()
  });
  if (error) return sendDatabaseError(res, "Create household", error);
  return res.status(201).json({ success: true, householdId: data });
}

export async function joinHousehold(req, res) {
  const { inviteCode, displayName } = req.body || {};
  if (invalidId(inviteCode) || typeof displayName !== "string" ||
      displayName.trim().length < 1 || displayName.trim().length > 80) {
    return res.status(400).json({ success: false, message: "Provide a valid invite code and display name." });
  }
  const { data, error } = await userClient(req).rpc("join_household", {
    p_invite_code: inviteCode,
    p_display_name: displayName.trim()
  });
  if (error) return sendDatabaseError(res, "Join household", error);
  return res.json({ success: true, householdId: data });
}

export async function getMyHousehold(req, res) {
  const supabase = userClient(req);
  const { data: membership, error: membershipError } = await supabase
    .from("household_members")
    .select("household_id, display_name, role, joined_at")
    .eq("user_id", req.user.id)
    .maybeSingle();
  if (membershipError) return sendDatabaseError(res, "Load household membership", membershipError);
  if (!membership) return res.json({ success: true, household: null, members: [] });

  const [{ data: household, error: householdError }, { data: members, error: membersError }] = await Promise.all([
    supabase.from("households").select("id, name, invite_code, created_at").eq("id", membership.household_id).single(),
    supabase.from("household_members").select("user_id, display_name, role, joined_at").eq("household_id", membership.household_id)
  ]);
  if (householdError) return sendDatabaseError(res, "Load household", householdError);
  if (membersError) return sendDatabaseError(res, "Load household members", membersError);
  return res.json({ success: true, household, members });
}

export async function getSubscriptions(req, res) {
  const { householdId } = req.params;
  if (invalidId(householdId)) return res.status(400).json({ success: false, message: "Invalid household ID." });
  const { data, error } = await userClient(req)
    .from("subscriptions")
    .select("id, household_id, name, plan, assigned_to, cost, currency, billing_cycle, next_renewal, auto_renew, status, source, created_at, updated_at")
    .eq("household_id", householdId)
    .order("next_renewal", { ascending: true });
  if (error) return sendDatabaseError(res, "Load subscriptions", error);
  return res.json({ success: true, subscriptions: data });
}

export async function getRenewals(req, res) {
  const { householdId } = req.params;
  const days = req.query.days === undefined ? 30 : Number(req.query.days);
  if (invalidId(householdId)) return res.status(400).json({ success: false, message: "Invalid household ID." });
  if (!Number.isInteger(days) || days < 1 || days > 365) {
    return res.status(400).json({ success: false, message: "days must be an integer between 1 and 365." });
  }

  const today = new Date();
  const end = new Date(today);
  end.setUTCDate(end.getUTCDate() + days);
  const { data, error } = await userClient(req)
    .from("subscriptions")
    .select("id, household_id, name, plan, assigned_to, cost, currency, billing_cycle, next_renewal, auto_renew, status")
    .eq("household_id", householdId)
    .eq("status", "active")
    .gte("next_renewal", today.toISOString().slice(0, 10))
    .lte("next_renewal", end.toISOString().slice(0, 10))
    .order("next_renewal", { ascending: true });
  if (error) return sendDatabaseError(res, "Load upcoming renewals", error);
  return res.json({ success: true, renewals: data, days });
}

export async function addSubscription(req, res) {
  const { householdId } = req.params;
  if (invalidId(householdId)) return res.status(400).json({ success: false, message: "Invalid household ID." });
  if (!validSubscription(req.body)) {
    return res.status(400).json({
      success: false,
      message: "Provide valid subscription fields: name, cost, billing_cycle, and next_renewal are required."
    });
  }
  const { data, error } = await userClient(req)
    .from("subscriptions")
    .insert({ ...req.body, household_id: householdId, created_by: req.user.id })
    .select()
    .single();
  if (error) return sendDatabaseError(res, "Add subscription", error);
  return res.status(201).json({ success: true, subscription: data });
}

export async function updateSubscription(req, res) {
  const { subscriptionId } = req.params;
  if (invalidId(subscriptionId)) return res.status(400).json({ success: false, message: "Invalid subscription ID." });
  if (!validSubscription(req.body, { partial: true })) {
    return res.status(400).json({ success: false, message: "Provide at least one valid subscription field to update." });
  }
  const { data, error } = await userClient(req)
    .from("subscriptions")
    .update({ ...req.body, updated_at: new Date().toISOString() })
    .eq("id", subscriptionId)
    .select()
    .maybeSingle();
  if (error) return sendDatabaseError(res, "Update subscription", error);
  if (!data) return res.status(404).json({ success: false, message: "Subscription was not found or is not accessible." });
  return res.json({ success: true, subscription: data });
}

export async function deleteSubscription(req, res) {
  const { subscriptionId } = req.params;
  if (invalidId(subscriptionId)) return res.status(400).json({ success: false, message: "Invalid subscription ID." });
  const { data, error } = await userClient(req)
    .from("subscriptions")
    .delete()
    .eq("id", subscriptionId)
    .select("id")
    .maybeSingle();
  if (error) return sendDatabaseError(res, "Delete subscription", error);
  if (!data) return res.status(404).json({ success: false, message: "Subscription was not found or is not accessible." });
  return res.json({ success: true, deletedId: data.id });
}
