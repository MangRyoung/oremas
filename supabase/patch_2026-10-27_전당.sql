-- 2026-10-27 망령: 「전당」 — 끝난 배틀을 승패 · 마무리 상황 요약 · 간략 로그 · 코멘트와 함께 남긴다
--
-- 용량: 방 상태(om_state · om_part)에 넣지 않는다. 방 상태는 바뀔 때마다 통째로 새로 쓰고 실시간으로 나가니,
--       쌓이기만 하는 기록이 거기 있으면 저장마다 무거워진다 → 따로 om_hall 표에 한 판 = 한 줄.
--   · head : 목록에 보이는 요약 (승패 · 트레이너 · 포켓몬 이름/HP/상태 · 턴) — 몇 KB
--   · log  : 간략 로그. 화면에서 gzip 으로 줄여 base64 글자로 넣는다 — 목록에서는 읽지 않고, 한 판을 열 때만
--   · cm   : 코멘트 [{i, by, w, t, at}]
-- 제한(서버가 막는다): head 32KB · log 120KB · 코멘트 한 개 4000자 · 한 판 코멘트 200개 · 방마다 500판
-- 읽기: 방 로그처럼 누구나(관전 포함). 쓰기: 방에 앉은 사람(GM · 좌석). 지우기 · 고치기: GM 또는 등록한 사람. 코멘트 지우기: GM 또는 쓴 사람.
-- 여러 번 실행해도 된다. 데이터를 지우지 않는다.

create table if not exists public.om_hall (
  room text not null references public.om_rooms(id) on delete cascade,
  id   text not null,
  at   timestamptz not null default now(),
  w    text not null default '',          -- 등록한 자리 (gm 또는 좌석 id)
  head jsonb not null,
  log  text,
  cm   jsonb not null default '[]'::jsonb,
  primary key (room, id)
);
alter table public.om_hall enable row level security;   -- 정책 없음: 아래 함수로만
create index if not exists om_hall_room_at on public.om_hall(room, at desc);

-- 목록 (가벼운 것만): 요약에서 포켓몬 그림 · HP 같은 건 빼고 이름 · 남은 수만. 최근 것부터 p_limit 개, p_before 보다 앞의 것
drop function if exists public.om_hall_list(text);
create or replace function public.om_hall_list(p_room text, p_before timestamptz default null, p_limit int default 60)
returns table(id text, at timestamptz, w text, head jsonb, ncm int)
language sql stable security definer set search_path = public as $$
  select h.id, h.at, h.w,
    jsonb_build_object('t', h.head->'t', 'r', h.head->'r', 'turn', h.head->'turn', 'mode', h.head->'mode', 'by', h.head->'by',
      'sides', (select jsonb_object_agg(s.k, jsonb_build_object(
          'tr', coalesce((select jsonb_agg(jsonb_build_object('n', t->'n')) from jsonb_array_elements(case when jsonb_typeof(h.head#>array['sides',s.k,'tr']) = 'array' then h.head#>array['sides',s.k,'tr'] else '[]'::jsonb end) t), '[]'::jsonb),
          'mons', coalesce((select jsonb_agg(jsonb_build_object('n', m->'n') || case when m ? 'dead' then '{"dead":1}'::jsonb else '{}'::jsonb end) from jsonb_array_elements(case when jsonb_typeof(h.head#>array['sides',s.k,'mons']) = 'array' then h.head#>array['sides',s.k,'mons'] else '[]'::jsonb end) m), '[]'::jsonb)))
        from (values ('left'), ('right')) s(k))),
    jsonb_array_length(h.cm)
  from om_hall h where h.room = p_room and (p_before is null or h.at < p_before)
  order by h.at desc limit least(greatest(coalesce(p_limit, 60), 1), 200)
$$;

-- 한 판 전부
create or replace function public.om_hall_get(p_room text, p_id text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', h.id, 'at', h.at, 'w', h.w, 'head', h.head, 'log', h.log, 'cm', h.cm) from om_hall h where h.room = p_room and h.id = p_id
$$;

-- 등록 · 고치기 (p_log 가 null 이면 로그는 그대로)
create or replace function public.om_hall_put(p_room text, p_secret text, p_id text, p_head jsonb, p_log text)
returns boolean language plpgsql security definer set search_path = public as $$
declare who text; old record;
begin
  who := om_who(p_room, p_secret);
  if who is null then raise exception '방에 앉은 사람만 전당에 남길 수 있습니다'; end if;
  if p_id is null or length(p_id) > 40 then raise exception '잘못된 id'; end if;
  if p_head is null or jsonb_typeof(p_head) <> 'object' or length(p_head::text) > 32768 then raise exception '요약이 너무 큽니다 (32KB)'; end if;
  if p_log is not null and length(p_log) > 122880 then raise exception '로그가 너무 큽니다 (120KB)'; end if;
  select * into old from om_hall where room = p_room and id = p_id;
  if found then
    if who <> 'gm' and who <> old.w then raise exception 'GM 이나 등록한 사람만 고칠 수 있습니다'; end if;
    update om_hall set head = p_head, log = coalesce(p_log, log) where room = p_room and id = p_id;
  else
    if (select count(*) from om_hall where room = p_room) >= 500 then raise exception '전당이 가득 찼습니다 (500판) — 오래된 기록을 지워 주세요'; end if;
    insert into om_hall(room, id, w, head, log) values (p_room, p_id, who, p_head, p_log);
  end if;
  return true;
end $$;

create or replace function public.om_hall_del(p_room text, p_secret text, p_id text)
returns boolean language plpgsql security definer set search_path = public as $$
declare who text;
begin
  who := om_who(p_room, p_secret);
  if who is null then raise exception '권한이 없습니다'; end if;
  delete from om_hall where room = p_room and id = p_id and (who = 'gm' or w = who);
  if not found then raise exception 'GM 이나 등록한 사람만 지울 수 있습니다'; end if;
  return true;
end $$;

-- 코멘트 달기 (p_t) · 지우기 (p_del = 코멘트 i)
create or replace function public.om_hall_cm(p_room text, p_secret text, p_id text, p_by text, p_t text, p_del text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare who text; c jsonb;
begin
  who := om_who(p_room, p_secret);
  if who is null then raise exception '방에 앉은 사람만 코멘트를 쓸 수 있습니다'; end if;
  select cm into c from om_hall where room = p_room and id = p_id for update;
  if not found then raise exception '그 기록이 없습니다'; end if;
  if p_del is not null then
    if not exists (select 1 from jsonb_array_elements(c) e where e->>'i' = p_del and (who = 'gm' or e->>'w' = who)) then raise exception 'GM 이나 쓴 사람만 지울 수 있습니다'; end if;
    c := coalesce((select jsonb_agg(e) from jsonb_array_elements(c) e where e->>'i' <> p_del), '[]'::jsonb);
  else
    if p_t is null or btrim(p_t) = '' then raise exception '빈 코멘트'; end if;
    if jsonb_array_length(c) >= 200 then raise exception '코멘트가 가득 찼습니다 (200개)'; end if;
    c := c || jsonb_build_array(jsonb_build_object('i', substr(md5(random()::text || clock_timestamp()::text), 1, 8), 'by', left(coalesce(p_by, ''), 40), 'w', who, 't', left(p_t, 4000), 'at', (extract(epoch from now()) * 1000)::bigint));
  end if;
  update om_hall set cm = c where room = p_room and id = p_id;
  return c;
end $$;

grant execute on function public.om_hall_list(text,timestamptz,int) to anon, authenticated;
grant execute on function public.om_hall_get(text,text) to anon, authenticated;
grant execute on function public.om_hall_put(text,text,text,jsonb,text) to anon, authenticated;
grant execute on function public.om_hall_del(text,text,text) to anon, authenticated;
grant execute on function public.om_hall_cm(text,text,text,text,text,text) to anon, authenticated;

-- 되돌리기: drop function om_hall_list(text,timestamptz,int), om_hall_get(text,text), om_hall_put(text,text,text,jsonb,text), om_hall_del(text,text,text), om_hall_cm(text,text,text,text,text,text); drop table om_hall;
