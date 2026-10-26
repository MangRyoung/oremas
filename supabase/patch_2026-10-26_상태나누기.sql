-- 2026-10-26 망령: 저장 한 번에 쓰는 양 줄이기 (방 상태 나눠 담기)
--
-- 왜: 방 상태(om_state.data)가 한 줄에 다 들어 있어서(큰 방은 370KB 쯤), HP 하나를 바꿔도 Postgres 가 370KB 를 통째로 새로 쓰고,
--     바뀐 곳을 찾느라 옛 값 · 새 값 370KB 를 두 번 더 읽었다. 작은 서버에서는 이게 쌓여 「저장 실패」· 채팅 로딩 지연이 났다.
-- 어떻게: 자주 바뀌고 큰 두 덩어리를 따로 담는다 — om_part 표
--     · 'battle'      ← data.battle 전체 (배틀 중 가장 자주 바뀐다)
--     · 'm:<포켓몬 id>' ← data.roster.mons.<id> 하나씩 (상태의 3분의 2가 포켓몬 시트)
--   나머지(rp · roster.trainers · graph …)는 지금처럼 om_state.data 에 남는다. 버전(v)도 om_state 에 그대로.
--   이제 포켓몬 HP 하나를 바꾸면 그 포켓몬 한 마리(몇 KB)만 새로 쓰고, 배틀 칸을 바꾸면 배틀만 새로 쓴다.
-- 화면: 합친 상태는 om_get_state(방) 으로 읽고, 쓰기는 om_put(…) 으로 한다 (js/store.js). 실시간 신호('st')는 예전과 같은 모양.
-- 옛 화면: 옛 om_set_state 는 「새로고침 해 달라」는 오류만 낸다 — 옛 화면이 배틀 · 포켓몬이 빠진 상태를 보고 덮어쓰지 못하게.
--   ⇒ 이 SQL 을 돌린 뒤에는 방에 있는 모두가 새로고침(F5) 한 번.
-- 여러 번 실행해도 된다. 데이터를 지우지 않는다 (옮기기만). 되돌리는 법은 맨 아래.
-- ⚠ 이 파일을 돌린 뒤 schema.sql 이나 10-20 ~ 10-25 패치를 다시 돌리면 옛 함수 · 트리거가 돌아와 이 변경이 깨진다 — 그랬다면 이 파일을 곧바로 한 번 더 돌릴 것.

-- ---------- 0. 백업 (처음 돌릴 때 한 번만 · 다시 돌려도 덮어쓰지 않는다) ----------
-- om_bak_20261026     : 돌리기 직전의 방 상태 전부 (room · data · v · updated_at)
-- om_bak_20261026_fn  : 돌리기 직전의 om_* 함수 정의 · om_state 트리거 정의
-- 둘 다 RLS 를 켜고 정책을 두지 않아 화면(anon)에서는 못 읽는다. 대시보드 Table Editor 에서만 보인다. 다 괜찮으면 나중에 drop table 로 지워도 된다.
create table if not exists public.om_bak_20261026 as
  select room, data, v, updated_at, now() as backed_at from public.om_state;
alter table public.om_bak_20261026 enable row level security;
create table if not exists public.om_bak_20261026_fn as
  select p.proname::text as name, pg_get_function_identity_arguments(p.oid) as args, pg_get_functiondef(p.oid) as def
    from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname like 'om\_%' and p.prokind = 'f'
  union all
  select t.tgname::text, 'trigger', pg_get_triggerdef(t.oid) || ';' from pg_trigger t where t.tgrelid = 'public.om_state'::regclass and not t.tgisinternal;
alter table public.om_bak_20261026_fn enable row level security;
revoke all on public.om_bak_20261026, public.om_bak_20261026_fn from anon, authenticated;

-- ---------- 표 ----------
create table if not exists public.om_part (
  room text not null references public.om_rooms(id) on delete cascade,
  k    text not null,          -- 'battle' | 'm:<포켓몬 id>'
  data jsonb not null,
  primary key (room, k)
);
alter table public.om_part enable row level security;   -- 정책 없음: 직접 읽기 · 쓰기는 막고, 아래 함수(security definer)로만
alter table public.om_part set (toast_tuple_target = 8160);  -- 포켓몬 한 마리 정도는 압축 없이 줄 안에 (쓰기가 가볍다)

-- ---------- 합친 상태 ----------
-- 나머지(om_state.data) 위에 배틀 조각 · 포켓몬 조각을 얹는다. 조각이 없으면 나머지에 남은 값을 그대로 쓴다 (아직 안 나뉜 방).
create or replace function public.om_full(p_room text)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when s.data is null then null else
    s.data
    || coalesce((select jsonb_build_object('battle', p.data) from om_part p where p.room = p_room and p.k = 'battle'), '{}'::jsonb)
    || jsonb_build_object('roster', case when jsonb_typeof(s.data->'roster') = 'object' then s.data->'roster' else '{}'::jsonb end
         || jsonb_build_object('mons', case
              when jsonb_typeof(s.data#>'{roster,mons}') not in ('object','null') and not exists (select 1 from om_part p where p.room = p_room and p.k like 'm:%') then s.data#>'{roster,mons}'   -- 상자가 아닌 옛 값은 그대로
              else coalesce(case when jsonb_typeof(s.data#>'{roster,mons}') = 'object' then s.data#>'{roster,mons}' end, '{}'::jsonb)
                   || coalesce((select jsonb_object_agg(substr(p.k, 3), p.data) from om_part p where p.room = p_room and p.k like 'm:%'), '{}'::jsonb) end))
  end
  from om_state s where s.room = p_room
$$;

-- 화면이 읽는 것: {data, v} (한 문장이라 data 와 v 가 같은 순간의 것)
create or replace function public.om_get_state(p_room text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('data', public.om_full(p_room), 'v', s.v) from om_state s where s.room = p_room
$$;

-- ---------- 나누기 ----------
-- 나머지에 배틀 · 포켓몬이 남아 있으면 조각으로 옮긴다 (처음 한 번 · 새 방 · 복제한 방). 합친 모양은 같으니 버전은 그대로, 신호도 없다.
create or replace function public.om_split(p_room text)
returns void language plpgsql security definer set search_path = public as $$
declare d jsonb;
begin
  select data into d from om_state where room = p_room;
  if d is null or (not (d ? 'battle') and jsonb_typeof(d #> '{roster,mons}') is distinct from 'object') then return; end if;
  select data into d from om_state where room = p_room for update;   -- 옮기는 동안 다른 쓰기는 기다린다
  if not (d ? 'battle') and jsonb_typeof(d #> '{roster,mons}') is distinct from 'object' then return; end if;
  if d ? 'battle' then
    insert into om_part(room, k, data) values (p_room, 'battle', d->'battle') on conflict (room, k) do nothing;   -- 조각이 이미 있으면 조각이 맞다
  end if;
  if jsonb_typeof(d #> '{roster,mons}') = 'object' then
    insert into om_part(room, k, data)
      select p_room, 'm:' || e.key, e.value from jsonb_each(d #> '{roster,mons}') e where jsonb_typeof(e.value) <> 'null'
      on conflict (room, k) do nothing;
  end if;
  perform set_config('om.quiet', '1', true);
  update om_state set data = case when jsonb_typeof(d #> '{roster,mons}') = 'object' then (d - 'battle') #- '{roster,mons}' else d - 'battle' end where room = p_room;
  perform set_config('om.quiet', '', true);
end $$;

-- ---------- 신호 ----------
create or replace function public.om_send(p_room text, msg jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform realtime.send(msg, 'st', 'om:' || p_room, false);
exception when others then
  raise warning 'om_send: %', sqlerrm;   -- 신호를 못 보내도 저장은 막지 않는다 (화면이 30초마다 버전을 확인한다)
end $$;

-- 나머지(om_state) 를 바꿀 때의 신호는 지금처럼 트리거가. om_put 이 조각을 바꾸며 버전만 올릴 때는 om.quiet 로 끄고 직접 보낸다
drop trigger if exists om_state_notify on public.om_state;
create trigger om_state_notify after update on public.om_state
  for each row when (coalesce(current_setting('om.quiet', true), '') <> '1' and (old.v is distinct from new.v or old.data is distinct from new.data))
  execute function public.om_state_notify();

-- ---------- 쓰기 ----------
create or replace function public.om_put(p_room text, p_secret text, p_path text[], p_value jsonb)
returns bigint language plpgsql security definer set search_path = public as $$
declare w text; nv bigint; rest jsonb; cur jsonb; seats text[]; oldv jsonb; newv jsonb; nfull jsonb; sub text[];
  plen int := coalesce(array_length(p_path, 1), 0);
  pk text; box boolean;
begin
  w := om_who(p_room, p_secret);
  if w is null then raise exception '권한이 없습니다'; end if;
  -- 방마다 한 줄씩 차례로 (예전처럼 한 줄을 고칠 때와 같은 순서 보장 · 잠금 순서: om_state → om_part)
  perform 1 from om_state s where s.room = p_room for update;
  select s.data into rest from om_state s where s.room = p_room;
  if rest is null then raise exception '그런 방이 없습니다'; end if;
  if rest ? 'battle' or jsonb_typeof(rest #> '{roster,mons}') = 'object' then   -- 아직 안 나뉜 방(새 방 · 복제한 방)이면 먼저 나눈다
    perform public.om_split(p_room);
    select s.data into rest from om_state s where s.room = p_room;
  end if;
  newv := case when p_value is null or jsonb_typeof(p_value) = 'null' then null else p_value end;
  box := plen = 0 or (p_path[1] = 'roster' and (plen = 1 or (plen = 2 and p_path[2] = 'mons')));   -- 상자째 (전체 · roster · roster.mons): 조각 여럿을 한꺼번에
  pk := case when box then null
             when p_path[1] = 'battle' then 'battle'
             when p_path[1] = 'roster' and p_path[2] = 'mons' then 'm:' || p_path[3] end;

  -- 권한 검사에 쓰는 상태: 나머지 + 필요한 조각만 (배틀 칸이면 배틀, 포켓몬 칸이면 그 포켓몬, 상자째면 전부)
  if box then cur := public.om_full(p_room);
  else
    cur := rest;
    if pk = 'battle' then cur := cur || coalesce((select jsonb_build_object('battle', p.data) from om_part p where p.room = p_room and p.k = 'battle'), '{}'::jsonb); end if;
    if pk like 'm:%' then cur := cur || jsonb_build_object('roster', coalesce(rest->'roster', '{}'::jsonb) || jsonb_build_object('mons',
                            coalesce((select jsonb_build_object(p_path[3], p.data) from om_part p where p.room = p_room and p.k = pk), '{}'::jsonb))); end if;
  end if;
  oldv := case when plen = 0 then cur else cur #> p_path end;

  -- (아래 검사는 om_set_state 와 같다 — 포켓몬 주인만 조각에서 찾는다)
  if w = 'gm' and cur #>> '{rp,gmHands}' = 'false' then
    select array_agg(a.seat) into seats from om_auth a where a.room = p_room and a.role = 'seat';
    if public.om_chk('fair', w, coalesce(p_path, '{}'::text[]), oldv, newv, cur, coalesce(seats, '{}'::text[])) is not true then
      raise exception '이 방은 GM 도 플레이어의 지시·준비를 바꿀 수 없다 (방 설정): %', array_to_string(p_path, '/');
    end if;
  end if;
  if w <> 'gm' and cur #>> '{rp,seatOwn}' = 'true' then
    if public.om_chk('seat', w, coalesce(p_path, '{}'::text[]), oldv, newv, cur, '{}'::text[]) is not true then
      raise exception '이 방은 자기 것만 바꿀 수 있다 (방 설정): %', array_to_string(p_path, '/');
    end if;
  end if;
  if w <> 'gm' then
    if plen < 1 then raise exception '좌석은 전체를 바꿀 수 없습니다'; end if;
    if plen < 2 and p_path[1] not in ('battle','ready') then raise exception '좌석은 전체를 바꿀 수 없습니다'; end if;
    if ((p_path[1] = 'seats' and p_path[2] = w) or (p_path[1] = 'ready') or (p_path[1] = 'pub' and public.om_own(cur, w, p_path[2]))
            or (p_path[1] = 'battle')
            or (p_path[1] = 'roster' and p_path[2] = 'trainers' and p_path[3] = w)
            or (p_path[1] = 'skill' and p_path[2] in ('trainers','res','hist'))
            or (p_path[1] = 'dex' and p_path[2] = w)
            or (p_path[1] = 'rp' and p_path[2] in ('bgm','recentBgm') and coalesce(cur #>> '{rp,plBattle}','') <> 'false' and coalesce(cur #>> '{rp,seatOwn}','') <> 'true')
            or (p_path[1] = 'roster' and p_path[2] = 'mons' and plen >= 3
                and coalesce(cur #>> array['roster','mons',p_path[3],'tid'], p_value->>'tid') = w)) is not true then
      raise exception '이 좌석이 바꿀 수 없는 곳입니다: %', array_to_string(p_path, '/');
    end if;
  end if;

  if box then
    -- 새 전체를 만들어 나머지 · 조각으로 다시 나눈다. 드문 쓰기라 모두에게 「다시 읽어」
    nfull := case when plen = 0 then coalesce(newv, '{}'::jsonb) when newv is null then cur #- p_path else public.om_jset(cur, p_path, newv) end;
    delete from om_part where room = p_room and (k like 'm:%' or (plen = 0 and k = 'battle'));
    if plen = 0 and nfull ? 'battle' then insert into om_part(room, k, data) values (p_room, 'battle', nfull->'battle'); end if;
    if jsonb_typeof(nfull #> '{roster,mons}') = 'object' then
      insert into om_part(room, k, data) select p_room, 'm:' || e.key, e.value from jsonb_each(nfull #> '{roster,mons}') e where jsonb_typeof(e.value) <> 'null';
    end if;
    perform set_config('om.quiet', '1', true);
    update om_state set data = case when plen = 0 then (case when jsonb_typeof(nfull #> '{roster,mons}') = 'object' then (nfull - 'battle') #- '{roster,mons}' else nfull - 'battle' end)
                                    else (rest - 'roster') || case when jsonb_typeof(nfull->'roster') = 'object' then jsonb_build_object('roster', case when jsonb_typeof(nfull #> '{roster,mons}') = 'object' then (nfull->'roster') - 'mons' else nfull->'roster' end) else '{}'::jsonb end end,
      v = v + 1, updated_at = now() where room = p_room returning v into nv;
    perform set_config('om.quiet', '', true);
    perform public.om_send(p_room, jsonb_build_object('v', nv, 'full', true));
  elsif pk is not null then
    -- 조각 하나만 새로 쓴다
    sub := p_path[case when pk = 'battle' then 2 else 4 end : plen];
    if coalesce(array_length(sub, 1), 0) = 0 then
      if newv is null then delete from om_part where room = p_room and k = pk;
      else insert into om_part(room, k, data) values (p_room, pk, newv) on conflict (room, k) do update set data = excluded.data; end if;
    elsif newv is null then
      update om_part set data = data #- sub where room = p_room and k = pk and jsonb_typeof(data) in ('object','array');
    else
      insert into om_part(room, k, data) values (p_room, pk, public.om_jset('{}'::jsonb, sub, newv))
        on conflict (room, k) do update set data = public.om_jset(case when jsonb_typeof(om_part.data) = 'object' then om_part.data else '{}'::jsonb end, sub, newv);   -- 상자가 아닌 값이면 예전 om_jset 처럼 상자로
    end if;
    perform set_config('om.quiet', '1', true);
    update om_state set v = v + 1, updated_at = now() where room = p_room returning v into nv;
    perform set_config('om.quiet', '', true);
    perform public.om_send(p_room, case
      when oldv is not distinct from newv then jsonb_build_object('v', nv, 'same', true)
      when newv is not null and octet_length(newv::text) > 100000 then jsonb_build_object('v', nv, 'full', true)
      else jsonb_build_object('v', nv, 'path', to_jsonb(p_path), 'value', newv) end);
  else
    -- 나머지 (om_state) — 지금과 같다. 신호는 트리거가
    if newv is null then
      update om_state set data = data #- p_path, v = v + 1, updated_at = now() where room = p_room returning v into nv;
    else
      update om_state set data = public.om_jset(data, p_path, newv), v = v + 1, updated_at = now() where room = p_room returning v into nv;
    end if;
  end if;
  return nv;
end $$;

-- 옛 화면이 쓰던 함수: 이제는 새로고침해 달라고만 한다
create or replace function public.om_set_state(p_room text, p_secret text, p_path text[], p_value jsonb)
returns bigint language plpgsql security definer set search_path = public as $$
begin
  raise exception '오레마스가 새 버전으로 바뀌었다 — 화면을 새로고침(F5) 해 줘';
end $$;

-- ---------- 상태를 읽던 다른 함수들 ----------
create or replace function public.om_claim_seat(p_room text, p_seat text, p_secret text, p_name text)
returns boolean language plpgsql security definer set search_path = public as $$
declare cur om_auth%rowtype; w text; u text; other text;
begin
  if p_seat is null or p_seat = '' then raise exception '좌석 id 가 없습니다'; end if;
  if lower(p_seat) = 'gm' then raise exception '이 좌석 id 는 쓸 수 없습니다'; end if;
  w := om_who(p_room, p_secret);
  if w = 'gm' then
    if p_name is null then
      delete from om_auth where room = p_room and role = 'seat' and seat = p_seat;
      update om_members set seat = '' where room = p_room and seat = p_seat;
      update om_state set data = data #- array['seats', p_seat], v = v + 1, updated_at = now() where room = p_room;
    end if;
    return true;
  end if;
  if left(coalesce(p_secret,''), 2) = 'u:' then
    u := om_uid(substr(p_secret, 3));
    if u is null then raise exception '로그인이 끝났습니다 — 다시 로그인해 주세요'; end if;
    if exists (select 1 from om_auth where room = p_room and role = 'seat' and seat = p_seat) then return false; end if;
    select m.uid into other from om_members m where m.room = p_room and m.seat = p_seat and m.uid <> u;
    if other is not null then return false; end if;
    if exists (select 1 from om_members where room = p_room and uid = u and role = 'gm') then raise exception 'GM 계정은 자리에 앉지 않습니다'; end if;
    if coalesce((select (settings->>'accountOnly')::boolean from om_rooms where id = p_room), false)
       and not exists (select 1 from om_members where room = p_room and uid = u and role = 'pl') then
      raise exception '계정 전용 방이라 PL 권한을 받은 계정만 앉을 수 있습니다 — 관리자에게 부탁해 주세요';
    end if;
    insert into om_members(room, uid, role, seat) values (p_room, u, 'pl', p_seat)
      on conflict (room, uid) do update set seat = excluded.seat;
  else
    select * into cur from om_auth where room = p_room and role = 'seat' and seat = p_seat;
    if exists (select 1 from om_members where room = p_room and seat = p_seat) then return false; end if;
    if not found then
      if length(coalesce(p_secret,'')) < 8 then raise exception '비밀값이 너무 짧습니다'; end if;
      if coalesce((select (settings->>'accountOnly')::boolean from om_rooms where id = p_room), false) then raise exception '이 방은 계정으로 로그인해야 앉을 수 있습니다'; end if;
      insert into om_auth(room, role, seat, hash, name) values (p_room, 'seat', p_seat, om_hash(p_secret), coalesce(p_name,''));
    elsif cur.hash = om_hash(p_secret) then
      update om_auth set name = coalesce(p_name, name) where room = p_room and role = 'seat' and seat = p_seat;
    else
      return false;
    end if;
  end if;
  update om_state set data = jsonb_set(data, array['seats', p_seat], jsonb_build_object('name', coalesce(p_name,''), 'at', now()), true), v = v + 1 where room = p_room;
  insert into om_log(room, kind, who, data)
    select p_room, 'sys', '', jsonb_build_object('t', coalesce(p_name,'누군가') || ' 님이 「' || coalesce((select p.data#>>array['trainers',p_seat,'name'] from om_part p where p.room = p_room and p.k = 'battle'), s.data#>>array['battle','trainers',p_seat,'name'], p_seat) || '」 자리에 앉았다.')
    from om_state s where s.room = p_room;
  return true;
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
  st := public.om_full(p_room);   -- (10-26) 배틀 · 포켓몬 조각까지 합친 상태. 새 방은 처음 쓸 때 다시 조각으로 나뉜다
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

grant execute on function public.om_get_state(text) to anon, authenticated;
grant execute on function public.om_put(text,text,text[],jsonb) to anon, authenticated;
grant execute on function public.om_set_state(text,text,text[],jsonb) to anon, authenticated;
grant execute on function public.om_claim_seat(text,text,text,text) to anon, authenticated;
grant execute on function public.om_room_copy(text,text,text,jsonb) to anon, authenticated;
revoke execute on function public.om_full(text) from public, anon, authenticated;
revoke execute on function public.om_split(text) from public, anon, authenticated;
revoke execute on function public.om_send(text,jsonb) from public, anon, authenticated;

-- ---------- 지금 있는 방 모두 나누기 ----------
do $$ declare r record; begin
  for r in select room from om_state loop perform public.om_split(r.room); end loop;
end $$;

-- 확인: 방마다 나머지 크기 · 조각 수
-- select s.room, pg_column_size(s.data) as rest_bytes, (select count(*) from om_part p where p.room = s.room) as parts from om_state s order by 2 desc;

-- ---------- 백업에서 통째로 되돌리기 (돌리기 직전 순간으로 — 그 뒤에 바뀐 것은 사라진다) ----------
-- update om_state s set data = b.data, v = s.v + 1 from om_bak_20261026 b where b.room = s.room;
-- delete from om_part;
-- drop function if exists public.om_put(text,text,text[],jsonb);  drop function if exists public.om_get_state(text);
-- drop trigger if exists om_state_notify on public.om_state;
-- do $$ declare r record; begin for r in select def from om_bak_20261026_fn order by (args = 'trigger') loop execute r.def; end loop; end $$;   -- 옛 함수 · 트리거 정의를 그대로 다시 만든다

-- ---------- 지금 상태를 살린 채 되돌리기 (필요할 때만, 아래 주석을 풀고 실행) ----------
-- update om_state s set data = public.om_full(s.room);
-- delete from om_part;
-- drop function if exists public.om_put(text,text,text[],jsonb);  drop function if exists public.om_get_state(text);   -- 열려 있는 새 화면도 예전 방식으로 돌아간다
-- drop trigger if exists om_state_notify on public.om_state;
-- create trigger om_state_notify after update on public.om_state for each row when (old.v is distinct from new.v or old.data is distinct from new.data) execute function public.om_state_notify();
-- 그다음 supabase/patch_2026-10-25_함께지시.sql 를 다시 실행하면 옛 om_set_state 가 돌아온다 (화면도 옛 버전으로)
