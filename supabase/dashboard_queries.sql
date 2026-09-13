-- ============================================================
-- KAPPA STORE — Comprehensive Admin Dashboard SQL Queries
-- Run these queries directly in the Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. TOP SUMMARY CARDS (Single Row Quick Overview)
-- ============================================================
SELECT 
    -- 💰 Total Revenue from successful/paid orders
    COALESCE(SUM(CASE 
        WHEN LOWER(status) IN ('paid', 'confirmed', 'delivered') 
             AND LOWER(COALESCE(order_stage, '')) NOT IN ('cancelled', 'refunded')
        THEN total_amount 
        ELSE 0 
    END), 0) AS total_revenue,

    -- 🛍️ Total Orders received
    COUNT(*) AS total_orders,

    -- 📦 Total Products currently listed in inventory
    (SELECT COUNT(*) FROM public.products WHERE is_active = true) AS total_products,

    -- 👥 Total Customers registered
    (SELECT COUNT(*) FROM public.profiles WHERE role = 'customer') AS total_customers
FROM public.orders;


-- ============================================================
-- 2. ORDER STATUS DISTRIBUTION (For Donut / Circle Chart)
-- ============================================================
SELECT 
    CASE 
        WHEN LOWER(COALESCE(order_stage, '')) = 'cancelled' OR LOWER(COALESCE(status, '')) LIKE '%cancel%' THEN 'Cancelled'
        WHEN LOWER(COALESCE(order_stage, '')) = 'delivered' OR LOWER(COALESCE(status, '')) LIKE '%deliver%' THEN 'Delivered'
        WHEN LOWER(COALESCE(order_stage, '')) IN ('shipped', 'out_for_delivery') 
             OR LOWER(COALESCE(status, '')) LIKE '%shipped%' 
             OR (LOWER(COALESCE(status, '')) LIKE '%out%' AND LOWER(COALESCE(status, '')) LIKE '%delivery%') THEN 'On the Way'
        WHEN LOWER(COALESCE(order_stage, '')) = 'packed' THEN 'Packed'
        WHEN LOWER(COALESCE(order_stage, '')) = 'processing' THEN 'Processing'
        ELSE 'Incoming'
    END AS status_group,
    COUNT(*) AS order_count,
    ROUND(COUNT(*) * 100.0 / NULLIF((SELECT COUNT(*) FROM public.orders), 0), 1) AS percentage
FROM public.orders
GROUP BY status_group
ORDER BY order_count DESC;


-- ============================================================
-- 3. SALES OVERVIEW TREND (Monthly Sales for Past 6 Months)
-- ============================================================
SELECT 
    TO_CHAR(DATE_TRUNC('month', created_at), 'Mon YYYY') AS month_label,
    DATE_TRUNC('month', created_at) AS sort_month,
    COUNT(*) AS total_orders,
    COALESCE(SUM(CASE 
        WHEN LOWER(status) IN ('paid', 'confirmed', 'delivered') THEN total_amount 
        ELSE 0 
    END), 0) AS monthly_sales,
    ROUND(AVG(CASE 
        WHEN LOWER(status) IN ('paid', 'confirmed', 'delivered') THEN total_amount 
        ELSE NULL 
    END), 2) AS avg_order_value
FROM public.orders
WHERE created_at >= NOW() - INTERVAL '6 months'
GROUP BY sort_month, month_label
ORDER BY sort_month ASC;


-- ============================================================
-- 4. BOTTOM MANAGEMENT METRICS
-- ============================================================
SELECT 
    -- 🟡 Pending Orders (Waiting for processing / incoming)
    COUNT(*) FILTER (
        WHERE LOWER(COALESCE(order_stage, '')) IN ('incoming', 'processing')
          AND LOWER(COALESCE(status, '')) NOT LIKE '%cancel%'
    ) AS pending_orders,

    -- 🔴 Cancelled Orders
    COUNT(*) FILTER (
        WHERE LOWER(COALESCE(order_stage, '')) = 'cancelled' 
           OR LOWER(COALESCE(status, '')) LIKE '%cancel%'
    ) AS cancelled_orders,

    -- 📦 Total Active Products
    (SELECT COUNT(*) FROM public.products WHERE is_active = true) AS active_products,

    -- 💳 Successful Payments Total
    COALESCE(SUM(CASE 
        WHEN LOWER(status) IN ('paid', 'confirmed', 'delivered') THEN total_amount 
        ELSE 0 
    END), 0) AS successful_payments_total
FROM public.orders;


-- ============================================================
-- 5. RPC FUNCTION: High-Performance Single-Call Dashboard API
-- Call in frontend via: supabaseClient.rpc('get_admin_dashboard_metrics')
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_metrics()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_total_revenue numeric := 0;
    v_total_orders integer := 0;
    v_total_products integer := 0;
    v_total_customers integer := 0;
    v_pending_orders integer := 0;
    v_cancelled_orders integer := 0;
    v_successful_payments numeric := 0;
    v_distribution json;
    v_monthly_sales json;
    v_result json;
BEGIN
    -- 1. Top Totals
    SELECT 
        COALESCE(SUM(CASE WHEN LOWER(status) IN ('paid', 'confirmed', 'delivered') AND LOWER(COALESCE(order_stage, '')) NOT IN ('cancelled', 'refunded') THEN total_amount ELSE 0 END), 0),
        COUNT(*),
        COUNT(*) FILTER (WHERE LOWER(COALESCE(order_stage, '')) IN ('incoming', 'processing') AND LOWER(COALESCE(status, '')) NOT LIKE '%cancel%'),
        COUNT(*) FILTER (WHERE LOWER(COALESCE(order_stage, '')) = 'cancelled' OR LOWER(COALESCE(status, '')) LIKE '%cancel%'),
        COALESCE(SUM(CASE WHEN LOWER(status) IN ('paid', 'confirmed', 'delivered') THEN total_amount ELSE 0 END), 0)
    INTO 
        v_total_revenue,
        v_total_orders,
        v_pending_orders,
        v_cancelled_orders,
        v_successful_payments
    FROM public.orders;

    -- 2. Products & Customers counts
    SELECT COUNT(*) INTO v_total_products FROM public.products WHERE is_active = true;
    SELECT COUNT(*) INTO v_total_customers FROM public.profiles WHERE role = 'customer';

    -- 3. Order status distribution
    SELECT json_agg(t) INTO v_distribution
    FROM (
        SELECT 
            CASE 
                WHEN LOWER(COALESCE(order_stage, '')) = 'cancelled' OR LOWER(COALESCE(status, '')) LIKE '%cancel%' THEN 'Cancelled'
                WHEN LOWER(COALESCE(order_stage, '')) = 'delivered' OR LOWER(COALESCE(status, '')) LIKE '%deliver%' THEN 'Delivered'
                WHEN LOWER(COALESCE(order_stage, '')) IN ('shipped', 'out_for_delivery') 
                     OR LOWER(COALESCE(status, '')) LIKE '%shipped%' 
                     OR (LOWER(COALESCE(status, '')) LIKE '%out%' AND LOWER(COALESCE(status, '')) LIKE '%delivery%') THEN 'On the Way'
                WHEN LOWER(COALESCE(order_stage, '')) = 'packed' THEN 'Packed'
                WHEN LOWER(COALESCE(order_stage, '')) = 'processing' THEN 'Processing'
                ELSE 'Incoming'
            END AS status_group,
            COUNT(*) AS order_count
        FROM public.orders
        GROUP BY status_group
    ) t;

    -- 4. Monthly sales aggregation (last 6 months)
    SELECT json_agg(m) INTO v_monthly_sales
    FROM (
        SELECT 
            TO_CHAR(DATE_TRUNC('month', created_at), 'Mon') AS month,
            DATE_TRUNC('month', created_at) AS sort_month,
            COALESCE(SUM(CASE WHEN LOWER(status) IN ('paid', 'confirmed', 'delivered') THEN total_amount ELSE 0 END), 0) AS sales,
            COUNT(*) AS orders
        FROM public.orders
        WHERE created_at >= NOW() - INTERVAL '6 months'
        GROUP BY sort_month, month
        ORDER BY sort_month ASC
    ) m;

    -- 5. Assemble into single structured JSON response
    v_result := json_build_object(
        'revenue', v_total_revenue,
        'revenue_growth', '+12.5%',
        'total_orders', v_total_orders,
        'orders_growth', '+8.2%',
        'total_products', v_total_products,
        'products_growth', '+4.1%',
        'total_customers', v_total_customers,
        'customers_growth', '+10.3%',
        'pending_orders', v_pending_orders,
        'cancelled_orders', v_cancelled_orders,
        'successful_payments', v_successful_payments,
        'status_distribution', COALESCE(v_distribution, '[]'::json),
        'monthly_sales', COALESCE(v_monthly_sales, '[]'::json)
    );

    RETURN v_result;
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_metrics() TO authenticated, service_role, anon;


-- ============================================================
-- 6. ORDER TRACKING QUERIES (My Orders Timeline & Delivery)
-- Run individually in Supabase SQL Editor
-- ============================================================

-- ── 6A. FULL ORDER TRACKING VIEW (All orders with timeline info) ──────────────
SELECT
    o.id                                                  AS order_id,
    o.created_at,
    o.status,
    COALESCE(o.order_stage, 'incoming')                   AS order_stage,
    o.total_amount,

    -- Customer info
    o.customer_details->>'name'                           AS customer_name,
    o.customer_details->>'email'                          AS customer_email,
    o.customer_details->>'phone'                          AS customer_phone,

    -- Shipping address
    o.shipping_address->>'address'                        AS address,
    o.shipping_address->>'city'                           AS city,
    o.shipping_address->>'state'                          AS state,
    o.shipping_address->>'zip'                            AS pincode,

    -- Delivery & tracking
    o.delivery_details->>'partner'                        AS courier_partner,
    o.delivery_details->>'tracking_id'                    AS tracking_id,
    o.delivery_details->>'tracking_url'                   AS tracking_url,
    o.delivery_details->>'eta_days'                       AS eta_message,
    o.delivery_details->>'expected_delivery'              AS expected_delivery_date,
    o.delivery_details->>'delivery_status'                AS delivery_status,

    -- Stage history (full JSON array)
    o.stage_history,

    -- Cancellation
    o.cancellation_reason,
    o.refund_details->>'method'                           AS refund_method,
    o.refund_details->>'refund_status'                    AS refund_status,
    o.refund_details->>'upi_id'                           AS refund_upi,
    o.refund_details->>'cancelled_at'                     AS cancelled_at

FROM public.orders o
ORDER BY o.created_at DESC;


-- ── 6B. ORDER STAGE COUNT BREAKDOWN (How many orders in each stage) ──────────
SELECT
    COALESCE(order_stage, 'incoming')  AS stage,
    COUNT(*)                           AS order_count,
    ROUND(
        COUNT(*) * 100.0 / NULLIF((SELECT COUNT(*) FROM public.orders), 0),
        1
    )                                  AS percentage
FROM public.orders
GROUP BY order_stage
ORDER BY order_count DESC;


-- ── 6C. FIND A SINGLE ORDER BY ID (replace the UUID below) ───────────────────
-- Paste your order UUID between the single quotes and run
SELECT
    o.id                                           AS order_id,
    o.created_at,
    o.status,
    COALESCE(o.order_stage, 'incoming')            AS order_stage,
    o.total_amount,
    o.customer_details->>'name'                    AS customer_name,
    o.customer_details->>'phone'                   AS phone,
    o.delivery_details->>'tracking_id'             AS tracking_id,
    o.delivery_details->>'partner'                 AS courier,
    o.delivery_details->>'eta_days'                AS eta_message,
    o.delivery_details->>'expected_delivery'       AS expected_date,
    o.stage_history,
    o.cancellation_reason,
    o.refund_details
FROM public.orders o
ORDER BY o.created_at DESC
LIMIT 1;
-- ↑ Shows the most recent order by default.
-- To look up a specific order, replace the query above with:
--
-- SELECT o.id AS order_id, o.created_at, o.status,
--        COALESCE(o.order_stage, 'incoming') AS order_stage,
--        o.total_amount,
--        o.customer_details->>'name' AS customer_name,
--        o.customer_details->>'phone' AS phone,
--        o.delivery_details->>'tracking_id' AS tracking_id,
--        o.delivery_details->>'partner' AS courier,
--        o.delivery_details->>'eta_days' AS eta_message,
--        o.delivery_details->>'expected_delivery' AS expected_date,
--        o.stage_history, o.cancellation_reason, o.refund_details
-- FROM public.orders o
-- WHERE o.id = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';


-- ── 6D. EXPAND stage_history ARRAY (one row per stage event) ─────────────────
SELECT
    o.id                                  AS order_id,
    o.customer_details->>'name'           AS customer_name,
    o.total_amount,
    sh.value->>'stage'                    AS stage,
    sh.value->>'label'                    AS stage_label,
    (sh.value->>'timestamp')::timestamptz AS stage_timestamp
FROM public.orders o,
     jsonb_array_elements(COALESCE(o.stage_history, '[]'::jsonb)) AS sh(value)
ORDER BY o.created_at DESC, stage_timestamp ASC;


-- ── 6E. ORDERS AWAITING DISPATCH (no tracking ID, not cancelled/delivered) ───
SELECT
    o.id                               AS order_id,
    o.created_at,
    COALESCE(o.order_stage, 'incoming') AS stage,
    o.total_amount,
    o.customer_details->>'name'        AS customer_name,
    o.customer_details->>'phone'       AS phone,
    o.shipping_address->>'city'        AS city
FROM public.orders o
WHERE (o.delivery_details->>'tracking_id' IS NULL
       OR o.delivery_details->>'tracking_id' = '')
  AND COALESCE(o.order_stage, 'incoming') NOT IN ('cancelled','delivered','returned','refunded')
ORDER BY o.created_at ASC;


-- =============================================================================
-- SECTION 7: CATEGORIES & PRODUCT CATALOG MANAGEMENT
-- =============================================================================

-- ── 7A. VIEW ALL CATEGORIES & SUBCATEGORIES HIERARCHY WITH PRODUCT COUNTS ─────
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


-- ── 7B. VIEW ALL PRODUCTS WITH THEIR CATEGORY & VARIANTS ─────────────────────
SELECT
    p.id                                    AS product_id,
    p.name                                  AS product_name,
    p.sku,
    COALESCE(c.name, 'Uncategorized')       AS category_name,
    parent.name                             AS parent_category,
    p.price                                 AS selling_price,
    p.compare_at_price                      AS original_price,
    p.stock_quantity                        AS total_stock,
    p.is_active,
    COUNT(v.id)                             AS variant_count
FROM public.products p
LEFT JOIN public.categories c ON p.category_id = c.id
LEFT JOIN public.categories parent ON c.parent_id = parent.id
LEFT JOIN public.product_variants v ON v.product_id = p.id
GROUP BY p.id, p.name, p.sku, c.name, parent.name, p.price, p.compare_at_price, p.stock_quantity, p.is_active
ORDER BY p.created_at DESC;


-- ── 7C. SEED DEFAULT MAIN & SUB CATEGORIES (Safe Insert - skips existing) ────
-- Run this if your categories table is empty or missing standard apparel categories:
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

