# AGENTS.md — OceanBlue

## 1. Project identity

**Team:** Ocean Blue  
**Product:** OceanBlue
**Industry:** Food & Beverage Logistics  
**Product type:** AI-powered inventory assistant for SME food warehouses  
**Primary user:** Warehouse / Inventory Manager

### Product vision

OceanBlue AI helps SME food warehouses identify stock risks and take action before problems happen.

### North star

**See the risk. Understand the reason. Take action.**

### Core product loop

**Track → Predict → Alert → Recommend**

The product should always help the user answer:

1. What do I have?
2. What is at risk?
3. What may happen next?
4. What should I do?

---

## 2. Working rules for coding agents

When implementing a request:

- Read this file first and treat it as the default product/design context.
- Do not ask for details already defined here.
- Make reasonable implementation decisions that follow this guide.
- Prefer the smallest complete solution over unnecessary architecture.
- Preserve existing working behavior unless the prompt explicitly changes it.
- Do not expand MVP scope without being asked.
- Reuse existing components and patterns before creating new ones.
- Keep TypeScript types strict. Avoid `any`.
- Keep business logic separate from presentation components.
- Never invent warehouse data in production code.
- AI output must be grounded in calculated/database values.
- Label predictions as estimates.
- Optimize for a convincing, reliable 2–3 day Buildathon MVP.

If a user prompt conflicts with this file, the explicit prompt wins.

---

## 3. MVP scope

### Build

- Overview dashboard
- Inventory table
- Search and filters
- Product details
- Stock In
- Stock Out
- Product batches
- Batch expiry tracking
- Stock risk calculation
- Stockout estimation
- Expiry alerts
- AI recommendation cards
- Ask OceanBlue AI

### Do not build unless explicitly requested

- Full ERP
- Accounting
- Supplier management
- Delivery management
- Route planning
- Multi-warehouse complexity
- IoT hardware
- Advanced barcode infrastructure
- Complex ML forecasting
- Large analytics suites
- Unrelated admin features

---

## 4. Primary navigation

Keep the application to four primary destinations:

1. **Overview** — `/dashboard`
2. **Inventory** — `/inventory`
3. **Movements** — `/movements`
4. **AI Insights** — `/insights`

Use a left sidebar on desktop.

Do not create extra top-level navigation unless necessary.

The AI assistant should normally open in a right-side Sheet or live inside AI Insights rather than becoming a separate chat application.

---

## 5. Design direction

OceanBlue AI is a:

- modern B2B SaaS application
- light-mode-first interface
- desktop-first responsive web app
- data-heavy operational tool
- calm, trustworthy, precise product

### Visual keywords

- clean
- minimal
- professional
- intelligent
- operational
- data-focused
- action-oriented

### Avoid

- glassmorphism
- heavy gradients
- neon colors
- excessive shadows
- oversized illustrations
- decorative charts
- unnecessary animation
- huge rounded cards
- excessive empty space
- dashboard clutter

Use borders and spacing more than shadows.

The inventory data and risks are the visual priority.

---

## 6. UI technology

Preferred frontend:

- TypeScript
- React / Next.js
- Tailwind CSS
- shadcn/ui
- TanStack Table where needed
- Lucide icons

Use shadcn/ui primitives before building custom replacements.

Preferred components:

| Need | Component |
|---|---|
| App navigation | Sidebar |
| KPI / insight container | Card |
| Inventory data | Table / TanStack Table |
| Risk status | Badge |
| Stock entry | Sheet or Dialog |
| Product details | Sheet |
| Forms | Input, Select, Field |
| Expiry date | Calendar + Popover |
| Confirmation | AlertDialog |
| Notifications | Sonner |
| AI panel | Sheet + ScrollArea |
| Loading | Skeleton |

Do not create a custom design system when shadcn/ui already provides the required primitive.

---

## 7. Typography

Primary font:

**Inter**

Use it for all normal interface text.

Optional:

**Roboto Mono**

Use only where monospaced values improve scanning, such as:

- SKU
- batch number
- selected technical identifiers

### Type scale

- Page title: 24–28px / semibold
- Section title: 18px / semibold
- Body: 14px / regular
- Table: 14px
- Small label: 12px / medium
- KPI: 28–32px / semibold or bold

Prefer concise labels and plain language.

Use tabular numerals for inventory quantities and metrics where possible.

---

## 8. Layout tokens

Default values:

- Base spacing: 4px system
- Page padding: 24–32px desktop
- Card padding: 20–24px
- Component gap: 12–16px
- Section gap: 24–32px
- Card radius: 12px
- Button/input radius: 8px
- Sidebar width: ~240px
- Header height: ~64px
- Table row height: 48–56px

Prefer subtle neutral borders.

Do not make every section a card. Use cards only when grouping improves comprehension.

---

## 9. Color semantics

The brand direction is **Ocean Blue**.

Use the project's shadcn/Tailwind theme tokens instead of scattering raw color values through components.

Primary blue is for:

- primary CTA
- active navigation
- links
- focus/selection
- key interactive states

Risk semantics:

- **Healthy** → green
- **Low Stock** → amber/yellow
- **Stockout Risk** → red
- **Expiry Risk** → purple
- **Unknown** → gray

Never communicate status through color alone.

Always pair status with text and, where useful, an icon:

- `Healthy`
- `Low Stock`
- `High Risk`
- `Expiry Risk`
- `Unknown`

Keep status styling consistent throughout the app.

---

## 10. Overview dashboard

The dashboard should communicate warehouse health within roughly five seconds.

Recommended hierarchy:

1. Page heading
2. Primary action: **Record Movement**
3. KPI cards
4. **Needs Attention**
5. Risk list
6. Recent stock movements

Core KPIs:

- Total Products
- Low Stock
- Stockout Risk
- Expiring Soon

Urgent risks should appear before large analytics or charts.

Example risk:

**Chicken Sausage**  
High Risk  
40 units remaining  
~2.2 days of supply

Do not make charts the hero of the MVP.

---

## 11. Inventory page

The inventory table is the operational center of the product.

Recommended columns:

- Product
- SKU
- Stock
- Average Daily Out
- Days Left
- Status
- Action

Support:

- search
- risk filtering
- sorting
- product detail opening

Default risk filters:

- All
- Healthy
- Low Stock
- Stockout Risk
- Expiry Risk

Keep rows compact and highly scannable.

Product names and statuses should be easier to scan than secondary metadata.

---

## 12. Product details

Open product details in a side Sheet when practical.

Show:

- Product name
- SKU
- Current stock
- Average daily outflow
- Estimated days of supply
- Risk status
- Batches
- Batch quantities
- Expiry dates
- Recent movements
- AI insight/recommendation

Expiry is a **batch-level property**, not only a product-level property.

A product can simultaneously have stockout risk and an expiring batch. Do not force these into one mutually exclusive status internally.

---

## 13. Stock movements

Stock changes should be recorded as movements.

Never implement stock management as only:

`product.quantity = newValue`

The user flow should record an auditable transaction.

Movement form:

- movement type: Stock In / Stock Out
- product
- quantity
- batch
- expiry date when relevant
- reason where relevant

Validate:

- quantity > 0
- Stock Out cannot exceed available stock
- required product/batch fields
- valid expiry date when applicable

After success:

1. persist movement
2. update/recalculate stock safely
3. refresh affected risks
4. show success toast
5. update visible UI

Prefer atomic database operations for inventory mutations.

---

## 14. Core data model

Minimum conceptual entities:

### products

- id
- name
- sku
- category
- created_at
- updated_at

### product_batches

- id
- product_id
- batch_number
- quantity
- expiry_date
- created_at

### stock_movements

- id
- product_id
- batch_id
- movement_type
- quantity
- reason
- created_at
- created_by

If authentication/membership is implemented, add the minimum required warehouse/user ownership fields and enforce them with RLS.

Do not duplicate derived metrics unnecessarily if they can be safely calculated.

---

## 15. Supabase rules

Use Supabase for:

- PostgreSQL
- authentication
- persistence
- Row Level Security

Rules:

- Enable appropriate RLS for user-owned/warehouse-owned data.
- Never expose service-role credentials to the browser.
- Keep secrets server-side.
- Prefer database constraints for important integrity rules.
- Inventory mutations should be transactional/atomic where possible.
- Treat stock movements as the audit trail.
- Realtime is optional, not required for MVP.

---

## 16. Rust responsibilities

If Rust/Axum is part of the implementation, keep its responsibility focused.

Good Rust responsibilities:

- domain/business rules
- inventory calculations
- risk evaluation
- forecasting endpoint
- recommendation preparation
- secure server-side integrations

Do not introduce Rust services merely to increase architectural complexity.

For Buildathon speed, use the simplest boundary that produces a reliable demo.

---

## 17. Risk calculation

For the MVP, use transparent rules rather than pretending simple calculations are advanced ML.

### Average daily outflow

Calculate from recent Stock Out movements over an appropriate window.

Handle insufficient history explicitly.

### Days of supply

`days_of_supply = available_stock / average_daily_outflow`

Handle zero/unknown daily outflow safely.

### Default MVP thresholds

- `0–3 days` → High / Stockout Risk
- `4–7 days` → Low Stock
- `>7 days` → Healthy
- batch expiry `<=3 days` → Expiry Risk
- insufficient data → Unknown

Treat these thresholds as configurable MVP assumptions.

Do not hardcode business assumptions throughout unrelated UI files. Centralize them.

---

## 18. AI behavior

AI is an explanation and decision-support layer.

It is **not** the source of truth for inventory quantities.

Flow:

**Database Data → Calculation → Risk → AI Explanation → Recommendation**

AI may help answer:

- What needs my attention today?
- Which products may run out soon?
- Which batches are expiring?
- Why is this product high risk?
- What should I review for reorder?

Every recommendation should be grounded in known values.

A good insight contains:

1. **Problem** — what is happening?
2. **Evidence** — what numbers support it?
3. **Prediction** — what may happen?
4. **Recommendation** — what should the manager consider doing?

Example:

> Chicken Sausage has 40 units remaining and recent average outflow is 18 units/day. At the current rate, stock may last about 2.2 days. Consider reviewing a reorder today.

Avoid:

> You definitely need exactly 100 units.

unless the reorder calculation has enough supporting inputs.

Reorder quantity ideally requires:

- demand/outflow
- supplier lead time
- safety stock
- incoming orders
- current inventory

If those values are unavailable, clearly label reorder quantities as demo estimates or suggestions.

Never let the LLM fabricate missing inventory facts.

---

## 19. Ask OceanBlue AI

Primary demo question:

**“What needs my attention today?”**

Prefer a concise prioritized answer.

Example structure:

**3 items need attention**

1. Chicken Sausage — High stockout risk
2. Strawberry Yogurt — Batch expires soon
3. Chocolate Milk — Low stock

Then provide a short recommended priority.

The AI experience should feel like an operational assistant, not a general-purpose chatbot.

Keep answers:

- short
- actionable
- evidence-based
- easy to scan

---

## 20. UX rules

Follow these by default:

1. One dominant CTA per screen.
2. Put urgent information first.
3. Every risk needs a reason.
4. Every important risk should suggest a next action.
5. Never rely on color alone.
6. Keep forms short.
7. Use plain language.
8. Show loading states.
9. Show empty states.
10. Show error states.
11. Show success feedback.
12. Avoid unnecessary confirmation dialogs.
13. Confirm destructive or irreversible actions.
14. Preserve keyboard accessibility.
15. Use clear focus states.
16. Make tables scannable.
17. Keep important actions visible.
18. Warehouse data is more important than decoration.

---

## 21. Responsive behavior

Priority:

1. Desktop
2. Tablet
3. Basic mobile support

Desktop:

- persistent sidebar
- full inventory table
- multi-column dashboard where useful

Tablet:

- collapsible sidebar
- reduce columns where necessary

Mobile:

- drawer navigation
- stack cards
- allow data table horizontal scrolling or provide a compact representation
- keep primary actions reachable

Do not compromise the desktop operational experience merely to create an elaborate mobile UI for the MVP.

---

## 22. Accessibility

Target sensible WCAG AA behavior.

Always include:

- visible focus states
- semantic HTML
- associated form labels
- accessible error messages
- keyboard-operable controls
- adequate contrast
- text labels for status
- useful button names

Do not use icon-only controls without accessible names/tooltips where needed.

---

## 23. States to implement

Important screens/components should account for:

- loading
- empty
- populated
- filtered with no results
- error
- success
- insufficient prediction data

Example:

Instead of showing `0 days` when prediction data is missing, show:

**Not enough data**

with a short explanation.

---

## 24. Coding conventions

Unless the existing repository establishes a different convention:

- Use strict TypeScript.
- Avoid `any`.
- Prefer small composable components.
- Separate data access, domain logic, and presentation.
- Use server-side code for secrets and privileged operations.
- Validate data at boundaries.
- Reuse shared types where appropriate.
- Prefer descriptive names over abbreviations.
- Keep components focused.
- Do not prematurely abstract one-off code.
- Do not add dependencies when existing tools solve the problem.
- Remove dead code created during implementation.
- Preserve existing lint/format conventions.

Before declaring a task complete:

- run available type checks
- run linting if configured
- run relevant tests if configured
- verify the changed flow manually where possible
- report anything that could not be verified

---

## 25. Feature implementation checklist

When asked to build a new feature, automatically consider:

### Product
- What user problem does this solve?
- Is it inside MVP scope?

### Data
- What is the source of truth?
- Does schema/data access need changing?
- Does RLS matter?

### UI
- loading state
- empty state
- error state
- success state
- responsive behavior
- accessibility

### Inventory integrity
- Could this incorrectly change stock?
- Does it require an atomic operation?
- Should it create a stock movement?

### AI
- Is AI actually necessary?
- What verified data should ground the response?
- Can deterministic calculation happen before the LLM?

### Quality
- Type safety
- validation
- reuse
- minimal complexity

Do these automatically; the user should not need to repeat them in every prompt.

---

## 26. Demo priority

The strongest demo flow is:

1. Manager opens Overview.
2. A high-risk product is visible.
3. Manager records a stock movement.
4. Inventory updates.
5. Risk calculation updates.
6. AI explains the changed risk.
7. Manager asks, “What needs my attention today?”
8. OceanBlue provides prioritized actions.

Optimize implementation quality around this path first.

---

## 27. Product copy style

Use simple operational English.

Good:

- Low Stock
- High Risk
- Expiring Soon
- 40 units remaining
- Estimated 2.2 days left
- Review reorder
- Record Movement
- Needs Attention

Avoid:

- overly technical ML language
- marketing language inside operational screens
- long paragraphs
- vague AI claims

Use “AI” sparingly. The useful insight matters more than repeatedly labeling features as AI-powered.

---

## 28. Final decision rule

When there are several reasonable implementation options, choose the one that best supports:

**clarity + reliability + demo value + build speed**

Do not optimize for architectural sophistication during the MVP.

The finished product should feel like:

**a useful inventory decision tool, not a flashy dashboard.**
