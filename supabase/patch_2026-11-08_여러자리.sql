-- 2026-11-08 망령 「웹툴에서도 자리 더 앉기」 — 한 계정이 여러 트레이너 자리에 앉기 (세션 노트 patch_2026-11-04_여러자리.sql 과 같은 꼴)
-- Supabase 대시보드 → SQL Editor 에 이 파일 전체를 붙여 넣고 Run. 여러 번 실행해도 된다. 표 데이터는 지우지 않는다.
-- 먼저 들어가 있어야 하는 것: patch_2026-10-23_계정.sql · patch_2026-10-26_상태나누기.sql
--
--   om_members.seats = 그 계정이 앉은 자리 전부. om_members.seat = 지금 쓰는 자리 하나(예전과 같은 뜻 → om_who · 권한은 그대로).
--   한 자리에는 여전히 한 계정만 — 남의 seats 에 든 자리도 「남의 자리」.
--   om_claim_seat  : 예전처럼 「옮기기」(지금 자리만 새 자리로 바뀌고 다른 내 자리는 그대로). GM 비우기는 seats 에서도 뺀다.
--   om_claim_more  : 「자리 더 앉기」 — 앉아 있던 자리는 그대로 두고 새 자리에 더 앉는다(지금 자리 = 새 자리).
--   om_seat_use    : 내 자리 중 하나를 지금 자리로.
--   om_seat_leave  : 내 자리 하나에서 일어난다(지금 자리였으면 남은 자리로).
--   om_my_seats    : 이 방에서 내 자리 {seat, seats}.
--   웹툴은 이 함수들이 없으면(아직 안 돌렸으면) 예전처럼 한 자리만 쓴다.

alter table public.om_members add column if not exists seats text[] not null default '{}';
update public.om_members set seats = array[seat] where role = 'pl' and seat <> '' and not (seat = any(seats));

-- 순서를 지키며 겹친 것 · 빈 것을 뺀다
create or replace function public.om_uniq(a text[]) returns text[]
language sql immutable as $$
  select coalesce(array_agg(x order by o), '{}') from (
    select x, min(o) as o from unnest(coalesce(a, '{}')) with ordinality t(x, o) where coalesce(x, '') <> '' group by x) q $$;

-- 그 자리에 다른 계정(또는 링크 비밀값 좌석)이 앉아 있나
create or replace function public.om_seat_taken(p_room text, p_seat text, p_uid text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from om_members where room = p_room and uid is distinct from p_uid and (seat = p_seat or p_seat = any(seats)))
      or exists (select 1 from om_auth where room = p_room and role = 'seat' and seat = p_seat) $$;

-- 자리 앉기 (patch_2026-10-26_상태나누기.sql 판 + 여러 자리)
create or replace function public.om_claim_seat(p_room text, p_seat text, p_secret text, p_name text)
returns boolean language plpgsql security definer set search_path = public as $$
declare cur om_auth%rowtype; w text; u text; mem record;
begin
  if p_seat is null or p_seat = '' then raise exception '좌석 id 가 없습니다'; end if;
  if lower(p_seat) = 'gm' then raise exception '이 좌석 id 는 쓸 수 없습니다'; end if;
  w := om_who(p_room, p_secret);
  if w = 'gm' then
    if p_name is null then
      delete from om_auth where room = p_room and role = 'seat' and seat = p_seat;
      update om_members set seats = array_remove(seats, p_seat),
          seat = case when seat = p_seat then coalesce((array_remove(seats, p_seat))[1], '') else seat end
        where room = p_room and (seat = p_seat or p_seat = any(seats));
      update om_state set data = data #- array['seats', p_seat], v = v + 1, updated_at = now() where room = p_room;
    end if;
    return true;
  end if;
  if left(coalesce(p_secret,''), 2) = 'u:' then
    u := om_uid(substr(p_secret, 3));
    if u is null then raise exception '로그인이 끝났습니다 — 다시 로그인해 주세요'; end if;
    if om_seat_taken(p_room, p_seat, u) then return false; end if;
    if exists (select 1 from om_members where room = p_room and uid = u and role = 'gm') then raise exception 'GM 계정은 자리에 앉지 않습니다'; end if;
    if coalesce((select (settings->>'accountOnly')::boolean from om_rooms where id = p_room), false)
       and not exists (select 1 from om_members where room = p_room and uid = u and role = 'pl') then
      raise exception '계정 전용 방이라 PL 권한을 받은 계정만 앉을 수 있습니다 — 관리자에게 부탁해 주세요';
    end if;
    -- 옮기기: 지금 자리만 새 자리로 바꾼다 (다른 내 자리는 그대로)
    insert into om_members(room, uid, role, seat, seats) values (p_room, u, 'pl', p_seat, array[p_seat])
      on conflict (room, uid) do update set seat = excluded.seat,
        seats = om_uniq(array_remove(om_members.seats, om_members.seat) || array[p_seat]);
  else
    select * into cur from om_auth where room = p_room and role = 'seat' and seat = p_seat;
    if exists (select 1 from om_members where room = p_room and (seat = p_seat or p_seat = any(seats))) then return false; end if;
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

-- 자리 더 앉기 (계정만): 앉아 있던 자리는 그대로, 새 자리가 지금 자리
create or replace function public.om_claim_more(p_room text, p_seat text, p_secret text, p_name text)
returns boolean language plpgsql security definer set search_path = public as $$
declare u text; mem record;
begin
  if left(coalesce(p_secret,''), 2) <> 'u:' then raise exception '자리 더 앉기는 로그인한 계정만 할 수 있습니다'; end if;
  u := om_uid(substr(p_secret, 3));
  if u is null then raise exception '로그인이 끝났습니다 — 다시 로그인해 주세요'; end if;
  select seat, seats into mem from om_members where room = p_room and uid = u;
  if found and p_seat = any(om_uniq(mem.seats || array[mem.seat])) then
    update om_members set seat = p_seat, seats = om_uniq(seats || array[seat, p_seat]) where room = p_room and uid = u;
    return true;
  end if;
  if not om_claim_seat(p_room, p_seat, p_secret, p_name) then return false; end if;
  update om_members set seats = om_uniq(coalesce(mem.seats, '{}') || array[coalesce(mem.seat, ''), p_seat]) where room = p_room and uid = u;
  return true;
end $$;

-- 내 자리 중 하나를 지금 자리로
create or replace function public.om_seat_use(p_room text, p_secret text, p_seat text)
returns boolean language plpgsql security definer set search_path = public as $$
declare u text;
begin
  if left(coalesce(p_secret,''), 2) <> 'u:' then raise exception '계정으로 로그인해야 자리를 바꿀 수 있습니다'; end if;
  u := om_uid(substr(p_secret, 3));
  if u is null then raise exception '로그인이 끝났습니다 — 다시 로그인해 주세요'; end if;
  update om_members set seats = om_uniq(seats || array[seat]), seat = p_seat
    where room = p_room and uid = u and role = 'pl' and (p_seat = any(seats) or p_seat = seat);
  if not found then raise exception '앉아 있지 않은 자리예요'; end if;
  return true;
end $$;

-- 내 자리 하나에서 일어난다 (트레이너 · 파티는 그 자리에 그대로 남는다)
create or replace function public.om_seat_leave(p_room text, p_secret text, p_seat text)
returns boolean language plpgsql security definer set search_path = public as $$
declare u text; rest text[];
begin
  if left(coalesce(p_secret,''), 2) <> 'u:' then raise exception '계정으로 로그인해야 일어날 수 있습니다'; end if;
  u := om_uid(substr(p_secret, 3));
  if u is null then raise exception '로그인이 끝났습니다 — 다시 로그인해 주세요'; end if;
  select array_remove(om_uniq(seats || array[seat]), p_seat) into rest from om_members
    where room = p_room and uid = u and role = 'pl' and (p_seat = any(seats) or p_seat = seat);
  if not found then raise exception '앉아 있지 않은 자리예요'; end if;
  update om_members set seats = rest, seat = case when seat = p_seat then coalesce(rest[1], '') else seat end where room = p_room and uid = u;
  update om_state set data = data #- array['seats', p_seat], v = v + 1, updated_at = now() where room = p_room;
  return true;
end $$;

-- 이 방에서 내 자리
create or replace function public.om_my_seats(p_room text, p_secret text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare u text; mem record;
begin
  if left(coalesce(p_secret,''), 2) <> 'u:' then return null; end if;
  u := om_uid(substr(p_secret, 3));
  if u is null then return null; end if;
  select role, seat, seats into mem from om_members where room = p_room and uid = u;
  if not found or mem.role <> 'pl' then return jsonb_build_object('seat', '', 'seats', '[]'::jsonb); end if;
  return jsonb_build_object('seat', mem.seat, 'seats', to_jsonb(om_uniq(mem.seats || array[mem.seat])));
end $$;

grant execute on function public.om_claim_seat(text,text,text,text), public.om_claim_more(text,text,text,text),
  public.om_seat_use(text,text,text), public.om_seat_leave(text,text,text), public.om_my_seats(text,text) to anon, authenticated;
