-- ============================================================
-- KAPPA STORE — All-In-One My Orders & Cancellation Script
-- Run this entire script in your Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. SCHEMA MIGRATION: ADD ALL REQUIRED COLUMNS
-- ============================================================
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_stage text DEFAULT 'incoming';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS stage_history jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_details jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_method text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS items jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS refund_details jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cancellation_reason text;

-- Update any existing orders without stage
UPDATE public.orders
SET order_stage = CASE 
    WHEN LOWER(status) LIKE '%cancel%' THEN 'cancelled'
    WHEN LOWER(status) LIKE '%deliver%' THEN 'delivered'
    WHEN LOWER(status) LIKE '%return%' THEN 'returned'
    WHEN LOWER(status) = 'paid' THEN 'confirmed'
    ELSE 'incoming'
END
WHERE order_stage IS NULL OR order_stage = '';

-- ============================================================
-- 2. ROW LEVEL SECURITY (RLS) POLICIES FOR MY ORDERS
-- ============================================================
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own orders
DROP POLICY IF EXISTS "Users can view their own orders" ON public.orders;
CREATE POLICY "Users can view their own orders" ON public.orders
    FOR SELECT USING (
        auth.uid() = user_id 
        OR (customer_details->>'email' IS NOT NULL AND customer_details->>'email' = auth.jwt()->>'email')
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Allow users to update their own orders (e.g. to cancel)
DROP POLICY IF EXISTS "Users can cancel their own orders" ON public.orders;
CREATE POLICY "Users can cancel their own orders" ON public.orders
    FOR UPDATE USING (
        auth.uid() = user_id 
        OR (customer_details->>'email' IS NOT NULL AND customer_details->>'email' = auth.jwt()->>'email')
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- ============================================================
-- 3. STORED PROCEDURE: GET ALL MY ORDERS (Fast JSON API)
-- Call in JavaScript via: supabaseClient.rpc('get_my_orders')
-- ============================================================
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
            -- Products list: direct jsonb or aggregated joined items
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
                                    (SELECT url FROM public.product_images WHERE product_id = p.id ORDER BY display_order ASC LIMIT 1),
                                    'assets/Frame 1.jpg'
                                )
                            )
                        )
                        FROM public.order_items oi
                        LEFT JOIN public.products p ON p.id = oi.product_id
                        WHERE oi.order_id = o.id
                    ),
                    '[]'::jsonb
                )
            END AS items
        FROM public.orders o
        WHERE (v_user_id IS NOT NULL AND o.user_id = v_user_id)
           OR (v_user_email IS NOT NULL AND o.customer_details->>'email' = v_user_email)
        ORDER BY o.created_at DESC
    ) ord_row;

    RETURN v_orders;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_orders() TO authenticated, anon, service_role;

-- ============================================================
-- 4. STORED PROCEDURE: CANCEL ORDER & REGISTER REASON & REFUND
-- Call in JS: supabaseClient.rpc('cancel_my_order', { p_order_id: '...', p_reason: '...', p_refund_details: {...} })
-- ============================================================
CREATE OR REPLACE FUNCTION public.cancel_my_order(
    p_order_id uuid,
    p_reason text,
    p_refund_details jsonb DEFAULT '{}'::jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_user_email text := auth.jwt()->>'email';
    v_order public.orders%ROWTYPE;
BEGIN
    -- Check order exists and user owns it
    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'Order not found');
    END IF;

    IF v_user_id IS NOT NULL AND v_order.user_id <> v_user_id 
       AND (v_user_email IS NULL OR v_order.customer_details->>'email' <> v_user_email) THEN
        RETURN json_build_object('success', false, 'message', 'Unauthorized');
    END IF;

    -- Update order status, stage, reason, and refund details
    UPDATE public.orders
    SET 
        status = 'cancelled',
        order_stage = 'cancelled',
        cancellation_reason = p_reason,
        refund_details = p_refund_details || jsonb_build_object(
            'reason', p_reason,
            'cancelled_at', NOW(),
            'refund_status', 'pending'
        ),
        stage_history = COALESCE(stage_history, '[]'::jsonb) || jsonb_build_object(
            'stage', 'cancelled',
            'label', 'Order Cancelled',
            'timestamp', NOW()
        )
    WHERE id = p_order_id;

    RETURN json_build_object('success', true, 'message', 'Order cancelled successfully');
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_my_order(uuid, text, jsonb) TO authenticated, anon, service_role;

-- ============================================================
-- 5. DIRECT INSPECTION & DEBUG QUERIES
-- ============================================================

-- Query A: View all orders with cancellation reasons & refund status
SELECT 
    id AS order_id,
    created_at,
    status,
    order_stage,
    total_amount,
    payment_method,
    cancellation_reason,
    refund_details->>'method' AS refund_method,
    refund_details->>'refund_status' AS refund_status,
    customer_details->>'name' AS customer_name,
    customer_details->>'phone' AS customer_phone,
    items
FROM public.orders
ORDER BY created_at DESC;

-- Query B: View only Cancelled orders and their reasons
SELECT 
    id AS order_id,
    created_at,
    cancellation_reason,
    refund_details->>'method' AS refund_method,
    refund_details->>'upi_id' AS refund_upi,
    refund_details->>'account_number' AS refund_bank_acc,
    refund_details->>'cancelled_at' AS cancelled_at,
    total_amount
FROM public.orders
WHERE order_stage = 'cancelled' OR status ILIKE '%cancel%'
ORDER BY created_at DESC;

-- ============================================================
-- 6. QUERIES FOR ORDER TRACKING TIMELINE & ETA (NEW)
-- Run in Supabase SQL Editor after the above script
-- ============================================================

-- Ensure delivery_details column exists (safe to re-run)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_details jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS stage_history    jsonb DEFAULT '[]'::jsonb;

-- Query C: View all orders with tracking + delivery ETA (for debugging)
SELECT
    id                                             AS order_id,
    created_at,
    status,
    order_stage,
    total_amount,
    customer_details->>'name'                      AS customer_name,
    customer_details->>'phone'                     AS customer_phone,
    delivery_details->>'partner'                   AS courier_partner,
    delivery_details->>'tracking_id'               AS tracking_id,
    delivery_details->>'tracking_url'              AS tracking_url,
    delivery_details->>'eta_days'                  AS eta_message,
    delivery_details->>'expected_delivery'         AS expected_date,
    delivery_details->>'delivery_status'           AS delivery_status,
    stage_history
FROM public.orders
ORDER BY created_at DESC;

-- Query D: Update ETA message for a specific order
--   Replace <ORDER_UUID> with the actual order ID
--   Replace '2-4 working days' with the message you want shown to the customer
/*
UPDATE public.orders
SET delivery_details = COALESCE(delivery_details, '{}'::jsonb)
                       || jsonb_build_object('eta_days', '2-4 working days')
WHERE id = '<ORDER_UUID>';
*/

-- Query E: Bulk-set default ETA for all active (non-cancelled, non-delivered) orders
--   that don't yet have an ETA message
/*
UPDATE public.orders
SET delivery_details = COALESCE(delivery_details, '{}'::jsonb)
                       || jsonb_build_object('eta_days', '2-4 working days')
WHERE order_stage NOT IN ('cancelled', 'delivered', 'returned', 'refunded')
  AND (delivery_details->>'eta_days' IS NULL OR delivery_details->>'eta_days' = '');
*/

-- Query F: Add a stage_history entry manually (e.g. mark order as 'shipped' with today's date)
--   Replace <ORDER_UUID> with the actual order ID
/*
UPDATE public.orders
SET
    order_stage   = 'shipped',
    stage_history = COALESCE(stage_history, '[]'::jsonb)
                    || jsonb_build_array(
                           jsonb_build_object(
                               'stage',     'shipped',
                               'label',     'Shipped',
                               'timestamp', NOW()
                           )
                       )
WHERE id = '<ORDER_UUID>';
*/
