# OceanBlue design guide

Team Ocean Blue · Inventory operations workspace

## Intent

Present a calm, lightweight workspace for operators who need to see what is available, what is at risk, and what action to consider. Use the inventory-manager reference layout for page structure while preserving OceanBlue's global navigation and tools. Avoid decoration, excessive iconography, visual weight, and controls that look interactive but do nothing.

## Visual language

- Light-first palette: blue `#2563EB`, ink `#0F172A`, canvas `#F8FAFC`, surface `#FFFFFF`, border `#E2E8F0`.
- Status colors: healthy `#16A34A`, low stock `#D97706`, stockout `#DC2626`, expiry `#7C3AED`, unknown `#64748B`. Always include a readable status label.
- Use the system sans-serif stack; use tabular numerals for quantities and dates and restrained monospace for SKUs/batch IDs.
- Page title about 26px/600; section headings 16–18px/500–600; body 14px; secondary labels 12px. Prefer normal/medium weights for navigation and buttons.
- Four-pixel spacing rhythm, 12px panel radius, one-pixel borders, minimal shadows, comfortable touch targets, and clear focus rings.
- Lucide icons should use a light stroke (about 1.5–1.8) and appear only where they aid recognition.

## Shared shell

- Desktop sidebar is fixed and visually separated from page content. Collapse to usable icons; on small screens use a working off-canvas menu.
- Keep the global search, Recently Viewed, sidebar toggle, responsive navigation, EN/MM choice, notification count, branch picker, avatar/settings menu, and sign out.
- Recently Viewed is user-specific and holds at most ten destinations.
- Ask OceanBlue is a fixed circular chat button with a centered chat icon. It never expands on hover. The panel closes with Escape, its close button, or an outside click. Opening it leaves the question empty and requests fresh AI-generated suggested questions; fallback questions are allowed only if the AI service is unavailable. Suggestions must be neutral, grounded prompts, not fabricated answers.

## Page patterns

### Dashboard

Use a compact KPI strip and clear decision panels for urgent stock, expiry risk, and recent movements. Date-range choices and every other control must change the displayed data. Avoid unnecessary icons and fake/static charts.

### Inventory and expiry

Use searchable, filterable tables with internal horizontal and vertical scrolling. Keep filters/table heading and pagination controls outside the scrolling body. Page-size options (including 10) use a compact searchable dropdown. Product detail, batch expiry, export, and permitted bulk actions must work with current Supabase data.

### Movements

Present stock history as an auditable table with aligned actions, fixed footer, and two-axis internal scroll. Stock In uses a single batch-number/barcode input. Stock Out uses one batch picker whose search accepts a scanned barcode. Quantities are positive whole numbers. Confirm the selected batch, available stock, and inbound expiry before sending an atomic update.

### Reports and AI

Reports reflect the selected warehouse. Place the “Download selected warehouse data as CSV” section at the top of the report content with clear exports for inventory, movements, and batches. AI risk analysis is deterministic first and explainable; uncertain estimates remain unknown. Ask OceanBlue can explain verified facts only and never mutates inventory.

### Settings

Keep Profile & password, User access, and Configuration separated by tabs. Only System Admin sees access/configuration. The Configuration tab owns the Yangon network loader and category/branch management.

## Responsive and accessible behavior

- Test narrow mobile, tablet, laptop, and wide desktop layouts. Allow wrapping or compact stacking rather than clipping controls.
- Use semantic buttons/inputs, associated labels, keyboard-operable searchable lists, accessible names, visible focus, and text labels for status.
- Loading, empty, error, success, and validation states are required for data operations.
- A button's disabled state and loading feedback must be explicit. Search results update as the user types.

## Data integrity

Supabase is authoritative. Stock is the sum of batches; each stock change is a database movement. The Yangon training network is separate from user-created catalogs and can only replace manifest-tracked rows. Preserve all other branches and history. Ask OceanBlue explanations and prompt suggestions must be read-only and based on verified data.
