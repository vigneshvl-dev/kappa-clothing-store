-- =============================================================================
-- FIX: Complete Orders & Order Items Setup (Columns + Full RLS Policies)
-- Run this ENTIRE script in Supabase → SQL Editor → New query → Click "Run"
-- =============================================================================

-- ── 1. ENSURE ALL REQUIRED COLUMNS EXIST ON ORDERS TABLE ──────────────────────
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_stage text DEFAULT 'incoming';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_details jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS stage_history jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'Razorpay';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'pending';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS refund_details jsonb;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cancellation_details jsonb;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS razorpay_payment_id text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS razorpay_order_id text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_details jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_address jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS items jsonb DEFAULT '[]'::jsonb;

-- ── 2. ORDERS TABLE RLS POLICIES ──────────────────────────────────────────────
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Drop all old policies to avoid conflicts
DROP POLICY IF EXISTS "Anyone can place an order" ON public.orders;
DROP POLICY IF EXISTS "Allow payment confirmation" ON public.orders;
DROP POLICY IF EXISTS "Users can cancel their own orders" ON public.orders;
DROP POLICY IF EXISTS "Allow users to view their own orders" ON public.orders;
DROP POLICY IF EXISTS "Allow users to insert their own orders" ON public.orders;
DROP POLICY IF EXISTS "Allow users to update their own orders" ON public.orders;
DROP POLICY IF EXISTS "Allow admin to delete orders" ON public.orders;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.orders;
DROP POLICY IF EXISTS "Enable select for all users" ON public.orders;
DROP POLICY IF EXISTS "Enable update for all users" ON public.orders;
DROP POLICY IF EXISTS "Allow payment and order updates" ON public.orders;
DROP POLICY IF EXISTS "Allow users and admins to view orders" ON public.orders;

-- INSERT: Anyone (guest or registered user) can place an order
CREATE POLICY "Anyone can place an order" ON public.orders
    FOR INSERT WITH CHECK (true);

-- UPDATE: Allow updating order status, payment status, stage, delivery, etc.
CREATE POLICY "Allow payment and order updates" ON public.orders
    FOR UPDATE USING (true) WITH CHECK (true);

-- SELECT: Allow users and admin panel to read orders
CREATE POLICY "Allow users and admins to view orders" ON public.orders
    FOR SELECT USING (true);

-- DELETE: Allow deleting / recycling orders
CREATE POLICY "Allow admin to delete orders" ON public.orders
    FOR DELETE USING (true);


-- ── 3. ORDER_ITEMS TABLE RLS POLICIES ─────────────────────────────────────────
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert order items" ON public.order_items;
DROP POLICY IF EXISTS "Users can view their own order items" ON public.order_items;
DROP POLICY IF EXISTS "Allow viewing order items" ON public.order_items;
DROP POLICY IF EXISTS "Allow updating order items" ON public.order_items;
DROP POLICY IF EXISTS "Allow deleting order items" ON public.order_items;

CREATE POLICY "Anyone can insert order items" ON public.order_items
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow viewing order items" ON public.order_items
    FOR SELECT USING (true);

CREATE POLICY "Allow updating order items" ON public.order_items
    FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Allow deleting order items" ON public.order_items
    FOR DELETE USING (true);


-- ── 4. VERIFY ─────────────────────────────────────────────────────────────────
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('orders', 'order_items')
ORDER BY tablename, cmd;
