/* 공유 DB 설정. 제작기(mangketmon-maker)와 같은 Supabase 프로젝트를 쓴다.
   공개 키(anon / sb_publishable_…)는 공개해도 되는 키다. 실제 권한은 supabase/schema.sql 의 정책과 함수가 정한다. */
window.OM_CONFIG={
  supabaseUrl:"https://jsnvqcvwspxzfnhdethl.supabase.co",
  supabaseKey:"sb_publishable_HDcgWnb1QS1P6GOiBPqdAA_yBJNhU7R",
  makerTable:"docs",   /* 제작기 시트 테이블 (읽기만) */
  organizerUrl:"https://mangryoung.github.io/maptool-log/"   /* 맵툴 로그 정리기 — 「💾 로그 → 정리기에서 열기」 */
};
