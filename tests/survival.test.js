// 살아남기(눈마루 고개): 산 지형 길 찾기, 동굴 출현, 가장 가까운 건물 공격, 본진·광산·수리, 밤 시계
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    createGame,
    step,
    callWave,
    continueEndless,
    drainEvents,
    spawnEnemyAt,
    buildTower,
    sellTower,
    repairBase,
    baseRepairCost,
    buildableTypes,
    towerStats,
    TICK
} from '../src/core/game.js';
import { MAPS } from '../src/core/data/maps.js';
import { WAVES } from '../src/core/data/waves.js';
import {
    computeFlow,
    flowDistance,
    nightPhase,
    caveLabel,
    waveCaves,
    formatClock,
    TOWER_R
} from '../src/core/survival.js';
import { createLayout } from '../src/core/mountain.js';

const run = (st, sec, onEvents) => {
    for (let t = 0; t < sec && st.status === 'playing'; t += TICK) {
        step(st, TICK);
        const evs = drainEvents(st);
        if (onEvents) onEvents(evs);
    }
};

/** 웨이브 적은 지우고 시간만 흐르게 한다 (시계·수입·승리 조건 확인용) */
function runClean(st, sec, onEvents) {
    for (let t = 0; t < sec && st.status === 'playing'; t += TICK) {
        step(st, TICK);
        st.enemies = [];
        st.spawners = [];
        const evs = drainEvents(st);
        if (onEvents) onEvents(evs);
    }
}

const fresh = () => {
    const st = createGame('mountain');
    st.waves = [];
    return st;
};

test('눈마루 고개: 공성전 전용 살아남기 맵, 영웅 없음, 본진 체력이 생명', () => {
    const m = MAPS.mountain;
    assert.equal(m.siegeOnly, true);
    assert.equal(m.genre, 'survival');
    assert.equal(MAPS.fortress.genre, 'defense');
    assert.equal(MAPS.longnight, undefined);
    const st = createGame('mountain');
    assert.equal(st.siege, true);
    assert.equal(st.hero, null);
    assert.ok(st.survival);
    assert.equal(st.lives, m.lives);
    assert.equal(st.survival.dawn, 600);
    // 난이도는 본진 체력 배율로만
    assert.ok(createGame('mountain', { difficulty: 'hero' }).lives > 100);
    assert.ok(createGame('mountain', { difficulty: 'easy' }).lives > st.lives);
    // 다른 맵에는 살아남기 상태가 없다
    assert.equal(createGame('fortress').survival, null);
    assert.equal(createGame('dusk').survival, null);
});

test('산 배치: 소켓·동굴·본진은 걸을 수 있는 땅 위, 고원마다 높이가 다르다', () => {
    const st = createGame('mountain');
    const sv = st.survival;
    for (const s of st.sockets) assert.ok(sv.nav.walkable(s.x, s.z), `소켓 ${s.id}`);
    for (const c of sv.caves) assert.ok(sv.nav.walkable(c.x, c.z), c.id);
    assert.ok(sv.nav.walkable(sv.base.x, sv.base.z));
    const layout = createLayout(m());
    const h = (id) => layout.byId[id].h;
    assert.ok(h('base') > h('west') && h('west') > h('south') && h('south') > h('caveS'));
    assert.ok(h('summit') > h('base'));
    // 바위(고원 사이)는 걸을 수 없다
    assert.equal(sv.nav.walkable(-5, 2), false);
    function m() {
        return MAPS.mountain.survival;
    }
});

test('길 찾기: 세 동굴 모두 본진까지 이어지고, 거리장은 건물이 바뀔 때만 다시 구한다', () => {
    const st = fresh();
    const sv = st.survival;
    for (const c of sv.caves) {
        const d = flowDistance(st, c.x, c.z);
        assert.ok(Number.isFinite(d) && d < 60, `${c.id} → 본진 ${d}`);
    }
    const builds = sv.flowBuilds;
    step(st, TICK);
    step(st, TICK);
    assert.equal(sv.flowBuilds, builds, '건물 변화 없으면 다시 구하지 않음');
    st.gold = 9999;
    const r = buildTower(st, 20, 'ranger');
    assert.ok(r.ok);
    assert.equal(sv.flowDirty, true);
    computeFlow(st);
    // 서남 기슭에 타워가 생기면 서쪽 동굴에서 가장 가까운 건물은 그 타워
    const cw = sv.caves.find((c) => c.id === 'caveW');
    assert.ok(flowDistance(st, cw.x, cw.z) < 8);
    sellTower(st, r.tower.id);
    assert.equal(sv.flowDirty, true);
});

test('적은 동굴에서 나와 걸어서 가장 가까운 건물로 가서 부순다', () => {
    const st = fresh();
    st.gold = 9999;
    const { tower } = buildTower(st, 20, 'ranger');
    tower.stunT = 999; // 타워가 쏘지 못하게
    const e = spawnEnemyAt(st, 'ironclad', 0, { cave: 'caveW', waveNo: 10 });
    spawnEnemyAt(st, 'ironclad', 0, { cave: 'caveW', waveNo: 10 });
    const cw = st.survival.caves.find((c) => c.id === 'caveW');
    assert.ok(Math.hypot(e.x - cw.x, e.z - cw.z) < 1);
    let shots = 0;
    let destroyed = false;
    run(st, 90, (evs) => {
        for (const ev of evs) {
            if (ev.type === 'enemyShot' && ev.towerId === tower.id) shots++;
            if (ev.type === 'towerDestroyed' && ev.towerId === tower.id) destroyed = true;
        }
        // 이동 중에도 늘 걸을 수 있는 땅 위
        if (e.alive) assert.ok(st.survival.nav.walkable(e.x, e.z), `${e.x},${e.z}`);
    });
    assert.ok(shots > 0, '타워를 공격');
    assert.ok(destroyed, '타워가 무너짐');
    assert.equal(st.towers.length, 0);
    assert.equal(st.sockets[20].towerId, null);
});

test('건물이 없으면 본진을 친다. 본진이 무너지면 패배', () => {
    const st = fresh();
    for (let i = 0; i < 12; i++) spawnEnemyAt(st, 'ironclad', 0, { cave: 'caveS', waveNo: 15 });
    let baseHits = 0;
    run(st, 400, (evs) => (baseHits += evs.filter((e) => e.type === 'enemyShot' && e.base).length));
    assert.ok(baseHits > 0);
    assert.equal(st.status, 'lost');
    assert.equal(st.lives, 0);
});

test('하늘의 적은 지형을 무시하고 가장 가까운 건물로 곧장 난다', () => {
    const st = fresh();
    st.gold = 9999;
    const { tower } = buildTower(st, 12, 'ranger'); // 동쪽 고원
    tower.stunT = 999;
    const e = spawnEnemyAt(st, 'wraith', 0, { cave: 'caveE' });
    let over = false;
    run(st, 12, () => {
        if (e.alive && !st.survival.nav.walkable(e.x, e.z)) over = true;
    });
    assert.equal(e.atkTargetId, tower.id);
    assert.ok(over, '바위 위를 날아 넘어감');
});

test('광맥에는 광산만, 그 밖에는 광산을 지을 수 없다. 광산은 시간마다 수입 배율만큼 캔다', () => {
    const st = fresh();
    st.gold = 9999;
    const vein = st.sockets.find((s) => s.vein && s.vein.yield > 1);
    const pad = st.sockets.find((s) => !s.vein);
    assert.deepEqual(buildableTypes(st, vein), ['mine']);
    assert.ok(!buildableTypes(st, pad).includes('mine'));
    assert.equal(buildTower(st, vein.id, 'ranger').ok, false);
    assert.equal(buildTower(st, pad.id, 'mine').ok, false);
    const { tower } = buildTower(st, vein.id, 'mine');
    const gold0 = st.gold;
    const pays = [];
    runClean(st, st.survival.payEvery * 2 + 0.5, (evs) => pays.push(...evs.filter((e) => e.type === 'income')));
    assert.equal(pays.length, 2);
    const each = Math.round(towerStats(st, tower).income * vein.vein.yield);
    assert.equal(pays[0].amount, each);
    assert.ok(st.gold >= gold0 + each * 2);
});

test('타워는 저절로 고쳐지지 않고, 본진은 골드로 수리한다', () => {
    const st = createGame('mountain');
    st.gold = 9999;
    const { tower } = buildTower(st, 0, 'ranger');
    tower.hp = 10;
    callWave(st);
    assert.equal(tower.hp, 10, '웨이브 시작 회복 없음');
    st.lives = st.maxLives - 100;
    const cost = baseRepairCost(st);
    assert.ok(cost > 0);
    const g0 = st.gold;
    assert.ok(repairBase(st).ok);
    assert.equal(st.lives, st.maxLives);
    assert.equal(st.gold, g0 - cost);
    assert.equal(repairBase(st).ok, false);
});

test('높은 곳의 타워는 사거리가 길다', () => {
    const st = fresh();
    st.gold = 9999;
    const hi = buildTower(st, 0, 'ranger').tower; // 본진 고원
    const lo = buildTower(st, 21, 'ranger').tower; // 서남 기슭
    assert.ok(towerStats(st, hi).range > towerStats(st, lo).range);
});

test('밤 시계는 판이 시작되면 흐르고, 웨이브는 정해진 시각에 저절로 온다', () => {
    const st = createGame('mountain');
    const waves = st.waves;
    assert.equal(st.waveIndex, 0);
    runClean(st, waves[0].at - 1);
    assert.equal(st.waveIndex, 0, '준비 시간');
    assert.ok(st.nextWaveIn > 0 && st.nextWaveIn < 2);
    runClean(st, 1.5);
    assert.equal(st.waveIndex, 1);
    runClean(st, waves[2].at - st.survival.clock + 0.2);
    assert.equal(st.waveIndex, 3);
});

test('일찍 부르면 시계가 그 웨이브 시각으로 앞당겨지고 보너스를 받는다', () => {
    const st = createGame('mountain');
    runClean(st, 5);
    const g0 = st.gold;
    const r = callWave(st);
    assert.ok(r.ok && r.bonus > 0);
    assert.equal(st.gold, g0 + r.bonus);
    assert.equal(Math.round(st.survival.clock), st.waves[0].at);
});

test('동이 트면 남은 적이 사라지고 승리, 끝없는 밤으로 잇지 않는다', () => {
    const st = createGame('mountain');
    st.survival.clock = 599;
    st.waveIndex = st.waves.length;
    spawnEnemyAt(st, 'grunt', 0, { cave: 'caveS' });
    const evs = [];
    run(st, 2, (e) => evs.push(...e));
    assert.equal(st.status, 'won');
    assert.ok(evs.some((e) => e.type === 'dawnBurn'));
    assert.ok(evs.some((e) => e.type === 'dawn'));
    assert.equal(st.survival.clock, 600);
    assert.equal(continueEndless(st).ok, false);
    assert.equal(nightPhase(st).dawn, 1);
});

test('웨이브 정의: 시각 순서, 동굴 이름, 막판 대공세', () => {
    const w = WAVES.mountain;
    assert.equal(w.length, 20);
    for (let i = 1; i < w.length; i++) assert.ok(w[i].at > w[i - 1].at);
    assert.ok(w[w.length - 1].at < 600);
    const st = createGame('mountain');
    const ids = st.survival.caves.map((c) => c.id);
    for (const wave of w) for (const g of wave.groups) if (g.cave) assert.ok(ids.includes(g.cave), g.cave);
    assert.equal(caveLabel(st, w[0]), '남쪽 동굴');
    assert.deepEqual(waveCaves(st, w[1]), ['caveW']);
    assert.equal(caveLabel(st, w[w.length - 1]), '모든 동굴');
    assert.equal(formatClock(61), '1:01');
    assert.ok(TOWER_R > 0);
});
