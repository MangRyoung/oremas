-- 2026-11-06 감우 「배틀 딜레이 ②」: 저장(om_put · om_jset_many) 가볍게
--
-- 왜: 배틀 칸 하나를 쓸 때마다 om_put 이
--     ① 나머지 상태(rp · 트레이너 시트 …) 위에 배틀 조각 전체를 얹은 사본(cur)을 새로 만들고 — 권한 검사를 하지 않는 GM 쓰기에서도,
--     ② 배틀 조각 전체를 고쳐 새로 쓰고(큰 jsonb 를 압축해 TOAST 로 다시 씀),
--     ③ 버전 올리기 · 신호 적기 · 보내기를 했다.
--   om_jset_many(여러 칸 한 번에)는 칸마다 om_put 을 불러서, 열 칸이면 배틀 조각을 열 번 새로 썼다.
-- 어떻게:
--   · 빠른 길(om_put_fast): 상자째 쓰기(전체 · roster · roster.mons)가 없고, 방 설정 검사(GM 「불간섭」 · 좌석 「자기 것만」)가 필요 없을 때.
--     권한 검사는 예전과 같은 기본 검사만(좌석일 때), 칸들은 메모리에서 차례로 고친 뒤
--     배틀 조각 · 바뀐 포켓몬 조각 · 나머지를 「한 번씩만」 쓴다. 버전은 칸마다 하나씩 올라가고 신호도 칸마다 예전 모양 그대로 보낸다.
--   · 그 밖(상자째 · 방 설정 검사)은 예전 om_put 그대로 (om_put_slow 로 이름만 옮김).
--   화면 쪽은 바꿀 것 없음 (같은 함수 이름 · 같은 인자 · 같은 신호).
-- 실행: Supabase → SQL Editor 에 이 파일 전체를 붙여 넣고 Run. 여러 번 돌려도 된다. 데이터는 건드리지 않는다.
--   (patch_2026-10-26_상태나누기.sql · 10-28_이어받기 · 11-03_배틀 뒤에. 그 파일들을 다시 돌렸다면 이 파일도 다시)
-- 되돌리기: 맨 아래 주석.

-- ---------- 예전 om_put 을 om_put_slow 로 (몸통은 10-26 그대로) ----------
create or replace function public.om_put_slow(p_room text, p_secret text, p_path text[], p_value jsonb)
returns bigint language plpgsql security definer set search_path = public as $$
declare w text; nv bigint; rest jsonb; cur jsonb; seats text[]; oldv jsonb; newv jsonb; nfull jsonb; sub text[];
  plen int := coalesce(array_length(p_path, 1), 0);
  pk text; box boolean;
begin
  w := om_who(p_room, p_secret);
  if w is null then raise exception '권한이 없습니다'; end if;
  perform 1 from om_state s where s.room = p_room for update;
  select s.data into rest from om_state s where s.room = p_room;
  if rest is null then raise exception '그런 방이 없습니다'; end if;
  if rest ? 'battle' or jsonb_typeof(rest #> '{roster,mons}') = 'object' then
    perform public.om_split(p_room);
    select s.data into rest from om_state s where s.room = p_room;
  end if;
  newv := case when p_value is null or jsonb_typeof(p_value) = 'null' then null else p_value end;
  box := plen = 0 or (p_path[1] = 'roster' and (plen = 1 or (plen = 2 and p_path[2] = 'mons')));
  pk := case when box then null
             when p_path[1] = 'battle' then 'battle'
             when p_path[1] = 'roster' and p_path[2] = 'mons' then 'm:' || p_path[3] end;
  if box then cur := public.om_full(p_room);
  else
    cur := rest;
    if pk = 'battle' then cur := cur || coalesce((select jsonb_build_object('battle', p.data) from om_part p where p.room = p_room and p.k = 'battle'), '{}'::jsonb); end if;
    if pk like 'm:%' then cur := cur || jsonb_build_object('roster', coalesce(rest->'roster', '{}'::jsonb) || jsonb_build_object('mons',
                            coalesce((select jsonb_build_object(p_path[3], p.data) from om_part p where p.room = p_room and p.k = pk), '{}'::jsonb))); end if;
  end if;
  oldv := case when plen = 0 then cur else cur #> p_path end;
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
    if plen < 1 then raise exception '좌석은 전체를 바꿀 수 없습니다'; end if;
    if plen < 2 and p_path[1] not in ('battle','ready') then raise exception '좌석은 전체를 바꿀 수 없습니다'; end if;
    if ((p_path[1] = 'seats' and p_path[2] = w) or (p_path[1] = 'ready') or (p_path[1] = 'pub' and public.om_own(cur, w, p_path[2]))
            or (p_path[1] = 'battle')
            or (p_path[1] = 'roster' and p_path[2] = 'trainers' and p_path[3] = w)
            or (p_path[1] = 'skill' and p_path[2] in ('trainers','res','hist'))
            or (p_path[1] = 'dex' and p_path[2] = w)
            or (p_path[1] = 'rp' and p_path[2] in ('bgm','recentBgm') and coalesce(cur #>> '{rp,plBattle}','') <> 'false' and coalesce(cur #>> '{rp,seatOwn}','') <> 'true')
            or (p_path[1] = 'roster' and p_path[2] = 'mons' and plen >= 3
                and coalesce(cur #>> array['roster','mons',p_path[3],'tid'], p_value->>'tid') = w)) is not true then
      raise exception '이 좌석이 바꿀 수 없는 곳입니다: %', array_to_string(p_path, '/');
    end if;
  end if;
  if box then
    nfull := case when plen = 0 then coalesce(newv, '{}'::jsonb) when newv is null then cur #- p_path else public.om_jset(cur, p_path, newv) end;
    delete from om_part where room = p_room and (k like 'm:%' or (plen = 0 and k = 'battle'));
    if plen = 0 and nfull ? 'battle' then insert into om_part(room, k, data) values (p_room, 'battle', nfull->'battle'); end if;
    if jsonb_typeof(nfull #> '{roster,mons}') = 'object' then
      insert into om_part(room, k, data) select p_room, 'm:' || e.key, e.value from jsonb_each(nfull #> '{roster,mons}') e where jsonb_typeof(e.value) <> 'null';
    end if;
    perform set_config('om.quiet', '1', true);
    update om_state set data = case when plen = 0 then (case when jsonb_typeof(nfull #> '{roster,mons}') = 'object' then (nfull - 'battle') #- '{roster,mons}' else nfull - 'battle' end)
                                    else (rest - 'roster') || case when jsonb_typeof(nfull->'roster') = 'object' then jsonb_build_object('roster', case when jsonb_typeof(nfull #> '{roster,mons}') = 'object' then (nfull->'roster') - 'mons' else nfull->'roster' end) else '{}'::jsonb end end,
      v = v + 1, updated_at = now() where room = p_room returning v into nv;
    perform set_config('om.quiet', '', true);
    perform public.om_send(p_room, jsonb_build_object('v', nv, 'full', true));
  elsif pk is not null then
    sub := p_path[case when pk = 'battle' then 2 else 4 end : plen];
    if coalesce(array_length(sub, 1), 0) = 0 then
      if newv is null then delete from om_part where room = p_room and k = pk;
      else insert into om_part(room, k, data) values (p_room, pk, newv) on conflict (room, k) do update set data = excluded.data; end if;
    elsif newv is null then
      update om_part set data = data #- sub where room = p_room and k = pk and jsonb_typeof(data) in ('object','array');
    else
      insert into om_part(room, k, data) values (p_room, pk, public.om_jset('{}'::jsonb, sub, newv))
        on conflict (room, k) do update set data = public.om_jset(case when jsonb_typeof(om_part.data) = 'object' then om_part.data else '{}'::jsonb end, sub, newv);
    end if;
    perform set_config('om.quiet', '1', true);
    update om_state set v = v + 1, updated_at = now() where room = p_room returning v into nv;
    perform set_config('om.quiet', '', true);
    perform public.om_send(p_room, case
      when oldv is not distinct from newv then jsonb_build_object('v', nv, 'same', true)
      when newv is not null and octet_length(newv::text) > 100000 then jsonb_build_object('v', nv, 'full', true)
      else jsonb_build_object('v', nv, 'path', to_jsonb(p_path), 'value', newv) end);
  else
    if newv is null then
      update om_state set data = data #- p_path, v = v + 1, updated_at = now() where room = p_room returning v into nv;
    else
      update om_state set data = public.om_jset(data, p_path, newv), v = v + 1, updated_at = now() where room = p_room returning v into nv;
    end if;
  end if;
  return nv;
end $$;
revoke execute on function public.om_put_slow(text,text,text[],jsonb) from public, anon, authenticated;

-- ---------- 빠른 길 ----------
-- 이미 om_state 줄을 잠근 뒤에 부른다. 빠른 길로 못 하면 아무것도 쓰지 않고 null.
-- p_paths: 칸 경로들(text[] 를 jsonb 배열로), p_vals: 값들 (같은 순서)
create or replace function public.om_put_fast(p_room text, w text, p_patches jsonb)
returns bigint language plpgsql security definer set search_path = public as $$
declare rest jsonb; bat jsonb; bat_on boolean := false; bat_dirty boolean := false; rest_dirty boolean := false;
  mons jsonb := '{}'::jsonb;      -- 읽어 온 포켓몬 조각: id → data (조각이 없으면 json null)
  mdirty text[] := '{}'::text[];
  x jsonb; pth text[]; plen int; newv jsonb; oldv jsonb; sub text[]; pk text; mid text; md jsonb; mtid text;
  v0 bigint; nv bigint; i int := 0; msgs jsonb[] := '{}'::jsonb[]; m jsonb;
begin
  select s.data, s.v into rest, v0 from om_state s where s.room = p_room;
  if rest is null then raise exception '그런 방이 없습니다'; end if;
  -- 방 설정 검사가 필요한 쓰기는 예전 길로
  if w = 'gm' and rest #>> '{rp,gmHands}' = 'false' then return null; end if;
  if w <> 'gm' and rest #>> '{rp,seatOwn}' = 'true' then return null; end if;
  -- 상자째 쓰기가 하나라도 있으면 예전 길로 (먼저 다 훑는다 — 쓰기 전에)
  for x in select e.value from jsonb_array_elements(p_patches) e loop
    if jsonb_typeof(x->'path') <> 'array' then raise exception 'path 가 없습니다'; end if;
    plen := jsonb_array_length(x->'path');
    if plen = 0 then return null; end if;
    if x->'path'->>0 = 'roster' and (plen = 1 or (plen = 2 and x->'path'->>1 = 'mons')) then return null; end if;
  end loop;

  for x in select e.value from jsonb_array_elements(p_patches) with ordinality e(value, n) order by e.n loop
    select array_agg(t.value order by t.n) into pth from jsonb_array_elements_text(x->'path') with ordinality t(value, n);
    plen := array_length(pth, 1);
    newv := case when x->'value' is null or jsonb_typeof(x->'value') = 'null' then null else x->'value' end;
    pk := case when pth[1] = 'battle' then 'battle' when pth[1] = 'roster' and pth[2] = 'mons' then 'm' end;
    mid := case when pk = 'm' then pth[3] end;

    if pk = 'battle' and not bat_on then
      select p.data into bat from om_part p where p.room = p_room and p.k = 'battle';
      bat_on := true;
    end if;
    if pk = 'm' and not (mons ? mid) then
      select p.data into md from om_part p where p.room = p_room and p.k = 'm:' || mid;
      mons := mons || jsonb_build_object(mid, coalesce(md, 'null'::jsonb));
    end if;

    -- 좌석 기본 검사 (om_put 과 같다)
    if w <> 'gm' then
      if plen < 2 and pth[1] not in ('battle','ready') then raise exception '좌석은 전체를 바꿀 수 없습니다'; end if;
      mtid := case when pk = 'm' then mons -> mid ->> 'tid' end;
      if ((pth[1] = 'seats' and pth[2] = w) or (pth[1] = 'ready') or (pth[1] = 'pub' and public.om_own(rest, w, pth[2]))
              or (pth[1] = 'battle')
              or (pth[1] = 'roster' and pth[2] = 'trainers' and pth[3] = w)
              or (pth[1] = 'skill' and pth[2] in ('trainers','res','hist'))
              or (pth[1] = 'dex' and pth[2] = w)
              or (pth[1] = 'rp' and pth[2] in ('bgm','recentBgm') and coalesce(rest #>> '{rp,plBattle}','') <> 'false' and coalesce(rest #>> '{rp,seatOwn}','') <> 'true')
              or (pth[1] = 'roster' and pth[2] = 'mons' and plen >= 3 and coalesce(mtid, x->'value'->>'tid') = w)) is not true then
        raise exception '이 좌석이 바꿀 수 없는 곳입니다: %', array_to_string(pth, '/');
      end if;
    end if;

    -- 메모리에서 고치기
    if pk = 'battle' then
      sub := pth[2:plen];
      if coalesce(array_length(sub, 1), 0) = 0 then oldv := bat; bat := newv;
      else
        oldv := bat #> sub;
        if newv is null then
          if jsonb_typeof(bat) in ('object','array') then bat := bat #- sub; end if;
        else
          bat := public.om_jset(case when jsonb_typeof(bat) = 'object' then bat else '{}'::jsonb end, sub, newv);
        end if;
      end if;
      bat_dirty := true;
    elsif pk = 'm' then
      md := mons -> mid; if jsonb_typeof(md) = 'null' then md := null; end if;
      sub := pth[4:plen];
      if coalesce(array_length(sub, 1), 0) = 0 then oldv := md; md := newv;
      else
        oldv := md #> sub;
        if newv is null then
          if jsonb_typeof(md) in ('object','array') then md := md #- sub; end if;
        else
          md := public.om_jset(case when jsonb_typeof(md) = 'object' then md else '{}'::jsonb end, sub, newv);
        end if;
      end if;
      mons := mons || jsonb_build_object(mid, coalesce(md, 'null'::jsonb));
      if not (mid = any(mdirty)) then mdirty := mdirty || mid; end if;
    else
      oldv := rest #> pth;
      if newv is null then rest := rest #- pth; else rest := public.om_jset(rest, pth, newv); end if;
      rest_dirty := true;
    end if;

    i := i + 1;
    nv := v0 + i;
    msgs := msgs || case
      when oldv is not distinct from newv then jsonb_build_object('v', nv, 'same', true)
      when newv is not null and octet_length(newv::text) > 100000 then jsonb_build_object('v', nv, 'full', true)
      else jsonb_build_object('v', nv, 'path', to_jsonb(pth), 'value', newv) end;
  end loop;
  if i = 0 then return v0; end if;

  -- 조각마다 한 번씩만 쓴다
  if bat_dirty then
    if bat is null then delete from om_part where room = p_room and k = 'battle';
    else insert into om_part(room, k, data) values (p_room, 'battle', bat) on conflict (room, k) do update set data = excluded.data; end if;
  end if;
  foreach mid in array mdirty loop
    md := mons -> mid;
    if md is null or jsonb_typeof(md) = 'null' then delete from om_part where room = p_room and k = 'm:' || mid;
    else insert into om_part(room, k, data) values (p_room, 'm:' || mid, md) on conflict (room, k) do update set data = excluded.data; end if;
  end loop;
  perform set_config('om.quiet', '1', true);   -- 나머지를 바꿔도 트리거 신호는 끄고, 아래에서 칸마다 보낸다
  if rest_dirty then
    update om_state set data = rest, v = v0 + i, updated_at = now() where room = p_room;
  else
    update om_state set v = v0 + i, updated_at = now() where room = p_room;
  end if;
  perform set_config('om.quiet', '', true);
  foreach m in array msgs loop perform public.om_send(p_room, m); end loop;
  return v0 + i;
end $$;
revoke execute on function public.om_put_fast(text,text,jsonb) from public, anon, authenticated;

-- 잠그고 · 나누고 · 빠른 길을 해 본다. 못 하면 null (아무것도 안 씀)
create or replace function public.om_put_try(p_room text, w text, p_patches jsonb)
returns bigint language plpgsql security definer set search_path = public as $$
declare rest jsonb;
begin
  perform 1 from om_state s where s.room = p_room for update;
  select s.data into rest from om_state s where s.room = p_room;
  if rest is null then raise exception '그런 방이 없습니다'; end if;
  if rest ? 'battle' or jsonb_typeof(rest #> '{roster,mons}') = 'object' then perform public.om_split(p_room); end if;
  return public.om_put_fast(p_room, w, p_patches);
end $$;
revoke execute on function public.om_put_try(text,text,jsonb) from public, anon, authenticated;

-- ---------- 화면이 부르는 두 함수 (이름 · 인자 그대로) ----------
create or replace function public.om_put(p_room text, p_secret text, p_path text[], p_value jsonb)
returns bigint language plpgsql security definer set search_path = public as $$
declare w text; nv bigint;
begin
  w := om_who(p_room, p_secret);
  if w is null then raise exception '권한이 없습니다'; end if;
  if coalesce(array_length(p_path, 1), 0) > 0 then
    nv := public.om_put_try(p_room, w, jsonb_build_array(jsonb_build_object('path', to_jsonb(p_path), 'value', coalesce(p_value, 'null'::jsonb))));
    if nv is not null then return nv; end if;
  end if;
  return public.om_put_slow(p_room, p_secret, p_path, p_value);
end $$;

create or replace function public.om_jset_many(p_room text, p_secret text, p_patches jsonb)
returns bigint language plpgsql security definer set search_path = public as $$
declare x jsonb; nv bigint := 0; pth text[]; w text;
begin
  if p_patches is null or jsonb_typeof(p_patches) <> 'array' then raise exception 'patches 는 배열이어야 합니다'; end if;
  if jsonb_array_length(p_patches) > 400 then raise exception '한 번에 400칸까지'; end if;
  w := om_who(p_room, p_secret);
  if w is null then raise exception '권한이 없습니다'; end if;
  for x in select e.value from jsonb_array_elements(p_patches) e loop
    if jsonb_typeof(x->'path') <> 'array' or jsonb_array_length(x->'path') = 0 then raise exception '빈 path 는 쓸 수 없습니다'; end if;
  end loop;
  nv := public.om_put_try(p_room, w, p_patches);
  if nv is not null then return nv; end if;
  for x in select e.value from jsonb_array_elements(p_patches) with ordinality e(value, n) order by e.n loop   -- 예전 길: 칸마다
    select array_agg(t.value order by t.n) into pth from jsonb_array_elements_text(x->'path') with ordinality t(value, n);
    nv := public.om_put_slow(p_room, p_secret, pth, x->'value');
  end loop;
  return nv;
end $$;

grant execute on function public.om_put(text,text,text[],jsonb) to anon, authenticated;
grant execute on function public.om_jset_many(text,text,jsonb) to anon, authenticated;

-- ---------- 되돌리기 (필요할 때만) ----------
-- patch_2026-10-26_상태나누기.sql 의 om_put 과 patch_2026-11-03_배틀.sql 의 om_jset_many 를 다시 실행하면 예전 그대로.
-- (om_put_slow · om_put_fast · om_put_try 는 남아 있어도 아무도 부르지 않는다)
