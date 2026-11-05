# S.B.S 도서 조회 및 공통 모임 기록

공개 API: https://sbs-book-info-api.vercel.app/api

- book-info?url=도서상세주소: 알라딘/교보문고/YES24 공개 메타데이터 조회. 누락 정보를 추정하지 않습니다.
- studies GET: 모든 방문자가 보는 확정 도서/모임/담당 기록. Vercel private Blob에서 읽어 공개 JSON으로 제공합니다.
- studies POST: 편집 암호를 Authorization Bearer로 확인한 뒤 확정 저장. 비밀번호 원문은 서버/브라우저 저장소에 저장하지 않고 서버 환경 변수에는 SHA-256만 둡니다.

## 기록 흐름

입력 중인 초안은 기기의 브라우저에 저장합니다. 모임 정보를 마무리 저장하면 공통 기록에 공개하고 해당 record의 전체 정리로 이동합니다. 기존 기록을 고치면 책별 version을 확인하며, 다른 책 기록이나 최신 대표를 삭제/교체하지 않습니다. 새 책은 새 기록과 latestId로 확정되어 메인 가운데 책 및 대표 카드에 반영됩니다. 같은 도서를 새 폼에서 다시 등록하면 기존 편집 링크를 안내합니다.

POST는 record version과 Blob ETag 조건부 쓰기를 함께 검사합니다. 충돌한 초안은 버리지 않으며 최신 기록으로 전환할 때 현재 입력과 저장된 원본 초안을 각각 백업합니다. POST 대기 중 입력한 초안도 삭제하지 않습니다. 저장소 응답 손상/ETag 누락은 실패로 처리합니다.

## 운영

Node 22 이상. npm ci, npm test. 이 폴더에서 vercel deploy --prod --scope pikker.
프로젝트: pikker/sbs-book-info-api (Hobby). 공통 저장 객체: sbs-study-library-v1.json.
처음 한 번 운영자 권한의 .env.local을 준비하고 node init-library.mjs로 기본 기록을 생성합니다. 이미 있는 객체는 덮어쓰지 않습니다.
환경 변수: BLOB_READ_WRITE_TOKEN, STUDY_EDITOR_HASH. .env*, .vercel/, node_modules/는 Git에 포함하지 않습니다. 편집 암호는 별도 관리합니다.

## 검증 (2026-11-05)

Node 테스트 19개 통과. URL/SSRF 및 메타데이터 추출, 모델 복원/기록 불변성, 동일 도서 판정/판본 분리, 기록 충돌/빈 저장/용량 제한 포함.
별도 QA Blob: 비인증 거부, 중복 등록 거부, 과거 편집 최신 대표 보존, 구버전 거부를 실제 HTTP로 확인했습니다.
브라우저: 새 책 확정 → 책장 중앙 및 대표 카드 동시 교체, 별도 origin의 저장소가 비어있는 방문자도 같은 결과, 이전 책 선택 → 기존 모임 정리/독서 가이드 보존 확인.
독립 검수: 탭 간 버전 충돌, 원격 변경 보존, 초안 백업, 최종 번들 단일 읽기 분기 승인.
기본 침묵의 세계 일정: 2026년 11월 5일 오후 7시.

참고: https://vercel.com/docs/vercel-blob/using-blob-sdk 및 https://vercel.com/docs/vercel-blob/usage-and-pricing
