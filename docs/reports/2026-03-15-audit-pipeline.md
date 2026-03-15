# 작업 보고서: 풀스택 감사 + 파이프라인 실행

날짜: 2026-03-15
처리 이슈: 15개 (17개 감사 발견 → 15개 워커가능)
PR: #47 (Batch C), #48 (Batch A), #49 (Batch B) — 전부 squash merge 완료
실행 방식: `/basic-audit-fullstack` → `/basic-pipeline` (자동 모드, `--confirm` 없음)

## 우선순위 분포

- priority:high: 3개 (#28 ENEMY_STYLES, #29 pickEnemyType, #41 테스트 커버리지)
- priority:medium: 7개 (#30 CSP, #31 hexToRgba, #32 폰트, #36 반응형, #38 Escape, #39 ARIA, #44 console)
- priority:low: 5개 (#33 setWave, #34 웨이브캡, #35 BOM, #37 reduced-motion, #43 RAF)

## Phase별 소요 시간

Pipeline CLI 기준 (`pipeline-2026-03-15-519`):

| Phase | 시작 (UTC) | 비고 |
|-------|-----------|------|
| pipeline init | 04:24:39 | 이전 파이프라인 완료 상태에서 새로 init |
| nextplan | 04:24 ~ | 18개 open 이슈 조회 + 분류 |
| spec | — | 2그룹 Opus Agent 병렬 (Group A 4.6분, Group B 8.9분) |
| review-issues | — | MIS 분석 + 배치 구성 |
| run-agents | — | 3개 Opus Agent 병렬 (A 2.5분, B 2.3분, C 4.9분) |
| worktree-clean | — | 3 worktree + 5 branch 삭제 |

Agent 실행 시간 상세 (토큰 기반):
- Batch A: 20,756 tokens, 28 tool uses, 147초
- Batch B: 21,849 tokens, 36 tool uses, 139초
- Batch C: 60,382 tokens, 45 tool uses, 291초 (테스트 47개 추가가 대부분)

## 워크플로우 의사결정

### Claude가 결정한 것

1. **감사 → 파이프라인 연속 실행**: 사용자가 `/basic-audit-fullstack` 후 바로 `/basic-pipeline`을 호출. 감사에서 생성된 17개 이슈를 동일 세션에서 파이프라인으로 처리.

2. **3개 이슈 대규모 제외 결정**:
   - #1 (모듈 분리): 9개 파일 신규 생성 + 전체 리팩토링 — 단일 PR로는 리뷰 불가능한 규모
   - #40 (성능 최적화): 8개 독립 항목이 하나의 이슈에 묶여 있어 scope가 너무 넓음
   - #42 (키보드 배치): 새로운 인터랙션 시스템 설계 필요 — 명세 단계에서 아키텍처 결정 필요

3. **배치 구성 기준 — 라인 범위 기반 MIS**:
   단일 파일(main.js) 프로젝트이므로 파일 기반 충돌 분석이 의미 없음. 대신 main.js 내 수정 라인 범위를 기준으로 충돌 판단. 100줄 이상 떨어진 변경은 git auto-merge 가능하다고 판단.
   - 예외: #43(line 3116)과 #44(line 3114)가 2줄 차이이나, 서로 다른 라인을 수정하므로 같은 배치에 배치. 실제로 git auto-merge 성공.

4. **Batch A/B diverged history → cherry-pick 결정**:
   - `gh pr merge --squash` 시도 → GitHub가 CONFLICTING 표시
   - 대안 1: force-push로 브랜치 리셋 → 파괴적 조작 회피
   - 대안 2: 새 브랜치에 cherry-pick → 선택. 이유: 원본 커밋이 단일 커밋이므로 cherry-pick이 가장 깔끔

## 파이프라인 전체 흐름

### 감사 (audit)

6개 Explore Agent (Sonnet, `very thorough`) 병렬 실행:

| Agent | 관심사 | 발견 수 | 토큰 | 시간 |
|-------|--------|---------|------|------|
| B1 | 보안 + 입력 검증 | 7 | 61K | 196초 |
| B2 | 에러 핸들링 + API 일관성 | 15 | 112K | 401초 |
| B3 | 테스트 커버리지 + 데이터 무결성 | 11 | 79K | 210초 |
| F1 | 클라이언트 보안 | 7 | 82K | 121초 |
| F2 | UX 일관성 + 접근성 | 20 | 85K | 241초 |
| F3 | 성능 + 코드 품질 | 20 | 91K | 223초 |

**중복 제거**: ENEMY_STYLES (B2-3, B3-1, F3-14), CSP (B1-1, F1-1, F1-3, F1-6), innerHTML (B1-5, F1-7), pickEnemyType (B2-4, B3-10), 캔버스 폰트 (F2-7, F2-19)

**오탐 판정 과정 (5건)**:

1. **gameOver 좌클릭 빌드 (B2-6)** — Agent가 "left-click can build towers while gameOver" 보고.
   검증: `main.js:2848` 읽음 → `if (paused) { hideAllStats(); return; }` 확인. `showDefeatDialog()`에서 `paused=true` 설정 확인. `hideDefeatDialog()`가 `paused`를 변경하지 않음 확인. Space 키 핸들러 `main.js:3077`에서 `if (gameOver) return;` 확인. `paused=false`로 설정하는 경로가 `resetGame()`(gameOver도 false로 리셋)과 `START_GAME_BUTTON`(resetGame 후 호출)뿐임을 확인 → gameOver 상태에서 unpause 불가 → **오탐 확정**.

2. **text-muted 대비비 (F2-17)** — Agent가 "#a9b4c4 on dark background contrast failure suspected" 보고.
   검증: `style.css:24` 읽음 → `--text-muted: #a9b4c4`. 배경색 계산: `--panel-bg: rgba(23,32,44,0.82)` composited on gradient `#10151d~#080b10`. 합성 결과 `≈ #161e29 (RGB 22,30,41)`. WCAG 상대 휘도 공식으로 계산:
   - 전경 L₁ = 0.2126×0.416 + 0.7152×0.471 + 0.0722×0.571 ≈ 0.467
   - 배경 L₂ = 0.2126×0.011 + 0.7152×0.018 + 0.0722×0.031 ≈ 0.018
   - 대비비 = (0.467+0.05)/(0.018+0.05) ≈ **7.6:1** → WCAG 4.5:1 기준 통과 → **오탐 확정**.

3. **innerHTML='' (B1-5, F1-7)** — 두 Agent 모두 보고했으나, `TOWER_LIST_CONTAINER.innerHTML = ''`과 `MAP_LIST_CONTAINER.innerHTML = ''`은 빈 문자열 할당으로 XSS 벡터 아님 → **오탐 확정**.

4. **wave fractional (B1-6)** — `Number('1.9')`가 finite으로 통과한다고 보고.
   검증: `main.js:1055` 읽음 → `setWave()`에서 `Math.floor(targetWave)` 적용 → 내부에서 정수화 처리됨 → **오탐 확정**.

5. **touchstart touches[0] (B2-11)** — `e.touches[0]`이 undefined일 수 있다고 보고.
   검증: W3C TouchEvent 스펙상 `touchstart` 이벤트는 최소 1개의 `Touch` 객체를 `touches`에 포함 → **오탐 확정**.

**이슈 생성**: 17개 이슈를 `gh issue create` 병렬 Bash 호출로 일괄 생성. 모든 이슈에 `🤖 /basic-audit-fullstack에서 자동 생성됨` 태그 포함.

### Phase 1 (nextplan) — 트리아지

18개 open 이슈 (17개 신규 + #1 기존):
- 워커가능 15개: 모든 신규 이슈 중 단순 코드 수정으로 해결 가능한 것
- 대규모 제외 3개: #1, #40, #42 (scope가 단일 PR로 처리하기에 너무 큼)
- PR 진행 중: 0개 (이전 파이프라인 PR 전부 머지 완료)
- 중복: 0개

### Phase 2 (spec) — 명세

15개 이슈를 2그룹 Opus Agent로 병렬 처리:
- Group A (8개: #28-35): 277초 소요, 42 tool uses
- Group B (7개: #36-44): 532초 소요, 33 tool uses

Group B가 더 오래 걸린 이유: #41(테스트 커버리지)의 명세가 매우 상세 — 20+ 테스트 케이스의 코드 스니펫까지 포함.

### Phase 3 (review-issues) — 계획

**MIS 분석 상세:**

모든 15개 이슈가 같은 파일(main.js)을 수정하지만, 수정 위치가 분산되어 있어 전부 MIS에 포함 가능했음. 가장 근접한 라인 쌍:
- #43(line 3116) ↔ #44(line 3114): 2줄 차이 → 같은 배치에 배치하여 순차 적용
- #38(line 1337) ↔ #39(line 1358): 21줄 차이, 다른 함수 → 같은 배치에 배치
- #41(line 3132) ↔ #44(line 3114): 18줄 차이 → 다른 배치에 분리

### Phase 4 (run-agents) — 실행

3개 Opus Agent 백그라운드 병렬 실행. 결과:

| 배치 | 완료 시간 | 이슈 | 결과 |
|------|----------|------|------|
| A | 147초 | #28,29,31,32,34 | 5/5 PASS |
| B | 139초 | #30,33,35,43,44 | 5/5 PASS |
| C | 291초 | #36,37,38,39,41 | 5/5 PASS |

**PR 생성 후 CONFLICTING 문제 발생 — 상세 기록:**

Agent들이 PR을 생성한 후 CI/mergeable 확인 시 PR #45(Batch A), #46(Batch B)이 CONFLICTING:

```
$ gh pr view 45 --json mergeable --jq '.mergeable'
CONFLICTING

$ gh pr view 47 --json mergeable --jq '.mergeable'
MERGEABLE
```

원인 조사 — merge-base 확인:

```
$ cd .claude/worktrees/batch-a && git merge-base origin/main HEAD
8a0cdf26b93775dd724c64adf49e8b323e5cbcf3   # origin/main HEAD(80af178)와 다름!

$ cd .claude/worktrees/batch-c && git merge-base origin/main HEAD
80af17826ab98dc0e66287696a1c05a4b9270bbb   # 정상 — origin/main HEAD와 동일

$ cd .claude/worktrees/batch-a && git log --oneline -3
09b11bf fix: main.js 버그 수정 (#28, #29, #31, #32, #34)
110b9ab docs: 회고 보고서 보강...   # ← 이 해시가 80af178이 아님!
2b393b6 docs: 2026-03-15 기능 배치 회고 보고서 추가...
```

히스토리 비교 결과:
```
$ git log --oneline 80af178..110b9ab   # 11개 커밋 (pre-squash 히스토리)
$ git log --oneline 110b9ab..80af178   # 7개 커밋 (squash-merged 히스토리)
```

**근본 원인**: 이전 파이프라인의 PR들이 `--squash`로 머지되면서 main에는 squash 커밋이, 로컬에는 원본 커밋이 남음. Agent A와 B가 worktree 내에서 작업 중 이 diverged 히스토리를 포함하는 브랜치를 push함. Agent C는 우연히 정상 히스토리를 가진 것으로 보임.

**해결 과정**:
1. PR #47(Batch C, MERGEABLE) 먼저 squash merge
2. `git pull origin main`으로 로컬 업데이트
3. 새 브랜치 생성 + cherry-pick:
   ```
   $ git checkout -b fix/batch-a-v2 main
   $ git cherry-pick 09b11bf   # Auto-merging main.js — 성공
   $ npm test   # Smoke test passed / Unit tests passed

   $ git checkout main
   $ git checkout -b fix/batch-b-v2 main
   $ git cherry-pick 3833f8f   # Auto-merging index.html, main.js — 성공
   $ npm test   # 통과
   ```
4. 기존 PR #45, #46 close → 새 PR #48, #49 생성 → MERGEABLE 확인 → 순차 squash merge

### Phase 5 (worktree-clean)

```
$ git worktree remove .claude/worktrees/batch-a
$ git worktree remove .claude/worktrees/batch-b
$ git worktree remove .claude/worktrees/batch-c
$ git branch -d fix/batch-a fix/batch-b fix/batch-c fix/batch-a-v2 fix/batch-b-v2
```

## 이슈별 상세

### Batch A (PR #48) — main.js 버그 수정

| 이슈 | 제목 | 변경 파일:라인 | 리뷰 | 비고 |
|------|------|--------------|------|------|
| #28 | ENEMY_STYLES 미정의 참조 | `main.js:1135` | L2 PASS | 1줄 변경. `ENEMY_STYLES[0]` → `ENEMY_TYPE_DEFINITIONS[0]`. ENEMY_STYLES가 코드 전체에서 미선언임을 Grep으로 확인 |
| #29 | pickEnemyType undefined | `main.js:1463,1467,1468` | L2 PASS | 3개 `find()` 호출에 `\|\| ENEMY_TYPE_DEFINITIONS[0]` 폴백 추가 |
| #31 | hexToRgba 8자리 hex | `main.js:763` | L1 PASS | 1줄 → 5줄 확장. `if/else if/else` 분기로 3자리, >6자리, 기타 처리 |
| #32 | 캔버스 한글 폰트 | `main.js:2758` | L1 PASS | 폰트 스택에 Noto Sans KR, Malgun Gothic 추가 |
| #34 | 웨이브 상한 | `main.js:1801` | L1 PASS | `wave += 1` → `wave = Math.min(wave + 1, WAVE_MAX)` |

명세 차이: Agent 보고에서 라인 번호가 +4~5 offset (Worker 3의 multi-line 확장으로 인한 shift). 논리적 위치는 정확.

### Batch B (PR #49) — 보안/정리

| 이슈 | 제목 | 변경 파일:라인 | 리뷰 | 비고 |
|------|------|--------------|------|------|
| #30 | CSP 강화 | `index.html:6` | L1 PASS | `script-src 'self'; object-src 'none'; base-uri 'self'` 추가. `'unsafe-inline'`은 Google Fonts 호환성을 위해 유지 |
| #33 | setWave 초기화 | `main.js:1058-1059` | L1 PASS | `selectedTowerType = DEFAULT_TOWER_TYPE;` + `setSelectedTowerButton(...)` 2줄 제거 |
| #35 | BOM 제거 | `main.js:868` | L1 PASS | U+FEFF (3바이트 EF BB BF) 제거. 파일 시작 BOM은 유지 |
| #43 | RAF 핸들 | `main.js:3100-3129` | L1 PASS | `let rafHandle = 0` + `stopLoop()`/`startLoop()` 함수 추가 + 패배 시 루프 중지 + 게임 시작 시 재개 |
| #44 | console.error | `main.js:601,725,3114` | L1 PASS | 3곳 에러 객체 → `e.message` 변경 |

### Batch C (PR #47) — CSS/접근성/테스트

| 이슈 | 제목 | 변경 파일 | 리뷰 | 비고 |
|------|------|----------|------|------|
| #36 | 반응형 갭 | `style.css` | L1 PASS | `@media (max-width: 960px)`에 `.canvas-wrapper`, `canvas` 반응형 규칙 추가 |
| #37 | reduced-motion | `style.css` | L1 PASS | 파일 끝에 `@media (prefers-reduced-motion: reduce)` 블록 + `.icon-button` 38→44px, `.build-toggle` 32→44px |
| #38 | 모달 Escape | `main.js` | L1 PASS | 패배 오버레이 keydown에 Escape 분기 추가. 맵선택 오버레이에 포커스 트랩 + auto-focus + 이전 포커스 복원 |
| #39 | ARIA 시맨틱 | `index.html`, `main.js` | L1 PASS | `role="radiogroup"` → `role="toolbar"`, `aria-live`를 `.stat-chip` → `.stat-value`로 이동, 맵 카드에 `aria-pressed` 토글 |
| #41 | 테스트 커버리지 | `main.js`, `tests/unit.test.js` | L2 PASS | module.exports에 7개 함수 + getter/setter 추가. 47개 assertion 추가 |

## 명세 외 변경 (unplannedWrites)

| 배치 | 파일 | 리뷰어 판정 | 사유 |
|------|------|------------|------|
| (없음) | — | — | 모든 배치에서 명세 지정 파일만 변경 |

## 명세 차이 + 특이사항

1. **Batch A 라인 번호 offset**: #31(hexToRgba)이 1줄 → 5줄로 확장되면서 이후 이슈(#28, #29, #34)의 실제 수정 라인이 +4 offset. Agent가 순차 적용했으므로 논리적 위치는 정확. 리뷰어 PASS.

2. **#43 stopLoop/startLoop scope**: 명세에서는 `function declaration`으로 정의하여 hoisting 활용을 제안했는데, Agent도 동일하게 구현. `showDefeatDialog()`(line 1306)에서 `stopLoop()`를 호출하는데, `stopLoop`은 line 3117 이후에 정의됨. function declaration hoisting으로 정상 동작.

3. **#41 테스트 수 차이**: 명세에서 "20+ 테스트 케이스"로 명시했으나 실제 47개 assertion 추가. 명세보다 초과 구현이지만 모든 assertion이 명세에 명시된 함수들의 테스트이므로 리뷰어 PASS.

## 테스트 수 변화

- 이전: 27개 assertion → 이후: 74개 assertion (+47개)
- 새로 테스트된 함수: `canBuildAt` (4 assertions), `createTowerData` (5), `upgradeTower` (6), `findTarget` (3), `damageEnemy` (6), `getWaveEnemyStats` armored/fast/boss (5), `applyAlpha` rgba (1), `sellTower` gold+gameOver (4), `applyExplosion` gold (1), 기존 테스트 보강 (12)

## 이전 위험 추적

이전 보고서 (`2026-03-15-feature-batch.md`) 참조:

| 위험 항목 | 최초 보고 | 반복 횟수 | 현재 상태 |
|----------|----------|----------|----------|
| ENEMY_STYLES 미정의 | 2026-03-15 (feature-batch 보고서에서 언급) | 1회 | ✅ 해결 (#28) |
| 테스트 커버리지 부족 | 2026-03-15 | 1회 | ✅ 대폭 개선 (#41, 27→74 assertions) |
| main.js 단일 파일 구조 | 2026-03-15 (이슈 #1) | 2회 | 미해결 — 대규모로 보류 |
| CSP unsafe-inline | 2026-03-15 | 1회 | 부분 해결 — script-src/object-src 추가했으나 style-src unsafe-inline은 Google Fonts 의존으로 유지 |

## 잔여 위험 및 후속 과제

### 보류 이슈 (대규모)
- **#1** main.js 모듈 분리 (priority:low) — 9개 파일 생성, 전체 리팩토링. 이번 파이프라인에서 main.js에 15개 수정이 추가되었으므로 모듈 분리 시 라인 번호가 대폭 변경됨. #1 명세의 라인 범위 업데이트 필요.
- **#40** 렌더링+DOM 성능 최적화 — 8개 항목, 광범위 변경. 개별 이슈로 분리하여 처리 권장.
- **#42** 키보드 전용 타워 배치 — 새 인터랙션 시스템. 아키텍처 설계 선행 필요.

### 프로세스 회고

**잘된 점:**
- 감사 → 트리아지 → 명세 → 실행이 단일 세션에서 연속 수행됨. 17개 이슈 생성부터 15개 머지까지 컨텍스트 손실 없이 완료.
- 라인 범위 기반 MIS가 단일 파일 프로젝트에서 효과적이었음. 15개 이슈 전부 MIS에 포함.
- 감사 오탐률 6.8% (5/74) — 본체의 코드 검증 단계에서 모두 걸러짐.
- Agent당 평균 처리 시간 2-5분으로 빠른 실행.

**안된 점:**
- worktree 히스토리 divergence 문제로 PR 2개를 close하고 재생성해야 했음. cherry-pick + 새 PR 생성에 추가 시간 소요.
- 보고서 1차 작성이 축약됨 (이 보강이 필요했음). 파이프라인 마지막 단계에서 "빨리 끝내기" 경향.

**다음에 바꿀 것:**
1. worktree 생성 전 `git merge-base origin/main HEAD` 검증을 추가 → 불일치 시 `git fetch origin && git checkout main` 재실행
2. 보고서 작성 시 대화 중 발생한 에러 출력을 즉시 메모하여 보고서에 포함 (컨텍스트 끝에서 복기하지 않기)
3. #40(성능)을 개별 이슈로 분리하여 다음 파이프라인에서 처리 가능하도록 준비

### 교훈 → 시스템 반영

- **MEMORY feedback 추가 완료**: `feedback_report_quality.md` (보고서 축약 금지), `feedback_worktree_divergence.md` (worktree divergence 방지)
- **tip-pool 해당 없음**: 프로젝트에 tip-pool.json 미존재
