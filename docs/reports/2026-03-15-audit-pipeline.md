# 작업 보고서: 풀스택 감사 + 파이프라인 실행

날짜: 2026-03-15
처리 이슈: 15개 (17개 감사 발견 중 15개 워커가능)
PR: #47 (Batch C), #48 (Batch A), #49 (Batch B)
실행 방식: `/basic-audit-fullstack` → `/basic-pipeline` (자동 모드)

## 우선순위 분포

- priority:high: 3개 (#28, #29, #41)
- priority:medium: 7개 (#30, #31, #32, #36, #38, #39, #44)
- priority:low: 5개 (#33, #34, #35, #37, #43)

## Phase별 소요 시간

| Phase | 내용 | 비고 |
|-------|------|------|
| audit | `/basic-audit-fullstack` 6개 Explore Agent 병렬 | 74개 발견 → 17개 이슈 생성, 5개 오탐 |
| nextplan | 18개 open → 15개 워커가능, 3개 대규모 제외 | 중복 0개 |
| spec | 15개 이슈 명세 작성 (2그룹 Opus Agent 병렬) | - |
| review-issues | MIS 15개, 3배치 구성 | main.js 공유 파일이나 라인 범위 분리 |
| run-agents | 3개 Opus Agent 병렬 | Batch A 2.5분, B 2.3분, C 4.9분 |
| worktree-clean | 3 worktree + 5 branch 정리 | - |

## 파이프라인 전체 흐름

### 감사 (audit)

6개 Explore Agent (Sonnet) 병렬로 코드베이스 탐색:
- B1: 보안 + 입력 검증 → 7개 발견
- B2: 에러 핸들링 + API 일관성 → 15개 발견
- B3: 테스트 커버리지 + 데이터 무결성 → 11개 발견 (B2-3과 1건 중복)
- F1: 클라이언트 보안 → 7개 발견 (B1-1과 부분 중복)
- F2: UX 일관성 + 접근성 → 20개 발견
- F3: 성능 + 코드 품질 → 20개 발견

**오탐 판정 (5건):**
- gameOver 좌클릭 빌드 (B2-6): `paused=true` 유지 + Space unpause gameOver guard로 실질 불가
- text-muted 대비비 (F2-17): #a9b4c4 vs ~#161e29 → ~7.6:1로 WCAG 4.5:1 통과
- innerHTML='' (B1-5, F1-7): 빈 문자열만 할당, XSS 아님
- wave fractional (B1-6): setWave() 내부 Math.floor()로 처리됨
- touchstart touches[0] (B2-11): touchstart는 항상 최소 1개 터치 포함

### Phase 1 (nextplan)

18개 open 이슈:
- 워커가능 15개: #28-39, #41, #43, #44
- 대규모 제외 3개: #1 (모듈 분리), #40 (성능 최적화 8항목), #42 (키보드 시스템)

### Phase 2 (spec)

15개 이슈를 2그룹 Opus Agent로 병렬 명세 작성:
- Group A (8개): #28-35
- Group B (7개): #36-44

### Phase 3 (review-issues)

MIS 분석: 모든 15개 이슈가 main.js의 서로 다른 라인 범위를 수정하여 충돌 없음.

| 배치 | 이슈 | 변경 라인 범위 |
|------|------|--------------|
| A | #28, #29, #31, #32, #34 | 763, 1135, 1461-1468, 1801, 2758 |
| B | #30, #33, #35, #43, #44 | index.html + 601, 725, 868, 1058, 3114-3129 |
| C | #36, #37, #38, #39, #41 | style.css + index.html + 1337-1379, 3132 + tests |

### Phase 4 (run-agents)

3개 Opus Agent 백그라운드 병렬 실행. 모든 배치 성공.

**문제 발생:** Batch A, B의 worktree 브랜치가 origin/main과 diverged history를 가짐 (PR CONFLICTING).
**해결:** Batch C(#47) 먼저 머지 → cherry-pick으로 A, B 재생성(#48, #49) → 순차 머지.
**원인 추정:** worktree 생성 시 로컬 git 히스토리의 squash-merge 이전 커밋이 혼입.

### Phase 5 (worktree-clean)

- 3 worktree 제거: batch-a, batch-b, batch-c
- 5 로컬 브랜치 삭제: fix/batch-a, fix/batch-b, fix/batch-c, fix/batch-a-v2, fix/batch-b-v2

## 이슈별 상세

### Batch A (PR #48) — main.js 버그 수정

| 이슈 | 제목 | 변경 | 리뷰 |
|------|------|------|------|
| #28 | ENEMY_STYLES 미정의 참조 | `ENEMY_STYLES[0]` → `ENEMY_TYPE_DEFINITIONS[0]` | L2 PASS |
| #29 | pickEnemyType undefined | 3개 find()에 `\|\| ENEMY_TYPE_DEFINITIONS[0]` 폴백 | L2 PASS |
| #31 | hexToRgba 8자리 hex | length>6 시 substring(0,6) 분기 추가 | L1 PASS |
| #32 | 캔버스 한글 폰트 | `"48px 'Noto Sans KR', 'Malgun Gothic', 'Segoe UI', sans-serif"` | L1 PASS |
| #34 | 웨이브 상한 | `wave = Math.min(wave + 1, WAVE_MAX)` | L1 PASS |

### Batch B (PR #49) — 보안/정리

| 이슈 | 제목 | 변경 | 리뷰 |
|------|------|------|------|
| #30 | CSP 강화 | script-src, object-src, base-uri 추가 | L1 PASS |
| #33 | setWave 초기화 | selectedTowerType 리셋 2줄 제거 | L1 PASS |
| #35 | BOM 제거 | line 868 U+FEFF 삭제 | L1 PASS |
| #43 | RAF 핸들 | rafHandle 변수 + stopLoop/startLoop 함수 | L1 PASS |
| #44 | console.error | 3곳 e → e.message 변경 | L1 PASS |

### Batch C (PR #47) — CSS/접근성/테스트

| 이슈 | 제목 | 변경 | 리뷰 |
|------|------|------|------|
| #36 | 반응형 갭 | 960px 브레이크포인트에 canvas 반응형 추가 | L1 PASS |
| #37 | reduced-motion | prefers-reduced-motion 블록 + 터치타겟 44px | L1 PASS |
| #38 | 모달 Escape | 패배 오버레이 Escape + 맵선택 포커스 트랩 | L1 PASS |
| #39 | ARIA 시맨틱 | radiogroup→toolbar, aria-live 이동, map aria-pressed | L1 PASS |
| #41 | 테스트 커버리지 | 20+ 테스트 케이스 추가 | L2 PASS |

## 명세 외 변경 (unplannedWrites)

없음. 모든 배치에서 명세에 지정된 파일만 변경됨.

## 테스트 수 변화

- 이전: 27개 assertion → 이후: 74개 assertion (+47개)
- 새로 테스트된 함수: canBuildAt, createTowerData, upgradeTower, findTarget, damageEnemy, getWaveEnemyStats(armored/fast/boss), applyAlpha(rgba), sellTower(gold/gameOver), applyExplosion(gold)

## 이전 위험 추적

| 위험 항목 | 최초 보고 | 반복 횟수 | 현재 상태 |
|----------|----------|----------|----------|
| ENEMY_STYLES 미정의 | 2026-03-15 | 1회 | ✅ 해결 (#28) |
| 테스트 커버리지 부족 | 2026-03-15 | 1회 | ✅ 개선 (#41, 27→74) |

## 잔여 위험 및 후속 과제

### 보류 이슈 (대규모)
- **#1** main.js 모듈 분리 (priority:low) — 9개 파일 생성, 전체 리팩토링
- **#40** 렌더링+DOM 성능 최적화 — 8개 항목, 광범위 변경
- **#42** 키보드 전용 타워 배치 — 새 인터랙션 시스템

### 교훈
1. **worktree 히스토리 divergence**: squash-merge 이후 로컬 브랜치가 origin/main과 diverge 가능. worktree 생성 전 `git fetch && git reset --hard origin/main` 권장.
2. **단일 파일 프로젝트의 MIS**: main.js 2700+ 줄 단일 파일이므로 모든 이슈가 같은 파일을 수정. 라인 범위 기반 MIS가 효과적이었으나 cherry-pick 재생성이 필요한 경우 발생.
3. **감사 오탐률**: 74개 발견 중 5개 오탐 (6.8%). 본체의 코드 검증 단계가 오탐 필터링에 효과적.
