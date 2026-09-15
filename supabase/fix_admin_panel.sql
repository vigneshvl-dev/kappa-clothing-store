ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role text DEFAULT 'admin';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;
UPDATE public.profiles SET role = 'admin' WHERE role IS NULL OR role != 'admin';
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access to profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow users to update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow insert on profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow public select profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow public update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow public delete profiles" ON public.profiles;
CREATE POLICY "Allow public select profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Allow public update profiles" ON public.profiles FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow insert on profiles" ON public.profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete profiles" ON public.profiles FOR DELETE USING (true);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_stage text DEFAULT 'incoming';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_details jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS stage_history jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'Razorpay';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'pending';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS refund_details jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cancellation_details jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cancellation_reason text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS razorpay_payment_id text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS razorpay_order_id text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_details jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_address jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS items jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
UPDATE public.orders
SET order_stage = CASE 
    WHEN LOWER(status) LIKE '%cancel%' THEN 'cancelled'
    WHEN LOWER(status) LIKE '%deliver%' THEN 'delivered'
    WHEN LOWER(status) LIKE '%return%' THEN 'returned'
    WHEN LOWER(status) = 'paid' THEN 'confirmed'
    ELSE 'incoming'
END
WHERE order_stage IS NULL OR order_stage = '';
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
DROP POLICY IF EXISTS "Allow full select orders" ON public.orders;
DROP POLICY IF EXISTS "Allow full insert orders" ON public.orders;
DROP POLICY IF EXISTS "Allow full update orders" ON public.orders;
DROP POLICY IF EXISTS "Allow full delete orders" ON public.orders;
CREATE POLICY "Allow full select orders" ON public.orders FOR SELECT USING (true);
CREATE POLICY "Allow full insert orders" ON public.orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow full update orders" ON public.orders FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow full delete orders" ON public.orders FOR DELETE USING (true);
CREATE TABLE IF NOT EXISTS public.order_items (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id uuid,
    quantity integer DEFAULT 1,
    price numeric DEFAULT 0,
    size text,
    color text,
    created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS size text;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS color text;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can insert order items" ON public.order_items;
DROP POLICY IF EXISTS "Users can view their own order items" ON public.order_items;
DROP POLICY IF EXISTS "Allow viewing order items" ON public.order_items;
DROP POLICY IF EXISTS "Allow updating order items" ON public.order_items;
DROP POLICY IF EXISTS "Allow deleting order items" ON public.order_items;
DROP POLICY IF EXISTS "Allow full select order_items" ON public.order_items;
DROP POLICY IF EXISTS "Allow full insert order_items" ON public.order_items;
DROP POLICY IF EXISTS "Allow full update order_items" ON public.order_items;
DROP POLICY IF EXISTS "Allow full delete order_items" ON public.order_items;
CREATE POLICY "Allow full select order_items" ON public.order_items FOR SELECT USING (true);
CREATE POLICY "Allow full insert order_items" ON public.order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow full update order_items" ON public.order_items FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow full delete order_items" ON public.order_items FOR DELETE USING (true);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_featured boolean DEFAULT false;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS stock_quantity integer DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS tag text DEFAULT 'NEW';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS shipping_policy text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS legal_metrology text;
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
CREATE TABLE IF NOT EXISTS public.product_variants (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
    size text,
    color text,
    stock_quantity integer DEFAULT 0,
    price numeric,
    sku text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
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
CREATE TABLE IF NOT EXISTS public.product_images (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
    image_url text NOT NULL,
    display_order integer DEFAULT 0,
    is_primary boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);
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
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS image_url text;
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
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'reviews') THEN
        ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Allow public select reviews" ON public.reviews;
        DROP POLICY IF EXISTS "Allow public insert reviews" ON public.reviews;
        DROP POLICY IF EXISTS "Allow public update reviews" ON public.reviews;
        DROP POLICY IF EXISTS "Allow public delete reviews" ON public.reviews;
        CREATE POLICY "Allow public select reviews" ON public.reviews FOR SELECT USING (true);
        CREATE POLICY "Allow public insert reviews" ON public.reviews FOR INSERT WITH CHECK (true);
        CREATE POLICY "Allow public update reviews" ON public.reviews FOR UPDATE USING (true) WITH CHECK (true);
        CREATE POLICY "Allow public delete reviews" ON public.reviews FOR DELETE USING (true);
    END IF;
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'product_reviews') THEN
        ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Allow public select product_reviews" ON public.product_reviews;
        DROP POLICY IF EXISTS "Allow public insert product_reviews" ON public.product_reviews;
        DROP POLICY IF EXISTS "Allow public update product_reviews" ON public.product_reviews;
        DROP POLICY IF EXISTS "Allow public delete product_reviews" ON public.product_reviews;
        CREATE POLICY "Allow public select product_reviews" ON public.product_reviews FOR SELECT USING (true);
        CREATE POLICY "Allow public insert product_reviews" ON public.product_reviews FOR INSERT WITH CHECK (true);
        CREATE POLICY "Allow public update product_reviews" ON public.product_reviews FOR UPDATE USING (true) WITH CHECK (true);
        CREATE POLICY "Allow public delete product_reviews" ON public.product_reviews FOR DELETE USING (true);
    END IF;
END $$;
DO $$
BEGIN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('product-images', 'product-images', true)
    ON CONFLICT (id) DO UPDATE SET public = true;
    DROP POLICY IF EXISTS storage_public_select_images ON storage.objects;
    DROP POLICY IF EXISTS storage_public_insert_images ON storage.objects;
    DROP POLICY IF EXISTS storage_public_update_images ON storage.objects;
    DROP POLICY IF EXISTS storage_public_delete_images ON storage.objects;
    CREATE POLICY storage_public_select_images ON storage.objects
        FOR SELECT USING (bucket_id = 'product-images');
    CREATE POLICY storage_public_insert_images ON storage.objects
        FOR INSERT WITH CHECK (bucket_id = 'product-images');
    CREATE POLICY storage_public_update_images ON storage.objects
        FOR UPDATE USING (bucket_id = 'product-images');
    CREATE POLICY storage_public_delete_images ON storage.objects
        FOR DELETE USING (bucket_id = 'product-images');
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Storage setup skipped: %', SQLERRM;
END $$;
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

-- Homepage Settings table & RLS policies
CREATE TABLE IF NOT EXISTS public.homepage_settings (
    id INT PRIMARY KEY DEFAULT 1,
    settings_json JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.homepage_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public select homepage_settings" ON public.homepage_settings;
DROP POLICY IF EXISTS "Allow public insert homepage_settings" ON public.homepage_settings;
DROP POLICY IF EXISTS "Allow public update homepage_settings" ON public.homepage_settings;
DROP POLICY IF EXISTS "Allow public delete homepage_settings" ON public.homepage_settings;
CREATE POLICY "Allow public select homepage_settings" ON public.homepage_settings FOR SELECT USING (true);
CREATE POLICY "Allow public insert homepage_settings" ON public.homepage_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update homepage_settings" ON public.homepage_settings FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete homepage_settings" ON public.homepage_settings FOR DELETE USING (true);

-- 1. Ensure email column exists on public.profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- 2. Sync email addresses from auth.users into public.profiles
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id;

-- 3. Grant Admin Role to Authorized Admin Accounts
UPDATE public.profiles p
SET role = 'admin'
FROM auth.users u
WHERE p.id = u.id
  AND LOWER(u.email) IN ('kappatvm@gmail.com');

-- 4. Revoke Admin Role from Non-Authorized Accounts
UPDATE public.profiles p
SET role = 'customer'
FROM auth.users u
WHERE p.id = u.id
  AND LOWER(u.email) NOT IN ('kappatvm@gmail.com');
