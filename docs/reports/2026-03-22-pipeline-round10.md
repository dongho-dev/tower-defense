# 작업 보고서: pipeline round 10 — discover + audit + 14이슈 병렬 실행

- **날짜**: 2026-03-22
- **처리 이슈 수**: 5개 머지 (14개 시도 중)
- **PR 목록**: #202 머지, #201/#203 충돌로 닫힘
- **실행 방식**: 3배치 병렬 (basic-agents)

## 우선순위 분포 (선정 14개)

- priority:high: 2개 (#194, #200) — 모두 Batch A에서 머지 완료
- priority:medium: 7개 (#185, #186, #192, #163, #197, #183, #198)
- priority:low: 5개 (#180, #182, #190, #191, #193)

## 파이프라인 전체 흐름

### 사전 작업: discover + audit

- discover: 3개 탐색 에이전트 → 14개 이슈 생성 (#180-#193)
- audit: 3개 감사 에이전트 → 7개 이슈 생성 (#194-#200)
- 총 21개 신규 이슈 + 기존 9개 = 30개 open

### Phase 1: 트리아지

30개 open, 전부 워커가능. priority 라벨 일괄 부여.

### Phase 2: 명세

21개 이슈에 명세 작성 (3그룹 × 7개 Opus 에이전트 병렬).

### Phase 3: 계획

**MIS = 14개** — 모듈 분리 효과로 이전 MIS 2에서 7배 증가.

파일 겹침 없는 14개 이슈:
- constants.js: #194
- game.js: #200
- audio.js+main.js: #185
- utils.js+combat.js: #186
- renderer.js: #192
- update.js: #163
- overlay.js: #197
- ui.js+style.css: #183
- index.html: #198
- 독립(test/config): #180, #182, #190, #191, #193

### Phase 4: 실행

3배치 병렬 실행:

| 배치 | 이슈 | 상태 | PR | 소요 |
|------|------|------|-----|------|
| Batch A | #194, #200, #185, #186, #192 | ✅ 머지 | #202 | 8분 |
| Batch B | #163, #197, #183, #198, #180 | ❌ 충돌 닫힘 | #201 | 7분 |
| Batch C | #182, #190, #191, #193 | ❌ 충돌 닫힘 | #203 | 10분 |

**충돌 원인**: Batch A 머지 후 Batch B/C의 PR이 main과 충돌. tests/unit.test.js, index.html, package.json 등 공유 파일에서 add/add 충돌 다수 발생. rebase 시도했으나 15커밋 skipping + 8파일 충돌로 중단.

**교훈**: 3배치 병렬 실행 시, 첫 배치 머지 후 나머지 배치는 rebase가 필요. 테스트 파일은 MIS에서 제외했지만 실제로는 충돌 원인이 됨.

### Phase 5: 정리

worktree 3개 제거, 브랜치 정리 완료.

## 이슈별 상세 (머지된 5개)

| 이슈 | 제목 | 변경 파일 | 비고 |
|------|------|----------|------|
| #194 | EventBus 프로토타입 방어 | constants.js | `_listeners: {}` → `Object.create(null)`로 교체하여 __proto__ 키 안전성 확보 |
| #200 | NaN 데미지 방어 | game.js | damageEnemyAtIndex 진입부에 `!Number.isFinite(amount) \|\| amount < 0` 가드 추가 |
| #185 | 뮤트 localStorage 저장 | audio.js, main.js | setSoundMuted에 td_mute 키 저장, main.js 초기화에서 복원 |
| #186 | 타워 컬러 캐싱 | utils.js, combat.js | recalcTowerStats에서 cachedProjectileColor/cachedTrailColor/cachedTowerColor 1회 계산, 모든 attack 함수에서 캐시 참조 |
| #192 | pulseSeed 맥동 애니메이션 | renderer.js | pulse = prefersReducedMotion ? 0.5 : Math.abs(Math.sin(time*2 + enemy.pulseSeed)) * 0.5 |

## 명세 외 변경 (unplannedWrites)

| 배치 | 수 | 내용 | 판정 |
|------|---|------|------|
| Batch A | 1 | game.js createTowerData에 recalcTowerStats 호출 추가 | 허용 — 색상 캐시 초기화 보장에 필수 |

## 테스트 수 변화

- 이전: 92개 → 이후: 97개 (+5개)
- #194: EventBus __proto__ 안전성 테스트
- #200: NaN/음수/Infinity amount 방어 테스트
- #185: 뮤트 localStorage 저장/복원 테스트
- #186: 타워 색상 캐시 존재 테스트
- #192: pulseSeed 존재 확인 테스트

## 잔여 위험 및 후속 과제

### 미머지 이슈 (9개, 다음 파이프라인에서 처리)

Batch B: #163, #197, #183, #198, #180 — 코드는 완성되었으나 PR 충돌로 닫힘. 명세 있으므로 다음 라운드에서 즉시 재구현 가능.

Batch C: #182, #190, #191, #193 — 테스트/DX 이슈, 마찬가지로 재구현 가능.

### 병렬 배치 충돌 방지 전략

1. **테스트 파일을 MIS 충돌 분석에 포함**: tests/unit.test.js가 여러 배치에서 수정될 경우 충돌 발생
2. **순차 머지 + rebase 파이프라인**: 배치 A 머지 → B rebase → B 머지 → C rebase → C 머지
3. **배치 수 제한**: 테스트 파일 수정이 포함된 배치는 최대 1개로 제한

## 전체 자원 사용량

| 단계 | 에이전트 수 | 비고 |
|------|-----------|------|
| discover | 3 (Sonnet) | 기능/DX/아키텍처 탐색 |
| audit | 3 (Sonnet) | 보안/UX/성능 감사 |
| spec | 3 (Opus) | 21개 이슈 명세 (7개씩) |
| run-agents | 3 (Opus) | 3배치 병렬 실행 |
| **합계** | **12 에이전트** | |
