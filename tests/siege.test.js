import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    createGame,
    step,
    buildTower,
    upgradeTower,
    sellTower,
    callWave,
    castSkill,
    dealDamage,
    drainEvents,
    towerStats,
    spawnEnemyAt,
    repairTower,
    repairCost,
    setRally,
    commandHero,
    heroSkill,
    HERO,
    WAVE_REPAIR,
    REPAIR_RATE,
    TICK
} from '../src/core/game.js';
import { nearestPathPoint } from '../src/core/units.js';
import { ENEMIES, enemyTraits } from '../src/core/data/enemies.js';
import { WAVES } from '../src/core/data/waves.js';

const run = (st, sec) => {
    for (let t = 0; t < sec; t += TICK) step(st, TICK);
};

/** 소켓 앞 길 위 지점의 경로 거리 */
function pathDNear(st, x, z) {
    return nearestPathPoint(st, x, z).d;
}

// ---------- 병영 ----------

test('병영: 병사 2명이 길 위 집결지에 서고, 레벨 2부터 3명', () => {
    const st = createGame('dusk', { gold: 5000 });
    const t = buildTower(st, 4, 'barracks').tower;
    assert.equal(st.units.filter((u) => u.ownerId === t.id).length, 2);
    assert.ok(nearestPathPoint(st, t.rally.x, t.rally.z).dist < 0.2, '집결지는 길 위');
    assert.ok(Math.hypot(t.rally.x - t.x, t.rally.z - t.z) <= towerStats(st, t).range);
    upgradeTower(st, t.id);
    assert.equal(st.units.filter((u) => u.ownerId === t.id).length, 3);
    sellTower(st, t.id);
    assert.equal(st.units.length, 0, '판매하면 병사도 사라진다');
});

test('병사는 지상 적을 붙잡아 세우고, 비행 적은 막지 못한다', () => {
    const st = createGame('dusk', { gold: 5000 });
    const t = buildTower(st, 4, 'barracks').tower;
    run(st, 3);
    const d = pathDNear(st, t.rally.x, t.rally.z);
    const g = spawnEnemyAt(st, 'grunt', d - 1.2);
    g.hp = g.maxHp = 1e6;
    const w = spawnEnemyAt(st, 'wraith', d - 1.2);
    w.hp = w.maxHp = 1e6;
    run(st, 3);
    assert.notEqual(g.blockedBy, null, '그림자 병사는 붙잡힌다');
    const d0 = g.d;
    run(st, 1);
    assert.equal(g.d, d0, '붙잡힌 적은 움직이지 않는다');
    assert.ok(w.d > d + 1, '망령은 지나간다');
    assert.ok(g.hp < 1e6, '병사가 때린다');
});

test('병사가 쓰러지면 부활 시간 뒤 다시 나온다', () => {
    const st = createGame('dusk', { gold: 5000 });
    const t = buildTower(st, 4, 'barracks').tower;
    run(st, 3);
    const d = pathDNear(st, t.rally.x, t.rally.z);
    const g = spawnEnemyAt(st, 'ironclad', d - 1);
    g.hp = g.maxHp = 1e6;
    g.atk = 500;
    run(st, 4);
    const dead = st.units.filter((u) => u.dead);
    assert.ok(dead.length >= 1, '병사가 쓰러진다');
    g.alive = false;
    run(st, towerStats(st, t).respawn + 0.5);
    assert.ok(
        st.units.every((u) => !u.dead),
        '부활'
    );
});

test('집결지: 사거리 밖이나 길에서 먼 곳은 거절', () => {
    const st = createGame('dusk', { gold: 5000 });
    const t = buildTower(st, 4, 'barracks').tower;
    assert.equal(setRally(st, t.id, t.x + 20, t.z).ok, false);
    const p = nearestPathPoint(st, t.x, t.z);
    assert.equal(setRally(st, t.id, p.x, p.z).ok, true);
});

test('협공: 병영과 연결된 타워는 붙잡힌 적에게 피해 +20%', () => {
    const st = createGame('dusk', { gold: 5000 });
    const [a, b] = st.map.links[0];
    const ranger = buildTower(st, a, 'ranger').tower;
    buildTower(st, b, 'barracks');
    assert.ok(Math.abs(towerStats(st, ranger).pinned - 0.2) < 1e-9);
    const e = spawnEnemyAt(st, 'grunt', 3);
    e.hp = e.maxHp = 1000;
    const free = dealDamage(st, e, 100, 'true', { tower: ranger });
    e.blockedBy = 999;
    const pinned = dealDamage(st, e, 100, 'true', { tower: ranger });
    assert.equal(free, 100);
    assert.ok(Math.abs(pinned - 120) < 1e-9);
});

// ---------- 공성전 ----------

test('공성전이 아니면 타워 체력과 영웅이 없다', () => {
    const st = createGame('dusk', { gold: 1000 });
    const t = buildTower(st, 4, 'ranger').tower;
    assert.equal(t.hp, undefined);
    assert.equal(st.hero, null);
});

test('공성전: 적이 가까운 타워를 공격하고, 체력이 다하면 무너진다', () => {
    // 성채 방어 13번 소켓: 북문 바깥 전초
    const st = createGame('fortress', { gold: 5000 });
    const t = buildTower(st, 13, 'ranger').tower;
    assert.ok(t.hp > 0 && t.hp === t.maxHp);
    st.hero.dead = true;
    st.hero.respawnT = 999;
    const p = nearestPathPoint(st, t.x, t.z);
    const e = spawnEnemyAt(st, 'ironclad', p.d - 0.5, { path: p.pathIndex });
    e.hp = e.maxHp = 1e6;
    e.speed = 0.01;
    run(st, 3);
    assert.ok(t.hp < t.maxHp, '타워가 맞는다');
    t.hp = 1;
    run(st, 2);
    assert.equal(st.towers.includes(t), false, '무너진 타워는 사라진다');
    assert.equal(st.sockets[13].towerId, null);
    assert.ok(drainEvents(st).some((ev) => ev.type === 'towerDestroyed'));
});

test('공성전: 수리 비용과 수리, 웨이브 시작 시 일부 회복', () => {
    const st = createGame('fortress', { gold: 5000 });
    const t = buildTower(st, 4, 'ranger').tower;
    assert.equal(repairCost(t), 0);
    t.hp = t.maxHp / 2;
    const cost = repairCost(t);
    assert.equal(cost, Math.ceil(0.5 * t.spent * REPAIR_RATE));
    const g = st.gold;
    assert.equal(repairTower(st, t.id).ok, true);
    assert.equal(st.gold, g - cost);
    assert.equal(t.hp, t.maxHp);
    t.hp = 100;
    callWave(st);
    assert.ok(Math.abs(t.hp - (100 + t.maxHp * WAVE_REPAIR)) < 1e-9);
    const before = t.maxHp;
    upgradeTower(st, t.id);
    assert.ok(t.maxHp > before, '업그레이드하면 최대 체력이 오른다');
});

test('영웅: 이동 명령, 처치 경험치와 레벨업, 기술', () => {
    const st = createGame('fortress', { gold: 1000 });
    const h = st.hero;
    assert.ok(h && h.kind === 'hero' && h.level === 1);
    const p = nearestPathPoint(st, 2.5, -7);
    assert.equal(commandHero(st, p.x, p.z).ok, true);
    run(st, 12);
    assert.ok(Math.hypot(h.x - p.x, h.z - p.z) < 0.2, '목표 지점에 도착');
    h.xp = HERO.xpPerLevel - 0.5;
    const e = spawnEnemyAt(st, 'grunt', p.d - 0.6, { path: p.pathIndex });
    e.hp = 5;
    run(st, 3);
    assert.equal(e.alive, false);
    assert.equal(h.level, 2);
    assert.equal(h.maxHp, HERO.hp(2));
    const e2 = spawnEnemyAt(st, 'ironclad', p.d, { path: p.pathIndex });
    e2.hp = e2.maxHp = 1e6;
    st.waveIndex = 1;
    assert.equal(heroSkill(st).ok, true);
    assert.ok(e2.stunT > 0 && e2.hp < 1e6);
    assert.equal(heroSkill(st).ok, false, '쿨다운');
});

// ---------- 맵 전용 적 ----------

test('불꽃 정령: 화염 지대 면역, 박격포 폭발 절반', () => {
    const st = createGame('cinder');
    const e = spawnEnemyAt(st, 'flameborn', 3);
    assert.equal(dealDamage(st, e, 50, 'true', { cause: 'burn' }), 0);
    assert.equal(dealDamage(st, e, 100, 'true', { cause: 'ember' }), 50);
    const s = spawnEnemyAt(st, 'stormeater', 3);
    assert.equal(dealDamage(st, s, 100, 'magic', { cause: 'storm' }), 0);
});

test('서리 갑주병: 빙결 스킬과 둔화에 면역', () => {
    const st = createGame('frostvale');
    const e = spawnEnemyAt(st, 'rimeguard', 3);
    st.waveIndex = 1;
    castSkill(st, 'freeze');
    assert.equal(e.stunT, 0);
});

test('분열체는 죽으면 조각 둘, 꽃가루 정령은 죽으며 주변을 치유', () => {
    const st = createGame('voidspire');
    const s = spawnEnemyAt(st, 'splitter', 5);
    dealDamage(st, s, 1e6, 'true');
    step(st, TICK);
    assert.equal(st.enemies.filter((e) => e.type === 'mite').length, 2);
    const b = createGame('bloom');
    const g = spawnEnemyAt(b, 'grunt', 5);
    g.hp = 10;
    const bl = spawnEnemyAt(b, 'bloomer', 5);
    dealDamage(b, bl, 1e6, 'true');
    assert.ok(g.hp > 10);
});

test('도약자는 앞으로 순간이동, 두더지는 숨은 동안 공격받지 않는다', () => {
    const st = createGame('voidspire');
    const s = spawnEnemyAt(st, 'shade', 5);
    s.hp = s.maxHp = 1e6;
    run(st, ENEMIES.shade.blink.every * 0.7 + 0.1);
    assert.ok(s.d > 5 + ENEMIES.shade.blink.dist + 1);
    const b = createGame('bloom');
    const m = spawnEnemyAt(b, 'burrower', 5);
    run(b, ENEMIES.burrower.burrow.every * 0.6 + 0.1);
    assert.ok(m.burrowT > 0);
    assert.equal(dealDamage(b, m, 100, 'true'), 0);
});

test('자폭병·용암 군주는 주변 타워를 기절시킨다', () => {
    const st = createGame('cinder', { gold: 5000 });
    const t = buildTower(st, 4, 'ranger').tower;
    const d = pathDNear(st, t.x, t.z);
    const c = spawnEnemyAt(st, 'cinderling', d);
    dealDamage(st, c, 1e6, 'true');
    assert.ok(t.stunT > 0);
    t.stunT = 0;
    const m = spawnEnemyAt(st, 'magmaLord', d);
    m.speed = 0;
    run(st, ENEMIES.magmaLord.pulse.every * 0.6 + 0.1);
    assert.ok(t.stunT > 0);
});

test('보스 능력: 얼음 보호막·바람 장막·소환, 설인 분노', () => {
    const st = createGame('frostvale');
    const g = spawnEnemyAt(st, 'glacier', 3);
    run(st, 2.1);
    assert.ok(g.shield > 0);
    const hp = g.hp;
    dealDamage(st, g, 50, 'true');
    assert.equal(g.hp, hp, '보호막이 먼저 깎인다');
    const s = createGame('stormreach');
    const tp = spawnEnemyAt(s, 'tempest', 3);
    run(s, ENEMIES.tempest.ward.every * 0.5 + 0.1);
    assert.ok(tp.wardT > 0);
    assert.ok(Math.abs(dealDamage(s, tp, 100, 'true') - 40) < 1e-9);
    const b = createGame('bloom');
    spawnEnemyAt(b, 'thornwood', 6);
    run(b, ENEMIES.thornwood.summon.every * 0.5 + 0.1);
    assert.equal(b.enemies.filter((e) => e.type === 'sprout').length, 2);
    const y = spawnEnemyAt(st, 'yeti', 3);
    y.hp = y.maxHp * 0.4;
    step(st, TICK);
    assert.equal(y.enraged, true);
});

test('맵 웨이브에 전용 적이 섞이고, 마지막 거상은 맵 보스가 된다', () => {
    const has = (waves, id) => waves.some((w) => w.groups.some((g) => g.enemy === id));
    assert.ok(has(WAVES.cinder, 'cinderling') && has(WAVES.cinder, 'flameborn'));
    assert.ok(has(WAVES.frostvale, 'rimeguard') && has(WAVES.frostvale, 'yeti'));
    assert.ok(has(WAVES.voidspire, 'shade') && has(WAVES.voidspire, 'splitter'));
    assert.ok(has(WAVES.bloom, 'bloomer') && has(WAVES.bloom, 'burrower'));
    assert.ok(has(WAVES.stormreach, 'harpy') && has(WAVES.stormreach, 'stormeater'));
    assert.ok(!has(WAVES.dusk, 'cinderling'), '황혼의 성벽은 기본 군세');
    assert.ok(WAVES.cinder[19].groups.some((g) => g.enemy === 'magmaLord'));
    const last = WAVES.voidspire[19].groups.map((g) => g.enemy);
    assert.ok(last.includes('riftlord') && last.includes('colossus'), '거상이 둘이면 하나만 바뀐다');
    for (const d of Object.values(ENEMIES)) {
        assert.ok(d.tip && d.desc, d.id + ' 설명');
        assert.ok(enemyTraits(d).every((t) => t.short && t.long));
    }
});
