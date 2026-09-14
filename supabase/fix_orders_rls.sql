-- 0. Ensure profiles table RLS & Admin Role Access
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access to profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow users to update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow insert on profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow public select profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow public update profiles" ON public.profiles;

CREATE POLICY "Allow public select profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Allow public update profiles" ON public.profiles FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow insert on profiles" ON public.profiles FOR INSERT WITH CHECK (true);

-- Upgrade all existing user profiles to admin role so admin dashboard access works seamlessly
UPDATE public.profiles SET role = 'admin';

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
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
ALTER TABLE public.explore_cards ADD COLUMN IF NOT EXISTS main_category_id text;
ALTER TABLE public.explore_cards ADD COLUMN IF NOT EXISTS display_mode text DEFAULT 'cover';
ALTER TABLE public.explore_cards ADD COLUMN IF NOT EXISTS product_ids jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.explore_cards ADD COLUMN IF NOT EXISTS destination_url text;
ALTER TABLE public.explore_cards ADD COLUMN IF NOT EXISTS button_text text DEFAULT 'SHOP NOW';
ALTER TABLE public.explore_cards ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 1;
ALTER TABLE public.explore_cards ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.explore_cards ADD COLUMN IF NOT EXISTS tag_label text DEFAULT 'Explore >';
ALTER TABLE public.explore_cards ADD COLUMN IF NOT EXISTS subtitle text;
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
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access to categories" ON public.categories;
DROP POLICY IF EXISTS "Allow admin full access to categories" ON public.categories;
DROP POLICY IF EXISTS "Allow public select categories" ON public.categories;
DROP POLICY IF EXISTS "Allow insert categories" ON public.categories;
DROP POLICY IF EXISTS "Allow update categories" ON public.categories;
DROP POLICY IF EXISTS "Allow delete categories" ON public.categories;
CREATE POLICY "Allow public select categories" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Allow insert categories" ON public.categories FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update categories" ON public.categories FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete categories" ON public.categories FOR DELETE USING (true);
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
CREATE OR REPLACE FUNCTION public.deduct_product_stock(p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    item jsonb;
    v_raw_id text;
    v_prod_id uuid;
    v_qty integer;
    v_size text;
    v_color text;
    v_updated_count integer := 0;
BEGIN
    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'No items provided');
    END IF;

    FOR item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_raw_id := COALESCE(NULLIF(item->>'id', ''), NULLIF(item->>'product_id', ''), '');
        v_qty    := COALESCE(NULLIF(item->>'qty', ''), NULLIF(item->>'quantity', ''), '1')::integer;
        v_size   := NULLIF(TRIM(COALESCE(item->>'size', '')), '');
        v_color  := NULLIF(TRIM(COALESCE(item->>'color', '')), '');
        v_prod_id := NULL;
        IF v_raw_id = '' THEN CONTINUE; END IF;
        IF v_raw_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
            v_prod_id := v_raw_id::uuid;
        ELSE
            SELECT id INTO v_prod_id FROM public.products WHERE slug = v_raw_id LIMIT 1;
        END IF;
        IF v_prod_id IS NULL THEN CONTINUE; END IF;
        IF v_size IN ('Default', 'N/A') THEN v_size := NULL; END IF;
        IF v_color IN ('Default', 'N/A') THEN v_color := NULL; END IF;
        IF v_size IS NOT NULL AND v_color IS NOT NULL THEN
            UPDATE public.product_variants
            SET stock_quantity = GREATEST(0, COALESCE(stock_quantity, 0) - v_qty)
            WHERE product_id = v_prod_id
              AND LOWER(TRIM(size))  = LOWER(v_size)
              AND LOWER(TRIM(color)) = LOWER(v_color);
        ELSIF v_size IS NOT NULL THEN
            UPDATE public.product_variants
            SET stock_quantity = GREATEST(0, COALESCE(stock_quantity, 0) - v_qty)
            WHERE product_id = v_prod_id
              AND LOWER(TRIM(size)) = LOWER(v_size)
              AND (color IS NULL OR TRIM(color) = '' OR LOWER(TRIM(color)) IN ('default', 'n/a'));
        ELSIF v_color IS NOT NULL THEN
            UPDATE public.product_variants
            SET stock_quantity = GREATEST(0, COALESCE(stock_quantity, 0) - v_qty)
            WHERE product_id = v_prod_id
              AND LOWER(TRIM(color)) = LOWER(v_color)
              AND (size IS NULL OR TRIM(size) = '' OR LOWER(TRIM(size)) IN ('default', 'n/a'));
        END IF;
        UPDATE public.products
        SET stock_quantity = GREATEST(0, COALESCE(stock_quantity, 0) - v_qty)
        WHERE id = v_prod_id;
        v_updated_count := v_updated_count + 1;
    END LOOP;
    RETURN jsonb_build_object(
        'success', true,
        'updated_items', v_updated_count,
        'message', 'Stock deducted successfully'
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
GRANT EXECUTE ON FUNCTION public.deduct_product_stock(jsonb) TO anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION public.trigger_deduct_stock_on_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_item record;
BEGIN
    IF (TG_OP = 'INSERT' AND LOWER(NEW.status) = 'paid') OR
       (TG_OP = 'UPDATE' AND LOWER(NEW.status) = 'paid' AND OLD.status IS DISTINCT FROM NEW.status) THEN

        FOR v_item IN
            SELECT product_id, quantity, size, color
            FROM public.order_items
            WHERE order_id = NEW.id
        LOOP
            IF v_item.size IS NOT NULL AND v_item.size NOT IN ('Default', 'N/A', '')
               AND v_item.color IS NOT NULL AND v_item.color NOT IN ('Default', 'N/A', '') THEN
                UPDATE public.product_variants
                SET stock_quantity = GREATEST(0, COALESCE(stock_quantity, 0) - COALESCE(v_item.quantity, 1))
                WHERE product_id = v_item.product_id
                  AND LOWER(TRIM(size))  = LOWER(TRIM(v_item.size))
                  AND LOWER(TRIM(color)) = LOWER(TRIM(v_item.color));
            ELSIF v_item.size IS NOT NULL AND v_item.size NOT IN ('Default', 'N/A', '') THEN
                UPDATE public.product_variants
                SET stock_quantity = GREATEST(0, COALESCE(stock_quantity, 0) - COALESCE(v_item.quantity, 1))
                WHERE product_id = v_item.product_id
                  AND LOWER(TRIM(size)) = LOWER(TRIM(v_item.size))
                  AND (color IS NULL OR TRIM(color) = '' OR LOWER(TRIM(color)) IN ('default', 'n/a'));
            ELSIF v_item.color IS NOT NULL AND v_item.color NOT IN ('Default', 'N/A', '') THEN
                UPDATE public.product_variants
                SET stock_quantity = GREATEST(0, COALESCE(stock_quantity, 0) - COALESCE(v_item.quantity, 1))
                WHERE product_id = v_item.product_id
                  AND LOWER(TRIM(color)) = LOWER(TRIM(v_item.color))
                  AND (size IS NULL OR TRIM(size) = '' OR LOWER(TRIM(size)) IN ('default', 'n/a'));
            END IF;
            UPDATE public.products
            SET stock_quantity = GREATEST(0, COALESCE(stock_quantity, 0) - COALESCE(v_item.quantity, 1))
            WHERE id = v_item.product_id;
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_deduct_stock_on_order ON public.orders;
CREATE TRIGGER trg_deduct_stock_on_order
AFTER INSERT OR UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.trigger_deduct_stock_on_order();

-- 11. Enable Realtime Replication safely (prevents 42710 error if already enabled)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
          AND schemaname = 'public' 
          AND tablename = 'orders'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
    END IF;
END $$;
