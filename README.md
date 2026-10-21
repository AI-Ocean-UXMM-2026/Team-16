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

Apply all SQL files in `supabase/migrations/` in filename order. The latest forward migration adds the Yangon network loader, constrains movement creation to whole-unit quantities, and disables superseded seed entry points. Seed data is not created automatically. After the migration is applied, a System Admin can run “Reset & load Yangon inventory” from Settings → Configuration.

The reset transaction removes only warehouse IDs recorded in the private seed manifest and verifies the expected legacy network before replacement. Untracked warehouses, catalogs, and stock history are preserved. The loader creates 9 branches, 360 products, 25,200 batches, and 51,480 movement records for 2021 through the current month (counts vary with the current month). Quantities are integers; expired batches remain in history while current stock is reconciled.

## Quality checks

```bash
npm run typecheck
npm run lint
npm run build
git diff --check
```

These checks do not replace authenticated browser UAT or a production speed measurement. Verify database migrations and role/branch isolation in the configured Supabase project before relying on the training network.
