# Triplogue

## 1. 서비스 소개

한 문장 설명:
Triplogue는 여행 사진의 촬영 시간과 위치 정보를 읽어 날짜별, 장소별로 자동 정리하고 Sweetbook 포토북 생성 및 주문까지 연결하는 웹앱입니다.

타겟 고객:

- 여행 사진은 많이 찍지만 정리와 포토북 편집에 시간을 쓰기 어려운 사용자
- 여행을 기념 포토북으로 빠르게 남기고 싶은 사용자
- 사진 편집보다 자동 정리와 결과물 완주를 우선하는 사용자

주요 기능:

- 여행 제목과 기간 설정
- 사진 업로드 및 EXIF 촬영 시간/GPS 읽기
- 날짜별, 장소별 자동 그룹핑
- 날짜/위치 수동 보정 및 다중 선택 편집
- 포토북 프리셋 3종 미리보기
- Sweetbook 테스트 책 생성 및 주문 요청
- 웹훅 설정, 테스트 전송, delivery/receipt 확인

## 2. 실행 방법

```bash
# 설치
npm install

# 환경변수 설정
cp .env.example .env

# .env 파일에 API Key 입력
# SWEETBOOK_API_KEY=
# SWEETBOOK_ENV=sandbox
# SWEETBOOK_WEBHOOK_SECRET=

# 실행
npm run dev
```

브라우저:

- [http://localhost:3000](http://localhost:3000)

production 확인:

```bash
npm run build
npx next start -H 0.0.0.0 -p 3000
```

빠른 데모 경로:

1. 홈에서 샘플 여행 초안을 불러옵니다.
2. 검토 단계에서 날짜/위치 보정을 확인합니다.
3. 포토북 프리셋을 바꿔봅니다.
4. 테스트 책 생성과 주문 흐름을 확인합니다.
5. 웹훅 운영 화면에서 delivery/receipt를 확인합니다.

## 3. 사용한 API 목록

| API                                     | 용도                                         |
| --------------------------------------- | -------------------------------------------- |
| `POST /v1/books`                        | 새 포토북 draft 생성                         |
| `POST /v1/books/{bookUid}/photos`       | 업로드한 사진을 Sweetbook 서버 파일로 업로드 |
| `POST /v1/books/{bookUid}/cover`        | 표지 생성                                    |
| `POST /v1/books/{bookUid}/contents`     | 챕터 divider, 본문, publish 페이지 생성      |
| `POST /v1/books/{bookUid}/finalization` | 책 최종화                                    |
| `GET /v1/book-specs`                    | 판형의 최소/최대/증분 페이지 규칙 조회       |
| `POST /v1/orders`                       | 주문 생성                                    |
| `GET /v1/webhooks/config`               | 웹훅 설정 조회                               |
| `PUT /v1/webhooks/config`               | 웹훅 URL 및 이벤트 등록                      |
| `DELETE /v1/webhooks/config`            | 웹훅 설정 삭제                               |
| `POST /v1/webhooks/test`                | 테스트 이벤트 전송                           |
| `GET /v1/webhooks/deliveries`           | 최근 delivery 이력 조회                      |

## 4. AI 도구 사용 내역

| AI 도구              | 활용 내용                                                  |
| -------------------- | ---------------------------------------------------------- |
| Codex                | 전체 구현, API 연동, 업로드/검토/주문 흐름 수정, 문서 작성 |
| Claude / Sonnet 계열 | 모바일 업로드 문제 원인 검토, 이벤트 구조 점검             |
| Google Stitch        | step 기반 모바일 UI 레이아웃 레퍼런스 생성                 |

## 5. 설계 의도

왜 이 서비스를 선택했는지:
여행 포토북은 과제 요구사항인 `사진 업로드 -> 책 생성 -> 주문` 흐름을 가장 자연스럽게 보여줄 수 있는 주제라고 판단했습니다. 특히 Sweetbook Books API와 Orders API를 실제 사용자 서비스처럼 연결하기에 적합했습니다.

설계 방향:

- 브라우저 위치 추적보다 사진 EXIF 기반 자동 정리에 집중
- MVP 기준으로 과한 자유 편집기보다 빠른 완주가 가능한 검토형 편집 UX 선택

이 서비스의 비즈니스 가능성:

- 여행 사진 정리 피로를 줄여주는 명확한 문제 해결이 있습니다.
- 포토북은 개인 기록, 가족 앨범, 선물 수요가 꾸준합니다.
- 향후 여행사/사진 백업 서비스와의 제휴, 공동 편집, 여행 요약 기능으로 확장할 수 있습니다.

더 시간이 있었다면 추가했을 기능:

- 페이지 단위 재배치, 캡션 편집, 커버 편집이 가능한 포토북 에디터
- 고객 맞춤형으로 더 세밀하게 제어할 수 있는 Sweetbook API 래핑 및 preset 시스템
- Gemini 기반 여행 요약 문구, 챕터 카피, 표지 문구 자동 생성
