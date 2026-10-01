// 게임 엔진. 순수 로직만 담고, 렌더러/UI는 state와 events를 읽기만 한다.
import { buildPath, samplePath } from './path.js';
import { MAPS } from './data/maps.js';
import {
    TOWERS,
    MAX_TIER,
    MAX_MASTERY,
    TOWER_ORDER,
    SELL_RATE,
    CHAIN_JUMP,
    baseStats,
    masteryCost,
    resonanceLabel,
    towerMaxHp
} from './data/towers.js';
import { ENEMIES, ELITE, hpScale, atkScale } from './data/enemies.js';
import { WAVES, CAMPAIGN_WAVES, endlessWave, applyTheme } from './data/waves.js';
import { updateUnits, syncSoldiers, removeUnitsOf, createHero, heroXp, hurtUnit } from './units.js';
import { createGates, gateAhead, gateLimit, gateAttack, waveRepairGates, damageGate } from './gates.js';
import {
    createSurvival,
    updateSurvivalEnemy,
    separateEnemies,
    blinkAlong,
    spawnPoint,
    payMines,
    allowedHere,
    baseRepairCost,
    HEIGHT_RANGE,
    checkPlacement,
    occupy,
    release,
    placeBase as placeSurvivalBase,
    footprintCenter,
    sizeOf,
    updateFog
} from './survival.js';

export { setRally, commandHero, heroSkill, HERO } from './units.js';
export { baseRepairCost, checkPlacement } from './survival.js';
export {
    repairGate,
    reinforceGate,
    gateRepairCost,
    gateReinforceOption,
    damageGate,
    findGate,
    GATE_HP,
    GATE_REINFORCE
} from './gates.js';
import { DIFFICULTY } from './data/difficulty.js';

export const WAVE_GAP = 16;
export const EARLY_BONUS_PER_SEC = 1.5;
export const TICK = 1 / 60;

export const SKILLS = {
    meteor: {
        id: 'meteor',
        name: '유성 낙하',
        hotkey: 'Q',
        desc: '지정한 지점에 유성을 떨어뜨려 방어력을 무시하는 광역 피해를 준다.',
        cooldown: 28,
        radius: 1.8,
        delay: 0.9,
        targeted: true
    },
    freeze: {
        id: 'freeze',
        name: '빙결 파동',
        hotkey: 'W',
        desc: '전장의 모든 적을 2.5초 동안 얼린다.',
        cooldown: 50,
        duration: 2.5,
        targeted: false
    }
};

export function meteorDamage(state) {
    return 180 + 30 * state.waveIndex;
}

// ---------- 생성 ----------

export function createGame(mapId = 'dusk', opts = {}) {
    const map = MAPS[mapId];
    if (!map) throw new Error('unknown map ' + mapId);
    const diff = DIFFICULTY[opts.difficulty] || DIFFICULTY.normal;
    // 살아남기의 '생명'은 본진(수정) 체력이다. 난이도는 체력 배율로만 반영한다
    const lives = map.survival ? Math.round(map.lives * (diff.baseMul ?? 1)) : (diff.lives ?? map.lives);
    // 공성전 전용 맵은 언제나 공성전
    const siege = !!opts.siege || !!map.siegeOnly;
    const sockets = map.sockets.map(([x, z], id) => ({ id, x, z, links: [], towerId: null }));
    for (const [a, b] of map.links) {
        sockets[a].links.push(b);
        sockets[b].links.push(a);
    }
    const state = {
        mapId,
        map,
        paths: map.paths.map(buildPath),
        sockets,
        towers: [],
        enemies: [],
        projectiles: [],
        zones: [],
        meteors: [],
        units: [],
        hero: null,
        gates: [],
        spawnQueue: [],
        siege,
        difficulty: diff.id,
        // 공성전은 타워가 무너질 수 있는 대신 적이 조금 약하고 골드가 넉넉하다
        hpMul: (map.hpMul || 1) * diff.hpMul * (siege ? SIEGE_HP : 1),
        endless: !!opts.endless,
        gold: opts.gold ?? Math.round(map.startGold * diff.goldMul * (siege && !map.siegeOnly ? 1.15 : 1)),
        lives,
        maxLives: lives,
        time: 0,
        waves: WAVES[map.waves].slice(),
        waveIndex: 0,
        spawners: [],
        nextWaveIn: null,
        status: 'playing',
        skills: { meteor: { cd: 0 }, freeze: { cd: 0 } },
        stats: { kills: 0, leaks: 0, goldEarned: 0, earlyBonus: 0, built: 0 },
        statsVersion: 0,
        statsCache: new Map(),
        events: [],
        nextId: 1,
        healTick: 0,
        auraTick: 0,
        // 살아남기: 밤 시계·본진·동굴·길 찾기 격자 (그 밖의 맵은 null)
        survival: null
    };
    if (map.survival) state.survival = createSurvival(map, state);
    if (state.endless) ensureWaves(state);
    if (state.siege && !map.noHero) createHero(state);
    state.gates = createGates(state);
    return state;
}

/** 끝없는 밤: 다음 웨이브까지 미리 만들어 둔다 (HUD 미리보기용) */
function ensureWaves(state) {
    while (state.waves.length < state.waveIndex + 2) {
        const n = state.waves.length + 1;
        state.waves.push(applyTheme(endlessWave(n, state.paths.length, state.map.id.length), state.map.waves, n));
    }
}

/** 남은 웨이브가 있는가 (끝없는 밤이면 항상 있다) */
export function hasMoreWaves(state) {
    return state.endless || state.waveIndex < state.waves.length;
}

/** 승리 직후 끝없는 밤으로 이어 간다 */
export function continueEndless(state) {
    // 살아남기는 동이 트면 끝난다
    if (state.status !== 'won' || state.endless || state.survival) return { ok: false };
    state.status = 'playing';
    state.endless = true;
    ensureWaves(state);
    state.nextWaveIn = WAVE_GAP;
    emit(state, { type: 'endless' });
    return { ok: true };
}

/** 막아 낸 웨이브 수 (패배했다면 진행 중이던 웨이브는 제외) */
export function wavesSurvived(state) {
    return Math.max(0, state.status === 'lost' ? state.waveIndex - 1 : state.waveIndex);
}

export { CAMPAIGN_WAVES };

export function drainEvents(state) {
    const ev = state.events;
    state.events = [];
    return ev;
}

const emit = (state, ev) => state.events.push(ev);

// ---------- 타워 스탯 · 공명 ----------

/** 타워가 주는 공명 값 (분기에 따라 커질 수 있다) */
function resonanceValue(tower) {
    const def = TOWERS[tower.type];
    return (tower.branch && def.branches[tower.branch].resonanceValue) || def.resonance.value;
}

/**
 * 이 소켓에 type 타워가 있을 때 받는 공명: 연결된 다른 종류 타워마다 종류별 최댓값 하나.
 * 반환: [{ type, stat, value, label, from: [towerId...] }]
 */
function sourcesAt(state, socketId, type, excludeId = null) {
    const byType = new Map();
    for (const id of state.sockets[socketId].links) {
        const other = state.sockets[id].towerId;
        if (other == null || other === excludeId) continue;
        const t = findTower(state, other);
        if (!t || t.type === type) continue;
        const r = TOWERS[t.type].resonance;
        const cur = byType.get(t.type) || { type: t.type, stat: r.stat, value: 0, from: [] };
        cur.value = Math.max(cur.value, resonanceValue(t));
        cur.from.push(t.id);
        byType.set(t.type, cur);
    }
    return [...byType.values()].map((x) => ({ ...x, label: resonanceLabel(x.stat, x.value) }));
}

/** 이 타워에 공명 버프를 주는 이웃 타워 종류 목록 (중복 없음, 같은 종류 제외) */
export function resonanceDonors(state, tower) {
    return sourcesAt(state, tower.socketId, tower.type, tower.id).map((x) => x.type);
}

/**
 * UI용 공명 정보. received: 이 타워가 받는 효과, given: 이 타워가 이웃에게 주는 효과,
 * openLinks: 아직 빈 연결 소켓 수
 */
export function resonanceInfo(state, tower) {
    return resonancePreview(state, tower.socketId, tower.type, tower);
}

/** 소켓에 type을 지었다고 치고 공명을 미리 계산한다 (건설 미리보기) */
export function resonancePreview(state, socketId, type, self = null) {
    // 살아남기의 건물은 소켓 없이 자유롭게 짓는다: 공명 연결이 없다
    if (socketId == null || !state.sockets[socketId]) return { received: [], given: [], openLinks: 0, links: [] };
    const received = sourcesAt(state, socketId, type, self?.id ?? null);
    const r = TOWERS[type].resonance;
    const value = self ? resonanceValue(self) : r.value;
    const given = [];
    let openLinks = 0;
    for (const id of state.sockets[socketId].links) {
        const other = state.sockets[id].towerId;
        if (other == null) {
            openLinks++;
            continue;
        }
        const t = findTower(state, other);
        if (!t || t.type === type) continue;
        given.push({ towerId: t.id, type: t.type, socketId: id, stat: r.stat, label: resonanceLabel(r.stat, value) });
    }
    return { received, given, openLinks, links: state.sockets[socketId].links.slice() };
}

export function towerStats(state, tower) {
    const key = tower.id;
    const cached = state.statsCache.get(key);
    if (cached && cached.v === state.statsVersion) return cached.s;
    const b = baseStats(tower);
    const m = tower.mastery || 0;
    const dmgUp = 1 + 0.25 * m;
    const s = {
        dmg: (b.dmg || 0) * dmgUp,
        rate: b.rate || 0,
        range: b.range * (1 + 0.05 * m),
        splash: b.splash || 0,
        slow: b.slow || 0,
        slowTime: b.slowTime || 0,
        chain: b.chain || 0,
        falloff: b.falloff || 1,
        multi: b.multi || 1,
        pierce: b.pierce || 0,
        burn: b.burn ? { ...b.burn, dps: b.burn.dps * dmgUp } : null,
        aura: b.aura ? { ...b.aura, dps: b.aura.dps * dmgUp } : null,
        shatter: b.shatter || 1,
        stun: b.stun || 0,
        ramp: b.ramp || null,
        income: Math.round((b.income || 0) * (1 + 0.3 * m)),
        soldiers: b.soldiers || 0,
        unitHp: (b.hp || 0) * (1 + 0.2 * m),
        unitArmor: b.armor || 0,
        regen: b.regen || 0,
        cleave: b.cleave || 0,
        respawn: b.respawn || 0,
        pinned: 0,
        dmgMult: 1,
        vulnerable: 0,
        pen: 0,
        bountyMult: 1,
        donors: []
    };
    // 살아남기: 넓은 맵이라 사거리가 조금 길고, 높은 곳의 타워는 더 멀리 본다
    if (state.survival) s.range *= (state.survival.cfg.rangeMul ?? 1) * (1 + HEIGHT_RANGE * (tower.h || 0));
    const sources = tower.socketId == null ? [] : sourcesAt(state, tower.socketId, tower.type, tower.id);
    for (const src of sources) {
        s.donors.push(src.type);
        if (src.stat === 'range') s.range *= 1 + src.value;
        else if (src.stat === 'damage') s.dmgMult *= 1 + src.value;
        else if (src.stat === 'rate') s.rate /= 1 + src.value;
        else if (src.stat === 'vulnerable') s.vulnerable += src.value;
        else if (src.stat === 'pen') s.pen = Math.max(s.pen, src.value);
        else if (src.stat === 'bounty') s.bountyMult += src.value;
        else if (src.stat === 'pinned') s.pinned += src.value;
    }
    state.statsCache.set(key, { v: state.statsVersion, s });
    return s;
}

/** UI용 초당 피해 추정 (단일 표적 기준) */
export function estimateDps(state, tower) {
    return estimateDpsOf(towerStats(state, tower));
}

export function findTower(state, id) {
    return state.towers.find((t) => t.id === id) || null;
}

// ---------- 명령 ----------

export function canAfford(state, cost) {
    return state.gold >= cost;
}

export function buildTower(state, socketId, type) {
    if (state.status !== 'playing') return { ok: false, reason: '게임이 끝났습니다.' };
    const socket = state.sockets[socketId];
    const def = TOWERS[type];
    if (!socket || !def) return { ok: false, reason: '잘못된 명령입니다.' };
    if (socket.towerId != null) return { ok: false, reason: '이미 타워가 있습니다.' };
    if (!allowedHere(state, socket, type))
        return {
            ok: false,
            reason: socket.vein ? '광맥에는 광산만 지을 수 있습니다.' : '광산은 광맥에만 지을 수 있습니다.'
        };
    const cost = def.tiers[0].cost;
    if (state.gold < cost) return { ok: false, reason: '골드가 부족합니다.' };
    state.gold -= cost;
    const tower = {
        id: state.nextId++,
        type,
        socketId,
        x: socket.x,
        z: socket.z,
        tier: 1,
        branch: null,
        mastery: 0,
        beams: [],
        spent: cost,
        cooldown: 0.25,
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
    if (state.survival) state.survival.flowDirty = true;
    if (state.siege) tower.hp = tower.maxHp = maxHpOf(state, tower);
    if (type === 'barracks') syncSoldiers(state, tower);
    emit(state, { type: 'build', towerId: tower.id, tower: type, x: tower.x, z: tower.z });
    return { ok: true, tower };
}

/**
 * 살아남기: 빈 땅에 자유롭게 짓는다. (i, j) = 건물의 왼쪽 위 타일. 방벽 1×1, 타워·광산 2×2.
 * 광산은 광맥(2×2)에 꼭 맞게만 지을 수 있다.
 */
export function placeBuilding(state, type, i, j) {
    if (state.status !== 'playing') return { ok: false, reason: '게임이 끝났습니다.' };
    const sv = state.survival;
    const def = TOWERS[type];
    if (!sv || !def) return { ok: false, reason: '잘못된 명령입니다.' };
    const chk = checkPlacement(state, type, i, j);
    if (!chk.ok) return { ok: false, reason: chk.reason };
    const cost = def.tiers[0].cost;
    if (state.gold < cost) return { ok: false, reason: '골드가 부족합니다.' };
    state.gold -= cost;
    const s = sizeOf(type);
    const c = footprintCenter(sv.field, i, j, s);
    const f = sv.field;
    const tower = {
        id: state.nextId++,
        type,
        socketId: null,
        cell: { i, j, s },
        veinId: type === 'mine' ? chk.vein : null,
        h: f.level[j * f.N + i],
        x: c.x,
        z: c.z,
        tier: 1,
        branch: null,
        mastery: 0,
        beams: [],
        spent: cost,
        cooldown: 0.25,
        aim: Math.PI / 2,
        targetId: null,
        targeting: 'first',
        kills: 0,
        damage: 0,
        builtAt: state.time
    };
    state.towers.push(tower);
    occupy(state, i, j, s, tower.id);
    state.statsVersion++;
    state.stats.built++;
    tower.hp = tower.maxHp = maxHpOf(state, tower);
    updateFog(state, true);
    emit(state, { type: 'build', towerId: tower.id, tower: type, x: tower.x, z: tower.z, free: true });
    return { ok: true, tower };
}

/** 살아남기: 본진을 세울 터를 고른다. 그때부터 밤 시계가 흐른다 */
export function placeBase(state, i, j) {
    if (!state.survival || state.status !== 'playing') return { ok: false, reason: '잘못된 명령입니다.' };
    const r = placeSurvivalBase(state, i, j);
    if (r.ok) emit(state, { type: 'baseBuilt', x: r.base.x, z: r.base.z });
    return r;
}

/** 레벨업 또는 분기 선택. 레벨 3에서는 branch('a'|'b')가 필요하다 */
export function upgradeTower(state, towerId, branch = null) {
    const tower = findTower(state, towerId);
    if (!tower || state.status !== 'playing') return { ok: false, reason: '잘못된 명령입니다.' };
    const def = TOWERS[tower.type];
    let cost;
    if (tower.branch && tower.mastery >= MAX_MASTERY) return { ok: false, reason: '이미 최종 단계입니다.' };
    if (tower.branch) cost = masteryCost(tower);
    else if (tower.tier < MAX_TIER) cost = def.tiers[tower.tier].cost;
    else if (def.noBranch) return { ok: false, reason: '이미 최종 단계입니다.' };
    else if (branch && def.branches[branch]) cost = def.branches[branch].cost;
    else return { ok: false, reason: '특화 분기를 골라야 합니다.' };
    if (state.gold < cost) return { ok: false, reason: '골드가 부족합니다.' };
    state.gold -= cost;
    tower.spent += cost;
    if (tower.branch) tower.mastery++;
    else if (tower.tier < MAX_TIER) tower.tier++;
    else tower.branch = branch;
    state.statsVersion++;
    if (state.siege) {
        const max = maxHpOf(state, tower);
        tower.hp += max - tower.maxHp;
        tower.maxHp = max;
    }
    if (tower.type === 'barracks') syncSoldiers(state, tower);
    emit(state, {
        type: 'upgrade',
        towerId: tower.id,
        tower: tower.type,
        tier: tower.tier,
        branch: tower.branch,
        mastery: tower.mastery,
        x: tower.x,
        z: tower.z
    });
    return { ok: true, tower, cost };
}

/** 공성전 타워 체력. 살아남기는 건물이 성벽 노릇을 하므로 더 튼튼하다 (map.survival.towerHp 배율) */
function maxHpOf(state, tower) {
    // 방벽은 레벨마다 정해진 체력 (돌 → 다진 돌 → 쇠를 덧댄 벽)
    if (TOWERS[tower.type].attack === 'wall') return TOWERS[tower.type].tiers[tower.tier - 1].hp;
    return Math.round(towerMaxHp(tower) * (state.map.survival?.towerHp ?? 1));
}

export function sellValue(tower) {
    return Math.floor(tower.spent * SELL_RATE);
}

export function sellTower(state, towerId) {
    const tower = findTower(state, towerId);
    if (!tower) return { ok: false, reason: '잘못된 명령입니다.' };
    const value = sellValue(tower);
    state.gold += value;
    removeTower(state, tower);
    emit(state, { type: 'sell', towerId: tower.id, tower: tower.type, x: tower.x, z: tower.z, value });
    return { ok: true, value };
}

/** 이 소켓에 지을 수 있는 타워 종류 (살아남기: 광맥에는 광산만) */
export function buildableTypes(state, socket) {
    return TOWER_ORDER.filter((type) => allowedHere(state, socket, type));
}

function removeTower(state, tower) {
    state.towers = state.towers.filter((t) => t !== tower);
    if (state.survival) release(state, tower);
    if (tower.socketId != null) state.sockets[tower.socketId].towerId = null;
    state.statsCache.delete(tower.id);
    state.statsVersion++;
    removeUnitsOf(state, tower.id);
}

// ---------- 공성전: 타워 체력 ----------

export const SIEGE_HP = 0.88;
export const SIEGE_RANGE = 2.1;
export const SIEGE_RATE = 1.8;
export const SIEGE_DMG = 0.45;
export const REPAIR_RATE = 0.35;
export const WAVE_REPAIR = 0.25;

export function repairCost(tower) {
    if (tower.hp == null || tower.hp >= tower.maxHp) return 0;
    return Math.ceil(((tower.maxHp - tower.hp) / tower.maxHp) * tower.spent * REPAIR_RATE);
}

export function repairTower(state, towerId) {
    const tower = findTower(state, towerId);
    if (!tower || !state.siege || state.status !== 'playing') return { ok: false, reason: '잘못된 명령입니다.' };
    const cost = repairCost(tower);
    if (!cost) return { ok: false, reason: '수리할 곳이 없습니다.' };
    if (state.gold < cost) return { ok: false, reason: '골드가 부족합니다.' };
    state.gold -= cost;
    tower.hp = tower.maxHp;
    emit(state, { type: 'repair', towerId, x: tower.x, z: tower.z, cost });
    return { ok: true, cost };
}

/** 적의 공격이 타워에 맞는다. 체력이 다하면 무너진다 */
export function damageTower(state, tower, amount) {
    if (!state.siege || tower.hp == null) return;
    tower.hp -= amount;
    tower.hitT = state.time;
    if (tower.hp > 0) return;
    removeTower(state, tower);
    state.stats.lost = (state.stats.lost || 0) + 1;
    emit(state, { type: 'towerDestroyed', towerId: tower.id, tower: tower.type, x: tower.x, z: tower.z });
}

/** 살아남기: 본진(수정)이 맞는다. 체력(생명)이 다하면 패배 */
export function damageBase(state, amount) {
    if (!state.survival || state.status !== 'playing') return;
    state.lives = Math.max(0, state.lives - amount);
    state.survival.baseHitT = state.time;
    if (state.lives > 0) return;
    state.status = 'lost';
    emit(state, { type: 'baseDestroyed', x: state.survival.base.x, z: state.survival.base.z });
    emit(state, { type: 'defeat' });
}

/** 살아남기: 본진 수리 (잃은 체력에 비례한 골드) */
export function repairBase(state) {
    if (!state.survival || state.status !== 'playing') return { ok: false, reason: '잘못된 명령입니다.' };
    const cost = baseRepairCost(state);
    if (!cost) return { ok: false, reason: '수리할 곳이 없습니다.' };
    if (state.gold < cost) return { ok: false, reason: '골드가 부족합니다.' };
    state.gold -= cost;
    state.lives = state.maxLives;
    const b = state.survival.base;
    emit(state, { type: 'repair', base: true, x: b.x, z: b.z, cost });
    return { ok: true, cost };
}

/** 타워 기절 (자폭병·용암 군주) */
function stunTowers(state, x, z, r, time) {
    const r2 = r * r;
    for (const t of state.towers) {
        if ((t.x - x) ** 2 + (t.z - z) ** 2 > r2) continue;
        t.stunT = Math.max(t.stunT || 0, time);
        emit(state, { type: 'towerStun', towerId: t.id, x: t.x, z: t.z, time });
    }
}

export const TARGETING = ['first', 'strong', 'close'];
export function setTargeting(state, towerId, mode) {
    const tower = findTower(state, towerId);
    if (!tower || !TARGETING.includes(mode)) return { ok: false };
    tower.targeting = mode;
    return { ok: true };
}

export function canCallWave(state) {
    if (state.status !== 'playing' || !hasMoreWaves(state)) return false;
    // 살아남기: 본진을 세우기 전에는 부를 수 없다
    if (state.survival && !state.survival.started) return false;
    if (state.waveIndex === 0) return true;
    return state.nextWaveIn != null;
}

export function callWave(state, force = false) {
    // force: 살아남기의 밤 시계가 정한 시각이 되면 앞 웨이브가 아직 나오는 중이어도 부른다
    if (state.survival && !state.survival.started) return { ok: false, reason: '먼저 본진을 세우세요.' };
    if (!(force && state.status === 'playing' && hasMoreWaves(state)) && !canCallWave(state))
        return { ok: false, reason: '아직 다음 웨이브를 부를 수 없습니다.' };
    let bonus = 0;
    if (state.nextWaveIn != null && state.nextWaveIn > 0.5) {
        bonus = Math.floor(state.nextWaveIn * EARLY_BONUS_PER_SEC);
        state.gold += bonus;
        state.stats.earlyBonus += bonus;
    }
    const waveNo = ++state.waveIndex;
    // 살아남기: 일찍 부르면 밤 시계가 그 웨이브 시각까지 앞당겨진다
    if (state.survival) state.survival.clock = Math.max(state.survival.clock, state.waves[waveNo - 1].at || 0);
    // 살아남기는 광산이 시간마다 캐고(payMines), 저절로 고쳐지지 않는다 (수리는 골드로)
    if (waveNo > 1 && !state.survival) payIncome(state);
    if (state.siege && !state.survival)
        for (const t of state.towers) t.hp = Math.min(t.maxHp, t.hp + t.maxHp * WAVE_REPAIR);
    waveRepairGates(state);
    if (state.endless) ensureWaves(state);
    const wave = state.waves[waveNo - 1];
    for (const grp of wave.groups) {
        state.spawners.push({ group: grp, waveNo, spawned: 0, nextAt: state.time + grp.delay });
    }
    state.nextWaveIn = null;
    const bossGrp = wave.groups.find((g) => ENEMIES[g.enemy].boss);
    emit(state, {
        type: 'waveStart',
        wave: waveNo,
        bonus,
        hint: wave.hint || null,
        boss: !!bossGrp,
        bossName: bossGrp ? ENEMIES[bossGrp.enemy].name : null,
        endless: !!wave.endless
    });
    return { ok: true, bonus };
}

function payIncome(state) {
    for (const t of state.towers) {
        const inc = towerStats(state, t).income;
        if (!inc) continue;
        state.gold += inc;
        state.stats.mined = (state.stats.mined || 0) + inc;
        emit(state, { type: 'income', towerId: t.id, x: t.x, z: t.z, amount: inc });
    }
}

export function castSkill(state, id, x = 0, z = 0) {
    const skill = SKILLS[id];
    const st = state.skills[id];
    if (!skill || state.status !== 'playing') return { ok: false, reason: '잘못된 명령입니다.' };
    if (st.cd > 0) return { ok: false, reason: '재사용 대기 중입니다.' };
    if (state.waveIndex === 0) return { ok: false, reason: '첫 웨이브 이후에 쓸 수 있습니다.' };
    st.cd = skill.cooldown;
    if (id === 'meteor') {
        state.meteors.push({ x, z, t: skill.delay, r: skill.radius, dmg: meteorDamage(state) });
        emit(state, { type: 'meteorCast', x, z, delay: skill.delay, r: skill.radius });
    } else if (id === 'freeze') {
        for (const e of state.enemies) {
            if (e.def.slowImmune) continue;
            const d = skill.duration * (1 - (e.def.ccResist || 0));
            e.stunT = Math.max(e.stunT, d);
            e.frozenT = Math.max(e.frozenT, d);
        }
        emit(state, { type: 'freeze', duration: skill.duration });
    }
    return { ok: true };
}

// ---------- 시뮬레이션 ----------

const _p = {};

function spawnEnemy(state, grp, waveNo, at = null) {
    const def = ENEMIES[grp.enemy];
    const elite = !!grp.elite;
    const hp = def.hp * hpScale(waveNo) * (elite ? ELITE.hp : 1) * state.hpMul * (grp.hpMul || 1);
    // 끝없는 밤에선 현상금도 조금씩 오른다
    const bountyMul = waveNo > CAMPAIGN_WAVES ? 1 + (waveNo - CAMPAIGN_WAVES) * 0.04 : 1;
    const id = state.nextId++;
    const pathIndex = at?.pathIndex ?? grp.path ?? 0;
    // 개체마다 좌우로 살짝 벌려서 줄 서 있는 느낌을 없앤다 (결정적)
    const offset = def.boss ? 0 : (((id * 0.618034) % 1) - 0.5) * 0.55;
    const cd = (ab, k) => (ab ? ab.every * k : 0);
    const e = {
        id,
        type: def.id,
        def,
        waveNo,
        elite,
        scale: elite ? ELITE.scale : 1,
        hp,
        maxHp: hp,
        speed: def.speed * (state.map.speedMul || 1),
        // 살아남기는 광산이 주 수입이라 현상금이 적다 (map.bountyMul)
        bounty: Math.round(def.bounty * (elite ? ELITE.bounty : 1) * bountyMul * (state.map.bountyMul ?? 1)),
        lives: def.lives * (elite ? ELITE.lives : 1),
        radius: def.radius * (elite ? ELITE.scale : 1),
        pathIndex,
        offset,
        d: at ? Math.max(0, at.d) : 0,
        x: 0,
        z: 0,
        dirX: 1,
        dirZ: 0,
        slow: 0,
        slowT: 0,
        stunT: 0,
        frozenT: 0,
        healT: def.heal ? def.heal.every * 0.5 : 0,
        atk: (def.atk || 0) * atkScale(waveNo) * (elite ? 2 : 1),
        atkCd: 0.6 + ((id * 0.37) % 1),
        blockedBy: null,
        gateId: null,
        burrowT: 0,
        burrowCd: cd(def.burrow, 0.6),
        blinkCd: cd(def.blink, 0.7),
        pulseCd: cd(def.pulse, 0.6),
        summonCd: cd(def.summon, 0.5),
        shieldCd: def.shield ? 2 : 0,
        shield: 0,
        shieldMax: 0,
        wardCd: cd(def.ward, 0.5),
        wardT: 0,
        enraged: false,
        immuneAt: -1,
        alive: true
    };
    if (state.survival) {
        // 살아남기: 동굴에서 나오거나 (분열·소환이면) 부모 곁에서 생긴다
        const p = at && at.x != null ? at : spawnPoint(state, grp, id);
        e.x = p.x;
        e.z = p.z;
        e.dirX = 0;
        e.dirZ = -1;
        e.cave = p.cave ?? null;
    } else placeEnemy(state, e);
    state.enemies.push(e);
    emit(state, { type: 'spawn', id, enemy: e.type, elite, x: e.x, z: e.z, minion: !!at });
}

/** 테스트·개발용: 길 위 지점에 적을 바로 놓는다 */
export function spawnEnemyAt(state, type, d = 0, opts = {}) {
    // 살아남기: opts.x·z가 있으면 그 자리, 없으면 opts.cave 동굴에서
    let at = { pathIndex: opts.path || 0, d };
    if (state.survival) at = opts.x != null ? { x: opts.x, z: opts.z } : null;
    spawnEnemy(state, { enemy: type, elite: !!opts.elite, cave: opts.cave }, opts.waveNo || 1, at);
    return state.enemies[state.enemies.length - 1];
}

/** 분열·소환으로 생긴 적은 프레임 끝에 한꺼번에 넣는다 (순회 중 배열 변경 방지) */
function flushSpawns(state) {
    if (!state.spawnQueue.length) return;
    const q = state.spawnQueue;
    state.spawnQueue = [];
    for (const it of q) spawnEnemy(state, { enemy: it.enemy }, it.waveNo, it);
}

function placeEnemy(state, e) {
    samplePath(state.paths[e.pathIndex], e.d, _p);
    e.x = _p.x - _p.dz * e.offset;
    e.z = _p.z + _p.dx * e.offset;
    e.dirX = _p.dx;
    e.dirZ = _p.dz;
}

function updateSpawners(state) {
    for (const sp of state.spawners) {
        while (sp.spawned < sp.group.count && state.time >= sp.nextAt) {
            spawnEnemy(state, sp.group, sp.waveNo);
            sp.spawned++;
            sp.nextAt += sp.group.gap;
        }
    }
    const before = state.spawners.length;
    state.spawners = state.spawners.filter((sp) => sp.spawned < sp.group.count);
    // 최신 웨이브의 스폰이 모두 끝나면 다음 웨이브 카운트다운 시작 (살아남기는 밤 시계가 정한다)
    if (before > 0 && state.spawners.length === 0 && hasMoreWaves(state) && state.nextWaveIn == null) {
        if (!state.survival) state.nextWaveIn = WAVE_GAP;
        emit(state, { type: 'waveSpawned', wave: state.waveIndex });
    }
}

function updateEnemies(state, dt) {
    const units = state.units.length ? new Map(state.units.map((u) => [u.id, u])) : null;
    for (const e of state.enemies) {
        if (!e.alive) continue;
        const def = e.def;
        if (e.slowT > 0) {
            e.slowT -= dt;
            if (e.slowT <= 0) e.slow = 0;
        }
        if (e.frozenT > 0) e.frozenT -= dt;
        if (e.wardT > 0) e.wardT -= dt;
        // 붙잡은 유닛이 사라졌거나 다른 적을 보고 있으면 풀려난다
        let blocker = null;
        if (e.blockedBy != null) {
            blocker = units && units.get(e.blockedBy);
            if (!blocker || blocker.dead || blocker.target !== e.id) {
                e.blockedBy = null;
                blocker = null;
            }
        }
        if (e.stunT > 0) {
            e.stunT -= dt;
            continue;
        }
        abilities(state, e, dt);
        if (!e.alive) continue;
        if (e.burrowT > 0) {
            e.burrowT -= dt;
            if (e.burrowT <= 0) emit(state, { type: 'unburrow', id: e.id, x: e.x, z: e.z });
        }
        if (blocker && e.blockedBy != null) {
            // 붙잡힌 적은 멈춰서 붙잡은 유닛과 싸운다
            e.atkCd -= dt;
            if (e.atkCd <= 0) {
                e.atkCd = def.boss ? 1.5 : 1;
                const dmg = Math.max(3, e.atk);
                hurtUnit(state, blocker, dmg);
            }
        } else if (state.survival) {
            let sp = e.speed * (1 - e.slow);
            if (e.enraged) sp *= def.enrage.speed;
            if (e.burrowT > 0) sp *= def.burrow.speed;
            updateSurvivalEnemy(state, e, sp, dt, survivalHooks(state));
            if (def.boss && units) stomp(state, e, dt);
        } else {
            let sp = e.speed * (1 - e.slow);
            if (e.enraged) sp *= def.enrage.speed;
            if (e.burrowT > 0) sp *= def.burrow.speed;
            // 성문이 길을 막고 있으면 문 앞에서 멈춘다
            const gate = gateAhead(state, e);
            const limit = gate ? gateLimit(state, e) : Infinity;
            e.d = Math.min(e.d + sp * dt, limit);
            placeEnemy(state, e);
            if (e.d >= state.paths[e.pathIndex].length) {
                leak(state, e);
                continue;
            }
            if (def.boss && units) stomp(state, e, dt);
            if (gate && e.d >= limit - 1e-6) {
                e.gateId = gate.gate.id;
                gateAttack(state, e, gate.gate, dt);
            } else {
                e.gateId = null;
                if (state.siege && e.atk > 0 && e.burrowT <= 0) siegeAttack(state, e, dt);
            }
        }
        if (def.heal) {
            e.healT -= dt;
            if (e.healT <= 0) {
                e.healT = e.def.heal.every;
                const r2 = e.def.heal.radius ** 2;
                let healed = 0;
                for (const o of state.enemies) {
                    if (!o.alive || (o.x - e.x) ** 2 + (o.z - e.z) ** 2 > r2) continue;
                    const before = o.hp;
                    o.hp = Math.min(o.maxHp, o.hp + o.maxHp * e.def.heal.amount);
                    if (o.hp > before) healed++;
                }
                if (healed) emit(state, { type: 'heal', id: e.id, x: e.x, z: e.z, r: e.def.heal.radius });
            }
        }
    }
}

const _hooks = new WeakMap();
/** 살아남기 모듈이 건물에 피해를 줄 때 쓰는 함수들 (state마다 한 번 만든다) */
function survivalHooks(state) {
    let h = _hooks.get(state);
    if (!h) {
        h = {
            damageTower: (t, amount) => damageTower(state, t, amount),
            damageBase: (amount) => damageBase(state, amount)
        };
        _hooks.set(state, h);
    }
    return h;
}

/** 특수 능력: 잠복·도약·분노·기절 파동·소환·보호막·장막 */
function abilities(state, e, dt) {
    const def = e.def;
    if (def.enrage && !e.enraged && e.hp < e.maxHp * def.enrage.below) {
        e.enraged = true;
        emit(state, { type: 'enrage', id: e.id, x: e.x, z: e.z });
    }
    if (def.burrow && e.burrowT <= 0) {
        e.burrowCd -= dt;
        if (e.burrowCd <= 0) {
            e.burrowCd = def.burrow.every;
            e.burrowT = def.burrow.time;
            e.blockedBy = null;
            emit(state, { type: 'burrow', id: e.id, x: e.x, z: e.z });
        }
    }
    if (def.blink) {
        e.blinkCd -= dt;
        if (e.blinkCd <= 0) {
            e.blinkCd = def.blink.every;
            const x0 = e.x;
            const z0 = e.z;
            if (state.survival) blinkAlong(state, e, def.blink.dist);
            else {
                const len = state.paths[e.pathIndex].length;
                // 서 있는 성문은 넘지 못한다
                e.d = Math.min(len - 0.4, gateLimit(state, e), e.d + def.blink.dist);
                placeEnemy(state, e);
            }
            e.blockedBy = null;
            emit(state, { type: 'blink', id: e.id, boss: !!def.boss, x0, z0, x: e.x, z: e.z });
        }
    }
    if (def.pulse) {
        e.pulseCd -= dt;
        if (e.pulseCd <= 0) {
            e.pulseCd = def.pulse.every;
            stunTowers(state, e.x, e.z, def.pulse.radius, def.pulse.stun);
            emit(state, { type: 'pulse', id: e.id, x: e.x, z: e.z, r: def.pulse.radius });
        }
    }
    if (def.summon) {
        e.summonCd -= dt;
        if (e.summonCd <= 0) {
            e.summonCd = def.summon.every;
            for (let i = 0; i < def.summon.count; i++) {
                state.spawnQueue.push({
                    enemy: def.summon.enemy,
                    pathIndex: e.pathIndex,
                    d: e.d - 0.5 - i * 0.35,
                    ...nearby(state, e, i),
                    waveNo: e.waveNo
                });
            }
            emit(state, { type: 'summon', id: e.id, x: e.x, z: e.z });
        }
    }
    if (def.shield) {
        e.shieldCd -= dt;
        if (e.shieldCd <= 0) {
            e.shieldCd = def.shield.every;
            e.shield = e.shieldMax = e.maxHp * def.shield.amount;
            emit(state, { type: 'shield', id: e.id, x: e.x, z: e.z });
        }
    }
    if (def.ward) {
        e.wardCd -= dt;
        if (e.wardCd <= 0) {
            e.wardCd = def.ward.every;
            e.wardT = def.ward.time;
            emit(state, { type: 'ward', id: e.id, x: e.x, z: e.z, time: def.ward.time });
        }
    }
}

/** 살아남기: 분열·소환된 적이 생길 자리 (부모 둘레, 걸을 수 있는 곳) */
function nearby(state, e, i) {
    if (!state.survival) return {};
    const a = e.id * 1.7 + i * 2.1;
    const x = e.x + Math.cos(a) * 0.35;
    const z = e.z + Math.sin(a) * 0.35;
    return state.survival.nav.walkable(x, z) ? { x, z } : { x: e.x, z: e.z };
}

/** 보스는 붙잡히지 않고, 걸으면서 주변 유닛을 짓밟는다 */
function stomp(state, e, dt) {
    e.stompCd = (e.stompCd ?? 1.5) - dt;
    if (e.stompCd > 0) return;
    e.stompCd = 1.6;
    const r2 = (e.radius + 0.9) ** 2;
    let hit = false;
    for (const u of state.units) {
        if (u.dead || (u.x - e.x) ** 2 + (u.z - e.z) ** 2 > r2) continue;
        hurtUnit(state, u, e.atk);
        hit = true;
    }
    if (hit) emit(state, { type: 'stomp', id: e.id, x: e.x, z: e.z, r: e.radius + 0.9 });
}

/** 공성전: 걸어가면서 가까운 타워에 공격을 날린다 */
function siegeAttack(state, e, dt) {
    e.atkCd -= dt;
    if (e.atkCd > 0) return;
    const range = (e.def.boss ? 3 : SIEGE_RANGE) + e.radius;
    let best = null;
    let bd = range * range;
    for (const t of state.towers) {
        const d = (t.x - e.x) ** 2 + (t.z - e.z) ** 2;
        if (d < bd) {
            bd = d;
            best = t;
        }
    }
    if (!best) {
        e.atkCd = 0.25;
        return;
    }
    e.atkCd = e.def.boss ? 2.2 : SIEGE_RATE;
    emit(state, {
        type: 'enemyShot',
        id: e.id,
        enemy: e.type,
        boss: !!e.def.boss,
        x: e.x,
        z: e.z,
        tx: best.x,
        tz: best.z,
        towerId: best.id
    });
    damageTower(state, best, e.atk * SIEGE_DMG);
}

function leak(state, e) {
    e.alive = false;
    state.lives = Math.max(0, state.lives - e.lives);
    state.stats.leaks++;
    emit(state, { type: 'leak', id: e.id, enemy: e.type, lives: e.lives, x: e.x, z: e.z });
    if (state.lives <= 0 && state.status === 'playing') {
        state.status = 'lost';
        emit(state, { type: 'defeat' });
    }
}

function isDisabled(e) {
    return e.slowT > 0 || e.stunT > 0;
}

/** 피해 적용. type: 'physical' | 'magic' | 'true' */
export function dealDamage(state, e, amount, type, opts = {}) {
    if (!e.alive || amount <= 0 || e.burrowT > 0) return 0;
    let dmg = amount;
    const ts = opts.tower ? towerStats(state, opts.tower) : null;
    const pen = ts ? ts.pen : 0;
    const takes = e.def.takes && e.def.takes[opts.cause];
    if (takes != null) {
        dmg *= takes;
        if (takes === 0) {
            if (state.time - e.immuneAt > 0.7) {
                e.immuneAt = state.time;
                emit(state, { type: 'immune', id: e.id, x: e.x, z: e.z });
            }
            return 0;
        }
    }
    if (opts.vulnerable && isDisabled(e)) dmg *= 1 + opts.vulnerable;
    if (ts && ts.pinned && e.blockedBy != null) dmg *= 1 + ts.pinned;
    if (type === 'physical') dmg *= 1 - e.def.armor * (1 - (opts.pierce || 0)) * (1 - pen);
    else if (type === 'magic') dmg *= 1 - e.def.resist * (1 - pen);
    if (e.wardT > 0) dmg *= 1 - e.def.ward.reduce;
    if (opts.tower) opts.tower.damage += dmg;
    if (e.shield > 0) {
        const absorbed = Math.min(e.shield, dmg);
        e.shield -= absorbed;
        dmg -= absorbed;
        if (e.shield <= 0) emit(state, { type: 'shieldBreak', id: e.id, x: e.x, z: e.z });
    }
    e.hp -= dmg;
    if (e.hp <= 0) {
        e.alive = false;
        onDeath(state, e, opts);
        const bounty = Math.round(e.bounty * (ts ? ts.bountyMult : 1));
        state.gold += bounty;
        state.stats.goldEarned += bounty;
        state.stats.kills++;
        if (opts.tower) opts.tower.kills++;
        emit(state, {
            type: 'death',
            id: e.id,
            enemy: e.type,
            elite: e.elite,
            boss: !!e.def.boss,
            x: e.x,
            z: e.z,
            bounty,
            cause: opts.cause || type
        });
    }
    return dmg;
}

/** 죽을 때 능력: 자폭(타워 기절)·분열·꽃가루 치유, 영웅 경험치 */
function onDeath(state, e, opts) {
    const def = e.def;
    if (def.deathBlast) {
        stunTowers(state, e.x, e.z, def.deathBlast.radius, def.deathBlast.stun);
        if (state.siege) {
            const r2 = def.deathBlast.radius ** 2;
            for (const t of state.towers.slice())
                if ((t.x - e.x) ** 2 + (t.z - e.z) ** 2 <= r2) damageTower(state, t, 20 * atkScale(e.waveNo));
            // 본진 곁에서 터지면 본진도 상한다
            const b = state.survival?.base;
            if (b && Math.hypot(b.x - e.x, b.z - e.z) <= def.deathBlast.radius + b.r)
                damageBase(state, 20 * atkScale(e.waveNo));
            // 성문 곁에서 터지면 문도 크게 상한다
            for (const g of state.gates)
                if ((g.x - e.x) ** 2 + (g.z - e.z) ** 2 <= r2 * 1.5) damageGate(state, g, 60 * atkScale(e.waveNo));
        }
        emit(state, { type: 'deathBlast', id: e.id, x: e.x, z: e.z, r: def.deathBlast.radius });
    }
    if (def.split) {
        for (let i = 0; i < def.split.count; i++) {
            state.spawnQueue.push({
                enemy: def.split.into,
                pathIndex: e.pathIndex,
                d: e.d - i * 0.3,
                ...nearby(state, e, i),
                waveNo: e.waveNo
            });
        }
        emit(state, { type: 'split', id: e.id, x: e.x, z: e.z });
    }
    if (def.pollen) {
        const r2 = def.pollen.radius ** 2;
        for (const o of state.enemies) {
            if (!o.alive || o === e || (o.x - e.x) ** 2 + (o.z - e.z) ** 2 > r2) continue;
            o.hp = Math.min(o.maxHp, o.hp + o.maxHp * def.pollen.amount);
        }
        emit(state, { type: 'pollen', id: e.id, x: e.x, z: e.z, r: def.pollen.radius });
    }
    if (state.hero) heroXp(state, e, opts.unit === state.hero);
}

function applySlow(e, amount, time) {
    if (e.def.slowImmune) return;
    const k = 1 - (e.def.ccResist || 0) * 0.5;
    e.slow = Math.max(e.slow, amount * k);
    e.slowT = Math.max(e.slowT, time);
}

function acquireTargets(state, tower, range, count) {
    const r2 = range * range;
    const list = [];
    for (const e of state.enemies) {
        if (!e.alive || e.burrowT > 0) continue;
        const d2 = (e.x - tower.x) ** 2 + (e.z - tower.z) ** 2;
        if (d2 <= r2) list.push({ e, d2 });
    }
    if (!list.length) return list;
    if (tower.targeting === 'strong') list.sort((a, b) => b.e.hp - a.e.hp || b.e.d - a.e.d);
    else if (tower.targeting === 'close') list.sort((a, b) => a.d2 - b.d2);
    else list.sort((a, b) => b.e.d - a.e.d);
    return list.slice(0, count).map((o) => o.e);
}

function updateTowers(state, dt) {
    state.auraTick -= dt;
    const auraPulse = state.auraTick <= 0;
    if (auraPulse) state.auraTick += 0.25;
    for (const tower of state.towers) {
        const def = TOWERS[tower.type];
        if (tower.stunT > 0) {
            tower.stunT -= dt;
            tower.targetId = null;
            if (tower.beams?.length) tower.beams = [];
            continue;
        }
        if (def.attack === 'none' || def.attack === 'barracks' || def.attack === 'wall') continue;
        const s = towerStats(state, tower);
        tower.cooldown -= dt;
        if (def.attack === 'beam') {
            updateBeam(state, tower, s, dt);
            continue;
        }

        if (s.aura) {
            if (auraPulse) {
                const inRange = acquireTargets(state, tower, s.range, 999);
                for (const e of inRange) {
                    applySlow(e, s.aura.slow, 0.4);
                    dealDamage(state, e, s.aura.dps * 0.25 * s.dmgMult, 'magic', {
                        tower,
                        vulnerable: s.vulnerable,
                        cause: 'frost'
                    });
                }
                tower.auraActive = inRange.length > 0;
            }
            continue;
        }

        const targets = acquireTargets(state, tower, s.range, s.multi);
        if (!targets.length) {
            tower.targetId = null;
            continue;
        }
        const first = targets[0];
        tower.targetId = first.id;
        tower.aim = Math.atan2(first.z - tower.z, first.x - tower.x);
        if (tower.cooldown > 0) continue;
        tower.cooldown += s.rate;
        if (tower.cooldown < 0) tower.cooldown = s.rate * 0.5;
        const dmg = s.dmg * s.dmgMult;

        if (def.attack === 'chain') {
            fireChain(state, tower, s, first, dmg);
            continue;
        }
        for (const target of targets) {
            const p = {
                id: state.nextId++,
                kind: tower.branch === 'b' && tower.type === 'frost' ? 'lance' : def.attack,
                towerId: tower.id,
                tower: tower.type,
                branch: tower.branch,
                targetId: target.id,
                sx: tower.x,
                sz: tower.z,
                x: tower.x,
                z: tower.z,
                tx: target.x,
                tz: target.z,
                speed: def.projectileSpeed,
                dmg,
                dmgType: def.dmgType,
                pierce: s.pierce,
                splash: s.splash,
                slow: s.slow,
                slowTime: s.slowTime,
                shatter: s.shatter,
                vulnerable: s.vulnerable,
                burn: s.burn,
                t: 0,
                T: 0
            };
            if (def.attack === 'mortar') {
                // 비행 시간 동안 적이 이동할 거리만큼 앞을 겨눈다
                const dist = Math.hypot(target.x - tower.x, target.z - tower.z);
                p.T = Math.max(0.55, dist / def.projectileSpeed + 0.35);
                const halted = target.stunT > 0 || target.gateId != null || target.blockedBy != null;
                const lead = halted ? 0 : target.speed * (1 - target.slow) * p.T;
                if (state.survival) {
                    // 길이 없으니 지금 걷는 방향으로 앞을 겨눈다 (건물을 치는 중이면 제자리)
                    const k = target.atkTargetId != null ? 0 : lead;
                    p.tx = target.x + target.dirX * k;
                    p.tz = target.z + target.dirZ * k;
                } else {
                    samplePath(state.paths[target.pathIndex], target.d + lead, _p);
                    p.tx = _p.x;
                    p.tz = _p.z;
                }
                p.targetId = null;
            } else {
                p.T = Math.hypot(target.x - tower.x, target.z - tower.z) / p.speed;
            }
            state.projectiles.push(p);
        }
        emit(state, {
            type: 'fire',
            towerId: tower.id,
            tower: tower.type,
            branch: tower.branch,
            x: tower.x,
            z: tower.z,
            aim: tower.aim,
            count: targets.length
        });
    }
}

/** 광선: 같은 적을 비출수록 피해 배율이 오른다. tower.beams = [{ id, t, k }] (k는 렌더용 0~1) */
function updateBeam(state, tower, s, dt) {
    const targets = acquireTargets(state, tower, s.range, s.multi);
    const prev = tower.beams || [];
    const next = targets.map((e) => {
        const old = prev.find((b) => b.id === e.id);
        return { id: e.id, t: old ? old.t + dt : 0, k: 0, x: e.x, z: e.z };
    });
    if (next.some((b) => !prev.find((p) => p.id === b.id)) && next.length) {
        emit(state, {
            type: 'fire',
            towerId: tower.id,
            tower: tower.type,
            branch: tower.branch,
            x: tower.x,
            z: tower.z,
            aim: tower.aim,
            count: next.length
        });
    }
    tower.beams = next;
    if (!targets.length) {
        tower.targetId = null;
        return;
    }
    tower.targetId = targets[0].id;
    tower.aim = Math.atan2(targets[0].z - tower.z, targets[0].x - tower.x);
    const fire = tower.cooldown <= 0;
    if (fire) tower.cooldown += s.rate;
    if (tower.cooldown < 0) tower.cooldown = 0;
    targets.forEach((e, i) => {
        const b = next[i];
        const mult = Math.min(s.ramp.max, 1 + b.t * s.ramp.rate);
        b.k = (mult - 1) / (s.ramp.max - 1);
        if (fire) {
            dealDamage(state, e, s.dmg * s.dmgMult * mult, 'magic', {
                tower,
                vulnerable: s.vulnerable,
                cause: 'arcane'
            });
        }
    });
}

function fireChain(state, tower, s, first, dmg) {
    const hit = new Set();
    const points = [];
    let cur = first;
    let amount = dmg;
    const j2 = CHAIN_JUMP * CHAIN_JUMP;
    for (let i = 0; i < s.chain && cur; i++) {
        hit.add(cur.id);
        points.push({ x: cur.x, z: cur.z, id: cur.id });
        const ex = cur.x;
        const ez = cur.z;
        if (i === 0 && s.stun) {
            cur.stunT = Math.max(cur.stunT, s.stun * (1 - (cur.def.ccResist || 0)));
        }
        dealDamage(state, cur, amount, 'magic', { tower, vulnerable: s.vulnerable, cause: 'storm' });
        amount *= s.falloff;
        let next = null;
        let best = j2;
        for (const e of state.enemies) {
            if (!e.alive || hit.has(e.id)) continue;
            const d2 = (e.x - ex) ** 2 + (e.z - ez) ** 2;
            if (d2 < best) {
                best = d2;
                next = e;
            }
        }
        cur = next;
    }
    emit(state, {
        type: 'chain',
        towerId: tower.id,
        branch: tower.branch,
        x: tower.x,
        z: tower.z,
        points,
        stun: !!s.stun
    });
    emit(state, {
        type: 'fire',
        towerId: tower.id,
        tower: tower.type,
        branch: tower.branch,
        x: tower.x,
        z: tower.z,
        aim: tower.aim,
        count: 1
    });
}

function updateProjectiles(state, dt) {
    const byId = new Map();
    for (const e of state.enemies) if (e.alive) byId.set(e.id, e);
    for (const p of state.projectiles) {
        p.t += dt;
        if (p.kind === 'mortar') {
            const k = Math.min(1, p.t / p.T);
            p.x = p.sx + (p.tx - p.sx) * k;
            p.z = p.sz + (p.tz - p.sz) * k;
            if (k >= 1) {
                p.done = true;
                explode(state, p);
            }
            continue;
        }
        const target = p.targetId != null ? byId.get(p.targetId) : null;
        if (target) {
            p.tx = target.x;
            p.tz = target.z;
        }
        const dx = p.tx - p.x;
        const dz = p.tz - p.z;
        const dist = Math.hypot(dx, dz);
        const stepLen = p.speed * dt;
        if (dist <= stepLen + 0.05) {
            p.x = p.tx;
            p.z = p.tz;
            p.done = true;
            if (target) impact(state, p, target);
        } else {
            p.x += (dx / dist) * stepLen;
            p.z += (dz / dist) * stepLen;
        }
    }
    state.projectiles = state.projectiles.filter((p) => !p.done);
}

function impact(state, p, target) {
    const tower = findTower(state, p.towerId);
    if (p.kind === 'shard' && p.splash > 0) {
        const r2 = p.splash * p.splash;
        for (const e of state.enemies) {
            if (!e.alive || (e.x - p.x) ** 2 + (e.z - p.z) ** 2 > r2) continue;
            applySlow(e, p.slow, p.slowTime);
            dealDamage(state, e, p.dmg, p.dmgType, { tower, vulnerable: p.vulnerable, cause: 'frost' });
        }
        emit(state, { type: 'frostHit', x: p.x, z: p.z, r: p.splash });
        return;
    }
    let dmg = p.dmg;
    if (p.kind === 'lance' && isDisabled(target)) dmg *= p.shatter;
    const shattered = p.kind === 'lance' && isDisabled(target);
    if (p.slow) applySlow(target, p.slow, p.slowTime);
    dealDamage(state, target, dmg, p.dmgType, { tower, pierce: p.pierce, vulnerable: p.vulnerable, cause: p.kind });
    emit(state, { type: 'hit', kind: p.kind, branch: p.branch, x: p.x, z: p.z, shattered });
}

function explode(state, p) {
    const tower = findTower(state, p.towerId);
    const r2 = p.splash * p.splash;
    for (const e of state.enemies) {
        if (!e.alive || (e.x - p.x) ** 2 + (e.z - p.z) ** 2 > r2) continue;
        dealDamage(state, e, p.dmg, p.dmgType, { tower, vulnerable: p.vulnerable, cause: 'ember' });
    }
    if (p.burn) {
        state.zones.push({
            id: state.nextId++,
            x: p.x,
            z: p.z,
            r: p.burn.radius,
            dps: p.burn.dps,
            t: p.burn.duration,
            max: p.burn.duration,
            towerId: p.towerId,
            tick: 0
        });
    }
    emit(state, { type: 'explode', x: p.x, z: p.z, r: p.splash, branch: p.branch, burn: !!p.burn });
}

function updateZones(state, dt) {
    for (const zn of state.zones) {
        zn.t -= dt;
        zn.tick -= dt;
        if (zn.tick <= 0) {
            zn.tick += 0.25;
            const tower = findTower(state, zn.towerId);
            const r2 = zn.r * zn.r;
            for (const e of state.enemies) {
                if (e.alive && (e.x - zn.x) ** 2 + (e.z - zn.z) ** 2 <= r2) {
                    dealDamage(state, e, zn.dps * 0.25, 'true', { tower, cause: 'burn' });
                }
            }
        }
    }
    state.zones = state.zones.filter((zn) => zn.t > 0);
}

function updateMeteors(state, dt) {
    for (const m of state.meteors) {
        m.t -= dt;
        if (m.t > 0) continue;
        const r2 = m.r * m.r;
        for (const e of state.enemies) {
            if (e.alive && (e.x - m.x) ** 2 + (e.z - m.z) ** 2 <= r2)
                dealDamage(state, e, m.dmg, 'true', { cause: 'meteor' });
        }
        state.zones.push({
            id: state.nextId++,
            x: m.x,
            z: m.z,
            r: m.r * 0.8,
            dps: 30,
            t: 2.5,
            max: 2.5,
            towerId: null,
            tick: 0,
            meteor: true
        });
        emit(state, { type: 'meteorImpact', x: m.x, z: m.z, r: m.r });
    }
    state.meteors = state.meteors.filter((m) => m.t > 0);
}

export function step(state, dt = TICK) {
    if (state.status !== 'playing') return;
    state.time += dt;
    for (const k in state.skills) state.skills[k].cd = Math.max(0, state.skills[k].cd - dt);
    if (state.survival) {
        // 본진을 세우기 전에는 시계가 멈춰 있다 (터를 고르는 중)
        if (state.survival.started) {
            updateNight(state, dt);
            if (state.status === 'playing') payMines(state, dt, (t) => towerStats(state, t).income);
        }
        updateFog(state, false, dt);
    } else if (state.nextWaveIn != null) {
        state.nextWaveIn -= dt;
        if (state.nextWaveIn <= 0) callWave(state);
    }
    updateSpawners(state);
    updateEnemies(state, dt);
    if (state.survival) separateEnemies(state, dt);
    updateUnits(state, dt);
    updateTowers(state, dt);
    updateProjectiles(state, dt);
    updateZones(state, dt);
    updateMeteors(state, dt);
    flushSpawns(state);
    state.enemies = state.enemies.filter((e) => e.alive);
    if (
        state.status === 'playing' &&
        !state.endless &&
        !state.survival &&
        state.waveIndex >= state.waves.length &&
        !state.spawners.length &&
        !state.spawnQueue.length &&
        !state.enemies.length
    ) {
        state.status = 'won';
        emit(state, { type: 'victory', stars: starsFor(state) });
    }
}

// ---------- 살아남기: 밤 시계 ----------

/** 판이 시작되면 밤 시계가 간다. 웨이브는 시각(at)에 저절로 오고, 시계가 동틀 시각에 닿으면 승리 */
function updateNight(state, dt) {
    const sv = state.survival;
    sv.clock += dt;
    const next = state.waves[state.waveIndex];
    if (next && sv.clock >= next.at) callWave(state, true);
    // 이번 웨이브가 다 나왔으면 다음 웨이브까지 카운트다운 (일찍 부를 수 있다)
    const after = state.waves[state.waveIndex];
    state.nextWaveIn = after && !state.spawners.length ? Math.max(0.01, after.at - sv.clock) : null;
    if (sv.clock >= sv.dawn) dawnBreaks(state);
}

/** 동이 튼다: 남은 적은 햇빛에 타 사라지고 승리 */
function dawnBreaks(state) {
    const sv = state.survival;
    sv.dawned = true;
    sv.clock = sv.dawn;
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
    emit(state, { type: 'dawn' });
    emit(state, { type: 'victory', stars: starsFor(state) });
}

export function starsFor(state) {
    const ratio = state.lives / state.maxLives;
    return ratio >= 0.9 ? 3 : ratio >= 0.5 ? 2 : 1;
}

/** UI 미리보기: 업그레이드 선택지 목록 */
export function upgradeOptions(tower) {
    const def = TOWERS[tower.type];
    if (tower.branch) {
        if (tower.mastery >= MAX_MASTERY) return [];
        return [{ kind: 'mastery', cost: masteryCost(tower), label: `각성 ${tower.mastery + 1}` }];
    }
    if (tower.tier >= MAX_TIER && def.noBranch) return [];
    if (tower.tier < MAX_TIER)
        return [
            {
                kind: 'tier',
                cost: def.tiers[tower.tier].cost,
                stats: def.tiers[tower.tier],
                label: `레벨 ${tower.tier + 1}`
            }
        ];
    return ['a', 'b'].map((k) => ({
        kind: 'branch',
        key: k,
        cost: def.branches[k].cost,
        stats: def.branches[k],
        label: def.branches[k].name,
        desc: def.branches[k].desc
    }));
}

/** UI 미리보기: 단계 변경(tier/branch/mastery)을 가정한 스탯. 캐시를 오염시키지 않는다 */
export function previewStats(state, tower, change) {
    const fake = { ...tower, ...change, id: Symbol('preview') };
    const s = towerStats(state, fake);
    state.statsCache.delete(fake.id);
    return { stats: s, dps: estimateDpsOf(s) };
}

function estimateDpsOf(s) {
    if (s.soldiers) return (s.soldiers * s.dmg * s.dmgMult) / s.rate;
    if (s.aura) return s.aura.dps * s.dmgMult;
    if (s.ramp) return ((s.dmg * s.dmgMult * s.multi) / s.rate) * ((1 + s.ramp.max) / 2);
    return s.rate > 0 ? (s.dmg * s.dmgMult * s.multi) / s.rate : 0;
}
