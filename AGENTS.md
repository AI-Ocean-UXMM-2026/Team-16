# OceanBlue — engineering guide

## Product scope

OceanBlue is a lightweight inventory decision tool for SME food warehouses. The operating loop is **Track → Predict → Alert → Recommend**. The core workflow is Dashboard → Inventory → Stock Movements → AI Insights. Keep work focused on inventory, batch expiry, stock movements, explainable risk, and warehouse operations; do not add ERP, accounting, supplier, delivery, or advanced forecasting features without explicit direction.

## Application architecture

- Next.js App Router, React, strict TypeScript, Tailwind CSS, and Lucide icons.
- Supabase Auth and PostgreSQL are the source of truth. Browser code uses the publishable key and authenticated session only. The service-role key is server-only.
- Server Components read scoped warehouse data; route handlers validate inputs, authenticate the caller, and enforce role requirements. Stock changes use the atomic `record_stock_movement` RPC.
- Keep domain calculations and database access in `src/lib`; keep reusable presentation in `src/components`. Avoid duplicate UI primitives and unused code.
- Use existing package versions and component patterns. Do not add a service, package, or abstraction unless it solves a demonstrated need.

## Workspace and roles

Authenticated routes: `/dashboard`, `/inventory`, `/movements`, `/expiry`, `/insights`, `/reports`, and `/settings`. Preserve the shared shell: global live search (`Ctrl/Cmd+K`), Recently Viewed, collapsible responsive sidebar, language picker, notifications, branch picker, avatar menu, settings, and floating Ask OceanBlue assistant.

- **System Admin** — full access to every active branch; manage users, categories, and branches.
- **Editor** — create/edit/archive products and record movements in assigned branches.
- **Viewer** — read-only access in assigned branches.

Accounts are provisioned by System Admin invitation only. Profiles include a display name and unique username; login accepts username or email. Never add public sign-up.

## Data integrity and access

- Product availability is derived from batches. Expiry belongs to batches.
- All stock changes are auditable movements. Never set product quantity directly.
- Validate positive quantity, product/warehouse ownership, batch ownership, available Stock Out quantity, and expiry for new inbound food batches.
- Enforce warehouse-specific RLS. System Admin access is global but must also work when changing the active branch; UI visibility is not authorization.
- Branch removal is archival. Never delete production inventory or movement history as part of a demo reset.
- BreadTalk training records live in clearly labeled Supabase demo branches. They are real, editable database records for testing, not production catalog data. Seed only empty/new demo branches. A reset may target only the three exact manifest-backed BreadTalk Demo branches and must leave all other branches/catalogs untouched.

## Risk and AI rules

- Calculate stock risk deterministically from batch quantities, expiry, and recent Stock Out history before involving an LLM.
- Centralize thresholds in the risk domain module. When usage history is insufficient, show unknown rather than fabricated days-of-supply.
- Ask OceanBlue is read-only. Ground answers in current branch data, explain evidence and uncertainty, and never invent inventory values or execute stock changes.

## UI and accessibility

- Keep the workspace light, minimal, responsive, and consistent with the inventory-manager reference UI. Reuse shared KPI, panel, table, field, status, and modal patterns.
- Tables must scroll internally on both axes, keep their controls/footer/pagination in place, and support useful empty/error states. Searchable selects are the default for catalog/filter selectors.
- Use semantic controls, associated labels, keyboard focus states, text as well as color for risk, and loading/success/error/validation states.
- Preserve the OceanBlue shared header controls and floating assistant when changing page layouts.

## Performance

- Avoid loading multi-year stock history on routes that need only current risk and recent activity. Fetch full history only on the movement history screen, with bounded/paginated database reads.
- Reuse request-scoped server context and avoid duplicate queries. Debounce live search, cancel stale requests, and do not compute dashboard indicators from static fixtures in production.
- Keep charts/KPIs derived from the selected branch's Supabase data. Do not introduce large client dependencies for simple tables or charts.

## Secrets and migrations

- Never print, hardcode, or commit credentials, `.env.local`, service-role keys, or generated build output. `.env.example` contains placeholders only.
- Apply migrations in filename order. Any data-reset migration/function must be narrowly scoped, manifest-checked, admin-only, transactional, and must preserve non-demo data.
- RLS is mandatory for warehouse records. Never trust client-side role checks as the sole authorization layer.

## Verification and delivery

- Run `npm run typecheck`, `npm run lint`, `git diff --check`, and `npm run build` for material changes.
- Manually exercise touched flows when the authenticated app is available; report anything that could not be verified live.
- Do not start a localhost server unless explicitly requested. Push completed changes to the configured GitHub remote when the user has requested continuous Vercel deployment.
