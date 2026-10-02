// 랜덤 타워 디펜스 규칙(공성전 전용 맵 장르 'defense', map.rtd).
// - 적은 제단을 둘러싼 고리 길을 끝없이 돈다(누수 없음). 필드에 mobLimit을 넘으면 패배, 80·90에서 경고.
// - 골드로 '소환'하면 확률표에 따라 흔함/희귀/영웅 타워가 선다(전설·신화는 소환 불가).
//   흔함만 pity번 연속이면 그 소환은 희귀 이상 확정(천장). 확률 강화 3단계.
// - 한 칸에 같은 타워(종류·등급)를 셋까지 쌓는다(운빨존많겜처럼). 같은 타워가 이미 쌓여 있으면 그 칸으로 간다.
// - 같은 타워 셋을 '합성'하면 한 등급 위 무작위 하나. 재료 종류(공명 속성)를 inherit 확률로 잇는다.
// - 신화는 레시피(전설 + 영웅 둘 + 룬 파편)로만. 판매하면 골드와 룬 파편, 룬 파편으로 '행운 소환'(영웅 도박).
// - 웨이브는 시간마다 저절로 오고, 10웨이브마다 보스(제한 시간 안에 못 잡으면 패배). 웨이브마다 이자.
// 타워 객체는 기존 엔진 그대로(type·tier·branch·mastery)이고 grade·count만 더한다 → 렌더·공명·공격 코드를 그대로 쓴다.
import { TOWERS } from './data/towers.js';
import { RTD, GRADES, RTD_POOL, MYTHS, MYTH_ORDER, COMMON, RARE, EPIC, LEGEND, MYTH } from './data/randomtd.js';
import { syncSoldiers, removeUnitsOf } from './units.js';
import { findTower } from './game.js';

export { RTD, GRADES, MYTHS, MYTH_ORDER, RTD_POOL };

/** 한 칸에 쌓을 수 있는 같은 타워 수 */
export const STACK = 3;

const emit = (state, ev) => state.events.push(ev);

/** 결정적 난수 (시드가 같으면 같은 뽑기) */
function rng(seed) {
    let a = seed >>> 0 || 1;
    return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// ---------- 생성 ----------

/** createGame이 부른다: 고리 길 표시, 소켓 가치 순서, 랜디 상태 */
export function initRtd(state, opts = {}) {
    for (const p of state.paths) p.loop = true;
    const seed = opts.seed ?? (Date.now() ^ 0x5bd1e995) >>> 0;
    const path = state.paths[0];
    // 소환이 놓일 칸 순서: 길에 가까운 칸부터. 거리가 같은 칸끼리는 고리를 따라 고르게 흩어지도록
    // (각도 순서의 비트 뒤집기) 골라서, 몇 개만 서 있어도 고리 어디서든 누군가 닿게 한다
    const near = state.sockets.map((s) => {
        let best = Infinity;
        for (let i = 0; i < path.count; i += 3) best = Math.min(best, Math.hypot(path.xs[i] - s.x, path.zs[i] - s.z));
        return { id: s.id, d: Math.round(best * 2) / 2, a: Math.atan2(s.z, s.x) };
    });
    const groups = new Map();
    for (const n of near) {
        if (!groups.has(n.d)) groups.set(n.d, []);
        groups.get(n.d).push(n);
    }
    for (const list of groups.values()) {
        list.sort((a, b) => a.a - b.a);
        const bits = Math.ceil(Math.log2(Math.max(2, list.length)));
        const rev = (i) => parseInt(i.toString(2).padStart(bits, '0').split('').reverse().join(''), 2);
        list.forEach((n, i) => (n.k = rev(i)));
    }
    near.sort((a, b) => a.d - b.d || a.k - b.k);
    // 영웅 난이도: 생명 대신 필드 한도가 줄어든다
    const limit = Math.round(RTD.mobLimit * (state.difficulty === 'hero' ? RTD.heroLimit : 1));
    state.rtd = {
        seed,
        limit,
        warnAt: RTD.warn.map((k) => Math.round(limit * k)),
        rand: rng(seed),
        summons: 0,
        oddsLevel: 0,
        pity: 0,
        runes: 0,
        luckFails: 0,
        order: near.map((n) => n.id),
        boss: null,
        warn: 0,
        peak: 0,
        best: COMMON,
        merges: 0,
        myths: 0
    };
    state.nextWaveIn = RTD.prep;
}

// ---------- 등급 → 타워 단계 ----------

/** 등급의 타워 단계: 흔함 Lv1, 희귀 Lv2, 영웅 Lv3, 전설 = 분기, 신화 = 분기 + 각성 2 */
function shapeFor(grade, branch) {
    const gd = GRADES[grade];
    return { tier: gd.tier, branch: gd.branch ? branch || 'a' : null, mastery: gd.mastery || 0 };
}

/** towerStats가 부른다: 등급 배율 × 쌓인 수, 고리 사거리, 광산 수입 */
export function applyGrade(s, tower) {
    const n = tower.count || 1;
    const k = (RTD.gradeMul[tower.grade] || 1) * (RTD.typeMul[tower.type] || 1) * n;
    s.dmg *= k;
    if (s.burn) s.burn.dps *= k;
    if (s.aura) s.aura.dps *= k;
    s.unitHp *= RTD.gradeMul[tower.grade] || 1;
    s.range *= RTD.rangeMul;
    s.income = Math.round(s.income * RTD.incomeMul * (1 + 0.5 * tower.grade) * n);
}

/** 쌓기·합성 묶음 열쇠: 같은 종류·같은 등급 (전설 이상은 쌓지도 합성하지도 않는다) */
export function mergeKey(tower) {
    return tower.grade >= LEGEND ? null : `${tower.type}:${tower.grade}`;
}

export function towerName(tower) {
    if (tower.grade === MYTH && MYTHS[tower.type]) return MYTHS[tower.type].name;
    const def = TOWERS[tower.type];
    return tower.branch ? def.branches[tower.branch].name : def.name;
}

// ---------- 소환 ----------

export function summonCost(state) {
    return RTD.summonBase + RTD.summonStep * state.rtd.summons;
}

/** 지금 확률표 [흔함, 희귀, 영웅] (%) */
export function currentOdds(state) {
    return RTD.odds[state.rtd.oddsLevel];
}

/** 천장까지 남은 소환 수 (1이면 이번 소환이 희귀 이상 확정) */
export function pityLeft(state) {
    return RTD.pity - state.rtd.pity;
}

/** 빈 칸 (길에 가까운 칸부터) */
export function freeSocket(state) {
    for (const id of state.rtd.order) if (state.sockets[id].towerId == null) return state.sockets[id];
    return null;
}

/** 같은 타워가 쌓일 수 있는 칸의 타워 (가장 많이 쌓인 곳부터) */
function stackFor(state, type, grade) {
    if (grade >= LEGEND) return null;
    let best = null;
    for (const t of state.towers)
        if (t.type === type && t.grade === grade && t.count < STACK && (!best || t.count > best.count)) best = t;
    return best;
}

/** 이 타워가 들어갈 자리가 있는가 (쌓을 칸 또는 빈 칸) */
export function hasRoom(state, type, grade) {
    return !!stackFor(state, type, grade) || !!freeSocket(state);
}

/** 소환 버튼: 빈 칸이 있거나, 어떤 결과든 쌓일 수 있으면 가능 */
export function canSummon(state) {
    if (freeSocket(state)) return true;
    // 칸이 꽉 찼으면 나올 수 있는 모든 결과가 쌓일 수 있어야 한다
    for (const type of RTD_POOL) for (const g of [COMMON, RARE, EPIC]) if (!stackFor(state, type, g)) return false;
    return true;
}

/** 등급 하나를 뽑는다. 흔함이 pity-1번 연속이었다면 희귀 이상만 */
export function rollGrade(state) {
    const R = state.rtd;
    const [c, r, e] = currentOdds(state);
    const forced = R.pity >= RTD.pity - 1;
    const total = forced ? r + e : c + r + e;
    let x = R.rand() * total;
    let grade;
    if (!forced && x < c) grade = COMMON;
    else {
        if (!forced) x -= c;
        grade = x < r ? RARE : EPIC;
    }
    R.pity = grade === COMMON ? R.pity + 1 : 0;
    return { grade, forced };
}

function pickType(state) {
    return RTD_POOL[Math.floor(state.rtd.rand() * RTD_POOL.length)];
}

/** 소켓에 등급 타워를 세운다 (엔진의 buildTower와 같은 모양) */
function placeTower(state, socket, type, grade, branch = null, count = 1) {
    const shape = shapeFor(grade, branch ?? (state.rtd.rand() < 0.5 ? 'a' : 'b'));
    const tower = {
        id: state.nextId++,
        type,
        grade,
        count,
        socketId: socket.id,
        x: socket.x,
        z: socket.z,
        ...shape,
        beams: [],
        spent: 0,
        cooldown: 0.4,
        aim: Math.PI / 2,
        targetId: null,
        targeting: 'first',
        kills: 0,
        damage: 0,
        builtAt: state.time
    };
    state.towers.push(tower);
    socket.towerId = tower.id;
    state.statsVersion++;
    state.stats.built++;
    if (type === 'barracks') syncSoldiers(state, tower);
    if (grade > state.rtd.best) state.rtd.best = grade;
    return tower;
}

/** 새로 얻은 타워 하나: 같은 타워가 쌓일 칸이 있으면 쌓고, 없으면 빈 칸에 세운다 */
function addTower(state, type, grade) {
    const stack = stackFor(state, type, grade);
    if (stack) {
        stack.count++;
        state.statsVersion++;
        if (type === 'barracks') syncSoldiers(state, stack);
        return { tower: stack, stacked: true };
    }
    const socket = freeSocket(state);
    if (!socket) return null;
    return { tower: placeTower(state, socket, type, grade), stacked: false };
}

/** 칸에서 n개를 빼낸다. 다 빠지면 타워가 사라진다 */
function takeTower(state, tower, n = tower.count) {
    tower.count -= n;
    state.statsVersion++;
    if (tower.count > 0) {
        if (tower.type === 'barracks') syncSoldiers(state, tower);
        return;
    }
    state.towers = state.towers.filter((t) => t !== tower);
    state.sockets[tower.socketId].towerId = null;
    state.statsCache.delete(tower.id);
    removeUnitsOf(state, tower.id);
}

export function summon(state) {
    if (state.status !== 'playing') return { ok: false, reason: '게임이 끝났습니다.' };
    const cost = summonCost(state);
    if (!canSummon(state)) return { ok: false, reason: '빈 칸이 없습니다. 합성하거나 판매하세요.' };
    if (state.gold < cost) return { ok: false, reason: '골드가 부족합니다.' };
    state.gold -= cost;
    state.rtd.summons++;
    const { grade, forced } = rollGrade(state);
    const type = pickType(state);
    const { tower, stacked } = addTower(state, type, grade);
    tower.spent += cost;
    emit(state, {
        type: 'rtdSummon',
        towerId: tower.id,
        tower: type,
        grade,
        forced,
        stacked,
        count: tower.count,
        x: tower.x,
        z: tower.z,
        cost
    });
    return { ok: true, tower, grade, forced, cost, stacked };
}

export function oddsUpgradeCost(state) {
    return RTD.oddsCost[state.rtd.oddsLevel] ?? null;
}

export function upgradeOdds(state) {
    const cost = oddsUpgradeCost(state);
    if (state.status !== 'playing') return { ok: false, reason: '게임이 끝났습니다.' };
    if (cost == null) return { ok: false, reason: '확률 강화를 모두 마쳤습니다.' };
    if (state.gold < cost) return { ok: false, reason: '골드가 부족합니다.' };
    state.gold -= cost;
    state.rtd.oddsLevel++;
    emit(state, { type: 'rtdOdds', level: state.rtd.oddsLevel, odds: currentOdds(state) });
    return { ok: true, level: state.rtd.oddsLevel };
}

/** 행운 소환 성공 확률 */
export function luckChance(state) {
    return Math.min(1, RTD.luckChance + RTD.luckStep * state.rtd.luckFails);
}

/** 행운 소환: 룬 파편으로 영웅 등급을 노린다. 실패하면 파편만 사라지고 다음 확률이 오른다 */
export function luckySummon(state) {
    const R = state.rtd;
    if (state.status !== 'playing') return { ok: false, reason: '게임이 끝났습니다.' };
    if (R.runes < RTD.luckCost) return { ok: false, reason: '룬 파편이 부족합니다.' };
    const type = pickType(state);
    if (!hasRoom(state, type, EPIC)) return { ok: false, reason: '빈 칸이 없습니다.' };
    R.runes -= RTD.luckCost;
    const chance = luckChance(state);
    if (R.rand() >= chance) {
        R.luckFails++;
        emit(state, { type: 'rtdLuck', ok: false, chance: luckChance(state) });
        return { ok: true, success: false };
    }
    R.luckFails = 0;
    const { tower, stacked } = addTower(state, type, EPIC);
    emit(state, { type: 'rtdLuck', ok: true, towerId: tower.id, tower: type, grade: EPIC });
    emit(state, {
        type: 'rtdSummon',
        towerId: tower.id,
        tower: type,
        grade: EPIC,
        lucky: true,
        stacked,
        count: tower.count,
        x: tower.x,
        z: tower.z
    });
    return { ok: true, success: true, tower };
}

// ---------- 합성 ----------

/** 같은 종류·등급이 모두 몇 개인가 (쌓인 수 포함) */
export function countSame(state, tower) {
    const key = mergeKey(tower);
    if (!key) return 0;
    let n = 0;
    for (const t of state.towers) if (mergeKey(t) === key) n += t.count;
    return n;
}

/** 합성 가능: 이 타워 포함 같은 타워가 셋 이상 */
export function canMerge(state, tower) {
    return !!mergeKey(tower) && countSame(state, tower) >= STACK;
}

/** 합성: 셋을 써서(이 칸부터, 모자라면 다른 칸에서) 이 칸에 한 등급 위 무작위 하나 */
export function mergeTower(state, towerId) {
    const tower = findTower(state, towerId);
    if (!tower || !state.rtd || state.status !== 'playing') return { ok: false, reason: '잘못된 명령입니다.' };
    if (tower.grade >= LEGEND) return { ok: false, reason: '전설은 합성하지 않습니다. 신화 레시피에 쓰세요.' };
    if (!canMerge(state, tower)) return { ok: false, reason: '같은 타워가 셋 있어야 합성할 수 있습니다.' };
    const R = state.rtd;
    const socket = state.sockets[tower.socketId];
    // 재료: 이 칸 먼저, 모자라면 길에서 먼 칸부터
    const rank = new Map(R.order.map((id, i) => [id, i]));
    const others = state.towers
        .filter((t) => t !== tower && mergeKey(t) === mergeKey(tower))
        .sort((a, b) => rank.get(b.socketId) - rank.get(a.socketId));
    const parts = [];
    let need = STACK;
    for (const t of [tower, ...others]) {
        if (need <= 0) break;
        const n = Math.min(need, t.count);
        parts.push({ x: t.x, z: t.z, socketId: t.socketId, n });
        takeTower(state, t, n);
        need -= n;
    }
    const inherited = R.rand() < RTD.inherit;
    let type = tower.type;
    if (!inherited) {
        // 다른 종류 중 하나 (공명 속성이 바뀐다)
        const pool = RTD_POOL.filter((t) => t !== tower.type);
        type = pool[Math.floor(R.rand() * pool.length)];
    }
    const grade = tower.grade + 1;
    // 같은 결과가 쌓일 칸이 있으면 그리로, 아니면 이 칸(비었으면)이나 빈 칸에
    let out = stackFor(state, type, grade);
    if (out) {
        out.count++;
        state.statsVersion++;
        if (type === 'barracks') syncSoldiers(state, out);
    } else {
        const at = socket.towerId == null ? socket : freeSocket(state);
        out = placeTower(state, at, type, grade);
        if (tower.count === 0) out.targeting = tower.targeting;
    }
    R.merges++;
    emit(state, {
        type: 'rtdMerge',
        towerId: out.id,
        tower: type,
        from: tower.type,
        grade,
        inherited,
        count: out.count,
        x: out.x,
        z: out.z,
        parts
    });
    return { ok: true, tower: out, inherited };
}

/** 합성할 수 있는 타워 목록 (AI·UI 공용): 열쇠마다 하나, 낮은 등급부터 */
export function mergeGroups(state) {
    const seen = new Set();
    const out = [];
    for (const t of state.towers) {
        const k = mergeKey(t);
        if (!k || seen.has(k)) continue;
        seen.add(k);
        if (countSame(state, t) < STACK) continue;
        // 가장 많이 쌓인 칸을 기준으로
        const best = state.towers.filter((o) => mergeKey(o) === k).sort((a, b) => b.count - a.count)[0];
        out.push({ key: k, tower: best, grade: t.grade });
    }
    return out.sort((a, b) => a.grade - b.grade);
}

// ---------- 신화 레시피 ----------

/** 레시피 재료 현황: { legend, parts: [tower|null, tower|null], runes, ready } */
export function recipeStatus(state, mythId) {
    const r = MYTHS[mythId];
    const legend = state.towers.find((t) => t.grade === LEGEND && t.type === mythId) || null;
    const parts = r.parts.map((type) => state.towers.find((x) => x.grade === EPIC && x.type === type) || null);
    const runes = state.rtd.runes >= r.runes;
    return { legend, parts, runes, ready: !!legend && parts.every(Boolean) && runes };
}

export function craftMythic(state, mythId) {
    const r = MYTHS[mythId];
    if (!r || !state.rtd || state.status !== 'playing') return { ok: false, reason: '잘못된 명령입니다.' };
    const st = recipeStatus(state, mythId);
    if (!st.legend) return { ok: false, reason: `전설 ${TOWERS[mythId].name}이 필요합니다.` };
    if (!st.parts.every(Boolean)) return { ok: false, reason: '영웅 재료가 모자랍니다.' };
    if (!st.runes) return { ok: false, reason: '룬 파편이 부족합니다.' };
    state.rtd.runes -= r.runes;
    const socket = state.sockets[st.legend.socketId];
    const branch = st.legend.branch;
    const targeting = st.legend.targeting;
    const parts = [st.legend, ...st.parts].map((t) => ({ x: t.x, z: t.z, socketId: t.socketId, n: 1 }));
    for (const t of [st.legend, ...st.parts]) takeTower(state, t, 1);
    const out = placeTower(state, socket, mythId, MYTH, branch);
    out.targeting = targeting;
    state.rtd.myths++;
    emit(state, {
        type: 'rtdMerge',
        towerId: out.id,
        tower: mythId,
        from: mythId,
        grade: MYTH,
        myth: true,
        name: r.name,
        count: 1,
        x: out.x,
        z: out.z,
        parts
    });
    return { ok: true, tower: out };
}

// ---------- 판매 · 옮기기 ----------

/** 하나 팔 때 받는 것 */
export function rtdSellValue(tower) {
    return { gold: RTD.sellGold[tower.grade], runes: RTD.sellRunes[tower.grade] };
}

/** 하나를 판다 (쌓여 있으면 하나만 빠진다) */
export function rtdSell(state, towerId) {
    const tower = findTower(state, towerId);
    if (!tower || state.status !== 'playing') return { ok: false, reason: '잘못된 명령입니다.' };
    const v = rtdSellValue(tower);
    state.gold += v.gold;
    state.rtd.runes += v.runes;
    takeTower(state, tower, 1);
    emit(state, {
        type: 'sell',
        towerId: tower.id,
        tower: tower.type,
        grade: tower.grade,
        x: tower.x,
        z: tower.z,
        value: v.gold,
        runes: v.runes,
        left: tower.count
    });
    return { ok: true, ...v, left: tower.count };
}

/** 옮기기: 빈 칸이면 옮기고, 다른 타워가 있으면 자리를 바꾼다. 다시 그려지도록 새 id를 준다 */
export function moveTower(state, towerId, socketId) {
    const tower = findTower(state, towerId);
    const dest = state.sockets[socketId];
    if (!tower || !dest || state.status !== 'playing') return { ok: false, reason: '잘못된 명령입니다.' };
    if (dest.id === tower.socketId) return { ok: false, reason: '같은 자리입니다.' };
    const other = dest.towerId != null ? findTower(state, dest.towerId) : null;
    const src = state.sockets[tower.socketId];
    const from = { x: tower.x, z: tower.z };
    const relocate = (t, s) => {
        removeUnitsOf(state, t.id);
        state.statsCache.delete(t.id);
        t.id = state.nextId++;
        t.socketId = s.id;
        t.x = s.x;
        t.z = s.z;
        t.rally = null;
        t.targetId = null;
        t.beams = [];
        s.towerId = t.id;
    };
    src.towerId = null;
    relocate(tower, dest);
    if (other) relocate(other, src);
    state.statsVersion++;
    for (const t of [tower, other]) if (t && t.type === 'barracks') syncSoldiers(state, t);
    emit(state, {
        type: 'rtdMove',
        towerId: tower.id,
        grade: tower.grade,
        x: tower.x,
        z: tower.z,
        fx: from.x,
        fz: from.z,
        swapId: other?.id ?? null
    });
    return { ok: true, swapped: !!other, tower };
}

// ---------- 시간 흐름 ----------

/** 필드에 있는 적 수 (분열·소환으로 생긴 적 포함) */
export function fieldCount(state) {
    let n = 0;
    for (const e of state.enemies) if (e.alive) n++;
    return n;
}

/** 제단 수정의 밝기: 필드가 찰수록 어두워진다 */
export function altarHealth(state) {
    return Math.max(0, 1 - fieldCount(state) / state.rtd.limit);
}

/** 웨이브 시작 전: 웨이브 보상과 이자 */
function payWave(state, waveNo) {
    const reward = RTD.waveGold + RTD.waveGoldStep * waveNo;
    const interest = waveNo > 1 ? Math.min(RTD.interestCap, Math.floor(state.gold * RTD.interest)) : 0;
    state.gold += reward + interest;
    state.stats.goldEarned += reward + interest;
    state.stats.interest = (state.stats.interest || 0) + interest;
    emit(state, { type: 'rtdIncome', wave: waveNo, reward, interest });
}

/**
 * step이 매 틱 부른다. callWave는 엔진의 웨이브 호출(순환 import를 피해 넘겨받는다).
 * 웨이브 타이머 · 보스 제한 시간 · 필드 한도 · 최종 보스 처치 승리.
 */
export function updateRtd(state, dt, callWave) {
    const R = state.rtd;
    const count = fieldCount(state);
    R.peak = Math.max(R.peak, count);
    // 경고 단계: 오를 때만 알린다
    const level = count >= R.warnAt[1] ? 2 : count >= R.warnAt[0] ? 1 : 0;
    if (level > R.warn) emit(state, { type: 'rtdWarn', level, count });
    R.warn = level;
    if (count > R.limit) return lose(state, 'overflow');

    // 보스 제한 시간
    if (R.boss && !R.boss.dead) {
        // 보스가 아직 안 나왔으면(id 없음) 시계만 간다
        const boss = R.boss.id != null ? state.enemies.find((e) => e.id === R.boss.id) : null;
        if (R.boss.id != null && (!boss || !boss.alive)) bossDown(state);
        else {
            R.boss.t -= dt;
            if (R.boss.t <= 0) return lose(state, 'boss');
        }
    }
    if (state.status !== 'playing') return;

    // 웨이브 타이머: 보스가 살아 있으면 멈춘다
    if ((R.boss && !R.boss.dead) || state.waveIndex >= state.waves.length) {
        state.nextWaveIn = null;
        return;
    }
    if (state.nextWaveIn == null) state.nextWaveIn = RTD.waveTime;
    state.nextWaveIn -= dt;
    if (state.nextWaveIn > 0) return;
    payWave(state, state.waveIndex + 1);
    callWave(state, true);
    const wave = state.waves[state.waveIndex - 1];
    if (wave.boss) R.boss = { id: null, t: RTD.bossTime, max: RTD.bossTime, wave: state.waveIndex, dead: false };
    state.nextWaveIn = wave.boss ? null : RTD.waveTime;
}

/** 엔진이 적을 낳은 직후: 보스 웨이브라면 보스 id를 기억한다 */
export function noteSpawn(state, e) {
    const R = state.rtd;
    if (R && R.boss && R.boss.id == null && e.def.boss && e.waveNo === R.boss.wave) R.boss.id = e.id;
}

function bossDown(state) {
    const R = state.rtd;
    R.boss.dead = true;
    R.runes += RTD.bossRunes;
    emit(state, { type: 'rtdBossDown', wave: R.boss.wave, runes: RTD.bossRunes, left: R.boss.t });
    if (R.boss.wave >= state.waves.length) return win(state);
    state.nextWaveIn = RTD.afterBoss;
    R.boss = null;
}

function win(state) {
    // 마지막 보스가 쓰러지면 남은 적은 제단의 빛에 사라진다
    for (const e of state.enemies) {
        if (!e.alive) continue;
        e.alive = false;
        emit(state, { type: 'dawnBurn', id: e.id, enemy: e.type, elite: e.elite, x: e.x, z: e.z });
    }
    state.enemies = [];
    state.spawners = [];
    state.spawnQueue = [];
    state.nextWaveIn = null;
    state.status = 'won';
    emit(state, { type: 'victory', stars: rtdStars(state) });
}

function lose(state, reason) {
    if (state.status !== 'playing') return;
    state.status = 'lost';
    state.rtd.lostBy = reason;
    state.lives = 0;
    emit(state, { type: 'rtdLost', reason });
    emit(state, { type: 'defeat' });
}

/** 별: 필드가 가장 붐볐을 때 기준 (한도의 50% 이하 3개, 80% 이하 2개) */
export function rtdStars(state) {
    const k = state.rtd.peak / state.rtd.limit;
    return k <= 0.5 ? 3 : k <= 0.8 ? 2 : 1;
}

/** HUD: 보스 남은 시간 (없으면 null) */
export function bossTimer(state) {
    const b = state.rtd?.boss;
    return b && !b.dead ? { left: Math.max(0, b.t), max: b.max } : null;
}
