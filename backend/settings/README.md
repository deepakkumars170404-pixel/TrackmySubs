# ⚙️ Settings Backend (Supabase)

Pure **Supabase** backend module for managing User Settings, Household Preferences, Renewal Reminders, Automatic Receipt Tracking, Connected Inboxes, and Data Privacy.

---

## 📁 Structure

```
backend/settings/
├── schema.sql              # Supabase PostgreSQL schema, RLS policies, triggers, and RPCs
├── src/
│   ├── client.ts           # Supabase client factory (with RLS support)
│   ├── types.ts            # TypeScript interfaces (UserSettings, Inboxes, Family, Preferences)
│   ├── settingsService.ts  # Pure Supabase operations (get, update, toggle, export, delete)
│   └── index.ts            # Central module export
├── package.json            # Only @supabase/supabase-js and typescript
├── tsconfig.json           # Modern TypeScript configuration ("moduleResolution": "bundler")
└── README.md
```

---

## 🗄️ 1. Apply Supabase Database Schema

1. Open your **Supabase Dashboard** > **SQL Editor**.
2. Run [`schema.sql`](schema.sql) (or `backend/supabase/migrations/20261021000000_settings_and_preferences.sql`).

This sets up:
- **`public.user_settings` table**:
  - `one_day_renewal_reminder` (boolean)
  - `email_reminders` (boolean)
  - `browser_push` (boolean)
  - `auto_tracking_active` (boolean)
  - `auto_add_high_confidence` (boolean)
  - `household_name`, `default_currency`, `monthly_budget`, `theme`, `language`, etc.
- **`public.connected_inboxes` table**: Gmail, Outlook, Yahoo mailboxes.
- **`public.family_members` table**: Household members, roles, and plan shares.
- **Row Level Security (RLS)**: Enforces `auth.uid() = user_id` for select, insert, update, and delete.
- **Auto-provision trigger**: Automatically inserts default settings whenever a new user signs up in Supabase Auth (`auth.users`).
- **RPC functions**: `export_user_household_data(uuid)` and `delete_user_household_data(uuid)`.

---

## 💻 2. Using the Supabase Settings Service

You can import and use this module directly with your existing Supabase client in Next.js Server Components, Server Actions, Route Handlers, or Client Components:

```typescript
import { createClient } from '@supabase/supabase-js';
import { 
  getUserSettings, 
  updateUserSettings, 
  toggleUserPreference, 
  exportHouseholdData 
} from '@/backend/settings';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 1. Fetch settings
const { data: settings, error } = await getUserSettings(supabase, user.id);

// 2. Toggle a preference
await toggleUserPreference(supabase, user.id, 'emailReminders');

// 3. Update multiple settings
await updateUserSettings(supabase, user.id, {
  householdName: 'Sharma Household',
  monthlyBudget: 7500,
  defaultCurrency: 'INR'
});

// 4. Export household data
const { data: exportData } = await exportHouseholdData(supabase, user.id);
```

---

## ⚡ 3. Supabase Edge Function (Optional)

If you prefer calling settings as a serverless REST endpoint, a Supabase Edge Function is included at:
`backend/supabase/functions/settings/index.ts`

Deploy it with the Supabase CLI:
```bash
supabase functions deploy settings
```
