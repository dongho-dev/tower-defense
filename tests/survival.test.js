// 살아남기(기나긴 밤): 사방에서 오는 적, 밤 시계, 동틀 녘 승리, 레인·소켓 배치
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    createGame,
    step,
    callWave,
    canCallWave,
    continueEndless,
    drainEvents,
    spawnEnemyAt,
    TICK
} from '../src/core/game.js';
import { buildPath } from '../src/core/path.js';
import { MAPS } from '../src/core/data/maps.js';
import { WAVES } from '../src/core/data/waves.js';
import { pickLane, laneAngle, nightPhase, directionLabel, formatClock } from '../src/core/survival.js';

const run = (st, sec, onEvents) => {
    for (let t = 0; t < sec && st.status === 'playing'; t += TICK) {
        step(st, TICK);
        const evs = drainEvents(st);
        if (onEvents) onEvents(evs);
    }
};

/** 적을 모두 지워서 시간만 흐르게 한다 (승리 조건 확인용) */
function runClean(st, sec, onEvents) {
    for (let t = 0; t < sec && st.status === 'playing'; t += TICK) {
        step(st, TICK);
        for (const e of st.enemies) e.alive = false;
        st.enemies = [];
        const evs = drainEvents(st);
        if (onEvents) onEvents(evs);
    }
}

test('기나긴 밤: 공성전 전용 살아남기 맵, 영웅 없이 타워만', () => {
    const m = MAPS.longnight;
    assert.equal(m.siegeOnly, true);
    assert.equal(m.genre, 'survival');
    assert.equal(MAPS.fortress.genre, 'defense');
    const st = createGame('longnight');
    assert.equal(st.siege, true);
    assert.equal(st.hero, null);
    assert.ok(st.survival);
    assert.equal(st.survival.dawn, 600);
    // 성채 방어에는 그대로 영웅이 있다
    assert.ok(createGame('fortress').hero);
    assert.equal(createGame('fortress').survival, null);
});

test('레인: 모든 레인이 섬 가장자리에서 출발해 수정에서 끝나고, 소켓을 밟지 않는다', () => {
    const st = createGame('longnight');
    assert.ok(st.paths.length >= 48);
    for (const p of st.paths) {
        const r = Math.hypot(p.xs[0] / st.map.island.rx, p.zs[0] / st.map.island.rz);
        assert.ok(r > 0.85 && r < 0.98, `출발점이 가장자리가 아님: ${r.toFixed(2)}`);
        assert.ok(Math.hypot(p.xs[p.count - 1], p.zs[p.count - 1]) < 0.01);
    }
    for (const s of st.sockets) {
        let best = Infinity;
        for (const p of st.paths)
            for (let i = 0; i < p.count - 10; i++) best = Math.min(best, Math.hypot(p.xs[i] - s.x, p.zs[i] - s.z));
        assert.ok(best > 1.0, `소켓 ${s.id}이 레인과 너무 가깝다: ${best.toFixed(2)}`);
    }
    // 모든 소켓이 공명 연결을 하나 이상 갖는다
    assert.ok(st.sockets.every((s) => s.links.length > 0));
});

test('적이 사방 가장자리에서 나온다 (전 방위 웨이브는 8방위를 고루 채운다)', () => {
    const st = createGame('longnight');
    const sectors = new Set();
    for (let id = 1; id < 400; id++) {
        const lane = pickLane(st, {}, id);
        sectors.add(Math.floor(laneAngle(st, lane) / 45));
    }
    assert.equal(sectors.size, 8);

    // 실제 게임: 첫 다섯 웨이브의 스폰 위치가 가장자리이고 여러 방향에 걸친다
    const spawns = [];
    callWave(st);
    runClean(st, 150, (evs) => {
        for (const e of evs) if (e.type === 'spawn' && !e.minion) spawns.push(e);
    });
    assert.ok(spawns.length > 40);
    const dirs = new Set();
    for (const s of spawns) {
        const r = Math.hypot(s.x / st.map.island.rx, s.z / st.map.island.rz);
        assert.ok(r > 0.8, '가장자리가 아닌 곳에서 나왔다');
        dirs.add(Math.floor(((Math.atan2(s.z, s.x) * 180) / Math.PI + 360) / 45) % 8);
    }
    assert.ok(dirs.size >= 6, `방향 ${dirs.size}곳`);
});

test('그룹 방향: 북쪽(270도)에서 오는 무리는 섬 북쪽 가장자리에서 나온다', () => {
    const st = createGame('longnight');
    for (let id = 1; id < 200; id++) {
        const lane = pickLane(st, { from: 270, spread: 25 }, id);
        const p = st.paths[lane];
        assert.ok(p.zs[0] < -8, `북쪽이 아님: z=${p.zs[0]}`);
    }
    assert.equal(directionLabel({ groups: [{ from: 270 }, { from: 0 }] }), '북·동');
    assert.equal(directionLabel({ groups: [{}] }), '사방');
});

test('수정에 닿으면 생명이 줄고, 수정 가까이 온 적은 곧 닿는다', () => {
    const st = createGame('longnight');
    callWave(st);
    st.spawners = [];
    const lane = 17;
    const len = st.paths[lane].length;
    const e = spawnEnemyAt(st, 'grunt', len - 0.5, { path: lane });
    e.hp = e.maxHp = 1e9;
    const lives = st.lives;
    let leaked = 0;
    run(st, 3, (evs) => (leaked += evs.filter((v) => v.type === 'leak').length));
    assert.equal(leaked, 1);
    assert.equal(st.lives, lives - 1);
});

test('밤 시계: 웨이브는 정해진 시각에 저절로 오고, 앞 웨이브가 나오는 중이어도 온다', () => {
    const st = createGame('longnight');
    const waves = st.waves;
    assert.ok(waves.length >= 15);
    assert.ok(waves.every((w, i) => i === 0 || w.at > waves[i - 1].at));
    assert.ok(waves[waves.length - 1].at < 600);
    // 첫 웨이브를 부르기 전에는 시계가 멈춰 있다
    run(st, 5);
    assert.equal(st.survival.clock, 0);
    assert.equal(st.waveIndex, 0);
    callWave(st);
    runClean(st, waves[1].at + 0.5);
    assert.equal(st.waveIndex, 2);
    // 스폰 중에는 일찍 부를 수 없다
    st.spawners.push({ group: { enemy: 'grunt', count: 99, gap: 5, delay: 0 }, waveNo: 2, spawned: 0, nextAt: 1e9 });
    runClean(st, 0.1);
    assert.equal(canCallWave(st), false);
    // 그래도 시각이 되면 다음 웨이브가 온다
    runClean(st, waves[2].at - st.survival.clock + 0.2);
    assert.equal(st.waveIndex, 3);
});

test('일찍 부르면 밤 시계가 그 웨이브 시각까지 앞당겨지고 보너스를 받는다', () => {
    const st = createGame('longnight');
    callWave(st);
    runClean(st, 20);
    assert.ok(canCallWave(st));
    const gold = st.gold;
    const r = callWave(st);
    assert.ok(r.ok && r.bonus > 0);
    assert.ok(st.gold >= gold + r.bonus);
    assert.equal(Math.round(st.survival.clock), st.waves[1].at);
});

test('동이 틀 때까지 버티면 승리, 남은 적은 햇빛에 타 사라진다', () => {
    const st = createGame('longnight');
    callWave(st);
    const seen = [];
    // 막판 대공세 직전까지는 적을 지우며 시간만 보낸다
    runClean(st, 575, (evs) => seen.push(...evs.map((e) => e.type)));
    assert.equal(st.status, 'playing');
    assert.ok(nightPhase(st).night > 0.9, '밤이 깊어져야 한다');
    // 마지막 공세는 무적 수정으로 버틴다
    st.lives = 1e6;
    let burned = 0;
    run(st, 60, (evs) => {
        seen.push(...evs.map((e) => e.type));
        burned += evs.filter((e) => e.type === 'dawnBurn').length;
    });
    assert.equal(st.status, 'won');
    assert.equal(st.survival.clock, 600);
    assert.ok(seen.includes('dawn') && seen.includes('victory'));
    assert.ok(burned > 0, '동틀 녘에 남아 있던 적이 타 사라져야 한다');
    assert.equal(st.enemies.length, 0);
    assert.equal(nightPhase(st).dawn, 1);
    assert.equal(continueEndless(st).ok, false);
});

test('생명이 다하면 동트기 전에 패배한다', () => {
    const st = createGame('longnight');
    callWave(st);
    run(st, 200);
    assert.equal(st.status, 'lost');
    assert.ok(st.survival.clock < 120);
});

test('formatClock: 남은 시간을 m:ss로', () => {
    assert.equal(formatClock(600), '10:00');
    assert.equal(formatClock(61.2), '1:02');
    assert.equal(formatClock(0), '0:00');
});

test('웨이브 데이터: 정예와 보스 웨이브가 섞여 있고 방향이 바뀐다', () => {
    const w = WAVES.longnight;
    assert.ok(w.some((x) => x.groups.some((g) => g.elite)));
    assert.ok(w.filter((x) => x.groups.some((g) => g.enemy === 'colossus')).length >= 2);
    const labels = new Set(w.map(directionLabel));
    assert.ok(labels.size >= 8, `방향 조합 ${labels.size}가지`);
    // 다른 맵의 경로 데이터는 그대로
    for (const id of ['dusk', 'frostvale', 'voidspire', 'cinder', 'bloom', 'stormreach', 'fortress'])
        assert.ok(MAPS[id].paths.every((p) => buildPath(p).length > 5));
});
