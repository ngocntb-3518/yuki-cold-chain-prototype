-- Atomic allocation of a whole order (FR-OUT-02). One function call = one transaction: every pick decrements its lot
-- only if enough quantity is still available; if any pick fails, nothing is allocated (no partial allocation), so two
-- planners allocating the same lot at the same time can never over-allocate. SECURITY INVOKER: caller's RLS applies.
create or replace function public.allocate_order(p_order_id text, p_picks jsonb, p_decision jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_pick jsonb;
  v_count integer := 0;
begin
  update public.orders set status = 'ALLOCATED' where id = p_order_id and status = 'OPEN';
  if not found then
    raise exception 'ORDER_NOT_OPEN' using errcode = 'P0001';
  end if;

  for v_pick in select * from jsonb_array_elements(p_picks) loop
    update public.lots
       set qty_available = qty_available - (v_pick->>'qty')::integer
     where id = (v_pick->>'lotId')::uuid
       and status = 'AVAILABLE'
       and qty_available >= (v_pick->>'qty')::integer;
    if not found then
      raise exception 'LOT_NOT_AVAILABLE:%', v_pick->>'lotCode' using errcode = 'P0001';
    end if;
    insert into public.allocations (order_id, lot_id, qty, decision, created_by)
    values (p_order_id, (v_pick->>'lotId')::uuid, (v_pick->>'qty')::integer, p_decision, (select auth.uid()));
    v_count := v_count + 1;
  end loop;

  insert into public.audit_events (action, entity, entity_id, detail, actor)
  values ('ALLOCATE', 'order', p_order_id, jsonb_build_object('picks', p_picks), (select auth.uid()));
  return v_count;
end;
$$;

revoke execute on function public.allocate_order(text, jsonb, jsonb) from public, anon;
grant execute on function public.allocate_order(text, jsonb, jsonb) to authenticated;
