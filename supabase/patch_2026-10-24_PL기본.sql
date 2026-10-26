-- ⚠ (2026-10-26) 상태 나누기 뒤에 이 파일을 다시 돌렸다면, 곧바로 supabase/patch_2026-10-26_상태나누기.sql 도 다시 돌릴 것 (옛 함수 · 트리거가 돌아와 저장이 어긋난다)
-- 2026-10-24 망령: 계정으로 로그인해서 방에 들어오면 기본으로 그 방 PL 권한을 준다 (자리는 비어 있음)
-- 관리자 계정은 건드리지 않는다 (PL 줄이 생기면 GM 이 아니게 되므로). 이미 GM · PL 이면 그대로.
create or replace function public.om_room_join(p_token text, p_room text)
returns text language plpgsql security definer set search_path = public as $$
declare u text; r text;
begin
  u := om_uid(p_token);
  if u is null then return null; end if;
  if not exists (select 1 from om_rooms where id = p_room) then return null; end if;
  if exists (select 1 from om_users where uid = u and admin) and not exists (select 1 from om_members where room = p_room and uid = u) then return 'gm'; end if;
  insert into om_members(room, uid, role, seat) values (p_room, u, 'pl', '') on conflict (room, uid) do nothing;
  select role into r from om_members where room = p_room and uid = u;
  return r;
end $$;
grant execute on function public.om_room_join(text,text) to anon, authenticated;
