# 작업 보고서: discover + audit + pipeline round 4

- **날짜**: 2026-03-22
- **처리 이슈 수**: 9개 (36개 생성 → 9개 선정 → 9개 머지)
- **PR 목록**: #170 (Batch A, 머지), #169 (Batch B, 머지)
- **실행 방식**: 2배치 병렬 (run-agents)

## 우선순위 분포

선정 9개 기준:
- priority:high: 5개 (#152, #153, #155, #156, #164)
- priority:medium: 1개 (#162)
- priority:low: 3개 (#140, #141, #143)

전체 36개 기준:
- priority:high: 11개
- priority:medium: 15개
- priority:low: 10개

## Phase별 소요 시간

| Phase | 시작 (KST) | 완료 (KST) | 소요 |
|-------|-----------|-----------|------|
| Discover | 15:57 | 16:13 | 16분 |
| Audit | 16:13 | 16:35 | 22분 |
| Nextplan | 16:35 | 16:38 | 3분 |
| Spec | 16:38 | 16:48 | 10분 |
| Review-issues | 16:48 | 16:51 | 3분 |
| Run-agents | 16:51 | 16:49 | ~15분 |
| **전체** | **15:57** | **~16:49** | **~52분** |

## 파이프라인 전체 흐름

### Phase 0-A: Discover

3개 Sonnet Explore Agent 병렬 (feature / dx / architecture):

| 에이전트 | 관심사 | 토큰 | tool uses | 소요 |
|---------|--------|------|-----------|------|
| Agent 1 | feature | 98,640 | 44 | 162s |
| Agent 2 | dx | 69,843 | 64 | 186s |
| Agent 3 | architecture | 87,257 | 45 | 144s |

- raw 발견: 30개
- 필터링: 확인됨+높음/중간 자동 생성, 확인됨+낮음 8개 보류
- 그룹 병합: 3건
- **최종 생성: 19개 이슈** (#133-#151)

### Phase 0-B: Audit

6개 Sonnet Explore Agent 병렬:

| 에이전트 | 관심사 | 토큰 | tool uses | 소요 |
|---------|--------|------|-----------|------|
| B1 | 보안+입력검증 | 63,730 | 46 | 142s |
| B2 | 에러핸들링+복원력 | 111,621 | 64 | 253s |
| B3 | 테스트+데이터무결성 | 109,527 | 91 | 325s |
| F1 | UX+접근성 | 79,321 | 57 | 246s |
| F2 | 성능+메모리 | 105,297 | 43 | 181s |
| F3 | 코드품질+견고성 | 104,768 | 57 | 235s |

- raw 발견: 75건
- 중복 병합: 5건
- 추정→버림: 6건 (웨이브 입력 단일 계층, showDefeatDialog 중복, tower.def null, processAnnounceQueue null, populateMapList 리스너, FakeBufferSource)
- **최종 생성: 17개 이슈** (#152-#168)

### Phase 1: 트리아지

| 카테고리 | 이슈 번호 |
|---------|----------|
| priority:high | #152-#161, #164 |
| priority:medium | #133-#139, #147, #148, #162, #163, #165-#168 |
| priority:low | #140-#146, #149-#151 |

### Phase 2: 명세

5개 Opus Agent 그룹 병렬 (8+8+7+7+6):

| 그룹 | 이슈 | 토큰 | tool uses | 소요 |
|------|------|------|-----------|------|
| Group 1 | #133-#140 | 91,228 | 58 | 435s |
| Group 2 | #141-#148 | 74,435 | 61 | 463s |
| Group 3 | #149-#155 | 67,957 | 48 | 384s |
| Group 4 | #156-#162 | 79,540 | 64 | 355s |
| Group 5 | #163-#168 | 93,156 | 62 | 585s |

주요 발견: #147 auraRadius 사인파 변동(양자화 캐싱), #148 쿨다운 스킵 불가(포탑 회전), #141 no-redeclare 211건/no-unused-vars 99건은 전역 패턴 한계

### Phase 3: 계획

#### 충돌 그래프

| 공유 파일 | 충돌 이슈 수 |
|----------|------------|
| game.js | 18 |
| ui.js | 13 |
| index.html | 8 |
| style.css | 6 |
| utils.js | 6 |
| tests/unit.test.js | 6 |

#### MIS 분석

1. **game.js 클러스터**: #153(high,deg=18) 선택. #157,#158,#159(모두 high)는 모두 game.js만 수정하므로 어떤 것을 선택해도 나머지 제외. #153이 최소 conflict → MIS 크기 최대화.
2. **ui.js**: #156(high,deg=12) 선택.
3. **utils.js**: #155(high,deg=5) 선택.
4. **audio.js**: #164(high,deg=9) 선택.
5. **constants.js**: #152(high,deg=2) 선택.
6. **renderer.js**: #162(medium,deg=2) 선택.
7. **독립**: #140, #141, #143 (충돌 0).

**MIS: 9개, 파일 겹침 0.**

#### 제외 이슈 (27개)

| 이슈 | 우선순위 | 사유 | 다음 가능성 |
|------|---------|------|-----------|
| #154 | high | game.js+ui.js | ✅ 해소 |
| #157-#159 | high | game.js | ✅ 해소 |
| #160 | high | utils.js | ✅ 해소 |
| #161 | high | 5파일 광범위 | ⚠️ 여전히 충돌 |
| #133-#139 | medium | 다중 파일 | ✅ 대부분 해소 |
| #144-#151 | low | 다양한 충돌 | ✅ 대부분 해소 |

### Phase 4: 실행

#### 오케스트레이터 메트릭

| 배치 | 모델 | 토큰 | tool uses | 소요 | PR |
|------|------|------|-----------|------|----|
| Batch A | Opus | 75,412 | 75 | 553s | #170 |
| Batch B | Opus | 53,693 | 67 | 468s | #169 |

#### 이슈별 리뷰

| 이슈 | 리뷰 | 판정 | 재시도 | 주요 확인 |
|------|------|------|--------|---------|
| #152 | L2 | PASS | 0 | forEach→for+try/catch, listeners.slice() 복사본 |
| #153 | L2 | PASS | 0 | hoverTile=null 다음에 buildFailFlash=null 1줄 |
| #155 | L2 | PASS | 0 | 정규식 hex 검증, 3자리 확장, factor NaN, RGB 클램프 |
| #156 | L2 | PASS | 0 | towers.includes() 가드, enemies 패턴 대칭 |
| #164 | L2 | PASS | 0 | onended disconnect, catch close(), FakeNode disconnect |
| #162 | L1 | PASS | 0 | 7개 gradient→단색, 72줄 삭제 |
| #140 | L1 | PASS | 0 | .husky/pre-push npm test |
| #141 | L1 | PASS | 0 | no-undef error, globals 추가 |
| #143 | L1 | PASS | 0 | test:coverage 스크립트 |

#### CI 과정

1. PR #170: CI `test (20)` SUCCESS (13초) → 즉시 머지
2. PR #169: 초기 CONFLICTING → #170 머지 후 `reset --hard origin/main` + cherry-pick 5커밋 → force-push → CI SUCCESS (15초) → 머지

### Phase 5: 정리

- worktree 2개 제거, 브랜치 2개 삭제 완료

## 이슈별 상세

### Batch A (PR #170): +275 -6, 6파일

| 이슈 | 제목 | 변경 파일 | 비고 |
|------|------|----------|------|
| #152 | EventBus 예외 격리 | constants.js | forEach→for+try/catch, listeners.slice() 복사본 |
| #153 | buildFailFlash 초기화 | game.js | resetGame()에 `gameState.buildFailFlash = null` 1줄 |
| #155 | darkenHex 방어 | utils.js | hex 정규식+3자리 확장+factor NaN+RGB 클램프 |
| #156 | stale tower 가드 | ui.js | towers.includes() 가드 (enemies 대칭) |
| #164 | Audio disconnect | audio.js, tests/unit.test.js | onended disconnect, catch close(), FakeNode disconnect |

### Batch B (PR #169): +21 -76, 4파일

| 이슈 | 제목 | 변경 파일 | 비고 |
|------|------|----------|------|
| #162 | gradient 최적화 | renderer.js | 7개 gradient→단색 applyAlpha (-72줄 +14줄) |
| #140 | pre-push hook | .husky/pre-push | 신규, `npm test` |
| #141 | ESLint error | eslint.config.mjs | no-undef error, globals 2개 추가 |
| #143 | test coverage | package.json | test:coverage 스크립트 |

## 명세 외 변경 (unplannedWrites)

없음.

## 명세 차이 + 특이사항

없음.

## 테스트 수 변화

- 이전: 53개 → 이후: 69개 (+16개)

| 이슈 | 추가 | 테스트 이름 |
|------|------|-----------|
| #152 | 3 | EventBus 예외 격리, 빈 이벤트, off 후 미호출 |
| #153 | 1 | resetGame buildFailFlash 초기화 |
| #155 | 8 | darkenHex 정상/factor0/factor>1/non-hex/null/빈문자열/3자리/형식 |
| #156 | 1 | selectedTower stale 가드 |
| #164 | 3 | playToneSequence disconnect, playNoise disconnect, ensureAudioContext close |

## 잔여 위험 및 후속 과제

- **priority:high 잔여 6개**: #154, #157-#160, #161 → 다음 파이프라인 최우선
- **#161 (5파일 광범위)**: 여전히 다수 충돌, 단독 배치 권장
- **renderer.js gradient 단색 근사 (#162)**: 시각적 품질 저하 가능 → 수동 확인 필요

### 교훈

1. worktree branch old commits 문제 → `reset --hard origin/main` + cherry-pick이 rebase보다 안정적
2. pipeline-state.json 손실 → 상태 파일은 main repo 절대경로로 관리
3. 36개 대량 spec → 5 Opus 병렬 ~10분, 효율적이나 1M 컨텍스트 소모 큼

## 전체 자원 사용량

| 단계 | 에이전트 수 | 총 토큰 | 총 tool uses |
|------|-----------|--------|-------------|
| Discover | 3 (Sonnet) | 255,740 | 153 |
| Audit | 6 (Sonnet) | 574,264 | 358 |
| Spec | 5 (Opus) | 406,316 | 293 |
| Run-agents | 2 (Opus) | 129,105 | 142 |
| **합계** | **16** | **~1,365,425** | **946** |
