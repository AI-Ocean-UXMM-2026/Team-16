-- Balance the Yangon training network with visible, auditable risk examples.
-- All stock changes go through record_stock_movement and only tracked branches
-- in the recognized nine-branch manifest are eligible.
create or replace function public.rebalance_yangon_training_scenarios()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  branch_row record;
  product_row record;
  expiry_product record;
  tracked_count integer;
  recognized_count integer;
  target_quantity integer;
  target_batch_id uuid;
  added_restock integer := 0;
  added_stock_out integer := 0;
  added_stock_in integer := 0;
  batch_number text;
  expiry_day date;
begin
  if auth.uid() is null then raise exception 'Authentication is required'; end if;
  if not public.is_system_admin() then raise exception 'Only a System Admin can balance training scenarios'; end if;

  perform pg_advisory_xact_lock(hashtext('oceanblue-yangon-training-scenarios'));

  select count(*) into tracked_count from public.demo_seed_runs;
  select count(*) into recognized_count
  from public.demo_seed_runs r
  join public.warehouses w on w.id = r.warehouse_id
  where w.name in (
    'OceanBlue Main Warehouse', 'Yangon Downtown Convenience Store',
    'Sanchaung Convenience Store', 'Bahan Convenience Store',
    'Kamayut Convenience Store', 'Thingangyun Convenience Store',
    'Hlaing Convenience Store', 'Tamwe Convenience Store',
    'North Dagon Convenience Store'
  );
  if tracked_count <> 9 or recognized_count <> 9 then
    raise exception 'The training seed manifest is not the recognized Yangon network; no inventory was changed';
  end if;

  for branch_row in
    select r.warehouse_id
    from public.demo_seed_runs r
    join public.warehouses w on w.id = r.warehouse_id
    where w.name in (
      'OceanBlue Main Warehouse', 'Yangon Downtown Convenience Store',
      'Sanchaung Convenience Store', 'Bahan Convenience Store',
      'Kamayut Convenience Store', 'Thingangyun Convenience Store',
      'Hlaing Convenience Store', 'Tamwe Convenience Store',
      'North Dagon Convenience Store'
    )
    order by w.name
  loop
    for product_row in
      with product_stock as (
        select p.id as product_id,
          sum(b.quantity)::numeric as available,
          coalesce(max(o.outbound_units), 0)::numeric as outbound_units,
          coalesce(max(o.outbound_count), 0)::integer as outbound_count
        from public.products p
        join public.product_batches b on b.product_id = p.id and b.quantity > 0
        left join lateral (
          select sum(m.quantity) as outbound_units, count(*) as outbound_count
          from public.stock_movements m
          where m.warehouse_id = branch_row.warehouse_id
            and m.product_id = p.id
            and m.movement_type = 'out'
            and m.created_at >= now() - interval '30 days'
        ) o on true
        where p.warehouse_id = branch_row.warehouse_id
          and p.archived_at is null
          and not exists (
            select 1 from public.stock_movements marked
            where marked.warehouse_id = branch_row.warehouse_id
              and marked.product_id = p.id
              and marked.reason = 'High recent sales and limited on-hand stock'
          )
          and not exists (
            select 1 from public.product_batches expiring
            where expiring.product_id = p.id
              and expiring.quantity > 0
              and expiring.expiry_date <= current_date + 30
          )
        group by p.id
      )
      select product_id, available, outbound_units
      from product_stock
      where outbound_count >= 2 and outbound_units > 0
      order by product_id
    loop
      target_quantity := greatest(1, ceil(product_row.outbound_units * 14 / 30)::integer);
      if product_row.available >= target_quantity then continue; end if;

      select b.id into target_batch_id
      from public.product_batches b
      where b.product_id = product_row.product_id
        and b.quantity > 0
        and b.expiry_date > current_date + 30
      order by b.quantity desc, b.expiry_date desc
      limit 1
      for update;
      if target_batch_id is null then continue; end if;

      perform public.record_stock_movement(
        branch_row.warehouse_id, product_row.product_id, 'in', target_quantity - product_row.available,
        target_batch_id, null, null, 'Replenished to fourteen days of projected demand'
      );
      added_restock := added_restock + 1;
      target_batch_id := null;
    end loop;

    if not exists (
      select 1 from public.stock_movements marked
      where marked.warehouse_id = branch_row.warehouse_id
        and marked.reason = 'High recent sales and limited on-hand stock'
    ) then
      for product_row in
        with product_stock as (
          select p.id as product_id, p.sku, p.category,
            sum(b.quantity)::numeric as available,
            coalesce(max(o.outbound_units), 0)::numeric as outbound_units,
            coalesce(max(o.outbound_count), 0)::integer as outbound_count
          from public.products p
          join public.product_batches b on b.product_id = p.id and b.quantity > 0
          left join lateral (
            select sum(m.quantity) as outbound_units, count(*) as outbound_count
            from public.stock_movements m
            where m.warehouse_id = branch_row.warehouse_id
              and m.product_id = p.id
              and m.movement_type = 'out'
              and m.created_at >= now() - interval '30 days'
          ) o on true
          where p.warehouse_id = branch_row.warehouse_id
            and p.archived_at is null
            and not exists (
              select 1 from public.product_batches expiring
              where expiring.product_id = p.id
                and expiring.quantity > 0
                and expiring.expiry_date <= current_date + 5
            )
          group by p.id, p.sku, p.category
        ), ranked as (
          select *, row_number() over (partition by category order by sku) as category_rank
          from product_stock
          where outbound_count >= 2 and available > 1
        )
        select product_id, available, outbound_units
        from ranked
        where category_rank <= 3
        order by category, product_id
      loop
        target_quantity := greatest(1, ceil((product_row.available * 30 - product_row.outbound_units * 3) / 33)::integer);
        if target_quantity >= product_row.available then continue; end if;

        select b.id into target_batch_id
        from public.product_batches b
        where b.product_id = product_row.product_id
          and b.quantity >= target_quantity
        order by b.quantity desc, b.expiry_date asc nulls last
        limit 1
        for update;
        if target_batch_id is null then continue; end if;

        perform public.record_stock_movement(
          branch_row.warehouse_id, product_row.product_id, 'out', target_quantity,
          target_batch_id, null, null, 'High recent sales and limited on-hand stock'
        );
        added_stock_out := added_stock_out + 1;
        target_batch_id := null;
      end loop;
    end if;

    if not exists (
      select 1
      from public.products p
      join public.product_batches b on b.product_id = p.id
      where p.warehouse_id = branch_row.warehouse_id
        and left(b.batch_number, 8) = 'YGN-EXP-'
    ) then
      for expiry_product in
        with candidates as (
          select p.id as product_id, p.sku, p.category,
            row_number() over (partition by p.category order by p.sku) as category_rank
          from public.products p
          where p.warehouse_id = branch_row.warehouse_id
            and p.archived_at is null
            and p.category in ('Bakery', 'Dairy')
        )
        select product_id, sku, category_rank
        from candidates
        where category_rank <= 3
        order by category, sku
        limit 5
      loop
        batch_number := 'YGN-EXP-' || expiry_product.sku;
        expiry_day := current_date + case when expiry_product.category_rank % 2 = 0 then 1 else 2 end;
        perform public.record_stock_movement(
          branch_row.warehouse_id, expiry_product.product_id, 'in', 6,
          null, batch_number, expiry_day, 'Upcoming expiry rotation example'
        );
        added_stock_in := added_stock_in + 1;
      end loop;
    end if;

    update public.demo_seed_runs r
    set batches_created = (select count(*) from public.product_batches b join public.products p on p.id = b.product_id where p.warehouse_id = r.warehouse_id),
        movements_created = (select count(*) from public.stock_movements m where m.warehouse_id = r.warehouse_id)
    where r.warehouse_id = branch_row.warehouse_id;
  end loop;

  return jsonb_build_object(
    'branches', 9,
    'restocked_products', added_restock,
    'low_stock_products', added_stock_out,
    'expiring_batches', added_stock_in,
    'movements_added', added_restock + added_stock_out + added_stock_in
  );
end;
$$;

revoke all on function public.rebalance_yangon_training_scenarios() from public, anon;
grant execute on function public.rebalance_yangon_training_scenarios() to authenticated;
