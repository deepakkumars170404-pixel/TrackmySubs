export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'paused';
export type BillingCycle = 'monthly' | 'quarterly' | 'yearly' | 'weekly' | 'custom';
export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'refunded';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  company_name: string | null;
  currency: string;
  monthly_budget: number;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  color: string;
  icon: string;
  created_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  name: string;
  service_url?: string | null;
  category_id?: string | null;
  category?: Category | null;
  description?: string | null;
  cost: number;
  currency: string;
  billing_cycle: BillingCycle;
  status: SubscriptionStatus;
  start_date: string;
  next_billing_date: string;
  auto_renew: boolean;
  cancellation_date?: string | null;
  payment_method?: string | null;
  notify_before_days: number;
  tags?: string[];
  // TrackmySubs extensions:
  plan_tier?: string;
  who_uses_it?: string; // e.g., 'Everyone', 'Alex + family', 'Alex', 'Priya', 'Aarav'
  monthly_cost?: number; // Normalized monthly equivalent (e.g. ₹125/mo for annual)
  autopay_state?: 'on' | 'review' | 'off';
  source?: 'receipt' | 'estimate' | 'manual' | 'needs_review';
  source_detail?: string; // e.g. "Netflix receipt · ₹649"
  brand_color?: string; // Hex for avatar pill
  brand_letter?: string; // Single letter monogram
  icon_image?: string; // Direct image URL for service logo
  banner_image?: string; // High-res visual for cards
  // Receipt & Billing extensions:
  receipt_id?: string;
  purchase_date?: string;
  validity_days?: number;
  evidence_snippet?: string;
  created_at: string;
  updated_at: string;
}

export interface PaymentHistory {
  id: string;
  subscription_id: string;
  subscription?: { name: string };
  user_id: string;
  amount: number;
  currency: string;
  billing_date: string;
  status: PaymentStatus;
  invoice_number?: string | null;
  receipt_url?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface SubscriptionAlert {
  id: string;
  subscription_id: string;
  subscription?: { name: string };
  user_id: string;
  alert_date: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export type EventCategoryType = 'need' | 'bill' | 'subscription' | 'event' | 'reminder';

export interface CustomCalendarEvent {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  category: EventCategoryType;
  cost?: number;
  priority?: 'normal' | 'high' | 'urgent';
  note?: string;
  assigned_to?: string;
  created_at: string;
}
