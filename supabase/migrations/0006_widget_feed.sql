-- =====================================================================
-- 0006: javni feed za widget
-- =====================================================================

-- Jedina javna vrata do recenzija: vraća samo odobrene recenzije jednog widgeta.
-- p_host je domena stranice koja ugrađuje widget (iz zaglavlja Origin).
create or replace function get_widget_feed(p_public_key text, p_host text default null)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_w      widgets;
  v_host   text := lower(regexp_replace(coalesce(p_host, ''), '^www\.', ''));
  v_limit  int;
  v_min    int;
  v_result jsonb;
begin
  select * into v_w from widgets where public_key = p_public_key and is_active;
  if v_w.id is null then return null; end if;

  -- član brenda uvijek vidi vlastiti widget (pregled u dashboardu)
  if cardinality(v_w.allowed_domains) > 0 and not is_brand_member(v_w.brand_id) and not exists (
       select 1 from unnest(v_w.allowed_domains) d
        where v_host = d or v_host like '%.' || d) then
    return jsonb_build_object('error', 'DOMAIN_NOT_ALLOWED');
  end if;

  v_limit := least(greatest(coalesce((v_w.config->>'limit')::int, 12), 1), 30);
  v_min   := least(greatest(coalesce((v_w.config->>'min_rating')::int, 1), 1), 5);

  select jsonb_build_object(
    'brand', (select name from brands where id = v_w.brand_id),
    'type', v_w.type,
    'summary', (
      select jsonb_build_object('count', count(*), 'average', round(avg(rating)::numeric, 1))
        from reviews
       where brand_id = v_w.brand_id and status = 'approved'
         and (v_w.campaign_id is null or campaign_id = v_w.campaign_id)),
    'reviews', coalesce((
      select jsonb_agg(x.item order by x.published_at desc)
        from (
          select r.published_at, jsonb_build_object(
                   'id', r.id, 'rating', r.rating, 'title', r.title, 'body', r.body,
                   'name', r.display_name, 'date', r.published_at,
                   'product', c.product_name, 'incentivized', r.is_incentivized,
                   'photos', coalesce((
                     select jsonb_agg(m.storage_path order by m.position)
                       from review_media m
                      where m.review_id = r.id and m.removed_at is null), '[]'::jsonb)
                 ) as item
            from reviews r
            join campaigns c on c.id = r.campaign_id
           where r.brand_id = v_w.brand_id and r.status = 'approved' and r.rating >= v_min
             and (v_w.campaign_id is null or r.campaign_id = v_w.campaign_id)
           order by r.published_at desc
           limit v_limit
        ) x), '[]'::jsonb)
  ) into v_result;
  return v_result;
end $$;

revoke execute on function get_widget_feed(text, text) from public;
grant  execute on function get_widget_feed(text, text) to anon, authenticated;
