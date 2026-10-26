-- ⚠ (2026-10-26) 상태 나누기 뒤에 이 파일을 다시 돌렸다면, 곧바로 supabase/patch_2026-10-26_상태나누기.sql 도 다시 돌릴 것 (옛 함수 · 트리거가 돌아와 저장이 어긋난다)
-- 오레마스 계정 (2026-10-23 반디) — Supabase 대시보드 → SQL Editor 에 이 파일 전체를 붙여 넣고 Run. 여러 번 실행해도 된다.
-- 내용
--   * 아이디 · 비밀번호 로그인 (비밀번호는 bcrypt 로만 저장 · 아무도 원문을 볼 수 없다)
--   * 기기마다 로그인 유지 (기기에 남는 것은 로그인 표 하나 · 비밀번호가 아니다. 로그아웃하면 그 표는 지워진다)
--   * 방마다 GM / PL 권한: om_members(방, 계정, 역할, 좌석)
--   * 관리자(admin): 모든 방에 GM 으로 들어가고, 유저 목록 · 권한 부여 · 비밀번호 초기화를 한다
--     맨 처음 가입한 계정이 관리자가 된다. 손으로 정하려면:  update public.om_users set admin = true where uid = '아이디';
--   * 예전 링크(GM 링크 · 좌석 비밀값)도 그대로 된다. 방 설정에서 「계정 전용」을 켜면 그 방은 로그인한 계정만 들어온다
-- 표와 데이터는 지우지 않는다. om_who · om_claim_seat 두 함수만 다시 만든다 (예전 동작 + 계정).

create extension if not exists pgcrypto with schema extensions;

-- ---------- 표 ----------
create table if not exists public.om_users (
  uid        text primary key,             -- 로그인 아이디 (소문자 · 영문 숫자 _ . -)
  pw         text not null,                -- crypt(비밀번호, gen_salt('bf'))
  name       text not null default '',     -- 보이는 이름 (닉네임)
  admin      boolean not null default false,
  created_at timestamptz not null default now(),
  last_at    timestamptz
);
create table if not exists public.om_sess (
  hash       text primary key,             -- 로그인 표의 해시 (표 원문은 기기에만)
  uid        text not null references public.om_users(uid) on delete cascade,
  device     text not null default '',
  created_at timestamptz not null default now(),
  last_at    timestamptz not null default now()
);
create index if not exists om_sess_uid on public.om_sess(uid);
create table if not exists public.om_members (
  room  text not null references public.om_rooms(id) on delete cascade,
  uid   text not null references public.om_users(uid) on delete cascade,
  role  text not null default 'pl',        -- 'gm' | 'pl'
  seat  text not null default '',          -- PL 이 앉은 좌석 id (트레이너 id)
  primary key (room, uid)
);
alter table public.om_users   enable row level security;
alter table public.om_sess    enable row level security;
alter table public.om_members enable row level security;
-- 정책 없음 = anon 은 직접 못 읽는다. 아래 함수만 읽는다.

-- ---------- 도우미 ----------
-- 로그인 표 → 계정 아이디 (없으면 null). 30일 넘게 안 쓴 표는 버린다
create or replace function public.om_uid(p_token text) returns text
language plpgsql security definer set search_path = public as $$
declare u text;
begin
  if p_token is null or length(p_token) < 20 then return null; end if;
  select s.uid into u from om_sess s where s.hash = om_hash(p_token) and s.last_at > now() - interval '30 days';
  if u is null then return null; end if;
  update om_sess set last_at = now() where hash = om_hash(p_token) and last_at < now() - interval '10 minutes';
  return u;
end $$;

-- 비밀값이 GM 것이면 'gm', 좌석 것이면 그 좌석 id, 아니면 null.
-- 'u:<로그인 표>' 는 계정: 방 멤버 역할(gm/pl+좌석) → 없으면 관리자는 GM
-- 방 설정 accountOnly = true 면 예전 비밀값(링크)은 받지 않는다
create or replace function public.om_who(p_room text, p_secret text) returns text
language plpgsql security definer set search_path = public as $$
declare r record; u text; mem record; adm boolean;
begin
  if p_secret is null or p_secret = '' then return null; end if;
  if left(p_secret, 2) = 'u:' then
    u := om_uid(substr(p_secret, 3));
    if u is null then return null; end if;
    select role, seat into mem from om_members where room = p_room and uid = u;
    if found then
      if mem.role = 'gm' then return 'gm'; end if;
      if mem.seat <> '' and lower(mem.seat) <> 'gm' then return mem.seat; end if;
      return null;
    end if;
    select admin into adm from om_users where uid = u;
    if coalesce(adm, false) then return 'gm'; end if;
    return null;
  end if;
  if coalesce((select (settings->>'accountOnly')::boolean from om_rooms where id = p_room), false) then return null; end if;
  select role, seat into r from om_auth where room = p_room and hash = om_hash(p_secret) limit 1;
  if not found then return null; end if;
  if r.role = 'gm' then return 'gm'; end if;
  if r.role <> 'seat' or lower(r.seat) = 'gm' then return null; end if;
  return r.seat;
end $$;

-- 좌석 앉기 (예전 + 계정). 계정은 om_members.seat 에 앉는다 (로그인 표가 바뀌어도 자리는 계정에 붙어 있다)
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
      update om_state set data = data #- array['seats', p_seat], v = v + 1 where room = p_room;
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
    select p_room, 'sys', '', jsonb_build_object('t', coalesce(p_name,'누군가') || ' 님이 「' || coalesce(s.data#>>array['battle','trainers',p_seat,'name'], p_seat) || '」 자리에 앉았다.')
    from om_state s where s.room = p_room;
  return true;
end $$;

-- ---------- 계정 RPC ----------
-- 가입. 아이디 3~20자(영문 소문자 · 숫자 · _ . -), 비밀번호 4자 이상. 관리자가 아직 없으면 이 계정이 관리자
create or replace function public.om_signup(p_id text, p_pw text, p_name text)
returns boolean language plpgsql security definer set search_path = public as $$
declare id text := lower(trim(coalesce(p_id,'')));
begin
  if id !~ '^[a-z0-9_.-]{3,20}$' then raise exception '아이디는 영문 소문자 · 숫자 · _ . - 로 3~20자'; end if;
  if length(coalesce(p_pw,'')) < 4 then raise exception '비밀번호는 4자 이상'; end if;
  if exists (select 1 from om_users where uid = id) then raise exception '이미 있는 아이디입니다'; end if;
  insert into om_users(uid, pw, name, admin)
    values (id, extensions.crypt(p_pw, extensions.gen_salt('bf')), left(coalesce(nullif(trim(p_name),''), id), 30), not exists (select 1 from om_users where admin));
  return true;
end $$;

-- 로그인 → 로그인 표 (기기에 저장). 틀리면 null
create or replace function public.om_login(p_id text, p_pw text, p_device text)
returns text language plpgsql security definer set search_path = public as $$
declare id text := lower(trim(coalesce(p_id,''))); h text; tok text;
begin
  select pw into h from om_users where uid = id;
  if h is null or h <> extensions.crypt(coalesce(p_pw,''), h) then
    perform pg_sleep(0.4);   -- 마구 넣어 보기 늦추기
    return null;
  end if;
  tok := encode(extensions.gen_random_bytes(24), 'hex');
  insert into om_sess(hash, uid, device) values (om_hash(tok), id, left(coalesce(p_device,''), 80));
  update om_users set last_at = now() where uid = id;
  return tok;
end $$;

create or replace function public.om_logout(p_token text)
returns boolean language sql security definer set search_path = public as $$
  delete from om_sess where hash = om_hash(p_token) returning true $$;

-- 나: {uid, name, admin, rooms:[{id, name, role, seat}]} (관리자는 모든 방 · 멤버가 아니면 role 'gm')
create or replace function public.om_me(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u text; usr record; rooms jsonb;
begin
  u := om_uid(p_token);
  if u is null then return null; end if;
  select uid, name, admin into usr from om_users where uid = u;
  if usr.admin then
    select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'name', r.name, 'role', coalesce(m.role, 'gm'), 'seat', coalesce(m.seat, ''), 'at', r.created_at) order by r.created_at desc), '[]'::jsonb)
      into rooms from om_rooms r left join om_members m on m.room = r.id and m.uid = u;
  else
    select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'name', r.name, 'role', m.role, 'seat', m.seat, 'at', r.created_at) order by r.created_at desc), '[]'::jsonb)
      into rooms from om_members m join om_rooms r on r.id = m.room where m.uid = u;
  end if;
  return jsonb_build_object('uid', usr.uid, 'name', usr.name, 'admin', usr.admin, 'rooms', rooms);
end $$;

-- 내 이름 · 비밀번호 바꾸기 (비밀번호는 지금 것을 맞혀야)
create or replace function public.om_me_update(p_token text, p_name text, p_old text, p_new text)
returns boolean language plpgsql security definer set search_path = public as $$
declare u text; h text;
begin
  u := om_uid(p_token);
  if u is null then raise exception '로그인이 끝났습니다'; end if;
  if p_name is not null then update om_users set name = left(coalesce(nullif(trim(p_name),''), u), 30) where uid = u; end if;
  if p_new is not null then
    if length(p_new) < 4 then raise exception '비밀번호는 4자 이상'; end if;
    select pw into h from om_users where uid = u;
    if h <> extensions.crypt(coalesce(p_old,''), h) then raise exception '지금 비밀번호가 맞지 않습니다'; end if;
    update om_users set pw = extensions.crypt(p_new, extensions.gen_salt('bf')) where uid = u;
    delete from om_sess where uid = u and hash <> om_hash(p_token);   -- 다른 기기의 로그인은 끊는다
  end if;
  return true;
end $$;

-- 방 만들기 (계정): 만든 계정이 그 방의 GM
create or replace function public.om_room_new(p_token text, p_name text)
returns text language plpgsql security definer set search_path = public as $$
declare u text; rid text;
begin
  u := om_uid(p_token);
  if u is null then raise exception '로그인이 끝났습니다'; end if;
  rid := om_create_room(p_name, encode(extensions.gen_random_bytes(18), 'hex'));   -- 예전 GM 비밀값 자리는 아무도 모르는 값으로
  insert into om_members(room, uid, role, seat) values (rid, u, 'gm', '') on conflict (room, uid) do update set role = 'gm', seat = '';
  return rid;
end $$;

-- ---------- 관리자 RPC ----------
create or replace function public.om_is_admin(p_token text) returns boolean
language sql security definer set search_path = public as $$
  select coalesce((select admin from om_users where uid = om_uid(p_token)), false) $$;

-- 유저 목록: [{uid, name, admin, created_at, last_at, devices, rooms:[{room, name, role, seat}]}] · 방 목록도 같이
create or replace function public.om_admin_list(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not om_is_admin(p_token) then raise exception '관리자만'; end if;
  return jsonb_build_object(
    'users', (select coalesce(jsonb_agg(jsonb_build_object('uid', u.uid, 'name', u.name, 'admin', u.admin, 'created_at', u.created_at, 'last_at', u.last_at,
                'devices', (select count(*) from om_sess s where s.uid = u.uid),
                'rooms', (select coalesce(jsonb_agg(jsonb_build_object('room', m.room, 'name', r.name, 'role', m.role, 'seat', m.seat)), '[]'::jsonb) from om_members m join om_rooms r on r.id = m.room where m.uid = u.uid))
              order by u.created_at), '[]'::jsonb) from om_users u),
    'rooms', (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'name', r.name, 'accountOnly', coalesce((r.settings->>'accountOnly')::boolean, false)) order by r.created_at desc), '[]'::jsonb) from om_rooms r));
end $$;

-- 방 권한 주기 · 빼기: p_role 'gm' | 'pl' | null(빼기). p_seat 은 PL 의 좌석 (null 이면 그대로)
create or replace function public.om_admin_member(p_token text, p_uid text, p_room text, p_role text, p_seat text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not om_is_admin(p_token) then raise exception '관리자만'; end if;
  if p_role is null then delete from om_members where room = p_room and uid = p_uid; return true; end if;
  if p_role not in ('gm','pl') then raise exception '역할은 gm 또는 pl'; end if;
  insert into om_members(room, uid, role, seat) values (p_room, p_uid, p_role, case when p_role = 'gm' then '' else coalesce(p_seat, '') end)
    on conflict (room, uid) do update set role = excluded.role, seat = case when excluded.role = 'gm' then '' else coalesce(p_seat, om_members.seat) end;
  return true;
end $$;

-- 계정 손보기: 관리자 켜고 끄기 · 비밀번호 초기화 · 지우기 (자기 자신의 관리자 해제 · 삭제는 막는다)
create or replace function public.om_admin_user(p_token text, p_uid text, p_admin boolean, p_pw text, p_delete boolean)
returns boolean language plpgsql security definer set search_path = public as $$
declare me text;
begin
  if not om_is_admin(p_token) then raise exception '관리자만'; end if;
  me := om_uid(p_token);
  if coalesce(p_delete, false) then
    if p_uid = me then raise exception '자기 계정은 지울 수 없습니다'; end if;
    delete from om_users where uid = p_uid; return true;
  end if;
  if p_admin is not null then
    if p_uid = me and not p_admin then raise exception '자기 관리자 권한은 뺄 수 없습니다'; end if;
    update om_users set admin = p_admin where uid = p_uid;
  end if;
  if p_pw is not null then
    if length(p_pw) < 4 then raise exception '비밀번호는 4자 이상'; end if;
    update om_users set pw = extensions.crypt(p_pw, extensions.gen_salt('bf')) where uid = p_uid;
    delete from om_sess where uid = p_uid;   -- 그 계정의 로그인은 모두 끊긴다
  end if;
  return true;
end $$;

grant execute on function public.om_signup(text,text,text) to anon, authenticated;
grant execute on function public.om_login(text,text,text) to anon, authenticated;
grant execute on function public.om_logout(text) to anon, authenticated;
grant execute on function public.om_me(text) to anon, authenticated;
grant execute on function public.om_me_update(text,text,text,text) to anon, authenticated;
grant execute on function public.om_room_new(text,text) to anon, authenticated;
grant execute on function public.om_admin_list(text) to anon, authenticated;
grant execute on function public.om_admin_member(text,text,text,text,text) to anon, authenticated;
grant execute on function public.om_admin_user(text,text,boolean,text,boolean) to anon, authenticated;
grant execute on function public.om_claim_seat(text,text,text,text) to anon, authenticated;
grant execute on function public.om_whoami(text,text) to anon, authenticated;
revoke execute on function public.om_uid(text) from public, anon, authenticated;
revoke execute on function public.om_is_admin(text) from public, anon, authenticated;
