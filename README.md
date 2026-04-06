# Triplogue

Triplogue는 여행 사진을 업로드하면 촬영 시간과 위치 정보를 읽어 날짜별, 장소별로 자동 정리하고, 이를 Sweetbook 포토북 주문 흐름으로 연결하는 웹앱입니다.

핵심 경험은 아래와 같습니다.
- 여행 사진을 올립니다.
- 앱이 EXIF의 촬영 시간과 GPS 정보를 우선 읽습니다.
- 사진을 날짜별, 장소별 챕터를 자동 그룹핑합니다.
- 위치 정보가 없는 사진은 수동 태깅으로 보완합니다.
- 정리된 여행 기록을 포토북 초안과 주문 흐름으로 연결합니다.

## 현재 MVP 방향

이번 MVP는 아래 한 문장에 집중합니다.

`여행 사진첩을 최소한의 수정만으로 포토북 초안까지 빠르게 만드는 경험`

현재까지 잡아둔 큰 덩어리는 다음과 같습니다.
- 랜딩과 서비스 방향 제시
- 사진 업로드 및 인입 흐름
- 자동 그룹핑 검토 화면
- 포토북 미리보기 화면
- 주문 연동용 체크아웃 골격
- Sweetbook API 및 웹훅 연동용 백엔드 기반
- 웹훅 운영 패널 초안 (`/ops/webhooks`)

## 사용자 준비 사항

개발과 테스트를 위해 필요한 것은 많지 않습니다.

1. Sweetbook 파트너 계정과 Sandbox API Key
2. `.env.example`을 복사해 만든 `.env`
3. 갤럭시 데모 사진용 위치 태그 설정

갤럭시 사진 테스트는 아래 설정을 권장합니다.

`카메라 > 설정 > 위치 태그(Location tags)`를 켜 두면 여행 사진의 GPS 메타데이터가 더 잘 유지됩니다.

위치 정보가 없는 사진은 업로드 후 수동으로 장소 태그를 붙이는 흐름으로 처리합니다.

## 환경 변수

```bash
cp .env.example .env
```

```env
SWEETBOOK_API_KEY=
SWEETBOOK_ENV=sandbox
SWEETBOOK_WEBHOOK_SECRET=
```

## 로컬 실행

```bash
npm install --ignore-scripts
npm run dev
```

실행 후 브라우저에서 [http://localhost:3000](http://localhost:3000)을 열면 됩니다.

## 운영 보조 화면

현재 MVP에는 운영 확인용 화면도 포함되어 있습니다.

- `/ops/webhooks`: Sweetbook 웹훅 등록, 테스트 전송, delivery 이력 조회, 수신 로그 확인

이 화면은 운영 전환 전에 아래 항목을 빠르게 검증하기 위한 용도입니다.
- 웹훅 URL 등록 상태
- 최초 응답의 `secretKey` 보관 여부
- 테스트 전송 성공/실패 응답
- 최근 실패 delivery 추적
- 실제 수신 receipt와 delivery 이력의 대응 관계

## 제출 문서

- [5분 데모 스크립트](docs/demo-script.md)
- [제출 체크리스트](docs/submission-checklist.md)
- [크리티컬 이슈 기록](docs/critical-issues.md)

## 현재 작업 단위

작업은 자잘하게 쪼개지 않고 큰 단위로 관리합니다.

1. 프론트엔드 기반 구축
2. Sweetbook API와 EXIF 파이프라인 구축
3. 책 생성, 최종화, 주문 흐름 연결
4. README, 데모 데이터, 제출 문서 정리

## 문서 작성 원칙

앞으로 이 저장소의 설명성 문서는 기본적으로 한글로 작성합니다.

크리티컬한 이슈가 발생하면 아래 관점으로 자세히 남깁니다.
- 문제 내용
- 사용자 영향
- 원인 가설
- 대응 내용
- 남은 리스크
