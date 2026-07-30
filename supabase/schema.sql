-- Supabase Database Schema for Kappa Clothing Store

-- 1. PROFILES (extends Supabase auth.users)
create table if not exists public.profiles (
    id uuid references auth.users on delete cascade primary key,
    full_name text,
    phone text,
    role text not null default 'customer',
    created_at timestamp with time zone default now()
);

-- Enable RLS on profiles
alter table public.profiles enable row level security;

-- Policies for profiles
drop policy if exists "Allow public read access to profiles" on public.profiles;
create policy "Allow public read access to profiles" on public.profiles
    for select using (true);

drop policy if exists "Allow users to update their own profile" on public.profiles;
create policy "Allow users to update their own profile" on public.profiles
    for update using (auth.uid() = id);

drop policy if exists "Allow insert on profiles" on public.profiles;
create policy "Allow insert on profiles" on public.profiles
    for insert with check (true);

-- 2. CATEGORIES
create table if not exists public.categories (
    id uuid default gen_random_uuid() primary key,
    name text not null,
    slug text not null unique,
    created_at timestamp with time zone default now(),
    parent_id uuid references public.categories(id) on delete set null
);

-- Enable RLS on categories
alter table public.categories enable row level security;

-- Policies for categories
drop policy if exists "Allow public read access to categories" on public.categories;
create policy "Allow public read access to categories" on public.categories
    for select using (true);

drop policy if exists "Allow admin full access to categories" on public.categories;
create policy "Allow admin full access to categories" on public.categories
    for all using (
        exists (
            select 1 from public.profiles
            where id = auth.uid() and role = 'admin'
        )
    );

-- 3. PRODUCTS
create table if not exists public.products (
    id uuid default gen_random_uuid() primary key,
    name text not null,
    slug text not null unique,
    description text,
    price numeric not null,
    compare_at_price numeric,
    category_id uuid references public.categories(id) on delete set null,
    stock_quantity integer not null default 0,
    sku text,
    is_active boolean not null default true,
    created_at timestamp with time zone default now()
);

-- Enable RLS on products
alter table public.products enable row level security;

-- Policies for products
drop policy if exists "Allow public read access to active products" on public.products;
create policy "Allow public read access to active products" on public.products
    for select using (is_active = true or exists (
        select 1 from public.profiles
        where id = auth.uid() and role = 'admin'
    ));

drop policy if exists "Allow admin full access to products" on public.products;
create policy "Allow admin full access to products" on public.products
    for all using (
        exists (
            select 1 from public.profiles
            where id = auth.uid() and role = 'admin'
        )
    );

-- 4. PRODUCT VARIANTS
create table if not exists public.product_variants (
    id uuid default gen_random_uuid() primary key,
    product_id uuid references public.products(id) on delete cascade not null,
    size text,
    color text,
    stock_quantity integer not null default 0,
    sku text
);

-- Enable RLS on product_variants
alter table public.product_variants enable row level security;

-- Policies for product_variants
drop policy if exists "Allow public read access to product_variants" on public.product_variants;
create policy "Allow public read access to product_variants" on public.product_variants
    for select using (true);

drop policy if exists "Allow admin full access to product_variants" on public.product_variants;
create policy "Allow admin full access to product_variants" on public.product_variants
    for all using (
        exists (
            select 1 from public.profiles
            where id = auth.uid() and role = 'admin'
        )
    );

-- 5. PRODUCT IMAGES
create table if not exists public.product_images (
    id uuid default gen_random_uuid() primary key,
    product_id uuid references public.products(id) on delete cascade not null,
    url text not null,
    position integer default 0
);

-- Enable RLS on product_images
alter table public.product_images enable row level security;

-- Policies for product_images
drop policy if exists "Allow public read access to product_images" on public.product_images;
create policy "Allow public read access to product_images" on public.product_images
    for select using (true);

drop policy if exists "Allow admin full access to product_images" on public.product_images;
create policy "Allow admin full access to product_images" on public.product_images
    for all using (
        exists (
            select 1 from public.profiles
            where id = auth.uid() and role = 'admin'
        )
    );

-- 6. ADDRESSES
create table if not exists public.addresses (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.profiles(id) on delete cascade,
    line1 text not null,
    line2 text,
    city text not null,
    state text not null,
    pincode text not null,
    is_default boolean default false
);

-- Enable RLS on addresses
alter table public.addresses enable row level security;

-- Policies for addresses
drop policy if exists "Allow users to view their own addresses" on public.addresses;
create policy "Allow users to view their own addresses" on public.addresses
    for select using (auth.uid() = user_id or exists (
        select 1 from public.profiles
        where id = auth.uid() and role = 'admin'
    ));

drop policy if exists "Allow users to insert their own addresses" on public.addresses;
create policy "Allow users to insert their own addresses" on public.addresses
    for insert with check (auth.uid() = user_id or auth.uid() is null); -- allows signup setup/guest checkout

drop policy if exists "Allow users to update/delete their own addresses" on public.addresses;
create policy "Allow users to update/delete their own addresses" on public.addresses
    for all using (auth.uid() = user_id or exists (
        select 1 from public.profiles
        where id = auth.uid() and role = 'admin'
    ));

-- 7. ORDERS
create table if not exists public.orders (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.profiles(id) on delete set null,
    status text not null default 'pending',
    total_amount numeric not null,
    shipping_address_id uuid references public.addresses(id) on delete set null,
    razorpay_order_id text,
    razorpay_payment_id text,
    created_at timestamp with time zone default now(),
    shipping_address jsonb,
    customer_details jsonb,
    items jsonb
);

-- Enable RLS on orders
alter table public.orders enable row level security;

-- Policies for orders
drop policy if exists "Allow users to view their own orders" on public.orders;
create policy "Allow users to view their own orders" on public.orders
    for select using (auth.uid() = user_id or exists (
        select 1 from public.profiles
        where id = auth.uid() and role = 'admin'
    ));

drop policy if exists "Allow anyone to create orders" on public.orders;
create policy "Allow anyone to create orders" on public.orders
    for insert with check (true);

drop policy if exists "Allow users/admin to update their own orders" on public.orders;
create policy "Allow users/admin to update their own orders" on public.orders
    for all using (auth.uid() = user_id or exists (
        select 1 from public.profiles
        where id = auth.uid() and role = 'admin'
    ));

-- 8. ORDER ITEMS
create table if not exists public.order_items (
    id uuid default gen_random_uuid() primary key,
    order_id uuid references public.orders(id) on delete cascade not null,
    product_id uuid references public.products(id) on delete set null,
    variant_id uuid references public.product_variants(id) on delete set null,
    quantity integer not null,
    price_at_purchase numeric not null,
    color text,
    size text,
    image_url text
);

-- Enable RLS on order_items
alter table public.order_items enable row level security;

-- Policies for order_items
drop policy if exists "Allow users to view their own order items" on public.order_items;
create policy "Allow users to view their own order items" on public.order_items
    for select using (
        exists (
            select 1 from public.orders
            where id = order_items.order_id and (user_id = auth.uid() or exists (
                select 1 from public.profiles
                where id = auth.uid() and role = 'admin'
            ))
        )
    );

drop policy if exists "Allow anyone to insert order items" on public.order_items;
create policy "Allow anyone to insert order items" on public.order_items
    for insert with check (true);

drop policy if exists "Allow users/admin to delete order items" on public.order_items;
create policy "Allow users/admin to delete order items" on public.order_items
    for delete using (
        exists (
            select 1 from public.orders
            where id = order_items.order_id and (user_id = auth.uid() or exists (
                select 1 from public.profiles
                where id = auth.uid() and role = 'admin'
            ))
        )
    );

-- 9. CART ITEMS
create table if not exists public.cart_items (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.profiles(id) on delete cascade,
    product_id uuid references public.products(id) on delete cascade not null,
    variant_id uuid references public.product_variants(id) on delete cascade,
    quantity integer not null default 1,
    created_at timestamp with time zone default now()
);

-- Enable RLS on cart_items
alter table public.cart_items enable row level security;

-- Policies for cart_items
drop policy if exists "Allow users to view their own cart items" on public.cart_items;
create policy "Allow users to view their own cart items" on public.cart_items
    for select using (auth.uid() = user_id);

drop policy if exists "Allow users to manage their own cart items" on public.cart_items;
create policy "Allow users to manage their own cart items" on public.cart_items
    for all using (auth.uid() = user_id);

-- 10. WISHLISTS
create table if not exists public.wishlists (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.profiles(id) on delete cascade,
    product_id uuid references public.products(id) on delete cascade not null
);

-- Enable RLS on wishlists
alter table public.wishlists enable row level security;

-- Policies for wishlists
drop policy if exists "Allow users to view their own wishlist" on public.wishlists;
create policy "Allow users to view their own wishlist" on public.wishlists
    for select using (auth.uid() = user_id);

drop policy if exists "Allow users to manage their own wishlist" on public.wishlists;
create policy "Allow users to manage their own wishlist" on public.wishlists
    for all using (auth.uid() = user_id);

-- 11. REVIEWS
create table if not exists public.reviews (
    id uuid default gen_random_uuid() primary key,
    product_id uuid references public.products(id) on delete cascade not null,
    user_id uuid references public.profiles(id) on delete cascade,
    rating integer check (rating >= 1 and rating <= 5),
    comment text,
    created_at timestamp with time zone default now()
);

-- Enable RLS on reviews
alter table public.reviews enable row level security;

-- Policies for reviews
drop policy if exists "Allow public read access to reviews" on public.reviews;
create policy "Allow public read access to reviews" on public.reviews
    for select using (true);

drop policy if exists "Allow logged in users to write reviews" on public.reviews;
create policy "Allow logged in users to write reviews" on public.reviews
    for insert with check (auth.uid() = user_id);

drop policy if exists "Allow users to manage their own reviews" on public.reviews;
create policy "Allow users to manage their own reviews" on public.reviews
    for all using (auth.uid() = user_id or exists (
        select 1 from public.profiles
        where id = auth.uid() and role = 'admin'
    ));

-- TRIGGER FUNCTION FOR NEW AUTH SIGNUPS
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    'customer'
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger execution
drop trigger if exists on_auth_user_created on auth.users;
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
