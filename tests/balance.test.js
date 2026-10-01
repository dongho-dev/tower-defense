// 헤드리스 밸런스 회귀 테스트. 수치를 바꿨는데 이 테스트가 깨지면
// node tests/balance-probe.mjs 로 시나리오별 결과를 보고 의도한 변화인지 판단한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { playWithPlan, STANDARD_PLAN, autoPlan, MOUNTAIN_PLAN } from './helpers.js';

test('아무것도 짓지 않으면 초반에 패배한다', () => {
    const { state } = playWithPlan('dusk', [], { noUpgrades: true, skills: false });
    assert.equal(state.status, 'lost');
    assert.ok(state.waveIndex <= 4, `웨이브 ${state.waveIndex}까지 버팀`);
});

test('특화에 집중한 8타워 전략은 승리한다', () => {
    const { state } = playWithPlan('dusk', STANDARD_PLAN.slice(0, 8));
    assert.equal(state.status, 'won');
});

test('타워 5개로는 끝까지 버티지 못한다', () => {
    const { state } = playWithPlan('dusk', autoPlan('dusk', 5));
    assert.equal(state.status, 'lost');
});

test('한 종류만 짓는 전략은 끝까지 버티지 못한다', () => {
    const plan = STANDARD_PLAN.map(([s]) => [s, 'ranger', 'b']);
    const { state } = playWithPlan('dusk', plan);
    assert.equal(state.status, 'lost');
});

test('서리 협곡: 무대응은 초반 패배, 10타워 자동 전략은 승리', () => {
    const none = playWithPlan('frostvale', [], { noUpgrades: true, skills: false }).state;
    assert.equal(none.status, 'lost');
    assert.ok(none.waveIndex <= 4);
    const { state } = playWithPlan('frostvale', autoPlan('frostvale', 10));
    assert.equal(state.status, 'won');
});

test('공허의 첨탑: 10타워 전략은 승리, 6타워로는 패배', () => {
    const strong = playWithPlan('voidspire', autoPlan('voidspire', 10)).state;
    assert.equal(strong.status, 'won');
    const weak = playWithPlan('voidspire', autoPlan('voidspire', 6)).state;
    assert.equal(weak.status, 'lost');
});

// 성채 방어: 성문 곁 소켓(안마당)에 박격포·궁수탑을 짝지어 세우는 계획
const FORTRESS_PLAN = [
    [7, 'ember', 'a'],
    [6, 'ranger', 'b'],
    [0, 'ember', 'a'],
    [1, 'ranger', 'b'],
    [2, 'ember', 'a'],
    [3, 'ranger', 'b'],
    [4, 'ember', 'a'],
    [5, 'ranger', 'b']
];

test('성채 방어: 무대응은 초반 패배, 성문 곁 8타워는 승리', () => {
    const none = playWithPlan('fortress', [], { noUpgrades: true, skills: false }).state;
    assert.equal(none.status, 'lost');
    assert.ok(none.waveIndex <= 6, `웨이브 ${none.waveIndex}까지 버팀`);
    const { state } = playWithPlan('fortress', FORTRESS_PLAN);
    assert.equal(state.status, 'won');
});

// 눈마루 고개(살아남기): 광맥 소켓 26~32 (helpers.js MOUNTAIN_PLAN 참고)
const MOUNTAIN_TURTLE = [
    [26, 'mine', 'a'],
    [4, 'ranger', 'b'],
    [5, 'ember', 'a'],
    [0, 'frost', 'a'],
    [1, 'storm', 'a'],
    [2, 'ranger', 'b'],
    [3, 'storm', 'b'],
    [6, 'ember', 'b']
];

test('눈마루 고개(살아남기): 무대응은 2분 안에 패배, 넓혀 가며 키우면 승리, 약한 구성은 무너진다', () => {
    const none = playWithPlan('mountain', [], { noUpgrades: true, skills: false }).state;
    assert.equal(none.status, 'lost');
    assert.ok(none.survival.clock < 150, `${Math.round(none.survival.clock)}초 버팀`);
    // 적당한 플레이: 광맥을 차지하며 넓히고, 지은 타워를 2레벨로 키운 뒤 다음 것을 짓는다
    const good = playWithPlan('mountain', MOUNTAIN_PLAN, { tierGate: 2 }).state;
    assert.equal(good.status, 'won');
    assert.ok(good.lives >= good.maxLives * 0.5, `본진 ${Math.round(good.lives)}`);
    assert.ok(good.stats.mined > 3000, `캔 골드 ${good.stats.mined}`);
    // 광산 없이 6타워(업그레이드 없음)는 중반을 못 넘긴다
    const weak = playWithPlan('mountain', MOUNTAIN_PLAN.filter(([, t]) => t !== 'mine').slice(0, 6), {
        noUpgrades: true
    }).state;
    assert.equal(weak.status, 'lost');
    // 광맥을 넓히지 않고 본진에서만 버티면 수입이 모자라 무너진다
    const turtle = playWithPlan('mountain', MOUNTAIN_TURTLE, { tierGate: 2 }).state;
    assert.equal(turtle.status, 'lost');
});
