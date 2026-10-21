-- Add a clearly labeled, repeat-safe BreadTalk training network with reconciled
-- batch and movement history. This migration creates the loader only; it does
-- not insert demo records automatically.
create table if not exists public.demo_seed_runs (
  warehouse_id uuid primary key references public.warehouses(id) on delete cascade,
  seeded_by uuid not null references auth.users(id) on delete restrict,
  history_start date not null,
  products_created integer not null,
  batches_created integer not null,
  movements_created integer not null,
  created_at timestamptz not null default now()
);
alter table public.demo_seed_runs enable row level security;
revoke all on public.demo_seed_runs from public, anon, authenticated;
grant all on public.demo_seed_runs to service_role;

create or replace function public.seed_breadtalk_history()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  item record;
  branch record;
  product_id uuid;
  batch_id uuid;
  warehouse_id uuid;
  month_start date;
  history_start date := date_trunc('month', current_date - interval '59 months')::date;
  month_index integer;
  product_index integer;
  monthly_demand numeric(12,2);
  monthly_out numeric(12,2);
  on_hand numeric(12,2);
  out_1 numeric(12,2);
  out_2 numeric(12,2);
  out_3 numeric(12,2);
  out_4 numeric(12,2);
  inbound_total numeric(12,2);
  products_count integer := 0;
  batches_count integer := 0;
  movements_count integer := 0;
  seeded_branches integer := 0;
begin
  if auth.uid() is null then raise exception 'Authentication is required'; end if;
  if not public.is_system_admin() then raise exception 'Only a System Admin can load historical demo data'; end if;

  if (select count(*) from public.demo_seed_runs r join public.warehouses w on w.id = r.warehouse_id
      where w.name like 'BreadTalk Demo %') = 3 then
    return jsonb_build_object('seeded', false, 'already_seeded', true, 'warehouses', 3,
      'products', (select coalesce(sum(products_created), 0) from public.demo_seed_runs r join public.warehouses w on w.id = r.warehouse_id where w.name like 'BreadTalk Demo %'),
      'batches', (select coalesce(sum(batches_created), 0) from public.demo_seed_runs r join public.warehouses w on w.id = r.warehouse_id where w.name like 'BreadTalk Demo %'),
      'movements', (select coalesce(sum(movements_created), 0) from public.demo_seed_runs r join public.warehouses w on w.id = r.warehouse_id where w.name like 'BreadTalk Demo %'));
  end if;

  if exists (select 1 from public.warehouses where name in (
      'BreadTalk Demo — Central Kitchen', 'BreadTalk Demo — Junction 8', 'BreadTalk Demo — Airport Hub')
      and id not in (select warehouse_id from public.demo_seed_runs)) then
    raise exception 'A BreadTalk Demo branch already exists without a seed manifest; no existing catalog was changed';
  end if;

  for branch in select * from (values
    ('BreadTalk Demo — Central Kitchen'),
    ('BreadTalk Demo — Junction 8'),
    ('BreadTalk Demo — Airport Hub')
  ) as branches(name) loop
    insert into public.warehouses(name) values (branch.name) returning id into warehouse_id;
    product_index := 0;

    for item in select * from (values
      ('Classic white loaf','Fresh bread',180,0.08,4),
      ('Whole wheat sandwich loaf','Fresh bread',95,0.11,5),
      ('Multigrain sandwich loaf','Fresh bread',62,0.16,5),
      ('Sourdough boule','Fresh bread',54,0.08,4),
      ('Country rye loaf','Fresh bread',34,0.20,4),
      ('Baguette','Fresh bread',110,0.07,2),
      ('Ciabatta roll','Fresh bread',74,0.14,3),
      ('Milk bread','Fresh bread',88,0.11,3),
      ('Brioche loaf','Fresh bread',43,0.18,4),
      ('Dinner rolls','Fresh bread',130,0.09,3),
      ('Hot dog buns','Fresh bread',76,0.12,4),
      ('Burger buns','Fresh bread',92,0.08,4),
      ('Pita bread','Fresh bread',39,0.25,5),
      ('Focaccia slab','Fresh bread',27,0.30,3),
      ('Cinnamon raisin loaf','Fresh bread',36,0.17,4),
      ('Seeded batard','Fresh bread',31,0.22,4),
      ('Garlic bread','Fresh bread',48,0.15,5),
      ('English muffins','Fresh bread',59,0.13,5),
      ('Crumpets','Fresh bread',28,0.28,5),
      ('Butter croissant','Pastries',96,0.06,2),
      ('Chocolate croissant','Pastries',67,0.12,2),
      ('Almond croissant','Pastries',35,0.19,2),
      ('Cinnamon roll','Pastries',58,0.09,2),
      ('Chocolate bun','Pastries',72,0.13,3),
      ('Custard bun','Pastries',44,0.20,2),
      ('Cheese danish','Pastries',41,0.08,2),
      ('Apple turnover','Pastries',38,0.24,2),
      ('Blueberry muffin','Pastries',52,0.10,3),
      ('Banana muffin','Pastries',46,0.16,3),
      ('Butter scone','Pastries',33,0.25,3),
      ('Pineapple bun','Pastries',84,0.07,2),
      ('Pandan roll','Pastries',29,0.33,2),
      ('Fresh whole milk 1 L','Dairy',52,0.09,6),
      ('Low-fat milk 1 L','Dairy',34,0.18,7),
      ('Unsalted butter 250 g','Dairy',28,0.32,20),
      ('Cheddar cheese 200 g','Dairy',24,0.25,25),
      ('Greek yogurt 150 g','Dairy',31,0.15,8),
      ('Whipping cream 500 ml','Dairy',18,0.28,7),
      ('Frozen puff pastry','Frozen',22,0.45,180),
      ('Frozen croissant dough','Frozen',18,0.52,180)
    ) as catalog(name, category, demand, stock_factor, shelf_days) loop
      product_index := product_index + 1;
      insert into public.products(warehouse_id, name, sku, category, created_at)
        values (warehouse_id, item.name, 'BT-HIST-' || lpad(product_index::text, 3, '0'), item.category, history_start::timestamptz)
        returning id into product_id;
      insert into public.product_categories(name) values (item.category) on conflict do nothing;
      products_count := products_count + 1;
      month_index := 0;

      for month_start in select generated_month::date from generate_series(
        history_start::timestamp, date_trunc('month', current_date)::timestamp, interval '1 month'
      ) as months(generated_month) loop
        monthly_demand := round(item.demand * (1 + (((month_index + product_index * 3) % 9) - 4) * 0.035), 2);
        insert into public.product_batches(product_id, batch_number, quantity, expiry_date, created_at)
          values (product_id, 'H' || to_char(month_start, 'YYMM'),
            case when month_start = date_trunc('month', current_date)::date
              then greatest(1, round(item.demand * item.stock_factor)) else 0 end,
            case when month_start = date_trunc('month', current_date)::date
              then current_date + case when item.category in ('Fresh bread','Pastries') then (product_index % 5) + 1 else item.shelf_days end
              else month_start + item.shelf_days end,
            month_start::timestamptz + interval '1 day') returning id into batch_id;
        batches_count := batches_count + 1;

        if month_start < date_trunc('month', current_date)::date then
          insert into public.stock_movements(warehouse_id, product_id, batch_id, movement_type, quantity, reason, created_by, created_at)
            values
              (warehouse_id, product_id, batch_id, 'in', monthly_demand, 'Scheduled bakery production', auth.uid(), month_start::timestamptz + interval '2 days 8 hours'),
              (warehouse_id, product_id, batch_id, 'out', monthly_demand, case when month_index % 3 = 0 then 'Retail and cafe sales' else 'Store replenishment and sales' end, auth.uid(), month_start::timestamptz + interval '6 days 14 hours');
          movements_count := movements_count + 2;
        else
          on_hand := greatest(1, round(item.demand * item.stock_factor));
          out_1 := round(item.demand * 0.18, 2);
          out_2 := round(item.demand * 0.19, 2);
          out_3 := round(item.demand * 0.17, 2);
          out_4 := round(item.demand * 0.21, 2);
          monthly_out := out_1 + out_2 + out_3 + out_4;
          inbound_total := on_hand + monthly_out;
          insert into public.stock_movements(warehouse_id, product_id, batch_id, movement_type, quantity, reason, created_by, created_at)
            values (warehouse_id, product_id, batch_id, 'in', inbound_total, 'Current month production receipt', auth.uid(), (current_date - 30)::timestamptz + interval '8 hours'),
              (warehouse_id, product_id, batch_id, 'out', out_1, 'Morning retail sales', auth.uid(), (current_date - 28)::timestamptz + interval '10 hours'),
              (warehouse_id, product_id, batch_id, 'out', out_2, 'Cafe and wholesale dispatch', auth.uid(), (current_date - 21)::timestamptz + interval '11 hours'),
              (warehouse_id, product_id, batch_id, 'out', out_3, 'Afternoon retail sales', auth.uid(), (current_date - 14)::timestamptz + interval '15 hours'),
              (warehouse_id, product_id, batch_id, 'out', out_4, 'Morning retail sales', auth.uid(), (current_date - 7)::timestamptz + interval '10 hours');
          movements_count := movements_count + 5;
        end if;
        month_index := month_index + 1;
      end loop;
    end loop;

    insert into public.demo_seed_runs(warehouse_id, seeded_by, history_start, products_created, batches_created, movements_created)
      values (warehouse_id, auth.uid(), history_start, product_index, product_index * month_index, product_index * (month_index - 1) * 2 + product_index * 5);
    seeded_branches := seeded_branches + 1;
  end loop;

  return jsonb_build_object('seeded', true, 'warehouses', seeded_branches,
    'products', products_count, 'batches', batches_count, 'movements', movements_count,
    'history_start', history_start, 'history_end', current_date);
end;
$$;
revoke all on function public.seed_breadtalk_history() from public;
grant execute on function public.seed_breadtalk_history() to authenticated;
