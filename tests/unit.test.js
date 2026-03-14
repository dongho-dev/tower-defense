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
        towers
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
    const soldResult = sellTower(mockTower);
    assertEqual(soldResult, true, 'sellTower: 정상 판매 시 true 반환');
    assertEqual(towers.length, 0, 'sellTower: 판매 후 towers 배열에서 제거');

    // --- applyExplosion 범위 피해 ---
    enemies.length = 0;
    towers.length = 0;
    const mockStyle = { body: '#fff', core: '#fff', outline: '#000', halo: 'rgba(255,255,255,0.5)' };
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

    console.log('Unit tests passed');
}

if (require.main === module) {
    run();
}

module.exports = { run };
