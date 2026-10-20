# OceanBlue

OceanBlue is a risk-first inventory assistant for SME food warehouses.

## Run locally

```bash
npm install
npm run dev
```

## Connect Supabase

1. In Supabase SQL Editor, apply [the inventory migration](./supabase/migrations/202610200001_oceanblue_inventory.sql), or run `supabase db push` after linking the project locally.
2. In **Authentication → URL Configuration**, add `http://localhost:3000/auth/callback` and the deployed `https://<your-domain>/auth/callback` URL.
3. Start the app and create an account at `/login`. The migration creates one `My warehouse` membership for the new user.
4. Add products and food batches with your own data in the Supabase Table Editor before recording movements. The on-screen sample dataset is development-only and visibly labeled.

## Environment

Copy `.env.example` to `.env.local` and set the values already described there. `OPENAI_API_KEY` is server-only. Never expose an OpenAI key or Supabase secret/service-role key in browser code.

## Checks

```bash
npm run typecheck
npm run lint
npm run build
```
