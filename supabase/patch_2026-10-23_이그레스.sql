-- ⚠ (2026-10-26) 상태 나누기 뒤에 이 파일을 다시 돌렸다면, 곧바로 supabase/patch_2026-10-26_상태나누기.sql 도 다시 돌릴 것 (옛 함수 · 트리거가 돌아와 저장이 어긋난다)
-- 오레마스 이그레스 줄이기 (2026-10-23)
-- 방 상태(om_state)가 바뀔 때마다 상태 전체(옛 값 + 새 값)를 방의 모든 접속자에게 실시간으로 보내던 것을,
-- 바뀐 칸 하나(경로 · 값 · 버전)만 보내게 바꾼다. Supabase 무료 플랜의 이그레스(내보내는 데이터)를 크게 줄인다.
--   · om_state 를 실시간(postgres_changes) 목록에서 뺀다.
--   · om_state 가 바뀌면 트리거가 옛 값과 새 값을 비교해 바뀐 경로를 찾고, realtime.send 로 'om:<방>' 채널에 'st' 신호를 보낸다.
--   · 오레마스 화면(js/app.js · js/store.js)은 이 신호를 받아 그 칸만 고친다. 버전이 비면 그때만 상태 전체를 다시 읽는다.
-- 표와 데이터는 건드리지 않는다. 여러 번 실행해도 된다.
-- 실행한 뒤에는 방에 들어와 있는 사람 모두 오레마스를 새로 고쳐야(새 버전) 상태 변경을 받는다.
-- 되돌리기: 맨 아래 「되돌리기」 주석의 세 줄을 실행하면 예전 방식(상태 전체 실시간)으로 돌아간다.

do $$ begin
  if to_regprocedure('realtime.send(jsonb,text,text,boolean)') is null then
    raise exception 'realtime.send 함수가 없다 — Supabase 대시보드에서 Realtime 이 켜져 있는지 확인하고 다시 실행해 줘';
  end if;
end $$;

-- 옛 값 a 와 새 값 b 에서 바뀐 곳을 모두 덮는 가장 깊은 경로. 바뀐 게 없으면 null, 맨 위에서 여러 칸이 바뀌었으면 빈 배열.
-- 객체만 따라 내려간다 (배열은 통째로 하나의 칸으로 본다).
create or replace function public.om_jdiff_path(a jsonb, b jsonb)
returns text[] language plpgsql immutable as $$
declare path text[] := '{}'; k text; hit text; n int;
begin
  if a is not distinct from b then return null; end if;
  loop
    if a is null or b is null or jsonb_typeof(a) <> 'object' or jsonb_typeof(b) <> 'object' then return path; end if;
    n := 0; hit := null;
    for k in select jsonb_object_keys(a) union select jsonb_object_keys(b) loop
      if (a -> k) is distinct from (b -> k) then n := n + 1; hit := k; exit when n > 1; end if;
    end loop;
    if n = 0 then return path; end if;
    if n > 1 then return path; end if;
    path := path || hit; a := a -> hit; b := b -> hit;
  end loop;
end $$;

create or replace function public.om_state_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare p text[]; val jsonb; msg jsonb;
begin
  p := public.om_jdiff_path(old.data, new.data);
  if p is null then
    msg := jsonb_build_object('v', new.v, 'same', true);                    -- 버전만 올랐다
  elsif coalesce(array_length(p, 1), 0) = 0 then
    msg := jsonb_build_object('v', new.v, 'full', true);                    -- 여러 칸이 한꺼번에: 전체를 다시 읽게
  else
    val := new.data #> p;
    if val is not null and octet_length(val::text) > 100000 then
      msg := jsonb_build_object('v', new.v, 'full', true);                  -- 너무 크면 신호 대신 다시 읽게
    else
      msg := jsonb_build_object('v', new.v, 'path', to_jsonb(p), 'value', val);   -- value 가 null 이면 그 칸을 지운다
    end if;
  end if;
  begin
    perform realtime.send(msg, 'st', 'om:' || new.room, false);
  exception when others then
    raise warning 'om_state_notify: %', sqlerrm;   -- 신호를 못 보내도 저장은 막지 않는다 (화면이 30초마다 버전을 확인한다)
  end;
  return null;
end $$;

drop trigger if exists om_state_notify on public.om_state;
create trigger om_state_notify after update on public.om_state
  for each row when (old.v is distinct from new.v or old.data is distinct from new.data)
  execute function public.om_state_notify();

do $$ begin
  if exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'om_state') then
    alter publication supabase_realtime drop table public.om_state;
  end if;
end $$;
alter table public.om_state replica identity default;

-- 되돌리기 (예전 방식으로):
--   drop trigger if exists om_state_notify on public.om_state;
--   alter table public.om_state replica identity full;
--   alter publication supabase_realtime add table public.om_state;
