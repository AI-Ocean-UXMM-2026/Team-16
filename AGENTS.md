# OceanBlue — engineering guide

## Product

OceanBlue is a light-first inventory decision tool for small food warehouses. Its operating loop is **Track → Predict → Alert → Recommend**. Help warehouse teams answer: what is in stock, what is at risk, what may happen next, and what action to consider.

The core workflow is Dashboard → Inventory → Stock Movements → AI Insights. Keep the product focused on those workflows; do not introduce ERP, accounting, supplier, delivery, or advanced forecasting scope without an explicit request.

## Implementation rules

- Read this guide before making changes and honor explicit user requests when they differ.
- Prefer the smallest complete solution and preserve existing behavior outside the requested change.
- Use strict TypeScript, avoid `any`, validate API inputs, and separate domain/data operations from presentation.
- Reuse the existing Tailwind and component patterns. Keep the interface operational, accessible, responsive, and light-mode-first; favor clear borders and spacing over decoration.
- Include useful loading, empty, error, success, and validation states. Use semantic controls, associated labels, visible focus, and text labels for risk states.
- Do not commit secrets, local environment files, `.DS_Store`, or generated build output.

## Stack and boundaries

- Next.js App Router, React, TypeScript, Tailwind CSS, Lucide icons.
- Supabase Auth and PostgreSQL are the source of truth. Use Row Level Security for warehouse data and atomic RPCs for stock movements.
- Server-only admin routes may use `SUPABASE_SERVICE_ROLE_KEY`; never import the admin client into browser components or expose this key to clients.
- AI explains calculated/database facts only. It is read-only, may not invent stock quantities, and must not mutate inventory. Label forecasts as estimates and say when history is insufficient.

## Navigation and roles

The authenticated workspace has four primary destinations: Dashboard (`/dashboard`), Inventory (`/inventory`), Movements (`/movements`), and AI Insights (`/insights`). Ask OceanBlue is a floating, read-only assistant available throughout the workspace.

The three roles are:

- **System Admin** — manage users, product categories, and branches; full workspace access.
- **Editor** — manage products and record stock movements in assigned branches.
- **Viewer** — read-only access to assigned branch inventory and history.

Accounts are provisioned by System Admin invitation only. A user profile has a display name and unique username; sign-in accepts username or email. Users may edit their own display name, username, and password. Never add public account creation.

Settings are separated into Profile & password, User access (System Admin only), and Configuration (System Admin only). Product categories are persisted shared options. Branches are warehouses; removal archives a branch and retains inventory and movement history.

## Inventory and risk integrity

- A product's available stock is derived from its batches. Expiry is batch-level.
- Every stock change is an auditable movement; do not directly set product quantity.
- Validate positive quantity, batch/product ownership, available quantity for Stock Out, and expiry details for inbound food batches.
- Keep thresholds centralized in the risk domain module. Current MVP estimates use recent Stock Out history; insufficient history must remain unknown rather than display fabricated days-of-supply.
- Product categories must be selected from the persisted category catalog. Category rename updates existing product assignments; deletion is blocked while products still use that category.
- Branch removal is archival, not destructive deletion.

## Data and security

Apply Supabase migrations in filename order. RLS is mandatory for warehouse data. API routes must validate the authenticated user and required role; do not trust client-side role visibility as authorization. Keep the service-role key in server environment configuration only. Do not hardcode, print, or commit credentials.

BreadTalk demo records are seeded demo data and must not be confused with a production catalog. Avoid seeding demo data into a warehouse that already contains products.

## Verification

Before delivery, run the checks available in `package.json` (at minimum `npm run typecheck` and `npm run lint`), inspect `git diff --check`, and manually verify changed flows when credentials and the local app are available. Report any live Supabase or browser behavior that could not be verified.
