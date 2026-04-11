-- ============================================================
-- TechMart Network — Supabase Database Schema
-- Run this entire script in: Supabase → SQL Editor → New query
-- ============================================================

-- 1. SHOPS
create table if not exists shops (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  location     text not null,
  manager_name text,
  phone        text,
  is_active    boolean default true,
  created_at   timestamptz default now()
);

-- 2. PRODUCTS / INVENTORY
create table if not exists products (
  id            uuid primary key default gen_random_uuid(),
  shop_id       uuid references shops(id) on delete cascade,
  name          text not null,
  category      text not null default 'General',
  buy_price     numeric(12,2) not null default 0,
  sell_price    numeric(12,2) not null default 0,
  quantity      integer not null default 0,
  alert_qty     integer not null default 5,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- 3. SALES
create table if not exists sales (
  id            uuid primary key default gen_random_uuid(),
  shop_id       uuid references shops(id) on delete cascade,
  product_id    uuid references products(id) on delete set null,
  product_name  text not null,
  customer_name text default 'Walk-in',
  quantity      integer not null default 1,
  unit_price    numeric(12,2) not null,
  buy_price     numeric(12,2) not null,
  total_amount  numeric(12,2) generated always as (quantity * unit_price) stored,
  profit        numeric(12,2) generated always as (quantity * (unit_price - buy_price)) stored,
  created_at    timestamptz default now()
);

-- 4. STOCK TRANSFERS
create table if not exists transfers (
  id            uuid primary key default gen_random_uuid(),
  from_shop_id  uuid references shops(id) on delete set null,
  to_shop_id    uuid references shops(id) on delete set null,
  product_id    uuid references products(id) on delete set null,
  product_name  text not null,
  quantity      integer not null,
  notes         text,
  created_at    timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

alter table shops    enable row level security;
alter table products enable row level security;
alter table sales    enable row level security;
alter table transfers enable row level security;

-- Allow authenticated users (your admin) full access
create policy "Authenticated users can read shops"
  on shops for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert shops"
  on shops for insert with check (auth.role() = 'authenticated');

create policy "Authenticated users can update shops"
  on shops for update using (auth.role() = 'authenticated');

create policy "Authenticated users can read products"
  on products for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert products"
  on products for insert with check (auth.role() = 'authenticated');

create policy "Authenticated users can update products"
  on products for update using (auth.role() = 'authenticated');

create policy "Authenticated users can delete products"
  on products for delete using (auth.role() = 'authenticated');

create policy "Authenticated users can read sales"
  on sales for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert sales"
  on sales for insert with check (auth.role() = 'authenticated');

create policy "Authenticated users can read transfers"
  on transfers for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert transfers"
  on transfers for insert with check (auth.role() = 'authenticated');

-- ============================================================
-- SEED DATA — One shop (MVP)
-- ============================================================

insert into shops (name, location, manager_name, phone)
values ('TechMart CBD', 'Nairobi CBD, Ground Floor', 'John Kamau', '+254 700 000 001');

-- ============================================================
-- HELPER FUNCTION: update product updated_at on change
-- ============================================================

create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger products_updated_at
  before update on products
  for each row execute procedure update_updated_at();
