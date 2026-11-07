-- 11-07 망령 「미사그 캠퍼스 2 디코 연동도 미사그 캠퍼스 따라가게 해」
-- 따라가는 방(rp.follow · 세션 노트 여러 방)의 GM 이 주 방의 디스코드 연동(웹후크 · 스레드 · 게시판 고르기 · 전당 웹후크)을 그대로 받아 온다.
-- 웹툴은 「DB · 설정 따라가기」를 맞출 때(GM 화면) 저절로 부른다. 두 방 모두에 들어갈 수 있는 신분(계정 'u:…')이어야 한다.
-- 웹후크 주소는 서버 안에서만 옮긴다 (화면에는 안 나온다). 주 방에 연동이 없으면 아무것도 안 바꾼다.
create or replace function public.om_bbs_hook_follow(p_room text, p_secret text, p_from text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me text; pf text; h record;
begin
  me := om_who(p_room, p_secret);
  if me is distinct from 'gm' then raise exception '이 방의 GM 만 바꿀 수 있습니다'; end if;
  if coalesce(p_from, '') = '' or p_from = p_room then raise exception '주 방이 없습니다'; end if;
  pf := om_who(p_from, p_secret);
  if pf is null then raise exception '주 방에 들어갈 수 있는 신분이 아닙니다 (계정으로 들어와 주세요)'; end if;
  select * into h from om_bbs_hook where room = p_from;
  if not found or coalesce(h.url, '') = '' then return jsonb_build_object('ok', false, 'why', 'none'); end if;
  insert into om_bbs_hook(room, url, thread, tname, boards, cm, "on", cthread, hurl, hthread, at)
    values (p_room, h.url, h.thread, h.tname, h.boards, h.cm, h."on", h.cthread, h.hurl, h.hthread, now())
  on conflict (room) do update set url = excluded.url, thread = excluded.thread, tname = excluded.tname, boards = excluded.boards,
    cm = excluded.cm, "on" = excluded."on", cthread = excluded.cthread, hurl = excluded.hurl, hthread = excluded.hthread, at = now()
  where (om_bbs_hook.url, om_bbs_hook.thread, om_bbs_hook.tname, om_bbs_hook.boards, om_bbs_hook.cm, om_bbs_hook."on", om_bbs_hook.cthread, om_bbs_hook.hurl, om_bbs_hook.hthread)
    is distinct from (excluded.url, excluded.thread, excluded.tname, excluded.boards, excluded.cm, excluded."on", excluded.cthread, excluded.hurl, excluded.hthread);
  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.om_bbs_hook_follow(text, text, text) to anon, authenticated;
