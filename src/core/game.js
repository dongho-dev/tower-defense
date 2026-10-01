// 게임 엔진. 순수 로직만 담고, 렌더러/UI는 state와 events를 읽기만 한다.
import { buildPath, samplePath } from './path.js';
import { MAPS } from './data/maps.js';
import { TOWERS, MAX_TIER, SELL_RATE, CHAIN_JUMP, baseStats } from './data/towers.js';
import { ENEMIES, ELITE, hpScale } from './data/enemies.js';
import { WAVES } from './data/waves.js';

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
    const sockets = map.sockets.map(([x, z], id) => ({ id, x, z, links: [], towerId: null }));
    for (const [a, b] of map.links) {
        sockets[a].links.push(b);
        sockets[b].links.push(a);
    }
    return {
        mapId,
        map,
        paths: map.paths.map(buildPath),
        sockets,
        towers: [],
        enemies: [],
        projectiles: [],
        zones: [],
        meteors: [],
        gold: opts.gold ?? map.startGold,
        lives: map.lives,
        maxLives: map.lives,
        time: 0,
        waves: WAVES[map.waves],
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
        auraTick: 0
    };
}

export function drainEvents(state) {
    const ev = state.events;
    state.events = [];
    return ev;
}

const emit = (state, ev) => state.events.push(ev);

// ---------- 타워 스탯 · 공명 ----------

/** 이 타워에 공명 버프를 주는 이웃 타워 종류 목록 (중복 없음, 같은 종류 제외) */
export function resonanceDonors(state, tower) {
    const socket = state.sockets[tower.socketId];
    const types = new Set();
    for (const id of socket.links) {
        const other = state.sockets[id].towerId;
        if (other == null) continue;
        const t = findTower(state, other);
        if (t && t.type !== tower.type) types.add(t.type);
    }
    return [...types];
}

export function towerStats(state, tower) {
    const key = tower.id;
    const cached = state.statsCache.get(key);
    if (cached && cached.v === state.statsVersion) return cached.s;
    const b = baseStats(tower);
    const s = {
        dmg: b.dmg || 0,
        rate: b.rate || 0,
        range: b.range,
        splash: b.splash || 0,
        slow: b.slow || 0,
        slowTime: b.slowTime || 0,
        chain: b.chain || 0,
        falloff: b.falloff || 1,
        multi: b.multi || 1,
        pierce: b.pierce || 0,
        burn: b.burn || null,
        aura: b.aura || null,
        shatter: b.shatter || 1,
        stun: b.stun || 0,
        dmgMult: 1,
        vulnerable: 0,
        donors: resonanceDonors(state, tower)
    };
    for (const type of s.donors) {
        const r = TOWERS[type].resonance;
        if (r.stat === 'range') s.range *= 1 + r.value;
        else if (r.stat === 'damage') s.dmgMult *= 1 + r.value;
        else if (r.stat === 'rate') s.rate /= 1 + r.value;
        else if (r.stat === 'vulnerable') s.vulnerable += r.value;
    }
    state.statsCache.set(key, { v: state.statsVersion, s });
    return s;
}

/** UI용 초당 피해 추정 (단일 표적 기준) */
export function estimateDps(state, tower) {
    const s = towerStats(state, tower);
    if (s.aura) return s.aura.dps * s.dmgMult;
    return s.rate > 0 ? (s.dmg * s.dmgMult * s.multi) / s.rate : 0;
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
    emit(state, { type: 'build', towerId: tower.id, tower: type, x: tower.x, z: tower.z });
    return { ok: true, tower };
}

/** 레벨업 또는 분기 선택. 레벨 3에서는 branch('a'|'b')가 필요하다 */
export function upgradeTower(state, towerId, branch = null) {
    const tower = findTower(state, towerId);
    if (!tower || state.status !== 'playing') return { ok: false, reason: '잘못된 명령입니다.' };
    const def = TOWERS[tower.type];
    let cost;
    if (tower.branch) return { ok: false, reason: '이미 최종 단계입니다.' };
    if (tower.tier < MAX_TIER) cost = def.tiers[tower.tier].cost;
    else if (branch && def.branches[branch]) cost = def.branches[branch].cost;
    else return { ok: false, reason: '특화 분기를 골라야 합니다.' };
    if (state.gold < cost) return { ok: false, reason: '골드가 부족합니다.' };
    state.gold -= cost;
    tower.spent += cost;
    if (tower.tier < MAX_TIER) tower.tier++;
    else tower.branch = branch;
    state.statsVersion++;
    emit(state, {
        type: 'upgrade',
        towerId: tower.id,
        tower: tower.type,
        tier: tower.tier,
        branch: tower.branch,
        x: tower.x,
        z: tower.z
    });
    return { ok: true, tower, cost };
}

export function sellValue(tower) {
    return Math.floor(tower.spent * SELL_RATE);
}

export function sellTower(state, towerId) {
    const tower = findTower(state, towerId);
    if (!tower) return { ok: false, reason: '잘못된 명령입니다.' };
    const value = sellValue(tower);
    state.gold += value;
    state.towers = state.towers.filter((t) => t !== tower);
    state.sockets[tower.socketId].towerId = null;
    state.statsCache.delete(tower.id);
    state.statsVersion++;
    emit(state, { type: 'sell', towerId: tower.id, tower: tower.type, x: tower.x, z: tower.z, value });
    return { ok: true, value };
}

export const TARGETING = ['first', 'strong', 'close'];
export function setTargeting(state, towerId, mode) {
    const tower = findTower(state, towerId);
    if (!tower || !TARGETING.includes(mode)) return { ok: false };
    tower.targeting = mode;
    return { ok: true };
}

export function canCallWave(state) {
    if (state.status !== 'playing' || state.waveIndex >= state.waves.length) return false;
    if (state.waveIndex === 0) return true;
    return state.nextWaveIn != null;
}

export function callWave(state) {
    if (!canCallWave(state)) return { ok: false, reason: '아직 다음 웨이브를 부를 수 없습니다.' };
    let bonus = 0;
    if (state.nextWaveIn != null && state.nextWaveIn > 0.5) {
        bonus = Math.floor(state.nextWaveIn * EARLY_BONUS_PER_SEC);
        state.gold += bonus;
        state.stats.earlyBonus += bonus;
    }
    const waveNo = ++state.waveIndex;
    const wave = state.waves[waveNo - 1];
    for (const grp of wave.groups) {
        state.spawners.push({ group: grp, waveNo, spawned: 0, nextAt: state.time + grp.delay });
    }
    state.nextWaveIn = null;
    emit(state, {
        type: 'waveStart',
        wave: waveNo,
        bonus,
        hint: wave.hint || null,
        boss: wave.groups.some((g) => ENEMIES[g.enemy].boss)
    });
    return { ok: true, bonus };
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

function spawnEnemy(state, grp, waveNo) {
    const def = ENEMIES[grp.enemy];
    const elite = !!grp.elite;
    const hp = def.hp * hpScale(waveNo) * (elite ? ELITE.hp : 1) * (state.map.hpMul || 1) * (grp.hpMul || 1);
    const id = state.nextId++;
    const pathIndex = grp.path || 0;
    // 개체마다 좌우로 살짝 벌려서 줄 서 있는 느낌을 없앤다 (결정적)
    const offset = def.boss ? 0 : (((id * 0.618034) % 1) - 0.5) * 0.55;
    const e = {
        id,
        type: def.id,
        def,
        waveNo,
        elite,
        scale: elite ? ELITE.scale : 1,
        hp,
        maxHp: hp,
        speed: def.speed,
        bounty: Math.round(def.bounty * (elite ? ELITE.bounty : 1)),
        lives: def.lives * (elite ? ELITE.lives : 1),
        radius: def.radius * (elite ? ELITE.scale : 1),
        pathIndex,
        offset,
        d: 0,
        x: 0,
        z: 0,
        dirX: 1,
        dirZ: 0,
        slow: 0,
        slowT: 0,
        stunT: 0,
        frozenT: 0,
        healT: def.heal ? def.heal.every * 0.5 : 0,
        alive: true
    };
    placeEnemy(state, e);
    state.enemies.push(e);
    emit(state, { type: 'spawn', id, enemy: e.type, elite, x: e.x, z: e.z });
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
    // 최신 웨이브의 스폰이 모두 끝나면 다음 웨이브 카운트다운 시작
    if (before > 0 && state.spawners.length === 0 && state.waveIndex < state.waves.length && state.nextWaveIn == null) {
        state.nextWaveIn = WAVE_GAP;
        emit(state, { type: 'waveSpawned', wave: state.waveIndex });
    }
}

function updateEnemies(state, dt) {
    for (const e of state.enemies) {
        if (!e.alive) continue;
        if (e.slowT > 0) {
            e.slowT -= dt;
            if (e.slowT <= 0) e.slow = 0;
        }
        if (e.frozenT > 0) e.frozenT -= dt;
        if (e.stunT > 0) {
            e.stunT -= dt;
            continue;
        }
        e.d += e.speed * (1 - e.slow) * dt;
        placeEnemy(state, e);
        if (e.d >= state.paths[e.pathIndex].length) leak(state, e);
        if (e.def.heal) {
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
    if (!e.alive || amount <= 0) return 0;
    let dmg = amount;
    if (opts.vulnerable && isDisabled(e)) dmg *= 1 + opts.vulnerable;
    if (type === 'physical') dmg *= 1 - e.def.armor * (1 - (opts.pierce || 0));
    else if (type === 'magic') dmg *= 1 - e.def.resist;
    e.hp -= dmg;
    if (opts.tower) opts.tower.damage += dmg;
    if (e.hp <= 0) {
        e.alive = false;
        state.gold += e.bounty;
        state.stats.goldEarned += e.bounty;
        state.stats.kills++;
        if (opts.tower) opts.tower.kills++;
        emit(state, {
            type: 'death',
            id: e.id,
            enemy: e.type,
            elite: e.elite,
            x: e.x,
            z: e.z,
            bounty: e.bounty,
            cause: opts.cause || type
        });
    }
    return dmg;
}

function applySlow(e, amount, time) {
    const k = 1 - (e.def.ccResist || 0) * 0.5;
    e.slow = Math.max(e.slow, amount * k);
    e.slowT = Math.max(e.slowT, time);
}

function acquireTargets(state, tower, range, count) {
    const r2 = range * range;
    const list = [];
    for (const e of state.enemies) {
        if (!e.alive) continue;
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
        const s = towerStats(state, tower);
        tower.cooldown -= dt;

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
                const lead = target.stunT > 0 ? 0 : target.speed * (1 - target.slow) * p.T;
                samplePath(state.paths[target.pathIndex], target.d + lead, _p);
                p.tx = _p.x;
                p.tz = _p.z;
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
    if (state.nextWaveIn != null) {
        state.nextWaveIn -= dt;
        if (state.nextWaveIn <= 0) callWave(state);
    }
    updateSpawners(state);
    updateEnemies(state, dt);
    updateTowers(state, dt);
    updateProjectiles(state, dt);
    updateZones(state, dt);
    updateMeteors(state, dt);
    state.enemies = state.enemies.filter((e) => e.alive);
    if (
        state.status === 'playing' &&
        state.waveIndex >= state.waves.length &&
        !state.spawners.length &&
        !state.enemies.length
    ) {
        state.status = 'won';
        emit(state, { type: 'victory', stars: starsFor(state) });
    }
}

export function starsFor(state) {
    const ratio = state.lives / state.maxLives;
    return ratio >= 0.9 ? 3 : ratio >= 0.5 ? 2 : 1;
}

/** UI 미리보기: 업그레이드 선택지 목록 */
export function upgradeOptions(tower) {
    const def = TOWERS[tower.type];
    if (tower.branch) return [];
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
