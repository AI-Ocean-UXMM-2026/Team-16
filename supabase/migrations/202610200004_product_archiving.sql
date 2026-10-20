alter table public.products add column if not exists archived_at timestamptz;
create index if not exists products_active_warehouse_idx on public.products(warehouse_id, created_at desc) where archived_at is null;
