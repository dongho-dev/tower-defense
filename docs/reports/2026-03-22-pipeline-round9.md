# 작업 보고서: pipeline round 9 — ARIA 개선 + findTarget 최적화 + game.js 모듈 분리

- **날짜**: 2026-03-22
- **처리 이슈 수**: 3개 (#149 모듈 분리 + #166 ARIA + #148 findTarget)
- **PR 목록**: #177 (모듈 분리), #178 (ARIA + findTarget) — 모두 머지 완료
- **실행 방식**: 직접 처리

## 우선순위 분포

- priority:medium: 2개 (#166, #148)
- priority:low: 1개 (#149)

## Phase별 소요 시간

| Phase | 시작 | 완료 | 소요 |
|-------|------|------|------|
| 모듈 분리 (#149) | 09:31 | 09:44 | 13분 |
| nextplan | 09:45 | 09:47 | 2분 |
| spec | 09:47 | 09:47 | 스킵 |
| review-issues | 09:47 | 09:47 | <1분 |
| run-agents | 09:47 | 09:54 | 7분 |
| worktree-clean | 09:54 | 09:54 | <1분 |
| **전체** | **09:31** | **09:54** | **23분** |

## 파이프라인 전체 흐름

### 모듈 분리 (파이프라인 전)

사용자 요청으로 game.js 모듈 분리를 파이프라인 전에 수행:

```
game.js (1097줄) → 3개 파일:
├── combat.js  (248줄) — 공격 패턴, 투사체, 레이저, performTowerAttack
├── overlay.js (188줄) — 패배/맵선택 다이얼로그, resetGame
└── game.js    (577줄) — 전투 코어, 타겟팅, 스폰, update 루프
```

PR #177로 머지, 이슈 #149 닫힘.

### Phase 1: 트리아지

- open 이슈: 11개 (모듈 분리 후)
- 중복/PR 진행 중: 0개

### Phase 3: 계획

#### 모듈 분리 후 MIS 재계산

파일 매핑을 수동 재매핑 (기존 명세는 game.js 기준 → 실제 함수 위치 기반으로 조정):

| 이슈 | 수정 파일 (분리 후) |
|------|-------------------|
| #166 | index.html, overlay.js, audio.js |
| #165 | overlay.js, ui.js |
| #163 | game.js |
| #148 | game.js |
| #167 | game.js, ui.js, style.css |
| #139 | index.html, ui.js, main.js, game.js, style.css |
| #137 | index.html, ui.js, game.js, style.css, audio.js |
| #135 | game.js, combat.js, ui.js, index.html |
| #150 | constants.js, game.js |
| #145 | ui.js, overlay.js, game.js, main.js |
| #142 | utils.js, game.js |

**분리 효과**: #165가 game.js에서 완전 분리 (overlay.js, ui.js만), #166도 game.js 미포함.

MIS = {#166, #148} (크기 2). 이전과 동일 크기지만 game.js 미포함 이슈(#165, #166)가 생겨 독립 후보 확대.

### Phase 4: 실행 (직접 처리)

#### #166 구현

1. index.html: 골드 stat-chip `aria-live="polite"`, 속도 버튼 `aria-pressed` 초기값, gold-adjust `aria-label`, 맵선택 `aria-labelledby="map-select-title"`, 패배 `aria-labelledby="defeat-title"`, map-list `role="radiogroup"`
2. overlay.js: 맵 카드 `aria-pressed` → `role="radio"` + `aria-checked`
3. audio.js: Web Audio 미지원 시 `updateSoundToggle()` 호출 추가

#### #148 구현

1. game.js: `buildSpatialGrid()` — 매 프레임 적 위치를 TILE_SIZE*3 단위 버킷에 분배
2. game.js: `getEnemiesInRange()` — 타워 좌표/사거리로 해당 버킷만 조회
3. game.js: `findTarget()` — 전체 enemies 대신 공간 파티션 결과 사용 (빈 그리드 시 fallback)
4. game.js: update() 루프에 `tower._cachedTarget` 유효성 검사 — HP>0 + 사거리 내 + enemies 포함 시 findTarget 스킵

#### 리뷰

| 이슈 | 리뷰 레벨 | 판정 | 주요 확인 사항 |
|------|----------|------|--------------|
| #166 | L1 | PASS | aria-labelledby와 h2 id 일치, radiogroup/radio 시맨틱 정합성, updateSoundToggle 호출 안전성(typeof 체크) |
| #148 | L2 | PASS | 공간 파티션 결과 index→enemies.indexOf 변환, 빈 그리드 fallback, cachedTarget HP/includes/range 3중 검증, 기존 findTarget 결과 동일성 |

#### CI

pre-push hook 92/92 pass, GitHub Actions pass. 기존 ARIA 테스트 1개 업데이트 (골드 aria-live null→polite).

### Phase 5: 정리

브랜치 정리 완료.

## 이슈별 상세

| 이슈 | 제목 | 변경 파일 | 비고 |
|------|------|----------|------|
| #149 | refactor: game.js 모듈 분리 | game.js, combat.js(신규), overlay.js(신규), index.html, eslint.config.mjs, tests/helpers.js | game.js 1097줄에서 오버레이(showDefeatDialog, resetGame 등)와 전투 패턴(attackShotgun~handleLaserAttack, spawnMuzzleFlash)을 각각 overlay.js, combat.js로 분리. game.js 577줄로 축소. |
| #166 | enhancement: ARIA 속성 일괄 개선 | index.html, overlay.js, audio.js, tests/unit.test.js | 골드 stat-chip에 `aria-live="polite"` 추가, 두 다이얼로그의 `aria-label`→`aria-labelledby` 전환, 맵 카드 `aria-pressed`→`role="radio"`+`aria-checked`, gold-adjust에 `aria-label` 추가, Web Audio 미지원 시 `updateSoundToggle()` 호출. |
| #148 | performance: findTarget() 최적화 | game.js, eslint.config.mjs | `buildSpatialGrid()`로 매 프레임 적을 TILE_SIZE*3 버킷에 분배, `getEnemiesInRange()`로 타워 범위 내 버킷만 조회. update() 루프에서 `tower._cachedTarget` 유효성 검사(HP>0, includes, rangeSq)로 findTarget 재호출 스킵. |

## 명세 외 변경 (unplannedWrites)

없음.

## 명세 차이 + 특이사항

- #148: 명세에서 `enemies.includes()` 사용을 언급했으나, O(n) 비용을 줄이기 위해 `enemy.hp > 0` 체크를 선행하여 죽은 적은 빠르게 걸러냄. includes는 HP 체크 통과 시에만 호출.
- #148: 공간 파티션 도입으로 findTarget 내 `chosenIndex`가 candidates 인덱스가 됨 → `enemies.indexOf(chosen)`으로 실제 인덱스 조회.

## 테스트 수 변화

- 이전: 92개 → 이후: 92개 (+0/-0, 1개 수정)
- 수정: `#75: 골드 stat-chip aria-live` — null 기대 → 'polite' 기대로 변경 (#166 반영)

## 잔여 위험 및 후속 과제

### MIS 제외 이슈 다음 파이프라인 처리 가능성

- #165 (overlay inert): game.js 미포함 → 다음 라운드에서 독립 처리 가능
- #163 (update EventBus): game.js만 → #148 머지 후에도 독립 영역 (update 끝부분)
- 나머지 game.js 충돌 이슈들: 분리 후에도 game.js 핵심 로직(update, damage, spawn)을 수정하므로 여전히 충돌

### 교훈

1. **모듈 분리의 실질 효과**: game.js 분리로 #165, #166이 game.js에서 완전 독립. MIS 크기는 여전히 2지만 선택 가능한 조합이 확대됨.
2. **명세 라인 번호 drift**: 모듈 분리 후 기존 명세의 라인 번호가 무효화됨. 함수명 기반으로 재매핑 필요 — 자동화 도구 검토 가치.

## 전체 자원 사용량

| 단계 | 에이전트 수 | 비고 |
|------|-----------|------|
| 모듈 분리 | 0 (직접) | game.js → combat.js + overlay.js 분리 |
| nextplan~run-agents | 0 (직접) | 2개 이슈 구현 + 리뷰 |
| **합계** | **0** | 단일 세션 직접 처리 |
