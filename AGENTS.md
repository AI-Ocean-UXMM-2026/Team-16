# OceanBlue engineering guide

## Product

OceanBlue is a light-first inventory decision workspace for small retail and food operators. Its loop is **Track → Predict → Alert → Recommend**. Focus on inventory, batches and expiry, auditable stock movements, explainable risk, reports, and warehouse operations. Do not add ERP, accounting, supplier, delivery, or advanced forecasting features without an explicit request.

## Architecture and code

- Next.js App Router, React, strict TypeScript, Tailwind CSS, Lucide, Supabase Auth/PostgreSQL.
- Supabase is the source of truth. Keep service-role credentials server-only. Route handlers validate inputs, authenticate, and enforce roles; warehouse data is protected by RLS.
- Stock mutations use the atomic `record_stock_movement` RPC. Never set product quantity directly.
- Keep domain/data logic in `src/lib` or server route handlers, reusable presentation in `src/components`, and use existing dependencies and patterns.
- Prefer the smallest complete change. Do not add packages or services without a concrete need.

## Workspace and roles

Authenticated destinations are Dashboard, Inventory, Movements, Expiry, AI Insights, Reports, and Settings. Preserve global live search (Ctrl/Cmd+K), Recently Viewed, responsive/collapsible sidebar, language, notification count, branch picker, avatar menu, Settings, and floating Ask OceanBlue.

- System Admin: all active branches and workspace configuration.
- Editor: products and stock movements in assigned branches.
- Viewer: read-only access in assigned branches.

Accounts are provisioned by System Admin invitation only. Users can update their own name, username, and password. Never add public sign-up.

## Inventory integrity and access

- Available stock is derived from product batches; expiry is tracked per batch.
- Stock In and Stock Out quantities must be positive whole numbers in the UI, API, and atomic RPC.
- Validate product/branch and batch ownership, sufficient Stock Out quantity, and inbound batch/expiry information.
- Every stock change is an immutable movement recorded transactionally. Branch removal archives data.
- Product categories come from the persisted category catalog. Category removal is blocked while products use it.
- Enforce branch-scoped RLS. System Admin access is global and must work for all active branches; client-side role visibility is not authorization.

## Yangon training network

The admin-triggered training network contains one main warehouse and eight convenience stores in Yangon, 40 retail-relevant products per branch, integer quantities, batch expiry, and monthly history beginning January 2021. It is stored in Supabase and remains editable through normal workflows.

Reset only rows linked to the private seed manifest. Reset functions must be admin-only, transactional, and reject any unrecognized manifest or untracked target branch. Never delete or rewrite non-seed branches, catalogs, or their stock history. Do not auto-seed on application startup. Keep training data clearly separate from production catalogs in admin-only configuration UI.

## Risk, AI, and interface

- Calculate stock risk deterministically from current batches, expiry, and recent Stock Out history before asking an LLM to explain it. Insufficient history stays unknown.
- Ask OceanBlue is read-only, grounded in verified branch facts, and cannot mutate stock. Suggested prompts are questions, not claims, and must not imply unsupported data.
- Keep the light, minimal, responsive interface consistent with `assets/OceanBlue_Design_Guide.md`. Use clear hierarchy, thin icon/text weights, compact searchable selects, and visible keyboard focus.
- Every visible control must work. Tables scroll internally on both axes, with searchable row-count controls and pagination fixed outside the scrolling table body.
- Include loading, empty, error, success, and validation states. Do not invent chart values or static data presented as live.

## Performance and verification

- Avoid fetching multi-year history outside movement-history/report workflows that need it. Bound large reads and avoid duplicate data requests.
- Before delivery run `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check`.
- Add or run focused tests for validation and domain logic where possible. Do not start a local web server unless requested. Clearly distinguish automated checks from live Supabase/Vercel or browser UAT.

## Secrets, migrations, and delivery

- Apply migrations in filename order. Never print, hardcode, or commit credentials, `.env.local`, service-role keys, or build output. `.env.example` uses placeholders only.
- Keep legacy migrations for database history; new behavior belongs in forward migrations. Revoke obsolete unsafe seed entry points when replacing them.
- Stage only files belonging to the task. Preserve unrelated user changes. Push completed work when the user has requested continuous GitHub/Vercel deployment.
