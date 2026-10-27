-- 10-28 망령: 수파베이스 무료 한도(이그레스 5GB) 초과 — 「놓친 신호만 이어받기」
-- 지금까지는 휴대폰을 껐다 켜거나 신호를 하나라도 놓치면 화면이 상태 전체(큰 방은 약 560KB)를 다시 읽었다.
-- 이제 서버가 최근 신호(버전마다 바뀐 칸)를 방마다 300개까지 적어 두고, 화면은 놓친 버전들만 받아 이어 붙인다.
-- 방에 들어올 때도 이 브라우저에 저장해 둔 마지막 상태가 있으면, 그 뒤 신호만 받아 이어 붙인다 (없으면 전체).
-- 적어 둔 것이 모자라거나(너무 오래 비웠다), 「전체」 신호가 끼어 있거나, 합쳐서 400KB 를 넘으면 예전처럼 전체를 읽는다.
-- 실행: Supabase → SQL Editor 에 이 파일 전체를 붙여 넣고 Run. 여러 번 돌려도 된다. (patch_2026-10-26_상태나누기.sql 뒤에)
-- 되돌리기: 맨 아래 주석. 화면은 om_patches 함수가 없으면 저절로 예전처럼 전체를 읽는다.

create table if not exists public.om_patch (
  room text not null,
  v bigint not null,
  msg jsonb not null,
  primary key (room, v)
);
alter table public.om_patch enable row level security;   -- 정책 없음 = 표를 직접은 아무도 못 읽는다 (아래 함수로만)
revoke all on public.om_patch from anon, authenticated;

-- 신호 하나 적기 + 오래된 것 지우기 (방마다 최근 300개)
create or replace function public.om_patch_add(p_room text, msg jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare nv bigint := (msg->>'v')::bigint;
begin
  if nv is null then return; end if;
  insert into om_patch(room, v, msg) values (p_room, nv, msg) on conflict (room, v) do update set msg = excluded.msg;
  delete from om_patch where room = p_room and v <= nv - 300;
exception when others then
  raise warning 'om_patch_add: %', sqlerrm;   -- 적지 못해도 저장은 막지 않는다 (화면은 전체를 읽으면 된다)
end $$;

-- om_put 이 보내는 신호
create or replace function public.om_send(p_room text, msg jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.om_patch_add(p_room, msg);   -- 보내기가 실패해도 적은 것은 남긴다
  begin
    perform realtime.send(msg, 'st', 'om:' || p_room, false);
  exception when others then
    raise warning 'om_send: %', sqlerrm;   -- 신호를 못 보내도 저장은 막지 않는다 (화면이 30초마다 버전을 확인한다)
  end;
end $$;

-- 나머지(om_state) 를 바꿀 때 트리거가 보내는 신호 (10-23 이그레스 그대로 + 적어 두기)
create or replace function public.om_state_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare p text[]; val jsonb; msg jsonb;
begin
  p := public.om_jdiff_path(old.data, new.data);
  if p is null then
    msg := jsonb_build_object('v', new.v, 'same', true);
  elsif coalesce(array_length(p, 1), 0) = 0 then
    msg := jsonb_build_object('v', new.v, 'full', true);
  else
    val := new.data #> p;
    if val is not null and octet_length(val::text) > 100000 then
      msg := jsonb_build_object('v', new.v, 'full', true);
    else
      msg := jsonb_build_object('v', new.v, 'path', to_jsonb(p), 'value', val);
    end if;
  end if;
  perform public.om_patch_add(new.room, msg);
  begin
    perform realtime.send(msg, 'st', 'om:' || new.room, false);
  exception when others then
    raise warning 'om_state_notify: %', sqlerrm;
  end;
  return null;
end $$;

-- 화면이 부른다: p_after 다음 버전부터 지금까지의 신호 (버전 순서). 이어 붙일 수 없으면 null → 전체를 읽는다
create or replace function public.om_patches(p_room text, p_after bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare cur bigint; n bigint; sz bigint; anyfull boolean; out jsonb;
begin
  select v into cur from om_state where room = p_room;
  if cur is null then return null; end if;
  if cur = p_after then return '[]'::jsonb; end if;
  if cur < p_after then return null; end if;   -- 화면이 서버보다 앞선다(방을 되돌렸다 등) → 전체를 읽는다
  if cur - p_after > 300 then return null; end if;
  select count(*), coalesce(sum(octet_length(msg::text)), 0), coalesce(bool_or(msg ? 'full'), false), jsonb_agg(msg order by v)
    into n, sz, anyfull, out
    from om_patch where room = p_room and v > p_after and v <= cur;
  if n <> cur - p_after or anyfull or sz > 400000 then return null; end if;
  return out;
end $$;

revoke execute on function public.om_patch_add(text,jsonb) from public, anon, authenticated;
revoke execute on function public.om_send(text,jsonb) from public, anon, authenticated;
grant execute on function public.om_patches(text,bigint) to anon, authenticated;

-- 확인: 방마다 적어 둔 신호 수 · 크기
-- select room, count(*), pg_size_pretty(sum(pg_column_size(msg))) from om_patch group by room;

-- ---------- 되돌리기 (필요할 때만) ----------
-- drop function if exists public.om_patches(text,bigint);   -- 화면은 저절로 예전처럼 전체를 읽는다
-- 그다음 patch_2026-10-26_상태나누기.sql 의 om_send 와 patch_2026-10-23_이그레스.sql 의 om_state_notify 를 다시 실행, drop table public.om_patch;
