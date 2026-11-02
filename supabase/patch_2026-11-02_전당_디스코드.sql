-- 2026-11-02 밤 망령: 「전당도 디코로 보내기 버튼」 — 전당 한 판의 요약 그림을 디스코드로
--
-- patch_2026-11-02_게시판_디스코드.sql 다음에 실행한다. 여러 번 실행해도 된다. 데이터를 지우지 않는다.
--
-- 보내는 곳: 「전당 웹후크」(비면 게시판 웹후크) + 「전당 스레드」(비면 그 웹후크의 채널 본문)
--   · 전당 채널이 게시판과 다른 채널이면 그 채널의 웹후크를 따로 넣는다 (웹후크는 자기 채널 · 그 안의 스레드에만 보낼 수 있다)
--   · 결과 확인은 om_dc_card_result 를 같이 쓴다 (마지막 카드 요청 번호 creq)

alter table public.om_bbs_hook add column if not exists hurl text not null default '';
alter table public.om_bbs_hook add column if not exists hthread text not null default '';

-- GM: 전당 설정 보기 (주소는 끝 4자만)
create or replace function public.om_dc_hall_get(p_room text, p_secret text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare h record;
begin
  if om_who(p_room, p_secret) is distinct from 'gm' then raise exception 'GM 만 볼 수 있습니다'; end if;
  select * into h from om_bbs_hook where room = p_room;
  if not found then return jsonb_build_object('hset', false, 'main', false, 'hthread', ''); end if;
  return jsonb_build_object('hset', h.hurl <> '', 'htail', right(h.hurl, 4), 'hthread', h.hthread, 'main', h.url <> '' and h."on");
end $$;

-- GM: 전당 설정 바꾸기. p_url 이 null 이면 주소는 그대로, '' 이면 지운다(게시판 웹후크로)
create or replace function public.om_dc_hall_put(p_room text, p_secret text, p_url text, p_thread text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u text; t text;
begin
  if om_who(p_room, p_secret) is distinct from 'gm' then raise exception 'GM 만 바꿀 수 있습니다'; end if;
  u := btrim(coalesce(p_url, ''));
  if p_url is not null and u <> '' and u !~ '^https://((ptb|canary)\.)?discord(app)?\.com/api(/v\d+)?/webhooks/\d+/[A-Za-z0-9_-]+/?$' then
    raise exception '디스코드 웹후크 주소가 아닙니다 (https://discord.com/api/webhooks/… )';
  end if;
  t := coalesce(substring(btrim(coalesce(p_thread, '')) from '(\d{15,25})/?$'), '');
  insert into om_bbs_hook(room, hurl, hthread) values (p_room, case when p_url is null then '' else u end, t)
  on conflict (room) do update set hurl = case when p_url is null then om_bbs_hook.hurl else u end, hthread = t, at = now();
  return om_dc_hall_get(p_room, p_secret);
end $$;

-- 방에 앉은 사람(GM · 좌석)이 전당 요약 그림(이 프로젝트 저장소 oremas 에 올린 것)을 보낸다. 방마다 8초에 한 장
create or replace function public.om_dc_hall(p_room text, p_secret text, p_title text, p_sub text, p_img text, p_who jsonb) returns bigint
language plpgsql security definer set search_path = public as $$
declare me text; h record; u text; nm text; av text; j jsonb; rid bigint;
begin
  me := om_who(p_room, p_secret);
  if me is null then raise exception '방에 앉은 사람만 보낼 수 있습니다'; end if;
  select * into h from om_bbs_hook where room = p_room;
  if not found then raise exception '디스코드 연동이 아직 없습니다 — GM 이 설정 「디스코드」 탭에서 이어 주세요'; end if;
  u := coalesce(nullif(h.hurl, ''), case when h."on" then h.url else '' end);
  if u = '' then raise exception '디스코드 연동이 아직 없습니다 — GM 이 설정 「디스코드」 탭에서 이어 주세요'; end if;
  if coalesce(p_img, '') !~ '^https://jsnvqcvwspxzfnhdethl\.supabase\.co/storage/v1/object/public/oremas/' or length(p_img) > 1000 then raise exception '잘못된 그림 주소'; end if;
  if h.cat is not null and h.cat > now() - interval '8 seconds' then raise exception '조금 뒤에 다시 보내 주세요'; end if;
  nm := coalesce(nullif(btrim(p_who->>'n'), ''), '전당'); av := coalesce(p_who->>'img', '');
  if av !~ '^https?://' or length(av) > 1000 then av := ''; end if;
  j := jsonb_build_object('username', om_bbs_dc_name(nm), 'allowed_mentions', jsonb_build_object('parse', '[]'::jsonb),
    'content', '-# 🏆 전당' || E'\n' || '**' || left(coalesce(p_title, ''), 100) || '**' || case when coalesce(p_sub, '') <> '' then ' · ' || left(p_sub, 140) else '' end,
    'embeds', jsonb_build_array(jsonb_build_object('image', jsonb_build_object('url', p_img))));
  if av <> '' then j := j || jsonb_build_object('avatar_url', av); end if;
  rid := net.http_post(url := u, body := j,
    params := case when h.hthread <> '' then jsonb_build_object('thread_id', h.hthread, 'wait', 'true') else jsonb_build_object('wait', 'true') end,
    timeout_milliseconds := 8000);
  update om_bbs_hook set creq = rid, cat = now() where room = p_room;
  return rid;
end $$;

grant execute on function public.om_dc_hall_get(text, text) to anon, authenticated;
grant execute on function public.om_dc_hall_put(text, text, text, text) to anon, authenticated;
grant execute on function public.om_dc_hall(text, text, text, text, text, jsonb) to anon, authenticated;
