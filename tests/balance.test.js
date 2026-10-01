// 헤드리스 밸런스 회귀 테스트. 수치를 바꿨는데 이 테스트가 깨지면
// node tests/balance-probe.mjs 로 시나리오별 결과를 보고 의도한 변화인지 판단한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { playWithPlan, STANDARD_PLAN, autoPlan } from './helpers.js';

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
