// 살아남기 '얼어붙은 분지': 넓은 설원, 생존자(일꾼) 한 명, 검은 안개, 이산적인 단과 비탈 통로,
// 자유 배치 건설, 흐름장 길 찾기·벽 부수기, 이동 규칙(모서리 끼어들기 없음), 승패.
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
    orderBuild,
    orderMove,
    orderRepair,
    cancelOrders,
    upgradeMining,
    rampStates,
    damageTower,
    TICK
} from '../src/core/game.js';
import { MAPS } from '../src/core/data/maps.js';
import { WAVES } from '../src/core/data/waves.js';
import { KIND, RAMP_LEN, reachable } from '../src/core/snowfield.js';
import {
    checkPlacement,
    computeFlow,
    updateFog,
    nightPhase,
    footprintCenter,
    canStep,
    freeCell,
    WORKER,
    MINE_TECH
} from '../src/core/survival.js';
import { sitePlan, playSurvival } from './survivalAi.js';

const run = (state, sec) => {
    for (let t = 0; t < sec && state.status === 'playing'; t += TICK) {
        step(state, TICK);
        drainEvents(state);
    }
};

/** 판을 만들고 (안개를 걷고) 고원(기본 북서 벼랑)에 본진을 곧바로 세운 뒤 생존자를 본진 곁에 둔다 */
function started(siteId = 'nw', opts) {
    const s = createGame('mountain', opts);
    const sv = s.survival;
    const f = sv.field;
    sv.fog.explored.fill(1);
    const site = f.sites.find((x) => x.id === siteId);
    assert.ok(placeBase(s, site.base[0], site.base[1]).ok);
    const b = sv.base;
    const k = (b.j + b.s) * f.N + b.i;
    const p = f.toWorld(k % f.N, Math.floor(k / f.N));
    Object.assign(sv.worker, { x: p.x, z: p.z, sx: p.x, sz: p.z, lastK: k });
    return { s, site, f };
}

const cellOf = (f, x, z) => {
    const k = f.cellAt(x, z);
    return { i: k % f.N, j: Math.floor(k / f.N), k };
};

/** 둥지 입구 칸에서 걸어서(이동 규칙대로) 닿는 빈 칸 */
function walkFrom(s, start) {
    const sv = s.survival;
    const N = sv.field.N;
    const seen = new Uint8Array(N * N);
    const q = [start];
    seen[start] = 1;
    while (q.length) {
        const k = q.pop();
        const i = k % N;
        const j = (k - i) / N;
        for (let dj = -1; dj <= 1; dj++)
            for (let di = -1; di <= 1; di++) {
                const nk = (j + dj) * N + i + di;
                if ((!di && !dj) || seen[nk] || !canStep(sv, k, nk)) continue;
                seen[nk] = 1;
                q.push(nk);
            }
    }
    return seen;
}

test('얼어붙은 분지: 공성전 전용 살아남기, 영웅·소켓 없음, 스타 96×96급 넓은 맵', () => {
    const m = MAPS.mountain;
    assert.equal(m.genre, 'survival');
    assert.ok(m.siegeOnly && m.noHero);
    assert.equal(m.sockets.length, 0);
    const s = createGame('mountain');
    assert.equal(s.hero, null);
    const f = s.survival.field;
    assert.equal(f.N, 96);
    const width = f.N * f.T;
    assert.ok(width >= 34 * 3, `맵 폭 ${width}`);
    assert.equal(s.lives, m.lives);
});

test('지형: 단은 이산적(분지·벌판·고원)이고, 단이 다른 걸을 수 있는 칸끼리는 비탈로만 이어진다', () => {
    const f = createGame('mountain').survival.field;
    const kinds = new Set(f.kind);
    for (const k of [KIND.ground, KIND.ramp, KIND.cliff, KIND.rock, KIND.border, KIND.nest]) assert.ok(kinds.has(k));
    assert.deepEqual([...new Set(f.level)].sort(), [0, 1, 2]);
    const { N } = f;
    for (let j = 1; j < N - 1; j++)
        for (let i = 1; i < N - 1; i++) {
            const k = j * N + i;
            if (!f.walkableKind(k) || f.kind[k] === KIND.ramp) continue;
            // 평지 칸은 정확히 그 단의 높이 (매끈한 경사가 아무 데나 있지 않다)
            assert.ok(Math.abs(f.height[k] - f.levels[f.level[k]]) < 1e-5);
            for (let dj = -1; dj <= 1; dj++)
                for (let di = -1; di <= 1; di++) {
                    const nk = (j + dj) * N + i + di;
                    if (!f.walkableKind(nk) || f.kind[nk] === KIND.ramp) continue;
                    assert.equal(f.level[nk], f.level[k], `단이 다른 평지가 맞닿음 ${i},${j}`);
                }
        }
    // 맵 테두리는 걸을 수 없다
    for (let i = 0; i < N; i++) {
        assert.ok(!f.walkableKind(i) && !f.walkableKind((N - 1) * N + i));
        assert.ok(!f.walkableKind(i * N) && !f.walkableKind(i * N + N - 1));
    }
    // 둥지에서 모든 걸을 수 있는 칸에 닿는다
    let start = -1;
    for (let k = 0; k < N * N && start < 0; k++) if (f.walkableKind(k) && f.level[k] === 0) start = k;
    const seen = reachable(f, start);
    for (let k = 0; k < N * N; k++) if (f.walkableKind(k)) assert.ok(seen[k], `닿지 않는 칸 ${k}`);
    assert.ok(f.sites.length >= 5 && f.sites.length <= 8);
    const ramps = f.sites.map((s) => s.rampCount);
    assert.ok(Math.min(...ramps) === 1 && Math.max(...ramps) === 3, `입구 수 ${ramps}`);
    for (const s of f.sites) {
        const [bi, bj] = s.base;
        for (let dj = 0; dj < 4; dj++) for (let di = 0; di < 4; di++) assert.ok(seen[(bj + dj) * N + bi + di]);
        assert.equal(f.level[(bj + 1) * N + bi + 1], 2, `${s.id} 본진 자리는 고원`);
    }
    assert.equal(f.badVeins, 0, '광맥은 모두 평지 위');
    assert.ok(f.veins.length >= 20);
});

test('비탈: 폭 3~5칸의 곧은 통로, 양옆은 절벽 벽, 높이는 위 단에서 아래 단까지 고르게', () => {
    const f = createGame('mountain').survival.field;
    const { N } = f;
    for (const r of f.ramps) {
        assert.ok(r.w >= 3 && r.w <= 5, `비탈 폭 ${r.w}`);
        assert.equal(r.rows.length, RAMP_LEN);
        for (const row of r.rows) assert.equal(row.length, r.w);
        // 양옆 칸은 모두 절벽
        for (let t = 0; t < RAMP_LEN; t++)
            for (const l of [r.a - 1, r.b + 1]) {
                const i = r.ri + r.d[0] * t + r.p[0] * l;
                const j = r.rj + r.d[1] * t + r.p[1] * l;
                assert.equal(f.kind[j * N + i], KIND.cliff, `비탈 ${r.n} 옆 ${t},${l}`);
            }
        // 위 끝 줄이 가장 높고 아래 끝 줄이 가장 낮다
        const h = r.rows.map((row) => f.height[row[0]]);
        for (let t = 1; t < RAMP_LEN; t++) assert.ok(h[t] < h[t - 1]);
        assert.ok(h[0] < f.levels[r.hi] && h[RAMP_LEN - 1] > f.levels[r.lo]);
    }
});

test('(a) 고원의 비탈마다 통로를 가로질러 벽 한 줄을 세우면 둥지에서 그 고원 안으로 가는 길이 없다 (어느 줄이든)', () => {
    const base = createGame('mountain');
    const f = base.survival.field;
    const N = f.N;
    const gate = base.survival.nest.gates[0];
    for (const site of f.sites)
        for (let t = 0; t < RAMP_LEN; t++) {
            const s = createGame('mountain');
            s.survival.fog.explored.fill(1);
            assert.ok(placeBase(s, site.base[0], site.base[1]).ok);
            s.gold = 1e6;
            const ramps = f.ramps.filter((r) => r.owner === site.id);
            for (const r of ramps)
                for (const k of r.rows[t]) assert.ok(placeBuilding(s, 'wall', k % N, Math.floor(k / N)).ok);
            const seen = walkFrom(s, f.cellAt(gate.x, gate.z));
            for (let k = 0; k < N * N; k++)
                if (f.site[k] === site.n) assert.ok(!seen[k], `${site.id} 비탈 줄 ${t}: 벽을 지나지 않고 ${k}에 닿음`);
            for (const r of ramps) assert.equal(rampStates(s.survival)[r.n], 1, '봉쇄됨 표시');
        }
});

test('(b) 시뮬레이션 내내 적은 막힌 칸에 서지 않고, 비탈이 아닌 곳에서 단을 바꾸지 않으며, 모서리로 끼어들지 않는다', () => {
    let checked = 0;
    for (const opts of [{ site: 's' }, { site: 'e', walls: false }]) {
        const last = new Map();
        let bad = null;
        const { state } = playSurvival({
            ...opts,
            maxTime: 420,
            onTick: (st) => {
                const sv = st.survival;
                const f = sv.field;
                for (const e of st.enemies) {
                    if (!e.alive || e.def.flying) continue;
                    const k = f.cellAt(e.x, e.z);
                    checked++;
                    if (!freeCell(sv, k)) bad ??= `막힌 칸 ${k} (${e.type})`;
                    const p = last.get(e.id);
                    if (p != null && p !== k) {
                        // 그 사이에 건물이 섰거나 무너졌으면 판정이 달라지므로, 지금 건물 상태로 두 칸이 이어져 있어야 한다
                        const pi = p % f.N;
                        const pj = Math.floor(p / f.N);
                        const di = (k % f.N) - pi;
                        const dj = Math.floor(k / f.N) - pj;
                        if (Math.abs(di) > 1 || Math.abs(dj) > 1) bad ??= `칸 건너뜀 ${p}→${k}`;
                        if (di && dj && (!freeCell(sv, pj * f.N + pi + di) || !freeCell(sv, (pj + dj) * f.N + pi)))
                            bad ??= `모서리 끼어들기 ${p}→${k}`;
                        if (f.kind[p] !== KIND.ramp && f.kind[k] !== KIND.ramp && f.level[p] !== f.level[k])
                            bad ??= `비탈 밖에서 단을 바꿈 ${p}→${k}`;
                    }
                    last.set(e.id, k);
                }
            }
        });
        assert.equal(bad, null, bad);
        assert.ok(state.stats.kills > 0);
    }
    assert.ok(checked > 10000, `확인한 걸음 ${checked}`);
});

test('(c) 대각선으로 놓인 벽 두 개 사이로 빠져나가지 못한다', () => {
    const { s, f } = started('nw');
    s.gold = 1e6;
    const sv = s.survival;
    const N = f.N;
    // 벌판의 빈 땅에 다이아몬드(대각선으로만 이어진 벽 고리)를 두르고 그 안에 적을 둔다
    const diamond = (ci, cj) => {
        const ring = [];
        for (let d = 0; d < 4; d++)
            ring.push([ci + d, cj - 4 + d], [ci + 4 - d, cj + d], [ci - d, cj + 4 - d], [ci - 4 + d, cj - d]);
        return ring;
    };
    const open = (i, j) => {
        const k = j * N + i;
        return f.kind[k] === KIND.ground && f.level[k] === 1 && f.vein[k] < 0 && !f.nobuild[k] && sv.occ[k] === 0;
    };
    let ci = -1;
    let cj = -1;
    for (let j = 10; j < N - 10 && ci < 0; j++)
        for (let i = 10; i < N - 10 && ci < 0; i++) {
            let ok = true;
            for (let dj = -5; dj <= 5 && ok; dj++) for (let di = -5; di <= 5 && ok; di++) ok = open(i + di, j + dj);
            if (ok) {
                ci = i;
                cj = j;
            }
        }
    assert.ok(ci > 0, '빈 벌판');
    const ring = diamond(ci, cj);
    for (const [i, j] of ring) {
        assert.ok(f.walkableKind(j * N + i), `빈 땅 ${i},${j}`);
        assert.ok(placeBuilding(s, 'wall', i, j).ok);
    }
    for (const t of s.towers) t.hp = t.maxHp = 1e9;
    const p = f.toWorld(ci, cj);
    const enemies = [];
    for (let n = 0; n < 12; n++)
        enemies.push(spawnEnemyAt(s, n % 2 ? 'stalker' : 'grunt', 0, { x: p.x + (n % 3) * 0.2, z: p.z }));
    sv.worker.alive = false;
    sv.worker.respawnT = 1e9;
    // 흐름장으로 봐도 벽을 부수지 않고는 나갈 길이 없다
    computeFlow(s);
    const inside = (e) => {
        const c = cellOf(f, e.x, e.z);
        return Math.abs(c.i - ci) + Math.abs(c.j - cj) < 4;
    };
    for (let t = 0; t < 30; t += TICK) {
        step(s, TICK);
        drainEvents(s);
        for (const e of enemies) if (e.alive) assert.ok(inside(e), `빠져나감 ${e.type}`);
    }
    // 한 칸짜리 직접 시험: 벽 (ci+1, cj-3)과 (ci+2, cj-2) 사이로 안(ci+1, cj-2)에서 밖(ci+2, cj-3)으로 가는 대각선은 막힌다
    const at = (i, j) => j * N + i;
    assert.equal(canStep(sv, at(ci + 1, cj - 2), at(ci + 2, cj - 3)), false, '두 벽 사이 대각선');
    assert.equal(canStep(sv, at(ci + 2, cj - 3), at(ci + 1, cj - 2)), false, '밖에서 안으로도');
    assert.equal(canStep(sv, at(ci + 1, cj - 2), at(ci + 1, cj - 1)), true, '안쪽 이웃 칸끼리는 갈 수 있다');
});

test('시작: 둥지 곁 생존자 한 명, 맵은 생존자 둘레 말고 검다. 시계는 처음부터 흐르고 본진 없이는 웨이브를 부를 수 없다', () => {
    const s = createGame('mountain');
    const sv = s.survival;
    const f = sv.field;
    const w = sv.worker;
    assert.ok(w.alive);
    assert.ok(Math.hypot(w.x, w.z) < (f.nestR + 4) * f.T, '둥지 곁');
    const explored = sv.fog.explored.reduce((a, v) => a + v, 0);
    assert.ok(explored < Math.PI * (WORKER.hp ? 10 : 0) ** 2 + 20, `처음 밝혀진 칸 ${explored}`);
    // 고원과 광맥은 처음엔 안개 속
    for (const site of f.sites) assert.equal(sv.fog.explored[f.cellAt(site.x, site.z)], 0, site.id);
    for (const v of f.veins) assert.equal(sv.fog.explored[v.j * f.N + v.i], 0);
    assert.equal(callWave(s).ok, false);
    run(s, 3);
    assert.ok(sv.clock > 2.9, '시계가 흐른다');
    // 본진보다 먼저 다른 건물은 못 짓는다
    assert.match(checkPlacement(s, 'wall', 30, 30).reason, /탐험|본진/);
});

test('생존자: 우클릭 이동은 절벽을 돌아 비탈로 오르고, 본진을 지으러 걸어가 짓는 동안 진행이 오른다 (가까운 고원 15~25초)', () => {
    const times = {};
    for (const id of ['s', 'w', 'e']) {
        const s = createGame('mountain');
        const sv = s.survival;
        const f = sv.field;
        sv.fog.explored.fill(1);
        const site = f.sites.find((x) => x.id === id);
        assert.ok(orderBuild(s, 'base', site.base[0], site.base[1]).ok);
        let startedAt = null;
        let builtAt = null;
        let lastProgress = -1;
        for (let t = 0; t < 70 && !builtAt; t += TICK) {
            step(s, TICK);
            for (const ev of drainEvents(s)) {
                if (ev.type === 'baseStarted') startedAt = s.time;
                if (ev.type === 'baseBuilt') builtAt = s.time;
            }
            if (sv.base?.build) {
                assert.ok(sv.base.build.t >= lastProgress);
                lastProgress = sv.base.build.t;
            }
            // 생존자는 늘 걸을 수 있는 빈 칸에
            assert.ok(freeCell(sv, f.cellAt(sv.worker.x, sv.worker.z)));
        }
        assert.ok(startedAt && builtAt, `${id} 본진`);
        assert.ok(!sv.base.build);
        assert.equal(s.lives, s.maxLives);
        times[id] = startedAt;
    }
    const nearest = Math.min(...Object.values(times));
    assert.ok(nearest >= 12 && nearest <= 25, `가까운 고원까지 ${nearest.toFixed(1)}초`);
});

test('생존자 건설 주문: 값을 먼저 치르고 자리를 예약하며, 줄 서서 차례로 짓는다. 취소하면 돌려받는다', () => {
    const { s, f } = started('nw');
    const sv = s.survival;
    const b = sv.base;
    s.gold = 500;
    const N = f.N;
    const cells = [
        [b.i + 5, b.j],
        [b.i + 5, b.j + 1],
        [b.i + 5, b.j + 2]
    ];
    for (const [i, j] of cells) assert.ok(orderBuild(s, 'wall', i, j, true).ok);
    assert.equal(s.gold, 500 - 3 * 12);
    // 예약된 자리에는 다른 주문이 못 들어간다
    assert.match(checkPlacement(s, 'wall', cells[0][0], cells[0][1], { plan: true }).reason, /예정/);
    run(s, 25);
    for (const [i, j] of cells) {
        const id = sv.occ[j * N + i];
        const t = s.towers.find((x) => x.id === id);
        assert.ok(t && t.type === 'wall' && !t.build, `벽 ${i},${j}`);
    }
    // 아직 짓지 않은 주문은 취소하면 돌려받는다
    const before = s.gold;
    assert.ok(orderBuild(s, 'ranger', b.i + 7, b.j + 5, true).ok);
    assert.equal(s.gold, before - 70);
    cancelOrders(s);
    assert.equal(s.gold, before);
    assert.equal(sv.reserved[(b.j + 5) * N + b.i + 7], 0);
});

test('생존자 수리: 다친 건물을 우클릭하면 가서 고치고, 기존 수리비 셈만큼 골드가 든다', () => {
    const { s } = started('nw');
    const sv = s.survival;
    const b = sv.base;
    s.gold = 1000;
    const t = placeBuilding(s, 'ranger', b.i + 6, b.j).tower;
    damageTower(s, t, t.maxHp * 0.6);
    const gold = s.gold;
    assert.ok(orderRepair(s, t).ok);
    run(s, 30);
    assert.equal(t.hp, t.maxHp);
    const spent = gold - s.gold;
    const want = Math.ceil(0.6 * t.spent * 0.35);
    assert.ok(Math.abs(spent - want) <= 2, `수리비 ${spent} (예상 ${want})`);
    assert.equal(orderRepair(s, t).ok, false, '온전하면 수리할 것이 없다');
});

test('생존자가 쓰러지면: 본진이 있으면 본진 곁에서 다시 일어나고, 본진이 없으면 패배', () => {
    const { s } = started('nw');
    const sv = s.survival;
    sv.worker.hp = 1;
    const e = spawnEnemyAt(s, 'grunt', 0, { x: sv.worker.x + 0.5, z: sv.worker.z });
    e.atkCd = 0;
    run(s, 3);
    assert.equal(sv.worker.alive, false);
    assert.equal(s.status, 'playing');
    e.alive = false;
    run(s, WORKER.respawn + 1);
    assert.ok(sv.worker.alive);
    assert.ok(Math.hypot(sv.worker.x - sv.base.x, sv.worker.z - sv.base.z) < 5);

    const lone = createGame('mountain');
    const w = lone.survival.worker;
    w.hp = 1;
    const e2 = spawnEnemyAt(lone, 'grunt', 0, { x: w.x + 0.5, z: w.z });
    e2.atkCd = 0;
    run(lone, 3);
    assert.equal(lone.status, 'lost');
});

test('적은 생존자를 노리지만 벽 너머의 생존자는 쫓지 않고, 하늘의 적은 생존자를 쫓지 않는다', () => {
    const { s, f } = started('nw');
    const sv = s.survival;
    const N = f.N;
    s.gold = 1e5;
    const plan = sitePlan(s, 'nw');
    for (const k of plan.wall1) placeBuilding(s, 'wall', k % N, Math.floor(k / N));
    for (const t of s.towers) t.hp = t.maxHp = 1e9;
    // 생존자를 벽 바로 안쪽에, 적을 벽 바깥 통로에
    const r = plan.ramps[0];
    const inK = r.rows[0][1] - r.d[1] * N - r.d[0];
    const outK = r.rows[2][1];
    const pin = f.toWorld(inK % N, Math.floor(inK / N));
    Object.assign(sv.worker, { x: pin.x, z: pin.z, lastK: inK, order: null, queue: [] });
    const po = f.toWorld(outK % N, Math.floor(outK / N));
    const e = spawnEnemyAt(s, 'grunt', 0, { x: po.x, z: po.z });
    run(s, 4);
    assert.ok(sv.worker.alive);
    assert.notEqual(e.atkTargetId, 'worker');
    assert.equal(sv.worker.hp, sv.worker.maxHp);
});

test('자유 배치: 빈 땅 어디든 격자에 맞춰 짓고, 절벽·바위·겹침·미탐험 땅·둥지 곁에는 못 짓는다', () => {
    const { s, f } = started();
    s.gold = 5000;
    const b = s.survival.base;
    const i = b.i + 5;
    const j = b.j;
    assert.ok(placeBuilding(s, 'wall', i, j).ok);
    assert.equal(placeBuilding(s, 'wall', i, j).reason, '이미 건물이 있습니다.');
    const tower = placeBuilding(s, 'ranger', i + 1, j);
    assert.ok(tower.ok, tower.reason);
    assert.equal(tower.tower.cell.s, 2);
    assert.equal(placeBuilding(s, 'frost', i + 2, j + 1).ok, false);
    const cliff = [...f.kind.keys()].find((k) => f.kind[k] === KIND.cliff);
    assert.match(checkPlacement(s, 'wall', cliff % f.N, Math.floor(cliff / f.N)).reason, /절벽/);
    const fresh = createGame('mountain');
    fresh.survival.base = b;
    const far = [...f.kind.keys()].find((k) => f.walkableKind(k) && !fresh.survival.fog.explored[k] && !f.nobuild[k]);
    assert.match(checkPlacement(fresh, 'wall', far % f.N, Math.floor(far / f.N)).reason, /탐험/);
    assert.equal(checkPlacement(s, 'wall', f.center.i + 5, f.center.j).ok, false);
    sellTower(s, tower.tower.id);
    assert.ok(placeBuilding(s, 'frost', i + 1, j).ok);
});

test('광산은 광맥 2×2에 꼭 맞게만, 광맥에는 다른 건물을 못 짓는다. 광산은 시간마다 캐고 채굴 기술로 수입이 는다', () => {
    const { s, f } = started();
    const v = f.veins.find((x) => x.site === f.sites.find((q) => q.id === 'nw').n);
    s.gold = 1000;
    assert.equal(placeBuilding(s, 'ranger', v.i, v.j).ok, false);
    assert.equal(placeBuilding(s, 'wall', v.i + 1, v.j + 1).ok, false);
    assert.equal(placeBuilding(s, 'mine', v.i + 1, v.j).ok, false);
    const m = placeBuilding(s, 'mine', v.i, v.j);
    assert.ok(m.ok, m.reason);
    s.survival.payT = 0.01;
    let gold = s.gold;
    run(s, 0.1);
    const base = s.gold - gold;
    const want = Math.round(20 * (v.yield ?? 1) * (s.survival.cfg.mineMul ?? 1));
    assert.equal(base, want);
    // 채굴 기술 1단계
    s.gold = 1000;
    assert.ok(upgradeMining(s).ok);
    assert.equal(s.gold, 1000 - MINE_TECH[0].cost);
    s.survival.payT = 0.01;
    gold = s.gold;
    run(s, 0.1);
    assert.equal(s.gold - gold, Math.round(want * MINE_TECH[0].mul));
    for (let n = 1; n < MINE_TECH.length; n++) assert.ok(upgradeMining(s).ok || s.gold < MINE_TECH[n].cost);
});

test('처치 보상: 적을 잡으면 골드가 조금 들어온다', () => {
    const { s } = started();
    const b = s.survival.base;
    s.gold = 500;
    assert.ok(placeBuilding(s, 'ranger', b.i + 5, b.j).ok);
    const e = spawnEnemyAt(s, 'grunt', 0, { x: b.x + 9, z: b.z });
    e.hp = 1;
    const gold = s.gold;
    run(s, 3);
    assert.ok(!e.alive);
    assert.ok(s.gold > gold && s.gold - gold < 20, `${s.gold - gold}`);
});

test('흐름장: 적은 둥지에서 걸어 나와 비탈을 올라 본진까지 간다', () => {
    const { s } = started();
    computeFlow(s);
    const e = spawnEnemyAt(s, 'grunt', 0, { x: s.survival.nest.gates[0].x, z: s.survival.nest.gates[0].z });
    const b = s.survival.base;
    s.survival.worker.alive = false;
    s.survival.worker.respawnT = 1e9;
    const d0 = Math.hypot(e.x - b.x, e.z - b.z);
    run(s, 25);
    assert.ok(e.alive);
    assert.ok(Math.hypot(e.x - b.x, e.z - b.z) < d0 - 20, '본진 쪽으로 다가왔다');
});

test('길을 완전히 막으면 적은 벽을 부순다. 비탈 하나를 열어 두면 그 비탈로 돌아간다', () => {
    const { s, f } = started('n');
    s.gold = 99999;
    const N = f.N;
    const plan = sitePlan(s, 'n');
    for (const k of plan.wall1) assert.ok(placeBuilding(s, 'wall', k % N, Math.floor(k / N)).ok);
    const r = plan.ramps[0];
    const p = { x: -f.half + r.to[0] * f.T, z: -f.half + r.to[1] * f.T };
    s.survival.worker.alive = false;
    s.survival.worker.respawnT = 1e9;
    const e = spawnEnemyAt(s, 'ironclad', 0, { x: p.x, z: p.z });
    e.atk = 400;
    let wallHit = false;
    for (let t = 0; t < 40 && !wallHit; t += TICK) {
        step(s, TICK);
        for (const ev of drainEvents(s))
            if (ev.type === 'enemyShot' && s.towers.find((t2) => t2.id === ev.towerId)?.type === 'wall') wallHit = true;
    }
    assert.ok(wallHit, '막히면 벽을 친다');
    // 두 번째 비탈은 열어 둔다: 첫 비탈 아래의 적은 벽을 치지 않고 돌아간다
    const { s: s2 } = started('n');
    s2.gold = 99999;
    for (const k of plan.ramps[0].rows[0]) placeBuilding(s2, 'wall', k % N, Math.floor(k / N));
    s2.survival.worker.alive = false;
    s2.survival.worker.respawnT = 1e9;
    const e2 = spawnEnemyAt(s2, 'grunt', 0, { x: p.x, z: p.z });
    let hit2 = false;
    for (let t = 0; t < 40; t += TICK) {
        step(s2, TICK);
        for (const ev of drainEvents(s2))
            if (ev.type === 'enemyShot' && s2.towers.find((t2) => t2.id === ev.towerId)?.type === 'wall') hit2 = true;
    }
    assert.equal(hit2, false, '열린 비탈이 있으면 벽을 치지 않는다');
    assert.ok(e2.alive);
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
    for (let t = 0; t < 3 && s.towers.includes(w); t += TICK) {
        e.atkTarget = w;
        step(s, TICK);
        drainEvents(s);
    }
    assert.ok(!s.towers.includes(w));
    assert.equal(s.survival.occ[k], 0);
});

test('방벽은 레벨마다 체력이 오르고 분기가 없다. 짓는 중인 건물은 올릴 수 없다', () => {
    const { s } = started();
    s.gold = 999;
    const b = s.survival.base;
    const w = placeBuilding(s, 'wall', b.i + 6, b.j).tower;
    const hp1 = w.maxHp;
    assert.ok(upgradeTower(s, w.id).ok);
    assert.ok(upgradeTower(s, w.id).ok);
    assert.ok(w.maxHp > hp1 * 2);
    assert.equal(upgradeTower(s, w.id, 'a').ok, false);
    const t = placeBuilding(s, 'ranger', b.i + 7, b.j + 3, { construct: true }).tower;
    assert.ok(t.build);
    assert.equal(upgradeTower(s, t.id).reason, '아직 짓는 중입니다.');
});

test('탐험 안개: 생존자와 건물 둘레만 보이고, 안개 속 적은 숨는다', () => {
    const { s, f } = started();
    const sv = s.survival;
    const b = sv.base;
    updateFog(s, true);
    assert.equal(sv.fog.visible[f.cellAt(b.x, b.z)], 1);
    const far = f.sites[4];
    const e = spawnEnemyAt(s, 'grunt', 0, { x: far.x, z: far.z });
    updateFog(s, true);
    assert.equal(e.fogged, true);
    const near = spawnEnemyAt(s, 'grunt', 0, { x: b.x + 4, z: b.z });
    updateFog(s, true);
    assert.equal(near.fogged, false);
    // 생존자가 걸어가면 그 길이 밝혀진다
    const fresh = createGame('mountain');
    const before = fresh.survival.fog.explored.reduce((a, v) => a + v, 0);
    assert.ok(orderMove(fresh, 0, 30).ok);
    run(fresh, 12);
    assert.ok(fresh.survival.fog.explored.reduce((a, v) => a + v, 0) > before + 50);
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
    lose.survival.worker.alive = false;
    lose.survival.worker.respawnT = 1e9;
    run(lose, 600);
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

test('동이 트는 틱에는 승리 뒤에 생존자 건설이 진행되지 않는다', () => {
    const { s, site, f } = started();
    s.gold = 1e6;
    const tower = placeBuilding(s, 'ranger', site.base[0] + 6, site.base[1], { construct: true }).tower;
    const p = f.toWorld(tower.cell.i - 1, tower.cell.j);
    Object.assign(s.survival.worker, { x: p.x, z: p.z, sx: p.x, sz: p.z, lastK: f.cellAt(p.x, p.z) });
    assert.ok(orderRepair(s, tower).ok);
    step(s, TICK); // 수리 주문이 진행 중인 건설 주문으로 바뀐다
    drainEvents(s);
    tower.build.t = tower.build.T - TICK;
    s.waveIndex = s.waves.length;
    s.survival.clock = s.survival.dawn - TICK / 2;

    step(s, TICK);
    const events = drainEvents(s);
    assert.equal(s.status, 'won');
    assert.ok(tower.build, '승리한 틱에는 건설 상태를 바꾸지 않는다');
    assert.equal(tower.build.t, tower.build.T - TICK);
    assert.equal(
        events.some((ev) => ev.type === 'built'),
        false,
        'victory 뒤 built 이벤트가 없어야 한다'
    );
});

test('웨이브 정의: 20웨이브가 시각 순서로 동트기 전에, 첫 습격은 생존자가 본진을 지을 시간 뒤, 6:30·10:30·14:30에 빙하 거신', () => {
    const w = WAVES.mountain;
    assert.equal(w.length, 20);
    for (let i = 1; i < w.length; i++) assert.ok(w[i].at > w[i - 1].at);
    assert.ok(w[0].at >= 90);
    assert.ok(w[w.length - 1].at < MAPS.mountain.survival.dawn);
    const bossAt = w.filter((x) => x.groups.some((g) => g.enemy === 'glacier')).map((x) => x.at);
    assert.deepEqual(bossAt, [390, 630, 870]);
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
