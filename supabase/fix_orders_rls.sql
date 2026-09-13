-- =============================================================================
-- FIX: Missing INSERT policy on orders & order_items tables
-- Run this in your Supabase SQL Editor (Dashboard -> SQL Editor -> New query)
-- =============================================================================

-- 1. Allow anyone (logged in or guest) to INSERT new orders
DROP POLICY IF EXISTS "Anyone can place an order" ON public.orders;
CREATE POLICY "Anyone can place an order" ON public.orders
    FOR INSERT WITH CHECK (true);

-- 2. Allow anyone to UPDATE their own pending order (needed for payment confirmation)
--    Also allow admin to update any order
DROP POLICY IF EXISTS "Users can cancel their own orders" ON public.orders;
CREATE POLICY "Users can cancel their own orders" ON public.orders
    FOR UPDATE USING (
        auth.uid() = user_id 
        OR (customer_details->>'email' IS NOT NULL AND customer_details->>'email' = auth.jwt()->>'email')
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- 3. Allow anyone to insert order_items (needed to save cart line-items)
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert order items" ON public.order_items;
CREATE POLICY "Anyone can insert order items" ON public.order_items
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view their own order items" ON public.order_items;
CREATE POLICY "Users can view their own order items" ON public.order_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id = order_items.order_id
            AND (
                auth.uid() = o.user_id
                OR (o.customer_details->>'email' IS NOT NULL AND o.customer_details->>'email' = auth.jwt()->>'email')
                OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
            )
        )
    );

-- Verify: list all policies on both tables
SELECT schemaname, tablename, policyname, cmd, qual
FROM pg_policies
WHERE tablename IN ('orders', 'order_items')
ORDER BY tablename, cmd;
