const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

function noop() {}

class FakeGainNode {
    constructor() {
        this.gain = {
            value: 0,
            setValueAtTime: noop,
            setTargetAtTime: noop,
            exponentialRampToValueAtTime: noop,
            cancelScheduledValues: noop
        };
    }
    connect() {}
}

class FakeOscillator {
    constructor() {
        this.frequency = { setValueAtTime: noop };
        this.type = 'sine';
    }
    connect() {}
    start() {}
    stop() {}
}

class FakeBufferSource {
    connect() {}
    start() {}
    stop() {}
    set buffer(_) {}
}

class FakeAudioContext {
    constructor() {
        this.destination = {};
        this.currentTime = 0;
        this.sampleRate = 44100;
    }
    createGain() { return new FakeGainNode(); }
    createOscillator() { return new FakeOscillator(); }
    createBuffer(channels, length) {
        return { getChannelData: () => new Float32Array(length * channels) };
    }
    createBufferSource() { return new FakeBufferSource(); }
}

function setupDom() {
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf-8');
    const dom = new JSDOM(html, { pretendToBeVisual: true });
    const { window } = dom;
    const { document } = window;

    const fakePerformance = { now: () => 0 };
    global.window = window;
    global.document = document;
    global.navigator = window.navigator;
    global.performance = fakePerformance;
    window.performance = fakePerformance;

    global.requestAnimationFrame = noop;
    global.cancelAnimationFrame = noop;
    window.requestAnimationFrame = noop;
    window.cancelAnimationFrame = noop;

    window.AudioContext = FakeAudioContext;
    window.webkitAudioContext = FakeAudioContext;
    global.AudioContext = FakeAudioContext;

    window.HTMLCanvasElement.prototype.getContext = () => ({
        fillStyle: '#000', strokeStyle: '#000', lineWidth: 1,
        beginPath: noop, moveTo: noop, lineTo: noop, stroke: noop,
        arc: noop, fillRect: noop, clearRect: noop, fill: noop,
        save: noop, restore: noop, font: '', textAlign: '', textBaseline: '',
        fillText: noop,
        createRadialGradient: () => ({ addColorStop: noop }),
        createLinearGradient: () => ({ addColorStop: noop }),
        setLineDash: noop,
        ellipse: noop,
        resetTransform: noop,
        globalCompositeOperation: 'source-over',
        shadowColor: '',
        shadowBlur: 0,
        globalAlpha: 1,
        lineCap: 'butt',
        lineJoin: 'miter',
        rotate: noop,
        translate: noop,
        closePath: noop,
        setTransform: noop,
        measureText: () => ({ width: 0 }),
        drawImage: noop
    });

    delete require.cache[require.resolve('../main.js')];
    const game = require('../main.js');

    return { window, document, game };
}

function assert(condition, message) {
    if (!condition) throw new Error(`FAIL: ${message}`);
}

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(`FAIL: ${message}\n  expected: ${expected}\n  got:      ${actual}`);
    }
}

function run() {
    const { game } = setupDom();
    const {
        calculateTowerDamage,
        calculateUpgradeCost,
        getWaveEnemyCount,
        getWaveEnemyStats,
        applyExplosion,
        sellTower,
        hexToRgba,
        applyAlpha,
        enemies,
        towers,
        canBuildAt,
        findTarget,
        createTowerData,
        upgradeTower,
        damageEnemy,
        damageEnemyAtIndex,
        pickEnemyType,
        pathTiles,
        ENEMY_TYPE_DEFINITIONS,
        GRID_COLS,
        GRID_ROWS,
        TOWER_MAX_LEVEL,
        projectiles
    } = game;

    // --- calculateTowerDamage ---
    const basicDef = { baseDamage: 20 };
    assertEqual(
        calculateTowerDamage(basicDef, 1),
        20,
        'calculateTowerDamage: 레벨 1 피해는 baseDamage와 동일'
    );
    assertEqual(
        calculateTowerDamage(basicDef, 2),
        parseFloat((20 * 1.5).toFixed(4)),
        'calculateTowerDamage: 레벨 2 피해는 baseDamage * TOWER_DAMAGE_GROWTH(1.5)'
    );
    // 레벨 5 피해
    assertEqual(
        calculateTowerDamage(basicDef, 5),
        parseFloat((20 * Math.pow(1.5, 4)).toFixed(4)),
        'calculateTowerDamage: 레벨 5 피해는 baseDamage * 1.5^4'
    );

    // --- calculateUpgradeCost ---
    const def40 = { baseUpgradeCost: 40 };
    assertEqual(
        calculateUpgradeCost(def40, 1),
        40,
        'calculateUpgradeCost: 레벨 1 비용 = baseUpgradeCost'
    );
    assertEqual(
        calculateUpgradeCost(def40, 2),
        Math.round(40 * 1.6),
        'calculateUpgradeCost: 레벨 2 비용 = base * TOWER_UPGRADE_COST_MULTIPLIER(1.6)'
    );
    // MAX_LEVEL(15) 업그레이드 비용 검증 - 함수 자체는 계산만 수행
    const costAtMax = calculateUpgradeCost(def40, 15);
    assert(costAtMax > 0, 'calculateUpgradeCost: 레벨 15에서도 비용 계산은 양수');

    // --- getWaveEnemyCount ---
    assertEqual(getWaveEnemyCount(1), 9, 'getWaveEnemyCount: 웨이브 1 = 8 + floor(1.5) = 9');
    assertEqual(getWaveEnemyCount(10), 23, 'getWaveEnemyCount: 웨이브 10 = 8 + floor(15) = 23');

    // --- getWaveEnemyStats HP 스케일링 ---
    const stats1 = getWaveEnemyStats(1);
    assertEqual(stats1.hp, 78, 'getWaveEnemyStats: 웨이브 1 체력 = ENEMY_BASE_HP(78)');
    assertEqual(stats1.speed, 49, 'getWaveEnemyStats: 웨이브 1 속도 = ENEMY_SPEED(49)');

    const stats2 = getWaveEnemyStats(2);
    assertEqual(stats2.hp, Math.round(78 * 1.18), 'getWaveEnemyStats: 웨이브 2 체력 = 78 * 1.18');

    // --- getWaveEnemyStats 고웨이브 Infinity 방어 ---
    const statsHigh = getWaveEnemyStats(9999);
    assert(Number.isFinite(statsHigh.hp), 'getWaveEnemyStats: 웨이브 9999 체력은 유한수');
    assert(statsHigh.hp <= Number.MAX_SAFE_INTEGER, 'getWaveEnemyStats: 웨이브 9999 체력은 MAX_SAFE_INTEGER 이하');

    // --- getWaveEnemyStats 보상 스케일링 ---
    const reward1 = getWaveEnemyStats(1).reward;
    assertEqual(reward1, Math.round(14 + 1 * 1.5), 'getWaveEnemyStats: 웨이브 1 보상 = 14 + 1*1.5');
    const reward10 = getWaveEnemyStats(10).reward;
    assertEqual(reward10, Math.round(14 + 10 * 1.5), 'getWaveEnemyStats: 웨이브 10 보상 = 14 + 10*1.5');

    // --- getWaveEnemyStats: armored type ---
    const armoredType = ENEMY_TYPE_DEFINITIONS.find(t => t.id === 'armored');
    const armoredStats = getWaveEnemyStats(1, armoredType);
    assertEqual(armoredStats.hp, Math.round(78 * 3.0), 'getWaveEnemyStats: 장갑 웨이브 1 체력 = 78 * 3.0');
    assertEqual(armoredStats.speed, Math.round(49 * 0.6), 'getWaveEnemyStats: 장갑 속도 = 49 * 0.6');
    assertEqual(armoredStats.reward, Math.round((14 + 1 * 1.5) * 2.0), 'getWaveEnemyStats: 장갑 보상 = base * 2.0');

    // --- getWaveEnemyStats: fast type ---
    const fastType = ENEMY_TYPE_DEFINITIONS.find(t => t.id === 'fast');
    const fastStats = getWaveEnemyStats(1, fastType);
    assertEqual(fastStats.hp, Math.round(78 * 0.4), 'getWaveEnemyStats: 고속 웨이브 1 체력 = 78 * 0.4');
    assertEqual(fastStats.speed, Math.round(49 * 2.5), 'getWaveEnemyStats: 고속 속도 = 49 * 2.5');

    // --- getWaveEnemyStats: boss type ---
    const bossType = ENEMY_TYPE_DEFINITIONS.find(t => t.id === 'boss');
    const bossStats = getWaveEnemyStats(1, bossType);
    assertEqual(bossStats.hp, Math.round(78 * 12.0), 'getWaveEnemyStats: 보스 웨이브 1 체력 = 78 * 12.0');
    assertEqual(bossStats.reward, Math.round((14 + 1 * 1.5) * 8.0), 'getWaveEnemyStats: 보스 보상 = base * 8.0');

    // --- hexToRgba ---
    // 6자리 hex
    assertEqual(hexToRgba('#ff0000', 0.5), 'rgba(255, 0, 0, 0.5)', 'hexToRgba: 6자리 빨간색');
    // 3자리 hex
    assertEqual(hexToRgba('#f00', 0.5), 'rgba(255, 0, 0, 0.5)', 'hexToRgba: 3자리 빨간색');
    // null 입력
    assertEqual(hexToRgba(null, 0.5), 'rgba(255, 255, 255, 0.5)', 'hexToRgba: null 입력');

    // --- applyAlpha ---
    // hex 색상
    assertEqual(applyAlpha('#00ff00', 0.3), hexToRgba('#00ff00', 0.3), 'applyAlpha: hex 색상 변환');
    // null 색상
    assert(applyAlpha(null, 0.5).includes('255, 255, 255'), 'applyAlpha: null 색상은 흰색 기본값');
    // 일반 문자열
    assertEqual(applyAlpha('blue', 0.5), 'blue', 'applyAlpha: 지원하지 않는 형식은 그대로 반환');
    // rgba 입력
    const rgbaResult = applyAlpha('rgba(100, 200, 50, 0.8)', 0.3);
    assert(rgbaResult.includes('100'), 'applyAlpha: rgba 입력 시 R 값 유지');
    assert(rgbaResult.includes('200'), 'applyAlpha: rgba 입력 시 G 값 유지');
    assert(rgbaResult.includes('0.3'), 'applyAlpha: rgba 입력 시 알파 값 교체');

    // --- sellTower ---
    // 정상 판매
    enemies.length = 0;
    towers.length = 0;
    const mockTower = {
        x: 0, y: 0, worldX: 15, worldY: 15,
        type: 'basic', level: 1, spentGold: 100,
        cooldown: 0, activeBeam: null, heading: 0,
        aimAngle: null, flashTimer: 0, recoil: 0,
        auraOffset: 0, range: 165, fireDelay: 0.6,
        damage: 20, upgradeCost: 40
    };
    towers.push(mockTower);
    game.setGold(500);
    const goldBefore = game.gold();
    const soldResult = sellTower(mockTower);
    assertEqual(soldResult, true, 'sellTower: 정상 판매 시 true 반환');
    assertEqual(towers.length, 0, 'sellTower: 판매 후 towers 배열에서 제거');
    const expectedRefund = Math.floor(100 * 0.5);
    assertEqual(game.gold(), goldBefore + expectedRefund, 'sellTower: 판매 시 50% 골드 환급');

    // sellTower: gameOver 시 판매 불가
    enemies.length = 0;
    towers.length = 0;
    const mockTower2 = {
        x: 1, y: 1, worldX: 45, worldY: 45,
        type: 'basic', level: 1, spentGold: 100,
        cooldown: 0, activeBeam: null, heading: 0,
        aimAngle: null, flashTimer: 0, recoil: 0,
        auraOffset: 0, range: 165, fireDelay: 0.6,
        damage: 20, upgradeCost: 40
    };
    towers.push(mockTower2);
    game.setGameOver(true);
    const sellWhenOver = sellTower(mockTower2);
    assertEqual(sellWhenOver, false, 'sellTower: gameOver 상태에서 판매 불가');
    assertEqual(towers.length, 1, 'sellTower: gameOver 시 towers 배열 유지');
    game.setGameOver(false);

    // --- canBuildAt ---
    enemies.length = 0;
    towers.length = 0;
    // 경계 밖 검사
    assertEqual(canBuildAt(-1, 0), false, 'canBuildAt: x < 0 은 건설 불가');
    assertEqual(canBuildAt(0, -1), false, 'canBuildAt: y < 0 은 건설 불가');
    assertEqual(canBuildAt(GRID_COLS, 0), false, 'canBuildAt: x >= GRID_COLS 은 건설 불가');
    assertEqual(canBuildAt(0, GRID_ROWS), false, 'canBuildAt: y >= GRID_ROWS 은 건설 불가');

    // 경로 위 건설 불가
    const testPathKey = '5,5';
    pathTiles.add(testPathKey);
    assertEqual(canBuildAt(5, 5), false, 'canBuildAt: 경로 타일 위에 건설 불가');
    pathTiles.delete(testPathKey);

    // 타워 위 건설 불가
    towers.push({ x: 3, y: 3 });
    assertEqual(canBuildAt(3, 3), false, 'canBuildAt: 기존 타워 위에 건설 불가');
    towers.length = 0;

    // 빈 타일에 건설 가능 (경로 및 타워 없는 좌표)
    pathTiles.delete('1,1');
    assertEqual(canBuildAt(1, 1), true, 'canBuildAt: 빈 타일에 건설 가능');
    towers.length = 0;

    // --- createTowerData ---
    enemies.length = 0;
    towers.length = 0;
    const towerData = createTowerData(2, 3, 'basic');
    assertEqual(towerData.type, 'basic', 'createTowerData: 타입 필드 확인');
    assertEqual(towerData.x, 2, 'createTowerData: x 좌표');
    assertEqual(towerData.y, 3, 'createTowerData: y 좌표');
    assertEqual(towerData.level, 1, 'createTowerData: 초기 레벨 = 1');
    assertEqual(towerData.cooldown, 0, 'createTowerData: 초기 쿨다운 = 0');
    assert(towerData.range > 0, 'createTowerData: 사거리 > 0');
    assert(towerData.damage > 0, 'createTowerData: 피해량 > 0');
    assert(towerData.worldX > 0, 'createTowerData: worldX 계산됨');
    assert(towerData.worldY > 0, 'createTowerData: worldY 계산됨');
    assert(towerData.spentGold > 0, 'createTowerData: spentGold = cost');

    // --- upgradeTower ---
    enemies.length = 0;
    towers.length = 0;
    game.setGold(10000);
    const upgTower = createTowerData(4, 4, 'basic');
    towers.push(upgTower);
    const upgResult = upgradeTower(upgTower);
    assertEqual(upgResult, true, 'upgradeTower: 골드 충분 시 업그레이드 성공');
    assertEqual(upgTower.level, 2, 'upgradeTower: 업그레이드 후 레벨 2');

    // upgradeTower: 골드 부족
    game.setGold(0);
    const upgFail = upgradeTower(upgTower);
    assertEqual(upgFail, false, 'upgradeTower: 골드 부족 시 실패');
    assertEqual(upgTower.level, 2, 'upgradeTower: 골드 부족 시 레벨 유지');

    // upgradeTower: 최대 레벨
    game.setGold(999999);
    upgTower.level = TOWER_MAX_LEVEL;
    const upgMax = upgradeTower(upgTower);
    assertEqual(upgMax, false, 'upgradeTower: 최대 레벨에서 업그레이드 불가');
    assertEqual(upgTower.level, TOWER_MAX_LEVEL, 'upgradeTower: 최대 레벨 유지');
    towers.length = 0;

    // --- findTarget ---
    enemies.length = 0;
    towers.length = 0;
    const mockStyle = { body: '#fff', core: '#fff', outline: '#000', halo: 'rgba(255,255,255,0.5)' };
    const testTower = { worldX: 100, worldY: 100, range: 150 };

    // 사거리 내 적
    enemies.push({ x: 120, y: 120, hp: 50, maxHp: 50, reward: 10, waveIndex: 1, style: mockStyle, waypoint: 2 });
    const target = findTarget(testTower);
    assert(target !== null, 'findTarget: 사거리 내 적 발견');
    assertEqual(target.x, 120, 'findTarget: 올바른 적 반환');

    // 사거리 밖 적만 존재
    enemies.length = 0;
    enemies.push({ x: 900, y: 900, hp: 50, maxHp: 50, reward: 10, waveIndex: 1, style: mockStyle, waypoint: 0 });
    const noTarget = findTarget(testTower);
    assertEqual(noTarget, null, 'findTarget: 사거리 밖 적은 타겟 안됨');
    enemies.length = 0;

    // --- damageEnemy: kill ---
    enemies.length = 0;
    towers.length = 0;
    game.setGold(0);
    const killEnemy = { x: 50, y: 50, hp: 10, maxHp: 10, reward: 20, waveIndex: 1, style: mockStyle, waypoint: 0 };
    enemies.push(killEnemy);
    const killed = damageEnemy(killEnemy, 100);
    assertEqual(killed, true, 'damageEnemy: 치명적 피해 시 true 반환');
    assertEqual(enemies.length, 0, 'damageEnemy: 적 제거됨');
    assertEqual(game.gold(), 20, 'damageEnemy: 적 처치 시 골드 획득');

    // --- damageEnemy: no-kill ---
    enemies.length = 0;
    game.setGold(0);
    const tankEnemy = { x: 60, y: 60, hp: 200, maxHp: 200, reward: 15, waveIndex: 1, style: mockStyle, waypoint: 0 };
    enemies.push(tankEnemy);
    const notKilled = damageEnemy(tankEnemy, 50);
    assertEqual(notKilled, false, 'damageEnemy: 비치명적 피해 시 false 반환');
    assertEqual(enemies.length, 1, 'damageEnemy: 적 생존');
    assertEqual(tankEnemy.hp, 150, 'damageEnemy: HP 감소 확인');
    assertEqual(game.gold(), 0, 'damageEnemy: 미처치 시 골드 미획득');
    enemies.length = 0;

    // --- applyExplosion 범위 피해 + 골드 보상 ---
    enemies.length = 0;
    towers.length = 0;
    game.setGold(0);
    enemies.push({ x: 100, y: 100, hp: 100, maxHp: 100, reward: 14, waveIndex: 1, style: mockStyle, waypoint: 0 });
    enemies.push({ x: 500, y: 500, hp: 100, maxHp: 100, reward: 14, waveIndex: 1, style: mockStyle, waypoint: 0 });
    const mockProjectile = {
        damage: 200,
        explosionRadius: 200,
        explosionColor: 'rgba(0,0,0,0)',
        explosionHaloColor: '#fff',
        explosionStrokeColor: null,
        explosionLife: 0.1
    };
    applyExplosion(mockProjectile, 100, 100);
    assertEqual(enemies.length, 1, 'applyExplosion: 범위(200px) 내 적 1마리 제거');
    assert(enemies[0].x === 500, 'applyExplosion: 범위 밖 적(500,500)은 생존');
    assertEqual(game.gold(), 14, 'applyExplosion: 처치된 적의 골드 보상 획득');
    enemies.length = 0;

    console.log('Unit tests passed');
}

if (require.main === module) {
    run();
}

module.exports = { run };
