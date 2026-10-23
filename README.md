# StockSense

StockSense is an AI-powered inventory assistant for small retail and food businesses. It gives teams a clear view of stock across branches, batch-level expiry, and auditable stock movements, then calculates explainable risks and offers grounded, read-only recommendations. The product loop is **Track → Predict → Alert → Recommend**.

## What it includes

- A branch-aware Dashboard, Inventory, Movements, Expiry, AI Insights, Reports, and Settings workspace.
- A bilingual, role-specific System Guide with a focused reading mode and task-by-task navigation for System Admins, Editors, and Viewers.
- Search, filters, exports, notifications, recently viewed pages, English and Myanmar UI, and responsive navigation.
- Atomic Stock In and Stock Out operations with positive whole-number quantities, batch validation, and immutable movement history.
- Role-based access for System Admin, Editor, and Viewer.
- Deterministic inventory risk calculations with optional AI explanations based on verified warehouse data. Ask StockSense also explains how to use the system, responds naturally to general questions, and cannot change inventory.

## Run locally

Requirements: Node.js compatible with the installed Next.js version, npm, and a configured Supabase project.

```bash
npm install
cp .env.example .env.local
```

Set the actual local values in `.env.local`, then start the app:

```bash
npm run dev
```

Required client configuration is `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or the legacy anon key supported by the Supabase client). Server-side user administration requires `SUPABASE_SERVICE_ROLE_KEY`; optional AI explanations use server-only `OPENAI_API_KEY` and `OPENAI_MODEL`. Never add a service-role or AI secret to a `NEXT_PUBLIC_*` variable. Keep `.env.local` untracked and do not share its contents.

In Supabase Auth, configure the Site URL and allowed redirect URLs for local and deployed `/auth/callback` routes. Public sign-up is disabled; a System Admin invites users.

## Database setup

Apply SQL migrations from `supabase/migrations/` in filename order using the Supabase SQL editor or your approved database workflow. Review each migration before applying it. Seed/training operations are explicit, admin-only actions and are not run automatically when the application starts. Do not reset data outside the documented, manifest-tracked seed scope.

## Quality checks

```bash
npm run typecheck
npm run lint
npm run build
git diff --check
```

These are repository checks, not a substitute for authenticated browser UAT, database/RLS verification, or a measured production performance run. Verify branch access, role boundaries, and stock transaction behavior in the configured Supabase project before relying on live data.

## Performance notes

Movement history is the only workflow intended to read longer-range raw movement records. Dashboard, Inventory, Reports, and AI Insights should use bounded raw reads and database aggregates for recent demand and trends. Tables use page-level vertical scrolling and retain only internal horizontal scrolling when their columns exceed the viewport width.
