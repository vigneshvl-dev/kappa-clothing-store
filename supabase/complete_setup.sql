-- =============================================================================
-- KAPPA CLOTHING STORE — MASTER ALL-IN-ONE SUPABASE SQL SETUP SCRIPT
-- Copy and run this ENTIRE script in your Supabase SQL Editor
-- =============================================================================

-- =============================================================================
-- 1. SCHEMA MIGRATIONS: ORDER STAGES, DELIVERY, REFUND & TRACKING COLUMNS
-- =============================================================================
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_stage text DEFAULT 'incoming';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS stage_history jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_details jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_method text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS items jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS refund_details jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cancellation_reason text;

-- Backfill legacy orders with matching initial order_stage if missing
UPDATE public.orders
SET order_stage = CASE 
    WHEN LOWER(status) LIKE '%cancel%' THEN 'cancelled'
    WHEN LOWER(status) LIKE '%deliver%' THEN 'delivered'
    WHEN LOWER(status) LIKE '%return%' THEN 'returned'
    WHEN LOWER(status) = 'paid' THEN 'confirmed'
    ELSE 'incoming'
END
WHERE order_stage IS NULL OR order_stage = '';


-- =============================================================================
-- 2. ROW LEVEL SECURITY (RLS) POLICIES FOR CUSTOMERS & ORDERS
-- =============================================================================
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own orders (by user_id, email, or admin role)
DROP POLICY IF EXISTS "Users can view their own orders" ON public.orders;
CREATE POLICY "Users can view their own orders" ON public.orders
    FOR SELECT USING (
        auth.uid() = user_id 
        OR (customer_details->>'email' IS NOT NULL AND customer_details->>'email' = auth.jwt()->>'email')
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Allow users to cancel/update their own orders
DROP POLICY IF EXISTS "Users can cancel their own orders" ON public.orders;
CREATE POLICY "Users can cancel their own orders" ON public.orders
    FOR UPDATE USING (
        auth.uid() = user_id 
        OR (customer_details->>'email' IS NOT NULL AND customer_details->>'email' = auth.jwt()->>'email')
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );


-- =============================================================================
-- 3. SEED DEFAULT ROOT & SUB-CATEGORIES (Safe - Skips duplicates)
-- =============================================================================
DO $$
DECLARE
    v_men_id uuid;
    v_women_id uuid;
    v_unisex_id uuid;
    v_kids_id uuid;
BEGIN
    -- 1. Root Categories
    INSERT INTO public.categories (name, slug, parent_id)
    VALUES ('Men', 'men', NULL)
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_men_id;

    INSERT INTO public.categories (name, slug, parent_id)
    VALUES ('Women', 'women', NULL)
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_women_id;

    INSERT INTO public.categories (name, slug, parent_id)
    VALUES ('Unisex', 'unisex', NULL)
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_unisex_id;

    INSERT INTO public.categories (name, slug, parent_id)
    VALUES ('Kids', 'kids', NULL)
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_kids_id;

    -- 2. Men Subcategories
    INSERT INTO public.categories (name, slug, parent_id) VALUES
        ('T-Shirts', 'men-t-shirts', v_men_id),
        ('Shirts', 'men-shirts', v_men_id),
        ('Pants', 'men-pants', v_men_id),
        ('Jeans', 'men-jeans', v_men_id),
        ('Trousers', 'men-trousers', v_men_id),
        ('Shorts', 'men-shorts', v_men_id),
        ('Hoodies', 'men-hoodies', v_men_id),
        ('Jackets', 'men-jackets', v_men_id)
    ON CONFLICT (slug) DO NOTHING;

    -- 3. Women Subcategories
    INSERT INTO public.categories (name, slug, parent_id) VALUES
        ('Tops', 'women-tops', v_women_id),
        ('Dresses', 'women-dresses', v_women_id),
        ('T-Shirts', 'women-t-shirts', v_women_id),
        ('Shirts', 'women-shirts', v_women_id),
        ('Jeans', 'women-jeans', v_women_id),
        ('Trousers', 'women-trousers', v_women_id),
        ('Skirts', 'women-skirts', v_women_id),
        ('Hoodies', 'women-hoodies', v_women_id)
    ON CONFLICT (slug) DO NOTHING;
END $$;


-- =============================================================================
-- 4. FAST JSON STORED PROCEDURE: GET ALL MY ORDERS (For My Orders Page)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_my_orders()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_user_email text := auth.jwt()->>'email';
    v_orders json;
BEGIN
    SELECT COALESCE(json_agg(ord_row), '[]'::json)
    INTO v_orders
    FROM (
        SELECT 
            o.id AS order_id,
            o.created_at,
            o.status,
            COALESCE(o.order_stage, 'incoming') AS order_stage,
            o.total_amount,
            o.payment_method,
            o.shipping_address,
            o.customer_details,
            o.delivery_details,
            o.cancellation_reason,
            o.refund_details,
            o.stage_history,
            CASE 
                WHEN o.items IS NOT NULL AND jsonb_array_length(o.items) > 0 THEN o.items
                ELSE COALESCE(
                    (
                        SELECT jsonb_agg(
                            jsonb_build_object(
                                'id', oi.product_id,
                                'name', COALESCE(p.name, 'Kappa Apparel'),
                                'price', COALESCE(oi.price_at_purchase, oi.price, p.price, 0),
                                'qty', COALESCE(oi.quantity, 1),
                                'size', COALESCE(oi.size, ''),
                                'color', COALESCE(oi.color, ''),
                                'img', COALESCE(
                                    (SELECT url FROM public.product_images WHERE product_id = p.id ORDER BY position ASC LIMIT 1),
                                    'assets/Frame 1.jpg'
                                )
                            )
                        )
                        FROM public.order_items oi
                        LEFT JOIN public.products p ON oi.product_id = p.id
                        WHERE oi.order_id = o.id
                    ),
                    '[]'::jsonb
                )
            END AS items
        FROM public.orders o
        WHERE 
            (v_user_id IS NOT NULL AND o.user_id = v_user_id)
            OR (v_user_email IS NOT NULL AND o.customer_details->>'email' = v_user_email)
        ORDER BY o.created_at DESC
    ) ord_row;

    RETURN v_orders;
END;
$$;


-- =============================================================================
-- 5. USEFUL INSPECTION QUERIES (Run anytime in SQL Editor)
-- =============================================================================

-- ── 5A. VIEW RECENT ORDERS WITH TRACKING & DELIVERY DETAILS ──────────────────
SELECT
    o.id                                           AS order_id,
    o.created_at,
    o.status,
    COALESCE(o.order_stage, 'incoming')            AS order_stage,
    o.total_amount,
    o.customer_details->>'name'                    AS customer_name,
    o.customer_details->>'phone'                   AS customer_phone,
    o.delivery_details->>'partner'                 AS delivery_partner,
    o.delivery_details->>'tracking_id'             AS tracking_id,
    o.delivery_details->>'eta_days'                AS eta_message,
    o.delivery_details->>'expected_delivery'       AS expected_delivery_date
FROM public.orders o
ORDER BY o.created_at DESC
LIMIT 10;


-- ── 5B. VIEW CANCELLED ORDERS & REPAYMENT / REFUND STATUS ────────────────────
SELECT
    o.id                                           AS order_id,
    o.created_at,
    o.total_amount,
    o.customer_details->>'name'                    AS customer_name,
    o.customer_details->>'phone'                   AS phone,
    COALESCE(o.refund_details->>'reason', o.cancellation_reason, 'Customer cancelled') AS cancellation_reason,
    COALESCE(o.refund_details->>'refund_status', 'pending') AS refund_status,
    o.refund_details->>'method'                    AS refund_method,
    o.refund_details->>'upi_id'                    AS customer_upi_id,
    o.refund_details->>'account_number'            AS bank_account_no,
    o.refund_details->>'ifsc'                      AS bank_ifsc_code,
    o.refund_details->>'refund_ref'                AS transaction_utr_ref
FROM public.orders o
WHERE LOWER(o.status) LIKE '%cancel%' 
   OR LOWER(COALESCE(o.order_stage, '')) IN ('cancelled', 'refunded')
ORDER BY o.created_at DESC;


-- ── 5C. VIEW CATEGORY HIERARCHY WITH PRODUCT COUNTS ──────────────────────────
SELECT
    COALESCE(p.name, '— (Root Category)')       AS parent_category,
    c.id                                        AS category_id,
    c.name                                      AS category_name,
    c.slug                                      AS category_slug,
    COUNT(prod.id)                              AS total_products,
    COALESCE(SUM(prod.stock_quantity), 0)       AS total_stock_in_category
FROM public.categories c
LEFT JOIN public.categories p ON c.parent_id = p.id
LEFT JOIN public.products prod ON prod.category_id = c.id
GROUP BY p.name, c.id, c.name, c.slug
ORDER BY COALESCE(p.name, c.name), c.parent_id NULLS FIRST, c.name;
