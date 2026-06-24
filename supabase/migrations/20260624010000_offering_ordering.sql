-- Created with `supabase migration new offering_ordering`.

alter table public.offerings
  add column if not exists sort_order integer,
  add column if not exists is_standalone_bookable boolean not null default true;

with ranked as (
  select
    id,
    row_number() over (
      partition by location_id, available_as_addon
      order by created_at asc, id asc
    ) as position
  from public.offerings
)
update public.offerings as offering
set sort_order = ranked.position
from ranked
where offering.id = ranked.id
  and offering.sort_order is null;

alter table public.offerings
  alter column sort_order set default 1,
  alter column sort_order set not null;

create index if not exists idx_offerings_location_group_order
  on public.offerings (location_id, available_as_addon, sort_order);

create or replace function public.reorder_offerings(
  p_location_id uuid,
  p_available_as_addon boolean,
  p_offering_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_organization_id uuid;
  v_expected_count integer;
  v_matching_count integer;
  v_updated_count integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Nicht autorisiert' using errcode = '42501';
  end if;

  if p_offering_ids is null or cardinality(p_offering_ids) = 0 then
    raise exception 'Die Reihenfolge darf nicht leer sein' using errcode = '22023';
  end if;

  if cardinality(p_offering_ids) <> (
    select count(distinct submitted.id)
    from unnest(p_offering_ids) as submitted(id)
  ) then
    raise exception 'Leistungs-IDs dürfen nicht doppelt vorkommen' using errcode = '22023';
  end if;

  select location.organization_id
  into v_organization_id
  from public.locations as location
  where location.id = p_location_id;

  if v_organization_id is null then
    raise exception 'Standort nicht gefunden' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.user_organizations as membership
    where membership.user_id = (select auth.uid())
      and membership.organization_id = v_organization_id
      and membership.role in ('owner', 'admin', 'manager')
  ) then
    raise exception 'Nicht autorisiert' using errcode = '42501';
  end if;

  select count(*)
  into v_expected_count
  from public.offerings as offering
  where offering.location_id = p_location_id
    and offering.available_as_addon = p_available_as_addon;

  select count(*)
  into v_matching_count
  from public.offerings as offering
  where offering.id = any(p_offering_ids)
    and offering.location_id = p_location_id
    and offering.available_as_addon = p_available_as_addon;

  if v_expected_count <> cardinality(p_offering_ids)
    or v_matching_count <> cardinality(p_offering_ids) then
    raise exception 'Die übermittelte Reihenfolge ist unvollständig oder ungültig'
      using errcode = '22023';
  end if;

  update public.offerings as offering
  set sort_order = ordered.position::integer
  from unnest(p_offering_ids) with ordinality as ordered(id, position)
  where offering.id = ordered.id;

  get diagnostics v_updated_count = row_count;

  if v_updated_count <> cardinality(p_offering_ids) then
    raise exception 'Reihenfolge konnte nicht vollständig gespeichert werden'
      using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.reorder_offerings(uuid, boolean, uuid[]) from public;
revoke all on function public.reorder_offerings(uuid, boolean, uuid[]) from anon;
grant execute on function public.reorder_offerings(uuid, boolean, uuid[]) to authenticated;
