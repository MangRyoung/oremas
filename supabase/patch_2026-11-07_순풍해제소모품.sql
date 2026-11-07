-- 2026-11-07 순풍 해제 소모품 「윈드브레이커」 (웨더클리너와 같은 꼴)
-- Supabase 대시보드 → SQL Editor 에 붙여 넣고 Run. 제작기 소지품 DB 에 오리지널 행으로 들어가요 (웨더클리너 바로 아래).
-- 웹툴은 「제작기 새로고침」 뒤에 보여요. 자동화(구문 「순풍 해제」)는 oremas · 제작기 itemrule.js / items.js 커밋이 올라가야 동작해요.
insert into public.docs (kind, id, data)
values ('dbedit', 'items.ec9c88eb939cebb88ceba088ec9db4ecbba4', '{"kind": "items", "key": "윈드브레이커", "row": ["배틀 전용", "윈드브레이커", "-", "O", "필드 위에 불고 있는 「순풍」을 전부 해제한다.", "1", "-", "소모품\n순풍 해제"], "custom": true, "pos": 83}'::jsonb)
on conflict (kind, id) do update set data = excluded.data;

-- 확인
select id, data->>'key' as 이름, data->'row'->>4 as 효과 from public.docs where kind='dbedit' and id='items.ec9c88eb939cebb88ceba088ec9db4ecbba4';
