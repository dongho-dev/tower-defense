# 작업 보고서: pipeline round 7 — 크로스파일 전역 변수 캡슐화

- **날짜**: 2026-03-22
- **처리 이슈 수**: 1개
- **PR 목록**: #175 (머지 완료)
- **실행 방식**: 직접 처리 (MIS = 1개)

## 우선순위 분포

- priority:high: 1개 (#161)
- priority:medium: 0개
- priority:low: 0개

## Phase별 소요 시간

| Phase | 시작 | 완료 | 소요 |
|-------|------|------|------|
| nextplan | 09:02 | 09:03 | 1분 |
| spec | 09:03 | 09:04 | 스킵 (전체 명세 완료) |
| review-issues | 09:04 | 09:06 | 2분 |
| run-agents | 09:06 | 09:10 | 4분 |
| worktree-clean | 09:10 | 09:10 | <1분 |
| **전체** | **09:02** | **09:10** | **8분** |

## 파이프라인 전체 흐름

### Phase 0: 감사

스킵됨 (이전 라운드에서 충분한 이슈 풀 확보).

### Phase 1: 트리아지

- open 이슈: 15개
- 중복 발견: 0개
- open PR: 0개

| 카테고리 | 수 | 이슈 번호 |
|----------|---|----------|
| 워커가능 | 15 | #161, #163, #148, #167, #166, #165, #139, #137, #135, #134, #151, #150, #149, #145, #142 |
| 허브 | 0 | - |
| PR 진행 중 | 0 | - |
| 대규모 | 0 | - |
| 외부 의존 | 0 | - |

모든 15개 이슈에 이미 priority 라벨과 명세가 부여된 상태. 접근성 관련 이슈(#165, #166, #167)가 유사 영역이지만 각각 별개 범위(inert, ARIA 속성, 스크린리더 알림)를 다루어 중복 아님.

### Phase 2: 명세

- 기존 명세: 15/15개 (100%)
- 신규 명세: 0개
- Phase 전체 스킵

### Phase 3: 계획

#### 충돌 그래프

`game.js`가 15개 이슈 중 14개에서 Write 파일로 포함되어 거의 완전 그래프 형성.

| 공유 파일 | 충돌 이슈 수 | 핵심 충돌 클러스터 |
|----------|------------|-------------------|
| game.js | 14개 이슈 | 전체 (유일한 미포함: 없음) |
| ui.js | 9개 이슈 | #167, #165, #151, #145, #139, #137, #135, #161, #142(간접) |
| index.html | 6개 이슈 | #166, #139, #137, #135, #134, #149 |
| style.css | 4개 이슈 | #167, #139, #137, #134 |
| audio.js | 3개 이슈 | #166, #137, #161 |
| constants.js | 2개 이슈 | #150, #134 |
| utils.js | 3개 이슈 | #151, #142, #161 |

#### MIS 분석

모놀리식 `game.js` 때문에 모든 이슈가 상호 충돌. 파일 수준 MIS 계산 결과:
- **Greedy 선택**: priority:high인 #161 (degree=14, 전체 연결)이 최우선 선택
- **#161 선택 시 → 나머지 14개 전부 제외** (모두 game.js 충돌)
- MIS = {#161}, 크기 = 1

옵션 분석:
- {#161} = 1개, priority:high 1개 — **선택**: 유일한 high-priority 버그이며, 캡슐화 개선으로 이후 이슈의 충돌 범위 축소 효과
- game.js를 제외하고 라인 수준 분석을 시도할 수도 있으나, 안전성 우선으로 파일 수준 MIS 적용

#### 제외 이슈

| 이슈 | 우선순위 | 제외 사유 |
|------|---------|----------|
| #163 | 🟡 medium | game.js 충돌 (#161) |
| #148 | 🟡 medium | game.js 충돌 (#161) |
| #167 | 🟡 medium | game.js, ui.js 충돌 (#161) |
| #166 | 🟡 medium | game.js, audio.js 충돌 (#161) |
| #165 | 🟡 medium | ui.js, game.js, eslint.config.mjs 충돌 (#161) |
| #139 | 🟡 medium | ui.js, game.js 충돌 (#161) |
| #137 | 🟡 medium | ui.js, game.js, audio.js 충돌 (#161) |
| #135 | 🟡 medium | game.js, ui.js 충돌 (#161) |
| #134 | 🟡 medium | game.js 충돌 (#161) |
| #151 | 🟢 low | utils.js, ui.js 충돌 (#161) |
| #150 | 🟢 low | game.js 충돌 (#161) |
| #149 | 🟢 low | game.js 충돌 (#161) |
| #145 | 🟢 low | ui.js, game.js 충돌 (#161) |
| #142 | 🟢 low | utils.js, game.js 충돌 (#161) |

### Phase 4: 실행 (직접 처리)

이슈 1개 → 직접 처리 경로 (Phase 4-B).

#### 구현 과정

1. 명세 본문 확인 → 3개 변경 영역 식별
2. 관련 파일 5개 읽기 (utils.js, ui.js, audio.js, game.js, eslint.config.mjs)
3. 코드 변경 적용 (6 edits)
4. ESLint 실행: 0 errors, 220 warnings (기존 수준)
5. 테스트 실행: 92/92 pass

#### 리뷰

| 이슈 | 리뷰 레벨 | 판정 | 재시도 | 주요 확인 사항 |
|------|----------|------|--------|--------------|
| #161 | L2 | PASS | 0 | 로드 순서 검증 (utils→ui→audio→game), 함수 호출 시점에 정의 선행 확인, eslint globals 정합성, game.js 직접 변수 조작 완전 제거 확인 |

L2 승격 근거: priority:high + 5개 파일 변경.

#### CI 조사

- PR #175 push → pre-push hook에서 `npm test` 실행 → 92/92 pass
- GitHub Actions `test` check: pass (9초)
- 추가 조사 불필요 (모든 체크 통과)

#### 머지

- `gh pr ready 175` → `gh pr merge 175 --squash` → 자동 머지 완료
- `closes #161` 태그로 이슈 자동 닫힘 확인
- `git pull origin main` → fast-forward 성공

### Phase 5: 정리

- `git worktree list`: main worktree만 존재 (추가 worktree 없음)
- `fix/161-cross-file-globals` 로컬 브랜치 삭제 완료

## 이슈별 상세

| 이슈 | 제목 | 변경 파일 | 비고 |
|------|------|----------|------|
| #161 | bug: 크로스파일 전역 변수 로드 순서 의존 | utils.js, ui.js, audio.js, game.js, eslint.config.mjs | NUMBER_FORMAT을 ui.js→utils.js로 이동하여 정의-사용 동일 파일 통일. audio.js에 `resetAudioCache()` 추가하여 game.js의 `cachedNoiseBuffer=null; cachedNoiseDuration=0` 직접 조작을 함수 호출로 캡슐화. ui.js에 `resetBuildPanelOverride()` 추가하여 game.js의 `buildPanelUserOverride=false` 직접 조작을 함수 호출로 캡슐화. |

## 명세 외 변경 (unplannedWrites)

없음. 명세에 명시된 5개 파일만 변경.

## 명세 차이 + 특이사항

없음. 명세 완료 기준 6개 항목 모두 충족:
- NUMBER_FORMAT utils.js 이동 ✅
- audio.js resetAudioCache() 추가 ✅
- game.js cachedNoiseBuffer/cachedNoiseDuration 직접 조작 → resetAudioCache() 교체 ✅
- ui.js resetBuildPanelOverride() 추가 ✅
- game.js buildPanelUserOverride 직접 조작 → resetBuildPanelOverride() 교체 ✅
- eslint.config.mjs globals 업데이트 ✅

## 테스트 수 변화

- 이전: 92개 → 이후: 92개 (+0개)
- 기존 테스트 전체 통과. 명세에서 추가 테스트를 "간접적으로 이미 테스트됨"으로 판단하여 신규 테스트 미추가. resetGame 통합 테스트(unit.test.js:648-680)가 resetAudioCache/resetBuildPanelOverride 호출을 커버.

## 이전 위험 추적

MEMORY.md 미존재로 추적 이력 없음.

## 잔여 위험 및 후속 과제

### MIS 제외 이슈 다음 파이프라인 처리 가능성

#161 머지로 game.js의 크로스파일 직접 조작 패턴이 제거됨. 그러나 **game.js 모놀리식 구조는 여전하므로**, 다음 파이프라인에서도 파일 수준 MIS는 1~2개 수준으로 예상.

구조적 해결 방안:
- #149 (game.js 맵 선택·오버레이 함수 별도 모듈 분리)를 우선 처리하면 game.js의 Write 범위가 축소되어 MIS 크기 증가 가능
- 또는 라인 수준 충돌 분석을 도입하여 game.js 내 비중복 영역 이슈를 병렬화

### 교훈

1. **game.js 모놀리식 병목**: 15개 이슈 중 14개가 game.js를 수정 → 파일 수준 MIS가 항상 1. #149(모듈 분리)를 조기에 처리하면 이후 파이프라인 처리량이 크게 개선될 것.
2. **전체 명세 완료 상태에서 파이프라인 효율**: Phase 2 스킵으로 전체 소요 8분. 명세 선투자의 ROI가 매우 높음.

## 전체 자원 사용량

| 단계 | 에이전트 수 | 비고 |
|------|-----------|------|
| nextplan | 0 (직접) | 이슈 수집 + 분류 |
| spec | 0 | 스킵 |
| review-issues | 0 (직접) | MIS 계산 (node inline script) |
| run-agents | 0 (직접 처리) | 코드 변경 + L2 리뷰 |
| worktree-clean | 0 (직접) | 브랜치 정리 |
| **합계** | **0** | 단일 세션 직접 처리 |
