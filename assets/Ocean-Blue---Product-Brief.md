# StockSense Product Brief

**Product:** StockSense, an AI-powered inventory assistant

**Team:** Team Ocean Blue

**Primary market:** Small retail and food businesses, starting with convenience stores and food warehouses in Yangon, Myanmar

**Product loop:** Track → Predict → Alert → Recommend

## Product summary

StockSense gives small operators a dependable view of stock across branches. It records auditable stock movements, tracks inventory by batch and expiry date, surfaces explainable risks, and helps staff decide what needs attention. The system uses Supabase as its source of truth. AI explains verified inventory facts but does not create facts or make stock changes.

## Problem

Small retail and food operators often manage inventory with spreadsheets, manual counts, paper records, or memory. Their stock information can become stale, and staff may discover low stock or an approaching expiry too late. It is also difficult to compare branches, understand movement history, and prioritize work from raw stock records.

StockSense focuses on making these decisions clearer and more timely without requiring a full enterprise resource planning system.

## Who it serves

### Primary users

- Store and warehouse managers who monitor stock, batches, expiry, and movement history.
- Inventory editors who maintain product records and record incoming or outgoing stock.
- Business owners or administrators who manage branches, user access, and workspace configuration.

### Operating context

The initial operating context is a small multi-branch retail or food business. A representative setup is one main warehouse supplying convenience stores in Yangon. Products include everyday packaged foods, beverages, household goods, and other retail items. Stock quantities are whole units.

## Core user workflows

1. **Review the Dashboard.** See current inventory indicators, risks, expiry alerts, and recent movements. Users can select a historical date or date range where supported; future dates are not allowed.
2. **Maintain Inventory.** Search and filter products, inspect batch-level quantities and expiry, add or edit products, remove products where allowed, and import or export inventory data.
3. **Record Stock In or Stock Out.** Select a product and an existing batch or enter/scan its batch number or barcode. Record a positive whole-number quantity. The system validates branch and batch ownership, expiry information for inbound stock, and available quantity for outbound stock.
4. **Manage Expiry.** Review batches by expiry status and find products that need prioritization.
5. **Understand risk.** Review stockout estimates, low-stock and expiry risks, historical movement trends, and the signals behind each estimate.
6. **Ask StockSense.** Ask questions about stock, movements, expiry, and recommended next steps. Responses are read-only and based on verified data for the selected branch. The chat keeps its conversation while the page remains open and offers rotating suggested questions in English and Myanmar.
7. **Report and export.** Review movement and inventory trends over a selected date range, then export relevant warehouse data.
8. **Manage the workspace.** Update personal profile and password, configure categories, branches, and SKU format, and manage user roles, branch assignments, passwords, and account removal.

## Roles and access

- **System Admin:** Can manage users and workspace configuration and has access to all active branches.
- **Editor:** Can manage products and record stock movements in assigned branches.
- **Viewer:** Can read inventory and reports in assigned branches but cannot change stock.

Accounts are created through administrator invitations. Public account registration is not part of the product. Users can update their own name, username, and password. System administrators can manage other users, but cannot remove their own account; at least one System Admin must remain.

## Product requirements

### Inventory integrity

- Supabase PostgreSQL is the source of truth for persisted inventory, batches, users, and movements.
- Available stock is derived from batch quantities.
- Stock changes are recorded through an atomic database operation and immutable movement history. Product quantities are not edited directly.
- Stock In and Stock Out quantities must be positive integers, validated in the interface, API, and database operation.
- Stock Out must reject quantities exceeding the selected batch's available stock.
- Stock In requires valid batch and expiry details for food inventory.
- Product categories and branch assignments use persisted workspace configuration.
- Branch access is enforced server-side and by database row-level security. Hiding a control in the browser is not authorization.

### Risk detection and AI

- Calculate risk deterministically from current batch stock, expiry dates, and recorded Stock Out history before requesting an optional AI explanation.
- Report insufficient history as unknown rather than inventing a forecast.
- Ground assistant answers in verified facts from the selected branch. Distinguish a measured total from a forecast or recommendation.
- The assistant is read-only. It cannot record movements, change products, alter users, or execute recommendations.
- General or playful questions may receive a brief, friendly response, but must not imply external knowledge such as live weather or unsupported inventory facts.
- AI output can be mistaken. Important operational decisions must be checked against inventory records.

### Workspace and interface

- Authenticated areas: Dashboard, Inventory, Movements, Expiry, AI Insights, Reports, and Settings.
- Shared navigation includes live global search with Ctrl/Cmd+K, Recently Viewed pages, a responsive collapsible sidebar, branch selection, language selection, notification counts, an account menu, and the floating Ask StockSense chat.
- English and Myanmar are supported interface languages.
- Tables, forms, filters, pagination, imports, exports, menus, and action buttons must have usable loading, empty, error, success, and validation states.
- The interface should be light, minimal, responsive, accessible by keyboard, and consistent with `OceanBlue_Design_Guide.md`.

### Reporting

- Dashboard and Reports date ranges default to all available history and cannot extend into the future.
- Reports provide inventory, movement, and batch exports for the selected branch and applicable date range.
- Charts and indicators are derived from database results. Do not display static values as live operational data.
- Multi-year raw movement history is limited to the Movement History workflow. Other pages use bounded reads and database aggregates where possible.

## Yangon training inventory

An administrator can load and maintain a separate training network for testing realistic workflows. The target network contains one main warehouse and eight Yangon convenience stores, 200 retail product variants per branch, integer quantities, batch expiry dates, monthly reconciled history beginning January 2021, and daily sales movements for elapsed days in the current month.

Training data is stored in Supabase and can be exercised through normal product and stock workflows. Reset or reduction operations must be explicitly triggered by a System Admin, resumable in small chunks, and restricted to rows tracked by the private seed manifest. They must preserve all unrelated branches, catalogs, and stock history. Training data is never created automatically during application startup.

## Out of scope

Unless separately requested, StockSense is not a full ERP or warehouse management suite. It does not include accounting, payments, supplier management, purchasing automation, delivery routing, IoT hardware, or advanced demand-forecasting models. It does not allow an LLM to make inventory changes.

## Success criteria

- Staff can identify what is currently available and which batches need attention without reconciling separate spreadsheets.
- Stock In and Stock Out remain auditable and cannot create negative or fractional unit quantities.
- Users can only access branches and actions permitted by their role.
- Risk signals are traceable to stock, expiry, or movement data, and uncertainty is stated honestly.
- The assistant answers supported inventory questions accurately and responds clearly when available data is insufficient.
- Users can complete common inventory and reporting workflows on desktop and mobile without dead controls or misleading static content.

## Assumptions to validate

- Small retail and food operators value branch-level stock visibility and batch expiry tracking.
- Recent stock movement history is useful for identifying potential stockout risk, but should not be treated as a guaranteed forecast.
- A grounded natural-language assistant can make inventory records easier to query when it is clear about the limits of its data.
- The initial Yangon convenience-store network is representative enough for product demonstrations and workflow testing.
