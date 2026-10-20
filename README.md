# OceanBlue

OceanBlue is an AI-assisted inventory decision tool for SME food warehouses. It tracks products, batches, expiry dates, and auditable stock movements; calculates transparent stock risks; and offers read-only recommendations grounded in current warehouse data.

## Features

- Dashboard with stock KPIs, urgent risks, movement history, and date-range controls.
- Searchable inventory with product details, batch expiry, product creation/editing, and configurable product categories.
- Atomic Stock In / Stock Out transactions with audit history.
- Deterministic stockout and expiry risk estimates, plus AI Insights.
- Floating Ask OceanBlue assistant across the authenticated workspace. The assistant cannot change stock.
- English and Myanmar language selection.
- System Admin, Editor, and Viewer roles; administrator-managed invitations; per-user profile and password settings.
- System Admin configuration for product categories and branches. Branch removal archives data instead of deleting it.
- Per-user recently viewed pages and workspace notifications.

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Fill `.env.local` with the app's Supabase Project URL and publishable key, plus server-only `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, and `OPENAI_MODEL` values as applicable. The service-role key and OpenAI key must never be prefixed with `NEXT_PUBLIC_` or exposed to browser code. Keep `.env.local` untracked and do not paste secrets into source files.

Username sign-in and System Admin user/branch management require the service-role key in the server environment. Email sign-in uses Supabase Auth. Configure Supabase Auth's Site URL and Redirect URLs to include the local and deployed `/auth/callback` destinations so invitation links can establish a session.

## Supabase setup

Create or select a Supabase project, then apply every migration in `supabase/migrations/` in filename order (or link the project and run `supabase db push`). The migrations create the inventory schema, BreadTalk demo loader, account roles, username-only lookup support, admin provisioning, categories, and archived branches. Do not apply an older migration after a newer one.

Enable email invitations in Supabase Auth and configure a working email provider/SMTP for production. Public account creation is intentionally disabled by the database provisioning trigger; System Admins invite users through Settings → User access.

All product data is scoped to a selected branch. The System Admin Configuration tab manages shared category options and branches. Removing a branch archives it and retains its inventory and movement history.

## Checks

```bash
npm run typecheck
npm run lint
npm run build
```
