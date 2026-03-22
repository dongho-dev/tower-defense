# 작업 보고서: Pipeline Round 2

- **날짜**: 2026-03-22
- **처리 이슈 수**: 4개 (12개 open 중 MIS 4개 선정)
- **PR 목록**: #125 (머지)
- **실행 방식**: 1배치 (basic-agents, Opus 모델)

## 우선순위 분포

- priority:high: 3개 (#105, #111, #117)
- priority:medium: 1개 (#121)

## Phase별 소요 시간

| Phase | 시작 | 완료 | 소요 |
|-------|------|------|------|
| nextplan | 05:37 | 05:37 | <1분 |
| spec | 05:37 | 05:37 | 스킵 (기존 명세 재사용) |
| review-issues | 05:37 | 05:38 | 1분 |
| run-agents | 05:38 | 05:57 | 19분 |
| worktree-clean | 05:57 | 05:57 | <1분 |
| **전체** | **05:37** | **05:57** | **~20분** |

## 파이프라인 전체 흐름

### Phase 1: 트리아지

- open 이슈: 12개 (1차 파이프라인에서 잔여)
- 모두 워커가능, 중복/허브 없음
- 우선순위 라벨 이미 부여 완료 (1차에서)

### Phase 2: 명세 (스킵)

- 12개 전부 1차 파이프라인에서 명세 작성 완료
- 코드 변경으로 라인 번호 drift 가능 → 오케스트레이터에 "함수명으로 찾을 것" 지시

### Phase 3: 계획

**충돌 핫스팟:** game.js (8개 이슈 공유) → 1개만 선택 가능

**MIS = 4개**: {#105, #111, #117, #121}
- #105 선택 근거: game.js 클러스터 중 유일하게 ui.js를 안 건드려 #121과 양립 가능 + priority:high
- #111: package.json 등 독립 파일
- #117: renderer.js 단독
- #121: ui.js 단독

### Phase 4: 실행

| 배치 | 모델 | 토큰 | tool uses | 소요 | PR |
|------|------|------|-----------|------|---|
| Batch A | Opus | 111,649 | 136 | 1126초 (18분46초) | #125 |

**이슈별 리뷰:**

| 이슈 | 리뷰 레벨 | 판정 | 주요 확인 사항 |
|------|----------|------|--------------|
| #105 | L2 | PASS | 8개 타워 전부 rangeGrowth/fireDelayGrowth/levelScaling 추가, recalcTowerStats 성장 공식 정상, fireDelay 최솟값 0.05 클램핑, ATTACK_PATTERNS 내 6개 함수 전부 ls 참조로 전환 |
| #111 | L2 | PASS | ESLint flat config 200+ 전역변수, Prettier 기존 스타일 매칭, lint 0 errors/326 warnings, format:check 통과, husky+lint-staged 설정, main.js no-dupe-keys 수정, .gitignore에서 package-lock.json 제거 |
| #117 | L2 | PASS | prefersReducedMotion 시 gradient→단색, shadowBlur→0 전환 확인, drawTowers/drawEnemies/drawProjectileTrail/drawProjectiles 4곳 모두 적용 |
| #121 | L1 | PASS | announceQueue FIFO 구현, processAnnounceQueue rAF+100ms 간격, 빈 큐 시 정상 종료 |

**추가 변경 (unplannedWrites):**
- `.gitignore`: package-lock.json 제거 (CI npm ci에 필요)
- `main.js`: 기존 `no-dupe-keys` 에러 수정 (중복 getGameSpeed 키)
- 전체 JS 파일 Prettier 포맷팅 적용

## 이슈별 상세

| 이슈 | 제목 | 변경 파일 | 비고 |
|------|------|----------|------|
| #105 | 업그레이드 다양성 | towers.js, utils.js, game.js | 8개 타워에 rangeGrowth/fireDelayGrowth/levelScaling 필드 추가 + recalcTowerStats에 레벨 기반 range/fireDelay 성장 + attackShotgun 등 6개 함수의 매직넘버를 def.levelScaling 참조로 교체 |
| #111 | ESLint+Prettier+pre-commit | package.json, eslint.config.mjs 등 6파일 | ESLint flat config(200+ globals) + Prettier(4칸, 작은따옴표) + Husky pre-commit + lint-staged + 전체 포맷팅 적용 |
| #117 | 렌더링 최적화 | renderer.js | prefersReducedMotion 시 gradient 4곳→단색 대체 + shadowBlur 4곳→0 고정으로 GPU 부하 감소 |
| #121 | 화면리더 메시지 큐 | ui.js | announce() 큐 기반 리팩터링: announceQueue[] + processAnnounceQueue() rAF+100ms 사이클로 동일 메시지 누락 방지 |

## 테스트 수 변화

- 이전: 53개 → 이후: 53개 (+0개)
- 테스트 러너: node:test (이전 파이프라인에서 전환 완료)

## 잔여 이슈 (8개 open)

| 이슈 | 우선순위 | 다음 파이프라인 처리 가능성 |
|------|---------|------------------------|
| #104 (타겟 우선순위) | high | 가능 — game.js findTarget 영역 |
| #106 (웨이브 보너스) | medium | 가능 — game.js 웨이브 완료 블록 |
| #107 (맵 미리보기) | medium | 가능 — game.js populateMapList + map.js |
| #108 (웨이브 프리뷰) | medium | 가능 — ui.js updateWavePreview |
| #114 (gameState) | high | 주의 — 4파일 대규모 리팩토링 |
| #115 (매직넘버) | medium | 가능 — #105 머지로 일부 해소 |
| #116 (이벤트 버스) | medium | 가능 — #114 이후 순차 권장 |
| #119 (Canvas 복구) | high | 가능 — renderer.js+constants.js |

## 전체 자원 사용량

| 단계 | 에이전트 수 | 총 토큰 | 총 tool uses |
|------|-----------|---------|-------------|
| Run-agents (1 Orchestrator) | 1 | 111,649 | 136 |
