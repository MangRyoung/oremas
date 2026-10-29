-- 2026-10-29 망령: 「방을 만들지 못했다: relation "om_config" does not exist」 고치기
-- 까닭: 10-22 「방기본값」 패치가 DB 에 안 들어갔는데, 10-25 「방복제」 패치의 om_room_new 가 om_config 표를 읽는다.
-- 이 파일은 10-22 패치 중 표 · 읽기/쓰기 함수만 넣는다. om_create_room · om_room_new 는 건드리지 않는다
-- (10-22 판 om_create_room 을 다시 넣으면 10-26 상태 나누기와 어긋날 수 있어서).
-- Supabase 대시보드 → SQL Editor 에 붙여 넣고 Run. 여러 번 실행해도 된다.
create table if not exists public.om_config (
  k           text primary key,
  v           jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);
alter table public.om_config enable row level security;   -- 정책 없음: 아래 함수로만 읽고 쓴다

create or replace function public.om_config_get(p_token text, p_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not om_is_admin(p_token) then raise exception '관리자만'; end if;
  return (select v from om_config where k = p_key);
end $$;

create or replace function public.om_config_set(p_token text, p_key text, p_v jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not om_is_admin(p_token) then raise exception '관리자만'; end if;
  if p_v is null then delete from om_config where k = p_key; return true; end if;
  insert into om_config(k, v, updated_at) values (p_key, p_v, now()) on conflict (k) do update set v = excluded.v, updated_at = now();
  return true;
end $$;

grant execute on function public.om_config_get(text,text) to anon, authenticated;
grant execute on function public.om_config_set(text,text,jsonb) to anon, authenticated;
notify pgrst, 'reload schema';
