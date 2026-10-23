-- 2026-10-25 망령: 플레이어 BGM — 방 설정 「① 플레이어도 배틀 진행」이 켜져 있으면 플레이어(좌석)도 BGM 을 틀고 · 바꾸고 · 멈춘다.
-- 함수 하나(om_set_state)만 다시 만든다. 표와 데이터는 건드리지 않는다. 여러 번 실행해도 된다. supabase/schema.sql 에도 같은 내용이 들어 있다.
-- 「자기 것만」 방이나 「플레이어도 배틀 진행」을 끈 방에서는 지금처럼 GM 만 BGM 을 바꾼다.

create or replace function public.om_set_state(p_room text, p_secret text, p_path text[], p_value jsonb)
returns bigint language plpgsql security definer set search_path = public as $$
declare w text; nv bigint; cur jsonb; seats text[]; oldv jsonb; newv jsonb;
begin
  w := om_who(p_room, p_secret);
  if w is null then raise exception '권한이 없습니다'; end if;
  select s.data into cur from om_state s where s.room = p_room;
  cur := coalesce(cur, '{}'::jsonb);
  oldv := case when p_path is null or array_length(p_path,1) is null then cur else cur #> p_path end;
  newv := case when p_value is null or jsonb_typeof(p_value) = 'null' then null else p_value end;
  if w = 'gm' and cur #>> '{rp,gmHands}' = 'false' then
    select array_agg(a.seat) into seats from om_auth a where a.room = p_room and a.role = 'seat';
    if public.om_chk('fair', w, coalesce(p_path, '{}'::text[]), oldv, newv, cur, coalesce(seats, '{}'::text[])) is not true then
      raise exception '이 방은 GM 도 플레이어의 지시·준비를 바꿀 수 없다 (방 설정): %', array_to_string(p_path, '/');
    end if;
  end if;
  if w <> 'gm' and cur #>> '{rp,seatOwn}' = 'true' then
    if public.om_chk('seat', w, coalesce(p_path, '{}'::text[]), oldv, newv, cur, '{}'::text[]) is not true then
      raise exception '이 방은 자기 것만 바꿀 수 있다 (방 설정): %', array_to_string(p_path, '/');
    end if;
  end if;
  if w <> 'gm' then
    if p_path is null or array_length(p_path,1) < 1 then raise exception '좌석은 전체를 바꿀 수 없습니다'; end if;
    if array_length(p_path,1) < 2 and p_path[1] not in ('battle','ready') then raise exception '좌석은 전체를 바꿀 수 없습니다'; end if;
    if ((p_path[1] = 'seats' and p_path[2] = w) or (p_path[1] = 'ready') or (p_path[1] = 'pub' and public.om_own(cur, w, p_path[2]))   -- ready: 지시 완료 표시 (턴이 넘어갈 때 비운다)
            or (p_path[1] = 'battle')   -- 배틀 전체: 포켓몬 HP·랭크·상태, 필드, 지시 공개, 턴·페이즈, 파티 불러오기 … 플레이어끼리 모의전을 할 수 있게 (신뢰 기반, 맵툴과 같음)
            or (p_path[1] = 'roster' and p_path[2] = 'trainers' and p_path[3] = w)   -- 내 시트
            or (p_path[1] = 'skill' and p_path[2] in ('trainers','res','hist'))        -- 스킬 체크 자원·결과 (지침·돌봄·커버는 남의 칸도 건드린다 · 신뢰 기반)
            or (p_path[1] = 'dex' and p_path[2] = w)                                    -- 내 도감
            or (p_path[1] = 'rp' and p_path[2] in ('bgm','recentBgm') and coalesce(cur #>> '{rp,plBattle}','') <> 'false' and coalesce(cur #>> '{rp,seatOwn}','') <> 'true')   -- (2026-10-25) 플레이어도 배틀 진행이면 BGM 도
            or (p_path[1] = 'roster' and p_path[2] = 'mons' and array_length(p_path,1) >= 3
                and (coalesce((select s.data#>>array['roster','mons',p_path[3],'tid'] from om_state s where s.room = p_room), p_value->>'tid') = w))) is not true then  -- 내 포켓몬 · (2026-10-20) is not true: 경로가 짧아 NULL 이 나와도 통과시키지 않는다
      raise exception '이 좌석이 바꿀 수 없는 곳입니다: %', array_to_string(p_path, '/');
    end if;
  end if;
  if p_path is null or array_length(p_path,1) is null then
    update om_state set data = coalesce(p_value,'{}'::jsonb), v = v + 1 where room = p_room returning v into nv;
  elsif p_value is null or jsonb_typeof(p_value) = 'null' then
    update om_state set data = data #- p_path, v = v + 1 where room = p_room returning v into nv;
  else
    update om_state set data = public.om_jset(data, p_path, p_value), v = v + 1 where room = p_room returning v into nv;
  end if;
  return nv;
end $$;
