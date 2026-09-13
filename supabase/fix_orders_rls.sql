-- =============================================================================
-- FIX ALL ADMIN TABLES: Explore Cards, Products, Categories, Orders, Stock
-- Run this ENTIRE script in Supabase → SQL Editor → New query → Click "Run"
-- =============================================================================

-- ── 1. FIX MISSING updated_at COLUMN ON ALL TABLES ────────────────────────────
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- ── 2. CREATE / UPDATE EXPLORE_CARDS TABLE ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.explore_cards (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    subtitle text,
    tag_label text DEFAULT 'Explore >',
    image_url text,
    selection_type text NOT NULL DEFAULT 'category',
    category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
    main_category_id text,
    collection_id text,
    product_ids jsonb DEFAULT '[]'::jsonb,
    destination_url text,
    button_text text DEFAULT 'SHOP NOW',
    display_mode text DEFAULT 'cover',
    display_order integer DEFAULT 1,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Ensure all columns exist in explore_cards
ALTER TABLE public.explore_cards ADD COLUMN IF NOT EXISTS main_category_id text;
ALTER TABLE public.explore_cards ADD COLUMN IF NOT EXISTS display_mode text DEFAULT 'cover';
ALTER TABLE public.explore_cards ADD COLUMN IF NOT EXISTS product_ids jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.explore_cards ADD COLUMN IF NOT EXISTS destination_url text;
ALTER TABLE public.explore_cards ADD COLUMN IF NOT EXISTS button_text text DEFAULT 'SHOP NOW';
ALTER TABLE public.explore_cards ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 1;
ALTER TABLE public.explore_cards ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.explore_cards ADD COLUMN IF NOT EXISTS tag_label text DEFAULT 'Explore >';
ALTER TABLE public.explore_cards ADD COLUMN IF NOT EXISTS subtitle text;

-- Explore Cards RLS Policies
ALTER TABLE public.explore_cards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access to active explore cards" ON public.explore_cards;
DROP POLICY IF EXISTS "Allow admin full access to explore cards" ON public.explore_cards;
DROP POLICY IF EXISTS "Allow public read explore_cards" ON public.explore_cards;
DROP POLICY IF EXISTS "Allow insert explore_cards" ON public.explore_cards;
DROP POLICY IF EXISTS "Allow update explore_cards" ON public.explore_cards;
DROP POLICY IF EXISTS "Allow delete explore_cards" ON public.explore_cards;

CREATE POLICY "Allow public read explore_cards" ON public.explore_cards FOR SELECT USING (true);
CREATE POLICY "Allow insert explore_cards" ON public.explore_cards FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update explore_cards" ON public.explore_cards FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete explore_cards" ON public.explore_cards FOR DELETE USING (true);

-- ── 3. FULL PERMISSIVE RLS FOR PRODUCTS, VARIANTS & IMAGES ────────────────────
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access to active products" ON public.products;
DROP POLICY IF EXISTS "Allow admin full access to products" ON public.products;
DROP POLICY IF EXISTS "Allow public select products" ON public.products;
DROP POLICY IF EXISTS "Allow insert products" ON public.products;
DROP POLICY IF EXISTS "Allow update products" ON public.products;
DROP POLICY IF EXISTS "Allow delete products" ON public.products;

CREATE POLICY "Allow public select products" ON public.products FOR SELECT USING (true);
CREATE POLICY "Allow insert products" ON public.products FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update products" ON public.products FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete products" ON public.products FOR DELETE USING (true);

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access to product_variants" ON public.product_variants;
DROP POLICY IF EXISTS "Allow admin full access to product_variants" ON public.product_variants;
DROP POLICY IF EXISTS "Allow public select product_variants" ON public.product_variants;
DROP POLICY IF EXISTS "Allow insert product_variants" ON public.product_variants;
DROP POLICY IF EXISTS "Allow update product_variants" ON public.product_variants;
DROP POLICY IF EXISTS "Allow delete product_variants" ON public.product_variants;

CREATE POLICY "Allow public select product_variants" ON public.product_variants FOR SELECT USING (true);
CREATE POLICY "Allow insert product_variants" ON public.product_variants FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update product_variants" ON public.product_variants FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete product_variants" ON public.product_variants FOR DELETE USING (true);

ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access to product_images" ON public.product_images;
DROP POLICY IF EXISTS "Allow admin full access to product_images" ON public.product_images;
DROP POLICY IF EXISTS "Allow public select product_images" ON public.product_images;
DROP POLICY IF EXISTS "Allow insert product_images" ON public.product_images;
DROP POLICY IF EXISTS "Allow update product_images" ON public.product_images;
DROP POLICY IF EXISTS "Allow delete product_images" ON public.product_images;

CREATE POLICY "Allow public select product_images" ON public.product_images FOR SELECT USING (true);
CREATE POLICY "Allow insert product_images" ON public.product_images FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update product_images" ON public.product_images FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete product_images" ON public.product_images FOR DELETE USING (true);

-- ── 4. CATEGORIES TABLE PERMISSIVE RLS ─────────────────────────────────────────
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access to categories" ON public.categories;
DROP POLICY IF EXISTS "Allow admin full access to categories" ON public.categories;

CREATE POLICY "Allow public select categories" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Allow insert categories" ON public.categories FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update categories" ON public.categories FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete categories" ON public.categories FOR DELETE USING (true);

-- ── 5. ORDERS & ORDER_ITEMS TABLE PERMISSIVE RLS ──────────────────────────────
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

-- Remove status check constraint if it blocks refunded/cancelled statuses
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can place an order" ON public.orders;
DROP POLICY IF EXISTS "Allow payment confirmation" ON public.orders;
DROP POLICY IF EXISTS "Users can cancel their own orders" ON public.orders;
DROP POLICY IF EXISTS "Allow users to view their own orders" ON public.orders;
DROP POLICY IF EXISTS "Allow users to insert their own orders" ON public.orders;
DROP POLICY IF EXISTS "Allow users to update their own orders" ON public.orders;
DROP POLICY IF EXISTS "Allow admin to delete orders" ON public.orders;
DROP POLICY IF EXISTS "Allow payment and order updates" ON public.orders;
DROP POLICY IF EXISTS "Allow users and admins to view orders" ON public.orders;

CREATE POLICY "Anyone can place an order" ON public.orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow payment and order updates" ON public.orders FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow users and admins to view orders" ON public.orders FOR SELECT USING (true);
CREATE POLICY "Allow admin to delete orders" ON public.orders FOR DELETE USING (true);

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can insert order items" ON public.order_items;
DROP POLICY IF EXISTS "Users can view their own order items" ON public.order_items;
DROP POLICY IF EXISTS "Allow viewing order items" ON public.order_items;
DROP POLICY IF EXISTS "Allow updating order items" ON public.order_items;
DROP POLICY IF EXISTS "Allow deleting order items" ON public.order_items;

CREATE POLICY "Anyone can insert order items" ON public.order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow viewing order items" ON public.order_items FOR SELECT USING (true);
CREATE POLICY "Allow updating order items" ON public.order_items FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow deleting order items" ON public.order_items FOR DELETE USING (true);
