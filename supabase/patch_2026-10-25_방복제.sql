-- 2026-10-25 망령: 방은 관리자만 만든다 + 로비에서 방 복제. Supabase 대시보드 → SQL Editor 에 붙여 넣고 Run. 여러 번 실행해도 된다.
--   * om_room_new: 관리자 계정만 (방 기본값 · 같이 들어갈 계정은 예전처럼 들어간다)
--   * om_create_room(예전 GM 링크 방식 방 만들기): 브라우저에서 직접 못 부른다. om_room_new · om_room_copy 안에서만 쓴다
--   * om_room_copy: 관리자가 방 하나를 통째로 복제한다 — 방 설정 · 상태(RP 무대 · 시트 · 로스터 …) 는 늘 복사, 채팅 로그는 복사하지 않는다
--     p_opts: {members:멤버(GM·PL 권한) 같이, seats:PL 자리 그대로, battle:진행 중인 배틀 비우기, secret:GM 메모 같이} — 빠지면 모두 true

create or replace function public.om_room_new(p_token text, p_name text)
returns text language plpgsql security definer set search_path = public as $$
declare u text; rid text; m jsonb;
begin
  u := om_uid(p_token);
  if u is null then raise exception '로그인이 끝났습니다'; end if;
  if not om_is_admin(p_token) then raise exception '방은 관리자만 만들 수 있습니다'; end if;
  rid := om_create_room(p_name, encode(extensions.gen_random_bytes(18), 'hex'));   -- 예전 GM 비밀값 자리는 아무도 모르는 값으로
  insert into om_members(room, uid, role, seat) values (rid, u, 'gm', '') on conflict (room, uid) do update set role = 'gm', seat = '';
  for m in select x from om_config c, jsonb_array_elements(case when jsonb_typeof(c.v->'members') = 'array' then c.v->'members' else '[]'::jsonb end) x where c.k = 'room_defaults' loop
    if (m->>'uid') is not null and (m->>'uid') <> u and (m->>'role') in ('gm','pl') and exists (select 1 from om_users where uid = m->>'uid') then
      insert into om_members(room, uid, role, seat) values (rid, m->>'uid', m->>'role', '') on conflict (room, uid) do nothing;
    end if;
  end loop;
  return rid;
end $$;

create or replace function public.om_room_copy(p_token text, p_room text, p_name text, p_opts jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare u text; rid text; st jsonb; src text; o jsonb := coalesce(p_opts, '{}'::jsonb);
  o_mem boolean := coalesce((o->>'members')::boolean, true);
  o_seat boolean := coalesce((o->>'seats')::boolean, true);
  o_bat boolean := coalesce((o->>'battle')::boolean, true);
  o_sec boolean := coalesce((o->>'secret')::boolean, true);
begin
  u := om_uid(p_token);
  if u is null then raise exception '로그인이 끝났습니다'; end if;
  if not om_is_admin(p_token) then raise exception '방은 관리자만 만들 수 있습니다'; end if;
  select name into src from om_rooms where id = p_room;
  if src is null then raise exception '그 방이 없습니다'; end if;
  rid := lower(substr(replace(gen_random_uuid()::text,'-',''), 1, 10));
  insert into om_rooms(id, name, settings) select rid, coalesce(nullif(trim(p_name), ''), src || ' (복제)'), settings from om_rooms where id = p_room;
  insert into om_auth(room, role, seat, hash) values (rid, 'gm', '', om_hash(encode(extensions.gen_random_bytes(18), 'hex')));
  select data into st from om_state where room = p_room;
  st := coalesce(st, jsonb_build_object('seats', '{}'::jsonb, 'scene', 'rp', 'battle', '{}'::jsonb));
  if o_bat then st := st || jsonb_build_object('battle', '{}'::jsonb); end if;
  if not o_seat then st := st || jsonb_build_object('seats', '{}'::jsonb); end if;
  insert into om_state(room, data) values (rid, st);
  if o_seat then
    insert into om_auth(room, role, seat, hash, name) select rid, role, seat, hash, name from om_auth where room = p_room and role = 'seat';
  end if;
  if o_mem then
    insert into om_members(room, uid, role, seat) select rid, uid, role, case when o_seat then seat else '' end from om_members where room = p_room on conflict (room, uid) do nothing;
  end if;
  insert into om_members(room, uid, role, seat) values (rid, u, 'gm', '') on conflict (room, uid) do update set role = 'gm', seat = '';
  if o_sec then
    insert into om_secret(room, kind, id, data) select rid, kind, id, data from om_secret where room = p_room and kind not in ('cmd', 'peek');
  end if;
  insert into om_log(room, kind, who, data) values (rid, 'sys', '', jsonb_build_object('t', '「' || src || '」 방을 복제했다.'));
  return rid;
end $$;

grant execute on function public.om_room_new(text,text) to anon, authenticated;
grant execute on function public.om_room_copy(text,text,text,jsonb) to anon, authenticated;
revoke execute on function public.om_create_room(text,text) from public, anon, authenticated;
