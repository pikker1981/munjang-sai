# S.B.S 도서 링크 조회 API

기존 GitHub Pages 화면에서 사용하는 공개 도서 메타데이터 조회기입니다.

- 배포: https://sbs-book-info-api.vercel.app/api/book-info?url=도서상세URL
- Vercel CLI 계정: sdd5393-9478, 팀: pikker (Hobby)
- 지원: 알라딘 shop/wproduct.aspx?ItemId, YES24 Product/Goods 및 모바일 Goods/Detail, 교보 product.kyobobook.co.kr/detail/S…
- 제공: 표지, 제목, 저자·역자, 출판사, 발행일, 쪽수, ISBN, 공개 메타데이터의 짧은 소개. 누락값은 추정하지 않습니다. 유료 AI/API 키는 사용하지 않습니다.
- 제한: 서점 차단·구조 변경 시 실패할 수 있습니다. 검색/단축 URL은 받지 않습니다. 서점 원문 링크를 표시합니다.
- 방어: 도메인/경로 허용 목록, 이동 대상 재검증, 18초 제한, 4MB 응답 제한, 간단한 인스턴스별 요청 제한, 명시적 CORS, 외부 HTML 실행 없이 텍스트 추출.
- 저장: 브라우저의 sbs-next-study-v1에 책 링크·정보·수정 소개를 저장합니다. 기존 개인별 담당 데이터는 필드별로 병합합니다. 서버에는 모임/개인 발제를 보내지 않습니다.

## 실행 및 배포

Node 22 이상. npm ci 후 npm test.
배포는 이 폴더에서 vercel deploy --prod --scope pikker.
.env*, .vercel/, node_modules/는 Git에 포함하지 않습니다.

## 검증 (2026-11-05)

Node 테스트 5개 통과: URL/SSRF 방어, JSON-LD/메타데이터, 이동 대상 방어, 비도서 차단, 중첩 그래프 회귀.
세 서점의 침묵의 세계 링크에서 실제 API 응답 200, 제목·저자·278쪽 확인.
브라우저: 자동 조회, 제목 채움, 수정 소개 저장/복원, 지원하지 않는 URL 오류, 모바일 가로 넘침 없음.
독립 검수: 같은 책 재조회·비운 소개 유지·두 탭의 발제/소개 보존·책 교체 후 오래된 편집 차단 통과.

참고: https://vercel.com/docs/functions/runtimes/node-js 및 https://ui.shadcn.com/docs/components/base/card 의 정보 계층을 참고하되, UI는 기존 SUIT/마루부리와 종이색 토큰으로 직접 작성했습니다.
