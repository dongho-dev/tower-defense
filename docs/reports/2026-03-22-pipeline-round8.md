# 작업 보고서: pipeline round 8 — 패배 통계 + 웨이브 함수 모듈 이동

- **날짜**: 2026-03-22
- **처리 이슈 수**: 2개
- **PR 목록**: #176 (머지 완료)
- **실행 방식**: 직접 처리 (MIS = 2개)

## 우선순위 분포

- priority:high: 0개
- priority:medium: 1개 (#134)
- priority:low: 1개 (#151)

## Phase별 소요 시간

| Phase | 시작 | 완료 | 소요 |
|-------|------|------|------|
| nextplan | 09:22 | 09:22 | <1분 |
| spec | 09:22 | 09:22 | 스킵 |
| review-issues | 09:22 | 09:23 | 1분 |
| run-agents | 09:23 | 09:27 | 4분 |
| worktree-clean | 09:28 | 09:28 | <1분 |
| **전체** | **09:22** | **09:28** | **6분** |

## 파이프라인 전체 흐름

### Phase 0: 감사

스킵됨.

### Phase 1: 트리아지

- open 이슈: 14개 (#161 이전 라운드에서 닫힘)
- 중복: 0개, open PR: 0개

| 카테고리 | 수 | 이슈 번호 |
|----------|---|----------|
| 워커가능 | 14 | #163, #148, #167, #166, #165, #139, #137, #135, #134, #151, #150, #149, #145, #142 |
| 허브/대규모/외부 | 0 | - |

### Phase 2: 명세

스킵 (14/14 명세 완료).

### Phase 3: 계획

#### 충돌 그래프

| 공유 파일 | 충돌 이슈 수 |
|----------|------------|
| game.js | 13개 이슈 (14개 중 #151 제외 전부) |
| ui.js | 8개 이슈 |
| index.html | 6개 이슈 |
| style.css | 4개 이슈 |

#### MIS 분석

Greedy MIS 결과: {#134, #151} = 2개

- **#134** (constants.js, game.js, main.js, index.html, style.css): degree=12, priority:medium. game.js를 포함하지만 degree가 가장 낮은 medium 이슈로 선택됨.
- **#151** (utils.js, ui.js): degree=7, priority:low. #134와 파일 겹침 없음 → 독립 추가 가능.
- 대안: {#163} (game.js only, deg=12) + {#151} = 2개로 동일 크기. #134 선택 이유: 사용자 대면 기능(패배 통계)이 내부 성능 최적화(#163)보다 즉각적 가치가 높음.

#### 제외 이슈 (12개)

| 이슈 | 우선순위 | 제외 사유 |
|------|---------|----------|
| #163 | 🟡 | game.js 충돌 (#134) |
| #148 | 🟡 | game.js 충돌 (#134) |
| #167 | 🟡 | game.js, style.css 충돌 (#134) |
| #166 | 🟡 | index.html, game.js 충돌 (#134) |
| #165 | 🟡 | game.js 충돌 (#134) |
| #139 | 🟡 | index.html, main.js, game.js, style.css 충돌 (#134) |
| #137 | 🟡 | index.html, game.js, style.css 충돌 (#134) |
| #135 | 🟡 | game.js, index.html 충돌 (#134) |
| #150 | 🟢 | game.js 충돌 (#134) |
| #149 | 🟢 | game.js, index.html 충돌 (#134) |
| #145 | 🟢 | game.js 충돌 (#134) |
| #142 | 🟢 | game.js 충돌 (#134) |

### Phase 4: 실행 (직접 처리)

2개 이슈 → 직접 처리 경로 (Phase 4-B).

#### 구현 과정

1. #151: ui.js에서 getWaveEnemyCount/getWaveEnemyStats 삭제 → utils.js 끝에 추가 (default parameter를 if 가드로 변환)
2. #134: constants.js gameState에 카운터 3개 추가 → game.js damageEnemyAtIndex/upgradeTower/showDefeatDialog/resetGame 수정 → main.js handlePointerDown 수정 → index.html 통계 HTML 추가 → style.css 스타일 추가
3. eslint.config.mjs globals 이동 (getWaveEnemyCount/Stats: ui.js → utils.js 섹션)
4. ESLint: 0 errors. Tests: 92/92 pass.

#### 리뷰

| 이슈 | 리뷰 레벨 | 판정 | 재시도 | 주요 확인 사항 |
|------|----------|------|--------|--------------|
| #134 | L2 | PASS | 0 | totalKills 증분 위치(enemies.splice 직전), totalGoldSpent 설치+업그레이드 양쪽 추적, sellTower 환급 미차감(명세 준수), resetGame 초기화, showDefeatDialog 렌더링 순서(DOM 업데이트 → overlay 표시) |
| #151 | L1 | PASS | 0 | 로드 순서 검증(constants→utils→ui→game), default parameter 처리(if 가드로 변환), eslint globals 섹션 이동 |

L2 승격 근거 (#134): 5개 파일 변경 + 데이터 흐름 변경.

#### CI 조사

- pre-push hook: 92/92 pass
- GitHub Actions `test` check: pass
- 전체 통과, 추가 조사 불필요

#### 머지

- `gh pr ready 176` → `gh pr merge 176 --squash` → 자동 머지
- Closes #134, Closes #151 → 이슈 자동 닫힘
- `git pull origin main` → fast-forward 성공

### Phase 5: 정리

- worktree: main만 존재
- `fix/134-151-stats-refactor` 로컬 브랜치 삭제 완료

## 이슈별 상세

| 이슈 | 제목 | 변경 파일 | 비고 |
|------|------|----------|------|
| #134 | feat: 패배 화면 게임 결과 통계 표시 | constants.js, game.js, main.js, index.html, style.css | gameState에 totalKills/totalGoldSpent/towersBuilt 카운터 추가. damageEnemyAtIndex에서 킬 카운트 증분, handlePointerDown/upgradeTower에서 골드 소비 추적. showDefeatDialog에서 `#stat-wave`/`#stat-kills`/`#stat-towers`/`#stat-gold-spent` 요소에 값 렌더링. `#defeat-stats` div + flexbox 레이아웃 스타일 추가. |
| #151 | refactor: 웨이브 계산 함수 ui.js → 공용 모듈 이동 | utils.js, ui.js, eslint.config.mjs | getWaveEnemyCount/getWaveEnemyStats를 ui.js:282-294에서 삭제, utils.js 파일 끝으로 이동. default parameter `enemyType = ENEMY_TYPE_DEFINITIONS[0]`를 `if (!enemyType)` 가드로 변환 (utils.js 로드 시점의 안전성 확보). |

## 명세 외 변경 (unplannedWrites)

없음.

## 명세 차이 + 특이사항

- #151: 명세에서는 `enemyType = ENEMY_TYPE_DEFINITIONS[0]` default parameter를 그대로 사용하도록 했으나, `if (!enemyType)` 가드로 변환. 이유: utils.js가 constants.js 직후 로드되므로 실질적 차이 없으나, 방어적 패턴이 더 안전. 기능 동작 동일.

## 테스트 수 변화

- 이전: 92개 → 이후: 92개 (+0개)
- 기존 getWaveEnemyCount/Stats 테스트 7개가 함수 이동 후에도 정상 통과 (main.js module.exports 경유).

## 이전 위험 추적

| 위험 항목 | 최초 보고 | 반복 횟수 | 현재 상태 |
|----------|----------|----------|----------|
| game.js 모놀리식 병목 | round 7 | 2회 | ⚠️ 지속 — #149(모듈 분리) 미처리 |

## 잔여 위험 및 후속 과제

### MIS 제외 이슈 다음 파이프라인 처리 가능성

#134 머지로 constants.js/main.js/index.html/style.css/game.js가 변경됨. 다음 라운드에서:
- game.js 충돌은 여전하지만 #134의 변경은 독립 영역(showDefeatDialog, damageEnemyAtIndex 내 1줄 추가)이므로 라인 수준 충돌 확률 낮음
- #151 머지로 ui.js에서 함수 2개 제거 → ui.js의 충돌 범위 소폭 축소
- **MIS 크기 개선 가능성**: 낮음 (game.js 구조 미변경). #149 모듈 분리가 근본 해결책.

### 교훈

1. **MIS 2개 달성**: #151(utils.js, ui.js)이 game.js를 미포함하여 #134와 독립 — 파일 수준 MIS에서도 game.js 미포함 이슈는 추가 선정 가능
2. **game.js 병목 지속(2회 반복)**: 14개 중 13개가 game.js 수정 → #149 모듈 분리의 우선순위 상향 필요

## 전체 자원 사용량

| 단계 | 에이전트 수 | 비고 |
|------|-----------|------|
| nextplan | 0 (직접) | 이슈 수집 + 분류 |
| spec | 0 | 스킵 |
| review-issues | 0 (직접) | MIS 계산 |
| run-agents | 0 (직접 처리) | 2개 이슈 구현 + L1/L2 리뷰 |
| worktree-clean | 0 (직접) | 브랜치 정리 |
| **합계** | **0** | 단일 세션 직접 처리 |
