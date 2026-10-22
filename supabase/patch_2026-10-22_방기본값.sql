-- 2026-10-22 망령: 관리자 「방 기본값」 — 새로 만드는 방에 들어갈 설정을 한곳에서 정한다.
-- Supabase 대시보드 → SQL Editor 에 붙여 넣고 Run. 여러 번 실행해도 된다.
-- 기본값 모양 (om_config k='room_defaults'):
--   { settings:{accountOnly}, state:{scene, rp:{plBattle, seatOwn, gmHands, pct, bg, bgm, notices, bgList}}, members:[{uid, role:'gm'|'pl'}] }
-- 새 방(om_create_room · om_room_new) 이 만들어질 때 settings 는 om_rooms.settings 에, state 는 om_state.data 에 덧붙고,
-- members 는 계정으로 만든 방(om_room_new)에서 그 계정들을 GM · PL 로 같이 넣는다. 이미 있는 방은 관리자 패널의 「기존 방에 적용」으로.
create table if not exists public.om_config (
  k           text primary key,
  v           jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);
alter table public.om_config enable row level security;   -- 정책 없음: 아래 함수로만 읽고 쓴다

create or replace function public.om_config_get(p_token text, p_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not om_is_admin(p_token) then raise exception '관리자만'; end if;
  return (select v from om_config where k = p_key);
end $$;

create or replace function public.om_config_set(p_token text, p_key text, p_v jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not om_is_admin(p_token) then raise exception '관리자만'; end if;
  if p_v is null then delete from om_config where k = p_key; return true; end if;
  insert into om_config(k, v, updated_at) values (p_key, p_v, now()) on conflict (k) do update set v = excluded.v, updated_at = now();
  return true;
end $$;

-- 새 방에 기본값 덧붙이기 (안에서만 쓴다)
create or replace function public.om_apply_defaults(p_room text)
returns void language plpgsql security definer set search_path = public as $$
declare d jsonb;
begin
  select v into d from om_config where k = 'room_defaults';
  if d is null then return; end if;
  if jsonb_typeof(d->'settings') = 'object' then
    update om_rooms set settings = settings || (d->'settings') where id = p_room;
  end if;
  if jsonb_typeof(d->'state') = 'object' then
    update om_state set data = data || (d->'state'), v = v + 1, updated_at = now() where room = p_room;
  end if;
end $$;

create or replace function public.om_create_room(p_name text, p_gm_secret text)
returns text language plpgsql security definer set search_path = public as $$
declare rid text;
begin
  if length(coalesce(p_gm_secret,'')) < 8 then raise exception 'GM 비밀값이 너무 짧습니다'; end if;
  rid := lower(substr(replace(gen_random_uuid()::text,'-',''), 1, 10));
  insert into om_rooms(id, name) values (rid, coalesce(p_name,''));
  insert into om_auth(room, role, seat, hash) values (rid, 'gm', '', om_hash(p_gm_secret));
  insert into om_state(room, data) values (rid, jsonb_build_object('seats', '{}'::jsonb, 'scene', 'rp', 'battle', '{}'::jsonb));
  perform om_apply_defaults(rid);
  insert into om_log(room, kind, who, data) values (rid, 'sys', '', jsonb_build_object('t', '방을 만들었다.'));
  return rid;
end $$;

create or replace function public.om_room_new(p_token text, p_name text)
returns text language plpgsql security definer set search_path = public as $$
declare u text; rid text; m jsonb;
begin
  u := om_uid(p_token);
  if u is null then raise exception '로그인이 끝났습니다'; end if;
  rid := om_create_room(p_name, encode(extensions.gen_random_bytes(18), 'hex'));   -- 예전 GM 비밀값 자리는 아무도 모르는 값으로
  insert into om_members(room, uid, role, seat) values (rid, u, 'gm', '') on conflict (room, uid) do update set role = 'gm', seat = '';
  for m in select x from om_config c, jsonb_array_elements(case when jsonb_typeof(c.v->'members') = 'array' then c.v->'members' else '[]'::jsonb end) x where c.k = 'room_defaults' loop
    if (m->>'uid') is not null and (m->>'uid') <> u and (m->>'role') in ('gm','pl') and exists (select 1 from om_users where uid = m->>'uid') then
      insert into om_members(room, uid, role, seat) values (rid, m->>'uid', m->>'role', '') on conflict (room, uid) do nothing;
    end if;
  end loop;
  return rid;
end $$;

grant execute on function public.om_config_get(text,text) to anon, authenticated;
grant execute on function public.om_config_set(text,text,jsonb) to anon, authenticated;
grant execute on function public.om_create_room(text,text) to anon, authenticated;
grant execute on function public.om_room_new(text,text) to anon, authenticated;
revoke execute on function public.om_apply_defaults(text) from public, anon, authenticated;
