-- ⚠ (2026-10-26) 상태 나누기 뒤에 이 파일을 다시 돌렸다면, 곧바로 supabase/patch_2026-10-26_상태나누기.sql 도 다시 돌릴 것 (옛 함수 · 트리거가 돌아와 저장이 어긋난다)
-- 2026-10-24 망령: 로비 「내 방」에서 방 지우기. Supabase 대시보드 → SQL Editor 에 붙여 넣고 Run. 여러 번 실행해도 된다.
-- 그 방의 GM(계정 GM · 관리자 · 예전 GM 링크)만 지울 수 있다. 방 상태 · 로그 · 지시 · 좌석 · 멤버는 같이 지워진다 (on delete cascade).
-- 이름 바꾸기는 원래 있던 om_room_update 를 쓰므로 SQL 이 필요 없다.
-- 방에 올린 그림(Storage oremas/rooms/<방 id>/)은 남는다 — 지우려면 Storage 화면에서 그 폴더를 지운다.
create or replace function public.om_room_del(p_room text, p_secret text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if om_who(p_room, p_secret) is distinct from 'gm' then raise exception 'GM 만 지울 수 있습니다'; end if;
  delete from om_rooms where id = p_room;
  return true;
end $$;
grant execute on function public.om_room_del(text,text) to anon, authenticated;
