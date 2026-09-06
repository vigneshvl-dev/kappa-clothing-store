-- ==========================================================
-- KAPPA CLOTHING STORE: Complete Stock Reduction System & Fix
-- 1. Deducts the 2 already purchased units of Macsivo Kurta right now
-- 2. Creates the deduct_product_stock() function
-- 3. Creates an AUTOMATIC DATABASE TRIGGER on orders table
--    (Guarantees stock reduces whenever an order is paid)
-- 4. Displays the updated stock so you can immediately verify
-- ==========================================================

-- STEP 1: Deduct the 2 purchased units of Macsivo Kurta right now
do $$
declare
    v_prod_id uuid;
begin
    select id into v_prod_id
    from public.products
    where name ilike '%Macsivo%'
    limit 1;

    if v_prod_id is not null then
        -- Deduct 2 from variant (Size: S, Color: Green)
        update public.product_variants
        set stock_quantity = greatest(0, coalesce(stock_quantity, 0) - 2)
        where product_id = v_prod_id
          and lower(trim(size)) = 's';

        -- Deduct 2 from main product stock
        update public.products
        set stock_quantity = greatest(0, coalesce(stock_quantity, 0) - 2)
        where id = v_prod_id;
    end if;
end $$;

-- STEP 2: Create the RPC function deduct_product_stock
create or replace function public.deduct_product_stock(p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    item jsonb;
    v_raw_id text;
    v_prod_id uuid;
    v_qty integer;
    v_size text;
    v_color text;
    v_updated_count integer := 0;
begin
    if p_items is null or jsonb_array_length(p_items) = 0 then
        return jsonb_build_object('success', false, 'message', 'No items provided');
    end if;

    for item in select * from jsonb_array_elements(p_items) loop
        v_raw_id := coalesce(nullif(item->>'id', ''), nullif(item->>'product_id', ''), '');
        v_qty := coalesce(nullif(item->>'qty', ''), nullif(item->>'quantity', ''), '1')::integer;
        v_size := nullif(trim(coalesce(item->>'size', '')), '');
        v_color := nullif(trim(coalesce(item->>'color', '')), '');
        v_prod_id := null;

        if v_raw_id = '' then
            continue;
        end if;

        if v_raw_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
            v_prod_id := v_raw_id::uuid;
        else
            select id into v_prod_id from public.products where slug = v_raw_id limit 1;
        end if;

        if v_prod_id is null then
            continue;
        end if;

        if v_size = 'Default' or v_size = 'N/A' then v_size := null; end if;
        if v_color = 'Default' or v_color = 'N/A' then v_color := null; end if;

        -- Deduct variant stock
        if v_size is not null then
            if v_color is not null then
                update public.product_variants
                set stock_quantity = greatest(0, coalesce(stock_quantity, 0) - v_qty)
                where product_id = v_prod_id
                  and lower(trim(size)) = lower(v_size)
                  and lower(trim(color)) = lower(v_color);
            end if;

            if not found then
                update public.product_variants
                set stock_quantity = greatest(0, coalesce(stock_quantity, 0) - v_qty)
                where product_id = v_prod_id
                  and lower(trim(size)) = lower(v_size);
            end if;
        end if;

        -- Deduct main product stock
        update public.products
        set stock_quantity = greatest(0, coalesce(stock_quantity, 0) - v_qty)
        where id = v_prod_id;

        v_updated_count := v_updated_count + 1;
    end loop;

    return jsonb_build_object(
        'success', true,
        'updated_items', v_updated_count,
        'message', 'Stock deducted successfully'
    );
exception
    when others then
        return jsonb_build_object(
            'success', false,
            'error', SQLERRM
        );
end;
$$;

grant execute on function public.deduct_product_stock(jsonb) to anon, authenticated, service_role;

-- STEP 3: Create Automatic Database Trigger on Orders
-- Automatically deducts stock whenever an order is marked 'paid' or placed
create or replace function public.trigger_deduct_stock_on_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_item record;
begin
    if (TG_OP = 'INSERT' and lower(new.status) = 'paid') or
       (TG_OP = 'UPDATE' and lower(new.status) = 'paid' and (old.status is distinct from new.status)) then
        
        for v_item in
            select product_id, quantity, size, color
            from public.order_items
            where order_id = new.id
        loop
            -- 1. Deduct variant stock
            if v_item.size is not null and v_item.size not in ('Default', 'N/A', '') then
                if v_item.color is not null and v_item.color not in ('Default', 'N/A', '') then
                    update public.product_variants
                    set stock_quantity = greatest(0, coalesce(stock_quantity, 0) - coalesce(v_item.quantity, 1))
                    where product_id = v_item.product_id
                      and lower(trim(size)) = lower(trim(v_item.size))
                      and lower(trim(color)) = lower(trim(v_item.color));
                end if;

                if not found then
                    update public.product_variants
                    set stock_quantity = greatest(0, coalesce(stock_quantity, 0) - coalesce(v_item.quantity, 1))
                    where product_id = v_item.product_id
                      and lower(trim(size)) = lower(trim(v_item.size));
                end if;
            end if;

            -- 2. Deduct product stock
            update public.products
            set stock_quantity = greatest(0, coalesce(stock_quantity, 0) - coalesce(v_item.quantity, 1))
            where id = v_item.product_id;
        end loop;

    end if;
    return new;
end;
$$;

drop trigger if exists trg_deduct_stock_on_order on public.orders;
create trigger trg_deduct_stock_on_order
after insert or update on public.orders
for each row
execute function public.trigger_deduct_stock_on_order();

-- STEP 4: Verification - Show the updated stock right now
select 
    p.name as product_name,
    p.stock_quantity as product_total_stock,
    pv.size as variant_size,
    pv.color as variant_color,
    pv.stock_quantity as variant_stock
from public.products p
left join public.product_variants pv on pv.product_id = p.id
where p.name ilike '%Macsivo%';

-- 5. Optional: add dedicated refund_details column to orders table
alter table if exists public.orders
add column if not exists refund_details jsonb;

