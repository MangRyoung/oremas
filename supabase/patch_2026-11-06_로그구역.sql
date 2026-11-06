-- 오레마스 패치 2026-11-06 — 로그 구역별 지우기 (망령 「씬 · 배틀 구역별 비우기」)
-- om_log_clear_range(방, GM 비밀값, 시작 id, 끝 id, 문자 남기기): 그 사이 로그 줄만 지운다. GM 만. 여러 번 실행해도 된다.
-- 되돌리기: drop function public.om_log_clear_range(text,text,bigint,bigint,boolean);
create or replace function public.om_log_clear_range(p_room text, p_secret text, p_from bigint, p_to bigint, p_keep_sms boolean)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if om_who(p_room, p_secret) is distinct from 'gm' then raise exception 'GM 만 로그를 지울 수 있습니다'; end if;
  if p_from is null or p_to is null or p_to < p_from then raise exception '구역이 맞지 않습니다'; end if;
  delete from om_log where room = p_room and id between p_from and p_to
    and not (coalesce(p_keep_sms,true) and kind = 'chat' and data ? 'sms');
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.om_log_clear_range(text,text,bigint,bigint,boolean) from public;
grant execute on function public.om_log_clear_range(text,text,bigint,bigint,boolean) to anon, authenticated;
