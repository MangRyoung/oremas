-- 2026-11-07 망령 「미사그 2 에서 학교 게시판 연결이 안 돼 있다」
-- 따라가는 방(미사그 캠퍼스 2 처럼 「DB · 설정 따라가기」를 켠 방)은 게시판을 따로 두지 않고 주 방의 게시판을 함께 쓴다.
--   om_bbs_share(room → main): 따라가는 방의 GM 이 정한다 (웹툴이 따라가기를 맞출 때 저절로 부른다).
--   신분 확인은 지금 방(p_room)으로 하고, 글 · 게시판 · 좋아요는 주 방 줄을 쓴다. 디스코드는 주 방 연동으로 나간다.
--   글쓴 자리(w)는 지금 방의 자리 id 그대로 남는다.
-- 앞서 patch_2026-11-02_게시판.sql 을 돌려 둔 뒤에 돌린다. 여러 번 돌려도 된다. 데이터를 지우지 않는다 (캠퍼스 2 에 따로 쓴 글은 그대로 남고, 따라가기를 끄면 다시 보인다).

create table if not exists public.om_bbs_share (
  room text primary key references public.om_rooms(id) on delete cascade,
  main text not null references public.om_rooms(id) on delete cascade,
  at   timestamptz not null default now()
);
alter table public.om_bbs_share enable row level security;   -- 정책 없음: 함수로만

create or replace function public.om_bbs_main(p_room text) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select s.main from om_bbs_share s where s.room = p_room and s.main <> p_room), p_room)
$$;
revoke execute on function public.om_bbs_main(text) from public, anon, authenticated;

-- 따라가기 켜기(p_from = 주 방) · 끄기(p_from = '')
create or replace function public.om_bbs_share_set(p_room text, p_secret text, p_from text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me text;
begin
  me := om_who(p_room, p_secret);
  if me is distinct from 'gm' then raise exception '이 방의 GM 만 바꿀 수 있습니다'; end if;
  if coalesce(p_from, '') = '' or p_from = p_room then
    delete from om_bbs_share where room = p_room;
    return jsonb_build_object('ok', true, 'main', p_room);
  end if;
  if not exists (select 1 from om_rooms where id = p_from) then raise exception '주 방이 없습니다'; end if;
  if om_who(p_from, p_secret) is null then raise exception '주 방에 들어갈 수 있는 신분이 아닙니다 (계정으로 들어와 주세요)'; end if;
  if exists (select 1 from om_bbs_share where room = p_from) then raise exception '주 방도 다른 방을 따라가고 있습니다'; end if;
  insert into om_bbs_share(room, main) values (p_room, p_from)
    on conflict (room) do update set main = excluded.main, at = now() where om_bbs_share.main is distinct from excluded.main;
  return jsonb_build_object('ok', true, 'main', p_from);
end $$;
grant execute on function public.om_bbs_share_set(text, text, text) to anon, authenticated;

-- 게시판 목록. 숨긴 판은 GM 에게만
create or replace function public.om_bbs_boards(p_room text, p_secret text)
returns table(id text, name text, descr text, w text, ord int, hidden boolean, at timestamptz)
language plpgsql volatile security definer set search_path = public as $$
declare who text;
begin
  who := om_who(p_room, coalesce(p_secret, ''));
  p_room := om_bbs_main(p_room);   -- 11-07 따라가는 방은 주 방의 게시판
  return query select b.id, b.name, b.descr, b.w, b.ord, b.hidden, b.at from om_bbs_board b
    where b.room = p_room and (not b.hidden or who = 'gm') order by b.ord, b.at;
end $$;

-- 게시판 만들기 · 고치기 · 지우기 (p_del)
create or replace function public.om_bbs_board_put(p_room text, p_secret text, p_id text, p_name text, p_descr text, p_hidden boolean, p_ord int, p_del boolean)
returns boolean language plpgsql security definer set search_path = public as $$
declare who text; old record;
begin
  who := om_who(p_room, p_secret);
  p_room := om_bbs_main(p_room);   -- 11-07 따라가는 방은 주 방의 게시판
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
  p_room := om_bbs_main(p_room);   -- 11-07 따라가는 방은 주 방의 게시판
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
  p_room := om_bbs_main(p_room);   -- 11-07 따라가는 방은 주 방의 게시판
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
  p_room := om_bbs_main(p_room);   -- 11-07 따라가는 방은 주 방의 게시판
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
  p_room := om_bbs_main(p_room);   -- 11-07 따라가는 방은 주 방의 게시판
  if me is null then raise exception '방에 앉은 사람만 누를 수 있습니다'; end if;
  select likes into l from om_bbs where room = p_room and id = p_id and not del for update;
  if not found then raise exception '그 글이 없습니다'; end if;
  if l ? me then l := l - me; else l := l || to_jsonb(me); end if;
  update om_bbs set likes = l, ver = nextval('public.om_bbs_ver') where room = p_room and id = p_id;
  return l;
end $$;

-- (grant 는 11-02 패치 그대로)
-- 되돌리기: patch_2026-11-02_게시판.sql 을 다시 돌리고 drop function om_bbs_share_set(text,text,text), om_bbs_main(text); drop table om_bbs_share;
