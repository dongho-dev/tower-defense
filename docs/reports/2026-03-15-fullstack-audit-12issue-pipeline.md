# 작업 보고서: 풀스택 감사 + 12이슈 파이프라인

- **날짜**: 2026-03-15
- **처리 이슈 수**: 12개 (14개 신규 생성 → 16개 워커가능 → 12개 MIS 선정)
- **PR 목록**: #82, #83, #84 (전부 머지)
- **실행 방식**: 3배치 병렬 (run-agents, Opus 오케스트레이터)

## 우선순위 분포

- priority:high: 2개 (#68, #69)
- priority:medium: 7개 (#71, #74, #75, #76, #78, #80, #40)
- priority:low: 3개 (#73, #77, #81)

## Phase별 소요 시간

| Phase | 시작 | 완료 | 소요 |
|-------|------|------|------|
| Phase 0: 감사 (fullstack) | - | - | ~10분 (선행 실행) |
| Phase 1: 트리아지 | 16:00 | 16:02 | 2분 |
| Phase 2: 명세 | 16:02 | 16:12 | 10분 |
| Phase 3: 계획 | 16:12 | 16:16 | 4분 |
| Phase 4: 실행 | 16:16 | 17:57 | 101분 |
| Phase 5: 정리 | 17:57 | 17:57 | <1분 |
| **전체** | **16:00** | **17:57** | **~117분** |

## 파이프라인 전체 흐름

### Phase 0: 감사 (/basic-audit-fullstack)

6개 Sonnet Explore Agent를 병렬 실행하여 보안/에러핸들링/테스트/접근성/성능/코드품질을 감사.

**에이전트 메트릭:**

| Agent | 관심사 | 토큰 | Tool Uses | 소요 | 발견 수 |
|-------|--------|------|-----------|------|---------|
| B1 | 보안+입력검증 | 66,051 | 22 | 113초 | 6 |
| B2 | 에러핸들링+일관성 | 92,347 | 62 | 308초 | 10 |
| B3 | 테스트+데이터무결성 | 99,832 | 56 | 335초 | 10 |
| F1 | 프론트보안+데이터 | 49,400 | 29 | 110초 | 5 |
| F2 | UX+접근성 | 78,945 | 8 | 145초 | 15 |
| F3 | 성능+코드품질 | 85,069 | 42 | 187초 | 18 |
| **합계** | | **471,644** | **219** | **~335초 (max)** | **64 (raw)** |

**필터링 퍼널:**

| 단계 | 수 | 설명 |
|------|---|------|
| Raw 발견 | 64 | 6개 Agent 합산 |
| 중복 제거 | -5 | B1#2=F1#2, B1#5=F1#1=F1#5, B2#5=F3#13 |
| 기존 이슈 스킵 | -5 | #40 성능(gradient, findTarget, DOM, canBuildAt), #42 키보드 |
| 추정→버림 | -4 | lives=0(무해), AudioNode(자동GC), laser stale(안전), 색상대비(검증불가) |
| **최종 이슈** | **14** | |

**기존 이슈 스킵 상세:**

| 발견 | 기존 이슈 | 매칭 근거 |
|------|----------|----------|
| 타워당 gradient 매 프레임 생성 | #40 | 동일 라인(main.js:2407) 명시 |
| 적당 3개 gradient 생성 | #40 | gradient 할당 범주 |
| 매 프레임 DOM 업데이트 | #40 | main.js:1960-1966 동일 |
| canBuildAt O(n) | #40 | main.js:1433 동일 |
| 키보드 전용 배치 불가 | #42 | 동일 관심사 |

**오탐 판정:**

| 발견 | 에이전트 | 판정 이유 |
|------|---------|----------|
| lives=0 나머지 적 처리 중단 | B2 | showDefeatDialog→clearCurrentWave로 정리됨, 무해 |
| AudioNode 누수 | B2 | osc.stop() 후 현대 브라우저 자동 GC, 실질 영향 없음 |
| laser 인덱스 stale | B3 | 동기 코드 내 findTarget→damageEnemyAtIndex, splice 없음 |
| 색상 대비 부족 | F2 | 도구 없이 대비율 측정 불가, 추정만으로 판단 부적절 |

### Phase 1: 트리아지

- 전체 open: 17개
- 카테고리 분류:

| 카테고리 | 이슈 번호 |
|---------|----------|
| 워커가능 | #68, #69, #70, #71, #72, #73, #74, #75, #76, #77, #78, #79, #80, #81, #40, #42 |
| 대규모 | #1 (main.js 9파일 분리) |
| PR진행중 | 없음 |
| 허브 | 없음 (단일 파일 프로젝트라 허브 판정 기준 미적용) |

- 중복 발견: 0개
- priority:high 2개, medium 11개, low 4개 라벨 부여

### Phase 2: 명세

16개 이슈 전체 명세 작성. Opus Agent 2그룹 병렬 실행 (8+8 균등 배분).

| 그룹 | 이슈 | 토큰 | Tool Uses | 소요 |
|------|------|------|-----------|------|
| Group A | #68-75 | 83,219 | 54 | 577초 |
| Group B | #76-81, #40, #42 | 99,580 | 46 | 497초 |
| **합계** | | **182,799** | **100** | **~577초 (max)** |

- 신규 명세: 16개
- 기존 명세 스킵: 0개

### Phase 3: 계획

**충돌 그래프 (main.js 라인 ±15줄 기준):**

| 공유 영역 | 충돌 이슈들 | 라인 범위 |
|----------|-----------|----------|
| keydown/gold | #42 ↔ #68 | 3054-3098 |
| event area | #42 ↔ #40 | 2789-2914 |
| init | #68 ↔ #70 | 3288-3319 |
| constants | #69 ↔ #72 | 1-78 |
| buildStaticLayer | #69 ↔ #79 | 2058-2110 |

**MIS 컴포넌트별 분석:**

| 충돌 클러스터 | 옵션 | 선택 | 근거 |
|-------------|------|------|------|
| {#42, #68} | #42(M) vs #68(H) | #68 | priority:high > medium |
| {#42, #40} | #42(M) vs #40(M) | #40 | #42는 이미 #68 충돌로 제외, #40은 독립 |
| {#68, #70} | #68(H) vs #70(M) | #68 | priority:high > medium |
| {#69, #72} | #69(H) vs #72(M) | #69 | priority:high > medium |
| {#69, #79} | #69(H) vs #79(M) | #69 | priority:high > medium |

**제외 이슈:**

| 이슈 | 우선순위 | 사유 |
|------|---------|------|
| #42 | medium | #68(high), #40(medium)과 라인 충돌 |
| #70 | medium | #68(high)과 라인 충돌 (init 3288-3319) |
| #72 | medium | #69(high)와 라인 충돌 (constants 1-78) |
| #79 | medium | #69(high)와 라인 충돌 (buildStaticLayer 2058-2110) |

**배치 구성:**

| 배치 | 이슈 | 리뷰 레벨 |
|------|------|----------|
| A (fix/batch-a) | #68(H), #69(H), #73(L), #74(M) | L2: #68,#69 / L1: #73,#74 |
| B (fix/batch-b) | #75(M), #77(L), #80(M), #81(L) | L2: #81 / L1: #75,#77,#80 |
| C (fix/batch-c) | #71(M), #76(M), #78(M), #40(M) | L1: 전체 |

### Phase 4: 실행

**오케스트레이터 메트릭:**

| 배치 | 모델 | 토큰 | Tool Uses | 소요 | PR |
|------|------|------|-----------|------|-----|
| Batch A | Opus | 61,421 | 63 | 331초 | #82 |
| Batch B | Opus | 87,284 | 91 | 493초 | #83 |
| Batch C | Opus | 94,738 | 112 | 589초 | #84 |
| **합계** | | **243,443** | **266** | **~589초 (max)** | |

**이슈별 리뷰:**

| 이슈 | 리뷰 레벨 | 판정 | 재시도 | 주요 확인 사항 |
|------|----------|------|--------|--------------|
| #68 | L2 | PASS | 0 | gold-input max, setGameSpeed 상한(5), setter NaN/Infinity 거부 확인 |
| #69 | L2 | PASS | 0 | canvas null→throw, offCtx null→조기반환, render() ctx 가드 확인 |
| #73 | L1 | PASS | 0 | spawnCooldown 단계적 최솟값, 적 속도 웨이브 보정+캡(1.5배) |
| #74 | L1 | PASS | 0 | Escape 키→noop 변경, 맵 선택 필수 모달 일관성 |
| #75 | L1 | PASS | 0 | wave-preview aria-live, tower-list→radiogroup, 골드 aria-live 제거 |
| #77 | L1 | PASS | 0 | prefersReducedMotion 플래그, aura/pulse/trail/spin 조건부 비활성화 |
| #80 | L1 | PASS | 0 | upgrade 버튼 CSS(accent blue), focus-visible, tower-button 클래스 제거 |
| #81 | L2 | PASS | 0 | CDN 제거, CSP self-only, woff2 유효성(541KB/559KB), @font-face 확인 |
| #71 | L1 | PASS | 0 | 데드 어서션 `\|\| true` 제거, update/damageEnemyAtIndex 테스트 추가 |
| #76 | L1 | PASS | 0 | 롱프레스 500ms→업그레이드, getAdjustedPickRadius, touch-action none |
| #78 | L1 | PASS | 0 | 루프 오류→DOM 오버레이, canBuildAt 실패→announce+사운드, 스택 제거 |
| #40 | L1 | PASS | 0 | renderDirty flag, cachedCanvasRect, hoverTile mutate, towerPositionSet |

**CI 조사 과정:**

이 프로젝트에 GitHub Actions 등 CI가 설정되어 있지 않음. `gh pr checks`가 "no checks"를 반환. 따라서 CI 검증은 각 오케스트레이터 내부의 `npm test` 통과로 대체. 3개 PR 모두 MERGEABLE 상태 확인 후 머지.

**머지 순서 + 충돌 해결:**

1. **PR #82 (Batch A)** → 즉시 머지 성공
2. **PR #83 (Batch B)** → rebase 필요. 충돌 2건:
   - `tests/unit.test.js:529` — HEAD(#73/#69/#68 테스트)와 #75 ARIA 테스트 충돌 → 양쪽 모두 보존
   - `main.js:3350` — HEAD(검증된 setter)와 #77 getPrefersReducedMotion export 충돌 → 양쪽 합병
   - rebase 후 `npm test` PASS 확인 → force push → 머지
3. **PR #84 (Batch C)** → rebase 필요. 충돌 2건:
   - `main.js:3350` — HEAD(setter+getPrefersReducedMotion)와 #71 exports(update, spawnEnemy 등) 충돌 → 양쪽 합병
   - `tests/unit.test.js:531` — HEAD(이전 배치 테스트)와 #71 update/damageEnemyAtIndex 테스트 충돌 → 양쪽 보존 + 잔여 마커 1개 제거
   - rebase 후 `npm test` PASS 확인 → force push → 머지

### Phase 5: 정리

- batch-a: Permission denied로 worktree remove 실패 → `git worktree prune`으로 해결
- batch-b, batch-c: 정상 제거
- 3개 feature 브랜치(fix/batch-a, -b, -c) 삭제 완료
- 최종 상태: main worktree만 남음

## 이슈별 상세

### Batch A (PR #82: +93/-17, 3 files)

| 이슈 | 제목 | 변경 파일 | 비고 |
|------|------|----------|------|
| #68 | 입력 검증 미흡 | main.js, index.html, tests/unit.test.js | gold-input에 `max="999999"` 추가, setGameSpeed에 `Math.min(v, 5)` 상한, setGold/setWave/setLives에 타입체크+범위 클램핑 |
| #69 | Canvas null 가드 | main.js, tests/unit.test.js | canvas null→throw Error, buildStaticLayer offCtx null→조기 return, render() 진입부 `if (!ctx) return` 가드 |
| #73 | 웨이브 밸런스 | main.js, tests/unit.test.js | spawnCooldown 최솟값 웨이브 구간별 단계적 하향(0.25→0.20→0.15), 적 속도에 `1+Math.min(wave*0.005, 0.5)` 보정 |
| #74 | 맵 선택 UX | main.js | Escape 핸들러에서 게임 시작 로직 제거→noop 변경 (필수 모달이므로 Escape 무시) |

### Batch B (PR #83: +135/-17, 6 files)

| 이슈 | 제목 | 변경 파일 | 비고 |
|------|------|----------|------|
| #75 | ARIA 접근성 | index.html, main.js, tests/unit.test.js | wave-preview에 aria-live="polite", tower-list role→radiogroup, 골드 stat-chip aria-live 제거, 속도변경 시 announce() |
| #77 | prefers-reduced-motion | main.js, tests/unit.test.js | `prefersReducedMotion` 플래그+matchMedia 리스너, aura/pulse/trail/spin을 조건부 상수로 전환 |
| #80 | CSS 누락 | style.css, tests/unit.test.js | #upgrade-tower-button 스타일 추가(accent blue, hover, disabled, focus-visible), tower-button 클래스 제거 |
| #81 | Google Fonts 로컬 | index.html, style.css, fonts/×2, tests/unit.test.js | CDN 링크 3줄 제거, @font-face 선언 추가, woff2 자체 호스팅, CSP style-src/font-src→'self' only |

### Batch C (PR #84: +214/-14, 3 files)

| 이슈 | 제목 | 변경 파일 | 비고 |
|------|------|----------|------|
| #71 | 테스트 품질 | tests/unit.test.js, main.js | 데드 어서션 `\|\| true` 제거, update() 웨이브 시작/적 탈출 테스트, damageEnemyAtIndex 직접 테스트 3건 |
| #76 | 터치 접근성 | main.js, style.css, tests/unit.test.js | 롱프레스 500ms→upgradeTower, getAdjustedPickRadius()로 터치 반경 보정, touch-action→none |
| #78 | 사용자 피드백 | main.js, tests/unit.test.js | 루프 10회 오류→DOM 오버레이 표시, canBuildAt 실패→announce+사운드, console.error→e.message only |
| #40 | 렌더링 성능 | main.js, tests/unit.test.js | renderDirty flag(일시정지 렌더링 스킵), cachedCanvasRect(resize에서만 갱신), hoverTile mutate, towerPositionSet O(1) |

## 명세 외 변경 (unplannedWrites)

없음. 3개 배치 모두 Write 허용 목록 내에서만 변경.

## 명세 차이 + 특이사항

없음. 리뷰어 12건 모두 명세 충족 판정.

## 테스트 수 변화

- 이전: `npm test` 기존 테스트 수 (smoke + unit)
- 이후: +22개 이상 신규 테스트 추가

**신규 테스트 상세:**

| 파일 | 추가 수 | 테스트 내용 |
|------|---------|-----------|
| tests/unit.test.js | ~6 | #68: setGameSpeed 상한/NaN/정상, setGold 상한/NaN/음수, setWave/setLives 클램핑 |
| tests/unit.test.js | ~1 | #69: buildStaticLayer offCtx null 시 크래시 없음 |
| tests/unit.test.js | ~3 | #73: 웨이브 50 속도 보정, 웨이브 200 캡, 웨이브 9999 캡 유지 |
| tests/unit.test.js | ~4 | #75: wave-preview aria-live, tower-list radiogroup, 골드 aria-live 제거, 속도 announce |
| tests/unit.test.js | ~1 | #77: prefersReducedMotion 기본값 false |
| tests/unit.test.js | ~2 | #80: #upgrade-tower-button CSS 존재, tower-button 클래스 미사용 |
| tests/unit.test.js | ~4 | #81: CDN 참조 없음, CSP style-src/font-src 외부 없음, 폰트 파일 존재, @font-face |
| tests/unit.test.js | ~5 | #71: 데드 어서션 수정, update 웨이브/적탈출, damageEnemyAtIndex 처치/무효/미처치 |
| tests/unit.test.js | ~3 | #76: getAdjustedPickRadius, gameLoopHalted, towerPositionSet canBuildAt |
| tests/unit.test.js | ~2 | #78: gameLoopHalted, renderDirty 존재 |
| tests/unit.test.js | ~3 | #40: towerPositionSet canBuildAt, renderDirty, cachedCanvasRect |

## 이전 위험 추적

| 위험 항목 | 최초 보고 | 반복 횟수 | 현재 상태 |
|----------|----------|----------|----------|
| 단일 파일(main.js) 구조 | #1 | 4회 (매 파이프라인) | ⚠️ #1 open 유지 — 모듈 분리 미실행 |
| 리베이스 충돌 (단일 파일) | 이전 파이프라인 | 3회 | ⚠️ 이번에도 batch-b, batch-c 리베이스 시 충돌 발생 |

## 잔여 위험 및 후속 과제

### MIS 제외 이슈 — 다음 파이프라인 처리 가능성

| 이슈 | 충돌 원인 | 이번 머지로 해소 여부 |
|------|----------|-------------------|
| #42 (키보드 접근성) | #68과 keydown 3054-3098 충돌 | ✅ #68 머지 완료, 라인 이동 있으나 충돌 범위 변경 → 재분석 필요 |
| #70 (초기화 순서) | #68과 init 3288-3319 충돌 | ✅ #68 머지 완료, 해당 영역 변경됨 → 명세 라인 업데이트 필요 |
| #72 (데이터 불일치) | #69와 constants 1-78 충돌 | ✅ #69 머지 완료, null 가드만 추가 → 충돌 해소 가능성 높음 |
| #79 (코드 중복) | #69와 buildStaticLayer 2058-2110 충돌 | ✅ #69 머지 완료, 가드만 추가 → 충돌 해소 가능성 높음 |

→ 4개 모두 다음 파이프라인에서 처리 가능. 명세 라인 번호 업데이트 필요.

### 구조적 위험

- **단일 파일 리베이스 충돌**: main.js 단일 파일 구조로 인해 배치 머지마다 리베이스 충돌 발생. #1(모듈 분리)이 해결될 때까지 반복될 것. 이번에는 module.exports 블록과 tests/unit.test.js 끝부분에서 집중 발생.
- **테스트 파일 충돌 집중**: 모든 배치가 tests/unit.test.js 끝에 테스트를 추가하는 구조라 매번 같은 위치에서 충돌. 테스트를 별도 파일로 분리하거나 describe 블록별 구분이 필요.

### 교훈

1. **module.exports 블록이 머지 충돌 핫스팟**: 3개 배치 모두 export 추가 → 매번 같은 위치에서 충돌. 각 워커가 exports를 파일 끝이 아닌 해당 함수 근처에서 export하도록 구조 변경 검토.
2. **테스트 끝부분 추가 패턴 개선**: 모든 워커가 `console.log('Unit tests passed')` 직전에 테스트를 추가 → 충돌 집중. 이슈별 별도 test 파일 또는 섹션 마커 도입 필요.

## 전체 자원 사용량

| 단계 | 에이전트 수 | 총 토큰 | 총 Tool Uses |
|------|-----------|---------|-------------|
| Phase 0 (감사) | 6 (Sonnet) | 471,644 | 219 |
| Phase 2 (명세) | 2 (Opus) | 182,799 | 100 |
| Phase 4 (실행) | 3 (Opus) | 243,443 | 266 |
| **합계** | **11** | **~897,886** | **585** |
