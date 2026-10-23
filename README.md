# StockSense

StockSense is an AI-powered inventory assistant for small retail and food businesses. It gives teams a clear view of stock across branches, batch-level expiry, and auditable stock movements, then calculates explainable risks and offers grounded, read-only recommendations. The product loop is **Track → Predict → Alert → Recommend**.

## What it includes

- A branch-aware Dashboard, Inventory, Movements, Expiry, AI Insights, Reports, and Settings workspace.
- A bilingual, role-specific System Guide with a focused reading mode and task-by-task navigation for System Admins, Editors, and Viewers.
- Search, filters, exports, notifications, recently viewed pages, English and Myanmar UI, and responsive navigation.
- Atomic Stock In and Stock Out operations with positive whole-number quantities, batch validation, and immutable movement history.
- Role-based access for System Admin, Editor, and Viewer.
- Deterministic inventory risk calculations with optional AI explanations based on verified warehouse data. Ask StockSense also explains how to use the system, responds naturally to general questions, and cannot change inventory.

## Run locally

Requirements: Node.js compatible with the installed Next.js version, npm, and a configured Supabase project.

```bash
npm install
cp .env.example .env.local
```

Set the actual local values in `.env.local`, then start the app:

```bash
npm run dev
```

Required client configuration is `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or the legacy anon key supported by the Supabase client). Server-side user administration requires `SUPABASE_SERVICE_ROLE_KEY`; optional AI explanations use server-only `OPENAI_API_KEY` and `OPENAI_MODEL`. Never add a service-role or AI secret to a `NEXT_PUBLIC_*` variable. Keep `.env.local` untracked and do not share its contents.

In Supabase Auth, configure the Site URL and allowed redirect URLs for local and deployed `/auth/callback` routes. Public sign-up is disabled; a System Admin invites users.

## Deploy the secondary GitHub repository to Vercel

The secondary repository (`AI-Ocean-UXMM-2026/Team-16`) deploys through GitHub Actions and the Vercel CLI. It does not need to be connected to Vercel's Git integration. The workflow in `.github/workflows/deploy-secondary-vercel.yml` deploys `main` to the configured Vercel production project and can also be run manually from GitHub Actions.

1. In Vercel, switch to the team that should own the second deployment. Create a project without importing a Git repository. If the dashboard only offers Git import, create it with the Vercel CLI instead: install the CLI with `npm install --global vercel@latest`, run `vercel login`, then run `vercel project add` and follow the prompts. Do not connect the primary project or change its Git settings.
2. In the new project's Settings, set the framework to Next.js (or leave automatic detection), and add the same required production environment variables used by the primary project. At minimum, configure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; add `SUPABASE_SERVICE_ROLE_KEY` and `OPENAI_API_KEY` only if those server features are enabled. Keep secret values in Vercel, never in GitHub workflow YAML or source code. Redeploy after changing environment variables.
3. Get the new project's `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` from its Vercel project settings or the `.vercel/project.json` created when linking that project locally. Create a Vercel access token with access to the owning team.
4. In the secondary GitHub repository, open **Settings → Secrets and variables → Actions → New repository secret**. Add `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID`. Secret values should be entered directly into GitHub, not shared in chat or committed.
5. Ensure the production branch is named `main`, then run **Actions → Deploy secondary repository to Vercel → Run workflow** once to verify setup. Later pushes to `main` automatically deploy this project. The repository's existing `origin` push configuration sends commits to both GitHub repositories.

If the new Vercel project uses a different hostname, add `https://<new-hostname>/auth/callback` to the Supabase project's **Authentication → URL Configuration → Redirect URLs**. Also set the new hostname as the Supabase Site URL only if it should be the default auth destination; otherwise keep the existing Site URL and add this hostname as an allowed redirect.

## Database setup

Apply SQL migrations from `supabase/migrations/` in filename order using the Supabase SQL editor or your approved database workflow. Review each migration before applying it. Seed/training operations are explicit, admin-only actions and are not run automatically when the application starts. Do not reset data outside the documented, manifest-tracked seed scope.

## Quality checks

```bash
npm run typecheck
npm run lint
npm run build
git diff --check
```

These are repository checks, not a substitute for authenticated browser UAT, database/RLS verification, or a measured production performance run. Verify branch access, role boundaries, and stock transaction behavior in the configured Supabase project before relying on live data.

## Performance notes

Movement history is the only workflow intended to read longer-range raw movement records. Dashboard, Inventory, Reports, and AI Insights should use bounded raw reads and database aggregates for recent demand and trends. Tables use page-level vertical scrolling and retain only internal horizontal scrolling when their columns exceed the viewport width.
