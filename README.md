# 문장 사이

북 스터디 랜딩 페이지와 『침묵의 세계』 독서 가이드입니다.

## 공개용 구성
- 일반 글씨: SUIT, 기존 명조 영역: 마루부리, 큰 제목: 마루부리 SemiBold.
- 중앙서체는 개인용 배포 조건으로 공개 저장소에 포함하지 않습니다.
- 사용자가 제공한 일곱 장 정리와 영상 정리문 발췌·해설·질문을 구분합니다.
- 각 폰트·Three.js의 출처와 사용 조건은 assets 폴더에 있습니다. 도서 표지는 알라딘 출처를 페이지에 표시합니다.
- 독서 노트·밑줄·신청 체험은 사용하는 브라우저에만 저장됩니다. 기기 간 동기화나 실제 예약·결제는 제공하지 않습니다.

## GitHub Pages
main 브랜치 루트를 게시 소스로 사용합니다. index.html이 시작 페이지이며 silence.html에서 독서 자료를 볼 수 있습니다.

홈의 책장에서는 『침묵의 세계』 책등을 고르면 실제 표지가 앞으로 나와 독서 가이드로 연결됩니다. 다른 네 권은 다음 책을 위한 장식이며 선택되지 않습니다. 키보드 Enter로 열고 이동 전 Escape로 취소할 수 있습니다. 모션 줄이기 또는 애니메이션 미지원 환경에서는 일반 링크로 바로 이동합니다. 뒤로 돌아오면 책장과 스크롤 위치를 복원하며, 이를 위해 세션 저장소에 위치 정보만 잠시 보관합니다. 책장 구성은 `assets/bookshelf.css`와 `assets/bookshelf.mjs`에 분리되어 있습니다.

## 내용 재생성
Node.js로 다음을 실행합니다. 이미 번들된 JS와 폰트가 포함되어 있어 배포 중 별도 설치는 필요하지 않습니다.

```sh
node build-chapters.mjs
node package.mjs
```

기존 장별 자료: assets/silence-seven-chapters.md
추가 자료: assets/silence-video-summary.md
장별 발췌와 편집: assets/silence-video-supplements.json
