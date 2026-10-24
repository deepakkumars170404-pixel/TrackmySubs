import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function syncJioHotstar() {
  const subData = {
    id: "sub-jio-hotstar-56d",
    user_id: "deepakkumars170404@gmail.com",
    name: "Jio + Disney+ Hotstar",
    plan_tier: "Standard 1.5GB/Day · 56 Days ",
    cost: 549,
    monthly_cost: Math.round(549 / 2),
    currency: "INR",
    billing_cycle: "custom",
    status: "active",
    start_date: "2026-10-22",
    next_billing_date: "2026-12-17",
    auto_renew: true,
    who_uses_it: "Deepak ",
    payment_method: "UPI AutoPay (user@upi)",
    autopay_state: "on",
    source: "receipt",
    source_detail: "Jio recharge receipt · 56 days validity ",
    notify_before_days: 2,
    tags: ["Jio", "Hotstar", "56 Days", ""],
    brand_letter: "J",
    brand_color: "#005AA9",
    service_url: "https://jio.com",
  };

  console.log("Upserting Jio + Disney+ Hotstar into Supabase public.subscriptions...");
  const { data, error } = await supabase
    .from("subscriptions")
    .upsert([subData], { onConflict: "id" })
    .select();

  if (error) {
    console.error("Supabase upsert error:", error);
  } else {
    console.log("Supabase upsert success!", data);
  }
}

syncJioHotstar().catch(console.error);
