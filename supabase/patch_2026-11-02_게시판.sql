-- 2026-11-02 망령: 「학교 게시판」 — 방마다 SNS 처럼 가볍게 글을 올리고, 누구나 게시판(분류)을 판다
--
-- 방 상태(om_state)에 넣지 않는다. 글은 쌓이기만 하니 따로 표 두 개.
--   om_bbs_board : 게시판 (방마다 최대 40개). 누구나(방에 앉은 사람) 만든다. 고치기 · 숨기기 · 지우기는 GM 또는 만든 사람
--   om_bbs       : 글 · 댓글(parent) 한 줄씩. 좋아요는 likes(자리 id 목록). 지우면 del = true 로 남겨 둔다(댓글 줄이 끊기지 않게)
--   ver          : 바뀔 때마다 새 번호 — 화면은 「마지막으로 받은 ver 뒤의 줄」만 받아 와서 합친다
-- 익명 글: 실제 쓴 자리(w)와 캐릭터(who)는 표에 남지만, 목록 함수가 GM 이 아니면 지워서 돌려준다 (표는 직접 못 읽는다)
-- 제한(서버가 막는다): 글 4000자 · 그림 주소 1000자 · 캐릭터 정보 2KB · 방마다 글 5000줄
-- 읽기: 방 링크를 가진 누구나(관전 포함, 익명은 가린 채). 쓰기: 방에 앉은 사람(GM · 좌석)
-- 여러 번 실행해도 된다. 데이터를 지우지 않는다.
-- 11-02 고침: 목록 · 받아 오기 함수를 stable → volatile (om_who 가 계정 접속 시각을 고쳐 써서 「cannot execute UPDATE in a read-only transaction」이 났다)

create table if not exists public.om_bbs_board (
  room   text not null references public.om_rooms(id) on delete cascade,
  id     text not null,
  name   text not null,
  descr  text not null default '',
  w      text not null default '',
  ord    int  not null default 0,
  hidden boolean not null default false,
  at     timestamptz not null default now(),
  primary key (room, id)
);
alter table public.om_bbs_board enable row level security;   -- 정책 없음: 아래 함수로만

create sequence if not exists public.om_bbs_ver;
create table if not exists public.om_bbs (
  id     bigserial primary key,
  room   text not null references public.om_rooms(id) on delete cascade,
  board  text not null,
  parent bigint,
  w      text not null,
  who    jsonb not null default '{}'::jsonb,
  anon   boolean not null default false,
  body   text not null default '',
  img    text not null default '',
  likes  jsonb not null default '[]'::jsonb,
  del    boolean not null default false,
  at     timestamptz not null default now(),
  ver    bigint not null default nextval('public.om_bbs_ver')
);
alter table public.om_bbs enable row level security;
create index if not exists om_bbs_room_ver on public.om_bbs(room, ver);

-- 게시판 목록. 숨긴 판은 GM 에게만
create or replace function public.om_bbs_boards(p_room text, p_secret text)
returns table(id text, name text, descr text, w text, ord int, hidden boolean, at timestamptz)
language plpgsql volatile security definer set search_path = public as $$
declare who text;
begin
  who := om_who(p_room, coalesce(p_secret, ''));
  return query select b.id, b.name, b.descr, b.w, b.ord, b.hidden, b.at from om_bbs_board b
    where b.room = p_room and (not b.hidden or who = 'gm') order by b.ord, b.at;
end $$;

-- 게시판 만들기 · 고치기 · 지우기 (p_del)
create or replace function public.om_bbs_board_put(p_room text, p_secret text, p_id text, p_name text, p_descr text, p_hidden boolean, p_ord int, p_del boolean)
returns boolean language plpgsql security definer set search_path = public as $$
declare who text; old record;
begin
  who := om_who(p_room, p_secret);
  if who is null then raise exception '방에 앉은 사람만 게시판을 만들 수 있습니다'; end if;
  if p_id is null or length(p_id) > 40 then raise exception '잘못된 id'; end if;
  select * into old from om_bbs_board where room = p_room and id = p_id;
  if coalesce(p_del, false) then
    if not found then return true; end if;
    if who <> 'gm' and who <> old.w then raise exception 'GM 이나 만든 사람만 지울 수 있습니다'; end if;
    delete from om_bbs_board where room = p_room and id = p_id;
    update om_bbs set del = true, ver = nextval('public.om_bbs_ver') where room = p_room and board = p_id and not del;
    return true;
  end if;
  if p_name is null or btrim(p_name) = '' or length(p_name) > 30 then raise exception '게시판 이름은 1~30자'; end if;
  if found then
    if who <> 'gm' and who <> old.w then raise exception 'GM 이나 만든 사람만 고칠 수 있습니다'; end if;
    update om_bbs_board set name = btrim(p_name), descr = left(coalesce(p_descr, descr), 200),
      hidden = case when who = 'gm' then coalesce(p_hidden, hidden) else hidden end, ord = coalesce(p_ord, ord)
      where room = p_room and id = p_id;
  else
    if (select count(*) from om_bbs_board where room = p_room) >= 40 then raise exception '게시판이 가득 찼습니다 (40개)'; end if;
    insert into om_bbs_board(room, id, name, descr, w, ord, hidden)
      values (p_room, p_id, btrim(p_name), left(coalesce(p_descr, ''), 200), who, coalesce(p_ord, 0), case when who = 'gm' then coalesce(p_hidden, false) else false end);
  end if;
  return true;
end $$;

-- 글 · 댓글 받아 오기: p_after 보다 뒤에 바뀐 줄. 익명 · 지운 글은 가려서
create or replace function public.om_bbs_feed(p_room text, p_secret text, p_after bigint)
returns table(id bigint, board text, parent bigint, w text, who jsonb, anon boolean, body text, img text, likes jsonb, del boolean, at timestamptz, ver bigint)
language plpgsql volatile security definer set search_path = public as $$
declare me text;
begin
  me := om_who(p_room, coalesce(p_secret, ''));
  return query select p.id, p.board, p.parent,
      case when p.del then '' when p.anon and coalesce(me, '') <> 'gm' and coalesce(me, '') <> p.w then '' else p.w end,
      case when p.del then '{}'::jsonb when p.anon and coalesce(me, '') <> 'gm' and coalesce(me, '') <> p.w then '{"n":"익명"}'::jsonb else p.who end,
      p.anon,
      case when p.del then '' else p.body end,
      case when p.del then '' else p.img end,
      p.likes, p.del, p.at, p.ver
    from om_bbs p where p.room = p_room and p.ver > coalesce(p_after, 0)
    order by p.ver limit 1000;
end $$;

-- 글 쓰기 (p_parent 가 있으면 댓글). 'free'(자유게시판)는 없으면 저절로 만든다
create or replace function public.om_bbs_post(p_room text, p_secret text, p_board text, p_parent bigint, p_who jsonb, p_anon boolean, p_body text, p_img text)
returns bigint language plpgsql security definer set search_path = public as $$
declare me text; nid bigint; hb boolean;
begin
  me := om_who(p_room, p_secret);
  if me is null then raise exception '방에 앉은 사람만 글을 쓸 수 있습니다'; end if;
  if (p_body is null or btrim(p_body) = '') and coalesce(p_img, '') = '' then raise exception '빈 글'; end if;
  if length(coalesce(p_body, '')) > 4000 then raise exception '글이 너무 깁니다 (4000자)'; end if;
  if length(coalesce(p_img, '')) > 1000 then raise exception '그림 주소가 너무 깁니다'; end if;
  if p_who is null or jsonb_typeof(p_who) <> 'object' or length(p_who::text) > 2048 then raise exception '잘못된 글쓴이'; end if;
  if p_board = 'free' and not exists (select 1 from om_bbs_board where room = p_room and id = 'free') then
    insert into om_bbs_board(room, id, name, descr, w, ord) values (p_room, 'free', '자유게시판', '아무 이야기나', 'gm', 0) on conflict do nothing;
  end if;
  select hidden into hb from om_bbs_board where room = p_room and id = p_board;
  if not found then raise exception '그 게시판이 없습니다'; end if;
  if hb and me <> 'gm' then raise exception '숨긴 게시판입니다'; end if;
  if p_parent is not null and not exists (select 1 from om_bbs where room = p_room and id = p_parent and board = p_board and parent is null and not del) then
    raise exception '댓글을 달 글이 없습니다';
  end if;
  if (select count(*) from om_bbs where room = p_room) >= 5000 then raise exception '게시판이 가득 찼습니다 (5000줄) — GM 이 오래된 글을 정리해 주세요'; end if;
  insert into om_bbs(room, board, parent, w, who, anon, body, img)
    values (p_room, p_board, p_parent, me, p_who, coalesce(p_anon, false), coalesce(p_body, ''), coalesce(p_img, ''))
    returning id into nid;
  return nid;
end $$;

-- 지우기: GM 또는 쓴 사람
create or replace function public.om_bbs_del(p_room text, p_secret text, p_id bigint)
returns boolean language plpgsql security definer set search_path = public as $$
declare me text;
begin
  me := om_who(p_room, p_secret);
  if me is null then raise exception '권한이 없습니다'; end if;
  update om_bbs set del = true, ver = nextval('public.om_bbs_ver') where room = p_room and id = p_id and not del and (me = 'gm' or w = me);
  if not found then raise exception 'GM 이나 쓴 사람만 지울 수 있습니다'; end if;
  return true;
end $$;

-- 좋아요 켜고 끄기 (자리마다 한 번)
create or replace function public.om_bbs_like(p_room text, p_secret text, p_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare me text; l jsonb;
begin
  me := om_who(p_room, p_secret);
  if me is null then raise exception '방에 앉은 사람만 누를 수 있습니다'; end if;
  select likes into l from om_bbs where room = p_room and id = p_id and not del for update;
  if not found then raise exception '그 글이 없습니다'; end if;
  if l ? me then l := l - me; else l := l || to_jsonb(me); end if;
  update om_bbs set likes = l, ver = nextval('public.om_bbs_ver') where room = p_room and id = p_id;
  return l;
end $$;

grant execute on function public.om_bbs_boards(text,text) to anon, authenticated;
grant execute on function public.om_bbs_board_put(text,text,text,text,text,boolean,int,boolean) to anon, authenticated;
grant execute on function public.om_bbs_feed(text,text,bigint) to anon, authenticated;
grant execute on function public.om_bbs_post(text,text,text,bigint,jsonb,boolean,text,text) to anon, authenticated;
grant execute on function public.om_bbs_del(text,text,bigint) to anon, authenticated;
grant execute on function public.om_bbs_like(text,text,bigint) to anon, authenticated;

-- 되돌리기: drop function om_bbs_boards(text,text), om_bbs_board_put(text,text,text,text,text,boolean,int,boolean), om_bbs_feed(text,text,bigint), om_bbs_post(text,text,text,bigint,jsonb,boolean,text,text), om_bbs_del(text,text,bigint), om_bbs_like(text,text,bigint); drop table om_bbs; drop table om_bbs_board; drop sequence om_bbs_ver;
