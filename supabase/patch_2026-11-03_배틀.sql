-- 2026-11-03 감우: 배틀 쪽 — ① 여러 칸 한 번에 쓰기(om_jset_many) ② 턴 체크포인트 · 배틀 저장(om_snap)
--
-- ① om_jset_many(방, 비밀값, patches)
--   patches = [{"path":["battle","phase"],"value":1}, {"path":["ready"],"value":{}}, …]  (value 가 null 이면 그 칸을 지운다)
--   칸마다 om_put 과 똑같은 권한 검사를 거치고, 하나라도 막히면 전부 되돌린다 (한 트랜잭션).
--   화면은 이 함수가 없으면(PGRST202) 예전처럼 칸마다 om_put 으로 쓴다 (js/store.js setStateMany → js/app.js setMany).
-- ② om_snap — 턴 개시 때의 배틀 전체 스냅샷(kind 'turn' · 방마다 최근 3개만) 과 이름 붙인 저장(kind 'save' · 방마다 60개까지).
--   방 상태(om_state · om_part) 밖에 둔다 — 방 상태에 두면 매 턴 커지고 실시간 신호에도 실린다.
--   읽기 · 쓰기: 방에 앉은 사람(GM · 좌석). 지우기: GM 또는 저장한 사람. 함수가 없으면 화면은 이 브라우저(localStorage)에만 남긴다.
-- 여러 번 실행해도 된다. 데이터를 지우지 않는다.

-- ---------- ① 여러 칸 한 번에 ----------
create or replace function public.om_jset_many(p_room text, p_secret text, p_patches jsonb)
returns bigint language plpgsql security definer set search_path = public as $$
declare x jsonb; nv bigint := 0; pth text[]; n int := 0;
begin
  if p_patches is null or jsonb_typeof(p_patches) <> 'array' then raise exception 'patches 는 배열이어야 합니다'; end if;
  if jsonb_array_length(p_patches) > 400 then raise exception '한 번에 400칸까지'; end if;
  for x in select * from jsonb_array_elements(p_patches) loop
    if jsonb_typeof(x->'path') <> 'array' then raise exception 'path 가 없습니다'; end if;
    select array_agg(e.value) into pth from jsonb_array_elements_text(x->'path') e;
    if pth is null or array_length(pth, 1) is null then raise exception '빈 path 는 쓸 수 없습니다'; end if;
    nv := public.om_put(p_room, p_secret, pth, x->'value');   -- 권한 검사 · 조각 쓰기 · 신호까지 om_put 그대로
    n := n + 1;
  end loop;
  return nv;
end $$;
grant execute on function public.om_jset_many(text, text, jsonb) to anon, authenticated;

-- ---------- ② 스냅샷 ----------
create table if not exists public.om_snap (
  room text not null references public.om_rooms(id) on delete cascade,
  id   text not null,
  kind text not null default 'turn',      -- 'turn' 턴 개시 체크포인트 | 'save' 이름 붙인 저장
  name text not null default '',
  turn int  not null default 0,
  w    text not null default '',          -- 남긴 자리 (gm 또는 좌석 id)
  at   timestamptz not null default now(),
  data jsonb not null,                    -- state.battle 전체
  primary key (room, id)
);
alter table public.om_snap enable row level security;   -- 정책 없음: 아래 함수로만
create index if not exists om_snap_room_kind_at on public.om_snap(room, kind, at desc);

-- 남기기. kind 'turn' 은 같은 방의 오래된 체크포인트를 지워 최근 3개만 남긴다
create or replace function public.om_snap_put(p_room text, p_secret text, p_id text, p_kind text, p_name text, p_turn int, p_data jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
declare who text; old record;
begin
  who := om_who(p_room, p_secret);
  if who is null then raise exception '방에 앉은 사람만 남길 수 있습니다'; end if;
  if p_id is null or length(p_id) > 40 then raise exception '잘못된 id'; end if;
  if p_kind not in ('turn','save') then raise exception '잘못된 kind'; end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' then raise exception '배틀 상태가 아닙니다'; end if;
  if octet_length(p_data::text) > 2097152 then raise exception '배틀 상태가 너무 큽니다 (2MB)'; end if;
  select * into old from om_snap where room = p_room and id = p_id;
  if found then
    if who <> 'gm' and who <> old.w then raise exception 'GM 이나 저장한 사람만 덮어쓸 수 있습니다'; end if;
    update om_snap set kind = p_kind, name = coalesce(p_name, ''), turn = coalesce(p_turn, 0), data = p_data, at = now(), w = who where room = p_room and id = p_id;
  else
    if p_kind = 'save' and (select count(*) from om_snap where room = p_room and kind = 'save') >= 60 then raise exception '저장이 가득 찼습니다 (60개) — 오래된 것을 지워 주세요'; end if;
    insert into om_snap(room, id, kind, name, turn, w, data) values (p_room, p_id, p_kind, coalesce(p_name, ''), coalesce(p_turn, 0), who, p_data);
  end if;
  if p_kind = 'turn' then
    delete from om_snap s where s.room = p_room and s.kind = 'turn'
      and s.id not in (select id from om_snap where room = p_room and kind = 'turn' order by at desc limit 3);
  end if;
  return true;
end $$;

-- 목록 (데이터 없이)
-- ★ 11-03 13:17 망령 「cannot execute UPDATE in a read-only transaction」: om_who → om_uid 가 세션 last_at 을 update 하므로 list · get 을 stable 로 두면 안 된다(stable 은 GET = 읽기 전용 트랜잭션). 둘 다 volatile 로.
create or replace function public.om_snap_list(p_room text, p_secret text, p_kind text)
returns table(id text, kind text, name text, turn int, w text, at timestamptz, bytes int)
language plpgsql security definer set search_path = public as $$
begin
  if om_who(p_room, p_secret) is null then raise exception '방에 앉은 사람만 볼 수 있습니다'; end if;
  return query select s.id, s.kind, s.name, s.turn, s.w, s.at, octet_length(s.data::text) from om_snap s
    where s.room = p_room and (p_kind is null or s.kind = p_kind) order by s.at desc limit 100;
end $$;

-- 하나 전부
create or replace function public.om_snap_get(p_room text, p_secret text, p_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if om_who(p_room, p_secret) is null then raise exception '방에 앉은 사람만 볼 수 있습니다'; end if;
  select * into r from om_snap where room = p_room and id = p_id;
  if not found then return null; end if;
  return jsonb_build_object('id', r.id, 'kind', r.kind, 'name', r.name, 'turn', r.turn, 'w', r.w, 'at', r.at, 'data', r.data);
end $$;

create or replace function public.om_snap_del(p_room text, p_secret text, p_id text)
returns boolean language plpgsql security definer set search_path = public as $$
declare who text; old record;
begin
  who := om_who(p_room, p_secret);
  if who is null then raise exception '방에 앉은 사람만 지울 수 있습니다'; end if;
  select * into old from om_snap where room = p_room and id = p_id;
  if not found then return false; end if;
  if who <> 'gm' and who <> old.w then raise exception 'GM 이나 저장한 사람만 지울 수 있습니다'; end if;
  delete from om_snap where room = p_room and id = p_id;
  return true;
end $$;

grant execute on function public.om_snap_put(text, text, text, text, text, int, jsonb) to anon, authenticated;
grant execute on function public.om_snap_list(text, text, text) to anon, authenticated;
grant execute on function public.om_snap_get(text, text, text) to anon, authenticated;
grant execute on function public.om_snap_del(text, text, text) to anon, authenticated;
