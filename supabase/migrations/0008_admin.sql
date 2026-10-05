-- =====================================================================
-- 0008: admin — uvid u sve, eskalacije, skidanje suspenzije
-- =====================================================================

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

-- Admin čita sve; pisanje ide isključivo kroz funkcije ispod.
create policy admin_read_profiles      on profiles      for select using (is_admin());
create policy admin_read_brand_members on brand_members for select using (is_admin());
create policy admin_read_campaigns     on campaigns     for select using (is_admin());
create policy admin_read_orders        on orders        for select using (is_admin());
create policy admin_read_reviews       on reviews       for select using (is_admin());
create policy admin_read_review_media  on review_media  for select using (is_admin());
create policy admin_read_trust_events  on trust_events  for select using (is_admin());

create policy purchase_proofs_read_admin on storage.objects for select to authenticated
  using (bucket_id = 'purchase-proofs' and public.is_admin());

-- Narudžba koju brend nije obradio: admin potvrđuje kupnju ili otkazuje bez kazne za testera.
create or replace function admin_resolve_order(p_order_id uuid, p_action text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_o orders; v_c campaigns;
begin
  if not is_admin() then raise exception 'NOT_AUTHORIZED'; end if;
  select * into v_o from orders where id = p_order_id for update;
  if v_o.id is null then raise exception 'NOT_FOUND'; end if;
  select * into v_c from campaigns where id = v_o.campaign_id;

  if p_action = 'verify' then
    if v_o.status <> 'purchase_submitted' then raise exception 'INVALID_STATUS'; end if;
    update orders
       set status = 'purchase_verified', verification_method = 'manual',
           purchase_verified_at = now(), verified_by = auth.uid(),
           review_due_at = now() + make_interval(days => v_c.review_deadline_days)
     where id = v_o.id;
  elsif p_action = 'cancel' then
    if v_o.status not in ('claimed', 'purchase_submitted') then raise exception 'INVALID_STATUS'; end if;
    update orders set status = 'cancelled' where id = v_o.id;
    update campaigns set slots_taken = greatest(slots_taken - 1, 0) where id = v_o.campaign_id;
    update campaign_coupons set order_id = null, assigned_at = null where order_id = v_o.id;
  else
    raise exception 'INVALID_ACTION';
  end if;
end $$;

create or replace function admin_lift_suspension(p_tester_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'NOT_AUTHORIZED'; end if;
  update profiles set status = 'active', suspended_until = null
   where id = p_tester_id and status = 'suspended';
  if not found then raise exception 'INVALID_STATUS'; end if;
  insert into trust_events (tester_id, event_type, delta, note)
  values (p_tester_id, 'manual', 0, 'Suspenziju skinuo admin');
end $$;

-- is_admin se poziva iz politika, pa je moraju smjeti izvršiti i anonimni posjetitelji.
revoke execute on function admin_resolve_order(uuid, text), admin_lift_suspension(uuid)
  from public, anon;
grant execute on function admin_resolve_order(uuid, text), admin_lift_suspension(uuid)
  to authenticated;
