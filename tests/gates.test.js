import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    createGame,
    step,
    callWave,
    dealDamage,
    drainEvents,
    spawnEnemyAt,
    repairGate,
    reinforceGate,
    gateRepairCost,
    GATE_HP,
    GATE_REINFORCE,
    WAVE_REPAIR,
    TICK
} from '../src/core/game.js';
import { GATE_REBUILD, GATE_REBUILD_HP, GATE_VALUE } from '../src/core/gates.js';
import { MAPS } from '../src/core/data/maps.js';
import { ENEMIES } from '../src/core/data/enemies.js';

const run = (st, sec) => {
    for (let t = 0; t < sec; t += TICK) step(st, TICK);
};

/** 영웅이 끼어들지 않게 눕혀 둔다 */
function noHero(st) {
    st.hero.dead = true;
    st.hero.respawnT = 1e9;
}

/** 성문 앞(문까지 before 거리)에 적을 세운다 */
function spawnBefore(st, gate, type, before = 2, opts = {}) {
    const b = gate.blocks[0];
    const e = spawnEnemyAt(st, type, b.d - before, { path: b.pathIndex, ...opts });
    e.hp = e.maxHp = 1e7;
    return e;
}

test('성채 방어: 언제나 공성전, 네 성문이 각자 한 갈래를 막는다', () => {
    const st = createGame('fortress');
    assert.equal(st.siege, true, '모드를 고르지 않아도 공성전');
    assert.ok(st.hero);
    assert.equal(st.gates.length, 4);
    const paths = st.gates.map((g) => g.blocks.map((b) => b.pathIndex));
    assert.deepEqual(paths, [[0], [1], [2], [3]]);
    for (const g of st.gates) {
        assert.equal(g.hp, GATE_HP);
        assert.equal(g.broken, false);
        const { rx, rz } = st.map.island;
        assert.ok((g.x / rx) ** 2 + (g.z / rz) ** 2 < 0.5, '성문은 섬 안쪽 성벽에');
    }
    // 기존 맵에는 성문이 없다
    assert.equal(createGame('dusk', { siege: true }).gates.length, 0);
    assert.ok(Object.values(MAPS).every((m) => !m.siegeOnly || m.gates?.length));
});

test('성문: 지상 적은 문 앞에서 멈춰 문을 치고, 비행 적은 넘어간다', () => {
    const st = createGame('fortress');
    noHero(st);
    const gate = st.gates[0];
    const g = spawnBefore(st, gate, 'grunt', 1.5);
    const w = spawnBefore(st, gate, 'wraith', 1.5);
    run(st, 3);
    assert.equal(g.gateId, gate.id, '멈춘 적은 공격 중인 성문을 안다');
    assert.ok(g.d < gate.blocks[0].d, '문을 넘지 않는다');
    const d0 = g.d;
    run(st, 1);
    assert.equal(g.d, d0, '문 앞에 서 있다');
    assert.ok(gate.hp < gate.maxHp, '문이 맞는다');
    assert.ok(w.d > gate.blocks[0].d, '망령은 성벽을 넘는다');
    const shots = drainEvents(st).filter((ev) => ev.type === 'enemyShot' && ev.gateId === gate.id);
    assert.ok(shots.length > 0 && shots[0].tx === gate.x, '성문 공격은 enemyShot으로 알린다');
});

test('성문이 무너지면 길이 열리고, 적이 수정까지 간다', () => {
    const st = createGame('fortress');
    noHero(st);
    const gate = st.gates[1];
    const e = spawnBefore(st, gate, 'ironclad', 1);
    run(st, 2);
    assert.equal(e.gateId, gate.id);
    gate.hp = 1;
    run(st, 2);
    assert.equal(gate.broken, true);
    assert.equal(gate.hp, 0);
    const evs = drainEvents(st);
    assert.ok(evs.some((ev) => ev.type === 'gateBroken' && ev.gateId === gate.id));
    run(st, 0.5);
    assert.equal(e.gateId, null);
    assert.ok(e.d > gate.blocks[0].d, '무너진 문을 지나간다');
    const lives = st.lives;
    run(st, 15);
    assert.equal(e.alive, false);
    assert.equal(st.lives, lives - e.lives, '수정에 닿으면 생명을 잃는다');
});

test('성문 수리·재건·보강, 웨이브 시작 시 일부 회복', () => {
    const st = createGame('fortress', { gold: 5000 });
    noHero(st);
    const gate = st.gates[2];
    assert.equal(gateRepairCost(gate), 0);
    assert.equal(repairGate(st, gate.id).ok, false, '멀쩡하면 수리할 게 없다');
    gate.hp = gate.maxHp / 2;
    const gold = st.gold;
    const cost = gateRepairCost(gate);
    assert.ok(cost > 0);
    assert.equal(repairGate(st, gate.id).ok, true);
    assert.equal(st.gold, gold - cost);
    assert.equal(gate.hp, gate.maxHp);
    // 보강: 최대 체력이 늘고 늘어난 만큼 채워진다
    const max0 = gate.maxHp;
    assert.equal(reinforceGate(st, gate.id).ok, true);
    assert.equal(gate.maxHp, max0 + Math.round(GATE_HP * GATE_REINFORCE[0].hp));
    assert.equal(gate.hp, gate.maxHp);
    assert.equal(reinforceGate(st, gate.id).ok, true);
    assert.equal(reinforceGate(st, gate.id).ok, false, '보강은 두 단계까지');
    // 웨이브 시작 회복
    gate.hp = 100;
    callWave(st);
    assert.ok(Math.abs(gate.hp - (100 + gate.maxHp * WAVE_REPAIR)) < 1e-9);
    // 재건: 문 자리에 적이 있으면 안 되고, 비우면 절반 체력으로 다시 선다
    gate.hp = 1;
    const e = spawnBefore(st, gate, 'grunt', 0.6);
    run(st, 2);
    assert.equal(gate.broken, true);
    e.speed = 0;
    e.d = gate.blocks[0].d;
    e.x = gate.x;
    e.z = gate.z;
    assert.equal(gateRepairCost(gate), Math.ceil((GATE_VALUE + 140 + 220) * GATE_REBUILD));
    assert.equal(repairGate(st, gate.id).ok, false, '문 자리에 적이 있다');
    dealDamage(st, e, 1e9, 'true');
    step(st, TICK);
    const r = repairGate(st, gate.id);
    assert.equal(r.ok, true);
    assert.equal(r.rebuilt, true);
    assert.equal(gate.broken, false);
    assert.equal(gate.hp, Math.round(gate.maxHp * GATE_REBUILD_HP));
    assert.ok(drainEvents(st).some((ev) => ev.type === 'repair' && ev.gateId === gate.id && ev.rebuilt));
});

test('보스는 성문을 더 세게 치고, 도약자는 문을 뛰어넘지 못한다', () => {
    const st = createGame('fortress');
    noHero(st);
    const gate = st.gates[3];
    const boss = spawnBefore(st, gate, 'colossus', 1.5);
    run(st, 6);
    assert.equal(boss.gateId, gate.id, '보스도 문 앞에서 멈춘다');
    const perHit = (gate.maxHp - gate.hp) / drainEvents(st).filter((ev) => ev.type === 'enemyShot').length;
    assert.ok(perHit > boss.atk, '보스의 성문 공격은 평소보다 세다');
    const s2 = createGame('fortress');
    noHero(s2);
    const g2 = s2.gates[0];
    const shade = spawnBefore(s2, g2, 'shade', 1.2);
    run(s2, ENEMIES.shade.blink.every * 0.7 + 0.2);
    assert.ok(shade.d < g2.blocks[0].d, '순간이동해도 문 앞에 멈춘다');
});

test('자폭병은 성문 곁에서 터지면 문을 크게 상하게 한다', () => {
    const st = createGame('fortress');
    noHero(st);
    const gate = st.gates[0];
    const c = spawnBefore(st, gate, 'cinderling', 0.8);
    dealDamage(st, c, 1e9, 'true');
    assert.ok(gate.hp < gate.maxHp);
});

test('한 길에 성문을 줄줄이 놓으면 앞 문이 무너져야 다음 문까지 간다', () => {
    // 관문 돌파(②)용 구조 확인: 경로 거리로 지정한 성문 두 개
    MAPS.__gates = {
        ...MAPS.fortress,
        id: '__gates',
        paths: [
            [
                [-12, 0],
                [12, 0]
            ]
        ],
        gates: [
            { path: 0, d: 8, name: '첫 관문' },
            { path: 0, d: 16, name: '둘째 관문' }
        ],
        sockets: [[0, 3]],
        links: [],
        hero: [0, 3]
    };
    try {
        const st = createGame('__gates');
        noHero(st);
        assert.deepEqual(
            st.gates.map((g) => g.blocks[0].d),
            [8, 16]
        );
        const e = spawnEnemyAt(st, 'grunt', 6);
        e.hp = e.maxHp = 1e7;
        run(st, 3);
        assert.equal(e.gateId, 0);
        st.gates[0].hp = 1;
        run(st, 9);
        assert.equal(st.gates[0].broken, true);
        assert.equal(e.gateId, 1, '두 번째 성문 앞에 멈춘다');
        assert.ok(e.d > 8 && e.d < 16);
    } finally {
        delete MAPS.__gates;
    }
});
