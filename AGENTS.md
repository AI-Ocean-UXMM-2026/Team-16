# StockSense engineering guide

## Product

StockSense is an AI-powered inventory assistant for small retail and food operators. It helps teams track branch-level products, batch quantities, expiry dates, and auditable stock movements; detect stock and expiry risks from verified data; and turn those signals into understandable alerts, reports, and recommendations. Its operating loop is **Track → Predict → Alert → Recommend**.

Keep the product focused on inventory decisions and warehouse operations. Do not add ERP, accounting, supplier, delivery, or advanced forecasting features without an explicit request.

## Architecture and implementation

- Next.js App Router, React, strict TypeScript, Tailwind CSS, Lucide, and Supabase Auth/PostgreSQL.
- Supabase is the source of truth. Keep service-role credentials server-only. Route handlers validate inputs, authenticate callers, enforce roles, and rely on warehouse-scoped RLS.
- Record all stock changes through the atomic `record_stock_movement` RPC. Never update product quantities directly.
- Keep domain/data logic in `src/lib` or server route handlers, and reusable presentation in `src/components`. Prefer existing dependencies and patterns; add no packages/services without a concrete need.

## Workspace and roles

Authenticated destinations are Dashboard, Inventory, Movements, Expiry, AI Insights, Reports, and Settings. Preserve the live global search (Ctrl/Cmd+K), Recently Viewed, responsive/collapsible sidebar, language, notification count, branch picker, avatar menu, Settings, and floating Ask StockSense assistant.

- System Admin: all active branches and workspace configuration.
- Editor: products and stock movements in assigned branches.
- Viewer: read-only access in assigned branches.

Accounts are provisioned by System Admin invitation only. Users can update their own name, username, and password. Never add public sign-up.

## Inventory integrity and access

- Available stock is derived from product batches; expiry is tracked per batch.
- Stock In and Stock Out quantities are positive whole numbers in the UI, API, and atomic RPC.
- Validate product/branch and batch ownership, sufficient Stock Out quantity, and inbound batch/expiry information.
- Every stock change is an immutable movement recorded transactionally. Branch removal archives data.
- Product categories come from the persisted category catalog. Block category removal while products use it.
- Enforce branch-scoped RLS. System Admin access is global and must work for all active branches; client-side role visibility is not authorization.

## Seed data

Seed and training data must be explicit, clearly identified in admin configuration, and never loaded automatically at startup. Destructive reset functions must be admin-only, transactional, and restricted to rows linked to a verified private seed manifest. Preserve non-seed branches, catalogs, and stock history. Chunk large operations and persist progress to make retries safe.

## Risk, AI, and interface

- Calculate stock risk deterministically from current batches, expiry, and recent Stock Out history before asking an LLM to explain it. Insufficient history stays unknown.
- Ask StockSense is read-only, grounded in verified branch facts, and cannot mutate stock. Keep the static bank of 100 neutral questions in both supported locales; rotate three per open without a network call. Clear the prompt input as soon as a question is submitted. Suggested prompts must be questions, not claims.
- Keep the light, minimal, responsive interface consistent with `assets/OceanBlue_Design_Guide.md`. Use clear hierarchy, thin icon/text weights, compact searchable selects, and visible keyboard focus.
- Every visible control must work. Tables grow with page content and do not have internal vertical scrolling. On narrow screens, tables may scroll horizontally in their own wrapper. Keep page-size controls and pagination outside table wrappers.
- Include loading, empty, error, success, and validation states. Do not invent chart values or present static data as live.
- Keep the floating chat launcher circular and compact. It remains operable on touch, but is visually subdued until hover or keyboard focus; it must not expand on hover.

## Performance and verification

- Avoid fetching multi-year history outside Movement History. Use database aggregates for 90-day outbound risk and daily report trends; keep raw movement reads bounded on Dashboard, Inventory, Reports, and AI Insights.
- Keep route loading feedback visible during navigation and branch changes. Favor low-latency behavior for non-data interactions.
- Before delivery run `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check`.
- Add or run focused tests for validation/domain logic where possible. Do not start a local web server unless requested. Distinguish automated checks from live Supabase/Vercel/browser UAT and measured performance.

## Secrets, migrations, and delivery

- Apply migrations in filename order. Never print, hardcode, or commit credentials, `.env.local`, service-role keys, or build output. `.env.example` uses placeholders only.
- Keep legacy migrations for database history; implement new behavior in forward migrations. Revoke obsolete unsafe seed entry points when replacing them.
- Stage only files belonging to the task. Preserve unrelated user changes. Push completed work when requested.
