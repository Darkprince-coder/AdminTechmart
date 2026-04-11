-- ============================================================
-- EZEKII ELECTRONICS — Updated Schema (Run after initial schema)
-- ============================================================
-- Run this in: Supabase → SQL Editor → New query
-- It is safe to run on an existing database — uses IF NOT EXISTS
-- ============================================================

-- 1. USER PROFILES TABLE
--    Links Supabase auth users to roles and shops
create table if not exists user_profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  role        text not null default 'manager'
                check (role in ('admin', 'manager')),
  shop_id     uuid references shops(id) on delete set null,
  is_active   boolean default true,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Index for fast role lookups
create index if not exists idx_user_profiles_role    on user_profiles(role);
create index if not exists idx_user_profiles_shop_id on user_profiles(shop_id);

-- Auto-update updated_at
create or replace function update_user_profile_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists user_profiles_updated_at on user_profiles;
create trigger user_profiles_updated_at
  before update on user_profiles
  for each row execute procedure update_user_profile_updated_at();

-- ============================================================
-- 2. RLS ON USER_PROFILES
-- ============================================================
alter table user_profiles enable row level security;

-- Users can read their own profile
create policy "Users can read own profile"
  on user_profiles for select
  using (auth.uid() = id);

-- Admins can read all profiles
create policy "Admins can read all profiles"
  on user_profiles for select
  using (
    exists (
      select 1 from user_profiles up
      where up.id = auth.uid() and up.role = 'admin'
    )
  );

-- Admins can insert profiles
create policy "Admins can insert profiles"
  on user_profiles for insert
  with check (
    exists (
      select 1 from user_profiles up
      where up.id = auth.uid() and up.role = 'admin'
    )
  );

-- Admins can update profiles
create policy "Admins can update profiles"
  on user_profiles for update
  using (
    exists (
      select 1 from user_profiles up
      where up.id = auth.uid() and up.role = 'admin'
    )
  );

-- Admins can delete profiles
create policy "Admins can delete profiles"
  on user_profiles for delete
  using (
    exists (
      select 1 from user_profiles up
      where up.id = auth.uid() and up.role = 'admin'
    )
  );

-- ============================================================
-- 3. UPDATE SHOP RLS — managers can only see their own shop
-- ============================================================

-- Drop old permissive policies first
drop policy if exists "Authenticated users can read shops"   on shops;
drop policy if exists "Authenticated users can insert shops" on shops;
drop policy if exists "Authenticated users can update shops" on shops;

-- Admins see all shops; managers see only their assigned shop
create policy "shop_select"
  on shops for select
  using (
    exists (select 1 from user_profiles up where up.id = auth.uid() and up.role = 'admin')
    or
    exists (select 1 from user_profiles up where up.id = auth.uid() and up.shop_id = shops.id)
  );

create policy "shop_insert"
  on shops for insert
  with check (
    exists (select 1 from user_profiles up where up.id = auth.uid() and up.role = 'admin')
  );

create policy "shop_update"
  on shops for update
  using (
    exists (select 1 from user_profiles up where up.id = auth.uid() and up.role = 'admin')
  );

-- ============================================================
-- 4. UPDATE PRODUCTS RLS — scoped by role
-- ============================================================

drop policy if exists "Authenticated users can read products"   on products;
drop policy if exists "Authenticated users can insert products" on products;
drop policy if exists "Authenticated users can update products" on products;
drop policy if exists "Authenticated users can delete products" on products;

create policy "product_select"
  on products for select
  using (
    exists (select 1 from user_profiles up where up.id = auth.uid() and up.role = 'admin')
    or
    exists (select 1 from user_profiles up where up.id = auth.uid() and up.shop_id = products.shop_id)
  );

create policy "product_insert"
  on products for insert
  with check (
    exists (select 1 from user_profiles up where up.id = auth.uid() and up.role = 'admin')
    or
    exists (select 1 from user_profiles up where up.id = auth.uid() and up.shop_id = products.shop_id)
  );

create policy "product_update"
  on products for update
  using (
    exists (select 1 from user_profiles up where up.id = auth.uid() and up.role = 'admin')
    or
    exists (select 1 from user_profiles up where up.id = auth.uid() and up.shop_id = products.shop_id)
  );

create policy "product_delete"
  on products for delete
  using (
    exists (select 1 from user_profiles up where up.id = auth.uid() and up.role = 'admin')
    or
    exists (select 1 from user_profiles up where up.id = auth.uid() and up.shop_id = products.shop_id)
  );

-- ============================================================
-- 5. UPDATE SALES RLS
-- ============================================================

drop policy if exists "Authenticated users can read sales"   on sales;
drop policy if exists "Authenticated users can insert sales" on sales;

create policy "sale_select"
  on sales for select
  using (
    exists (select 1 from user_profiles up where up.id = auth.uid() and up.role = 'admin')
    or
    exists (select 1 from user_profiles up where up.id = auth.uid() and up.shop_id = sales.shop_id)
  );

create policy "sale_insert"
  on sales for insert
  with check (
    exists (select 1 from user_profiles up where up.id = auth.uid() and up.role = 'admin')
    or
    exists (select 1 from user_profiles up where up.id = auth.uid() and up.shop_id = sales.shop_id)
  );

-- ============================================================
-- 6. UPDATE TRANSFERS RLS
-- ============================================================

drop policy if exists "Authenticated users can read transfers"   on transfers;
drop policy if exists "Authenticated users can insert transfers" on transfers;

create policy "transfer_select"
  on transfers for select
  using (
    exists (select 1 from user_profiles up where up.id = auth.uid() and up.role = 'admin')
    or
    exists (
      select 1 from user_profiles up
      where up.id = auth.uid()
      and (up.shop_id = transfers.from_shop_id or up.shop_id = transfers.to_shop_id)
    )
  );

create policy "transfer_insert"
  on transfers for insert
  with check (
    exists (select 1 from user_profiles up where up.id = auth.uid() and up.role = 'admin')
    or
    exists (select 1 from user_profiles up where up.id = auth.uid() and up.shop_id = transfers.from_shop_id)
  );

-- ============================================================
-- 7. HELPER FUNCTION — get current user's profile (safe, no RLS loop)
-- ============================================================

create or replace function get_my_profile()
returns table(id uuid, email text, full_name text, role text, shop_id uuid, is_active boolean)
language sql security definer
as $$
  select id, email, full_name, role, shop_id, is_active
  from user_profiles
  where id = auth.uid();
$$;

-- ============================================================
-- 8. UPDATE SEED DATA — rename shop to Ezekii Electronics Isinet
-- ============================================================

-- Update the existing seeded shop name (safe if already renamed)
update shops
set name = 'Ezekii Electronics', location = 'Isinet'
where name = 'TechMart CBD'
  and not exists (select 1 from shops where name = 'Ezekii Electronics');

-- ============================================================
-- 9. CREATE YOUR ADMIN PROFILE
--    After running this script, go to Supabase → Authentication → Users
--    Copy your admin user's UUID, then run:
--
--    insert into user_profiles (id, email, full_name, role)
--    values ('<your-admin-uuid>', 'your@email.com', 'Your Name', 'admin');
--
-- ============================================================
