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
        this.state = 'running';
    }
    close() { this.state = 'closed'; }
    resume() { this.state = 'running'; return Promise.resolve(); }
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
        projectiles,
        lerpAngle,
        resetGame,
        buildMapData,
        handleLaserAttack,
        getWaypoints,
        getWave,
        getLives,
        update,
        spawnEnemy,
        getAdjustedPickRadius,
        getGameLoopHalted,
        towerPositionSet,
        getRenderDirty,
        initKbCursor,
        moveKbCursor,
        activateKbCursor,
        getKbCursor,
        getKbCursorActive,
        ENEMY_TYPE_MAP
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
    assertEqual(armoredStats.speed, Math.round(49 * 0.6 * (1 + 1 * 0.005)), 'getWaveEnemyStats: 장갑 웨이브 1 속도 = 49 * 0.6 * speedBonus');
    assertEqual(armoredStats.reward, Math.round((14 + 1 * 1.5) * 2.0), 'getWaveEnemyStats: 장갑 보상 = base * 2.0');

    // --- getWaveEnemyStats: fast type ---
    const fastType = ENEMY_TYPE_DEFINITIONS.find(t => t.id === 'fast');
    const fastStats = getWaveEnemyStats(1, fastType);
    assertEqual(fastStats.hp, Math.round(78 * 0.4), 'getWaveEnemyStats: 고속 웨이브 1 체력 = 78 * 0.4');
    assertEqual(fastStats.speed, Math.round(49 * 2.5 * (1 + 1 * 0.005)), 'getWaveEnemyStats: 고속 웨이브 1 속도 = 49 * 2.5 * speedBonus');

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
    towerPositionSet.clear();
    const mockTower = {
        x: 0, y: 0, worldX: 15, worldY: 15,
        type: 'basic', level: 1, spentGold: 100,
        cooldown: 0, activeBeam: null, heading: 0,
        aimAngle: null, flashTimer: 0, recoil: 0,
        auraOffset: 0, range: 165, fireDelay: 0.6,
        damage: 20, upgradeCost: 40
    };
    towers.push(mockTower);
    towerPositionSet.add('0,0');
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
    towerPositionSet.clear();
    const mockTower2 = {
        x: 1, y: 1, worldX: 45, worldY: 45,
        type: 'basic', level: 1, spentGold: 100,
        cooldown: 0, activeBeam: null, heading: 0,
        aimAngle: null, flashTimer: 0, recoil: 0,
        auraOffset: 0, range: 165, fireDelay: 0.6,
        damage: 20, upgradeCost: 40
    };
    towers.push(mockTower2);
    towerPositionSet.add('1,1');
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
    towerPositionSet.add('3,3');
    assertEqual(canBuildAt(3, 3), false, 'canBuildAt: 기존 타워 위에 건설 불가');
    towers.length = 0;
    towerPositionSet.clear();

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
    towerPositionSet.clear();
    game.setGold(10000);
    const upgTower = createTowerData(4, 4, 'basic');
    towers.push(upgTower);
    towerPositionSet.add('4,4');
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
    towerPositionSet.clear();

    // upgradeTower: gameOver 시 업그레이드 불가
    enemies.length = 0;
    towers.length = 0;
    towerPositionSet.clear();
    game.setGold(10000);
    const upgTowerGO = createTowerData(5, 5, 'basic');
    towers.push(upgTowerGO);
    towerPositionSet.add('5,5');
    game.setGameOver(true);
    const upgGameOver = upgradeTower(upgTowerGO);
    assertEqual(upgGameOver, false, 'upgradeTower: gameOver 상태에서 업그레이드 불가');
    assertEqual(upgTowerGO.level, 1, 'upgradeTower: gameOver 시 레벨 유지');
    game.setGameOver(false);
    towers.length = 0;
    towerPositionSet.clear();

    // --- findTarget ---
    enemies.length = 0;
    towers.length = 0;
    const mockStyle = { body: '#fff', core: '#fff', outline: '#000', halo: 'rgba(255,255,255,0.5)' };
    const testTower = { worldX: 100, worldY: 100, range: 150 };

    // 사거리 내 적
    enemies.push({ x: 120, y: 120, hp: 50, maxHp: 50, reward: 10, waveIndex: 1, enemyType: mockStyle, waypoint: 2 });
    const result = findTarget(testTower);
    assert(result !== null, 'findTarget: 사거리 내 적 발견');
    assertEqual(result.enemy.x, 120, 'findTarget: 올바른 적 반환');
    assertEqual(result.index, 0, 'findTarget: 올바른 인덱스 반환');

    // 사거리 밖 적만 존재
    enemies.length = 0;
    enemies.push({ x: 900, y: 900, hp: 50, maxHp: 50, reward: 10, waveIndex: 1, enemyType: mockStyle, waypoint: 0 });
    const noResult = findTarget(testTower);
    assertEqual(noResult, null, 'findTarget: 사거리 밖 적은 타겟 안됨');
    enemies.length = 0;

    // --- damageEnemy: kill ---
    enemies.length = 0;
    towers.length = 0;
    game.setGold(0);
    const killEnemy = { x: 50, y: 50, hp: 10, maxHp: 10, reward: 20, waveIndex: 1, enemyType: mockStyle, waypoint: 0 };
    enemies.push(killEnemy);
    const killed = damageEnemy(killEnemy, 100);
    assertEqual(killed, true, 'damageEnemy: 치명적 피해 시 true 반환');
    assertEqual(enemies.length, 0, 'damageEnemy: 적 제거됨');
    assertEqual(game.gold(), 20, 'damageEnemy: 적 처치 시 골드 획득');

    // --- damageEnemy: no-kill ---
    enemies.length = 0;
    game.setGold(0);
    const tankEnemy = { x: 60, y: 60, hp: 200, maxHp: 200, reward: 15, waveIndex: 1, enemyType: mockStyle, waypoint: 0 };
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
    enemies.push({ x: 100, y: 100, hp: 100, maxHp: 100, reward: 14, waveIndex: 1, enemyType: mockStyle, waypoint: 0 });
    enemies.push({ x: 500, y: 500, hp: 100, maxHp: 100, reward: 14, waveIndex: 1, enemyType: mockStyle, waypoint: 0 });
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

    // --- pickEnemyType ---
    // 웨이브 1~2: 항상 일반 적
    game.setEnemiesToSpawn(5);
    const normalType = pickEnemyType(1);
    assertEqual(normalType.id, 'normal', 'pickEnemyType: 웨이브 1은 일반 적');
    const normalType2 = pickEnemyType(2);
    assertEqual(normalType2.id, 'normal', 'pickEnemyType: 웨이브 2는 일반 적');

    // 보스 조건: waveNumber % 10 === 0 && enemiesToSpawn === 1
    game.setEnemiesToSpawn(1);
    const bossResult = pickEnemyType(10);
    assertEqual(bossResult.id, 'boss', 'pickEnemyType: 웨이브 10 + 마지막 적 = 보스');
    const bossResult2 = pickEnemyType(20);
    assertEqual(bossResult2.id, 'boss', 'pickEnemyType: 웨이브 20 + 마지막 적 = 보스');

    // 비보스 조건: 10의 배수지만 enemiesToSpawn !== 1
    game.setEnemiesToSpawn(5);
    const noBoss = pickEnemyType(10);
    assert(noBoss.id !== 'boss', 'pickEnemyType: enemiesToSpawn !== 1이면 보스 아님');

    // 웨이브 3 이상: 반환값이 유효한 적 타입
    game.setEnemiesToSpawn(5);
    for (let i = 0; i < 20; i++) {
        const result = pickEnemyType(5);
        assert(ENEMY_TYPE_DEFINITIONS.some(t => t.id === result.id),
            'pickEnemyType: 웨이브 5 반환값은 유효한 적 타입');
    }
    game.setEnemiesToSpawn(0);

    // --- lerpAngle ---
    // t=0이면 current 유지
    assertEqual(lerpAngle(0, Math.PI, 0), 0, 'lerpAngle: t=0이면 현재 각도 유지');
    // t=1이면 target 도달
    const fullLerp = lerpAngle(0, 1.0, 1);
    assert(Math.abs(fullLerp - 1.0) < 0.0001, 'lerpAngle: t=1이면 목표 각도 도달');
    // wrap-around: 0 -> -0.1 (짧은 경로 = 음의 방향)
    const wrapResult = lerpAngle(0, -0.1, 1);
    assert(Math.abs(wrapResult - (-0.1)) < 0.0001, 'lerpAngle: 음의 방향 짧은 경로');
    // wrap-around: 0.1 -> 2pi - 0.1 (짧은 경로 = 음의 방향, delta = -0.2)
    const wrapResult2 = lerpAngle(0.1, Math.PI * 2 - 0.1, 1);
    assert(Math.abs(wrapResult2 - (-0.1)) < 0.0001, 'lerpAngle: 2pi 경계 wrap-around');
    // 동일 각도
    assertEqual(lerpAngle(1.5, 1.5, 0.5), 1.5, 'lerpAngle: 동일 각도면 변화 없음');

    // --- resetGame ---
    towerPositionSet.clear();
    game.setGold(9999);
    game.setGameOver(true);
    enemies.push({ x: 0, y: 0, hp: 1, maxHp: 1, reward: 1, waveIndex: 1, enemyType: mockStyle, waypoint: 0 });
    towers.push({ x: 0, y: 0, worldX: 15, worldY: 15, type: 'basic', level: 1, spentGold: 35,
        cooldown: 0, activeBeam: null, heading: 0, aimAngle: null, flashTimer: 0, recoil: 0,
        auraOffset: 0, range: 165, fireDelay: 0.6, damage: 20, upgradeCost: 40 });
    resetGame();
    assertEqual(game.gold(), 100, 'resetGame: 골드 100으로 초기화');
    assertEqual(getLives(), 20, 'resetGame: 생명력 20으로 초기화');
    assertEqual(getWave(), 1, 'resetGame: 웨이브 1로 초기화');
    assertEqual(game.getGameOver(), false, 'resetGame: gameOver false로 초기화');
    assertEqual(towers.length, 0, 'resetGame: 타워 배열 비움');
    assertEqual(enemies.length, 0, 'resetGame: 적 배열 비움');

    // --- buildMapData ---
    buildMapData('map1');
    const wp1 = getWaypoints();
    assert(wp1.length > 0, 'buildMapData: map1 waypoints 생성');
    const pathSize1 = pathTiles.size;
    assert(pathSize1 > 0, 'buildMapData: map1 pathTiles 생성');

    buildMapData('map2');
    const wp2 = getWaypoints();
    assert(wp2.length > 0, 'buildMapData: map2 waypoints 생성');
    assert(wp2[0].x !== wp1[0].x || wp2[0].y !== wp1[0].y, 'buildMapData: map2 시작점이 map1과 다름');
    const pathSize2 = pathTiles.size;
    assert(pathSize2 > 0, 'buildMapData: map2 pathTiles 생성');

    // map1으로 복원
    buildMapData('map1');

    // --- handleLaserAttack ---
    enemies.length = 0;
    towers.length = 0;
    towerPositionSet.clear();
    game.setGold(0);
    // 레이저 타워 생성
    const laserTower = createTowerData(5, 5, 'laser');
    towers.push(laserTower);
    towerPositionSet.add('5,5');
    // 사거리 내 적 배치
    const laserEnemy = { x: laserTower.worldX + 30, y: laserTower.worldY, hp: 1000, maxHp: 1000,
        reward: 10, waveIndex: 1, speed: 49, waypoint: 0, enemyType: mockStyle, heading: 0, pulseSeed: 0 };
    enemies.push(laserEnemy);
    // dt=0.1초 동안 레이저 공격
    handleLaserAttack(laserTower, 0.1, laserTower.def);
    assert(laserEnemy.hp < 1000, 'handleLaserAttack: dt 기반 지속 피해 적용');
    assert(laserTower.activeBeam !== null, 'handleLaserAttack: 빔 상태 활성화');
    assert(laserTower.activeBeam.alpha > 0, 'handleLaserAttack: 빔 알파 > 0');
    // 적 제거 후 다시 호출
    enemies.length = 0;
    handleLaserAttack(laserTower, 0.1, laserTower.def);
    // 타겟 없으면 aimAngle null
    assertEqual(laserTower.aimAngle, null, 'handleLaserAttack: 타겟 없으면 aimAngle null');
    towers.length = 0;
    towerPositionSet.clear();
    enemies.length = 0;

    // --- #73: 후반 웨이브 밸런스 ---
    // 적 속도 웨이브 보정 (웨이브 50)
    const stats50 = getWaveEnemyStats(50);
    assertEqual(stats50.speed, Math.round(49 * (1 + Math.min(50 * 0.005, 0.5))), 'getWaveEnemyStats: 웨이브 50 속도 보정 (1.25배)');
    assert(stats50.speed > 49, 'getWaveEnemyStats: 웨이브 50 속도 > 기본 속도');
    // 적 속도 상한 (웨이브 200)
    const stats200 = getWaveEnemyStats(200);
    assertEqual(stats200.speed, Math.round(49 * 1.5), 'getWaveEnemyStats: 웨이브 200 속도 캡 (1.5배)');
    // 웨이브 9999에서도 캡 유지
    const stats9999speed = getWaveEnemyStats(9999);
    assertEqual(stats9999speed.speed, Math.round(49 * 1.5), 'getWaveEnemyStats: 웨이브 9999 속도 캡 유지');

    // --- #69: buildStaticLayer offCtx null 안전 ---
    const origGetContext = window.HTMLCanvasElement.prototype.getContext;
    window.HTMLCanvasElement.prototype.getContext = () => null;
    let buildStaticLayerError = false;
    try {
        game.buildStaticLayer();
    } catch (e) {
        buildStaticLayerError = true;
    }
    assertEqual(buildStaticLayerError, false, 'buildStaticLayer: offCtx null 시 크래시 없음');
    window.HTMLCanvasElement.prototype.getContext = origGetContext;

    // --- #68: 입력 검증 ---
    // setGameSpeed 상한 클램핑
    game.setGameSpeed(100);
    assertEqual(game.getGameSpeed(), 5, 'setGameSpeed: 상한 100 → 5로 클램핑');
    // setGameSpeed 무효 값
    game.setGameSpeed(NaN);
    assertEqual(game.getGameSpeed(), 1, 'setGameSpeed: NaN → 기본값 1');
    // setGameSpeed 정상 범위
    game.setGameSpeed(3);
    assertEqual(game.getGameSpeed(), 3, 'setGameSpeed: 정상값 3 유지');
    game.setGameSpeed(1);

    // setGold 상한 클램핑
    game.setGold(9999999);
    assertEqual(game.gold(), 999999, 'setGold: 상한 9999999 → 999999로 클램핑');
    // setGold 무효 값 거부
    game.setGold(100);
    game.setGold(NaN);
    assertEqual(game.gold(), 100, 'setGold: NaN 시 값 변경 없음');
    // setGold 음수 클램핑
    game.setGold(-100);
    assertEqual(game.gold(), 0, 'setGold: 음수 → 0으로 클램핑');

    // setWave 범위 클램핑
    game.setWave(99999);
    assertEqual(game.getWave(), 9999, 'setWave: 99999 → WAVE_MAX(9999)로 클램핑');
    game.setWave(1);

    // setLives 하한 클램핑
    game.setLives(-5);
    assertEqual(game.getLives(), 0, 'setLives: -5 → 0으로 클램핑');
    game.setLives(20);

    // --- #75: ARIA/스크린 리더 접근성 ---
    // wave-preview aria-live 속성
    const wavePreview = document.getElementById('wave-preview');
    assertEqual(wavePreview.getAttribute('aria-live'), 'polite', '#75: wave-preview에 aria-live="polite" 추가됨');

    // tower-list role 속성
    const towerList = document.getElementById('tower-list');
    assertEqual(towerList.getAttribute('role'), 'radiogroup', '#75: tower-list의 role이 radiogroup으로 변경됨');

    // 골드 stat-chip aria-live 제거
    const goldEl = document.getElementById('gold');
    const goldChip = goldEl.closest('.stat-chip');
    assertEqual(goldChip.getAttribute('aria-live'), null, '#75: 골드 stat-chip에서 aria-live 제거됨');

    // 속도 버튼 announce
    const speedBtn = document.querySelector('.speed-button[data-speed="2"]');
    const announcer = document.getElementById('a11y-announcer');
    speedBtn.click();
    // announce uses requestAnimationFrame — check synchronous textContent reset
    assertEqual(announcer.textContent, '', '#75: 속도 버튼 클릭 시 announce가 rAF로 텍스트 설정 (동기 시점 빈 문자열)');

    // --- #80: upgrade-tower-button CSS ---
    const cssContent = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf-8');
    assert(cssContent.includes('#upgrade-tower-button'), '#80: style.css에 #upgrade-tower-button 규칙 존재');
    assert(cssContent.includes('#upgrade-tower-button:focus-visible'), '#80: style.css에 #upgrade-tower-button:focus-visible 존재');
    const mainJsContent = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf-8');
    assert(!mainJsContent.includes("'tower-button'") && !mainJsContent.includes('"tower-button"'), '#80: main.js에서 tower-button 클래스 미사용');

    // --- #81: Google Fonts 로컬 전환 + CSP ---
    const htmlContent = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf-8');
    assert(!htmlContent.includes('googleapis.com'), '#81: index.html에 googleapis.com 참조 없음');
    assert(!htmlContent.includes('gstatic.com'), '#81: index.html에 gstatic.com 참조 없음');

    // CSP style-src self만 허용
    const cspMatch = htmlContent.match(/style-src\s+([^;]+)/);
    assert(cspMatch, '#81: CSP에 style-src 지시어 존재');
    assert(!cspMatch[1].includes('https://'), '#81: CSP style-src에 외부 도메인 없음');

    // CSP font-src self만 허용
    const fontSrcMatch = htmlContent.match(/font-src\s+([^;]+)/);
    assert(fontSrcMatch, '#81: CSP에 font-src 지시어 존재');
    assert(!fontSrcMatch[1].includes('https://'), '#81: CSP font-src에 외부 도메인 없음');

    // 폰트 파일 존재
    assert(fs.existsSync(path.join(__dirname, '..', 'fonts', 'NotoSansKR-Regular.woff2')), '#81: NotoSansKR-Regular.woff2 존재');
    assert(fs.existsSync(path.join(__dirname, '..', 'fonts', 'NotoSansKR-Bold.woff2')), '#81: NotoSansKR-Bold.woff2 존재');

    // style.css에 @font-face 선언 존재
    assert(cssContent.includes("@font-face"), '#81: style.css에 @font-face 선언 존재');
    assert(cssContent.includes("NotoSansKR-Regular.woff2"), '#81: style.css에 Regular 폰트 참조');
    assert(cssContent.includes("NotoSansKR-Bold.woff2"), '#81: style.css에 Bold 폰트 참조');

    // --- #77: prefersReducedMotion 기본값 ---
    // jsdom에서 matchMedia는 제한적이므로 기본값 false 확인
    assertEqual(game.getPrefersReducedMotion(), false, '#77: prefersReducedMotion 기본값은 false (jsdom 환경)');

    // --- update: 대기 상태에서 startWave 호출 ---
    enemies.length = 0;
    towers.length = 0;
    projectiles.length = 0;
    game.setWaveInProgress(false);
    game.setNextWaveTimer(0);
    game.setLives(20);
    game.setGameOver(false);
    update(0.1);
    assert(game.getWaveInProgress(), 'update: 대기 상태에서 startWave 호출');

    // --- update: 적 탈출 시 lives 감소 ---
    enemies.length = 0;
    towers.length = 0;
    projectiles.length = 0;
    const waypoints = getWaypoints();
    const lastWp = waypoints[waypoints.length - 1];
    enemies.push({
        x: lastWp.x, y: lastWp.y, hp: 100, maxHp: 100,
        speed: 49, waypoint: waypoints.length - 1, reward: 10,
        waveIndex: 1, heading: 0, enemyType: mockStyle, pulseSeed: 0
    });
    game.setLives(5);
    game.setGameOver(false);
    update(0.5);
    assert(getLives() < 5, 'update: 적 탈출 시 lives 감소');
    enemies.length = 0;

    // --- damageEnemyAtIndex: 유효 인덱스 처치 ---
    enemies.length = 0;
    game.setGold(0);
    enemies.push({ x: 100, y: 100, hp: 10, maxHp: 10, reward: 15,
        waveIndex: 1, enemyType: mockStyle, waypoint: 0, heading: 0 });
    const daiKilled = damageEnemyAtIndex(0, 100);
    assert(daiKilled === true, 'damageEnemyAtIndex: 처치 시 true 반환');
    assertEqual(enemies.length, 0, 'damageEnemyAtIndex: 처치 시 배열에서 제거');
    assertEqual(game.gold(), 15, 'damageEnemyAtIndex: 처치 시 reward 지급');

    // --- damageEnemyAtIndex: 무효 인덱스 ---
    const invalidResult = damageEnemyAtIndex(99, 10);
    assert(invalidResult === false, 'damageEnemyAtIndex: 무효 인덱스는 false 반환');

    // --- damageEnemyAtIndex: 피해만 (미처치) ---
    enemies.length = 0;
    enemies.push({ x: 100, y: 100, hp: 100, maxHp: 100, reward: 10,
        waveIndex: 1, enemyType: mockStyle, waypoint: 0, heading: 0 });
    const notKilledDai = damageEnemyAtIndex(0, 30);
    assert(notKilledDai === false, 'damageEnemyAtIndex: 미처치 시 false 반환');
    assertEqual(enemies[0].hp, 70, 'damageEnemyAtIndex: hp 감소');
    assertEqual(enemies.length, 1, 'damageEnemyAtIndex: 미처치 시 배열 유지');
    enemies.length = 0;

    // --- getAdjustedPickRadius: scale >= 1 시 기본값 유지 ---
    // canvas.getBoundingClientRect는 fake context이므로 기본적으로 원본 크기 반환 가정
    // jsdom 환경에서 rect.width = 0이므로 canvas가 없는 것과 유사 → baseRadius 반환
    const adjRadius = getAdjustedPickRadius(18);
    assert(adjRadius >= 18, 'getAdjustedPickRadius: baseRadius 이상 반환');

    // --- gameLoopHalted 초기값 ---
    assertEqual(getGameLoopHalted(), false, 'gameLoopHalted: 초기값 false');

    // --- canBuildAt towerPositionSet ---
    enemies.length = 0;
    towers.length = 0;
    towerPositionSet.clear();
    towerPositionSet.add('3,3');
    assertEqual(canBuildAt(3, 3), false, 'canBuildAt towerPositionSet: Set에 있으면 건설 불가');
    towerPositionSet.delete('3,3');
    pathTiles.delete('3,3');
    assertEqual(canBuildAt(3, 3), true, 'canBuildAt towerPositionSet: Set에 없으면 건설 가능');
    towerPositionSet.clear();

    // --- renderDirty 초기값 ---
    assert(getRenderDirty() !== undefined, 'renderDirty: 값이 정의되어 있음');

    // --- 키보드 커서 (#94) ---
    initKbCursor();
    const cursor = getKbCursor();
    assert(cursor !== null, 'initKbCursor: 커서 생성');
    assertEqual(cursor.x, Math.floor(GRID_COLS / 2), 'initKbCursor: x 중앙');
    assertEqual(cursor.y, Math.floor(GRID_ROWS / 2), 'initKbCursor: y 중앙');
    assert(getKbCursorActive() === true, 'initKbCursor: active = true');

    // 이동 + 경계 클램핑
    moveKbCursor(-cursor.x, 0); // 좌측 끝으로
    assertEqual(getKbCursor().x, 0, 'moveKbCursor: 좌측 경계 클램핑');
    moveKbCursor(-1, 0);
    assertEqual(getKbCursor().x, 0, 'moveKbCursor: 좌측 경계 초과 방지');
    moveKbCursor(1, 0);
    assertEqual(getKbCursor().x, 1, 'moveKbCursor: 우측 이동');

    // ENEMY_TYPE_MAP 정합성
    ENEMY_TYPE_DEFINITIONS.forEach(t => {
        assert(ENEMY_TYPE_MAP[t.id] === t, `ENEMY_TYPE_MAP: ${t.id} 매핑 정확`);
    });

    console.log('Unit tests passed');
}

if (require.main === module) {
    run();
}

module.exports = { run };
