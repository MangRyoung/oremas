-- 2026-11-17 감우: 배틀 저장 · 이어서 하기 「읽지 못했다: cannot execute UPDATE in a read-only transaction」 (시노비 제보 11-16 21:5x)
-- Supabase 대시보드 → SQL Editor 에 이 파일 전체를 붙여 넣고 Run. 여러 번 실행해도 된다. 데이터는 지우지 않는다.
--
-- 까닭: 지금 DB 의 om_snap_list · om_snap_get 이 stable 로 들어가 있다(11-17 03시 실제 방에서 om_snap_list 호출로 재현).
--   stable 함수는 PostgREST 가 읽기 전용 트랜잭션으로 부르는데, 안에서 부르는 om_who → om_uid 가
--   로그인 표를 10분 넘게 안 쓴 뒤 처음 부를 때 om_sess.last_at 을 update 한다 → 그때만 실패(가끔 되고 가끔 안 되는 까닭).
--   11-03 판 파일은 volatile 로 고쳐 두었지만 DB 에는 옛 판이 남아 있는 것으로 보인다. 이번엔 volatile 을 글자로 적어 둔다.
-- 같은 꼴의 om_my_seats(11-08, stable)도 volatile 로.

create or replace function public.om_snap_list(p_room text, p_secret text, p_kind text)
returns table(id text, kind text, name text, turn int, w text, at timestamptz, bytes int)
language plpgsql volatile security definer set search_path = public as $$
begin
  if om_who(p_room, p_secret) is null then raise exception '방에 앉은 사람만 볼 수 있습니다'; end if;
  return query select s.id, s.kind, s.name, s.turn, s.w, s.at, octet_length(s.data::text) from om_snap s
    where s.room = p_room and (p_kind is null or s.kind = p_kind) order by s.at desc limit 100;
end $$;

-- 하나 전부
create or replace function public.om_snap_get(p_room text, p_secret text, p_id text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare r record;
begin
  if om_who(p_room, p_secret) is null then raise exception '방에 앉은 사람만 볼 수 있습니다'; end if;
  select * into r from om_snap where room = p_room and id = p_id;
  if not found then return null; end if;
  return jsonb_build_object('id', r.id, 'kind', r.kind, 'name', r.name, 'turn', r.turn, 'w', r.w, 'at', r.at, 'data', r.data);
end $$;


create or replace function public.om_my_seats(p_room text, p_secret text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare u text; mem record;
begin
  if left(coalesce(p_secret,''), 2) <> 'u:' then return null; end if;
  u := om_uid(substr(p_secret, 3));
  if u is null then return null; end if;
  select role, seat, seats into mem from om_members where room = p_room and uid = u;
  if not found or mem.role <> 'pl' then return jsonb_build_object('seat', '', 'seats', '[]'::jsonb); end if;
  return jsonb_build_object('seat', mem.seat, 'seats', to_jsonb(om_uniq(mem.seats || array[mem.seat])));
end $$;

grant execute on function public.om_snap_list(text, text, text) to anon, authenticated;
grant execute on function public.om_snap_get(text, text, text) to anon, authenticated;
