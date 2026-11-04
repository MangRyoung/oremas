-- 2026-11-04 망령 「PL 이 파티 여러 개 쓰기」: 좌석 X 가 웹툴 「추가 파티로 함께 불러오기」로 올린 트레이너는 id 가 X~2 · X~3 … 이다.
-- 그 트레이너도 X 좌석 것으로 친다 — 숨긴 지시 읽기 · 저장(om_secret_put/get), 「자기 것만」 방의 준비 · 공개 · 배틀 트레이너 칸.
-- 함수 om_own 하나만 다시 만든다. 표 · 데이터는 건드리지 않는다. 여러 번 실행해도 된다. supabase/schema.sql 에도 같은 내용.
create or replace function public.om_own(d jsonb, w text, x text)
returns boolean language sql immutable as $$
  select x is not null and w is not null and (
    x = w
    or left(x, length(w) + 1) = w || '~'
    or coalesce(jsonb_typeof(d #> array['roster','trainers',x,'co']) = 'array' and (d #> array['roster','trainers',x,'co']) ? w, false))
$$;
