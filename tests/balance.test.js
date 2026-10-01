// 헤드리스 밸런스 회귀 테스트. 수치를 바꿨는데 이 테스트가 깨지면
// node tests/balance-probe.mjs 로 시나리오별 결과를 보고 의도한 변화인지 판단한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { playWithPlan, STANDARD_PLAN, autoPlan } from './helpers.js';
import { playSurvival } from './survivalAi.js';

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

// 얼어붙은 분지(살아남기): tests/survivalAi.js의 AI가 명당을 골라 방벽·타워·광산을 짓는다.
// 수치를 바꿨다면 node tests/survival-probe.mjs <명당>으로 전략별 결과를 본다.
test('얼어붙은 분지(살아남기): 무대응은 3분 안에 패배, 명당에 벽+타워+광산은 승리, 약한 전략은 무너진다', () => {
    const none = playSurvival({ site: 'nw', idle: true }).state;
    assert.equal(none.status, 'lost');
    assert.ok(none.survival.clock < 200, `${Math.round(none.survival.clock)}초 버팀`);
    for (const site of ['nw', 'w']) {
        const good = playSurvival({ site, tierGate: 4 }).state;
        assert.equal(good.status, 'won', `${site} 좋은 운영`);
        assert.ok(good.stats.mined > 3000, `캔 골드 ${good.stats.mined}`);
    }
    // 방벽 없이 타워만: 적이 곧장 타워를 부순다
    assert.equal(playSurvival({ site: 'nw', walls: false, tierGate: 4 }).state.status, 'lost');
    // 광산 없이: 수입이 모자라 중반에 무너진다
    assert.equal(playSurvival({ site: 'nw', mines: false, tierGate: 4 }).state.status, 'lost');
    // 벽만: 타워가 없으면 아무것도 못 막는다
    assert.equal(playSurvival({ site: 'nw', towers: [], maxTowers: 0 }).state.status, 'lost');
});
