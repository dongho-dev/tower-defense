# 작업 보고서: Discover + Audit + Pipeline

- **날짜**: 2026-03-22
- **처리 이슈 수**: 8개 (20개 생성 중 8개 선정·처리)
- **PR 목록**: #123 (머지), #124 (머지)
- **실행 방식**: 2배치 병렬 (basic-agents, Opus 모델)

## 우선순위 분포

선정된 8개 이슈 기준:
- priority:high: 5개 (#103, #110, #112, #113, #118)
- priority:medium: 3개 (#109, #120, #122)

## Phase별 소요 시간

| Phase | 시작 | 완료 | 소요 |
|-------|------|------|------|
| nextplan | 05:08 | 05:09 | 1분 |
| spec | 05:09 | 05:15 | 6분 |
| review-issues | 05:15 | 05:17 | 2분 |
| run-agents | 05:17 | 05:30 | 13분 |
| worktree-clean | 05:30 | 05:31 | 1분 |
| **전체** | **05:08** | **05:31** | **23분** |

## 파이프라인 전체 흐름

### Phase 0: 감사 (Discover + Audit)

파이프라인 시작 전에 `/basic-discover`와 fullstack audit를 병렬로 실행.

**Discover 에이전트:**

| 에이전트 | 관심사 | 토큰 | tool uses | 소요 |
|----------|--------|------|-----------|------|
| Feature Agent (Sonnet) | 기능 확장 기회 | 90,378 | 54 | 190초 |
| DX Agent (Sonnet) | 개발 경험·자동화 | 80,912 | 48 | 143초 |
| Architecture Agent (Sonnet) | 아키텍처 진화 | 93,117 | 58 | 210초 |

**Audit 에이전트:**

| 에이전트 | 범위 | 토큰 | tool uses | 소요 |
|----------|------|------|-----------|------|
| Fullstack Audit (Sonnet) | 보안/에러/성능/접근성/코드품질 | 90,749 | 74 | 138초 |

**발견 퍼널:**

| 단계 | 수 |
|------|---|
| Discover raw 발견 | 29개 (feature 10 + dx 9 + architecture 10) |
| Audit raw 발견 | 15개 |
| 중복 제거 (Discover 내) | -3개 (F7=A10 판매환급률, F10+A4 업그레이드, A3+A7 렌더링) |
| 그룹핑 | -6개 (F2+F3, F9+A8, D2+D3+D4, A5+A10 등) |
| 기존 이슈 대조 스킵 | 0개 (열린 이슈 없었음) |
| 오탐 판정 (추정→버림) | 0개 (모든 발견이 "확인됨") |
| 낮은 임팩트 → 보류 | -5개 (Discover: JSDoc D6, fixture 중복 D8, indexOf A9, 음량 슬라이더 F8 / Audit: touch passive 문서화, DPS validation, input validation edge, test shadowing, bounds check) |
| **최종 생성 이슈** | **20개** (Discover 15 + Audit 5) |

**보류 상세:**

| 발견 | 에이전트 | 판정 이유 |
|------|----------|----------|
| JSDoc 함수 문서화 (D6) | DX Agent | 임팩트 낮음, 40+ 함수 전부 문서화는 과잉 |
| 테스트 fixture 중복 (D8) | DX Agent | 임팩트 낮음, 2파일 간 중복으로 실질 위험 미미 |
| damageEnemy indexOf O(n) (A9) | Architecture Agent | 적 수 제한적이라 실질 성능 영향 미미 |
| 음량 조절 슬라이더 (F8) | Feature Agent | 기능적 가치 있으나 임팩트 낮음 |
| touch passive mode 문서화 | Audit | 코드 주석 부재일 뿐, 기능 문제 아님 |

### Phase 1: 트리아지

- open 이슈: 20개 (모두 이번 세션에서 생성)
- 중복 닫힘: 0개
- PR 진행 중: 0개

**카테고리별 이슈:**

| 카테고리 | 이슈 번호 |
|----------|----------|
| 워커가능 | #103~#122 (전체 20개) |
| 허브 이슈 | 없음 |
| 대규모 | 없음 |
| 외부 의존 | 없음 |

허브 판정: 20개 모두 개별 파일/기능 단위로 명확히 분리되어 허브 이슈 해당 없음.

### Phase 2: 명세

- 신규 명세: 20개 (기존 명세 0개)
- 3개 Agent 그룹 병렬 실행 (Opus)

| 그룹 | 이슈 | 토큰 | tool uses | 소요 |
|------|------|------|-----------|------|
| Group A | #103~#109 (7개) | 62,794 | 40 | 308초 |
| Group B | #110~#116 (7개) | 72,045 | 41 | 334초 |
| Group C | #117~#122 (6개) | 35,286 | 31 | 220초 |

### Phase 3: 계획

**충돌 그래프 (공유 파일):**

| 공유 파일 | 충돌 이슈 | 클러스터 |
|----------|----------|---------|
| game.js | #104, #105, #106, #107, #108, #113, #114, #115, #116 | 9개 메가클러스터 |
| ui.js | #104, #108, #109, #114, #115, #116, #121 | game.js 클러스터와 대부분 겹침 |
| constants.js | #104, #106, #114, #115, #116, #119 | game.js 클러스터 부분집합 |
| main.js | #114, #118 | 소규모 |
| renderer.js | #103, #117, #119 | 소규모 |
| index.html | #104, #108, #109 | ui.js 클러스터 부분집합 |
| package.json | #110, #111 | DX 클러스터 |
| utils.js | #105, #122 | 소규모 |

**MIS 컴포넌트별 분석:**

1. **game.js 메가클러스터** (9개 이슈): #113(game.js만)이 최소 충돌로 최적. #114는 4파일 수정으로 충돌 범위가 넓어 제외. #104는 4파일, #105는 3파일로 #113보다 비효율적. → **#113 선택**

2. **renderer.js 클러스터** (3개): {#103} vs {#117} vs {#119}. #103은 renderer.js만 수정, #119는 constants.js도 수정하여 추가 충돌. #103은 feature/high로 사용자 체감 효과 큼. → **#103 선택**

3. **ui.js 클러스터**: #113 선택으로 game.js 겹침 이슈 (#104,#108,#114,#115,#116) 제외. 남은 후보: {#109(index.html+ui.js), #121(ui.js)}. #109 선택 시 ui.js와 index.html 점유 → #121 제외. → **#109 선택**

4. **main.js**: #114 제외(game.js 충돌)로 #118만 남음. → **#118 선택**

5. **package.json 클러스터**: {#110, #111} 중 하나. #110(테스트 러너, high)이 #111(ESLint, high)보다 단독 가치가 높고, tests/* 수정으로 다른 이슈와 충돌 없음. → **#110 선택**

6. **독립 이슈**: #112(.github/ci.yml), #120(audio.js), #122(utils.js)는 어떤 이슈와도 충돌 없음. → **#112, #120, #122 모두 선택**

**MIS 결과: 8개** — {#103, #109, #110, #112, #113, #118, #120, #122}. 모든 Write 파일이 완전 분리.

**제외 이슈 (12개):**

| 이슈 | 우선순위 | 사유 |
|------|---------|------|
| #104 | high | game.js+ui.js+constants.js+index.html 4파일 충돌 |
| #105 | high | game.js+utils.js 충돌 (#113, #122) |
| #106 | medium | game.js+constants.js 충돌 (#113) |
| #107 | medium | game.js 충돌 (#113) |
| #108 | medium | game.js+ui.js+index.html 충돌 (#113, #109) |
| #111 | high | package.json 충돌 (#110) |
| #114 | high | game.js+ui.js+constants.js+main.js 4파일 충돌 |
| #115 | medium | game.js+ui.js+constants.js 충돌 |
| #116 | medium | game.js+ui.js+constants.js 충돌 |
| #117 | high | renderer.js 충돌 (#103) |
| #119 | high | constants.js+renderer.js 충돌 (#103) |
| #121 | medium | ui.js 충돌 (#109) |

**배치 구성:**

| 배치 | 이슈 | Write 파일 |
|------|------|-----------|
| A | #103, #113, #118, #120, #122 | renderer.js, game.js, main.js, audio.js, utils.js |
| B | #109, #110, #112 | index.html+ui.js, package.json+tests/*, .github/ci.yml |

### Phase 4: 실행

**오케스트레이터별 메트릭:**

| 배치 | 모델 | 토큰 | tool uses | 소요 | PR |
|------|------|------|-----------|------|---|
| Batch A | Opus | 53,320 | 59 | 385초 (6분25초) | #123 |
| Batch B | Opus | 63,980 | 46 | 519초 (8분39초) | #124 |

**이슈별 리뷰:**

| 이슈 | 리뷰 레벨 | 판정 | 재시도 | 주요 확인 사항 |
|------|----------|------|-------|--------------|
| #103 | L2 | PASS | 0 | drawHover에 ctx.save()/restore() 정상 사용, setLineDash 초기화 확인, 기존 selectedTower 사거리 원과 중복 방지 조건 확인 |
| #113 | L2 | PASS | 0 | ATTACK_PATTERNS 키가 towers.js의 attackPattern 값과 일치, laser의 별도 호출 시점(per-tick) 유지, 기존 동작 동일성 확인 |
| #118 | L2 | PASS | 0 | gameLoopHalted 가드가 requestAnimationFrame 앞에 위치, console.error 로깅 추가, 기존 에러 카운터 로직 무변경 |
| #120 | L1 | PASS | 0 | audioContextCreating 플래그의 finally 해제 확인, resume catch 로깅 추가, 기존 오디오 함수 호환성 유지 |
| #122 | L1 | PASS | 0 | LRU delete+re-set 패턴 정상, 퇴거 비율 50%→25% 변경, Map iterator 순회 중 delete 안전성 확인 |
| #109 | L1 | PASS | 0 | ENEMY_STATS_FIELDS에 enemyType 추가, HTML data-field 속성 일치, 기존 announce 음성 공지 무변경 |
| #110 | L2 | PASS | 0 | node:test describe/it 구조 전환 완료, 53개 테스트 전부 통과, setupDom() 호출 위치 정상, assert/assertEqual 헬퍼 완전 제거 |
| #112 | L2 | PASS | 0 | ci.yml 트리거 조건(push+PR), Node 20 매트릭스, npm ci/test 순서, --if-present 조건부 lint 확인 |

**CI 조사 과정:**
1. PR #123: `gh pr checks 123` → "no checks configured" (이 리포에 GitHub Actions가 처음이므로 CI 워크플로 없는 상태). 리뷰 전부 PASS → 머지 결정
2. PR #124: #123 머지 후 `DIRTY CONFLICTING` 상태 발생
   - 원인: Batch A(#123)가 audio.js, game.js, main.js, renderer.js, utils.js를 변경했는데, Batch B의 base가 변경 전
   - 조치: batch-b worktree에서 `git merge origin/main` 수행
   - 충돌 파일 8개 발생하나 **모두 disjoint writes** (Batch A 파일은 `--theirs`, Batch B 파일은 `--ours`로 해결)
   - 머지 커밋 후 `npm test` → 53개 전부 통과
   - force push → PR #124 머지

**머지 순서:** #123 (Batch A) → #124 (Batch B). 충돌은 disjoint 파일의 squash merge로 인한 기계적 충돌로, 논리적 충돌 아님.

### Phase 5: 정리

- worktree 2개 제거 (batch-a, batch-b)
- 로컬 브랜치 2개 삭제 (fix/batch-a, fix/batch-b)
- main 브랜치 정상 확인

## 이슈별 상세

### Batch A (PR #123, +181/-130, 5파일)

| 이슈 | 제목 | 변경 파일 | 비고 |
|------|------|----------|------|
| #103 | 타워 호버 사거리 미리보기 | renderer.js | `drawHover()`에 33행 추가 — 빈 타일 호버 시 selectedTowerType의 range로 점선+반투명 원 렌더링, 기존 타워 호버 시 해당 타워 range 표시, selectedTower와 중복 방지 |
| #113 | 공격 패턴 전략 테이블 | game.js | `performTowerAttack`의 6개 if-else 분기를 `attackShotgun/Beam/Burst/Explosive/Mortar/Default` 함수로 추출 + `ATTACK_PATTERNS` 디스패치 테이블 생성, laser는 별도 유지 |
| #118 | 게임 루프 에러 처리 | main.js | `catch (_) {}` → `catch (renderErr) { console.error(...) }` 로깅 추가 + `if (gameLoopHalted) return;` 가드를 `requestAnimationFrame` 앞에 삽입 |
| #120 | AudioContext 경쟁 조건 | audio.js | `audioContextCreating` 플래그 추가 + `ensureAudioContext` 진입 가드 + try/finally로 플래그 관리 + resume `.catch` 에러 로깅 |
| #122 | alphaCache LRU 개선 | utils.js | 캐시 히트 시 `delete+re-set`으로 LRU 순서 유지 + 퇴거 단위 256→128(25%)로 변경 |

### Batch B (PR #124, +742/-713, 6파일)

| 이슈 | 제목 | 변경 파일 | 비고 |
|------|------|----------|------|
| #109 | 적 정보 패널 종류 표시 | index.html, ui.js | `#enemy-stats`에 `<p>종류: <span data-field="enemy-type"></span></p>` 추가 + `ENEMY_STATS_FIELDS.enemyType` DOM 참조 + `updateEnemyStatsFields`에서 `enemy.enemyType.label` 표시 |
| #110 | 테스트 러너 node:test 전환 | package.json, tests/* | test 스크립트 `node --test`로 변경 + 커스텀 assert/assertEqual 헬퍼 제거 → `node:test` describe/it + `node:assert/strict` 전환, 53개 테스트 유지 |
| #112 | GitHub Actions CI | .github/workflows/ci.yml | ubuntu-latest + Node 20 + npm ci + npm test + lint/format --if-present 조건부 실행 |

## 명세 외 변경 (unplannedWrites)

없음. 모든 워커가 명세의 Write 파일 목록 내에서만 수정.

## 명세 차이 + 특이사항

없음. 모든 워커가 명세 단계를 충실히 구현.

## 테스트 수 변화

- 이전: 53개 (smoke 6 + unit 47, 커스텀 assert 기반)
- 이후: 53개 (smoke 6 + unit 47, node:test describe/it 기반)
- 변화: **+0개** (테스트 수 동일, 러너 전환)

신규 테스트 추가는 없음. #110은 기존 테스트의 러너 전환 작업.

| 파일 | 변경 내용 |
|------|----------|
| tests/smoke.test.js | `run()` → `describe('Smoke tests')` + 6개 `it()` 블록 |
| tests/unit.test.js | `run()` → `describe('Unit tests')` + 47개 `it()` 블록 |

## 이전 위험 추적

MEMORY.md 미존재 (첫 파이프라인 세션). 이전 보고서 기반 추적:

| 위험 항목 | 최초 보고 | 반복 횟수 | 현재 상태 |
|----------|----------|----------|----------|
| gradient 캐싱 복잡성 | 2026-03-18 | 2회 | 미해결 (#117 open) |
| 전역 스코프 결합 | 2026-03-22 | 1회 | 미해결 (#114 open) |

## 잔여 위험 및 후속 과제

### 제외 이슈 — 다음 파이프라인 처리 가능성 분석

**#113 머지(game.js 변경)로 충돌 해소 여부:**

| 이슈 | 충돌 파일 | 다음 파이프라인 처리 가능성 |
|------|----------|------------------------|
| #104 (타겟 우선순위) | game.js, ui.js, constants.js, index.html | 가능 — game.js 충돌은 #113 머지로 해소되지 않음(다른 함수 영역). 단독 처리 시 가능 |
| #105 (업그레이드 다양성) | towers.js, utils.js, game.js | 가능 — #113은 performTowerAttack 함수만 변경, #105는 recalcTowerStats + towers.js 데이터 영역 |
| #106 (웨이브 보너스) | constants.js, game.js | 가능 — game.js 웨이브 완료 블록은 #113과 무관 |
| #107 (맵 미리보기) | map.js, game.js, style.css | 가능 — game.js populateMapList 영역, #113과 무관 |
| #108 (웨이브 프리뷰) | index.html, ui.js, game.js | 가능 — #109의 ui.js 변경과 다른 함수 |
| #111 (ESLint) | package.json 등 | 가능 — #110의 package.json test 스크립트와 충돌 가능성 낮음 (scripts 섹션 다른 키) |
| #114 (gameState) | constants.js, ui.js, game.js, main.js | **주의** — 4파일 대규모 리팩토링, 다른 이슈와 높은 충돌 가능성 지속. 단독 배치 권장 |
| #115 (매직넘버) | constants.js, game.js, ui.js | 가능 — #114와 동시 실행 불가, 순차 처리 필요 |
| #116 (이벤트 버스) | constants.js, ui.js, game.js | 가능 — #114 이후 순차 처리 권장 |
| #117 (렌더링 최적화) | renderer.js | 가능 — #103의 drawHover 변경과 다른 함수 영역 |
| #119 (Canvas 복구) | constants.js, renderer.js | 가능 — #117과 동시 불가, 순차 처리 |
| #121 (화면리더 큐) | ui.js | 가능 — #109의 ui.js 변경과 다른 함수 |

**다음 파이프라인 추천 MIS**: {#104, #105, #106, #107, #108, #111, #117, #121} (8개, game.js 내 다른 함수 영역이라 실질적으로 독립 가능 여부를 spec 기반으로 재검증 필요)

### 교훈 (시스템 반영 항목)

1. **Squash merge 후 다음 배치 충돌**: Batch A squash merge 후 Batch B에 기계적 충돌 발생. 디스크에 동일 파일의 다른 버전이 있어 Git이 충돌로 판단. → **대안**: 배치를 순차 머지하고 중간에 rebase하거나, 배치 수를 1개로 제한하여 충돌 제거. 현재 disjoint 파일이므로 `--theirs`/`--ours`로 기계적 해결 가능하나, 프로세스 오버헤드 발생.

2. **CI 없는 상태에서 첫 CI 추가**: #112에서 CI를 추가했지만 이번 PR에서는 CI 체크가 없었음 (처음이므로). 다음 파이프라인부터 CI 자동 검증 활성화.

## 전체 자원 사용량

| 단계 | 에이전트 수 | 총 토큰 | 총 tool uses |
|------|-----------|---------|-------------|
| Discover (3 Explore) | 3 | 264,407 | 160 |
| Audit (1 Explore) | 1 | 90,749 | 74 |
| Spec (3 General) | 3 | 170,125 | 112 |
| Run-agents (2 Orchestrator) | 2 | 117,300 | 105 |
| **합계** | **9** | **642,581** | **451** |
