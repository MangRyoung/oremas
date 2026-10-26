-- ⚠ (2026-10-26) 상태 나누기 뒤에 이 파일을 다시 돌렸다면, 곧바로 supabase/patch_2026-10-26_상태나누기.sql 도 다시 돌릴 것 (옛 함수 · 트리거가 돌아와 저장이 어긋난다)
-- 오레마스 권한 수정 (2026-10-20 반디) — Supabase 대시보드 → SQL Editor 에 이 파일 전체를 붙여 넣고 Run.
-- 내용: 좌석 쓰기 권한 검사가 NULL(경로가 짧을 때 등)을 「통과」로 처리하던 구멍을 막는다.
--   예) 좌석이 ['roster','trainers'] 를 통째로 {} 로 써서 모든 트레이너 시트를 지울 수 있었다.
-- 함수 세 개(om_jset · om_chk · om_set_state)만 다시 만든다. 표와 데이터는 건드리지 않는다. 여러 번 실행해도 된다.
-- supabase/schema.sql 에도 같은 내용이 들어 있다.

create or replace function public.om_jset(p_data jsonb, p_path text[], p_value jsonb)
returns jsonb language plpgsql immutable as $$
declare d jsonb := coalesce(p_data, '{}'::jsonb); i int; sub text[];
begin
  for i in 1 .. array_length(p_path,1) - 1 loop
    sub := p_path[1:i];
    if jsonb_typeof(d #> sub) is distinct from 'object' then d := jsonb_set(d, sub, '{}'::jsonb, true); end if;
  end loop;
  return jsonb_set(d, p_path, p_value, true);
end $$;

create or replace function public.om_chk(p_mode text, w text, p_path text[], o jsonb, n jsonb, d jsonb, seats text[])
returns boolean language plpgsql stable as $$
declare len int := coalesce(array_length(p_path,1),0); k text; owner text; recurse boolean := false;
begin
  if o is not distinct from n then return true; end if;
  if p_mode = 'fair' then
    -- GM: 좌석 주인의 지시·준비·공개 칸은 비우기만
    if len = 0 or (len = 1 and p_path[1] in ('battle','ready','pub')) or (len = 2 and p_path[1] = 'battle' and p_path[2] = 'cmds') then recurse := true;
    elsif (p_path[1] = 'battle' and p_path[2] = 'cmds' and len >= 3 and p_path[3] = any(seats))
       or (p_path[1] in ('ready','pub') and len >= 2 and p_path[2] = any(seats)) then
      return n is null or jsonb_typeof(n) = 'null';
    else return true; end if;
  else
    -- 좌석: 자기 것만
    if len = 0 then recurse := true;
    elsif p_path[1] in ('seats','pub','dex','ready') then
      if len = 1 then recurse := true; else return p_path[2] = w; end if;
    elsif p_path[1] = 'roster' then
      if len = 1 or (len = 2 and p_path[2] in ('trainers','mons')) then recurse := true;
      elsif p_path[2] = 'trainers' then return p_path[3] = w;
      elsif p_path[2] = 'mons' then
        if len = 3 then return (o is null or jsonb_typeof(o) = 'null' or o->>'tid' = w) and (n is null or jsonb_typeof(n) = 'null' or n->>'tid' = w); end if;
        return d #>> array['roster','mons',p_path[3],'tid'] = w;
      else return false; end if;
    elsif p_path[1] = 'skill' then
      if len = 1 or (len = 2 and p_path[2] in ('trainers','res')) then recurse := true;
      elsif p_path[2] in ('trainers','res') then return p_path[3] = w;
      elsif p_path[2] = 'hist' and len = 2 then
        -- 기록은 덧붙이기만 (끝의 한 줄 말고는 원래 있던 줄이어야 한다)
        if coalesce(jsonb_typeof(n),'') <> 'array' then return false; end if;
        return coalesce((select bool_and(coalesce(o,'[]'::jsonb) @> jsonb_build_array(e)) from jsonb_array_elements(n) with ordinality as x(e, i) where i < jsonb_array_length(n)), true);
      else return false; end if;
    elsif p_path[1] = 'battle' then
      if len = 1 or (len = 2 and p_path[2] in ('trainers','cmds','mons','sides')) then recurse := true;
      elsif p_path[2] in ('trainers','cmds') then return p_path[3] = w;
      elsif p_path[2] = 'sides' then
        -- 진영 목록: 나를 넣거나 빼는 것만
        if len = 3 or (len = 4 and p_path[4] = 'trainers') then
          if len = 3 then recurse := true;
          else
            return not exists (
              select 1 from (select jsonb_array_elements_text(coalesce(o,'[]'::jsonb)) e except select jsonb_array_elements_text(coalesce(n,'[]'::jsonb))
                             union select jsonb_array_elements_text(coalesce(n,'[]'::jsonb)) except select jsonb_array_elements_text(coalesce(o,'[]'::jsonb))) x where x.e <> w);
          end if;
        else return false; end if;
      elsif p_path[2] = 'mons' then
        if len = 3 then
          owner := coalesce(o->>'tid', n->>'tid');
          if owner = w and (n is null or jsonb_typeof(n) = 'null' or n->>'tid' = w) then return true; end if;
          if jsonb_typeof(o) = 'object' and jsonb_typeof(n) = 'object' then recurse := true; else return false; end if;
        else
          owner := d #>> array['battle','mons',p_path[3],'tid'];
          if owner = w then return true; end if;
          return p_path[4] in ('lastHit','pend','fx');   -- 남의 포켓몬: 공격 판정 넘기기 · 맞을 때 소모되는 효과만
        end if;
      else return false; end if;
    else return false; end if;
  end if;
  if not recurse then return true; end if;
  if (o is not null and jsonb_typeof(o) not in ('object','null')) or (n is not null and jsonb_typeof(n) not in ('object','null')) then
    return false;   -- 상자 자리에 상자 아닌 값은 거절
  end if;
  for k in select jsonb_object_keys(coalesce(o,'{}'::jsonb)) union select jsonb_object_keys(case when jsonb_typeof(n) = 'object' then n else '{}'::jsonb end) loop
    if public.om_chk(p_mode, w, p_path || k, case when jsonb_typeof(o) = 'object' then o->k end, case when jsonb_typeof(n) = 'object' then n->k end, d, seats) is not true then return false; end if;   -- NULL(판단 못 함)도 거절
  end loop;
  return true;
end $$;

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
    if ((p_path[1] = 'seats' and p_path[2] = w) or (p_path[1] = 'ready') or (p_path[1] = 'pub' and p_path[2] = w)   -- ready: 지시 완료 표시 (턴이 넘어갈 때 비운다)
            or (p_path[1] = 'battle')   -- 배틀 전체: 포켓몬 HP·랭크·상태, 필드, 지시 공개, 턴·페이즈, 파티 불러오기 … 플레이어끼리 모의전을 할 수 있게 (신뢰 기반, 맵툴과 같음)
            or (p_path[1] = 'roster' and p_path[2] = 'trainers' and p_path[3] = w)   -- 내 시트
            or (p_path[1] = 'skill' and p_path[2] in ('trainers','res','hist'))        -- 스킬 체크 자원·결과 (지침·돌봄·커버는 남의 칸도 건드린다 · 신뢰 기반)
            or (p_path[1] = 'dex' and p_path[2] = w)                                    -- 내 도감
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

grant execute on function public.om_set_state(text,text,text[],jsonb) to anon, authenticated;
