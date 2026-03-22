# 작업 보고서: pipeline round 11 — 10이슈 2배치 병렬 (충돌 방지 분리)

- **날짜**: 2026-03-22
- **처리 이슈 수**: 10개 전부 머지
- **PR 목록**: #204 (Batch A), #205 (Batch B) — 모두 머지
- **실행 방식**: 2배치 병렬 (소스/테스트 분리)

## 우선순위 분포

- priority:medium: 5개 (#199, #197, #198, #183, #163)
- priority:low: 5개 (#182, #190, #191, #193, #180)

## Phase별 소요 시간

Phase 1-3: 즉시 (기존 명세 활용, ~1분)
Phase 4 Batch A: 3분 39초
Phase 4 Batch B: 11분 37초
Phase 5: 즉시

## 핵심 개선: 소스/테스트 분리 전략

이전 라운드(round 10)에서 3배치 병렬 시 tests/unit.test.js 충돌로 Batch B/C PR이 닫힌 교훈을 반영:

| 배치 | 수정 대상 | 파일 범위 |
|------|----------|----------|
| Batch A | 소스 파일만 | renderer.js, overlay.js, index.html, ui.js, style.css, update.js, game.js |
| Batch B | 테스트/DX만 | tests/unit.test.js, eslint.config.mjs, scripts/, package.json, CI config |

결과: Batch A 머지 후 Batch B rebase 시 **충돌 0건**. 순차 머지 성공.

## 이슈별 상세

### Batch A (소스 5개, PR #204)

| 이슈 | 제목 | 변경 파일 | 비고 |
|------|------|----------|------|
| #199 | 캔버스 렌더링 최적화 | renderer.js | drawEnemies: ellipse fill→stroke 연속 호출로 경로 재계산 제거. drawLaserBeams: shadowBlur 전환 2N→2. drawTowers: 불필요한 save/restore 제거. |
| #197 | 맵 카드 키보드 내비게이션 | overlay.js | populateMapList()에 로빙 tabindex + ArrowDown/Up/Home/End keydown 핸들러 |
| #198 | aria-atomic 수정 | index.html | wave-preview에서 aria-atomic="true" 제거, 카운트다운/남은적에 aria-live="off" |
| #183 | 포탑 카드 골드 부족 비활성화 | ui.js, style.css | updateTowerCardAffordability() + gold:changed 이벤트 등록 + .cannot-afford CSS |
| #163 | update EventBus 최적화 | update.js, game.js | wave:changed dirty flag + _wavePayload 재사용 객체 + getWaveEnemyComposition 캐싱 |

### Batch B (테스트/DX 5개, PR #205)

| 이슈 | 제목 | 변경 파일 | 비고 |
|------|------|----------|------|
| #182 | 렌더러 테스트 | tests/unit.test.js | drawEnemies~render 7개 함수 × 빈배열/최소객체 = 17개 테스트 |
| #190 | ESLint 복잡도 규칙 | eslint.config.mjs | complexity(15), max-depth(4), max-lines-per-function(100) warn 추가 |
| #191 | utils.js 순수 함수 테스트 | tests/unit.test.js | formatNumber/getColorFromArray/getTowerColor/recalcTowerStats 17개 테스트 |
| #193 | gameGlobals 검증 스크립트 | scripts/check-globals.mjs, package.json | 전역 선언 파싱 → gameGlobals 비교 자동화 |
| #180 | CI 품질 게이트 | .github/workflows/ci.yml, package.json | test→test:coverage, lint --max-warnings 0 |

## 테스트 수 변화

- 이전: 97개 → 이후: 128개 (+31개)
- #182: 렌더러 크래시 방지 +17개
- #191: utils.js 순수 함수 +17개 (일부 기존 테스트와 중복 가능하여 실제 +14)

## 잔여 이슈

15개 open (다음 라운드에서 처리):
- priority:medium 10개: #196, #195, #189, #187, #184, #167, #165, #139, #137, #135
- priority:low 5개: #188, #181, #150, #145, #142
