# 작업 보고서: Batch A — 데이터 정확성 + 방어 코딩 + DOM 성능

- **날짜**: 2026-03-18
- **파이프라인**: pipeline-2026-03-18-163
- **처리 이슈 수**: 4개 (#70, #72, spec-15, spec-21 잔여)
- **PR 목록**: #85, #86 (전부 머지)
- **실행 방식**: 직접 처리 (이슈 3개 이하 판정)

## 우선순위 분포

- priority:high: 0개
- priority:medium: 2개 (#70 bug, #72 refactor)
- priority:low: 0개
- 라벨 없음: 2개 (spec-15, spec-21 잔여 — proposal 기반, GitHub 이슈 미등록)

## Phase별 소요 시간

pipeline-state.json 타임스탬프 기준 (UTC):

| Phase | 시작 | 완료 | 소요 |
|-------|------|------|------|
| nextplan | 12:30 | 12:30 | <1분 |
| spec | 12:30 | 12:30 | <1분 |
| review-issues | 12:30 | 12:31 | <1분 |
| run-agents (직접 처리) | 12:31 | 12:39 | 8분 |
| worktree-clean | 12:39 | 12:40 | <1분 |
| **전체** | **12:30** | **12:40** | **~10분** |

## 파이프라인 전체 흐름

### Phase 0: 감사

스킵. 이전 파이프라인(2026-03-15)의 감사 결과 + 잔여 이슈를 기반으로 작업 범위가 이미 확정되어 있었음.

### Phase 1: 트리아지

open 이슈 5개 확인:

| 카테고리 | 이슈 | 비고 |
|----------|------|------|
| 워커가능 | #72, spec-15, spec-21 잔여 | 이번 파이프라인 선정 |
| PR 진행중 | #70 | PR #85로 별도 처리 (파이프라인 시작 전 수정 완료) |
| 대규모 | #1 | main.js 모듈 분리 — 전체 구조 변경 필요 |
| 다음 파이프라인 | #79, #42 | 코드 중복 정리, 키보드 접근성 |

**사전 작업**: 파이프라인 시작 전에 #70(startLoop 우회)을 PR #85로 수정 완료 → 파이프라인에서는 #72 + spec-15 + spec-21 잔여에 집중.

### Phase 2: 명세

3개 모두 기존 명세 존재 → 신규 명세 작성 0개.

| 이슈 | 명세 위치 | 상태 |
|------|----------|------|
| #72 | GitHub 이슈 본문 | 기존 |
| spec-15 | proposals/spec-15.md | 기존 |
| spec-21 | proposals/spec-21.md | 기존 (5개 중 2개만 미구현) |

**주요 발견**: spec-12~14, 16, 17, 20, 22는 이전 파이프라인(2026-03-15 batch-a/b/c)에서 이미 구현되었으나 proposal 파일만 남아있었음. 이번에 정리 삭제.

### Phase 3: 계획

**충돌 분석**:

| 공유 파일 | 관련 이슈 | 수정 위치 |
|----------|----------|----------|
| main.js | #72 | 타워 정의(55~424), populateTowerList(949~951), getTowerColor(780), spawnEnemy(1620), drawEnemies(2592) |
| main.js | spec-15 | updateEnemyStatsFields(1196~1199) |
| main.js | spec-21 잔여 | updateTowerStatsFields(1145~1210), updateEnemyStatsFields(1196~1229) |

모두 main.js 수정이지만 **수정 위치가 비중복** → 1배치 직접 처리.

**MIS 분석**: 3개 이슈 모두 독립적 수정 위치 → MIS = 전체 3개.
- 옵션 A: 3개 모두 선정 → 충돌 없음 ✅
- 옵션 B: #72만 선정 → spec-15/spec-21이 작은 변경이라 분리 이점 없음
- **선택: 옵션 A** (전부 선정, 1 PR로 묶음)

**제외 이슈**:

| 이슈 | 우선순위 | 사유 |
|------|---------|------|
| #79 | medium | 이번 #72 변경이 enemyType 통합으로 #79의 일부 수정 범위와 겹침 → 다음 파이프라인에서 최신 코드 기반 처리가 안전 |
| #42 | medium | 새 기능(키보드 접근성) → 안정화 작업 이후 처리가 적절 |
| #1 | low | 대규모 리팩토링 → 별도 설계 세션 필요 |

### Phase 4: 실행 (직접 처리)

**PR #85 — #70 startLoop 우회 제거**:
- 파이프라인 시작 전에 수정 완료, 파이프라인에서 머지
- 변경: `main.js:3410` — `rafHandle = requestAnimationFrame(loop)` 1줄 삭제
- CI: 없음 (GitHub Actions 미설정, 로컬 npm test 통과)

**PR #86 — #72 + spec-15 + spec-21 잔여**:
- 변경: main.js 48삽입/43삭제
- CI: 없음 (로컬 npm test 통과)

**리뷰 상세**:

| 이슈 | 리뷰 레벨 | 판정 | 재시도 | 주요 확인 사항 |
|------|----------|------|--------|--------------|
| #70 | L1 | PASS | 0 | startLoop/Escape/Retry 핸들러가 이미 startLoop()을 호출 → 동작 변화 없음 확인 |
| #72 laser DPS | L1 | PASS | 0 | `5.5 * 1.15 = 6.325` → 빌드패널 표시 정확성, 정보패널과 일치 확인 |
| #72 levelColors | L1 | PASS | 0 | darkenHex 보간이 `Math.max(0.25, 1 - steps*0.08)` → 레벨 15에서 factor=0.39, 시각적으로 충분히 어두운 색상 |
| #72 enemyType 통합 | L1 | PASS | 0 | 4곳 참조 모두 변경, 테스트에서 미참조 확인 |
| spec-15 | L1 | PASS | 0 | `enemies.includes()` O(N) 성능 → 적 수백 수준에서 무시 가능 확인 |
| spec-21 dirty flags | L1 | PASS | 0 | `setTextIfChanged` 헬퍼가 null 가드 포함 → 기존 if(field) 체크와 동일 안전성 |

**CI 조사**: GitHub Actions 미설정 → 로컬 `npm test`(smoke + unit) 통과로 검증. `Failed to get offscreen 2D context`는 jsdom 환경 제한으로 pre-existing.

**머지 순서**: PR #85 → PR #86 (순차, #86은 #85 머지 후 main에서 브랜치 생성)

### Phase 5: 정리

- worktree: 메인 1개만 존재 (직접 처리 경로라 별도 worktree 미사용)
- 리모트 브랜치: `--delete-branch`로 머지 시 자동 삭제
- proposal 파일: spec-12~17, 20~22 전부 삭제 (구현 완료)

## 이슈별 상세

| 이슈 | 제목 | 변경 파일 | 비고 |
|------|------|----------|------|
| #70 | startLoop() 우회 제거 | main.js | 초기화 코드에서 `rafHandle = requestAnimationFrame(loop)` 직접 호출 1줄 삭제 → 맵 선택 중 불필요한 루프 방지 |
| #72-a | laser DPS 빌드패널 | main.js | `baseDamage / fireDelay`(=55) → `baseDamage * sustainMultiplier`(=6.3) 조건 분기 추가 |
| #72-b | levelColors 15레벨 | main.js | `darkenHex` + `getColorFromArray` 헬퍼로 배열 범위 초과 시 자동 보간 (마지막 색상을 단계적으로 어둡게) |
| #72-c | style/enemyType 통합 | main.js | `spawnEnemy`에서 `style: enemyType` 제거, `enemy.style` 참조 4곳을 `enemy.enemyType`으로 변경 |
| spec-15 | 적 상태 추적 방어 | main.js | `updateEnemyStatsFields` 진입부에 `enemies.includes(selectedEnemy)` 가드 → 배열에서 제거된 적의 stale 데이터 표시 방지 |
| spec-21 | DOM dirty flags | main.js | `setTextIfChanged(el, text)` 헬퍼 추가, `updateTowerStatsFields`(8곳) + `updateEnemyStatsFields`(4곳)에 적용 → 값 미변경 시 DOM 쓰기 스킵 |

## 명세 외 변경 (unplannedWrites)

없음. 모든 변경이 명세 범위 내.

## 명세 차이 + 특이사항

| 이슈 | 차이 | 리뷰어 판정 |
|------|------|-----------|
| #72-b | 명세는 "levelColors 배열에 색상 추가"를 제안했으나, 실제 구현은 `darkenHex` 프로그래밍 보간으로 대체 | PASS — 하드코딩 128개 색상값 대비 유지보수성 우수, 임의의 TOWER_MAX_LEVEL에도 대응 가능 |
| spec-21 | resize debounce가 명세에 포함되었으나 이미 구현되어 있어 스킵 | 해당 없음 — 코드 확인으로 중복 방지 |

## 테스트 수 변화

- 이전: smoke 1개 + unit 1개 파일
- 이후: 동일 (변경 없음)
- 신규 테스트: 0개

테스트 추가 없이 기존 테스트 통과를 검증. 이번 변경은 모두 기존 동작 보존(리팩토링/방어코드) 성격이므로 별도 테스트 추가 불필요로 판단.

## 이전 위험 추적

| 위험 항목 | 최초 보고 | 반복 횟수 | 현재 상태 |
|----------|----------|----------|----------|
| worktree divergence | 2026-03-15 | 1 | 해당 없음 (이번 파이프라인에서 worktree 미사용) |
| 보고서 축약 | 2026-03-15 | 2 | ⚠️ 주의 유지 — 이번 보고서에서 상세 기술 |

## 잔여 위험 및 후속 과제

### 잔여 open 이슈 (3개)

| 이슈 | 우선순위 | 다음 파이프라인 처리 가능성 |
|------|---------|-------------------------|
| #79 | medium | ✅ 높음. 이번 머지로 `enemy.style` 참조가 사라져 #79의 "damageEnemy 래퍼" 정리 시 `style` 폴백 코드 제거 불필요. drawGrid 매개변수화는 독립적으로 진행 가능. |
| #42 | medium | ✅ 높음. 기존 코드 안정화 완료 → 키보드 접근성 추가에 집중 가능. main.js만 수정. |
| #1 | low | ❌ 별도 계획 필요. 3400줄 단일 파일 분리는 모든 이슈와 충돌 가능. #79, #42 처리 후 진행 권장. |

### 프로세스 교훈

1. **proposal 정리 자동화 필요**: 이전 파이프라인에서 구현된 7개 spec(12~14, 16, 17, 20, 22)의 proposal 파일이 삭제되지 않아 이번에 수동 정리. → 파이프라인 Phase 5에서 `proposals/` 디렉토리의 구현 완료 spec 자동 삭제 루틴 추가 권장.
2. **spec 구현 여부 사전 검증**: 이번 파이프라인에서 spec-12~14를 "미구현"으로 가정하고 시작했으나 코드 확인 후 전부 이미 구현 → Phase 1에서 proposal 파일 대상 코드 검증 단계를 추가하면 시간 절약.

## 전체 자원 사용량

| 단계 | 에이전트 수 | 총 토큰 | 총 tool uses |
|------|-----------|---------|-------------|
| 사전 조사 (Explore) | 1 | ~35,600 | 17 |
| spec 검증 (Explore) | 1 | ~55,600 | 34 |
| 직접 구현 + 리뷰 | 0 (본체) | — | ~30 |
| **합계** | **2 서브에이전트** | **~91,200** | **~81** |

파이프라인 전체 소요: 약 10분 (12:30~12:40 UTC).
