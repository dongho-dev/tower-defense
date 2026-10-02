// 성문: 길 위에 놓인 부서지는 구조물(공성전 전용 맵). 지상 적은 성문 앞에서 멈춰 문을 공격하고,
// 문이 무너지면 길이 열린다. 상태는 state.gates에 있고, 적은 e.gateId(공격 중인 성문 id)로 멈춰 있다.
// 성문은 경로 거리(blocks: [{ pathIndex, d }])로 길을 막으므로, 한 길에 여러 개를 줄줄이 놓을 수 있다.
// 자유 이동(길 없는 맵)이 생기면 x, z, width로 위치 판정을 더하면 된다.
import { nearestOnPath, samplePath } from './path.js';
import { REPAIR_RATE, WAVE_REPAIR } from './game.js';

export const GATE_HP = 2000;
/** 수리비 기준값 (타워의 spent에 해당) */
export const GATE_VALUE = 300;
/** 성문 앞에 멈추는 거리: 성문 두께 절반 + 적 반지름 + 개체별 흩어짐 */
export const GATE_STOP = 0.45;
export const GATE_RATE = 1.0;
/** 보스는 성문을 더 세게 친다 */
export const GATE_BOSS = 1.6;
/** 무너진 성문 재건: 기준값 대비 비용, 되살아나는 체력 비율 */
export const GATE_REBUILD = 0.6;
export const GATE_REBUILD_HP = 0.5;
/** 보강 단계: 비용과 늘어나는 최대 체력 (기본 체력 대비) */
export const GATE_REINFORCE = [
    { cost: 140, hp: 0.5 },
    { cost: 220, hp: 0.5 }
];

const emit = (state, ev) => state.events.push(ev);

/** 맵 정의의 gates를 길 위에 붙인다. at: [x, z] (가까운 모든 길을 막음), path를 주면 그 길만 */
export function createGates(state) {
    const defs = state.map.gates || [];
    return defs.map((g, id) => {
        const blocks = [];
        state.paths.forEach((p, pathIndex) => {
            if (g.path != null && g.path !== pathIndex) return;
            const n = g.d != null && g.path === pathIndex ? { d: g.d, dist: 0 } : nearestOnPath(p, g.at[0], g.at[1]);
            if (n.dist < 0.6) blocks.push({ pathIndex, d: n.d });
        });
        if (!blocks.length) throw new Error(`gate ${id} is not on a path`);
        const p = samplePath(state.paths[blocks[0].pathIndex], blocks[0].d, {});
        const maxHp = Math.round((g.hp || GATE_HP) * (state.gateHpMul || 1));
        return {
            id,
            name: g.name || `성문 ${id + 1}`,
            x: p.x,
            z: p.z,
            // 길이 지나가는 방향 (문짝은 이 방향에 수직으로 선다)
            dirX: p.dx,
            dirZ: p.dz,
            width: g.width || 2.2,
            blocks,
            hp: maxHp,
            maxHp,
            baseHp: maxHp,
            level: 0,
            value: GATE_VALUE,
            broken: false,
            hitT: null
        };
    });
}

export function findGate(state, id) {
    return state.gates[id] || null;
}

/** 적 앞을 막고 있는 가장 가까운 성문: { gate, d } (d = 그 길 위 성문 위치) */
export function gateAhead(state, e) {
    if (!state.gates.length || e.def.flying) return null;
    let best = null;
    for (const g of state.gates) {
        if (g.broken) continue;
        for (const b of g.blocks) {
            if (b.pathIndex !== e.pathIndex || b.d < e.d - 0.05) continue;
            if (!best || b.d < best.d) best = { gate: g, d: b.d };
        }
    }
    return best;
}

/** 이 적이 성문 앞에서 멈추는 경로 거리 (막는 성문이 없으면 Infinity) */
export function gateLimit(state, e) {
    const a = gateAhead(state, e);
    if (!a) return Infinity;
    const gap = GATE_STOP + e.radius + ((e.id * 0.618034) % 1) * 0.55;
    return Math.max(e.d, a.d - gap);
}

/** 성문 앞에 멈춘 적: 문을 두드린다 */
export function gateAttack(state, e, gate, dt) {
    e.atkCd -= dt;
    if (e.atkCd > 0) return;
    const boss = !!e.def.boss;
    e.atkCd = boss ? 1.5 : GATE_RATE;
    emit(state, {
        type: 'enemyShot',
        id: e.id,
        enemy: e.type,
        boss,
        x: e.x,
        z: e.z,
        tx: gate.x,
        tz: gate.z,
        towerId: null,
        gateId: gate.id
    });
    damageGate(state, gate, Math.max(3, e.atk) * (boss ? GATE_BOSS : 1));
}

export function damageGate(state, gate, amount) {
    if (gate.broken) return;
    gate.hp -= amount;
    gate.hitT = state.time;
    if (gate.hp > 0) return;
    gate.hp = 0;
    gate.broken = true;
    state.stats.gatesLost = (state.stats.gatesLost || 0) + 1;
    for (const e of state.enemies) if (e.gateId === gate.id) e.gateId = null;
    emit(state, { type: 'gateBroken', gateId: gate.id, name: gate.name, x: gate.x, z: gate.z });
}

/** 수리(또는 재건) 비용. 온전하면 0 */
export function gateRepairCost(gate) {
    if (gate.broken) return Math.ceil(gate.value * GATE_REBUILD);
    if (gate.hp >= gate.maxHp) return 0;
    return Math.ceil(((gate.maxHp - gate.hp) / gate.maxHp) * gate.value * REPAIR_RATE);
}

/** 성문 앞에 지상 적이 붙어 있는가 (재건하면 문 안에 갇히므로 막는다) */
function enemyAtGate(state, gate) {
    for (const e of state.enemies) {
        if (!e.alive || e.def.flying) continue;
        if ((e.x - gate.x) ** 2 + (e.z - gate.z) ** 2 < 1.1 ** 2) return true;
    }
    return false;
}

export function repairGate(state, gateId) {
    const gate = findGate(state, gateId);
    if (!gate || state.status !== 'playing') return { ok: false, reason: '잘못된 명령입니다.' };
    const cost = gateRepairCost(gate);
    if (!cost) return { ok: false, reason: '수리할 곳이 없습니다.' };
    if (state.gold < cost) return { ok: false, reason: '골드가 부족합니다.' };
    if (gate.broken && enemyAtGate(state, gate)) return { ok: false, reason: '성문 자리에 적이 있습니다.' };
    state.gold -= cost;
    const rebuilt = gate.broken;
    if (rebuilt) {
        gate.broken = false;
        gate.hp = Math.round(gate.maxHp * GATE_REBUILD_HP);
    } else gate.hp = gate.maxHp;
    emit(state, { type: 'repair', gateId, x: gate.x, z: gate.z, cost, rebuilt });
    return { ok: true, cost, rebuilt };
}

/** 다음 보강 단계 (없으면 null) */
export function gateReinforceOption(gate) {
    return GATE_REINFORCE[gate.level] || null;
}

/** 보강: 최대 체력이 늘고 늘어난 만큼 바로 채워진다 */
export function reinforceGate(state, gateId) {
    const gate = findGate(state, gateId);
    if (!gate || state.status !== 'playing') return { ok: false, reason: '잘못된 명령입니다.' };
    const opt = gateReinforceOption(gate);
    if (!opt) return { ok: false, reason: '이미 최대로 보강했습니다.' };
    if (gate.broken) return { ok: false, reason: '무너진 성문은 먼저 재건해야 합니다.' };
    if (state.gold < opt.cost) return { ok: false, reason: '골드가 부족합니다.' };
    state.gold -= opt.cost;
    const add = Math.round(gate.baseHp * opt.hp);
    gate.maxHp += add;
    gate.hp += add;
    gate.value += opt.cost;
    gate.level++;
    emit(state, { type: 'gateReinforce', gateId, level: gate.level, x: gate.x, z: gate.z, cost: opt.cost });
    return { ok: true, cost: opt.cost };
}

/** 웨이브 시작: 서 있는 성문은 타워처럼 일부 회복 (무너진 문은 그대로) */
export function waveRepairGates(state) {
    for (const g of state.gates) if (!g.broken) g.hp = Math.min(g.maxHp, g.hp + g.maxHp * WAVE_REPAIR);
}
