# 작업 보고서: 풀스택 감사 + 15이슈 파이프라인

- **날짜**: 2026-03-15
- **처리 이슈 수**: 15개 (전부 머지)
- **PR 목록**: #65, #66, #67 (전부 머지)
- **실행 방식**: 3배치 병렬 (run-agents)

## 우선순위 분포

- priority:high: 3개 (#50, #52, #57)
- priority:medium: 7개 (#51, #53, #54, #55, #56, #58, #62)
- priority:low: 5개 (#59, #60, #61, #63, #64)

## Phase별 소요 시간

| Phase | 시작 | 완료 | 소요 |
|-------|------|------|------|
| Phase 0: 감사 | (파이프라인 전) | 06:09 | ~15분 (6 에이전트 병렬) |
| Phase 1: 트리아지 | 06:09 | 06:10 | 1분 |
| Phase 2: 명세 | 06:10 | 06:20 | 10분 (3 에이전트 병렬) |
| Phase 3: 계획 | 06:20 | 06:22 | 2분 |
| Phase 4: 실행 | 06:22 | 06:38 | 16분 (3 오케스트레이터 병렬 + 머지 충돌 해결) |
| Phase 5: 정리 | 06:38 | 06:38 | <1초 |
| **총 파이프라인** | **06:09** | **06:38** | **~29분** |

## 파이프라인 전체 흐름

### Phase 0: 감사 (fullstack)

`/basic-audit-fullstack` 실행으로 6개 Explore Agent(Sonnet)를 병렬 실행.

**에이전트별 메트릭:**

| 에이전트 | 역할 | 토큰 | tool uses | 소요 | 발견 수 |
|----------|------|-------|-----------|------|---------|
| B1 | 보안+입력검증 | 93,443 | 122 | 6분 31초 | 10 |
| B2 | 에러핸들링+API일관성 | 92,619 | 49 | 4분 4초 | 14 |
| B3 | 테스트커버리지+데이터무결성 | 113,559 | 68 | 4분 39초 | 13 |
| F1 | 프론트 보안+데이터무결성 | 67,400 | 46 | 2분 58초 | 10 |
| F2 | UX일관성+접근성 | 101,680 | 43 | 4분 21초 | 15 |
| F3 | 성능+코드품질 | 92,563 | 54 | 4분 7초 | 19 |
| **합계** | | **561,264** | **382** | | **81** |

추가로 본체가 직접 발견 2건 확인 → **raw 발견 총 83건**.

**필터링 퍼널:**
- raw 발견: 83건
- 크로스 에이전트 중복 제거: -15건 (CSP, innerHTML, module.exports, getCanvasCoords, hexToRgba 등 복수 에이전트 보고)
- 기존 이슈(#40, #42, #1) 중복: -5건 (gradient 할당, hoverTile 객체, alphaCache clear, 일시정지 렌더링, drawGrid 데드코드)
- 오탐 판정: -25건+ (아래 테이블)
- **최종 이슈 생성: 15건**

**스킵 상세 (기존 이슈 중복):**

| 발견 | 기존 이슈 | 매칭 근거 |
|------|----------|----------|
| 적 gradient 3중 할당 | #40 | #40 항목 1 "gradient 객체 할당"과 동일 카테고리 |
| hoverTile 신규 객체 할당 | #40 | #40 항목 7 "mousemove마다 객체 할당" 동일 |
| alphaCache 전체 clear | #40 | #40 항목 4 "applyAlpha 캐시 전체 삭제" 동일 |
| 게임오버/일시정지 중 루프 | #40 | #40 항목 3 "일시정지 중 렌더링" 동일 |
| drawGrid/drawPath 데드코드 | #1 | 모듈 분리 시 해결될 코드 중복 |

**오탐 판정 (주요):**

| 발견 | 에이전트 | 판정 이유 |
|------|---------|----------|
| innerHTML='' XSS | B1, F1 | 사용자 입력 미삽입, createElement+textContent만 사용하여 현재 XSS 불가 |
| spawnEnemy waypoints[0] 미검증 | B2 | buildMapData에서 MAP_DEFINITIONS 폴백으로 waypoints 항상 채워짐 |
| hexToRgba NaN/길이 4-5 | B2, B3 | 모든 색상값이 TOWER_TYPES/ENEMY_TYPE_DEFINITIONS에 하드코딩, 외부 입력 경로 없음 |
| 골드/웨이브 HUD 치트 UI | B1, F1 | index.html에 의도적으로 포함된 디버그/QA 편의 기능 (data-delta, gold-input) |
| module.exports setter 노출 | B1, F1 | 브라우저에서 typeof module === 'undefined'로 비활성, Node.js 테스트 전용 |
| Google Fonts SRI 없음 | F1 | Google Fonts CSS는 동적 생성되어 SRI 해시 고정 불가 |
| OscillatorNode.type 미검증 | B1 | SOUND_LIBRARY 정적 정의만 사용, playSound try-catch 보호됨 |
| canvas null → GRID_COLS 크래시 | B2 | canvas 요소는 index.html에 항상 존재 |
| MAP_DEFINITIONS 순회 순서 | B2 | V8에서 삽입 순서 보장, 실질적 문제 없음 |
| showDefeatDialog render 중복 | B2 | 의도된 동작 — gameOver 텍스트를 한 번 더 렌더하여 패배 화면 즉시 표시 |
| data-speed/data-delta 조작 | F1 | 의도적 디버그 UI와 동일 맥락, 클라이언트 전용 싱글플레이 게임 |
| getTowerDefinition 프로토타입 | B1 | 현실적 공격 벡터 없음 — id는 정적 UI 버튼에서만 생성 |
| console.error 정보 노출 | B1, F1 | e.message만 출력, 게임 로직 에러이므로 민감 정보 없음 |

### Phase 1: 트리아지

Open 이슈 18개 → 카테고리 분류:

| 카테고리 | 이슈 번호 | 수 |
|----------|----------|---|
| 워커가능 | #50, #51, #52, #53, #54, #55, #56, #57, #58, #59, #60, #61, #62, #63, #64 | 15 |
| 허브 | #40 (렌더링 성능 — 8개 독립 항목) | 1 |
| 대규모 | #1 (모듈 분리 — 9개 파일 생성), #42 (키보드 전용 사용자 — 방향키 커서+Enter 배치 등 대규모 신규 기능) | 2 |

**허브 판정 근거:**
- #40: 8개 독립적 성능 항목(gradient, findTarget, 일시정지 렌더링, alphaCache, DOM 쓰기, canBuildAt, mousemove, getBoundingClientRect)이 main.js 전역에 걸쳐 있어 단일 워커로 처리 부적합

**중복 닫힘:** 0건

### Phase 2: 명세

15개 이슈를 3개 Opus Agent 그룹으로 병렬 명세 작성.

| 그룹 | 이슈 | 토큰 | tool uses | 소요 |
|------|------|-------|-----------|------|
| A | #50, #51, #52, #53, #54, #55 | 59,372 | 44 | 5분 25초 |
| B | #56, #57, #58, #59, #60, #61 | 78,465 | 58 | 9분 6초 |
| C | #62, #63, #64 | 86,762 | 43 | 7분 0초 |
| **합계** | | **224,599** | **145** | |

- 신규 명세: 15개
- 기존 명세(스킵): 0개

### Phase 3: 계획

**충돌 그래프:**

| 공유 파일/영역 | 충돌 이슈 | 해결 |
|---------------|----------|------|
| main.js:2920-2932 (touch handlers) | #55, #60 | 같은 배치(B)에 배치, #55 선행 구현 |
| main.js handlePointerDown/upgradeTower | #51 (guard 추가), #58 (announce 추가) | 서로 다른 라인 — git 자동 머지 가능, 별도 배치 허용 |
| index.html | #57 (:89-100), #58 (:19-31, :53, :62), #62 (:6) | 모두 다른 라인 — 충돌 없음 |

**MIS 분석:** 15개 전체 선정 (제외 0건)

유일한 실제 충돌인 #55↔#60은 같은 배치 내 순차 실행으로 해결. 나머지 이슈 간 크로스 배치 잠재 충돌(#51↔#58, #57↔#58)은 함수 내 다른 위치를 수정하므로 git 3-way merge로 자동 해결 가능하다고 판단.

**배치 구성:**

| 배치 | 이슈 | 테마 | 리뷰 레벨 |
|------|------|------|----------|
| A | #50, #51, #52, #54, #62 | 인프라 버그 + 보안 | L2(#50, #52), L1(#51, #54, #62) |
| B | #53, #55, #56, #60, #64 | 게임 로직 + 코드 품질 | L1 전체 |
| C | #57, #58, #59, #61, #63 | UX/접근성 + 테스트 | L2(#57), L1(#58, #59, #61, #63) |

### Phase 4: 실행

**오케스트레이터별 메트릭:**

| 배치 | 모델 | 토큰 | tool uses | 소요 | PR |
|------|------|-------|-----------|------|---|
| Batch A | Opus | 52,418 | 45 | 5분 21초 | #65 |
| Batch B | Opus | 73,344 | 70 | 6분 52초 | #67 |
| Batch C | Opus | 71,688 | 49 | 5분 45초 | #66 |
| **합계** | | **197,450** | **164** | | |

**이슈별 리뷰 결과:**

| 이슈 | 리뷰 레벨 | 판정 | 재시도 | 주요 확인 사항 |
|------|----------|------|--------|--------------|
| #50 | L2 | PASS | 0 | .toggle-arrow querySelector 사용, selected-tower-indicator span 보존 확인 |
| #51 | L1 | PASS | 0 | handlePointerDown 최상단 가드로 우클릭 분기 내 중복 가드 제거 |
| #52 | L2 | PASS | 0 | loopErrorCount 리셋 위치(render 성공 후), MAX_LOOP_ERRORS=10, announce 호출 |
| #54 | L1 | PASS | 0 | closed 상태 감지 → 변수 4개 null/0 초기화 → fall-through 흐름 |
| #62 | L1 | PASS | 0 | unsafe-inline 제거, connect-src/form-action/frame-src 'none' 추가 |
| #53 | L1 | PASS | 0 | targetX/targetY 지역 변수 보존, laser DPS 표시 |
| #55 | L1 | PASS | 0 | touchstart/touchmove에 `if (!touch) return;` 가드 |
| #56 | L1 | PASS | 0 | drawEnemies time 소스 performance.now()/1000으로 변경 |
| #60 | L1 | PASS | 0 | min-height 44px, 모바일 build-toggle 44x44, touch-action: pinch-zoom |
| #64 | L1 | PASS | 0 | tower.def 캐시, findTarget 인덱스 반환, indexOf 제거, NUMBER_FORMAT.format 사용 |
| #57 | L2 | PASS | 0 | upgrade-tower-button 추가, 최대 레벨/골드 부족 시 비활성화, updateTowerStatsFields 연동 |
| #58 | L1 | PASS | 0 | announce 3곳 추가, stat-chip aria-live/atomic 이동, aria-label 동적 갱신 |
| #59 | L1 | PASS | 0 | Escape 시 게임 시작 (START_GAME_BUTTON.click() 동일 로직) |
| #61 | L1 | PASS | 0 | roving tabindex 초기화, 화살표/Home/End 키 핸들러, setSelectedTowerButton tabindex 동기화 |
| #63 | L1 | PASS | 0 | module.exports 5개 함수 추가, pickEnemyType/lerpAngle/resetGame/buildMapData/handleLaserAttack 테스트 |

**CI 조사 과정:**
- 프로젝트에 GitHub Actions CI 미설정 → `gh pr checks` 결과 "no checks reported"
- 각 오케스트레이터가 worktree 내에서 `npm test` (smoke + unit) 통과 확인
- 로컬 테스트만으로 머지 판정

**머지 순서 + 충돌 해결:**
1. **PR #65 (Batch A)** → 즉시 squash 머지 성공
2. **PR #66 (Batch C)** → `main.js:1006` 충돌 발생
   - 원인: Batch A(#50)가 `BUILD_TOGGLE.textContent`를 `.toggle-arrow` querySelector로 변경, Batch C(#58)가 같은 위치에 `aria-label` 동적 갱신 추가
   - 해결: 두 변경을 결합 — `.toggle-arrow` querySelector 사용 + aria-label 동적 갱신 모두 유지
   - npm test 통과 확인 후 push → 머지 성공
3. **PR #67 (Batch B)** → `tests/unit.test.js` 충돌 발생
   - 원인: Batch C(#63)가 `handleLaserAttack` 테스트 추가, Batch B(#64)가 `handleLaserAttack` 시그니처를 `(tower, dt, def)`로 변경
   - 해결: 테스트에서 `handleLaserAttack(laserTower, 0.1)` → `handleLaserAttack(laserTower, 0.1, laserTower.def)` 수정
   - npm test 통과 확인 후 push → 머지 성공

### Phase 5: 정리

- worktree 3개 제거 완료 (batch-a, batch-b, batch-c)
- 로컬 브랜치 3개 삭제 (fix/batch-a, fix/batch-b, fix/batch-c)

## 이슈별 상세

### Batch A (PR #65: +64/-9, 4 files)

| 이슈 | 제목 | 변경 파일 | 비고 |
|------|------|----------|------|
| #50 | BUILD_TOGGLE span 파괴 | main.js, tests/smoke.test.js | `BUILD_TOGGLE.textContent = '▶'` → `BUILD_TOGGLE.querySelector('.toggle-arrow').textContent = '▶'`로 교체, smoke test에 span 보존 검증 5개 assert 추가 |
| #51 | gameOver 가드 누락 | main.js, tests/unit.test.js | `handlePointerDown` 최상단에 `if (gameOver) return;` 추가, `upgradeTower` 최상단에 `if (gameOver) return false;` 추가, 우클릭 분기 내 중복 가드 제거 |
| #52 | 게임 루프 에러 무한 반복 | main.js | `loopErrorCount` 변수 + `MAX_LOOP_ERRORS=10` 상수 추가, catch에서 `e.message` → `e` 전체 출력, 연속 10회 에러 시 `announce()` + `return`으로 루프 중단, 성공 프레임에서 카운터 리셋 |
| #54 | AudioContext closed 미처리 | main.js | `ensureAudioContext`에 `state === 'closed'` 분기 추가 — audioContext/masterGain/cachedNoiseBuffer/cachedNoiseDuration을 null/0으로 초기화 후 새 컨텍스트 생성 fall-through |
| #62 | CSP unsafe-inline 제거 | index.html | `style-src`에서 `'unsafe-inline'` 제거, `connect-src 'none'; form-action 'none'; frame-src 'none'` 추가, 서버 헤더 전환 안내 주석 |

### Batch B (PR #67: +57/-41, 3 files)

| 이슈 | 제목 | 변경 파일 | 비고 |
|------|------|----------|------|
| #53 | 레이저 dead target + fireDelay | main.js | `handleLaserAttack`에서 `damageEnemy` 호출 전 `targetX`/`targetY` 지역 변수에 좌표 보존, laser 타워 정보 패널에 fireDelay 대신 DPS 표시 |
| #55 | touch e.touches[0] 미검증 | main.js | `touchstart`/`touchmove` 핸들러에 `const touch = e.touches[0]; if (!touch) return;` 가드 추가 |
| #56 | 애니메이션 시간 소스 불일치 | main.js | `drawEnemies`의 `const time = elapsedTime` → `const time = performance.now() / 1000`으로 변경, drawTowers와 시간 소스 통일 |
| #60 | 터치 타깃 44px + 핀치 줌 | main.js, style.css | 공통 버튼/overlay 버튼에 `min-height: 44px`, 모바일 build-toggle 40→44px, canvas `touch-action: pinch-zoom`, 멀티터치 시 `preventDefault` 미호출 |
| #64 | 코드 품질 정리 | main.js, tests/unit.test.js | `createTowerData`에 `tower.def` 캐시, `findTarget` `{enemy,index}` 반환으로 `indexOf` O(n) 제거, `enemies.includes` → 삭제 시 `selectedEnemy=null` 설정, `toLocaleString` → `NUMBER_FORMAT.format`, `parseFloat/toFixed` → `Math.round`, `getElementById` → `SELECTED_TOWER_INDICATOR` 상수 캐시, `handleLaserAttack`/`performTowerAttack`/`drawTowerShape`에 `def` 인자 전달 |

### Batch C (PR #66: +197/-12, 3 files)

| 이슈 | 제목 | 변경 파일 | 비고 |
|------|------|----------|------|
| #57 | 모바일 업그레이드 불가 | main.js, index.html | `index.html` tower-stats 패널에 `#upgrade-tower-button` 추가, `main.js`에 DOM 참조/이벤트 리스너/`updateTowerStatsFields` 내 버튼 상태 갱신(최대 레벨 비활성화, 골드 부족 비활성화) 구현 |
| #58 | 접근성 announce + ARIA | main.js, index.html | 타워 설치/업그레이드/판매 성공 시 `announce()` 호출 3곳 추가, HUD `.stat-chip`에 `aria-live`/`aria-atomic="true"` 이동, `build-toggle`/`sound-toggle` `aria-label` 상태별 동적 갱신 |
| #59 | 맵 선택 Escape 미구현 | main.js | `MAP_SELECT_OVERLAY` keydown 핸들러에 `event.key === 'Escape'` 분기 추가, START_GAME_BUTTON click 동일 로직 실행 |
| #61 | toolbar 화살표 키 | main.js | `populateTowerList`에서 roving tabindex 초기화(선택 버튼만 `tabindex="0"`, 나머지 `-1`), `TOWER_LIST_CONTAINER`에 ArrowLeft/Right/Home/End 키 핸들러, `setSelectedTowerButton`에서 tabindex 동기화 |
| #63 | 테스트 커버리지 | main.js, tests/unit.test.js | `module.exports`에 `lerpAngle`/`resetGame`/`buildMapData`/`startWave`/`handleLaserAttack` + getter/setter 추가, unit.test.js에 pickEnemyType(보스 조건)/lerpAngle(wrap-around)/resetGame(상태 초기화)/buildMapData(맵 전환)/handleLaserAttack(DPS) 테스트 추가 |

## 명세 외 변경 (unplannedWrites)

| 배치 | 수 | 내용 |
|------|---|------|
| Batch A | 1 | `tests/unit.test.js` — #51 명세 내 테스트 추가 지시에 따라 gameOver 가드 검증 테스트 추가. Write 허용 목록에 명시되지 않았으나 명세 의도에 부합 |
| Batch B | 0 | 없음 |
| Batch C | 0 | 없음 |

## 명세 차이 + 특이사항

- **#64 × #63 크로스 배치 시그니처 충돌**: Batch B(#64)가 `handleLaserAttack` 시그니처를 `(tower, dt, def)`로 변경하고, Batch C(#63)가 이전 시그니처 `(tower, dt)`로 테스트를 작성. 머지 시 수동 수정 필요 → `handleLaserAttack(laserTower, 0.1, laserTower.def)` 인자 추가로 해결
- **#50 × #58 크로스 배치 DOM 수정 충돌**: Batch A(#50)가 `setBuildPanelCollapsed`의 textContent를 querySelector로 변경, Batch C(#58)가 같은 위치에 aria-label 추가. 머지 시 양쪽 변경 결합으로 해결

## 테스트 수 변화

- 이전: smoke 9 assert + unit 74 assert = **83개**
- 이후: smoke 14 assert + unit 103 assert = **117개** (**+34개**)
- 신규 테스트 상세:
  - `tests/smoke.test.js` (+5 assert): build-toggle span 보존 검증 (토글 전후 toggle-arrow/selected-tower-indicator 존재 확인)
  - `tests/unit.test.js` (+29 assert):
    - #51: upgradeTower gameOver 가드 검증
    - #63: pickEnemyType 보스 조건, lerpAngle wrap-around, resetGame 상태 초기화, buildMapData 맵 전환, handleLaserAttack DPS 적용
    - #64: findTarget 인덱스 반환 형식 변경 반영

## 이전 위험 추적

| 위험 항목 | 최초 보고 | 반복 횟수 | 현재 상태 |
|----------|----------|----------|----------|
| 크로스 배치 시그니처 충돌 | 이번 | 1 | #64(시그니처 변경) × #63(테스트 작성) 머지 시 수동 수정으로 해결 |
| worktree divergence | 이전 파이프라인 | 2 | origin/main fetch 후 worktree 생성으로 방지 |

## 잔여 위험 및 후속 과제

### 잔여 open 이슈 (3건)
| 이슈 | 제목 | 카테고리 | 다음 파이프라인 처리 가능성 |
|------|------|---------|------------------------|
| #1 | main.js 모듈 분리 리팩토링 | 대규모 | 9개 파일 생성 — 단독 세션 권장, 다른 이슈와 충돌 가능성 높음 |
| #40 | 렌더링 루프 + DOM 업데이트 성능 | 허브 | 8개 항목 중 일부(#64에서 canBuildAt/hoverTile 유사 패턴 처리)는 이번 파이프라인으로 부분 해소. 나머지(gradient 캐시, findTarget 공간분할, dirty flag)는 독립 처리 가능 |
| #42 | 키보드 전용 사용자 배치/선택 불가 | 대규모 | 단독 세션 권장 — canvas tabindex + 방향키 커서 + Enter 배치 등 신규 상호작용 시스템 |

### 교훈
1. **크로스 배치 시그니처 충돌 감지 필요**: Phase 3에서 "함수 시그니처 변경"과 "해당 함수 테스트 추가"가 서로 다른 배치에 있으면 머지 시 반드시 충돌. → 향후 review-issues에서 함수 시그니처를 변경하는 이슈(#64)와 해당 함수의 테스트를 추가하는 이슈(#63)는 같은 배치에 배치하거나, 시그니처 변경 배치를 먼저 머지 후 테스트 배치 실행.
2. **Phase 0 오탐 비율**: 83건 중 25건+(30%+)가 오탐 → 에이전트 프롬프트에 "내부 상수만 사용하는 경로는 입력 검증 이슈로 보고하지 않는다" 가이드 추가 고려.

## 전체 자원 사용량

| 단계 | 에이전트 수 | 총 토큰 | 총 tool uses |
|------|-----------|---------|-------------|
| Phase 0 (감사) | 6 | 561,264 | 382 |
| Phase 2 (명세) | 3 | 224,599 | 145 |
| Phase 4 (실행) | 3 | 197,450 | 164 |
| **합계** | **12** | **983,313** | **691** |

*본체(파이프라인 조율) 토큰은 별도.
