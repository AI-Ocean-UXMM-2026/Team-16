# OceanBlue

OceanBlue is an AI-assisted inventory workspace for small retail and food operators. It tracks products, batches, expiry dates, and auditable stock movements; calculates explainable stock risks; and provides read-only AI assistance based on verified warehouse data.

## Product capabilities

- Dashboard, searchable inventory, batch expiry, stock movements, reports, and AI insights.
- Atomic Stock In / Stock Out with positive whole-number quantities and auditable movement history.
- Admin-managed categories and branches; System Admin, Editor, and Viewer roles.
- Floating Ask OceanBlue assistant with fresh suggested questions, verified-data answers, and no stock mutation capability.
- Responsive light-first UI, internal table scrolling, searchable filters and page-size selectors, English and Myanmar language support.
- Optional Yangon practice dataset: one main warehouse and eight convenience stores, 40 products per branch, integer stock, monthly history from January 2021 to the current month.

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Configure Supabase URL and publishable/anon key. Server-side user provisioning requires `SUPABASE_SERVICE_ROLE_KEY`; AI explanations and generated prompt suggestions use server-only `OPENAI_API_KEY` and `OPENAI_MODEL`. Never use the service-role or OpenAI secret with a `NEXT_PUBLIC_` prefix. Keep `.env.local` private and untracked.

Set the Supabase Auth Site URL and Redirect URLs for local and production `/auth/callback` routes. Public sign-up is disabled; a System Admin provisions accounts by invitation.

## Database

Apply all SQL files in `supabase/migrations/` in filename order. Migration `202610221001_yangon_seed_timeout_fix.sql` installs the resumable reset functions; `202610222200_yangon_daily_retail_scale.sql` adds the larger daily retail dataset, chunk progress, and aggregated risk/report queries. Seed data is not created automatically. After applying both migrations in order, a System Admin can run “Reset & load Yangon inventory” from Settings → Configuration. If an attempt times out, run the action again to resume the tracked network.

The reset removes only warehouse IDs recorded in the private seed manifest and verifies the expected legacy network before replacement. Each 40-product chunk commits independently, so an interrupted request can resume without restarting completed work. Untracked warehouses, catalogs, and stock history are preserved. The loader creates 9 branches and 200 product variants per branch. At the client date of October 22, 2026, it generates 1,800 products, 126,000 monthly batches, and about 289,800 stock movements: monthly reconciled history from January 2021 through September 2026, plus daily sales in October through today. Counts vary with the current date. This yields about 1,800 daily sale movements across the network during the current month. Quantities are integers; expired batches remain in history while current stock is reconciled.

## Quality checks

```bash
npm run typecheck
npm run lint
npm run build
git diff --check
```

These checks do not replace authenticated browser UAT or a production speed measurement. Verify database migrations and role/branch isolation in the configured Supabase project before relying on the training network. The Dashboard, Inventory, Reports, and AI Insights paths use bounded raw movement reads plus SQL summaries for recent demand and daily trends; full movement history is loaded only on the Movements page. Static Ask OceanBlue prompt rotation does not make an API call.
