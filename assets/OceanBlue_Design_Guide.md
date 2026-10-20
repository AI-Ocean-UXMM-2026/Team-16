# OceanBlue — Design & Development Guide
Team: Ocean Blue | Product: OceanBlue | Buildathon MVP

## Product principles
- Prioritize inventory risks and recommended actions over decorative analytics.
- Calm, precise, accessible B2B SaaS UI with an Ocean Blue visual identity.
- Design for one user: SME food warehouse/inventory manager.
- Primary workflow: Track → Predict → Alert → Recommend.

## Visual system
- Primary: #2563EB; dark navy: #0F172A; background: #F8FAFC; surface: #FFFFFF; border: #E2E8F0.
- Healthy: #16A34A; low stock: #D97706; stockout risk: #DC2626; expiry risk: #7C3AED.
- Google Font: Inter for all UI; optional Roboto Mono for stock and SKU figures.
- Type: headings 24–28px/600; section headings 18px/600; body and table 14px; supporting labels 12px; KPI 28–32px.
- Base spacing 4px; cards 20–24px padding; 12px radius; inputs 8px radius; desktop sidebar 240px; table rows 48–56px.
- Use semantic labels alongside colors; accessible keyboard focus; legible numeric columns.

## Mobbin references
- Square dashboard: https://mobbin.com/screens/36ae5076-f9b4-488d-a3b9-ace1d89c8aba
- Shopify product management: https://mobbin.com/screens/d9deb551-88bf-4c93-91b3-43ef6659ccef
- Square product list: https://mobbin.com/screens/78f2c018-e2c9-440c-8b5c-e631b2539163
- Xero form entry: https://mobbin.com/screens/0be26afa-c93c-48ba-9f22-169a82946a6b
These links are UI references, not designs to copy pixel-for-pixel.

## App navigation
1. /dashboard — KPIs, risks, recent activity
2. /inventory — searchable, filterable product table, product detail drawer
3. /movements — stock in/out recording and movement history
4. /insights — risk cards, explanations, AI recommendations and optional Ask AI sheet

## Dashboard information hierarchy
- Top: title and Record Movement CTA.
- Four metric cards: total products, stockout risks, expiring soon, healthy items.
- Urgent risk panel first; product details and recent movements after.
- Skip large decorative charts for MVP.

## Inventory design
- Search by name and SKU; filter by stock/expiry risk; quantity and days remaining right aligned.
- Example columns: Product, SKU, Available, Average Daily Out, Risk, Actions.
- Show batch-level expiry; distinct lots may have different expiry dates.
- Use text labels for Healthy, Low Stock, Stockout Risk, Expiry Risk, Unknown Data.

## Stock movement design
- Use a shadcn Sheet or Dialog.
- Fields: movement type, product, quantity, batch, reason, and expiry for inbound food stock.
- Prevent invalid or negative values and overdrawing stock.
- Show post-save toast and updated stock; offer stock movement audit history.

## AI insights
- Problem → Evidence → Estimated risk time → Recommended action → Confidence / data quality.
- Example: Chicken Sausage, 40 units, 18/day, about 2.2 days of supply.
- Treat proposed reorder amounts as guidance, accounting for lead time, safety stock and incoming orders when data exists.
- Prefer deterministic calculations for MVP stock risk; use LLM for clear explanations and questions grounded in actual inventory data. Never fabricate counts, dates, or prediction accuracy.

## shadcn/ui mapping
Sidebar: app shell; Card: KPIs; TanStack Table + Table: inventory; Badge: status; Sheet/Dialog: transactions and details; Field/Input/Select: forms; AlertDialog: destructive confirmation; Sonner: toasts; Skeleton: loading; Popover + Calendar: expiry.
Documentation: https://ui.shadcn.com/

## Technical architecture
Frontend: React or Next.js + TypeScript + Tailwind CSS + shadcn/ui.
Backend: Supabase Auth + PostgreSQL (with row-level security); optional Rust/Axum API for scoped domain logic.
Buildathon simplification: TypeScript client, Supabase database/auth, and only a thin Rust service if Rust is mandatory. Avoid routing a single transaction through multiple writers.
Database MVP: products, product_batches, stock_movements, warehouse_members (if multi-user), ai_insights (optional cache).
Stock movement should be an atomic database transaction or RPC, recording an immutable movement event and updating stock safely. Never use an unauthenticated browser write with a privileged Supabase key. Enforce warehouse-specific RLS.
Historical demand estimates may be based on signed outbound movements. Without adequate data, label insights 'Insufficient history'.

## MVP implementation order
Day 1: app shell, inventory page, Supabase schema/auth, reliable stock in/out.
Day 2: risk calculations, batch expiry alerts, AI insight explanations.
Day 3: state polish, loading/error/empty states, responsive testing, narrative demo.
Stretch-only: barcode scanning; full LLM chat; real-time collaborative updates.

## Quality and accessibility
- Loading, empty, success, error, validation and permission states are designed.
- Accessible labels, focus styles, AA contrast, non-color status labels, responsive layouts.
- Use sample data clearly labeled as sample; never promise a prediction unsupported by input records.
- Prioritize the warehouse manager's next action in under five seconds.

## Vibe-coding prompt
Build OceanBlue AI, a responsive, light-mode, Ocean Blue B2B food warehouse inventory app. Use TypeScript/React, Tailwind, shadcn/ui, Inter, Supabase Auth/Postgres/RLS, and optional Rust/Axum for a narrow backend boundary. Follow tokens and four routes above. Build real data flows for stock in/out, batch expiry and risk estimation. Explain AI recommendations using verifiable current database values; no fabricated stock or dates. Use sidebar, KPI cards, searchable inventory table, transactional movement sheet, and actionable risk cards. Maintain consistent spacing, accessibility, keyboard navigation, optimistic updates only if safe, and complete loading/error/empty states. Avoid unnecessary features and decorative visual clutter.
