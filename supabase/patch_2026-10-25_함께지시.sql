-- 2026-10-25 망령: 함께 지시하기 — 여러 플레이어가 한 트레이너의 지시 창 · 조작권을 같이 쓴다.
-- 트레이너 시트 주인(이나 GM)이 배틀 화면 「함께 지시」로 좌석을 고르면 roster.trainers.<트레이너>.co 에 적히고,
-- 그 좌석은 그 트레이너의 숨긴 지시를 읽고 · 저장하고, 준비 · 공개 · 그 포켓몬 조작도 제 것처럼 한다 (「자기 것만」 방 설정에서도).
-- 함수 다섯 개(om_own 새로 · om_chk · om_set_state · om_secret_put · om_secret_get)만 다시 만든다. 표와 데이터는 건드리지 않는다. 여러 번 실행해도 된다.
-- supabase/schema.sql 에도 같은 내용이 들어 있다.

-- 2026-10-25 함께 지시하기: x 트레이너를 w 좌석이 다룰 수 있나 — 제 자리이거나, 그 트레이너 시트(roster.trainers.x.co)에 w 가 적혀 있으면.
-- co 는 시트 주인(과 GM)만 쓸 수 있는 칸이라, 남의 트레이너에 저를 끼워 넣을 수 없다.
create or replace function public.om_own(d jsonb, w text, x text)
returns boolean language sql immutable as $$
  select x is not null and w is not null and (x = w or coalesce(jsonb_typeof(d #> array['roster','trainers',x,'co']) = 'array' and (d #> array['roster','trainers',x,'co']) ? w, false))
$$;

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
      if len = 1 then recurse := true; elsif p_path[1] in ('pub','ready') then return public.om_own(d, w, p_path[2]); else return p_path[2] = w; end if;   -- 준비 · 공개 칸은 함께 지시하는 좌석도
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
      elsif p_path[2] in ('trainers','cmds') then return public.om_own(d, w, p_path[3]);
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
          if public.om_own(d, w, owner) and (n is null or jsonb_typeof(n) = 'null' or n->>'tid' = owner) then return true; end if;
          if jsonb_typeof(o) = 'object' and jsonb_typeof(n) = 'object' then recurse := true; else return false; end if;
        else
          owner := d #>> array['battle','mons',p_path[3],'tid'];
          if public.om_own(d, w, owner) then return true; end if;
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
    if ((p_path[1] = 'seats' and p_path[2] = w) or (p_path[1] = 'ready') or (p_path[1] = 'pub' and public.om_own(cur, w, p_path[2]))   -- ready: 지시 완료 표시 (턴이 넘어갈 때 비운다)
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

create or replace function public.om_secret_put(p_room text, p_secret text, p_kind text, p_id text, p_data jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
declare w text;
begin
  w := om_who(p_room, p_secret);
  if w is null then raise exception '권한이 없습니다'; end if;
  if w <> 'gm' and not (p_kind = 'cmd' and public.om_own((select s.data from om_state s where s.room = p_room), w, p_id)) then raise exception '이 좌석이 쓸 수 없는 곳입니다'; end if;   -- 함께 지시하는 트레이너의 지시도
  if w = 'gm' and p_kind = 'cmd'
     and (select s.data #>> '{rp,gmHands}' from om_state s where s.room = p_room) = 'false'
     and exists (select 1 from om_auth a where a.room = p_room and a.role = 'seat' and a.seat = p_id) then
    raise exception '이 방은 GM 도 플레이어의 지시를 바꿀 수 없다 (방 설정)';
  end if;
  insert into om_secret(room, kind, id, data) values (p_room, p_kind, p_id, coalesce(p_data,'{}'::jsonb))
    on conflict (room, kind, id) do update set data = excluded.data, updated_at = now();
  return true;
end $$;

create or replace function public.om_secret_get(p_room text, p_secret text, p_kind text)
returns setof om_secret language plpgsql security definer set search_path = public as $$
declare w text;
begin
  w := om_who(p_room, p_secret);
  if w is null then return; end if;
  if w = 'gm' then return query select * from om_secret s where s.room = p_room and s.kind = p_kind order by s.id;
  else return query select * from om_secret s where s.room = p_room and s.kind = p_kind
         and (s.id = w or (p_kind in ('cmd','peek') and public.om_own((select st.data from om_state st where st.room = p_room), w, s.id))) order by s.id; end if;
end $$;

revoke execute on function public.om_own(jsonb,text,text) from anon, authenticated;
grant execute on function public.om_secret_put(text,text,text,text,jsonb) to anon, authenticated;
grant execute on function public.om_secret_get(text,text,text) to anon, authenticated;
grant execute on function public.om_set_state(text,text,text[],jsonb) to anon, authenticated;
