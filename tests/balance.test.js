// 헤드리스 밸런스 회귀 테스트. 수치를 바꿨는데 이 테스트가 깨지면
// node tests/balance-probe.mjs 로 시나리오별 결과를 보고 의도한 변화인지 판단한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { playWithPlan, STANDARD_PLAN, autoPlan, SURVIVAL_PLAN } from './helpers.js';

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

test('기나긴 밤(살아남기): 무대응은 1분 안에 패배, 보루 12타워는 동틀 때까지 버티고 6타워는 무너진다', () => {
    const none = playWithPlan('longnight', [], { noUpgrades: true, skills: false }).state;
    assert.equal(none.status, 'lost');
    assert.ok(none.survival.clock < 90, `${Math.round(none.survival.clock)}초 버팀`);
    const good = playWithPlan('longnight', SURVIVAL_PLAN).state;
    assert.equal(good.status, 'won');
    assert.ok(good.lives >= 10, `생명 ${good.lives}`);
    const weak = playWithPlan('longnight', SURVIVAL_PLAN.slice(0, 6)).state;
    assert.equal(weak.status, 'lost');
    // 업그레이드 없이 넓게만 지으면 중반을 못 넘긴다
    const flat = playWithPlan('longnight', SURVIVAL_PLAN, { noUpgrades: true }).state;
    assert.equal(flat.status, 'lost');
});
