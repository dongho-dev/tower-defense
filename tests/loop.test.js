// 게임 루프 안전장치와 진단 기록 회귀 테스트.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { frameDt, planSteps, ErrorGate, MAX_FRAME_DT, MAX_STEPS } from '../src/core/loop.js';
import { DiagLog, DIAG_KEY, errorInfo, describe } from '../src/diag.js';
import { TICK } from '../src/core/game.js';

test('frameDt: 탭 복귀처럼 큰 간격은 상한, 음수·NaN은 0', () => {
    assert.equal(frameDt(1016, 1000), 0.016);
    assert.equal(frameDt(31000, 1000), MAX_FRAME_DT);
    assert.equal(frameDt(900, 1000), 0);
    assert.equal(frameDt(NaN, 1000), 0);
});

test('planSteps: 한 프레임 스텝 수 상한 + 넘친 시간은 버려서 죽음의 나선이 없다', () => {
    // 아주 느린 프레임이 계속 와도 누적기는 한 틱보다 커지지 않는다
    let acc = 0;
    for (let i = 0; i < 1000; i++) {
        const p = planSteps(acc, 1.0, TICK);
        assert.ok(p.steps <= MAX_STEPS);
        acc = p.acc;
        assert.ok(acc >= 0 && acc <= TICK, `acc=${acc}`);
    }
    // 보통 프레임에서는 시간을 버리지 않는다: 60프레임 × 2배속 = 2초 = 120틱
    acc = 0;
    let steps = 0;
    for (let i = 0; i < 60; i++) {
        const p = planSteps(acc, (1 / 60) * 2, TICK);
        assert.equal(p.dropped, 0);
        steps += p.steps;
        acc = p.acc;
    }
    assert.ok(Math.abs(steps - 120) <= 1, `steps=${steps}`);
    // 멈춤·일시정지 (simDt 0)
    assert.deepEqual(planSteps(0, 0, TICK), { steps: 0, acc: 0, dropped: 0 });
});

test('ErrorGate: 같은 오류는 한 번만 error, 반복되면 warn 한 번, 처음 본 오류만 onFirst', () => {
    const calls = { error: 0, warn: 0 };
    const log = { error: () => calls.error++, warn: () => calls.warn++ };
    const firsts = [];
    const gate = new ErrorGate(log, 50, (where, e) => firsts.push(`${where}:${e.message}`));
    for (let i = 0; i < 500; i++) gate.report('렌더', new Error('boom'));
    gate.report('HUD', new Error('boom'));
    assert.equal(calls.error, 2);
    assert.equal(calls.warn, 1);
    assert.deepEqual(firsts, ['렌더:boom', 'HUD:boom']);
    assert.equal(gate.total, 501);
    assert.equal(gate.summary().find((r) => r.key === '렌더: boom').count, 500);
    // onFirst가 던져도 report는 멀쩡하다
    const bad = new ErrorGate(log, 50, () => {
        throw new Error('x');
    });
    assert.equal(bad.report('a', new Error('b')), true);
    // 오류 종류가 끝없이 늘어도 기록은 상한까지만
    const many = new ErrorGate(log, 10);
    for (let i = 0; i < 100; i++) many.report('a', new Error('e' + i));
    assert.equal(many.seen.size, 10);
});

function memoryStorage() {
    const m = new Map();
    return {
        getItem: (k) => (m.has(k) ? m.get(k) : null),
        setItem: (k, v) => m.set(k, String(v)),
        removeItem: (k) => m.delete(k),
        raw: m
    };
}

test('DiagLog: 최근 30건 링버퍼로 저장하고 다시 읽는다', () => {
    const store = memoryStorage();
    const log = new DiagLog(store);
    for (let i = 0; i < 45; i++)
        log.add('stall', { ms: 1000 + i, map: '황혼', wave: i, enemies: 3, recent: ['적:grunt'] });
    assert.equal(log.items.length, 30);
    assert.equal(log.items[0].ms, 1015);
    const again = new DiagLog(store);
    assert.equal(again.items.length, 30);
    assert.equal(JSON.parse(store.raw.get(DIAG_KEY)).at(-1).ms, 1044);
    assert.match(describe(again.items.at(-1)), /정지 1044ms · 황혼 44웨이브 · 적 3 · 직전 처음: 적:grunt/);
    again.clear();
    assert.equal(new DiagLog(store).items.length, 0);
});

test('DiagLog: 저장소가 없거나 깨져도 던지지 않는다', () => {
    const broken = {
        getItem: () => '{not json',
        setItem: () => {
            throw new Error('quota');
        },
        removeItem: () => {}
    };
    const log = new DiagLog(broken);
    assert.equal(log.items.length, 0);
    log.add('error', { where: '렌더', ...errorInfo(new Error('boom')) });
    assert.equal(log.items.length, 1);
    assert.equal(log.items[0].msg, 'boom');
    assert.ok(log.items[0].stack.split('\n').length <= 4);
    assert.equal(new DiagLog(null).add('reload').kind, 'reload');
});
