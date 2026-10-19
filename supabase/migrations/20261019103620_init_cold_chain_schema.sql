-- Product B prototype: cold-chain warehouse (三温度帯) core tables.
-- Scope: inbound inspection, lots/quarantine, allocation rules (消費期限 / 日付逆転禁止 / 納品期限), temperature alarms,
-- driver-hour route check, traceability. Business events are append-only (audit_events); no hard deletes from the app.

create table public.zone_policies (
  zone text primary key check (zone in ('AMBIENT', 'CHILLED', 'FROZEN')),
  min_c numeric(4,1),            -- null = no lower bound
  max_c numeric(4,1) not null,
  policy_version text not null,  -- Yuki's own policy (not a national standard), versioned by effective date
  effective_from date not null
);

create table public.skus (
  id text primary key,
  name text not null,
  unit text not null,
  zone text not null references public.zone_policies(zone),
  expiry_type text not null check (expiry_type in ('BEST_BEFORE', 'USE_BY')),  -- 賞味期限 / 消費期限
  trace_lane text not null check (trace_lane in ('rice', 'beef', 'internal_lot'))
);

create table public.customers (
  id text primary key,
  name text not null
);

create table public.agreements (
  id text primary key,
  customer_id text not null references public.customers(id),
  sku_id text not null references public.skus(id),
  delivery_term text not null check (delivery_term in ('ON_TRUCK', 'AT_DOOR')),  -- 車上渡し / 軒先渡し
  window_rule text check (window_rule in ('ONE_THIRD', 'ONE_HALF', 'LABEL_DATE_ONLY')),  -- null = not agreed yet -> business review
  unique (customer_id, sku_id)
);

create table public.lots (
  id uuid primary key default gen_random_uuid(),
  lot_code text not null unique,
  sku_id text not null references public.skus(id),
  supplier text not null,
  mfg_date date not null,
  expiry_date date not null,
  qty_received integer not null check (qty_received > 0),
  qty_available integer not null check (qty_available >= 0),
  location text not null,
  status text not null default 'AVAILABLE' check (status in ('AVAILABLE', 'QUARANTINE', 'SCRAPPED')),
  beef_id text check (beef_id ~ '^[0-9]{10}$'),   -- 牛個体識別番号: exactly 10 digits
  rice_origin text,
  received_at timestamptz not null default now()
);
create index lots_sku_status_idx on public.lots (sku_id, status, expiry_date);

create table public.inspections (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid references public.lots(id),
  sku_id text not null references public.skus(id),
  lot_code text not null,
  expiry_date date not null,
  qty integer not null,
  measured_temp_c numeric(4,1) not null,
  result text not null check (result in ('ACCEPTED', 'QUARANTINED')),
  reason text,
  policy_version text not null,
  inspected_by uuid,
  created_at timestamptz not null default now()
);

create table public.orders (
  id text primary key,
  customer_id text not null references public.customers(id),
  sku_id text not null references public.skus(id),
  qty integer not null check (qty > 0),
  requested_date date not null,
  status text not null default 'OPEN' check (status in ('OPEN', 'ALLOCATED', 'SHIPPED', 'BUSINESS_REVIEW'))
);

create table public.allocations (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references public.orders(id),
  lot_id uuid not null references public.lots(id),
  qty integer not null check (qty > 0),
  decision jsonb not null,        -- rule results and versions used for the decision (判定ログ)
  created_by uuid,
  created_at timestamptz not null default now()
);
create index allocations_order_idx on public.allocations (order_id);
create index allocations_lot_idx on public.allocations (lot_id);

-- Accepted (received) deliveries per customer x SKU: the reference for 日付逆転禁止. Immutable history.
create table public.delivery_history (
  id uuid primary key default gen_random_uuid(),
  customer_id text not null references public.customers(id),
  sku_id text not null references public.skus(id),
  lot_id uuid references public.lots(id),
  expiry_date date not null,
  received_at timestamptz not null,
  source text not null default 'SYSTEM' check (source in ('SYSTEM', 'MIGRATED'))
);
create index delivery_history_customer_sku_idx on public.delivery_history (customer_id, sku_id, received_at desc);

create table public.temp_alarms (
  id uuid primary key default gen_random_uuid(),
  logger text not null,
  zone text not null references public.zone_policies(zone),
  first_at timestamptz not null,
  last_at timestamptz not null,
  peak_c numeric(4,1) not null,
  policy_version text not null,
  source_file text,
  created_at timestamptz not null default now(),   -- review SLA (15 min) counts from here (assumption Q02)
  acknowledged_at timestamptz,
  acknowledged_by uuid
);

create table public.drivers (
  id text primary key,
  name text not null
);

create table public.routes (
  id text primary key,
  driver_id text not null references public.drivers(id),
  route_date date not null,
  start_time time not null,
  extension_approved boolean not null default false,  -- 13h->15h extension condition met (details pending Q21)
  status text not null default 'DRAFT' check (status in ('DRAFT', 'PUBLISHED')),
  rule_version text,
  published_at timestamptz
);

create table public.route_legs (
  id uuid primary key default gen_random_uuid(),
  route_id text not null references public.routes(id),
  seq integer not null,
  kind text not null check (kind in ('DRIVE', 'BREAK', 'SERVICE', 'WAIT')),
  minutes integer not null check (minutes > 0),
  label text,
  unique (route_id, seq)
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  action text not null,
  entity text not null,
  entity_id text not null,
  detail jsonb,
  actor uuid,
  at timestamptz not null default now()
);

-- Row level security: prototype access model = every signed-in staff member can read and write operational data.
-- Role separation (QC / planner / driver) is out of scope for the prototype (see README).
do $$
declare t text;
begin
  foreach t in array array['zone_policies','skus','customers','agreements','lots','inspections','orders','allocations',
                           'delivery_history','temp_alarms','drivers','routes','route_legs','audit_events'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant select, insert on public.%I to authenticated', t);
    execute format('create policy "staff read %1$s" on public.%1$I for select to authenticated using (true)', t);
    execute format('create policy "staff insert %1$s" on public.%1$I for insert to authenticated with check (true)', t);
  end loop;
  -- Mutable operational state only; history tables (inspections, allocations, delivery_history, audit_events) stay append-only
  foreach t in array array['lots','orders','temp_alarms','routes','agreements'] loop
    execute format('grant update on public.%I to authenticated', t);
    execute format('create policy "staff update %1$s" on public.%1$I for update to authenticated using (true) with check (true)', t);
  end loop;
end $$;
grant usage on sequence public.audit_events_id_seq to authenticated;
