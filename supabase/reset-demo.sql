-- Reset demo data: wipe every business table in public, then reload seed.sql.
-- Run in Supabase SQL Editor (one paste). auth.users (login accounts) is not touched.
truncate public.audit_events, public.allocations, public.inspections, public.delivery_history,
  public.route_legs, public.routes, public.drivers, public.temp_alarms, public.orders, public.lots,
  public.agreements, public.customers, public.skus, public.zone_policies restart identity;

-- Mock dataset for the prototype (no real business data). SKU and agreement masters follow the RFP fixtures R-02 / R-04;
-- customer names, lots, orders, alarms and routes are invented. Dates are relative to current_date so the demo
-- scenarios stay valid whenever the data is loaded.

insert into public.zone_policies (zone, min_c, max_c, policy_version, effective_from) values
  ('AMBIENT', 15.0, 25.0, 'YUKI-TEMP-2026.04', '2026-04-01'),
  ('CHILLED', 0.0, 5.0, 'YUKI-TEMP-2026.04', '2026-04-01'),
  ('FROZEN', null, -18.0, 'YUKI-TEMP-2026.04', '2026-04-01');

insert into public.skus (id, name, unit, zone, expiry_type, trace_lane) values
  ('AMB-001', '新潟県産包装精米5kg', 'bag', 'AMBIENT', 'BEST_BEFORE', 'rice'),
  ('AMB-002', '玄米せんべい12枚', 'pack', 'AMBIENT', 'BEST_BEFORE', 'internal_lot'),
  ('AMB-003', 'レトルト野菜カレー200g', 'pouch', 'AMBIENT', 'BEST_BEFORE', 'internal_lot'),
  ('AMB-004', 'ほうじ茶ティーバッグ20包', 'box', 'AMBIENT', 'BEST_BEFORE', 'internal_lot'),
  ('CHI-001', '国産牛スライス200g', 'tray', 'CHILLED', 'USE_BY', 'beef'),
  ('CHI-002', 'プレーンヨーグルト400g', 'cup', 'CHILLED', 'BEST_BEFORE', 'internal_lot'),
  ('CHI-003', '絹ごし豆腐300g', 'pack', 'CHILLED', 'USE_BY', 'internal_lot'),
  ('CHI-004', 'カットサラダ150g', 'bag', 'CHILLED', 'USE_BY', 'internal_lot'),
  ('FRO-001', '冷凍えび餃子12個', 'bag', 'FROZEN', 'BEST_BEFORE', 'internal_lot'),
  ('FRO-002', 'バニラアイス120ml', 'cup', 'FROZEN', 'BEST_BEFORE', 'internal_lot'),
  ('FRO-003', '冷凍うどん5食', 'bag', 'FROZEN', 'BEST_BEFORE', 'internal_lot'),
  ('FRO-004', '冷凍枝豆400g', 'bag', 'FROZEN', 'BEST_BEFORE', 'internal_lot');

insert into public.customers (id, name) values
  ('CUS-001', '（仮）さくらマート本町店'), ('CUS-002', '（仮）みなとフーズ'), ('CUS-003', '（仮）ひかり生協センター'),
  ('CUS-004', '（仮）あおば食品館'), ('CUS-005', '（仮）ゆずストア駅前店');

insert into public.agreements (id, customer_id, sku_id, delivery_term, window_rule) values
  ('AGR-001', 'CUS-001', 'AMB-001', 'AT_DOOR', 'ONE_THIRD'), ('AGR-002', 'CUS-001', 'CHI-001', 'AT_DOOR', 'ONE_HALF'),
  ('AGR-003', 'CUS-001', 'FRO-001', 'AT_DOOR', 'LABEL_DATE_ONLY'), ('AGR-004', 'CUS-002', 'AMB-002', 'ON_TRUCK', 'ONE_THIRD'),
  ('AGR-005', 'CUS-002', 'CHI-003', 'ON_TRUCK', 'ONE_HALF'), ('AGR-006', 'CUS-002', 'FRO-002', 'ON_TRUCK', 'LABEL_DATE_ONLY'),
  ('AGR-007', 'CUS-003', 'CHI-002', 'AT_DOOR', 'ONE_HALF'), ('AGR-008', 'CUS-003', 'CHI-004', 'AT_DOOR', null),
  ('AGR-009', 'CUS-003', 'FRO-003', 'AT_DOOR', 'LABEL_DATE_ONLY'), ('AGR-010', 'CUS-004', 'AMB-003', 'ON_TRUCK', 'ONE_THIRD'),
  ('AGR-011', 'CUS-004', 'CHI-001', 'ON_TRUCK', 'ONE_HALF'), ('AGR-012', 'CUS-004', 'FRO-004', 'ON_TRUCK', 'LABEL_DATE_ONLY'),
  ('AGR-013', 'CUS-005', 'AMB-004', 'AT_DOOR', 'ONE_THIRD'), ('AGR-014', 'CUS-005', 'CHI-002', 'AT_DOOR', null),
  ('AGR-015', 'CUS-005', 'FRO-001', 'AT_DOOR', 'LABEL_DATE_ONLY');

-- Lots: each line exercises one rule of the allocation order (comment = scenario)
insert into public.lots (lot_code, sku_id, supplier, mfg_date, expiry_date, qty_received, qty_available, location, status, beef_id, rice_origin, received_at) values
  -- 日付逆転禁止 for CUS-003 x CHI-002 (last received expiry = current_date + 30)
  ('L-CHI002-A', 'CHI-002', '（仮）北陸乳業', current_date - 2, current_date + 28, 60, 60, 'C-01-01', 'AVAILABLE', null, null, now() - interval '2 days'),
  ('L-CHI002-B', 'CHI-002', '（仮）北陸乳業', current_date, current_date + 30, 60, 60, 'C-01-01', 'AVAILABLE', null, null, now() - interval '1 day'),
  ('L-CHI002-Q', 'CHI-002', '（仮）北陸乳業', current_date - 5, current_date + 25, 30, 30, 'C-Q-01', 'QUARANTINE', null, null, now() - interval '3 days'),
  -- Beef (消費期限): one lot reaches its use-by date on the delivery date (hard stop); one is older than CUS-001's history
  ('L-CHI001-OLD', 'CHI-001', '（仮）東北ミート', current_date - 7, current_date + 1, 20, 20, 'C-02-01', 'AVAILABLE', '1234567890', null, now() - interval '6 days'),
  ('L-CHI001-A', 'CHI-001', '（仮）東北ミート', current_date - 3, current_date + 5, 40, 40, 'C-02-01', 'AVAILABLE', '2234567891', null, now() - interval '2 days'),
  ('L-CHI001-B', 'CHI-001', '（仮）東北ミート', current_date - 1, current_date + 7, 40, 40, 'C-02-01', 'AVAILABLE', '3234567892', null, now() - interval '1 day'),
  -- Rice (1/3 rule): old lot misses the 1/3 delivery window, new lot passes
  ('L-AMB001-OLD', 'AMB-001', '（仮）越後米穀', current_date - 200, current_date + 165, 50, 50, 'A-01-01', 'AVAILABLE', null, '新潟県（取引ID R-2026-0412）', now() - interval '190 days'),
  ('L-AMB001-NEW', 'AMB-001', '（仮）越後米穀', current_date - 30, current_date + 335, 80, 80, 'A-01-01', 'AVAILABLE', null, '新潟県（取引ID R-2026-0918）', now() - interval '25 days'),
  -- FEFO + FIFO tie-break: two frozen lots with the same expiry, received at different times
  ('L-FRO001-A', 'FRO-001', '（仮）関東冷食', current_date - 60, current_date + 300, 30, 30, 'F-01-01', 'AVAILABLE', null, null, now() - interval '20 days'),
  ('L-FRO001-B', 'FRO-001', '（仮）関東冷食', current_date - 60, current_date + 300, 30, 30, 'F-02-01', 'AVAILABLE', null, null, now() - interval '10 days'),
  ('L-FRO001-C', 'FRO-001', '（仮）関東冷食', current_date - 30, current_date + 330, 50, 50, 'F-02-01', 'AVAILABLE', null, null, now() - interval '5 days'),
  -- Zone mismatch: chilled salad found in an ambient location
  ('L-CHI004-A', 'CHI-004', '（仮）県央ベジ', current_date - 1, current_date + 4, 25, 25, 'A-03-01', 'AVAILABLE', null, null, now() - interval '1 day'),
  ('L-CHI003-A', 'CHI-003', '（仮）県央豆腐', current_date - 1, current_date + 6, 40, 40, 'C-03-01', 'AVAILABLE', null, null, now() - interval '1 day');

-- Accepted delivery history (reference for 日付逆転禁止)
insert into public.delivery_history (customer_id, sku_id, expiry_date, received_at, source) values
  ('CUS-003', 'CHI-002', current_date + 30, now() - interval '1 day', 'MIGRATED'),
  ('CUS-003', 'CHI-002', current_date + 20, now() - interval '8 days', 'MIGRATED'),
  ('CUS-001', 'CHI-001', current_date + 6, now() - interval '1 day', 'MIGRATED'),
  ('CUS-001', 'FRO-001', current_date + 250, now() - interval '30 days', 'MIGRATED');

insert into public.orders (id, customer_id, sku_id, qty, requested_date, status) values
  ('ORD-001', 'CUS-003', 'CHI-002', 20, current_date + 1, 'OPEN'),
  ('ORD-002', 'CUS-001', 'CHI-001', 10, current_date + 1, 'OPEN'),
  ('ORD-003', 'CUS-004', 'CHI-001', 10, current_date + 1, 'OPEN'),
  ('ORD-004', 'CUS-001', 'AMB-001', 30, current_date + 1, 'OPEN'),
  ('ORD-005', 'CUS-005', 'CHI-002', 10, current_date + 1, 'OPEN'),
  ('ORD-006', 'CUS-001', 'FRO-001', 40, current_date + 1, 'OPEN'),
  ('ORD-007', 'CUS-003', 'CHI-004', 5, current_date + 1, 'OPEN'),
  ('ORD-008', 'CUS-002', 'CHI-003', 15, current_date + 1, 'OPEN');

insert into public.temp_alarms (logger, zone, first_at, last_at, peak_c, policy_version, source_file, created_at, acknowledged_at) values
  ('DL-C01', 'CHILLED', now() - interval '40 minutes', now() - interval '25 minutes', 7.2, 'YUKI-TEMP-2026.04', 'logger-DL-C01-sample.csv', now() - interval '5 minutes', null),
  ('DL-F01', 'FROZEN', now() - interval '70 minutes', now() - interval '55 minutes', -15.0, 'YUKI-TEMP-2026.04', 'logger-DL-F01-sample.csv', now() - interval '22 minutes', null),
  ('DL-A01', 'AMBIENT', now() - interval '1 day', now() - interval '23 hours', 27.5, 'YUKI-TEMP-2026.04', 'logger-DL-A01-sample.csv', now() - interval '23 hours', now() - interval '22 hours 50 minutes');

insert into public.drivers (id, name) values ('DRV-01', '（仮）運転手 A'), ('DRV-02', '（仮）運転手 B'), ('DRV-03', '（仮）運転手 C');

insert into public.routes (id, driver_id, route_date, start_time, extension_approved, status) values
  ('RT-000', 'DRV-01', current_date, '06:00', false, 'PUBLISHED'),
  ('RT-001', 'DRV-01', current_date + 1, '06:00', false, 'DRAFT'),
  ('RT-002', 'DRV-02', current_date + 1, '05:30', false, 'DRAFT'),
  ('RT-003', 'DRV-03', current_date + 1, '05:00', false, 'DRAFT');

insert into public.route_legs (route_id, seq, kind, minutes, label) values
  ('RT-000', 1, 'DRIVE', 180, 'センター→CUS-001'), ('RT-000', 2, 'SERVICE', 30, 'CUS-001 納品'), ('RT-000', 3, 'BREAK', 60, '休憩'), ('RT-000', 4, 'DRIVE', 180, '帰庫'),
  -- RT-001: compliant plan (9h restraint; rest after RT-000 ends 13:30 = 16h30 > 11h; every drive block <= 4h before a break)
  ('RT-001', 1, 'DRIVE', 150, 'センター→CUS-003'), ('RT-001', 2, 'SERVICE', 30, 'CUS-003 納品'), ('RT-001', 3, 'BREAK', 30, '休憩'),
  ('RT-001', 4, 'DRIVE', 120, 'CUS-003→CUS-004'), ('RT-001', 5, 'SERVICE', 30, 'CUS-004 納品'), ('RT-001', 6, 'BREAK', 30, '休憩'),
  ('RT-001', 7, 'DRIVE', 150, '帰庫'),
  -- RT-002: 4h20 continuous driving and 14h restraint without an approved extension -> must not publish
  ('RT-002', 1, 'DRIVE', 260, 'センター→CUS-002（連続運転）'), ('RT-002', 2, 'SERVICE', 40, 'CUS-002 納品'), ('RT-002', 3, 'WAIT', 120, '荷待ち'),
  ('RT-002', 4, 'BREAK', 45, '休憩'), ('RT-002', 5, 'DRIVE', 210, 'CUS-002→CUS-005'), ('RT-002', 6, 'SERVICE', 40, 'CUS-005 納品'),
  ('RT-002', 7, 'BREAK', 30, '休憩'), ('RT-002', 8, 'DRIVE', 95, '帰庫'),
  -- RT-003: 15h30 restraint -> exceeds the 15h maximum
  ('RT-003', 1, 'DRIVE', 200, 'センター→CUS-001'), ('RT-003', 2, 'BREAK', 30, '休憩'), ('RT-003', 3, 'SERVICE', 60, 'CUS-001 納品'),
  ('RT-003', 4, 'WAIT', 180, '荷待ち'), ('RT-003', 5, 'DRIVE', 200, 'CUS-001→CUS-005'), ('RT-003', 6, 'BREAK', 30, '休憩'),
  ('RT-003', 7, 'SERVICE', 60, 'CUS-005 納品'), ('RT-003', 8, 'DRIVE', 170, '帰庫');
