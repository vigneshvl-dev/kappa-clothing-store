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

    for item in select * from jsonb_array_elements(p_items) loop
        v_prod_id := (item->>'id')::uuid;
        v_qty := coalesce((item->>'qty')::integer, (item->>'quantity')::integer, 1);
        v_size := nullif(trim(coalesce(item->>'size', '')), '');
        v_color := nullif(trim(coalesce(item->>'color', '')), '');

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
