-- ==========================================================
-- KAPPA CLOTHING STORE: Secure Stock Deduction Function
-- Run this script in the Supabase Dashboard SQL Editor.
-- ==========================================================

create or replace function public.deduct_product_stock(p_items jsonb)
returns jsonb
language plpgsql
security definer -- Runs with elevated privileges to safely bypass RLS
set search_path = public
as $$
declare
    item jsonb;
    v_raw_id text;
    v_prod_id uuid;
    v_qty integer;
    v_size text;
    v_color text;
    v_variant_id uuid;
    v_current_stock integer;
    v_updated_count integer := 0;
begin
    if p_items is null or jsonb_array_length(p_items) = 0 then
        return jsonb_build_object('success', false, 'message', 'No items provided');
    end if;

    -- 2. Loop through each purchased item in the cart
    for item in select * from jsonb_array_elements(p_items) loop
        v_raw_id := coalesce(nullif(item->>'id', ''), nullif(item->>'product_id', ''), '');
        v_qty := coalesce(nullif(item->>'qty', ''), nullif(item->>'quantity', ''), '1')::integer;
        v_size := nullif(trim(coalesce(item->>'size', '')), '');
        v_color := nullif(trim(coalesce(item->>'color', '')), '');
        v_prod_id := null;

        if v_raw_id = '' then
            continue;
        end if;

        -- Check if it's a valid UUID
        if v_raw_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
            v_prod_id := v_raw_id::uuid;
        else
            -- If not a UUID, find product by slug
            select id into v_prod_id from public.products where slug = v_raw_id limit 1;
        end if;

        if v_prod_id is null then
            continue;
        end if;

        if v_size = 'Default' or v_size = 'N/A' then
            v_size := null;
        end if;
        if v_color = 'Default' or v_color = 'N/A' then
            v_color := null;
        end if;

        -- 1. Deduct variant stock if size is specified
        if v_size is not null then
            -- Try matching size and color first
            if v_color is not null then
                update public.product_variants
                set stock_quantity = greatest(0, coalesce(stock_quantity, 0) - v_qty)
                where product_id = v_prod_id
                  and lower(trim(size)) = lower(v_size)
                  and lower(trim(color)) = lower(v_color);
            end if;

            -- Fallback or update if size-only match
            if not found then
                update public.product_variants
                set stock_quantity = greatest(0, coalesce(stock_quantity, 0) - v_qty)
                where product_id = v_prod_id
                  and lower(trim(size)) = lower(v_size);
            end if;
        end if;

        -- 2. Deduct main product stock
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

-- Grant execution permissions to public and authenticated users
grant execute on function public.deduct_product_stock(jsonb) to anon, authenticated, service_role;

-- ==========================================================
-- IMMEDIATE VERIFICATION: Tests the function with an actual product
-- ==========================================================
select public.deduct_product_stock(
    jsonb_build_array(
        jsonb_build_object(
            'id', (select id::text from public.products limit 1),
            'qty', 1,
            'size', 'M'
        )
    )
) as test_result;
