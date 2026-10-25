-- 001_init.sql: Weekend 1 schema for MacPlusSupport Office
-- Every row belongs to a business. Each signed-in Microsoft account gets its own demo business.

create extension if not exists pgcrypto;

create table businesses (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

-- One row per Microsoft account that has signed in.
-- home_account_id is MSAL's stable id: "<objectId>.<tenantId>".
create table app_users (
  home_account_id text primary key,
  business_id     uuid not null references businesses(id) on delete cascade,
  email           text not null,
  display_name    text,
  tenant_id       text not null,
  created_at      timestamptz not null default now(),
  last_login_at   timestamptz not null default now()
);

-- MSAL token cache, one row per browser session, encrypted by the app before it is stored.
create table msal_token_cache (
  partition_key text primary key,
  data          text not null,
  updated_at    timestamptz not null default now()
);

create table clients (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name        text not null,
  email       text,
  phone       text,
  created_at  timestamptz not null default now()
);
create index clients_business_idx on clients (business_id);

-- One counter row per business per year. The invoice insert bumps this row inside the same
-- transaction, so numbers are unique AND gap-free, even with many users creating at once.
create table invoice_counters (
  business_id uuid    not null references businesses(id) on delete cascade,
  year        integer not null,
  next_number integer not null,
  primary key (business_id, year)
);

create table invoices (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references businesses(id) on delete cascade,
  client_id      uuid not null references clients(id),
  year           integer not null,
  seq            integer not null,
  number         text not null,
  status         text not null default 'draft'
                 check (status in ('draft', 'sent', 'paid', 'void')),
  currency       text not null default 'usd',
  subtotal_cents integer not null check (subtotal_cents >= 0),
  total_cents    integer not null check (total_cents >= 0),
  issue_date     date not null default current_date,
  due_date       date not null,
  notes          text,
  created_by     text references app_users(home_account_id),
  created_at     timestamptz not null default now(),
  -- Backstop: even if application code were wrong, Postgres refuses a duplicate.
  unique (business_id, number),
  unique (business_id, year, seq)
);
create index invoices_business_created_idx on invoices (business_id, created_at desc);

create table invoice_line_items (
  id               uuid primary key default gen_random_uuid(),
  invoice_id       uuid not null references invoices(id) on delete cascade,
  position         integer not null,
  description      text not null,
  quantity         numeric(10, 2) not null check (quantity > 0),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  line_total_cents integer not null check (line_total_cents >= 0)
);
create index line_items_invoice_idx on invoice_line_items (invoice_id);
