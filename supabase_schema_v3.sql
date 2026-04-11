-- ============================================================
-- EZEKII ELECTRONICS — Schema v3 (BUG FIX)
-- Fixes: RLS infinite recursion on user_profiles
-- Run this in: Supabase → SQL Editor → New query
-- ============================================================

-- ============================================================
-- STEP 1: Security-definer helper functions
-- These bypass RLS entirely, breaking the recursion loop.
-- MUST be created before the policies that use them.
-- ============================================================

-- Returns the role of the currently logged-in user
create or replace function auth_user_role()
returns text
language sql
security definer
stable
as $$
  select role from user_profiles where id = auth.uid();
$$;

-- Returns the shop_id assigned to the currently logged-in user
create or replace function auth_user_shop_id()
returns uuid
language sql
security definer
stable
as $$
  select shop_id from user_profiles where id = auth.uid();
$$;

-- Returns the full profile row for the current user (used by the app)
create or replace function get_my_profile()
returns table(id uuid, email text, full_name text, role text, shop_id uuid, is_active boolean)
language sql
security definer
stable
as $$
  select id, email, full_name, role, shop_id, is_active
  from user_profiles
  where id = auth.uid();
$$;

-- ============================================================
-- STEP 2: Drop ALL existing policies on every table
-- Removes any conflicting or recursive policies from previous runs
-- ============================================================

-- user_profiles
drop policy if exists "Users can read own profile"      on user_profiles;
drop policy if exists "Admins can read all profiles"    on user_profiles;
drop policy if exists "Admins can insert profiles"      on user_profiles;
drop policy if exists "Admins can update profiles"      on user_profiles;
drop policy if exists "Admins can delete profiles"      on user_profiles;

-- shops
drop policy if exists "Authenticated users can read shops"   on shops;
drop policy if exists "Authenticated users can insert shops" on shops;
drop policy if exists "Authenticated users can update shops" on shops;
drop policy if exists "shop_select" on shops;
drop policy if exists "shop_insert" on shops;
drop policy if exists "shop_update" on shops;

-- products
drop policy if exists "Authenticated users can read products"   on products;
drop policy if exists "Authenticated users can insert products" on products;
drop policy if exists "Authenticated users can update products" on products;
drop policy if exists "Authenticated users can delete products" on products;
drop policy if exists "product_select" on products;
drop policy if exists "product_insert" on products;
drop policy if exists "product_update" on products;
drop policy if exists "product_delete" on products;

-- sales
drop policy if exists "Authenticated users can read sales"   on sales;
drop policy if exists "Authenticated users can insert sales" on sales;
drop policy if exists "sale_select" on sales;
drop policy if exists "sale_insert" on sales;

-- transfers
drop policy if exists "Authenticated users can read transfers"   on transfers;
drop policy if exists "Authenticated users can insert transfers" on transfers;
drop policy if exists "transfer_select" on transfers;
drop policy if exists "transfer_insert" on transfers;

-- ============================================================
-- STEP 3: Recreate user_profiles RLS using auth.uid() directly
-- No subquery → no recursion
-- ============================================================

alter table user_profiles enable row level security;

-- Users can always read their own row
create policy "up_select_own"
  on user_profiles for select
  using (auth.uid() = id);

-- Admins can read all rows — uses security-definer function, not subquery
create policy "up_select_admin"
  on user_profiles for select
  using (auth_user_role() = 'admin');

-- Admins can insert
create policy "up_insert_admin"
  on user_profiles for insert
  with check (auth_user_role() = 'admin');

-- Admins can update
create policy "up_update_admin"
  on user_profiles for update
  using (auth_user_role() = 'admin');

-- Admins can delete
create policy "up_delete_admin"
  on user_profiles for delete
  using (auth_user_role() = 'admin');

-- ============================================================
-- STEP 4: Shops RLS
-- ============================================================

alter table shops enable row level security;

create policy "shops_select"
  on shops for select
  using (
    auth_user_role() = 'admin'
    or auth_user_shop_id() = id
  );

create policy "shops_insert"
  on shops for insert
  with check (auth_user_role() = 'admin');

create policy "shops_update"
  on shops for update
  using (auth_user_role() = 'admin');

-- ============================================================
-- STEP 5: Products RLS
-- ============================================================

alter table products enable row level security;

create policy "products_select"
  on products for select
  using (
    auth_user_role() = 'admin'
    or auth_user_shop_id() = shop_id
  );

create policy "products_insert"
  on products for insert
  with check (
    auth_user_role() = 'admin'
    or auth_user_shop_id() = shop_id
  );

create policy "products_update"
  on products for update
  using (
    auth_user_role() = 'admin'
    or auth_user_shop_id() = shop_id
  );

create policy "products_delete"
  on products for delete
  using (
    auth_user_role() = 'admin'
    or auth_user_shop_id() = shop_id
  );

-- ============================================================
-- STEP 6: Sales RLS
-- ============================================================

alter table sales enable row level security;

create policy "sales_select"
  on sales for select
  using (
    auth_user_role() = 'admin'
    or auth_user_shop_id() = shop_id
  );

create policy "sales_insert"
  on sales for insert
  with check (
    auth_user_role() = 'admin'
    or auth_user_shop_id() = shop_id
  );

-- ============================================================
-- STEP 7: Transfers RLS
-- ============================================================

alter table transfers enable row level security;

create policy "transfers_select"
  on transfers for select
  using (
    auth_user_role() = 'admin'
    or auth_user_shop_id() = from_shop_id
    or auth_user_shop_id() = to_shop_id
  );

create policy "transfers_insert"
  on transfers for insert
  with check (
    auth_user_role() = 'admin'
    or auth_user_shop_id() = from_shop_id
  );

-- ============================================================
-- DONE.
-- After running this, go to your app and:
-- 1. Hard-refresh the browser (Ctrl+Shift+R)
-- 2. Sign in again — the RLS loops are now gone
-- ============================================================
