# 작업 보고서: 기능 추가 배치 (적 유형 / 맵 시스템 / 접근성 / 반응형)

날짜: 2026-03-15
처리 이슈 수: 4개 (#2, #4, #18, #19)
PR 목록: #25, #26, #27
실행 방식: 순차 직접 처리 (MIS=1, main.js 단일 파일 충돌)
보류 이슈: #1 (main.js 모듈 분리 - 대규모/아키텍처)

## 우선순위 분포

- priority:high: 0개
- priority:medium: 0개
- priority:low: 4개 (#2, #4, #18, #19)

## 파이프라인 전체 흐름

### Phase 1: 트리아지 (nextplan)
- 전체 open 이슈: 5개
- 워커 실행 가능: 4개 (#2, #4, #18, #19)
- 대규모/아키텍처 보류: 1개 (#1 main.js 모듈 분리)
- 중복 발견: 0개
- 기존 PR: 0개
- 모든 이슈에 이미 명세가 존재하여 spec phase 스킵 결정

### Phase 2: 명세 (spec)
- 스킵: 4개 이슈 모두 이전 파이프라인에서 명세 완료 상태

### Phase 3: 계획 (review-issues)
- 파일 충돌 분석:
  - #2: main.js
  - #4: main.js, index.html, style.css
  - #18: main.js, index.html, style.css
  - #19: main.js, index.html, style.css
- MIS = 1 (모든 이슈가 main.js 공유)
- 배치 구성:
  - Batch A: #2 (적 유형 - main.js만)
  - Batch B: #4 (맵 시스템 - 3파일)
  - Batch C: #18 + #19 (접근성 + 반응형 - UI 관련, 수정 영역 분리 가능)
- 실행 방식: 순차 직접 처리 (이슈 4개, 병렬 불가)

### Phase 4: 실행 (run-agents → 직접 처리)

#### Batch A: #2 다양한 적 유형 추가 → PR #25
- ENEMY_STYLES를 ENEMY_TYPE_DEFINITIONS로 확장 (4종: 일반/장갑/고속/보스)
- getWaveEnemyStats()에 enemyType 파라미터 추가 (기본값으로 하위호환)
- pickEnemyType() 함수 추가: 웨이브 10배수 보스, 웨이브 3+ 장갑20%/고속30%
- drawEnemies()에서 보스 1.5배 크기 렌더
- 변경 파일: main.js (27 ins, 14 del)

#### Batch B: #4 복수 맵 / 경로 시스템 구현 → PR #26
- MAP_DEFINITIONS 상수 추가 (기본 맵, S자 맵, 나선 맵)
- waypoints/pathTiles를 let으로 변경 + buildMapData() 함수
- 맵 선택 오버레이 UI (글래스모피즘 스타일)
- resetGame()에서 맵 데이터 재빌드 + staticLayer 캐시 무효화
- 패배 시 맵 선택 화면으로 복귀
- 변경 파일: main.js (149행 변경), index.html (8행), style.css (66행)

#### Batch C: #18 접근성 + #19 반응형 → PR #27
**#18 접근성:**
- 패배 다이얼로그 포커스 트랩 + 복원
- ARIA 속성 수정 (aria-pressed, aria-live, aria-label, aria-expanded)
- 키보드 업그레이드 (U키)
- :focus-visible 스타일 추가
- 빌드 패널 collapse 시 inert 처리
- aria-live announcer로 골드 부족/일시정지 알림

**#19 반응형:**
- handlePointerDown/handlePointerMove 공용 함수 추출
- getCanvasCoords()로 캔버스 좌표 스케일링 보정
- touchstart/touchmove/touchend 이벤트 핸들러
- Noto Sans KR 웹폰트 로드 + CSP 업데이트
- 모바일 미디어 쿼리 (768px 이하)
- 변경 파일: main.js (181행 변경), index.html (17행), style.css (120행)

### Phase 5: 정리 (worktree-clean)
- worktree: main만 존재 (정상)
- 로컬 브랜치 feat/issue-18-a11y 삭제 (중간 브랜치, squash-merged)
- 원격 feature 브랜치들은 PR merge 시 자동 삭제

### Phase 6: 보고서
- 본 문서 작성

## 이슈별 상세

| 배치 | 이슈 | 제목 | PR | 변경 파일 | 상태 |
|------|------|------|-----|----------|------|
| A | #2 | 다양한 적 유형 추가 | #25 | main.js | ✅ 머지 |
| B | #4 | 복수 맵 / 경로 시스템 구현 | #26 | main.js, index.html, style.css | ✅ 머지 |
| C | #18 | 접근성 종합 개선 | #27 | main.js, index.html, style.css | ✅ 머지 |
| C | #19 | 모바일/반응형 지원 | #27 | main.js, index.html, style.css | ✅ 머지 |

## 명세 외 변경 (unplannedWrites)

| 이슈 | 파일 | 판정 | 사유 |
|------|------|------|------|
| #19 | index.html CSP meta | 허용 | 웹폰트 로드를 위해 CSP에 fonts.googleapis.com, fonts.gstatic.com 추가 필요 |

## 잔여 위험 및 후속 과제

1. **#1 main.js 모듈 분리**: 대규모 리팩토링으로 보류 중. main.js가 현재 ~3000줄 이상으로 계속 커지고 있어 분리 필요성 증가.
2. **맵 밸런스 테스트**: 새 맵(S자, 나선)의 난이도가 실제 플레이에서 적절한지 수동 확인 필요.
3. **적 유형 밸런스**: 보스 hpMult 12.0이 고웨이브에서 너무 강하거나 약할 수 있음.
4. **터치 이벤트**: 실제 모바일 기기에서 터치 정확도 및 UX 확인 필요.
