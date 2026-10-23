# StockSense design guide

Team Ocean Blue · AI-powered inventory assistant

## Product intent

StockSense helps small retail and food operators make confident day-to-day inventory decisions. The interface should make it easy to understand what is on hand, what may run out, what may expire, what changed, and what action is worth considering. Favor clarity, speed, and trust over decoration.

## Visual language

- Light-first palette: blue `#2563EB`, ink `#0F172A`, canvas `#F8FAFC`, surface `#FFFFFF`, border `#E2E8F0`.
- Status colors: healthy `#16A34A`, low stock `#D97706`, stockout `#DC2626`, expiry `#7C3AED`, unknown `#64748B`. Pair color with readable text.
- Use the system sans-serif stack. Use tabular numerals for quantities and dates and restrained monospace for SKUs and batch IDs.
- Page titles are about 26px/600; section headings 16–18px/500–600; body 14px; secondary labels 12px. Prefer normal/medium weights for navigation and buttons.
- Use a four-pixel spacing rhythm, 12px panel radius, one-pixel borders, minimal shadows, comfortable touch targets, and visible focus rings.
- Lucide icons use a light stroke (about 1.5–1.8) and appear only when they aid recognition.

## Shared shell

- Keep the desktop sidebar separated from the page content and usable when collapsed. On small screens use a working off-canvas menu.
- Preserve global search, Recently Viewed, sidebar toggle, responsive navigation, EN/MM choice, notification count, branch picker, avatar/settings menu, sign out, and the floating Ask StockSense assistant.
- The StockSense mark and title use the shared open-box brand asset and link to the root route.
- Branch changes show an inline spinner and shared route progress feedback until refreshed data arrives.
- Recently Viewed is user-specific and holds at most ten destinations.
- Place System Guide directly above Settings in the sidebar's bottom group and include it in the avatar menu. The guide defaults to the signed-in role and presents one task at a time in a two-column topic navigator and reader. Its Focus mode is a full-screen, scrollable reading surface with visible close control and Escape support.
- Ask StockSense uses a compact circular chat launcher with a centered icon. It is lower-opacity at rest and becomes fully visible on hover or keyboard focus. It remains clickable on touch screens and opens only on click; hover must not expand it. The panel closes with Escape, its close button, or an outside click. Opening leaves the question empty and rotates three prompts from a static bank of 100 common questions in the active locale without a network request.

## Page patterns

### Dashboard

Use a compact KPI strip and clear decision panels for urgent stock, expiry risk, and recent movements. Date-range choices and other visible controls must update the displayed data. Keep movement charts compact and avoid unnecessary icons or static values presented as live.

### Inventory and expiry

Use searchable, filterable tables with page-level vertical scrolling. Do not put a vertical scroll region around table rows. A table may scroll horizontally within its wrapper when columns exceed the viewport. Keep filters and table headings with the table, and pagination/page-size controls outside the horizontal wrapper. Page-size options (including 10) use a compact searchable dropdown. Product details, batch expiry, exports, and permitted bulk actions use current Supabase data.

### Movements

Present stock history as an auditable table that grows with page content. Keep its pagination outside the horizontal table wrapper. Stock In uses one batch-number/barcode input plus a searchable existing-batch picker. Stock Out uses one batch picker that accepts barcode search. Quantities are positive whole numbers. Confirm selected batch, available stock, and inbound expiry before an atomic update.

### Reports and AI

Reports reflect the selected warehouse and date range. Keep inventory, movement, and batch export actions aligned in the Reports heading row. Place Monthly movement trend directly above Daily movement with no vertical gap between those panels. Use database aggregates for trends rather than loading all transactions. Calculate risk deterministically before any AI explanation; insufficient data stays unknown. Ask StockSense can explain verified facts only and never mutates inventory.

### Settings

Keep Profile & password, User access, and Configuration separated by tabs. Only System Admin sees access/configuration.

## Responsive and accessible behavior

- Support narrow mobile, tablet, laptop, and wide desktop layouts. Let controls wrap or stack; avoid clipping.
- Tables must not force the whole page wider than the viewport. Allow horizontal table scrolling only where required, never internal vertical row scrolling.
- Use semantic buttons/inputs, associated labels, keyboard-operable searchable lists, accessible names, visible focus, and text labels for status.
- Loading, empty, error, success, and validation states are required for data operations. Disabled state and progress feedback must be explicit.
- Search results update as the user types.
- Searchable dropdowns close on pointer/touch outside and close after a single selection. On coarse-pointer devices, multi-select dropdowns close after each selection so users can see the compact selected-count value and reopen the list for another choice. Keep selected values from expanding the trigger width.

## Data integrity

Supabase is authoritative. Available stock is derived from batches; every stock change is recorded transactionally. Deterministic risk uses verified batches, expiry, and recent Stock Out history. The AI assistant is read-only and must not invent or mutate inventory facts. How-to answers use the same role-aware content as the System Guide. General questions should be answered directly and pleasantly, with light humor when suitable and a verified inventory aside only when relevant; never claim live external information.
