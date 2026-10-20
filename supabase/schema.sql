-- 오레마스 웹툴 DB. Supabase 대시보드 → SQL Editor 에 통째로 붙여 넣고 Run.
-- 제작기(mangketmon-maker)와 같은 프로젝트에 넣는다. 제작기의 docs 테이블은 건드리지 않는다.
--
-- 권한 방식: 링크 + 비밀값.
--   * 누구나(anon) 읽을 수 있는 것: om_rooms(이름·설정), om_state(방 상태), om_log(로그·채팅)
--   * 쓰기는 전부 함수(RPC)를 통해서만. 함수가 GM 비밀값 또는 좌석 비밀값을 확인한다.
--   * om_auth(비밀값 해시)와 om_secret(공개 전 지시, GM 메모)은 anon 이 직접 읽을 수 없다.
--     security definer 함수만 읽는다. 그래서 개발자 도구로도 남의 지시를 볼 수 없다.

create extension if not exists pgcrypto with schema extensions;

-- ---------- 테이블 ----------
create table if not exists public.om_rooms (
  id          text primary key,
  name        text not null default '',
  settings    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create table if not exists public.om_auth (
  room  text not null references public.om_rooms(id) on delete cascade,
  role  text not null,            -- 'gm' 또는 'seat'
  seat  text not null default '', -- role='seat' 일 때 좌석 id
  hash  text not null,
  name  text not null default '', -- 좌석 주인이 적은 이름
  primary key (room, role, seat)
);

create table if not exists public.om_state (
  room        text primary key references public.om_rooms(id) on delete cascade,
  data        jsonb not null default '{}'::jsonb,
  v           bigint not null default 0,
  updated_at  timestamptz not null default now()
);

create table if not exists public.om_log (
  id    bigserial primary key,
  room  text not null references public.om_rooms(id) on delete cascade,
  at    timestamptz not null default now(),
  kind  text not null default 'chat',  -- chat / sys / battle / whisper(수신자만) …
  who   text not null default '',
  data  jsonb not null default '{}'::jsonb
);
create index if not exists om_log_room_id on public.om_log(room, id);

create table if not exists public.om_secret (
  room  text not null references public.om_rooms(id) on delete cascade,
  kind  text not null,   -- 'cmd'(지시), 'gm'(GM 메모) …
  id    text not null,   -- 좌석 id 등
  data  jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (room, kind, id)
);

-- ---------- 정책 ----------
alter table public.om_rooms  enable row level security;
alter table public.om_auth   enable row level security;
alter table public.om_state  enable row level security;
alter table public.om_log    enable row level security;
alter table public.om_secret enable row level security;

drop policy if exists "om_rooms read" on public.om_rooms;
drop policy if exists "om_state read" on public.om_state;
drop policy if exists "om_log read"   on public.om_log;
create policy "om_rooms read" on public.om_rooms for select to anon, authenticated using (true);
create policy "om_state read" on public.om_state for select to anon, authenticated using (true);
create policy "om_log read"   on public.om_log   for select to anon, authenticated using (kind <> 'whisper');
-- om_auth, om_secret 에는 정책이 없다 = anon 은 아무것도 못 한다. 아래 함수만 접근한다.

-- ---------- 실시간 ----------
alter table public.om_state replica identity full;
alter table public.om_log   replica identity full;
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='om_state') then
    alter publication supabase_realtime add table public.om_state; end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='om_log') then
    alter publication supabase_realtime add table public.om_log; end if;
end $$;

-- ---------- 내부 도우미 ----------
create or replace function public.om_hash(p text) returns text
language sql immutable as $$ select encode(extensions.digest(coalesce(p,''), 'sha256'), 'hex') $$;

-- 비밀값이 GM 것이면 'gm', 좌석 것이면 그 좌석 id, 아니면 null
create or replace function public.om_who(p_room text, p_secret text) returns text
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if p_secret is null or p_secret = '' then return null; end if;
  select role, seat into r from om_auth where room = p_room and hash = om_hash(p_secret) limit 1;
  if not found then return null; end if;
  if r.role = 'gm' then return 'gm'; end if;
  return r.seat;
end $$;

-- ---------- 공개 함수 (RPC) ----------
-- 방 만들기. 돌려주는 값: 방 id. GM 비밀값은 브라우저가 만들어 보낸다.
create or replace function public.om_create_room(p_name text, p_gm_secret text)
returns text language plpgsql security definer set search_path = public as $$
declare rid text;
begin
  if length(coalesce(p_gm_secret,'')) < 8 then raise exception 'GM 비밀값이 너무 짧습니다'; end if;
  rid := lower(substr(replace(gen_random_uuid()::text,'-',''), 1, 10));
  insert into om_rooms(id, name) values (rid, coalesce(p_name,''));
  insert into om_auth(room, role, seat, hash) values (rid, 'gm', '', om_hash(p_gm_secret));
  insert into om_state(room, data) values (rid, jsonb_build_object('seats', '{}'::jsonb, 'scene', 'rp', 'battle', '{}'::jsonb));
  insert into om_log(room, kind, who, data) values (rid, 'sys', '', jsonb_build_object('t', '방을 만들었다.'));
  return rid;
end $$;

-- 내 역할 확인: 'gm' / 좌석 id / null
create or replace function public.om_whoami(p_room text, p_secret text)
returns text language sql security definer set search_path = public as $$ select om_who(p_room, p_secret) $$;

-- 좌석 앉기. 빈 좌석이면 비밀값을 등록하고, 이미 내 비밀값이 등록된 좌석이면 이름만 갱신.
-- GM 비밀값으로 부르면 어떤 좌석이든 비울 수 있다(p_name = null).
create or replace function public.om_claim_seat(p_room text, p_seat text, p_secret text, p_name text)
returns boolean language plpgsql security definer set search_path = public as $$
declare cur om_auth%rowtype; w text;
begin
  if p_seat is null or p_seat = '' then raise exception '좌석 id 가 없습니다'; end if;
  w := om_who(p_room, p_secret);
  select * into cur from om_auth where room = p_room and role = 'seat' and seat = p_seat;
  if w = 'gm' then
    if p_name is null then
      delete from om_auth where room = p_room and role = 'seat' and seat = p_seat;
      update om_state set data = data #- array['seats', p_seat], v = v + 1 where room = p_room;
    end if;
    return true;
  end if;
  if not found then
    if length(coalesce(p_secret,'')) < 8 then raise exception '비밀값이 너무 짧습니다'; end if;
    insert into om_auth(room, role, seat, hash, name) values (p_room, 'seat', p_seat, om_hash(p_secret), coalesce(p_name,''));
  elsif cur.hash = om_hash(p_secret) then
    update om_auth set name = coalesce(p_name, name) where room = p_room and role = 'seat' and seat = p_seat;
  else
    return false; -- 남의 자리
  end if;
  update om_state set data = jsonb_set(data, array['seats', p_seat], jsonb_build_object('name', coalesce(p_name,''), 'at', now()), true), v = v + 1 where room = p_room;
  insert into om_log(room, kind, who, data)
    select p_room, 'sys', '', jsonb_build_object('t', coalesce(p_name,'누군가') || ' 님이 「' || coalesce(s.data#>>array['battle','trainers',p_seat,'name'], p_seat) || '」 자리에 앉았다.')
    from om_state s where s.room = p_room;
  return true;
end $$;

-- 상태 바꾸기. p_path 가 비어 있으면 전체 교체, 아니면 jsonb_set(경로, 값). 값이 null 이면 그 경로 삭제.
-- GM 은 어디든, 좌석은 seats/<내 좌석>, ready/<내 좌석>, pub/<내 좌석>, battle/mons/… 만 (나머지는 함수가 막는다).
-- 중간 키가 없어도 만들면서 넣는 jsonb_set (jsonb_set 은 부모가 없으면 조용히 아무것도 안 바꾼다)
create or replace function public.om_jset(p_data jsonb, p_path text[], p_value jsonb)
returns jsonb language plpgsql immutable as $$
declare d jsonb := coalesce(p_data, '{}'::jsonb); i int; sub text[];
begin
  for i in 1 .. array_length(p_path,1) - 1 loop
    sub := p_path[1:i];
    if jsonb_typeof(d #> sub) is distinct from 'object' then d := jsonb_set(d, sub, '{}'::jsonb, true); end if;
  end loop;
  return jsonb_set(d, p_path, p_value, true);
end $$;

create or replace function public.om_set_state(p_room text, p_secret text, p_path text[], p_value jsonb)
returns bigint language plpgsql security definer set search_path = public as $$
declare w text; nv bigint;
begin
  w := om_who(p_room, p_secret);
  if w is null then raise exception '권한이 없습니다'; end if;
  if w <> 'gm' then
    if p_path is null or array_length(p_path,1) < 1 then raise exception '좌석은 전체를 바꿀 수 없습니다'; end if;
    if array_length(p_path,1) < 2 and p_path[1] not in ('battle','ready') then raise exception '좌석은 전체를 바꿀 수 없습니다'; end if;
    if not ((p_path[1] = 'seats' and p_path[2] = w) or (p_path[1] = 'ready') or (p_path[1] = 'pub' and p_path[2] = w)   -- ready: 지시 완료 표시 (턴이 넘어갈 때 비운다)
            or (p_path[1] = 'battle')   -- 배틀 전체: 포켓몬 HP·랭크·상태, 필드, 지시 공개, 턴·페이즈, 파티 불러오기 … 플레이어끼리 모의전을 할 수 있게 (신뢰 기반, 맵툴과 같음)
            or (p_path[1] = 'roster' and p_path[2] = 'trainers' and p_path[3] = w)   -- 내 시트
            or (p_path[1] = 'skill' and p_path[2] in ('trainers','res','hist'))        -- 스킬 체크 자원·결과 (지침·돌봄·커버는 남의 칸도 건드린다 · 신뢰 기반)
            or (p_path[1] = 'dex' and p_path[2] = w)                                    -- 내 도감
            or (p_path[1] = 'roster' and p_path[2] = 'mons' and array_length(p_path,1) >= 3
                and (coalesce((select s.data#>>array['roster','mons',p_path[3],'tid'] from om_state s where s.room = p_room), p_value->>'tid') = w))) then  -- 내 포켓몬
      raise exception '이 좌석이 바꿀 수 없는 곳입니다: %', array_to_string(p_path, '/');
    end if;
  end if;
  if p_path is null or array_length(p_path,1) is null then
    update om_state set data = coalesce(p_value,'{}'::jsonb), v = v + 1 where room = p_room returning v into nv;
  elsif p_value is null or jsonb_typeof(p_value) = 'null' then
    update om_state set data = data #- p_path, v = v + 1 where room = p_room returning v into nv;
  else
    update om_state set data = public.om_jset(data, p_path, p_value), v = v + 1 where room = p_room returning v into nv;
  end if;
  return nv;
end $$;

-- 로그·채팅 쓰기. kind='whisper' 는 data.to 에 받을 좌석(또는 'gm')을 적는다.
create or replace function public.om_log_add(p_room text, p_secret text, p_kind text, p_who text, p_data jsonb)
returns bigint language plpgsql security definer set search_path = public as $$
declare w text; nid bigint;
begin
  w := om_who(p_room, p_secret);
  if w is null then raise exception '권한이 없습니다'; end if;
  if w <> 'gm' and p_kind not in ('chat','whisper','dice','battle') then raise exception '좌석은 이 종류의 로그를 쓸 수 없습니다'; end if;  -- battle: 플레이어가 발동한 효과 · 공격 · 포텐셜 카드
  insert into om_log(room, kind, who, data) values (p_room, coalesce(p_kind,'chat'), coalesce(p_who,''), coalesce(p_data,'{}'::jsonb) || jsonb_build_object('from', w))
  returning id into nid;
  return nid;
end $$;

-- 귓속말 읽기: 내게 온 것 + 내가 보낸 것 (GM 은 전부)
create or replace function public.om_whispers(p_room text, p_secret text, p_after bigint)
returns setof om_log language plpgsql security definer set search_path = public as $$
declare w text;
begin
  w := om_who(p_room, p_secret);
  if w is null then return; end if;
  return query select * from om_log l where l.room = p_room and l.kind = 'whisper' and l.id > coalesce(p_after,0)
    and (w = 'gm' or l.data->>'to' = w or l.data->>'from' = w) order by l.id;
end $$;

-- 비밀 데이터 쓰기/읽기 (공개 전 지시 등). kind='cmd' 는 좌석이 자기 id 로만. GM 은 전부.
create or replace function public.om_secret_put(p_room text, p_secret text, p_kind text, p_id text, p_data jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
declare w text;
begin
  w := om_who(p_room, p_secret);
  if w is null then raise exception '권한이 없습니다'; end if;
  if w <> 'gm' and not (p_kind = 'cmd' and p_id = w) then raise exception '이 좌석이 쓸 수 없는 곳입니다'; end if;
  insert into om_secret(room, kind, id, data) values (p_room, p_kind, p_id, coalesce(p_data,'{}'::jsonb))
    on conflict (room, kind, id) do update set data = excluded.data, updated_at = now();
  return true;
end $$;

create or replace function public.om_secret_get(p_room text, p_secret text, p_kind text)
returns setof om_secret language plpgsql security definer set search_path = public as $$
declare w text;
begin
  w := om_who(p_room, p_secret);
  if w is null then return; end if;
  if w = 'gm' then return query select * from om_secret s where s.room = p_room and s.kind = p_kind order by s.id;
  else return query select * from om_secret s where s.room = p_room and s.kind = p_kind and s.id = w; end if;
end $$;

-- 방 설정·이름 바꾸기 (GM)
create or replace function public.om_room_update(p_room text, p_secret text, p_name text, p_settings jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if om_who(p_room, p_secret) <> 'gm' then raise exception 'GM 만 바꿀 수 있습니다'; end if;
  update om_rooms set name = coalesce(p_name, name), settings = coalesce(p_settings, settings) where id = p_room;
  return true;
end $$;

grant execute on function public.om_create_room(text,text) to anon, authenticated;
grant execute on function public.om_whoami(text,text) to anon, authenticated;
grant execute on function public.om_claim_seat(text,text,text,text) to anon, authenticated;
grant execute on function public.om_set_state(text,text,text[],jsonb) to anon, authenticated;
grant execute on function public.om_log_add(text,text,text,text,jsonb) to anon, authenticated;
-- 로그 완전 삭제 (GM 만). p_keep_sms = true 면 휴대폰 문자는 남긴다. 지운 줄 수를 돌려준다
create or replace function public.om_log_clear(p_room text, p_secret text, p_keep_sms boolean)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if om_who(p_room, p_secret) is distinct from 'gm' then raise exception 'GM 만 로그를 지울 수 있습니다'; end if;
  delete from om_log where room = p_room and not (coalesce(p_keep_sms,true) and kind = 'chat' and data ? 'sms');
  get diagnostics n = row_count;
  insert into om_log(room, kind, who, data) values (p_room, 'sys', '', jsonb_build_object('t', 'GM 이 로그를 지웠다.'));
  return n;
end $$;
grant execute on function public.om_log_clear(text,text,boolean) to anon, authenticated;
grant execute on function public.om_whispers(text,text,bigint) to anon, authenticated;
grant execute on function public.om_secret_put(text,text,text,text,jsonb) to anon, authenticated;
grant execute on function public.om_secret_get(text,text,text) to anon, authenticated;
grant execute on function public.om_room_update(text,text,text,jsonb) to anon, authenticated;
revoke execute on function public.om_hash(text) from anon, authenticated;
revoke execute on function public.om_who(text,text) from anon, authenticated;

-- ---------- 이미지 저장소 (Storage) ----------
-- 제작기 시트의 그림은 base64 로 들어 있어서, 방 상태에 그대로 넣으면 실시간 동기화가 무거워진다.
-- 시트로 가져올 때 이 버킷에 올리고 주소만 저장한다. 공개 버킷, 링크를 아는 사람은 누구나 올릴 수 있다 (제작기와 같은 '전원 자유').
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('oremas', 'oremas', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif'])
  on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif'];
drop policy if exists "oremas img read"   on storage.objects;
drop policy if exists "oremas img insert" on storage.objects;
drop policy if exists "oremas img update" on storage.objects;
drop policy if exists "oremas img delete" on storage.objects;
create policy "oremas img read"   on storage.objects for select to anon, authenticated using (bucket_id = 'oremas');
create policy "oremas img insert" on storage.objects for insert to anon, authenticated with check (bucket_id = 'oremas');
create policy "oremas img update" on storage.objects for update to anon, authenticated using (bucket_id = 'oremas') with check (bucket_id = 'oremas');
create policy "oremas img delete" on storage.objects for delete to anon, authenticated using (bucket_id = 'oremas');
