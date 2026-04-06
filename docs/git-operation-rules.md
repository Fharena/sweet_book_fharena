# Git 운영 규칙

이 문서는 Triplogue 저장소에서 Git/GitHub 작업이 다시 꼬이지 않도록 현재 기준을 고정해 두는 메모입니다.

## 현재 기준 브랜치

- 작업 브랜치: `codex/frontend-sync`
- 기준 PR: `#2`
- `#1`은 초기 누적 PR이며, 최신 작업 기준 PR이 아니므로 merge 대상이 아니고 close 대상으로 본다.

## 왜 이렇게 정리했는가

`VibeDeck`와 비교했을 때, 이 저장소에서 GitHub 인증이 반복해서 꼬였던 핵심 원인은 아래 두 가지였다.

1. GitHub URL용 repo-local/per-url credential override가 들어가면서 기본 credential manager 경로를 깨뜨렸다.
2. 기존 PR 브랜치(`feat/frontend-foundation`)와 실제 작업 브랜치가 달라지면서 push/PR 기준이 흔들렸다.

따라서 현재 저장소에서는 아래 원칙을 유지한다.

## 규칙

### 1. GitHub helper를 임의로 덮어쓰지 않는다

- `gh.exe auth git-credential` 경로를 다시 넣지 않는다.
- `[credential \"https://github.com\"]` 같은 repo-local helper override를 다시 만들지 않는다.
- 기본은 `credential.helper = manager` 기준으로 유지한다.

### 2. 작업 브랜치와 PR 브랜치를 일치시킨다

- 구현은 `codex/frontend-sync`에 누적한다.
- PR은 `codex/frontend-sync -> main` 기준 `#2` 하나로 유지한다.
- 더 이상 `feat/frontend-foundation`에 새 작업을 누적하지 않는다.

### 3. push는 브랜치를 명시해서 처리한다

가능하면 아래 형태를 우선 사용한다.

```bash
git push origin codex/frontend-sync:codex/frontend-sync
```

upstream이 꼬였을 때도 브랜치 기준이 명확해진다.

### 4. Codex 세션 push가 막히면 이전 문제 방식으로 되돌리지 않는다

- `gh.exe` helper를 다시 붙이지 않는다.
- 깨진 credential helper 경로를 추가하지 않는다.
- 필요하면 GitHub 커넥터로 브랜치 ref를 올리거나, 사용자 터미널에서 push 한다.

## merge 기준

- `PR #1`은 merge하지 않고 정리 시점에 close한다.
- `PR #2`를 기준 PR로 유지한다.
- 다음 조건이 끝나면 가능한 한 빨리 `PR #2`를 merge한다.
  - 브라우저 실화면 디버깅 1회
  - 실제 여행 사진 기준 업로드/검토/주문 흐름 1회
  - README / 데모 스크립트 / 체크리스트 최종 정리

즉, 새 PR을 더 늘리기보다 `PR #2`를 짧은 주기로 정리해서 머지하는 것이 기본 전략이다.
