// 아군 유닛: 병영 병사와 영웅(공성전). 적에게 달려가 붙잡아 세우고(막기) 근접전을 벌인다.
// 상태는 state.units에 있고, 적은 e.blockedBy(붙잡은 유닛 id)로 멈춘다.
import { samplePath } from './path.js';
import { dealDamage, towerStats, findTower } from './game.js';

/** 집결지에서 적을 붙잡으러 나가는 거리 */
export const ENGAGE = 1.7;
const MELEE = 0.45;
const SOLDIER_SPEED = 2.6;
const GUARD_SPREAD = 0.4;

export const HERO = {
    name: '새벽의 기사',
    maxLevel: 10,
    xpPerLevel: 12,
    rate: 0.75,
    speed: 3.4,
    engage: 2.4,
    armor: 0.15,
    respawn: 14,
    hp: (lv) => 520 + 75 * (lv - 1),
    dmg: (lv) => 26 + 8 * (lv - 1),
    skill: {
        name: '여명의 일격',
        desc: '주변 적에게 큰 피해를 주고 기절시킨다',
        cooldown: 20,
        radius: 2.2,
        stun: 1.2,
        dmg: (lv) => 140 + 35 * (lv - 1)
    }
};

const ev = (state, e) => state.events.push(e);

function newUnit(state, kind, x, z, extra) {
    return {
        id: state.nextId++,
        kind,
        x,
        z,
        gx: x,
        gz: z,
        hp: 1,
        maxHp: 1,
        cd: 0.3,
        target: null,
        dead: false,
        respawnT: 0,
        face: 0,
        atkT: 0,
        moveTo: null,
        ...extra
    };
}

// ---------- 병영 ----------

/** 소켓에서 가장 가까운 길 위의 점 (기본 집결지) */
export function nearestPathPoint(state, x, z) {
    let best = null;
    let bd = Infinity;
    state.paths.forEach((p, pi) => {
        for (let i = 0; i < p.count; i += 2) {
            const d = (p.xs[i] - x) ** 2 + (p.zs[i] - z) ** 2;
            if (d < bd) {
                bd = d;
                best = { x: p.xs[i], z: p.zs[i], pathIndex: pi, d: i * p.step, dist: 0 };
            }
        }
    });
    if (best) best.dist = Math.sqrt(bd);
    return best;
}

/** 병영 업그레이드·건설 뒤: 병사 수와 체력을 맞추고 집결 자리를 다시 잡는다 */
export function syncSoldiers(state, tower) {
    if (!tower.rally) {
        const p = nearestPathPoint(state, tower.x, tower.z);
        tower.rally = { x: p.x, z: p.z };
    }
    const s = towerStats(state, tower);
    const mine = state.units.filter((u) => u.ownerId === tower.id);
    for (let i = mine.length; i < s.soldiers; i++) {
        const u = newUnit(state, 'soldier', tower.x, tower.z, { ownerId: tower.id });
        u.maxHp = u.hp = s.unitHp;
        state.units.push(u);
        mine.push(u);
        ev(state, { type: 'unitSpawn', id: u.id, x: u.x, z: u.z });
    }
    mine.forEach((u, i) => {
        const gain = Math.max(0, s.unitHp - u.maxHp);
        u.maxHp = s.unitHp;
        if (!u.dead) u.hp = Math.min(u.maxHp, u.hp + gain);
        u.slot = i;
    });
    placeGuards(tower, mine);
}

function placeGuards(tower, mine) {
    const n = mine.length;
    mine.forEach((u, i) => {
        const a = (i / Math.max(1, n)) * Math.PI * 2 + 0.6;
        u.gx = tower.rally.x + (n > 1 ? Math.cos(a) * GUARD_SPREAD : 0);
        u.gz = tower.rally.z + (n > 1 ? Math.sin(a) * GUARD_SPREAD : 0);
    });
}

/** 집결지 옮기기: 병영 사거리 안, 길 가까이만 */
export function setRally(state, towerId, x, z) {
    const tower = findTower(state, towerId);
    if (!tower || tower.type !== 'barracks') return { ok: false, reason: '잘못된 명령입니다.' };
    const s = towerStats(state, tower);
    if (Math.hypot(x - tower.x, z - tower.z) > s.range) return { ok: false, reason: '병영 사거리 밖입니다.' };
    const p = nearestPathPoint(state, x, z);
    if (!p || p.dist > 1.2) return { ok: false, reason: '길 가까이만 집결지로 정할 수 있습니다.' };
    if (Math.hypot(p.x - tower.x, p.z - tower.z) > s.range + 0.3) return { ok: false, reason: '병영 사거리 밖입니다.' };
    tower.rally = { x: p.x, z: p.z };
    const mine = state.units.filter((u) => u.ownerId === tower.id);
    for (const u of mine) release(state, u);
    placeGuards(tower, mine);
    ev(state, { type: 'rally', towerId, x: p.x, z: p.z });
    return { ok: true };
}

/** 타워가 사라질 때 병사도 함께 */
export function removeUnitsOf(state, towerId) {
    for (const u of state.units) if (u.ownerId === towerId) release(state, u);
    state.units = state.units.filter((u) => u.ownerId !== towerId);
}

// ---------- 영웅 ----------

export function createHero(state) {
    const path = state.paths[0];
    const p = samplePath(path, Math.max(0, path.length - 3), {});
    const x = p.x - p.dz * 0.9;
    const z = p.z + p.dx * 0.9;
    const u = newUnit(state, 'hero', x, z, { level: 1, xp: 0, skillCd: 0, homeX: x, homeZ: z });
    u.maxHp = u.hp = HERO.hp(1);
    // 처음 지킬 자리: 맵이 정해 두었으면 그곳, 아니면 첫 갈래의 중간쯤 길가
    if (state.map.hero) {
        [u.gx, u.gz] = state.map.hero;
        u.x = u.homeX = u.gx;
        u.z = u.homeZ = u.gz;
    } else {
        const g = samplePath(path, path.length * 0.45, {});
        u.gx = g.x - g.dz * 0.5;
        u.gz = g.z + g.dx * 0.5;
    }
    state.units.push(u);
    state.hero = u;
    return u;
}

/** 영웅 이동 명령 */
export function commandHero(state, x, z) {
    const h = state.hero;
    if (!h) return { ok: false, reason: '영웅이 없습니다.' };
    if (h.dead) return { ok: false, reason: `영웅 부활까지 ${Math.ceil(h.respawnT)}초` };
    const { rx, rz } = state.map.island;
    if ((x / rx) ** 2 + (z / rz) ** 2 > 0.92) return { ok: false, reason: '갈 수 없는 곳입니다.' };
    release(state, h);
    h.moveTo = { x, z };
    ev(state, { type: 'heroMove', x, z });
    return { ok: true };
}

/** 영웅 기술: 여명의 일격 */
export function heroSkill(state) {
    const h = state.hero;
    if (!h || state.status !== 'playing') return { ok: false, reason: '영웅이 없습니다.' };
    if (h.dead) return { ok: false, reason: '영웅이 쓰러져 있습니다.' };
    if (h.skillCd > 0) return { ok: false, reason: `재사용 대기 ${Math.ceil(h.skillCd)}초` };
    const sk = HERO.skill;
    h.skillCd = sk.cooldown;
    h.atkT = 0.5;
    const r2 = sk.radius * sk.radius;
    for (const e of state.enemies) {
        if (!e.alive || e.burrowT > 0 || (e.x - h.x) ** 2 + (e.z - h.z) ** 2 > r2) continue;
        e.stunT = Math.max(e.stunT, sk.stun * (1 - (e.def.ccResist || 0)));
        dealDamage(state, e, sk.dmg(h.level), 'true', { unit: h, cause: 'hero' });
    }
    ev(state, { type: 'heroSlam', x: h.x, z: h.z, r: sk.radius });
    return { ok: true };
}

/** 처치 경험치: 영웅이 잡으면 1(정예 3, 보스 12), 근처에서 죽으면 그 40% */
export function heroXp(state, e, byHero) {
    const h = state.hero;
    if (!h || h.dead) return;
    const k = e.def.boss ? 12 : e.elite ? 3 : 1;
    if (byHero) h.xp += k;
    else if ((e.x - h.x) ** 2 + (e.z - h.z) ** 2 < 9) h.xp += k * 0.4;
    else return;
    const lv = Math.min(HERO.maxLevel, 1 + Math.floor(h.xp / HERO.xpPerLevel));
    if (lv > h.level) {
        h.level = lv;
        h.maxHp = HERO.hp(lv);
        h.hp = h.maxHp;
        ev(state, { type: 'heroLevel', level: lv, x: h.x, z: h.z });
    }
}

// ---------- 전투 ----------

function unitStats(state, u) {
    if (u.kind === 'hero') {
        return {
            dmg: HERO.dmg(u.level),
            rate: HERO.rate,
            engage: HERO.engage,
            armor: HERO.armor,
            regen: 0,
            cleave: 0.35,
            speed: HERO.speed,
            respawn: HERO.respawn,
            tower: null,
            vulnerable: 0
        };
    }
    const tower = findTower(state, u.ownerId);
    if (!tower) return null;
    const s = towerStats(state, tower);
    return {
        dmg: s.dmg * s.dmgMult,
        rate: s.rate,
        engage: ENGAGE,
        armor: s.unitArmor,
        regen: s.regen,
        cleave: s.cleave,
        speed: SOLDIER_SPEED,
        respawn: s.respawn,
        tower,
        vulnerable: s.vulnerable
    };
}

/** 붙잡고 있던 적을 놓는다 */
export function release(state, u) {
    if (u.target != null) {
        const e = state.enemies.find((o) => o.id === u.target);
        if (e && e.blockedBy === u.id) e.blockedBy = null;
    }
    u.target = null;
}

/** 유닛이 피해를 받는다 (적의 근접 공격) */
export function hurtUnit(state, u, amount) {
    if (u.dead) return;
    const st = unitStats(state, u);
    u.hp -= amount * (1 - (st ? st.armor : 0));
    u.hitT = 0.15;
    if (u.hp > 0) return;
    u.dead = true;
    u.hp = 0;
    u.respawnT = st ? st.respawn : 10;
    u.moveTo = null;
    release(state, u);
    ev(state, { type: 'unitDeath', id: u.id, kind: u.kind, x: u.x, z: u.z });
}

function moveToward(u, tx, tz, step, stopAt = 0.05) {
    const dx = tx - u.x;
    const dz = tz - u.z;
    const d = Math.hypot(dx, dz);
    if (d <= stopAt) return true;
    const k = Math.min(step, d - stopAt * 0.9) / d;
    u.x += dx * k;
    u.z += dz * k;
    u.face = Math.atan2(dz, dx);
    u.moving = true;
    return d - step <= stopAt;
}

function findFoe(state, u, engage, taken) {
    let best = null;
    let bs = Infinity;
    const r2 = engage * engage;
    for (const e of state.enemies) {
        if (!e.alive || e.def.flying || e.burrowT > 0) continue;
        if ((e.x - u.gx) ** 2 + (e.z - u.gz) ** 2 > r2) continue;
        const busy = e.blockedBy != null && e.blockedBy !== u.id;
        const score = Math.hypot(e.x - u.x, e.z - u.z) + (taken.get(e.id) || 0) * 2.5 + (busy ? 1.5 : 0);
        if (score < bs) {
            bs = score;
            best = e;
        }
    }
    return best;
}

export function updateUnits(state, dt) {
    if (!state.units.length) return;
    const byId = new Map();
    for (const e of state.enemies) if (e.alive) byId.set(e.id, e);
    const taken = new Map();
    for (const u of state.units) if (!u.dead && u.target != null) taken.set(u.target, (taken.get(u.target) || 0) + 1);
    for (const u of state.units) {
        u.moving = false;
        if (u.kind === 'hero') u.skillCd = Math.max(0, u.skillCd - dt);
        u.hitT = Math.max(0, (u.hitT || 0) - dt);
        if (u.dead) {
            u.respawnT -= dt;
            if (u.respawnT <= 0) revive(state, u);
            continue;
        }
        u.atkT = Math.max(0, u.atkT - dt);
        const st = unitStats(state, u);
        if (!st) continue;
        if (u.moveTo) {
            if (moveToward(u, u.moveTo.x, u.moveTo.z, st.speed * dt)) {
                u.gx = u.moveTo.x;
                u.gz = u.moveTo.z;
                u.moveTo = null;
            }
            continue;
        }
        let e = u.target != null ? byId.get(u.target) : null;
        const leash = (st.engage + 0.8) ** 2;
        if (u.target != null && (!e || e.burrowT > 0 || (e.x - u.gx) ** 2 + (e.z - u.gz) ** 2 > leash)) {
            release(state, u);
            e = null;
        }
        if (!e) {
            e = findFoe(state, u, st.engage, taken);
            if (e) {
                u.target = e.id;
                taken.set(e.id, (taken.get(e.id) || 0) + 1);
            }
        }
        if (e) {
            const reach = MELEE + e.radius;
            const d = Math.hypot(e.x - u.x, e.z - u.z);
            u.face = Math.atan2(e.z - u.z, e.x - u.x);
            if (d > reach) moveToward(u, e.x, e.z, st.speed * dt, reach * 0.9);
            else {
                if (e.blockedBy == null && !e.def.boss) e.blockedBy = u.id;
                u.cd -= dt;
                if (u.cd <= 0) {
                    u.cd = st.rate;
                    u.atkT = 0.25;
                    strike(state, u, e, st);
                }
            }
            if (st.regen) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * st.regen * dt);
        } else {
            moveToward(u, u.gx, u.gz, st.speed * dt);
            u.cd = Math.max(0, u.cd - dt);
            u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.06 * dt);
        }
    }
}

function strike(state, u, e, st) {
    const opts = { tower: st.tower, unit: u, vulnerable: st.vulnerable, cause: u.kind };
    dealDamage(state, e, st.dmg, 'physical', opts);
    if (st.cleave) {
        for (const o of state.enemies) {
            if (o === e || !o.alive || o.burrowT > 0 || (o.x - e.x) ** 2 + (o.z - e.z) ** 2 > 0.81) continue;
            dealDamage(state, o, st.dmg * st.cleave, 'physical', opts);
        }
    }
    ev(state, { type: 'unitHit', id: u.id, kind: u.kind, x: e.x, z: e.z, cleave: !!st.cleave });
}

function revive(state, u) {
    u.dead = false;
    u.hp = u.maxHp;
    u.target = null;
    u.cd = 0.4;
    if (u.kind === 'hero') {
        u.x = u.homeX;
        u.z = u.homeZ;
    } else {
        const t = findTower(state, u.ownerId);
        if (t) {
            u.x = t.x;
            u.z = t.z;
        }
    }
    ev(state, { type: 'unitSpawn', id: u.id, kind: u.kind, x: u.x, z: u.z });
}
