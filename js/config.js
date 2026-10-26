/* 공유 DB 설정. 제작기(mangketmon-maker)와 같은 Supabase 프로젝트를 쓴다.
   공개 키(anon / sb_publishable_…)는 공개해도 되는 키다. 실제 권한은 supabase/schema.sql 의 정책과 함수가 정한다. */
window.OM_CONFIG={
  supabaseUrl:"https://jsnvqcvwspxzfnhdethl.supabase.co",
  supabaseKey:"sb_publishable_HDcgWnb1QS1P6GOiBPqdAA_yBJNhU7R",
  makerTable:"docs",   /* 제작기 시트 테이블 (읽기만) */
  notesUrl:"https://mangryoung.github.io/mangketmon-notes/",   /* 세션 노트 (지도 · 관계도 가져오기) */
  organizerUrl:"https://mangryoung.github.io/mangketmon-maker/?tab=log"   /* 제작기 「로그 정리기」 탭 — 「💾 로그 → 제작기 정리기로」 (10-25: 따로 있던 maptool-log 대신) */
};
