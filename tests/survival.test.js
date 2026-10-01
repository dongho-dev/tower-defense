// 살아남기 '얼어붙은 분지': 넓은 설원, 자유 배치 건설, 흐름장 길 찾기·벽 부수기, 탐험 안개, 승패.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    createGame,
    step,
    drainEvents,
    placeBase,
    placeBuilding,
    sellTower,
    callWave,
    spawnEnemyAt,
    upgradeTower,
    TICK
} from '../src/core/game.js';
import { MAPS } from '../src/core/data/maps.js';
import { WAVES } from '../src/core/data/waves.js';
import { KIND, reachable } from '../src/core/snowfield.js';
import { checkPlacement, computeFlow, updateFog, nightPhase, footprintCenter } from '../src/core/survival.js';
import { sitePlan } from './survivalAi.js';

const run = (state, sec) => {
    for (let t = 0; t < sec && state.status === 'playing'; t += TICK) {
        step(state, TICK);
        drainEvents(state);
    }
};

/** 판을 만들고 명당(기본 북서 벼랑)에 본진을 세운다 */
function started(siteId = 'nw', opts) {
    const s = createGame('mountain', opts);
    const site = s.survival.field.sites.find((x) => x.id === siteId);
    assert.ok(placeBase(s, site.base[0], site.base[1]).ok);
    return { s, site, f: s.survival.field };
}

const cellOf = (f, x, z) => {
    const k = f.cellAt(x, z);
    return { i: k % f.N, j: Math.floor(k / f.N), k };
};

test('얼어붙은 분지: 공성전 전용 살아남기, 영웅·소켓 없음, 스타 96×96급 넓은 맵', () => {
    const m = MAPS.mountain;
    assert.equal(m.genre, 'survival');
    assert.ok(m.siegeOnly && m.noHero);
    assert.equal(m.sockets.length, 0);
    const s = createGame('mountain');
    assert.equal(s.hero, null);
    const f = s.survival.field;
    assert.equal(f.N, 96);
    // 예전 섬(34 × 25 단위)보다 가로 3배 넘게, 면적 10배 넘게
    const width = f.N * f.T;
    assert.ok(width >= 34 * 3, `맵 폭 ${width}`);
    assert.ok(width * width >= 34 * 25 * 10);
    assert.equal(s.lives, m.lives);
});

test('지형: 높이 세 단, 절벽·비탈·바위 능선, 가장자리는 막혀 있고 명당·광맥은 모두 둥지에서 걸어서 닿는다', () => {
    const f = createGame('mountain').survival.field;
    const kinds = new Set(f.kind);
    for (const k of [KIND.ground, KIND.ramp, KIND.cliff, KIND.rock, KIND.border, KIND.nest]) assert.ok(kinds.has(k));
    assert.deepEqual([...new Set(f.level)].sort(), [0, 1, 2]);
    // 맵 테두리는 걸을 수 없다
    for (let i = 0; i < f.N; i++) {
        assert.ok(!f.walkableKind(i) && !f.walkableKind((f.N - 1) * f.N + i));
        assert.ok(!f.walkableKind(i * f.N) && !f.walkableKind(i * f.N + f.N - 1));
    }
    // 둥지 입구에서 닿는 칸
    let start = -1;
    for (let k = 0; k < f.N * f.N && start < 0; k++) if (f.walkableKind(k) && f.level[k] === 0) start = k;
    const seen = reachable(f, start);
    for (let k = 0; k < f.N * f.N; k++) if (f.walkableKind(k)) assert.ok(seen[k], `닿지 않는 칸 ${k}`);
    assert.ok(f.sites.length >= 5 && f.sites.length <= 8);
    const ramps = f.sites.map((s) => s.rampCount);
    assert.ok(Math.min(...ramps) === 1 && Math.max(...ramps) === 3, `입구 수 ${ramps}`);
    for (const s of f.sites) {
        const [bi, bj] = s.base;
        for (let dj = 0; dj < 4; dj++) for (let di = 0; di < 4; di++) assert.ok(seen[(bj + dj) * f.N + bi + di]);
        assert.equal(f.level[(bj + 1) * f.N + bi + 1], 2, `${s.id} 본진 자리는 고원`);
    }
    for (const v of f.veins) assert.ok(seen[v.j * f.N + v.i]);
    assert.ok(f.veins.length >= 20);
});

test('본진을 세우기 전에는 시계가 멈춰 있고 웨이브를 부를 수 없다. 둥지 가까이는 못 세운다', () => {
    const s = createGame('mountain');
    run(s, 5);
    assert.equal(s.survival.clock, 0);
    assert.equal(callWave(s).ok, false);
    assert.equal(placeBuilding(s, 'wall', 30, 30).ok, false);
    const c = s.survival.field.center;
    assert.equal(placeBase(s, c.i + 6, c.j).ok, false);
    const site = s.survival.field.sites[0];
    assert.ok(placeBase(s, site.base[0], site.base[1]).ok);
    assert.equal(placeBase(s, site.base[0], site.base[1]).ok, false);
    run(s, 3);
    assert.ok(s.survival.clock > 2.9);
});

test('자유 배치: 빈 땅 어디든 격자에 맞춰 짓고, 절벽·바위·겹침·미탐험 땅·둥지 곁에는 못 짓는다', () => {
    const { s, site, f } = started();
    s.gold = 5000;
    const b = s.survival.base;
    // 본진 옆 빈 땅
    const i = b.i + 5;
    const j = b.j;
    assert.ok(placeBuilding(s, 'wall', i, j).ok);
    assert.equal(placeBuilding(s, 'wall', i, j).reason, '이미 건물이 있습니다.');
    const tower = placeBuilding(s, 'ranger', i + 1, j);
    assert.ok(tower.ok, tower.reason);
    assert.equal(tower.tower.cell.s, 2);
    // 겹치는 2×2
    assert.equal(placeBuilding(s, 'frost', i + 2, j + 1).ok, false);
    // 절벽·바위
    const cliff = [...f.kind.keys()].find((k) => f.kind[k] === KIND.cliff && s.survival.fog.explored[k]);
    assert.match(checkPlacement(s, 'wall', cliff % f.N, Math.floor(cliff / f.N)).reason, /절벽/);
    // 아직 탐험하지 않은 땅 (맵 반대편 구석 벌판)
    const far = [...f.kind.keys()].find((k) => f.walkableKind(k) && !s.survival.fog.explored[k] && !f.nobuild[k]);
    assert.match(checkPlacement(s, 'wall', far % f.N, Math.floor(far / f.N)).reason, /탐험/);
    // 둥지 곁
    assert.equal(checkPlacement(s, 'wall', f.center.i + 5, f.center.j).ok, false);
    // 팔면 칸이 빈다
    sellTower(s, tower.tower.id);
    assert.ok(placeBuilding(s, 'frost', i + 1, j).ok);
    void site;
});

test('광산은 광맥 2×2에 꼭 맞게만, 광맥에는 다른 건물을 못 짓는다. 광산은 시간마다 캔다', () => {
    const { s, f } = started();
    const v = f.veins.find((x) => x.site === f.sites.find((q) => q.id === 'nw').n);
    s.gold = 1000;
    assert.equal(placeBuilding(s, 'ranger', v.i, v.j).ok, false);
    assert.equal(placeBuilding(s, 'wall', v.i + 1, v.j + 1).ok, false);
    assert.equal(placeBuilding(s, 'mine', v.i + 1, v.j).ok, false);
    const m = placeBuilding(s, 'mine', v.i, v.j);
    assert.ok(m.ok, m.reason);
    assert.equal(m.tower.veinId, v.id);
    const gold = s.gold;
    run(s, s.survival.payEvery + 0.1);
    const want = Math.round(20 * (v.yield ?? 1) * (s.survival.cfg.mineMul ?? 1));
    assert.ok(s.gold - gold >= want, `${s.gold - gold} < ${want}`);
});

test('흐름장: 적은 둥지에서 걸어 나와 본진까지 간다', () => {
    const { s } = started();
    computeFlow(s);
    const e = spawnEnemyAt(s, 'grunt', 0, { x: s.survival.nest.gates[0].x, z: s.survival.nest.gates[0].z });
    const b = s.survival.base;
    const d0 = Math.hypot(e.x - b.x, e.z - b.z);
    run(s, 25);
    assert.ok(e.alive);
    assert.ok(Math.hypot(e.x - b.x, e.z - b.z) < d0 - 20, '본진 쪽으로 다가왔다');
});

test('길을 완전히 막으면 적은 벽 바깥 줄부터 부순다. 짧게 돌아갈 길이 있으면 돌아간다', () => {
    const { s, f } = started('nw');
    s.gold = 99999;
    const plan = sitePlan(s, 'nw');
    const N = f.N;
    for (const k of plan.wall1) assert.ok(placeBuilding(s, 'wall', k % N, Math.floor(k / N)).ok);
    for (const k of plan.wall2) placeBuilding(s, 'wall', k % N, Math.floor(k / N));
    const outer = new Set(plan.wall1);
    // 비탈 아래(벌판)에 적을 놓는다
    const ramp = f.ramps.find((r) => r.owner === 'nw');
    const p = { x: -f.half + (ramp.to[0] + 0.5) * f.T, z: -f.half + (ramp.to[1] + 0.5) * f.T };
    const e = spawnEnemyAt(s, 'ironclad', 0, { x: p.x, z: p.z });
    e.atk = 400;
    let firstHit = null;
    for (let t = 0; t < 60 && !firstHit; t += TICK) {
        step(s, TICK);
        for (const ev of drainEvents(s))
            if (ev.type === 'enemyShot' && ev.towerId != null && !firstHit) firstHit = ev.towerId;
    }
    assert.ok(firstHit, '벽을 쳤다');
    const hit = s.towers.find((t) => t.id === firstHit) || { cell: null };
    if (hit.cell) assert.ok(outer.has(hit.cell.j * N + hit.cell.i), '바깥 줄 벽부터');
    // 벽 한 칸을 비워 틈을 내면 (돌아가는 길이 짧으면) 그 틈으로 지나간다
    // 벽이 없을 때의 거리 (틈으로 지나가면 이와 비슷하다)
    const bare = started('nw').s;
    computeFlow(bare);
    const open = bare.survival.dist[f.cellAt(p.x, p.z)];
    let s2 = null;
    for (let gap = 0; gap < plan.wall1.length && !s2; gap++) {
        const t2 = started('nw').s;
        t2.gold = 99999;
        plan.wall1.forEach((k, n) => n !== gap && placeBuilding(t2, 'wall', k % N, Math.floor(k / N)));
        computeFlow(t2);
        // 틈으로 벽을 부수지 않고 지나갈 수 있으면 거리가 벽 부수는 값보다 작다
        if (t2.survival.dist[f.cellAt(p.x, p.z)] < open + 3) s2 = t2;
    }
    assert.ok(s2, '틈이 길을 연다');
    const e2 = spawnEnemyAt(s2, 'grunt', 0, { x: p.x, z: p.z });
    let wallHit = false;
    for (let t = 0; t < 40; t += TICK) {
        step(s2, TICK);
        for (const ev of drainEvents(s2))
            if (ev.type === 'enemyShot' && s2.towers.find((t2) => t2.id === ev.towerId)?.type === 'wall')
                wallHit = true;
    }
    assert.equal(wallHit, false, '틈이 있으면 벽을 치지 않는다');
    assert.ok(e2.atkTargetId === 'base' || Math.hypot(e2.x - s2.survival.base.x, e2.z - s2.survival.base.z) < 8);
});

test('벽을 부수면 칸이 비고 길이 다시 열린다 (흐름장은 건물이 바뀔 때만 다시 구한다)', () => {
    const { s } = started();
    s.gold = 999;
    const b = s.survival.base;
    computeFlow(s);
    const builds = s.survival.flowBuilds;
    run(s, 1);
    assert.equal(s.survival.flowBuilds, builds);
    const w = placeBuilding(s, 'wall', b.i + 6, b.j).tower;
    assert.equal(s.survival.flowDirty, true);
    computeFlow(s);
    assert.equal(s.survival.flowBuilds, builds + 1);
    const k = w.cell.j * s.survival.field.N + w.cell.i;
    assert.equal(s.survival.occ[k], w.id);
    w.hp = 1;
    const e = spawnEnemyAt(s, 'grunt', 0, { x: w.x + 0.9, z: w.z });
    e.atkCd = 0;
    // 방벽을 직접 쳐서 부순다
    for (let t = 0; t < 3 && s.towers.includes(w); t += TICK) {
        e.atkTarget = w;
        step(s, TICK);
        drainEvents(s);
    }
    assert.ok(!s.towers.includes(w));
    assert.equal(s.survival.occ[k], 0);
});

test('방벽은 레벨마다 체력이 오르고 분기가 없다', () => {
    const { s } = started();
    s.gold = 999;
    const b = s.survival.base;
    const w = placeBuilding(s, 'wall', b.i + 6, b.j).tower;
    const hp1 = w.maxHp;
    assert.ok(upgradeTower(s, w.id).ok);
    assert.ok(upgradeTower(s, w.id).ok);
    assert.ok(w.maxHp > hp1 * 2);
    assert.equal(upgradeTower(s, w.id, 'a').ok, false);
});

test('탐험 안개: 처음엔 둥지와 명당 후보만 보이고, 건물 둘레가 밝혀진다. 안개 속 적은 숨는다', () => {
    const s = createGame('mountain');
    const sv = s.survival;
    const f = sv.field;
    const explored = sv.fog.explored.reduce((a, v) => a + v, 0);
    assert.ok(explored < f.N * f.N * 0.45, `처음 밝혀진 칸 ${explored}`);
    const site = f.sites[0];
    placeBase(s, site.base[0], site.base[1]);
    const b = sv.base;
    assert.equal(sv.fog.visible[f.cellAt(b.x, b.z)], 1);
    // 멀리 떨어진 벌판의 적은 안개 속
    const far = f.sites[4];
    const e = spawnEnemyAt(s, 'grunt', 0, { x: far.x, z: far.z });
    updateFog(s, true);
    assert.equal(e.fogged, true);
    const near = spawnEnemyAt(s, 'grunt', 0, { x: b.x + 4, z: b.z });
    updateFog(s, true);
    assert.equal(near.fogged, false);
});

test('하늘의 적은 벽을 넘어 가장 가까운 지킬 건물로 곧장 난다', () => {
    const { s } = started();
    const b = s.survival.base;
    const e = spawnEnemyAt(s, 'harpy', 0, { x: b.x + 20, z: b.z + 20 });
    run(s, 30);
    assert.equal(e.atkTargetId, 'base');
});

test('본진이 무너지면 패배, 동이 트면 남은 적이 사라지고 승리 (끝없는 밤으로 잇지 않는다)', () => {
    const lose = started().s;
    run(lose, 400);
    assert.equal(lose.status, 'lost');
    const win = started().s;
    win.survival.clock = win.survival.dawn - 0.5;
    win.waveIndex = win.waves.length;
    spawnEnemyAt(win, 'grunt', 0, { x: 0, z: 6 });
    run(win, 1);
    assert.equal(win.status, 'won');
    assert.equal(win.enemies.length, 0);
    assert.ok(nightPhase(win).dawn > 0.99);
});

test('웨이브 정의: 20웨이브가 시각 순서로 동트기 전에, 6·10·14분에 빙하 거신', () => {
    const w = WAVES.mountain;
    assert.equal(w.length, 20);
    for (let i = 1; i < w.length; i++) assert.ok(w[i].at > w[i - 1].at);
    assert.ok(w[w.length - 1].at < MAPS.mountain.survival.dawn);
    const bossAt = w.filter((x) => x.groups.some((g) => g.enemy === 'glacier')).map((x) => x.at);
    assert.deepEqual(bossAt, [360, 600, 840]);
});

test('자유 배치 건물의 중심은 칸 격자에 맞는다', () => {
    const { s, f } = started();
    s.gold = 999;
    const sp = sitePlan(s, 'nw').spots[0];
    const r = placeBuilding(s, 'ember', sp.i, sp.j);
    assert.ok(r.ok, r.reason);
    const t = r.tower;
    const c = footprintCenter(f, sp.i, sp.j, 2);
    assert.ok(Math.abs(t.x - c.x) < 1e-9 && Math.abs(t.z - c.z) < 1e-9);
    assert.equal(cellOf(f, t.x - 0.1, t.z - 0.1).i, sp.i);
});
