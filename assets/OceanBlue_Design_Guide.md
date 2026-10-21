# OceanBlue — Design Guide

Team Ocean Blue · Inventory operations workspace

## Design intent

Create a clean, minimal, lightweight inventory manager for food warehouses. Use the supplied `inventory-manager` GitHub project as the primary page-layout and interaction reference. The OceanBlue product shell remains its own: global search, Recently Viewed, sidebar toggle, responsive navigation, EN/MM language, notifications, branch dropdown, avatar menu/settings, and floating Ask OceanBlue bubble.

Prioritize the operator's next decision over decoration. Avoid dashboard icon clutter, ornamental charts, static-looking controls, and cards that imply an interaction without working. Every KPI, filter, table action, button, and chart control must either navigate, filter, update, or be clearly non-interactive.

## Visual system

- Primary blue `#2563EB`; navy `#0F172A`; canvas `#F8FAFC`; surface `#FFFFFF`; border `#E2E8F0`.
- Status: healthy `#16A34A`; low stock `#D97706`; stockout `#DC2626`; expiry `#7C3AED`; unknown `#64748B`.
- Inter/system sans for interface text; tabular numerals for quantities and dates. Use a restrained mono face only for SKUs and batch identifiers.
- Page title 26px / 600; section title 16–18px / 600; body and table text 14px; supporting labels 12px; primary KPI values 26–30px.
- Use a 4px spacing base, 12px panel radius, clear one-pixel borders, restrained or no shadows, and consistent 48–56px table rows.
- Keep touch targets comfortable, controls visibly focused, text readable, and risk labels explicit rather than color-only.

## Shared application shell

- Fixed/sticky desktop sidebar with distinct separation from page content; collapsed state keeps usable icons and branch selection, expanded labels remain comfortably sized. On small screens use an accessible off-canvas menu.
- Sticky header contains the preserved global controls. Keep the EN/MM picker compact and flag-marked; notification count is populated on load; avatar menu includes Settings and Sign out.
- Recently Viewed is user-specific and bounded to the latest 10 unique destinations.
- Ask OceanBlue stays fixed across workspace pages. Collapsed state is a visible, high-contrast round chat bubble with a centered chat icon; hover/focus may expand its label.

## Page layouts

### Dashboard

- Header: page title/brief description and working Stock In/Out and Add Products actions.
- Begin with a single compact KPI strip for products, units, low stock, expiry risk, and stockout risk. Values link to useful filtered destinations when appropriate.
- Use a status distribution and prioritized action list as the main decision panels. Follow with an attention table and recent movements.
- All displayed values come from the active Supabase branch. No fake chart values or dead date-range controls.

### Inventory

- KPI strip followed by a prominent, internally scrolling product table.
- Include working risk tabs, instant search, searchable category/expiry filters, sort, CSV import/export, row selection, bulk actions, and a fixed pagination footer.
- Product detail opens in a responsive drawer. Add/edit forms use persisted categories. Archive is confirmable and preserves audit history.
- Batch expiry remains visible in details and expiry management; stock is not editable as a free-form product field.

### Stock Movements

- KPI strip and a searchable/filterable movement audit table with pinned controls, two-axis internal scrolling, and fixed row-count/page-size/pagination footer.
- Stock In and Stock Out open a dialog. Validate product, batch, quantity, and inbound expiry; write through the atomic database RPC. Demo branches are editable test records when the signed-in role permits it.
- On success, close/update the workflow and refresh quantities and risks. Report failures without losing form context.

### Expiry Management

- Show counts for active, urgent, expired, upcoming, and untracked batches. Search and filter by category/status; sort and export.
- Include no-date batches as an explicit state. Nearest or expired batches sort first. Avoid unsupported valuation or advice.

### AI Insights and Reports

- Explain each risk with the measured stock, usage window, expiry evidence, confidence/data quality, and suggested action. Insufficient data stays unknown.
- Reports use selected-branch product and movement records; label date windows and empty states. Do not show valuation where unit cost is absent.

## Interaction and component rules

- Reuse `PageHeading`, `KpiStrip`, `Panel`, `PanelHeader`, sortable `Th`, `TableFrame`, `SearchableSelect`, and shared status badges. Extend a shared component when the pattern truly repeats; remove abandoned variants.
- Searchable dropdowns must be keyboard operable, searchable, and sized to the surrounding UI. Avoid oversized popovers for two-option language selection.
- Table header/toolbars and pagination remain anchored while table content scrolls internally in both dimensions.
- Buttons show pending, disabled, success, or error state as appropriate. No click-only rows without keyboard-accessible links/actions.
- Responsive behavior should preserve content, controls, and navigation at narrow widths; do not hide the only route to a feature.

## Data and AI integrity

- Supabase is authoritative for persisted inventory. Clearly distinguish BreadTalk Demo branches from production branches.
- A product's stock is the sum of its batch quantities. Each stock change is an immutable movement recorded transactionally.
- Calculate risk deterministically before AI explanation. The LLM may summarize verified facts only, cannot fabricate quantities/dates, and cannot mutate stock.

## Quality checks

For frontend changes, verify typecheck, lint, build, loading/empty/error/success states, responsive layouts, keyboard interaction, and that visible controls perform their advertised action. For data changes, verify RLS/role enforcement and branch isolation; report any unavailable live verification.
