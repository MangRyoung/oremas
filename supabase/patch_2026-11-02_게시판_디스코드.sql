-- 2026-11-02 망령: 「학교 게시판 → 디스코드」 — 게시판에 새 글이 올라오면 디스코드 채널(또는 스레드)로 보낸다
--
-- patch_2026-11-02_게시판.sql 다음에 실행한다. 여러 번 실행해도 된다. 데이터를 지우지 않는다.
--
-- 방식: om_bbs 에 줄이 들어가면 트리거가 pg_net(net.http_post)으로 디스코드 웹후크를 부른다. 브라우저는 웹후크 주소를 모른다.
--   · 웹후크 주소는 om_bbs_hook 표에만 (RLS 켜고 정책 없음 = 아래 함수로만). GM 에게도 끝 4자만 돌려준다
--   · net 스키마는 Data API 로 열려 있지 않다 (Supabase 문서) — 플레이어 브라우저에서 보낼 대기열을 읽을 수 없다
--   · 보낸 기록(net._http_response)은 6시간 뒤 저절로 지워진다 → 용량이 쌓이지 않는다
-- 보내는 모양: 글쓴이 이름 · 초상으로 (익명은 「익명」, 초상 없음), 첫 줄에 「-# 📋 게시판」, 그림은 embed
--   댓글은 「댓글도 보내기」를 켰을 때만. 숨긴 게시판은 보내지 않는다. 고치기 · 지우기 · 좋아요는 보내지 않는다
--   @everyone · @here · 사람 멘션은 울리지 않게 막는다 (allowed_mentions parse [])
-- 스레드: 일반 채팅 채널이면 디스코드에서 스레드를 만들고 「링크 복사」를 GM 설정에 붙여 넣는다 (thread_id)
--         포럼 채널이면 GM 설정 「새 포럼 글 이름」으로 시험 보내기를 하면 그 글이 만들어지고 id 를 저절로 기억한다

create extension if not exists pg_net;

create table if not exists public.om_bbs_hook (
  room    text primary key references public.om_rooms(id) on delete cascade,
  url     text not null default '',
  thread  text not null default '',          -- 보낼 스레드 id (비면 채널 본문)
  tname   text not null default '',          -- 포럼 채널이면 시험 보내기 때 이 이름으로 새 글을 만든다
  boards  jsonb not null default '[]'::jsonb, -- 보낼 게시판 id 목록. 비면 숨기지 않은 게시판 전부
  cm      boolean not null default false,     -- 댓글도 보내기
  "on"    boolean not null default true,
  treq    bigint,                             -- 마지막 시험 보내기 요청 번호
  tmk     boolean not null default false,     -- 그 시험이 포럼 글 만들기였는지
  at      timestamptz not null default now()
);
alter table public.om_bbs_hook enable row level security;   -- 정책 없음: 아래 함수로만
-- 11-02 저녁 「시트 한 장 요약 → 디코로」: 카드는 따로 정한 스레드(비면 게시판 스레드)로
alter table public.om_bbs_hook add column if not exists cthread text not null default '';
alter table public.om_bbs_hook add column if not exists creq bigint;
alter table public.om_bbs_hook add column if not exists cat timestamptz;

-- 디스코드가 거절하는 이름 조각을 피한다 (discord · clyde), 1~80자
create or replace function public.om_bbs_dc_name(p text) returns text language sql immutable as $$
  select left(coalesce(nullif(btrim(regexp_replace(regexp_replace(coalesce(p, ''), 'discord', 'disc0rd', 'gi'), 'clyde', 'clyd3', 'gi')), ''), '이름 없음'), 80)
$$;

-- 한 줄(글 · 댓글)을 디스코드 메시지 모양으로
create or replace function public.om_bbs_dc_payload(r public.om_bbs) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare bn text; head text; par text; nm text; av text; txt text; j jsonb;
begin
  select name into bn from om_bbs_board where room = r.room and id = r.board;
  head := '-# 📋 ' || coalesce(bn, '게시판');
  if r.parent is not null then
    select left(regexp_replace(o.body, '\s+', ' ', 'g'), 30) into par from om_bbs o where o.id = r.parent;
    head := head || ' · 💬 「' || coalesce(par, '') || case when length(coalesce(par, '')) >= 30 then '…' else '' end || '」에 단 댓글';
  end if;
  if r.anon then nm := '익명'; av := '';
  else nm := r.who->>'n'; av := coalesce(r.who->>'img', ''); end if;
  if av !~ '^https?://' or length(av) > 1000 then av := ''; end if;
  txt := r.body;
  if length(txt) > 1850 then txt := left(txt, 1850) || '… (게시판에서 이어서)'; end if;
  j := jsonb_build_object('username', om_bbs_dc_name(nm), 'content', head || E'\n' || txt,
                          'allowed_mentions', jsonb_build_object('parse', '[]'::jsonb));
  if av <> '' then j := j || jsonb_build_object('avatar_url', av); end if;
  if r.img ~ '^https?://' then j := j || jsonb_build_object('embeds', jsonb_build_array(jsonb_build_object('image', jsonb_build_object('url', r.img)))); end if;
  return j;
end $$;

-- 새 줄 → 디스코드. 무슨 일이 있어도 글쓰기는 막지 않는다
create or replace function public.om_bbs_dc_fire() returns trigger
language plpgsql security definer set search_path = public as $$
declare h record; hid boolean;
begin
  begin
    select * into h from om_bbs_hook where room = new.room;
    if not found or not h."on" or h.url = '' then return new; end if;
    if new.parent is not null and not h.cm then return new; end if;
    select hidden into hid from om_bbs_board where room = new.room and id = new.board;
    if coalesce(hid, false) then return new; end if;
    if jsonb_array_length(h.boards) > 0 and not (h.boards ? new.board) then return new; end if;
    perform net.http_post(url := h.url, body := om_bbs_dc_payload(new),
      params := case when h.thread <> '' then jsonb_build_object('thread_id', h.thread) else '{}'::jsonb end,
      timeout_milliseconds := 5000);
  exception when others then null;
  end;
  return new;
end $$;
drop trigger if exists om_bbs_dc on public.om_bbs;
create trigger om_bbs_dc after insert on public.om_bbs for each row execute function public.om_bbs_dc_fire();

-- GM: 설정 보기 (주소는 끝 4자만)
create or replace function public.om_bbs_hook_get(p_room text, p_secret text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare h record;
begin
  if om_who(p_room, p_secret) is distinct from 'gm' then raise exception 'GM 만 볼 수 있습니다'; end if;
  select * into h from om_bbs_hook where room = p_room;
  if not found then return jsonb_build_object('set', false); end if;
  return jsonb_build_object('set', h.url <> '', 'tail', right(h.url, 4), 'thread', h.thread, 'tname', h.tname,
    'boards', h.boards, 'cm', h.cm, 'on', h."on", 'at', h.at, 'cthread', h.cthread);
end $$;

-- GM: 설정 바꾸기. p_url 이 null 이면 주소는 그대로, '' 이면 지운다. p_cthread = 시트 카드 스레드 (비면 게시판 스레드)
drop function if exists public.om_bbs_hook_put(text, text, text, text, text, jsonb, boolean, boolean);
create or replace function public.om_bbs_hook_put(p_room text, p_secret text, p_url text, p_thread text, p_tname text, p_boards jsonb, p_cm boolean, p_on boolean, p_cthread text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare u text; t text; ct text;
begin
  if om_who(p_room, p_secret) is distinct from 'gm' then raise exception 'GM 만 바꿀 수 있습니다'; end if;
  u := btrim(coalesce(p_url, ''));
  if p_url is not null and u <> '' and u !~ '^https://((ptb|canary)\.)?discord(app)?\.com/api(/v\d+)?/webhooks/\d+/[A-Za-z0-9_-]+/?$' then
    raise exception '디스코드 웹후크 주소가 아닙니다 (https://discord.com/api/webhooks/… )';
  end if;
  -- 스레드: 링크(https://discord.com/channels/서버/스레드)든 숫자든 마지막 숫자만
  t := coalesce(substring(btrim(coalesce(p_thread, '')) from '(\d{15,25})/?$'), '');
  ct := coalesce(substring(btrim(coalesce(p_cthread, '')) from '(\d{15,25})/?$'), '');
  if p_boards is not null and jsonb_typeof(p_boards) <> 'array' then raise exception '잘못된 게시판 목록'; end if;
  insert into om_bbs_hook(room, url, thread, tname, boards, cm, "on", cthread)
    values (p_room, case when p_url is null then '' else u end, t, left(btrim(coalesce(p_tname, '')), 90), coalesce(p_boards, '[]'::jsonb), coalesce(p_cm, false), coalesce(p_on, true), ct)
  on conflict (room) do update set cthread = ct,
    url = case when p_url is null then om_bbs_hook.url else u end,
    thread = t, tname = left(btrim(coalesce(p_tname, '')), 90), boards = coalesce(p_boards, om_bbs_hook.boards),
    cm = coalesce(p_cm, om_bbs_hook.cm), "on" = coalesce(p_on, om_bbs_hook."on"), at = now();
  return om_bbs_hook_get(p_room, p_secret);
end $$;

-- GM: 시험 보내기. 스레드가 비고 「새 포럼 글 이름」이 있으면 그 이름으로 포럼 글을 만든다. 요청 번호를 돌려준다
create or replace function public.om_bbs_hook_test(p_room text, p_secret text) returns bigint
language plpgsql security definer set search_path = public as $$
declare h record; rn text; mk boolean; j jsonb; p jsonb; rid bigint;
begin
  if om_who(p_room, p_secret) is distinct from 'gm' then raise exception 'GM 만 보낼 수 있습니다'; end if;
  select * into h from om_bbs_hook where room = p_room;
  if not found or h.url = '' then raise exception '웹후크 주소를 먼저 저장해 주세요'; end if;
  select name into rn from om_rooms where id = p_room;
  mk := h.thread = '' and h.tname <> '';
  j := jsonb_build_object('username', '학교 게시판', 'allowed_mentions', jsonb_build_object('parse', '[]'::jsonb),
    'content', '-# 📋 시험 보내기' || E'\n' || '「' || coalesce(rn, p_room) || '」 방의 학교 게시판이 여기로 이어졌어요. 새 글이 올라오면 이곳에 보내요.');
  if mk then j := j || jsonb_build_object('thread_name', h.tname); end if;
  p := jsonb_build_object('wait', 'true');
  if h.thread <> '' then p := p || jsonb_build_object('thread_id', h.thread); end if;
  rid := net.http_post(url := h.url, body := j, params := p, timeout_milliseconds := 8000);
  update om_bbs_hook set treq = rid, tmk = mk where room = p_room;
  return rid;
end $$;

-- GM: 시험 결과. 포럼 글을 만들었으면 그 id 를 스레드로 기억한다
create or replace function public.om_bbs_hook_result(p_room text, p_secret text, p_id bigint) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare h record; r record; cid text;
begin
  if om_who(p_room, p_secret) is distinct from 'gm' then raise exception 'GM 만 볼 수 있습니다'; end if;
  select * into h from om_bbs_hook where room = p_room;
  if not found or h.treq is distinct from p_id then raise exception '이 방의 시험 요청이 아닙니다'; end if;
  select status_code, content, timed_out, error_msg into r from net._http_response where id = p_id;
  if not found then return jsonb_build_object('wait', true); end if;
  if r.status_code between 200 and 299 and h.tmk then
    begin cid := (r.content::jsonb)->>'channel_id'; exception when others then cid := null; end;
    if cid ~ '^\d{15,25}$' then update om_bbs_hook set thread = cid, tmk = false where room = p_room; end if;
  end if;
  return jsonb_build_object('wait', false, 'status', r.status_code, 'timeout', coalesce(r.timed_out, false),
    'error', coalesce(r.error_msg, ''), 'body', left(coalesce(r.content, ''), 300), 'thread', coalesce(cid, h.thread));
end $$;

grant execute on function public.om_bbs_hook_get(text, text) to anon, authenticated;
grant execute on function public.om_bbs_hook_put(text, text, text, text, text, jsonb, boolean, boolean, text) to anon, authenticated;
grant execute on function public.om_bbs_hook_test(text, text) to anon, authenticated;
grant execute on function public.om_bbs_hook_result(text, text, bigint) to anon, authenticated;
revoke execute on function public.om_bbs_dc_payload(public.om_bbs) from public, anon, authenticated;

-- 11-02 저녁 망령 「시트 한 장 요약 → 디코로 버튼, 지정해 둔 스레드에」
-- 방에 앉은 사람(GM · 좌석)이 웹툴 「한 장 요약」 그림(이 프로젝트 저장소 oremas 에 올린 것)을 디스코드로 보낸다.
-- 스레드 = cthread (비면 게시판 스레드). 그림 주소는 이 Supabase 의 oremas 저장소만. 방마다 8초에 한 장
create or replace function public.om_dc_card(p_room text, p_secret text, p_title text, p_sub text, p_img text, p_who jsonb) returns bigint
language plpgsql security definer set search_path = public as $$
declare me text; h record; th text; nm text; av text; j jsonb; rid bigint;
begin
  me := om_who(p_room, p_secret);
  if me is null then raise exception '방에 앉은 사람만 보낼 수 있습니다'; end if;
  select * into h from om_bbs_hook where room = p_room;
  if not found or h.url = '' or not h."on" then raise exception '디스코드 연동이 아직 없습니다 — GM 이 학교 게시판 「🔗 디스코드」에서 이어 주세요'; end if;
  if coalesce(p_img, '') !~ '^https://jsnvqcvwspxzfnhdethl\.supabase\.co/storage/v1/object/public/oremas/' or length(p_img) > 1000 then raise exception '잘못된 그림 주소'; end if;
  if h.cat is not null and h.cat > now() - interval '8 seconds' then raise exception '조금 뒤에 다시 보내 주세요'; end if;
  nm := coalesce(nullif(btrim(p_who->>'n'), ''), '학교 게시판'); av := coalesce(p_who->>'img', '');
  if av !~ '^https?://' or length(av) > 1000 then av := ''; end if;
  j := jsonb_build_object('username', om_bbs_dc_name(nm), 'allowed_mentions', jsonb_build_object('parse', '[]'::jsonb),
    'content', '-# 🃏 한 장 요약' || E'\n' || '**' || left(coalesce(p_title, ''), 100) || '**' || case when coalesce(p_sub, '') <> '' then ' · ' || left(p_sub, 100) else '' end,
    'embeds', jsonb_build_array(jsonb_build_object('image', jsonb_build_object('url', p_img))));
  if av <> '' then j := j || jsonb_build_object('avatar_url', av); end if;
  th := coalesce(nullif(h.cthread, ''), h.thread);
  rid := net.http_post(url := h.url, body := j,
    params := case when th <> '' then jsonb_build_object('thread_id', th, 'wait', 'true') else jsonb_build_object('wait', 'true') end,
    timeout_milliseconds := 8000);
  update om_bbs_hook set creq = rid, cat = now() where room = p_room;
  return rid;
end $$;

-- 보낸 결과 (방에 앉은 사람, 그 방의 마지막 카드 요청만)
create or replace function public.om_dc_card_result(p_room text, p_secret text, p_id bigint) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare r record;
begin
  if om_who(p_room, p_secret) is null then raise exception '권한이 없습니다'; end if;
  if not exists (select 1 from om_bbs_hook where room = p_room and creq = p_id) then raise exception '이 방의 카드 요청이 아닙니다'; end if;
  select status_code, content, timed_out, error_msg into r from net._http_response where id = p_id;
  if not found then return jsonb_build_object('wait', true); end if;
  return jsonb_build_object('wait', false, 'status', r.status_code, 'timeout', coalesce(r.timed_out, false), 'error', coalesce(r.error_msg, ''), 'body', left(coalesce(r.content, ''), 300));
end $$;
grant execute on function public.om_dc_card(text, text, text, text, text, jsonb) to anon, authenticated;
grant execute on function public.om_dc_card_result(text, text, bigint) to anon, authenticated;
