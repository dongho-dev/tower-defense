const canvas = document.getElementById("game");
if (!canvas) {
    throw new Error('Canvas element #game not found');
}
const ctx = canvas.getContext("2d");
if (!ctx) {
    throw new Error('Failed to get 2D rendering context');
}

let staticLayer = null;

const TILE_SIZE = 30;
const GRID_COLS = Math.floor(canvas.width / TILE_SIZE);
const GRID_ROWS = Math.floor(canvas.height / TILE_SIZE);
const TILE_CENTER_OFFSET = TILE_SIZE / 2;
const TOWER_DRAW_BASE = 14;
const TOWER_PICK_RADIUS = 18;
const ENEMY_RADIUS = 14;
const ENEMY_BASE_HP = 78;
const ENEMY_HP_GROWTH_RATE = 1.18;
const ENEMY_SPEED = 49;
const ENEMY_BASE_REWARD = 14;
const TOWER_UPGRADE_BASE_COST = 40;
const TOWER_DAMAGE_GROWTH = 1.5;
const TOWER_UPGRADE_COST_MULTIPLIER = 1.6;
const TOWER_MAX_LEVEL = 15;
const WAVE_MAX = 9999;
const DEFAULT_TOWER_TYPE = "basic";

let prefersReducedMotion = false;
if (typeof window !== 'undefined' && window.matchMedia) {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    prefersReducedMotion = motionQuery.matches;
    motionQuery.addEventListener('change', (e) => {
        prefersReducedMotion = e.matches;
    });
}

const ENEMY_TYPE_DEFINITIONS = [
    { id: 'normal',  label: '일반', hpMult: 1.0,  speedMult: 1.0, rewardMult: 1.0, body: "#d65a57", core: "#ffe6c2", outline: "#321816", thruster: "#ff9a6d", halo: "rgba(214, 90, 87, 0.55)" },
    { id: 'armored', label: '장갑', hpMult: 3.0,  speedMult: 0.6, rewardMult: 2.0, body: "#5d7dff", core: "#d8e1ff", outline: "#19224f", thruster: "#8aa8ff", halo: "rgba(93, 125, 255, 0.55)" },
    { id: 'fast',    label: '고속', hpMult: 0.4,  speedMult: 2.5, rewardMult: 1.5, body: "#58d6a4", core: "#d4ffe7", outline: "#12392a", thruster: "#7ef2c9", halo: "rgba(88, 214, 164, 0.55)" },
    { id: 'boss',    label: '보스', hpMult: 12.0, speedMult: 0.7, rewardMult: 8.0, body: "#c95de9", core: "#f5d1ff", outline: "#3d1649", thruster: "#ff96f3", halo: "rgba(201, 93, 233, 0.55)" }
];

const ENEMY_TYPE_MAP = {};
ENEMY_TYPE_DEFINITIONS.forEach(t => { ENEMY_TYPE_MAP[t.id] = t; });

const TOWER_TYPES = {
    basic: {
        id: "basic",
        label: "기본",
        attackPattern: "projectile",
        cost: 35,
        baseDamage: 20,
        baseUpgradeCost: 40,
        range: 165,
        fireDelay: 0.6,
        projectileSpeed: 520,
        projectileLife: 0.85,
        projectileRadius: 6,
        trailLength: 60,
        shape: "turret",
        baseColor: "#1c2740",
        coreColor: "#dae8ff",
        barrelColor: "#9abaf9",
        glowColor: "#8ab7ff",
        auraColor: "rgba(138, 183, 255, 0.32)",
        muzzleFlashColor: "#fde7a2",
        muzzleLengthMultiplier: 1.7,
        flashSizeMultiplier: 0.95,
        recoilKick: 0.5,
        recoilRecovery: 3.1,
        turnSpeed: 7.2,
        outline: "#1f2f5a",
        levelColors: [
            "#bdd6ff",
            "#a2c0ff",
            "#8aa9ff",
            "#7294ff",
            "#5a7eff",
            "#4368ff",
            "#2e56f2"
        ],
        projectileColors: [
            "#f8faff",
            "#e5f0ff",
            "#cddfff",
            "#b3cdff",
            "#9abbff",
            "#81a7ff",
            "#6b95ff"
        ]
    },
    shotgun: {
        id: "shotgun",
        label: "샷건",
        attackPattern: "shotgun",
        cost: 55,
        baseDamage: 6,
        baseUpgradeCost: 45,
        range: 150,
        fireDelay: 0.9,
        pellets: 5,
        spread: Math.PI / 3.5,
        projectileSpeed: 540,
        projectileLife: 0.55,
        projectileRadius: 6,
        trailLength: 40,
        shape: "vulcan",
        baseColor: "#0c233d",
        coreColor: "#ffe3a3",
        barrelColor: "#f5a844",
        glowColor: "#ff985c",
        auraColor: "rgba(255, 152, 92, 0.32)",
        muzzleFlashColor: "#ffd17a",
        muzzleLengthMultiplier: 1.45,
        flashSizeMultiplier: 1.05,
        recoilKick: 0.62,
        recoilRecovery: 2.9,
        turnSpeed: 6.4,
        outline: "#0b2b4c",
        levelColors: [
            "#90caf9",
            "#74b9f6",
            "#4fa8f4",
            "#2d96f1",
            "#1f86e8",
            "#136fd6",
            "#0d5abf"
        ],
        projectileColors: [
            "#ffe082",
            "#ffd54f",
            "#ffca28",
            "#ffc107",
            "#ffb300",
            "#ffa000",
            "#ff8f00"
        ]
    },
    longrange: {
        id: "longrange",
        label: "저격",
        attackPattern: "beam",
        cost: 90,
        baseDamage: 35,
        baseUpgradeCost: 65,
        range: 260,
        fireDelay: 1.6,
        projectileSpeed: 820,
        projectileLife: 1.5,
        projectileRadius: 6,
        trailLength: 150,
        beamWidth: 6,
        shape: "rail",
        baseColor: "#1a1034",
        coreColor: "#cebaff",
        barrelColor: "#8d72ff",
        glowColor: "#a57eff",
        auraColor: "rgba(165, 126, 255, 0.28)",
        muzzleFlashColor: "#e4d6ff",
        muzzleLengthMultiplier: 2.2,
        flashSizeMultiplier: 0.8,
        recoilKick: 0.35,
        recoilRecovery: 3.4,
        turnSpeed: 8.6,
        outline: "#27144a",
        levelColors: [
            "#d0bbff",
            "#ba9dff",
            "#a279ff",
            "#8c5aff",
            "#7b43f0",
            "#6a31d3",
            "#5925b8"
        ],
        projectileColors: [
            "#f5ebff",
            "#e8d4ff",
            "#dcbcff",
            "#cea4ff",
            "#c08cff",
            "#b073ff",
            "#a05dff"
        ]
    },
    burst: {
        id: "burst",
        label: "점사",
        attackPattern: "burst",
        cost: 65,
        baseDamage: 14,
        baseUpgradeCost: 55,
        range: 175,
        fireDelay: 1.05,
        burstCount: 3,
        burstDelay: 0.08,
        projectileSpeed: 600,
        projectileLife: 0.85,
        projectileRadius: 7,
        trailLength: 70,
        shape: "prism",
        baseColor: "#341d0a",
        coreColor: "#ffbe73",
        barrelColor: "#ff8e3f",
        glowColor: "#ff9f52",
        auraColor: "rgba(255, 159, 82, 0.28)",
        muzzleFlashColor: "#ffd9a1",
        muzzleLengthMultiplier: 1.6,
        flashSizeMultiplier: 0.9,
        recoilKick: 0.48,
        recoilRecovery: 3,
        turnSpeed: 7.8,
        outline: "#4a2509",
        levelColors: [
            "#ffd180",
            "#ffb74d",
            "#ffa040",
            "#ff8f2c",
            "#ff7b12",
            "#f56705",
            "#e25900"
        ],
        projectileColors: [
            "#fff3cd",
            "#ffe7a3",
            "#ffd26e",
            "#ffbe42",
            "#ffaa23",
            "#ff9514",
            "#ff8609"
        ]
    },
    rapid: {
        id: "rapid",
        label: "연사",
        attackPattern: "projectile",
        cost: 45,
        baseDamage: 10,
        baseUpgradeCost: 45,
        range: 145,
        fireDelay: 0.22,
        projectileSpeed: 640,
        projectileLife: 0.65,
        projectileRadius: 5,
        trailLength: 75,
        shape: "gyro",
        baseColor: "#052b18",
        coreColor: "#8ce7b5",
        barrelColor: "#43d886",
        glowColor: "#66f3b6",
        auraColor: "rgba(82, 235, 164, 0.32)",
        muzzleFlashColor: "#bbffd9",
        muzzleLengthMultiplier: 1.55,
        flashSizeMultiplier: 0.85,
        recoilKick: 0.38,
        recoilRecovery: 3.6,
        turnSpeed: 9.2,
        outline: "#073519",
        levelColors: [
            "#b9f6ca",
            "#9bf1b3",
            "#78e99a",
            "#55dd80",
            "#3ccc6b",
            "#2daf58",
            "#1f9348"
        ],
        projectileColors: [
            "#d0ffdc",
            "#aefecc",
            "#88fcb5",
            "#5af79a",
            "#2fef7f",
            "#1ddc6d",
            "#10c05b"
        ]
    },
    explosive: {
        id: "explosive",
        label: "폭발",
        attackPattern: "explosive",
        cost: 80,
        baseDamage: 26,
        baseUpgradeCost: 70,
        range: 170,
        fireDelay: 1.25,
        projectileSpeed: 480,
        projectileLife: 1.1,
        projectileRadius: 8,
        explosionRadius: 85,
        explosionColor: "rgba(255, 182, 89, 0.45)",
        explosionHaloColor: "#ffe9c0",
        explosionStrokeColor: "rgba(255, 161, 86, 0.55)",
        explosionLife: 0.5,
        trailLength: 55,
        shape: "howitzer",
        baseColor: "#3e1b08",
        coreColor: "#ffbc76",
        barrelColor: "#ff8a45",
        glowColor: "#ffa25a",
        auraColor: "rgba(255, 162, 90, 0.32)",
        muzzleFlashColor: "#ffd27f",
        muzzleLengthMultiplier: 1.9,
        flashSizeMultiplier: 1.15,
        recoilKick: 0.68,
        recoilRecovery: 2.7,
        turnSpeed: 6.5,
        outline: "#56210a",
        levelColors: [
            "#ffcc80",
            "#ffb74d",
            "#ff9f43",
            "#ff8a36",
            "#ff7127",
            "#ff5918",
            "#ff4010"
        ],
        projectileColors: [
            "#fff0d1",
            "#ffe3b0",
            "#ffd291",
            "#ffc170",
            "#ffb158",
            "#ffa039",
            "#ff9024"
        ]
    },
    laser: {
        id: "laser",
        label: "레이저",
        attackPattern: "laser",
        cost: 95,
        baseDamage: 5.5,
        baseUpgradeCost: 80,
        range: 200,
        fireDelay: 0.1,
        beamColor: "rgba(123, 234, 255, 0.9)",
        beamGlowColor: "rgba(123, 234, 255, 0.45)",
        beamWidth: 8,
        sustainMultiplier: 1.15,
        shape: "sentinel",
        baseColor: "#0a2f3f",
        coreColor: "#92f2ff",
        barrelColor: "#42d8ff",
        glowColor: "#66e7ff",
        auraColor: "rgba(78, 228, 255, 0.32)",
        muzzleFlashColor: "#b6f6ff",
        muzzleLengthMultiplier: 1.85,
        flashSizeMultiplier: 0.8,
        recoilKick: 0.28,
        recoilRecovery: 3.8,
        turnSpeed: 9.5,
        outline: "#0b3c4f",
        levelColors: [
            "#b1f4ff",
            "#9be9ff",
            "#84deff",
            "#6dd2ff",
            "#55c6ff",
            "#3ab8ff",
            "#24a7f5"
        ],
        projectileColors: [
            "#e6fdff",
            "#d0f8ff",
            "#bbf3ff",
            "#a4ecff",
            "#90e5ff",
            "#79ddff",
            "#61d3ff"
        ]
    },
    mortar: {
        id: "mortar",
        label: "박격포",
        attackPattern: "mortar",
        cost: 115,
        baseDamage: 48,
        baseUpgradeCost: 90,
        range: 260,
        fireDelay: 2.8,
        projectileSpeed: 360,
        projectileLife: 2.3,
        projectileRadius: 9,
        explosionRadius: 120,
        explosionColor: "rgba(255, 220, 120, 0.35)",
        explosionHaloColor: "#ffe6bd",
        explosionStrokeColor: "rgba(255, 176, 84, 0.5)",
        explosionLife: 0.6,
        trailLength: 45,
        gravity: 720,
        mortarLift: 420,
        detonateOnExpire: true,
        shape: "artillery",
        baseColor: "#36250f",
        coreColor: "#f4d29a",
        barrelColor: "#e88f32",
        glowColor: "#ffc874",
        auraColor: "rgba(255, 200, 116, 0.32)",
        muzzleFlashColor: "#ffe1a8",
        muzzleLengthMultiplier: 1.75,
        flashSizeMultiplier: 1.2,
        recoilKick: 0.72,
        recoilRecovery: 2.5,
        turnSpeed: 6.1,
        outline: "#3a2b15",
        levelColors: [
            "#fbe0b2",
            "#f7cb86",
            "#f4b25a",
            "#f19b38",
            "#ed8320",
            "#e26e17",
            "#d35d12"
        ],
        projectileColors: [
            "#fff2d8",
            "#ffe4b3",
            "#ffd28d",
            "#ffc167",
            "#ffad3c",
            "#ff9a24",
            "#ff8610"
        ]
    }
};


const TOWER_ORDER = [
    'basic',
    'shotgun',
    'longrange',
    'burst',
    'rapid',
    'explosive',
    'laser',
    'mortar'
];

const MAP_DEFINITIONS = {
    map1: {
        id: 'map1', name: '기본 맵', difficulty: '보통',
        rawWaypoints: [
            { x: -2, y: 8 }, { x: 2, y: 8 }, { x: 2, y: 4 },
            { x: 10, y: 4 }, { x: 10, y: 12 }, { x: 18, y: 12 },
            { x: 18, y: 6 }, { x: 26, y: 6 }, { x: 26, y: 14 },
            { x: GRID_COLS + 1, y: 14 }
        ]
    },
    map2: {
        id: 'map2', name: 'S자 맵', difficulty: '어려움',
        rawWaypoints: [
            { x: -2, y: 3 }, { x: 8, y: 3 }, { x: 8, y: 17 },
            { x: 16, y: 17 }, { x: 16, y: 3 }, { x: 24, y: 3 },
            { x: 24, y: 17 }, { x: GRID_COLS + 1, y: 17 }
        ]
    },
    map3: {
        id: 'map3', name: '나선 맵', difficulty: '쉬움',
        rawWaypoints: [
            { x: -2, y: 10 }, { x: 4, y: 10 }, { x: 4, y: 2 },
            { x: 26, y: 2 }, { x: 26, y: 18 }, { x: 4, y: 18 },
            { x: 4, y: 12 }, { x: 20, y: 12 }, { x: 20, y: 6 },
            { x: GRID_COLS + 1, y: 6 }
        ]
    }
};

let activeMapId = 'map1';
let waypoints = [];
let pathTiles = new Set();

function buildMapData(mapId) {
    const mapDef = MAP_DEFINITIONS[mapId] || MAP_DEFINITIONS['map1'];
    waypoints = mapDef.rawWaypoints.map(point => ({
        x: point.x * TILE_SIZE + TILE_CENTER_OFFSET,
        y: point.y * TILE_SIZE + TILE_CENTER_OFFSET
    }));
    pathTiles = new Set();
    for (let i = 0; i < waypoints.length - 1; i++) {
        const a = gridFromPosition(waypoints[i]);
        const b = gridFromPosition(waypoints[i + 1]);
        if (a.x === b.x) {
            const step = Math.sign(b.y - a.y) || 1;
            for (let y = a.y; y !== b.y + step; y += step) {
                pathTiles.add(`${a.x},${y}`);
            }
        } else if (a.y === b.y) {
            const step = Math.sign(b.x - a.x) || 1;
            for (let x = a.x; x !== b.x + step; x += step) {
                pathTiles.add(`${x},${a.y}`);
            }
        }
    }
    staticLayer = null;
}

buildMapData(activeMapId);

const towers = [];
const towerPositionSet = new Set();
const enemies = [];
const projectiles = [];
const impactEffects = [];
const muzzleFlashes = [];

let gold = 100;
let lives = 20;
let wave = 1;
let waveInProgress = false;
let enemiesToSpawn = 0;
let spawnCooldown = 0;
let nextWaveTimer = 0;
let paused = false;
let hoverTile = null;
let kbCursor = null;
let kbCursorActive = false;
let _longPressTimer = null;
let _longPressFired = false;
let _touchStartX = 0;
let _touchStartY = 0;
const LONG_PRESS_DURATION = 500;
const LONG_PRESS_MOVE_THRESHOLD = 10;
let selectedTower = null;
let selectedEnemy = null;
let gameSpeed = 1;
let gameOver = false;
let gameLoopHalted = false;
let buildFailFlash = null;
let selectedTowerType = DEFAULT_TOWER_TYPE;

const NUMBER_FORMAT = new Intl.NumberFormat('ko-KR');

const GOLD_LABEL = document.getElementById("gold");
const LIVES_LABEL = document.getElementById("lives");
const WAVE_LABEL = document.getElementById("wave");
const GOLD_INPUT = document.getElementById("gold-input");
const GOLD_APPLY_BUTTON = document.getElementById("gold-apply");
const GOLD_ADJUST_BUTTONS = Array.from(document.querySelectorAll('.gold-adjust'));


const TOWER_STATS_PANEL = document.getElementById("tower-stats");
const ENEMY_STATS_PANEL = document.getElementById("enemy-stats");
const TOWER_STATS_FIELDS = {
    type: TOWER_STATS_PANEL ? TOWER_STATS_PANEL.querySelector('[data-field="tower-type"]') : null,
    position: TOWER_STATS_PANEL ? TOWER_STATS_PANEL.querySelector('[data-field="tower-position"]') : null,
    range: TOWER_STATS_PANEL ? TOWER_STATS_PANEL.querySelector('[data-field="tower-range"]') : null,
    fireDelay: TOWER_STATS_PANEL ? TOWER_STATS_PANEL.querySelector('[data-field="tower-fire-delay"]') : null,
    damage: TOWER_STATS_PANEL ? TOWER_STATS_PANEL.querySelector('[data-field="tower-damage"]') : null,
    level: TOWER_STATS_PANEL ? TOWER_STATS_PANEL.querySelector('[data-field="tower-level"]') : null,
    upgradeCost: TOWER_STATS_PANEL ? TOWER_STATS_PANEL.querySelector('[data-field="tower-upgrade-cost"]') : null,
    sellRefund: TOWER_STATS_PANEL ? TOWER_STATS_PANEL.querySelector('[data-field="tower-sell-refund"]') : null
};
const ENEMY_STATS_FIELDS = {
    wave: ENEMY_STATS_PANEL ? ENEMY_STATS_PANEL.querySelector('[data-field="enemy-wave"]') : null,
    hp: ENEMY_STATS_PANEL ? ENEMY_STATS_PANEL.querySelector('[data-field="enemy-hp"]') : null,
    speed: ENEMY_STATS_PANEL ? ENEMY_STATS_PANEL.querySelector('[data-field="enemy-speed"]') : null,
    reward: ENEMY_STATS_PANEL ? ENEMY_STATS_PANEL.querySelector('[data-field="enemy-reward"]') : null
};

const SPEED_BUTTONS = Array.from(document.querySelectorAll('.speed-button'));
const WAVE_INPUT = document.getElementById('wave-input');
const WAVE_APPLY_BUTTON = document.getElementById('wave-apply');
const WAVE_PREVIEW_PANEL = document.getElementById('wave-preview');
const WAVE_PREVIEW_FIELDS = WAVE_PREVIEW_PANEL ? {
    status: WAVE_PREVIEW_PANEL.querySelector('[data-field="preview-status"]'),
    wave: WAVE_PREVIEW_PANEL.querySelector('[data-field="preview-wave"]'),
    remaining: WAVE_PREVIEW_PANEL.querySelector('[data-field="preview-remaining"]'),
    hp: WAVE_PREVIEW_PANEL.querySelector('[data-field="preview-hp"]'),
    speed: WAVE_PREVIEW_PANEL.querySelector('[data-field="preview-speed"]'),
    reward: WAVE_PREVIEW_PANEL.querySelector('[data-field="preview-reward"]')
} : null;

const DEFEAT_OVERLAY = document.getElementById('defeat-overlay');
const RETRY_BUTTON = document.getElementById('retry-button');
const CANCEL_RETRY_BUTTON = document.getElementById('cancel-retry-button');
const MAP_SELECT_OVERLAY = document.getElementById('map-select-overlay');
const MAP_LIST_CONTAINER = document.getElementById('map-list');
const START_GAME_BUTTON = document.getElementById('start-game-button');
const BUILD_PANEL = document.getElementById('build-panel');
const BUILD_TOGGLE = document.getElementById('build-toggle');
const BUILD_CONTAINER = document.querySelector('.build-shell');
const TOWER_LIST_CONTAINER = document.getElementById('tower-list');
const SOUND_TOGGLE = document.getElementById('sound-toggle');
const A11Y_ANNOUNCER = document.getElementById('a11y-announcer');
const SELECTED_TOWER_INDICATOR = document.getElementById('selected-tower-indicator');

function announce(message) {
    if (!A11Y_ANNOUNCER) return;
    A11Y_ANNOUNCER.textContent = '';
    // Force DOM update so repeated identical messages also fire
    requestAnimationFrame(() => {
        A11Y_ANNOUNCER.textContent = message;
    });
}

let audioContext = null;
let masterGain = null;
let soundMuted = false;

function ensureAudioContext() {
    if (audioContext) {
        if (audioContext.state === 'closed') {
            audioContext = null;
            masterGain = null;
            cachedNoiseBuffer = null;
            cachedNoiseDuration = 0;
            // fall through to create new context
        } else {
            if (audioContext.state === 'suspended') {
                audioContext.resume().catch(() => {});
            }
            return audioContext;
        }
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
        console.warn('Web Audio API is not supported in this browser.');
        soundMuted = true;
        if (SOUND_TOGGLE) {
            SOUND_TOGGLE.disabled = true;
            SOUND_TOGGLE.textContent = "🔇";
            SOUND_TOGGLE.title = "사운드를 사용할 수 없습니다";
        }
        return null;
    }
    try {
        audioContext = new AudioCtx();
        masterGain = audioContext.createGain();
        masterGain.gain.value = 0.8;
        masterGain.connect(audioContext.destination);
        return audioContext;
    } catch (e) {
        console.warn('AudioContext 생성 실패:', e.message);
        audioContext = null;
        masterGain = null;
        return null;
    }
}

function playToneSequence(steps) {
    if (soundMuted) {
        return;
    }
    const ctx = ensureAudioContext();
    if (!ctx || !masterGain) {
        return;
    }
    let current = ctx.currentTime;
    for (const step of steps) {
        const duration = typeof step.duration === 'number' ? step.duration : 0.15;
        const delay = typeof step.delay === 'number' ? step.delay : 0;
        current += delay;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const freq = typeof step.freq === 'number' ? step.freq : 440;
        const volume = typeof step.volume === 'number' ? step.volume : 0.22;
        const type = step.type || 'sine';
        osc.type = type;
        osc.frequency.setValueAtTime(freq, current);
        gain.gain.setValueAtTime(0.0001, current);
        gain.gain.exponentialRampToValueAtTime(volume, current + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, current + duration);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(current);
        osc.stop(current + duration + 0.06);
        current += duration;
    }
}

let cachedNoiseBuffer = null;
let cachedNoiseDuration = 0;

function playNoise(duration = 0.25, volume = 0.24) {
    if (soundMuted) return;
    const ctx = ensureAudioContext();
    if (!ctx || !masterGain) return;

    const size = Math.max(1, Math.floor(ctx.sampleRate * duration));
    if (!cachedNoiseBuffer || cachedNoiseDuration !== duration) {
        cachedNoiseBuffer = ctx.createBuffer(1, size, ctx.sampleRate);
        const data = cachedNoiseBuffer.getChannelData(0);
        for (let i = 0; i < size; i++) {
            data[i] = (Math.random() * 2 - 1) * 0.7;
        }
        cachedNoiseDuration = duration;
    }

    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.buffer = cachedNoiseBuffer;
    source.connect(gain);
    gain.connect(masterGain);
    source.start(now);
    source.stop(now + duration + 0.06);
}

const SOUND_LIBRARY = {
    select: () => playToneSequence([{ freq: 540, duration: 0.08, volume: 0.18 }]),
    build: () => playToneSequence([
        { freq: 360, duration: 0.08, volume: 0.22 },
        { freq: 520, duration: 0.09, volume: 0.24, delay: 0.01 }
    ]),
    upgrade: () => playToneSequence([
        { freq: 520, duration: 0.09, volume: 0.24 },
        { freq: 680, duration: 0.12, volume: 0.22, type: 'triangle', delay: 0.02 }
    ]),
    kill: () => playToneSequence([
        { freq: 420, duration: 0.08, volume: 0.18, type: 'square' },
        { freq: 260, duration: 0.12, volume: 0.16, delay: 0.02 }
    ]),
    explosion: () => {
        playNoise(0.22, 0.32);
        playToneSequence([{ freq: 180, duration: 0.12, volume: 0.2, type: 'sawtooth' }]);
    },
    laser: () => playToneSequence([{ freq: 760, duration: 0.06, volume: 0.18 }]),
    toggle: () => playToneSequence([{ freq: 420, duration: 0.07, volume: 0.18 }])
};

function updateSoundToggle() {
    if (!SOUND_TOGGLE) {
        return;
    }
    SOUND_TOGGLE.textContent = soundMuted ? '🔇' : '🔊';
    SOUND_TOGGLE.setAttribute('aria-pressed', String(!soundMuted));
    const soundLabel = soundMuted ? '사운드 켜기' : '사운드 끄기';
    SOUND_TOGGLE.title = soundLabel;
    SOUND_TOGGLE.setAttribute('aria-label', soundLabel);
}

function setSoundMuted(state) {
    soundMuted = state;
    if (audioContext && masterGain) {
        const now = audioContext.currentTime;
        const target = soundMuted ? 0.0001 : 0.8;
        masterGain.gain.cancelScheduledValues(now);
        masterGain.gain.setTargetAtTime(target, now + 0.01, 0.05);
    }
    updateSoundToggle();
}

function playSound(name) {
    if (soundMuted) {
        return;
    }
    const player = SOUND_LIBRARY[name];
    if (!player) {
        return;
    }
    if (!ensureAudioContext() || !masterGain) {
        return;
    }
    try {
        player();
    } catch (error) {
        console.warn('사운드 재생 실패:', error.message);
    }
}

updateSoundToggle();

let TOWER_SELECTOR_BUTTONS = [];

function gridFromPosition(point) {
    return {
        x: Math.floor(point.x / TILE_SIZE),
        y: Math.floor(point.y / TILE_SIZE)
    };
}

function keyFromGrid(x, y) {
    return `${x},${y}`;
}

function getTowerDefinition(id) {
    return TOWER_TYPES[id] || TOWER_TYPES[DEFAULT_TOWER_TYPE];
}

function darkenHex(hex, factor) {
    const r = Math.round(parseInt(hex.slice(1, 3), 16) * factor);
    const g = Math.round(parseInt(hex.slice(3, 5), 16) * factor);
    const b = Math.round(parseInt(hex.slice(5, 7), 16) * factor);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function getColorFromArray(colors, level, fallback) {
    if (!colors || colors.length === 0) return fallback;
    const idx = Math.max(0, level - 1);
    if (idx < colors.length) return colors[idx];
    const last = colors[colors.length - 1];
    const steps = idx - colors.length + 1;
    return darkenHex(last, Math.max(0.25, 1 - steps * 0.08));
}

function getTowerColor(definition, level) {
    return getColorFromArray(definition.levelColors, level, "#6296ff");
}

function getProjectileColor(definition, level) {
    return getColorFromArray(definition.projectileColors, level, "#ffd966");
}

function hexToRgba(hex, alpha) {
    if (!hex) {
        return `rgba(255, 255, 255, ${alpha})`;
    }
    const sanitized = hex.replace('#', '');
    let normalized;
    if (sanitized.length === 3) {
        normalized = sanitized.split('').map(ch => ch + ch).join('');
    } else if (sanitized.length > 6) {
        normalized = sanitized.substring(0, 6);
    } else {
        normalized = sanitized.padEnd(6, '0');
    }
    const value = parseInt(normalized, 16);
    const r = (value >> 16) & 255;
    const g = (value >> 8) & 255;
    const b = value & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const alphaCache = new Map();
const ALPHA_CACHE_MAX = 512;

function applyAlpha(color, alpha) {
    if (!color) return 'rgba(255, 255, 255, ' + alpha + ')';
    const key = color + '|' + alpha;
    let cached = alphaCache.get(key);
    if (cached !== undefined) return cached;

    let result;
    if (color.startsWith('#')) {
        result = hexToRgba(color, alpha);
    } else if (color.startsWith('rgba')) {
        result = color.replace(/rgba\(([^)]+)\)/, (_, inner) => {
            const parts = inner.split(',').map(part => part.trim());
            if (parts.length < 3) return color;
            return 'rgba(' + parts[0] + ', ' + parts[1] + ', ' + parts[2] + ', ' + alpha + ')';
        });
    } else if (color.startsWith('rgb')) {
        result = color.replace(/rgb\(([^)]+)\)/, (_, inner) => 'rgba(' + inner + ', ' + alpha + ')');
    } else {
        result = color;
    }

    if (alphaCache.size >= ALPHA_CACHE_MAX) {
        const keys = Array.from(alphaCache.keys()).slice(0, ALPHA_CACHE_MAX >> 1);
        for (let i = 0; i < keys.length; i++) alphaCache.delete(keys[i]);
    }
    alphaCache.set(key, result);
    return result;
}

function lerpAngle(current, target, t) {
    const twoPi = Math.PI * 2;
    let delta = (target - current) % twoPi;
    if (delta > Math.PI) {
        delta -= twoPi;
    } else if (delta < -Math.PI) {
        delta += twoPi;
    }
    return current + delta * t;
}

function formatNumber(value) {
    if (!Number.isFinite(value)) {
        return "-";
    }
    if (Math.abs(value) < 1000) {
        return Number.isInteger(value) ? `${value}` : value.toFixed(2);
    }
    return NUMBER_FORMAT.format(Math.round(value));
}

function calculateTowerDamage(definition, level) {
    const raw = definition.baseDamage * Math.pow(TOWER_DAMAGE_GROWTH, level - 1);
    return Math.round(raw * 10000) / 10000;
}

function calculateUpgradeCost(definition, level) {
    const base = definition.baseUpgradeCost ?? TOWER_UPGRADE_BASE_COST;
    return Math.round(base * Math.pow(TOWER_UPGRADE_COST_MULTIPLIER, level - 1));
}

function recalcTowerStats(tower) {
    const def = getTowerDefinition(tower.type);
    tower.range = def.range;
    tower.fireDelay = def.fireDelay;
    tower.damage = calculateTowerDamage(def, tower.level);
    tower.upgradeCost = tower.level >= TOWER_MAX_LEVEL ? null : calculateUpgradeCost(def, tower.level);
}

function updateGoldUI() {
    if (GOLD_LABEL) {
        GOLD_LABEL.textContent = gold;
    }
    if (GOLD_INPUT) {
        GOLD_INPUT.value = gold;
    }
}

function hideTowerStats() {
    if (!TOWER_STATS_PANEL) {
        return;
    }
    selectedTower = null;
    TOWER_STATS_PANEL.classList.add("hidden");
}

function hideEnemyStats() {
    if (!ENEMY_STATS_PANEL) {
        return;
    }
    selectedEnemy = null;
    ENEMY_STATS_PANEL.classList.add("hidden");
}

function hideAllStats() {
    hideTowerStats();
    hideEnemyStats();
}

function setSelectedTowerButton(typeId) {
    if (!TOWER_SELECTOR_BUTTONS || TOWER_SELECTOR_BUTTONS.length === 0) {
        return;
    }
    for (const button of TOWER_SELECTOR_BUTTONS) {
        const isSelected = button.dataset.tower === typeId;
        button.classList.toggle('selected', isSelected);
        button.classList.toggle('active', isSelected);
        button.setAttribute('aria-checked', String(isSelected));
        button.setAttribute('tabindex', isSelected ? '0' : '-1');
    }
    if (SELECTED_TOWER_INDICATOR) {
        const def = getTowerDefinition(typeId);
        SELECTED_TOWER_INDICATOR.textContent = def ? def.label : '';
    }
}

function populateTowerList() {
    if (!TOWER_LIST_CONTAINER) {
        return;
    }
    TOWER_LIST_CONTAINER.innerHTML = '';
    const order = Array.isArray(TOWER_ORDER) ? TOWER_ORDER : Object.keys(TOWER_TYPES);
    TOWER_SELECTOR_BUTTONS = [];
    for (const id of order) {
        const def = getTowerDefinition(id);
        if (!def) {
            continue;
        }
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'tower-card';
        button.dataset.tower = id;
        button.setAttribute('role', 'radio');
        button.setAttribute('aria-checked', 'false');
        button.setAttribute('tabindex', TOWER_SELECTOR_BUTTONS.length === 0 ? '0' : '-1');
        const cost = typeof def.cost === 'number' ? def.cost : 0;
        const range = typeof def.range === 'number' ? def.range : 0;
        const baseDamage = typeof def.baseDamage === 'number' ? def.baseDamage : 0;
        const fireDelay = typeof def.fireDelay === 'number' && def.fireDelay > 0 ? def.fireDelay : 1;
        const dps = def.attackPattern === 'laser'
            ? baseDamage * (def.sustainMultiplier || 1)
            : baseDamage / fireDelay;
        const nameSpan = document.createElement('span');
        nameSpan.className = 'tower-name';
        nameSpan.textContent = def.label;

        const metaSpan = document.createElement('span');
        metaSpan.className = 'tower-meta';

        const costSpan = document.createElement('span');
        costSpan.textContent = '비용 ' + formatNumber(cost);
        const rangeSpan = document.createElement('span');
        rangeSpan.textContent = '사거리 ' + Math.round(range) + 'px';
        const dpsSpan = document.createElement('span');
        dpsSpan.textContent = 'DPS ' + formatNumber(Number(dps.toFixed(1)));

        metaSpan.append(costSpan, rangeSpan, dpsSpan);
        button.append(nameSpan, metaSpan);
        button.addEventListener('click', () => {
            if (selectedTowerType === id) {
                return;
            }
            selectedTowerType = id;
            setSelectedTowerButton(id);
            playSound('select');
        });
        TOWER_LIST_CONTAINER.appendChild(button);
        TOWER_SELECTOR_BUTTONS.push(button);
    }
    setSelectedTowerButton(selectedTowerType);
}

if (TOWER_LIST_CONTAINER) {
    TOWER_LIST_CONTAINER.addEventListener('keydown', (event) => {
        if (!TOWER_SELECTOR_BUTTONS || TOWER_SELECTOR_BUTTONS.length === 0) return;
        const currentIndex = TOWER_SELECTOR_BUTTONS.indexOf(document.activeElement);
        if (currentIndex === -1) return;

        let nextIndex = -1;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
            event.preventDefault();
            nextIndex = (currentIndex + 1) % TOWER_SELECTOR_BUTTONS.length;
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
            event.preventDefault();
            nextIndex = (currentIndex - 1 + TOWER_SELECTOR_BUTTONS.length) % TOWER_SELECTOR_BUTTONS.length;
        } else if (event.key === 'Home') {
            event.preventDefault();
            nextIndex = 0;
        } else if (event.key === 'End') {
            event.preventDefault();
            nextIndex = TOWER_SELECTOR_BUTTONS.length - 1;
        }

        if (nextIndex !== -1) {
            TOWER_SELECTOR_BUTTONS[currentIndex].setAttribute('tabindex', '-1');
            TOWER_SELECTOR_BUTTONS[nextIndex].setAttribute('tabindex', '0');
            TOWER_SELECTOR_BUTTONS[nextIndex].focus();
        }
    });
}

let buildPanelCollapsed = false;
let buildPanelUserOverride = false;

function setBuildPanelCollapsed(state, options = {}) {
    if (!BUILD_CONTAINER) {
        return;
    }
    buildPanelCollapsed = state;
    if (options.user) {
        buildPanelUserOverride = true;
    }
    BUILD_CONTAINER.classList.toggle('collapsed', state);
    if (BUILD_PANEL) {
        if (state) {
            BUILD_PANEL.setAttribute('inert', '');
        } else {
            BUILD_PANEL.removeAttribute('inert');
        }
    }
    if (BUILD_TOGGLE) {
        BUILD_TOGGLE.setAttribute('aria-expanded', String(!state));
        const arrow = BUILD_TOGGLE.querySelector('.toggle-arrow');
        if (arrow) arrow.textContent = state ? '▶' : '◀';
        const buildToggleLabel = state ? '포탑 패널 펼치기' : '포탑 패널 접기';
        BUILD_TOGGLE.setAttribute('title', buildToggleLabel);
        BUILD_TOGGLE.setAttribute('aria-label', buildToggleLabel);
    }
}

function getWaveEnemyCount(waveNumber) {
    return 8 + Math.floor(waveNumber * 1.5);
}

function getWaveEnemyStats(waveNumber, enemyType = ENEMY_TYPE_DEFINITIONS[0]) {
    const growth = Math.pow(ENEMY_HP_GROWTH_RATE, Math.max(0, waveNumber - 1));
    const hp = Math.round(Math.min(ENEMY_BASE_HP * growth * enemyType.hpMult, Number.MAX_SAFE_INTEGER));
    const speedBonus = 1 + Math.min(waveNumber * 0.005, 0.5);
    const speed = Math.round(ENEMY_SPEED * enemyType.speedMult * speedBonus);
    const reward = Math.round((ENEMY_BASE_REWARD + waveNumber * 1.5) * enemyType.rewardMult);
    const count = getWaveEnemyCount(waveNumber);
    return { hp, speed, reward, count };
}

function updateWavePreview(remainingOverride) {
    if (!WAVE_PREVIEW_FIELDS) {
        return;
    }
    const stats = getWaveEnemyStats(wave);
    const remaining = typeof remainingOverride === 'number' ? Math.max(0, Math.ceil(remainingOverride)) : stats.count;
    let status;
    if (gameOver) {
        status = '패배';
    } else if (waveInProgress) {
        status = '전투 중';
    } else if (nextWaveTimer > 0) {
        status = '휴식';
    } else {
        status = '대기';
    }
    WAVE_PREVIEW_FIELDS.status.textContent = status;
    WAVE_PREVIEW_FIELDS.wave.textContent = wave;
    WAVE_PREVIEW_FIELDS.remaining.textContent = remaining;
    WAVE_PREVIEW_FIELDS.hp.textContent = stats.hp;
    WAVE_PREVIEW_FIELDS.speed.textContent = `${(stats.speed / TILE_SIZE).toFixed(2)} 타일/초`;
    WAVE_PREVIEW_FIELDS.reward.textContent = stats.reward;
}

function updateSpeedControls() {
    if (SPEED_BUTTONS.length === 0) {
        return;
    }
    for (const button of SPEED_BUTTONS) {
        const value = Number(button.dataset.speed) || 1;
        const isActive = value === gameSpeed;
        button.classList.toggle('active', isActive);
        button.setAttribute('aria-pressed', String(isActive));
    }
}

function setGameSpeed(multiplier) {
    if (!Number.isFinite(multiplier) || multiplier <= 0) {
        multiplier = 1;
    }
    multiplier = Math.min(multiplier, 5);
    gameSpeed = multiplier;
    updateSpeedControls();
}

function clearCurrentWave() {
    enemies.length = 0;
    projectiles.length = 0;
    impactEffects.length = 0;
    muzzleFlashes.length = 0;
    enemiesToSpawn = 0;
    spawnCooldown = 0;
    waveInProgress = false;
    nextWaveTimer = 0;
    hideEnemyStats();
}

function ensureTowerMetadata(tower) {
    if (!tower.type) {
        tower.type = DEFAULT_TOWER_TYPE;
    }
    if (typeof tower.level !== 'number' || tower.level < 1) {
        tower.level = 1;
    }
    recalcTowerStats(tower);
    if (typeof tower.cooldown !== 'number') {
        tower.cooldown = 0;
    }
    if (!tower.activeBeam) {
        tower.activeBeam = null;
    }
}

function setWave(targetWave) {
    if (gameOver) {
        if (WAVE_INPUT) {
            WAVE_INPUT.value = wave;
        }
        return;
    }
    const desiredWave = Math.max(1, Math.min(WAVE_MAX, Math.floor(targetWave)));
    clearCurrentWave();
    hideTowerStats();
    wave = desiredWave;
    if (WAVE_LABEL) WAVE_LABEL.textContent = wave;
    if (WAVE_INPUT) {
        WAVE_INPUT.value = wave;
    }
    updateWavePreview();
}

function setTextIfChanged(el, text) {
    if (el && el.textContent !== text) el.textContent = text;
}

function updateTowerStatsFields() {
    if (!selectedTower || !TOWER_STATS_PANEL) {
        return;
    }
    ensureTowerMetadata(selectedTower);
    const def = getTowerDefinition(selectedTower.type);
    setTextIfChanged(TOWER_STATS_FIELDS.type, def.label);
    setTextIfChanged(TOWER_STATS_FIELDS.position, `${selectedTower.x}, ${selectedTower.y}`);
    if (TOWER_STATS_FIELDS.range) {
        const tiles = (selectedTower.range / TILE_SIZE).toFixed(1);
        setTextIfChanged(TOWER_STATS_FIELDS.range, `${Math.round(selectedTower.range)}px (${tiles}타일)`);
    }
    if (TOWER_STATS_FIELDS.fireDelay) {
        const text = def.attackPattern === 'laser'
            ? `지속 (${(selectedTower.damage * (def.sustainMultiplier || 1)).toFixed(1)} DPS)`
            : `${selectedTower.fireDelay.toFixed(2)}초`;
        setTextIfChanged(TOWER_STATS_FIELDS.fireDelay, text);
    }
    setTextIfChanged(TOWER_STATS_FIELDS.damage, formatNumber(selectedTower.damage));
    setTextIfChanged(TOWER_STATS_FIELDS.level, '' + selectedTower.level);
    if (TOWER_STATS_FIELDS.upgradeCost) {
        const cost = selectedTower.upgradeCost;
        setTextIfChanged(TOWER_STATS_FIELDS.upgradeCost, cost == null ? 'MAX' : formatNumber(cost));
    }
    if (UPGRADE_TOWER_BUTTON) {
        const atMax = selectedTower.upgradeCost == null;
        UPGRADE_TOWER_BUTTON.disabled = atMax || gameOver;
        const label = atMax ? '최대 레벨' : `업그레이드 (${formatNumber(selectedTower.upgradeCost)}G)`;
        setTextIfChanged(UPGRADE_TOWER_BUTTON, label);
        UPGRADE_TOWER_BUTTON.setAttribute('aria-label', label);
    }
    if (TOWER_STATS_FIELDS.sellRefund) {
        const refund = Math.floor((selectedTower.spentGold || 0) * 0.5);
        setTextIfChanged(TOWER_STATS_FIELDS.sellRefund, formatNumber(refund));
    }
    if (SELL_TOWER_BUTTON) {
        const refund = Math.floor((selectedTower.spentGold || 0) * 0.5);
        SELL_TOWER_BUTTON.setAttribute('aria-label', `판매 (${refund}G 환급)`);
    }
}

function updateEnemyStatsFields() {
    if (!selectedEnemy || !ENEMY_STATS_PANEL) {
        return;
    }
    if (!enemies.includes(selectedEnemy)) {
        hideEnemyStats();
        return;
    }
    const currentHp = Math.max(0, Math.ceil(selectedEnemy.hp));
    const maxHp = Math.max(0, Math.ceil(selectedEnemy.maxHp));
    const waveIndex = typeof selectedEnemy.waveIndex === "number" ? selectedEnemy.waveIndex : wave;
    setTextIfChanged(ENEMY_STATS_FIELDS.wave, '' + waveIndex);
    setTextIfChanged(ENEMY_STATS_FIELDS.hp, `${NUMBER_FORMAT.format(currentHp)} / ${NUMBER_FORMAT.format(maxHp)}`);
    setTextIfChanged(ENEMY_STATS_FIELDS.speed, `${(selectedEnemy.speed / TILE_SIZE).toFixed(2)} 타일/초`);
    setTextIfChanged(ENEMY_STATS_FIELDS.reward, `${selectedEnemy.reward}`);
}

function damageEnemyAtIndex(index, amount) {
    const enemy = enemies[index];
    if (!enemy) {
        return false;
    }
    enemy.hp -= amount;
    if (enemy.hp <= 0) {
        const style = enemy.enemyType || ENEMY_TYPE_DEFINITIONS[0];
        spawnImpactEffect(enemy.x, enemy.y, ENEMY_RADIUS * 1.9, style.core || 'rgba(255, 220, 190, 0.7)', {
            haloColor: style.halo || style.body,
            stroke: style.outline || 'rgba(20, 16, 26, 0.7)',
            lineWidth: ENEMY_RADIUS * 0.5,
            life: 0.5,
            pulse: true
        });
        if (selectedEnemy === enemy) {
            hideEnemyStats();
        }
        enemies.splice(index, 1);
        gold = Math.min(999999, gold + enemy.reward);
        updateGoldUI();
        playSound('kill');
        return true;
    }
    return false;
}


function damageEnemy(enemy, amount) {
    const idx = enemies.indexOf(enemy);
    if (idx === -1) {
        return false;
    }
    return damageEnemyAtIndex(idx, amount);
}

function spawnMuzzleFlash(x, y, radius, color, angle, options = {}) {
    const life = options.life ?? 0.18;
    muzzleFlashes.push({
        x,
        y,
        radius,
        startRadius: radius,
        color,
        angle,
        life,
        initialLife: life,
        growth: options.growth ?? radius * 8
    });
}

function spawnImpactEffect(x, y, radius, color, options = {}) {
    const life = options.life ?? 0.35;
    impactEffects.push({
        x,
        y,
        radius,
        color,
        halo: options.haloColor || color,
        stroke: options.stroke || null,
        lineWidth: options.lineWidth || null,
        pulse: Boolean(options.pulse),
        life,
        initialLife: life
    });
}


function applyExplosion(projectile, originX, originY) {
    const radius = projectile.explosionRadius || 0;
    if (radius <= 0) {
        return;
    }
    const radiusSq = radius * radius;
    for (let k = enemies.length - 1; k >= 0; k--) {
        const foe = enemies[k];
        const dx = foe.x - originX;
        const dy = foe.y - originY;
        if (dx * dx + dy * dy <= radiusSq) {
            damageEnemyAtIndex(k, projectile.damage);
        }
    }
    const effectColor = projectile.explosionColor || 'rgba(255, 210, 120, 0.4)';
    spawnImpactEffect(originX, originY, radius, effectColor, {
        haloColor: projectile.explosionHaloColor || '#ffeac8',
        stroke: projectile.explosionStrokeColor || null,
        lineWidth: projectile.explosionStrokeColor ? radius * 0.18 : undefined,
        life: projectile.explosionLife || 0.45,
        pulse: true
    });
    playSound('explosion');
}

function showTowerStats(tower) {
    if (!tower || !TOWER_STATS_PANEL) {
        return;
    }
    ensureTowerMetadata(tower);
    selectedTower = tower;
    TOWER_STATS_PANEL.classList.remove("hidden");
    updateTowerStatsFields();
    const def = getTowerDefinition(tower.type);
    announce(def.label + ' 포탑 정보');
}

function showEnemyStats(enemy) {
    if (!enemy || !ENEMY_STATS_PANEL) {
        return;
    }
    selectedEnemy = enemy;
    ENEMY_STATS_PANEL.classList.remove("hidden");
    updateEnemyStatsFields();
    const typeName = (enemy.enemyType || ENEMY_TYPE_DEFINITIONS[0]).label;
    announce(typeName + ' 적 정보');
}

function getAdjustedPickRadius(baseRadius) {
    if (!canvas) return baseRadius;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0) return baseRadius;
    const scale = rect.width / canvas.width;
    if (scale >= 1) return baseRadius;
    const minRadiusInCanvas = 22 / scale;
    return Math.max(baseRadius, minRadiusInCanvas);
}

function getTowerAtPoint(px, py) {
    const radius = getAdjustedPickRadius(TOWER_PICK_RADIUS);
    for (let i = towers.length - 1; i >= 0; i--) {
        const tower = towers[i];
        if (Math.hypot(px - tower.worldX, py - tower.worldY) <= radius) {
            return tower;
        }
    }
    return null;
}

function getEnemyAtPoint(px, py) {
    const radius = getAdjustedPickRadius(ENEMY_RADIUS * 1.5);
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        if (Math.hypot(px - enemy.x, py - enemy.y) <= radius) {
            return enemy;
        }
    }
    return null;
}

function upgradeTower(tower) {
    if (gameOver) return false;
    ensureTowerMetadata(tower);
    if (tower.level >= TOWER_MAX_LEVEL) {
        return false;
    }
    const cost = tower.upgradeCost;
    if (cost == null || gold < cost) {
        return false;
    }
    gold -= cost;
    tower.spentGold = (tower.spentGold || 0) + cost;
    updateGoldUI();
    tower.level += 1;
    recalcTowerStats(tower);
    playSound('upgrade');
    if (selectedTower === tower) {
        updateTowerStatsFields();
    }
    const upgDef = getTowerDefinition(tower.type);
    announce(upgDef.label + ' 레벨 ' + tower.level + '로 업그레이드');
    return true;
}

function sellTower(tower) {
    if (gameOver) return false;
    const idx = towers.indexOf(tower);
    if (idx === -1) return false;
    const refund = Math.floor((tower.spentGold || 0) * 0.5);
    towers.splice(idx, 1);
    towerPositionSet.delete(keyFromGrid(tower.x, tower.y));
    gold = Math.min(999999, gold + refund);
    updateGoldUI();
    if (selectedTower === tower) hideTowerStats();
    playSound('build');
    const sellDef = getTowerDefinition(tower.type);
    announce(sellDef.label + ' 판매 — ' + refund + 'G 환급');
    return true;
}

function flashGoldInsufficient() {
    if (!GOLD_LABEL) return;
    const chip = GOLD_LABEL.closest('.stat-chip');
    if (!chip) return;
    chip.classList.remove('flash-insufficient');
    void chip.offsetWidth;
    chip.classList.add('flash-insufficient');
    announce('골드가 부족합니다');
}

let _defeatPreviousFocus = null;

function showDefeatDialog() {
    if (gameOver) {
        return;
    }
    gameOver = true;
    paused = true;
    render();
    stopLoop();
    clearCurrentWave();
    selectedTowerType = DEFAULT_TOWER_TYPE;
    setSelectedTowerButton(selectedTowerType);
    setGameSpeed(1);
    if (DEFEAT_OVERLAY) {
        _defeatPreviousFocus = document.activeElement;
        DEFEAT_OVERLAY.classList.remove('hidden');
        if (RETRY_BUTTON) {
            RETRY_BUTTON.focus();
        }
    }
    updateWavePreview(0);
}

function hideDefeatDialog() {
    if (!DEFEAT_OVERLAY) {
        return;
    }
    DEFEAT_OVERLAY.classList.add('hidden');
    if (_defeatPreviousFocus && typeof _defeatPreviousFocus.focus === 'function') {
        _defeatPreviousFocus.focus();
        _defeatPreviousFocus = null;
    }
}

let _mapSelectPreviousFocus = null;

function showMapSelectOverlay() {
    if (!MAP_SELECT_OVERLAY) {
        return;
    }
    _mapSelectPreviousFocus = document.activeElement;
    paused = true;
    MAP_SELECT_OVERLAY.classList.remove('hidden');
    const firstFocusable = MAP_SELECT_OVERLAY.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (firstFocusable) {
        firstFocusable.focus();
    }
}

function hideMapSelectOverlay() {
    if (!MAP_SELECT_OVERLAY) {
        return;
    }
    MAP_SELECT_OVERLAY.classList.add('hidden');
    if (_mapSelectPreviousFocus && typeof _mapSelectPreviousFocus.focus === 'function') {
        _mapSelectPreviousFocus.focus();
        _mapSelectPreviousFocus = null;
    }
}

function populateMapList() {
    if (!MAP_LIST_CONTAINER) {
        return;
    }
    MAP_LIST_CONTAINER.innerHTML = '';
    const cards = [];
    for (const mapDef of Object.values(MAP_DEFINITIONS)) {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'map-card' + (mapDef.id === activeMapId ? ' selected' : '');
        card.dataset.mapId = mapDef.id;

        const nameEl = document.createElement('span');
        nameEl.className = 'map-card-name';
        nameEl.textContent = mapDef.name;

        const diffEl = document.createElement('span');
        diffEl.className = 'map-card-difficulty';
        diffEl.textContent = '난이도: ' + mapDef.difficulty;

        card.setAttribute('aria-pressed', String(mapDef.id === activeMapId));
        card.append(nameEl, diffEl);
        card.addEventListener('click', () => {
            activeMapId = mapDef.id;
            cards.forEach(c => {
                const isSelected = c.dataset.mapId === activeMapId;
                c.classList.toggle('selected', isSelected);
                c.setAttribute('aria-pressed', String(isSelected));
            });
        });
        MAP_LIST_CONTAINER.appendChild(card);
        cards.push(card);
    }
}

function resetGame() {
    buildMapData(activeMapId);
    staticLayer = null;
    gold = 100;
    lives = 20;
    wave = 1;
    gameOver = false;
    paused = false;
    hoverTile = null;
    hideAllStats();
    towers.length = 0;
    towerPositionSet.clear();
    clearCurrentWave();
    selectedTowerType = DEFAULT_TOWER_TYPE;
    setSelectedTowerButton(selectedTowerType);
    updateGoldUI();
    if (LIVES_LABEL) LIVES_LABEL.textContent = lives;
    if (WAVE_LABEL) WAVE_LABEL.textContent = wave;
    if (WAVE_INPUT) {
        WAVE_INPUT.value = wave;
    }
    hideDefeatDialog();
    setGameSpeed(1);
    buildPanelUserOverride = false;
    if (typeof window !== 'undefined' && window.innerWidth < AUTOCOLLAPSE_WIDTH) {
        setBuildPanelCollapsed(true);
    } else {
        setBuildPanelCollapsed(false);
    }
    updateWavePreview();
    elapsedTime = 0;
    lastTime = performance.now();
    cachedNoiseBuffer = null;
    gameLoopHalted = false;
    loopErrorCount = 0;
    cachedNoiseDuration = 0;
}

function startWave() {
    waveInProgress = true;
    enemiesToSpawn = getWaveEnemyCount(wave);
    spawnCooldown = 0;
    nextWaveTimer = 0;
    if (WAVE_LABEL) WAVE_LABEL.textContent = wave;
    if (WAVE_INPUT) {
        WAVE_INPUT.value = wave;
    }
    updateWavePreview(enemiesToSpawn + enemies.length);
}

function canBuildAt(x, y) {
    if (x < 0 || x >= GRID_COLS || y < 0 || y >= GRID_ROWS) {
        return false;
    }
    if (pathTiles.has(keyFromGrid(x, y))) {
        return false;
    }
    return !towerPositionSet.has(keyFromGrid(x, y));
}

function createTowerData(x, y, typeId) {
    const def = getTowerDefinition(typeId);
    return {
        def,
        type: def.id,
        x,
        y,
        worldX: x * TILE_SIZE + TILE_CENTER_OFFSET,
        worldY: y * TILE_SIZE + TILE_CENTER_OFFSET,
        cooldown: 0,
        level: 1,
        range: def.range,
        fireDelay: def.fireDelay,
        damage: calculateTowerDamage(def, 1),
        upgradeCost: calculateUpgradeCost(def, 1),
        activeBeam: null,
        heading: 0,
        aimAngle: null,
        flashTimer: 0,
        recoil: 0,
        auraOffset: Math.random() * Math.PI * 2,
        spentGold: def.cost || 0
    };
}


function pickEnemyType(waveNumber) {
    if (waveNumber % 10 === 0 && enemiesToSpawn === 1) {
        return ENEMY_TYPE_MAP['boss'] || ENEMY_TYPE_DEFINITIONS[0];
    }
    if (waveNumber >= 3) {
        const roll = Math.random();
        if (roll < 0.20) return ENEMY_TYPE_MAP['armored'] || ENEMY_TYPE_DEFINITIONS[0];
        if (roll < 0.50) return ENEMY_TYPE_MAP['fast'] || ENEMY_TYPE_DEFINITIONS[0];
    }
    return ENEMY_TYPE_DEFINITIONS[0];
}

function spawnEnemy() {
    const start = waypoints[0];
    const enemyType = pickEnemyType(wave);
    const stats = getWaveEnemyStats(wave, enemyType);
    enemies.push({
        x: start.x,
        y: start.y,
        speed: stats.speed,
        hp: stats.hp,
        maxHp: stats.hp,
        waypoint: 0,
        reward: stats.reward,
        waveIndex: wave,
        heading: 0,
        enemyType,
        pulseSeed: Math.random() * Math.PI * 2
    });
}


function findTarget(tower) {
    let chosen = null;
    let chosenIndex = -1;
    let bestScore = -Infinity;
    const rangeSq = tower.range * tower.range;
    for (let i = 0; i < enemies.length; i++) {
        const enemy = enemies[i];
        const dx = enemy.x - tower.worldX;
        const dy = enemy.y - tower.worldY;
        const distSq = dx * dx + dy * dy;
        if (distSq > rangeSq) continue;
        const score = enemy.waypoint * 1000 - distSq;
        if (score > bestScore) {
            bestScore = score;
            chosen = enemy;
            chosenIndex = i;
        }
    }
    return chosen ? { enemy: chosen, index: chosenIndex } : null;
}

function spawnProjectile(options) {
    const speed = Math.hypot(options.vx, options.vy) || 1;
    projectiles.push({
        x: options.x,
        y: options.y,
        vx: options.vx,
        vy: options.vy,
        damage: options.damage,
        life: options.life,
        initialLife: options.life,
        radius: options.radius,
        color: options.color,
        outline: options.outline || null,
        shape: options.shape || 'circle',
        trailColor: options.trailColor || null,
        trailLength: options.trailLength || 0,
        glowColor: options.glowColor || options.color,
        hitRadius: options.hitRadius || Math.max(16, (options.radius || 6) * 1.6),
        rotation: options.rotation != null ? options.rotation : Math.atan2(options.vy, options.vx),
        spin: options.spin || 0,
        delay: options.delay || 0,
        gravity: options.gravity || 0,
        explosionRadius: options.explosionRadius || 0,
        explosionColor: options.explosionColor || null,
        explosionHaloColor: options.explosionHaloColor || null,
        explosionStrokeColor: options.explosionStrokeColor || null,
        explosionLife: options.explosionLife || null,
        detonateOnExpire: Boolean(options.detonateOnExpire),
        speed
    });
}

function handleTowerFireVisuals(tower, def, angle) {
    const baseSize = TOWER_DRAW_BASE + (tower.level - 1) * 1.2;
    tower.aimAngle = angle;
    tower.heading = angle;
    const flashDuration = def.flashDuration || 0.12;
    tower.flashTimer = Math.max(tower.flashTimer || 0, flashDuration);
    const recoilKick = def.recoilKick ?? 0.45;
    tower.recoil = Math.min(1.4, (tower.recoil || 0) + recoilKick);
    const muzzleDistance = baseSize * (def.muzzleLengthMultiplier || 1.65);
    const muzzleX = tower.worldX + Math.cos(angle) * muzzleDistance;
    const muzzleY = tower.worldY + Math.sin(angle) * muzzleDistance;
    const flashColor = def.muzzleFlashColor || getTowerColor(def, tower.level);
    const flashRadius = baseSize * (def.flashSizeMultiplier || 0.9);
    spawnMuzzleFlash(muzzleX, muzzleY, flashRadius, flashColor, angle, {
        growth: flashRadius * 9,
        life: def.flashDuration || 0.16
    });
}

function performTowerAttack(tower, target, def) {
    const baseDx = target.x - tower.worldX;
    const baseDy = target.y - tower.worldY;
    const baseDist = Math.hypot(baseDx, baseDy) || 1;
    const baseAngle = Math.atan2(baseDy, baseDx);
    const dirX = baseDx / baseDist;
    const dirY = baseDy / baseDist;

    handleTowerFireVisuals(tower, def, baseAngle);

    if (def.attackPattern === 'shotgun') {
        const pellets = def.pellets || 4;
        const spread = def.spread || (Math.PI / 4);
        for (let i = 0; i < pellets; i++) {
            const ratio = pellets === 1 ? 0 : (i / (pellets - 1)) - 0.5;
            const jitter = (Math.random() - 0.5) * 0.35;
            const angle = baseAngle + (ratio + jitter) * spread;
            const speed = def.projectileSpeed * (0.9 + Math.random() * 0.3);
            const color = getProjectileColor(def, tower.level);
            spawnProjectile({
                x: tower.worldX,
                y: tower.worldY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                damage: tower.damage,
                life: def.projectileLife + (tower.level - 1) * 0.05,
                radius: def.projectileRadius + (tower.level - 1) * 0.7,
                color,
                glowColor: def.glowColor || color,
                outline: '#2e2e2e',
                trailColor: getProjectileColor(def, Math.max(1, tower.level - 1)),
                trailLength: def.trailLength + (tower.level - 1) * 10,
                hitRadius: 14 + tower.level,
                spin: (Math.random() - 0.5) * 6,
                shape: 'circle'
            });
        }
        return;
    }

    if (def.attackPattern === 'beam') {
        const speed = def.projectileSpeed + (tower.level - 1) * 25;
        const color = getProjectileColor(def, tower.level);
        spawnProjectile({
            x: tower.worldX,
            y: tower.worldY,
            vx: dirX * speed,
            vy: dirY * speed,
            damage: tower.damage,
            life: def.projectileLife + (tower.level - 1) * 0.2,
            radius: def.beamWidth + (tower.level - 1) * 1.2,
            color,
            glowColor: def.glowColor || color,
            outline: '#ffffff33',
            shape: 'beam',
            trailColor: color,
            trailLength: def.trailLength + (tower.level - 1) * 30,
            hitRadius: 24 + tower.level * 1.5
        });
        return;
    }

    if (def.attackPattern === 'burst') {
        const speed = def.projectileSpeed + (tower.level - 1) * 25;
        const burstCount = def.burstCount || 3;
        const delayStep = def.burstDelay ?? 0.07;
        const color = getProjectileColor(def, tower.level);
        for (let i = 0; i < burstCount; i++) {
            const delay = i * delayStep;
            spawnProjectile({
                x: tower.worldX,
                y: tower.worldY,
                vx: dirX * speed,
                vy: dirY * speed,
                damage: tower.damage,
                life: def.projectileLife + (tower.level - 1) * 0.08 + delay,
                radius: def.projectileRadius + (tower.level - 1) * 0.5,
                color,
                glowColor: def.glowColor || color,
                outline: '#351a05',
                shape: 'triangle',
                trailColor: '#fffbf2',
                trailLength: def.trailLength + (tower.level - 1) * 12,
                delay,
                spin: 6,
                hitRadius: 18 + tower.level * 1.4
            });
        }
        return;
    }

    if (def.attackPattern === 'explosive') {
        const speed = def.projectileSpeed + (tower.level - 1) * 20;
        const color = getProjectileColor(def, tower.level);
        spawnProjectile({
            x: tower.worldX,
            y: tower.worldY,
            vx: dirX * speed,
            vy: dirY * speed,
            damage: tower.damage,
            life: def.projectileLife + (tower.level - 1) * 0.12,
            radius: def.projectileRadius + (tower.level - 1) * 0.6,
            color,
            glowColor: def.glowColor || color,
            outline: def.outline,
            shape: 'hex',
            trailColor: getProjectileColor(def, Math.max(1, tower.level - 1)),
            trailLength: def.trailLength + (tower.level - 1) * 15,
            explosionRadius: def.explosionRadius + tower.level * 4,
            explosionColor: def.explosionColor,
            explosionHaloColor: def.explosionHaloColor,
            explosionStrokeColor: def.explosionStrokeColor,
            explosionLife: def.explosionLife,
            hitRadius: 22 + tower.level * 1.5,
            detonateOnExpire: true
        });
        return;
    }

    if (def.attackPattern === 'mortar') {
        const speed = def.projectileSpeed + (tower.level - 1) * 12;
        const lift = def.mortarLift + (tower.level - 1) * 12;
        const color = getProjectileColor(def, tower.level);
        spawnProjectile({
            x: tower.worldX,
            y: tower.worldY,
            vx: dirX * speed,
            vy: dirY * speed - lift,
            damage: tower.damage,
            life: def.projectileLife + (tower.level - 1) * 0.18,
            radius: def.projectileRadius + (tower.level - 1) * 1.2,
            color,
            glowColor: def.glowColor || color,
            outline: def.outline,
            shape: 'orb',
            trailColor: getProjectileColor(def, Math.max(1, tower.level - 1)),
            trailLength: def.trailLength + (tower.level - 1) * 14,
            gravity: def.gravity,
            explosionRadius: def.explosionRadius + tower.level * 5,
            explosionColor: def.explosionColor,
            explosionHaloColor: def.explosionHaloColor,
            explosionStrokeColor: def.explosionStrokeColor,
            explosionLife: def.explosionLife,
            hitRadius: 26 + tower.level * 2,
            detonateOnExpire: true
        });
        return;
    }

    const speed = (def.projectileSpeed || 580) + (tower.level - 1) * 20;
    const color = getProjectileColor(def, tower.level);
    spawnProjectile({
        x: tower.worldX,
        y: tower.worldY,
        vx: dirX * speed,
        vy: dirY * speed,
        damage: tower.damage,
        life: (def.projectileLife || 0.8) + (tower.level - 1) * 0.06,
        radius: (def.projectileRadius || 6) + (tower.level - 1) * 0.4,
        color,
        glowColor: def.glowColor || color,
        outline: def.outline,
        shape: def.shape === 'triangle' ? 'triangle' : 'circle',
        trailColor: getProjectileColor(def, Math.max(1, tower.level - 1)),
        trailLength: def.trailLength + (tower.level - 1) * 12,
        hitRadius: 16 + tower.level * 1.2
    });
}


function handleLaserAttack(tower, dt, def) {
    const hadBeam = Boolean(tower.activeBeam && tower.activeBeam.alpha > 0.2);
    if (tower.activeBeam) {
        tower.activeBeam.alpha = Math.max(0, tower.activeBeam.alpha - dt * 8);
        if (tower.activeBeam.alpha <= 0.01) {
            tower.activeBeam = null;
        }
    }
    const result = findTarget(tower);
    if (!result) {
        tower.aimAngle = null;
        return;
    }
    const target = result.enemy;
    let targetIndex = result.index;
    if (enemies[targetIndex] !== target) {
        targetIndex = enemies.indexOf(target);
        if (targetIndex === -1) { tower.activeBeam = null; return; }
    }
    const angle = Math.atan2(target.y - tower.worldY, target.x - tower.worldX);
    tower.aimAngle = angle;
    if (typeof tower.heading !== 'number') {
        tower.heading = angle;
    } else {
        const turnSpeed = Math.max(4, (def.turnSpeed || 8) * 1.25);
        tower.heading = lerpAngle(tower.heading, angle, Math.min(1, dt * turnSpeed));
    }
    tower.flashTimer = Math.max(tower.flashTimer || 0, (def.flashDuration || 0.08));
    const damagePerSecond = tower.damage * (def.sustainMultiplier || 1);
    const appliedDamage = damagePerSecond * dt;
    const targetX = target.x;
    const targetY = target.y;
    const killed = damageEnemyAtIndex(targetIndex, appliedDamage);
    const beamColor = def.beamColor || getProjectileColor(def, tower.level);
    tower.activeBeam = {
        x1: tower.worldX,
        y1: tower.worldY,
        x2: targetX,
        y2: targetY,
        width: (def.beamWidth || 6) + (tower.level - 1) * 0.35,
        color: beamColor,
        glow: def.beamGlowColor || beamColor,
        alpha: 0.95
    };
    if (!hadBeam) {
        playSound('laser');
    }
    if (killed) {
        spawnImpactEffect(targetX, targetY, 36 + tower.level * 2, def.beamGlowColor || 'rgba(150, 255, 255, 0.4)', {
            haloColor: '#d4fbff',
            life: 0.4,
            pulse: true
        });
    }
}

function update(dt) {
    if (buildFailFlash) {
        buildFailFlash.timer -= dt;
        if (buildFailFlash.timer <= 0) buildFailFlash = null;
    }
    if (gameOver) {
        return;
    }
    if (!waveInProgress && nextWaveTimer <= 0) {
        startWave();
    }
    if (waveInProgress) {
        if (enemiesToSpawn > 0) {
            spawnCooldown -= dt;
            if (spawnCooldown <= 0) {
                spawnEnemy();
                enemiesToSpawn--;
                const minCooldown = wave < 30 ? 0.25 : wave < 60 ? 0.18 : 0.12;
                spawnCooldown = Math.max(0.6 - wave * 0.02, minCooldown);
            }
        } else if (enemies.length === 0) {
            waveInProgress = false;
            nextWaveTimer = 4;
            wave = Math.min(wave + 1, WAVE_MAX);
            if (WAVE_LABEL) WAVE_LABEL.textContent = wave;
            if (WAVE_INPUT) {
                WAVE_INPUT.value = wave;
            }
            updateWavePreview();
        }
    } else if (nextWaveTimer > 0) {
        nextWaveTimer -= dt;
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        const target = waypoints[enemy.waypoint + 1];
        if (!target) {
            if (selectedEnemy === enemy) {
                hideEnemyStats();
            }
            enemies.splice(i, 1);
            lives = Math.max(0, lives - 1);
            if (LIVES_LABEL) LIVES_LABEL.textContent = lives;
            if (lives === 0) {
                showDefeatDialog();
                return;
            }
            continue;
        }
        const dx = target.x - enemy.x;
        const dy = target.y - enemy.y;
        const dist = Math.hypot(dx, dy) || 0.0001;
        const dirX = dx / dist;
        const dirY = dy / dist;
        enemy.heading = Math.atan2(dirY, dirX);
        if (dist < enemy.speed * dt) {
            enemy.x = target.x;
            enemy.y = target.y;
            enemy.waypoint += 1;
        } else {
            enemy.x += dirX * enemy.speed * dt;
            enemy.y += dirY * enemy.speed * dt;
        }
    }

    for (const tower of towers) {
        const def = tower.def || getTowerDefinition(tower.type);
        tower.flashTimer = Math.max(0, (tower.flashTimer || 0) - dt * 4.6);
        tower.recoil = Math.max(0, (tower.recoil || 0) - dt * (def.recoilRecovery || 3));
        if (def.attackPattern === 'laser') {
            handleLaserAttack(tower, dt, def);
            continue;
        }
        if (tower.activeBeam) {
            tower.activeBeam.alpha = Math.max(0, tower.activeBeam.alpha - dt * 6);
            if (tower.activeBeam.alpha <= 0.05) {
                tower.activeBeam = null;
            }
        }
        const result = findTarget(tower);
        let target = result ? result.enemy : null;
        if (target) {
            const angle = Math.atan2(target.y - tower.worldY, target.x - tower.worldX);
            tower.aimAngle = angle;
        }
        if (tower.aimAngle != null) {
            if (typeof tower.heading !== 'number') {
                tower.heading = tower.aimAngle;
            } else {
                const turnSpeed = Math.max(3, def.turnSpeed || 7.5);
                tower.heading = lerpAngle(tower.heading, tower.aimAngle, Math.min(1, dt * turnSpeed));
            }
        }
        if (tower.cooldown > 0) {
            tower.cooldown -= dt;
            if (tower.cooldown > 0) {
                continue;
            }
        }
        if (!target) {
            tower.cooldown = 0;
            continue;
        }
        performTowerAttack(tower, target, def);
        tower.cooldown = tower.fireDelay;
    }

    for (let i = projectiles.length - 1; i >= 0; i--) {
        const projectile = projectiles[i];
        if (projectile.delay > 0) {
            projectile.delay -= dt;
            if (projectile.delay > 0) {
                continue;
            }
        }
        if (projectile.gravity) {
            projectile.vy += projectile.gravity * dt;
        }
        projectile.x += projectile.vx * dt;
        projectile.y += projectile.vy * dt;
        projectile.life -= dt;
        if (projectile.spin && !prefersReducedMotion) {
            projectile.rotation += projectile.spin * dt;
        } else {
            projectile.rotation = Math.atan2(projectile.vy, projectile.vx);
        }
        projectile.speed = Math.hypot(projectile.vx, projectile.vy) || 1;

        let remove = false;
        let impacted = false;
        for (let j = enemies.length - 1; j >= 0; j--) {
            const enemy = enemies[j];
            const dx = enemy.x - projectile.x;
            const dy = enemy.y - projectile.y;
            if (dx * dx + dy * dy <= projectile.hitRadius * projectile.hitRadius) {
                if (projectile.explosionRadius) {
                    applyExplosion(projectile, projectile.x, projectile.y);
                } else {
                    damageEnemyAtIndex(j, projectile.damage);
                    spawnImpactEffect(projectile.x, projectile.y, (projectile.radius || 6) * 1.4, projectile.glowColor || projectile.color, {
                        haloColor: projectile.color,
                        life: 0.28,
                        pulse: false
                    });
                }
                impacted = true;
                remove = true;
                break;
            }
        }

        if (!impacted && projectile.life <= 0 && projectile.detonateOnExpire && projectile.explosionRadius) {
            applyExplosion(projectile, projectile.x, projectile.y);
            remove = true;
        }

        if (projectile.life <= 0) {
            remove = true;
        }

        if (remove) {
            projectiles.splice(i, 1);
        }
    }

    for (let i = muzzleFlashes.length - 1; i >= 0; i--) {
        const flash = muzzleFlashes[i];
        flash.life -= dt;
        flash.radius += flash.growth * dt;
        if (flash.life <= 0) {
            muzzleFlashes.splice(i, 1);
        }
    }

    for (let i = impactEffects.length - 1; i >= 0; i--) {
        const effect = impactEffects[i];
        effect.life -= dt;
        if (effect.life <= 0) {
            impactEffects.splice(i, 1);
        }
    }

    if (selectedEnemy) {
        updateEnemyStatsFields();
    }
    if (selectedTower) {
        updateTowerStatsFields();
    }
    updateWavePreview(waveInProgress ? enemiesToSpawn + enemies.length : null);
}


function drawGrid(targetCtx) {
    const c = targetCtx || ctx;
    c.save();
    c.strokeStyle = "#2a333d";
    c.lineWidth = 1;
    for (let x = 0; x <= GRID_COLS; x++) {
        c.beginPath();
        c.moveTo(x * TILE_SIZE + 0.5, 0);
        c.lineTo(x * TILE_SIZE + 0.5, GRID_ROWS * TILE_SIZE);
        c.stroke();
    }
    for (let y = 0; y <= GRID_ROWS; y++) {
        c.beginPath();
        c.moveTo(0, y * TILE_SIZE + 0.5);
        c.lineTo(GRID_COLS * TILE_SIZE, y * TILE_SIZE + 0.5);
        c.stroke();
    }
    c.restore();
}

function drawPath(targetCtx) {
    const c = targetCtx || ctx;
    c.save();
    c.fillStyle = "#3b4637";
    pathTiles.forEach(key => {
        const [gx, gy] = key.split(",").map(Number);
        if (gx < 0 || gy < 0 || gx >= GRID_COLS || gy >= GRID_ROWS) {
            return;
        }
        c.fillRect(gx * TILE_SIZE, gy * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    });
    c.restore();
}

function buildStaticLayer() {
    const offscreen = document.createElement('canvas');
    offscreen.width = canvas.width;
    offscreen.height = canvas.height;
    const offCtx = offscreen.getContext('2d');
    if (!offCtx) {
        console.error('Failed to get offscreen 2D context');
        return;
    }
    drawGrid(offCtx);
    drawPath(offCtx);
    staticLayer = offscreen;
}

function drawHexagon(x, y, radius) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const angle = Math.PI / 3 * i + Math.PI / 6;
        const px = x + Math.cos(angle) * radius;
        const py = y + Math.sin(angle) * radius;
        if (i === 0) {
            ctx.moveTo(px, py);
        } else {
            ctx.lineTo(px, py);
        }
    }
    ctx.closePath();
}

function drawTowerShape(tower, color, outline, time, def) {
    const size = TOWER_DRAW_BASE + (tower.level - 1) * 1.2;
    const x = tower.worldX;
    const y = tower.worldY;
    const heading = typeof tower.heading === 'number' ? tower.heading : 0;
    const recoil = Math.min(1, tower.recoil || 0);
    const flashIntensity = Math.min(1, (tower.flashTimer || 0) * 8);
    const baseColor = def.baseColor || outline || color;
    const coreColor = def.coreColor || color;
    const barrelColor = def.barrelColor || coreColor;
    const glowColor = def.glowColor || color;
    ctx.lineJoin = 'round';

    switch (def.shape) {
    case 'turret': {
        const baseRadius = size * 1.18;
        ctx.fillStyle = baseColor;
        ctx.beginPath();
        ctx.arc(x, y, baseRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = outline || '#1f2f5a';
        ctx.lineWidth = 2.6;
        ctx.stroke();

        ctx.fillStyle = coreColor;
        ctx.beginPath();
        ctx.arc(x, y, size * 0.95, 0, Math.PI * 2);
        ctx.fill();

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(heading);
        const barrelLength = size * (def.muzzleLengthMultiplier || 1.8) - recoil * size * 0.75;
        const barrelWidth = size * (def.barrelWidthMultiplier || 0.45);
        ctx.fillStyle = barrelColor;
        ctx.beginPath();
        ctx.moveTo(-size * 0.2, -barrelWidth);
        ctx.lineTo(barrelLength, -barrelWidth);
        ctx.lineTo(barrelLength, barrelWidth);
        ctx.lineTo(-size * 0.2, barrelWidth);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = applyAlpha(glowColor, 0.85);
        ctx.beginPath();
        ctx.arc(barrelLength, 0, barrelWidth * (0.6 + flashIntensity * 0.4), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.strokeStyle = applyAlpha(glowColor, 0.55 + flashIntensity * 0.25);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, size * 0.58, 0, Math.PI * 2);
        ctx.stroke();
        break;
    }
    case 'vulcan': {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(heading * 0.15);
        ctx.fillStyle = baseColor;
        ctx.beginPath();
        ctx.ellipse(0, 0, size * 1.35, size * 1.05, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = outline || '#0b2b4c';
        ctx.lineWidth = 2.4;
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = coreColor;
        ctx.beginPath();
        ctx.arc(x, y, size * 0.88, 0, Math.PI * 2);
        ctx.fill();

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(heading);
        const barrelLength = size * (def.muzzleLengthMultiplier || 1.45) - recoil * size * 0.6;
        const barrelWidth = size * 0.46;
        ctx.fillStyle = barrelColor;
        ctx.fillRect(-size * 0.25, -barrelWidth * 0.55, barrelLength, barrelWidth * 0.55);
        ctx.fillRect(-size * 0.25, barrelWidth * 0.05, barrelLength, barrelWidth * 0.55);

        ctx.fillStyle = applyAlpha(glowColor, 0.78 + flashIntensity * 0.22);
        ctx.beginPath();
        ctx.arc(barrelLength, -barrelWidth * 0.3, barrelWidth * 0.45, 0, Math.PI * 2);
        ctx.arc(barrelLength, barrelWidth * 0.3, barrelWidth * 0.45, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.strokeStyle = applyAlpha(glowColor, 0.58);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, size * 0.62, 0, Math.PI * 2);
        ctx.stroke();
        break;
    }
    case 'rail': {
        ctx.beginPath();
        ctx.moveTo(x, y - size * 1.3);
        ctx.lineTo(x + size * 0.95, y);
        ctx.lineTo(x, y + size * 1.3);
        ctx.lineTo(x - size * 0.95, y);
        ctx.closePath();
        ctx.fillStyle = baseColor;
        ctx.fill();
        ctx.strokeStyle = outline || '#27144a';
        ctx.lineWidth = 2.2;
        ctx.stroke();

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(heading);
        const barrelLength = size * (def.muzzleLengthMultiplier || 2.2) - recoil * size * 0.85;
        const railWidth = size * 0.32;
        ctx.fillStyle = barrelColor;
        ctx.fillRect(-size * 0.2, -railWidth, barrelLength, railWidth * 0.6);
        ctx.fillRect(-size * 0.2, railWidth * 0.4, barrelLength, railWidth * 0.6);

        ctx.fillStyle = applyAlpha(glowColor, 0.8);
        ctx.fillRect(-size * 0.1, -railWidth * 0.25, barrelLength, railWidth * 0.5);
        ctx.restore();

        ctx.fillStyle = coreColor;
        ctx.beginPath();
        ctx.arc(x, y, size * 0.68, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = applyAlpha(glowColor, 0.48 + flashIntensity * 0.3);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, size * 0.76, 0, Math.PI * 2);
        ctx.stroke();
        break;
    }
    case 'prism': {
        ctx.fillStyle = baseColor;
        drawHexagon(x, y, size * 1.05);
        ctx.fill();
        ctx.strokeStyle = outline || '#4a2509';
        ctx.lineWidth = 2.2;
        ctx.stroke();

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(heading);
        const prongLength = size * (def.muzzleLengthMultiplier || 1.6) - recoil * size * 0.6;
        ctx.fillStyle = barrelColor;
        ctx.beginPath();
        ctx.moveTo(-size * 0.25, -size * 0.45);
        ctx.lineTo(prongLength, -size * 0.18);
        ctx.lineTo(prongLength, size * 0.18);
        ctx.lineTo(-size * 0.25, size * 0.45);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = applyAlpha(glowColor, 0.85);
        ctx.beginPath();
        ctx.moveTo(-size * 0.15, -size * 0.25);
        ctx.lineTo(prongLength * 0.85, 0);
        ctx.lineTo(-size * 0.15, size * 0.25);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        ctx.fillStyle = coreColor;
        ctx.beginPath();
        ctx.arc(x, y, size * 0.82, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = applyAlpha(glowColor, 0.62 + flashIntensity * 0.23);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, size * 0.9, 0, Math.PI * 2);
        ctx.stroke();
        break;
    }
    case 'gyro': {
        ctx.beginPath();
        ctx.moveTo(x, y - size * 1.25);
        ctx.lineTo(x + size * 1.05, y + size * 1.05);
        ctx.lineTo(x - size * 1.05, y + size * 1.05);
        ctx.closePath();
        ctx.fillStyle = baseColor;
        ctx.fill();
        ctx.strokeStyle = outline || '#073519';
        ctx.lineWidth = 2.2;
        ctx.stroke();

        ctx.fillStyle = coreColor;
        ctx.beginPath();
        ctx.arc(x, y, size * 0.78, 0, Math.PI * 2);
        ctx.fill();

        const spin = (time || 0) * 6 + (tower.auraOffset || 0);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(spin);
        ctx.fillStyle = barrelColor;
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.moveTo(size * 0.25, -size * 0.12);
            ctx.lineTo(size * 1.1 - recoil * size * 0.4, 0);
            ctx.lineTo(size * 0.25, size * 0.12);
            ctx.closePath();
            ctx.fill();
            ctx.rotate((Math.PI * 2) / 3);
        }
        ctx.restore();

        ctx.fillStyle = applyAlpha(glowColor, 0.75 + flashIntensity * 0.2);
        ctx.beginPath();
        ctx.arc(x, y, size * 0.46, 0, Math.PI * 2);
        ctx.fill();
        break;
    }
    case 'howitzer': {
        const baseRadius = size * 1.28;
        ctx.fillStyle = baseColor;
        ctx.beginPath();
        ctx.arc(x, y, baseRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = outline || '#56210a';
        ctx.lineWidth = 2.6;
        ctx.stroke();

        ctx.fillStyle = coreColor;
        ctx.beginPath();
        ctx.arc(x, y, size * 0.92, 0, Math.PI * 2);
        ctx.fill();

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(heading - Math.PI / 10);
        const tubeLength = size * (def.muzzleLengthMultiplier || 1.9) - recoil * size * 1.1;
        const tubeWidth = size * 0.6;
        ctx.fillStyle = barrelColor;
        ctx.beginPath();
        ctx.moveTo(-size * 0.35, -tubeWidth / 2);
        ctx.lineTo(tubeLength, -tubeWidth * 0.35);
        ctx.lineTo(tubeLength + size * 0.35, 0);
        ctx.lineTo(tubeLength, tubeWidth * 0.35);
        ctx.lineTo(-size * 0.35, tubeWidth / 2);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        ctx.strokeStyle = applyAlpha(glowColor, 0.58 + flashIntensity * 0.24);
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(x, y, size * 1.05, 0, Math.PI * 2);
        ctx.stroke();
        break;
    }
    case 'sentinel': {
        const baseRadius = size * 1.1;
        ctx.fillStyle = baseColor;
        ctx.beginPath();
        ctx.arc(x, y, baseRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = outline || '#0b3c4f';
        ctx.lineWidth = 2.4;
        ctx.stroke();

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(heading);
        const prongLength = size * (def.muzzleLengthMultiplier || 1.85) - recoil * size * 0.5;
        const prongWidth = size * 0.5;
        ctx.fillStyle = barrelColor;
        ctx.beginPath();
        ctx.moveTo(-size * 0.15, -prongWidth / 2);
        ctx.lineTo(prongLength, -prongWidth * 0.25);
        ctx.lineTo(prongLength, prongWidth * 0.25);
        ctx.lineTo(-size * 0.15, prongWidth / 2);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = applyAlpha(glowColor, 0.75 + flashIntensity * 0.25);
        ctx.fillRect(-size * 0.12, -prongWidth * 0.3, prongLength, prongWidth * 0.6);
        ctx.restore();

        ctx.fillStyle = coreColor;
        ctx.beginPath();
        ctx.arc(x, y, size * 0.75, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = applyAlpha(glowColor, 0.8);
        ctx.beginPath();
        ctx.arc(x, y, size * (0.38 + flashIntensity * 0.25), 0, Math.PI * 2);
        ctx.fill();
        break;
    }
    case 'artillery': {
        const baseRadius = size * 1.35;
        ctx.fillStyle = baseColor;
        ctx.beginPath();
        ctx.arc(x, y, baseRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = outline || '#3a2b15';
        ctx.lineWidth = 2.6;
        ctx.stroke();

        ctx.fillStyle = coreColor;
        ctx.beginPath();
        ctx.arc(x, y, size * 0.98, 0, Math.PI * 2);
        ctx.fill();

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(heading - Math.PI / 5);
        const tubeLength = size * (def.muzzleLengthMultiplier || 1.75) - recoil * size * 1.05;
        const tubeWidth = size * 0.58;
        ctx.fillStyle = barrelColor;
        ctx.beginPath();
        ctx.moveTo(-size * 0.4, -tubeWidth / 2);
        ctx.lineTo(tubeLength, -tubeWidth * 0.4);
        ctx.lineTo(tubeLength + size * 0.3, 0);
        ctx.lineTo(tubeLength, tubeWidth * 0.4);
        ctx.lineTo(-size * 0.4, tubeWidth / 2);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        ctx.strokeStyle = applyAlpha(glowColor, 0.5 + flashIntensity * 0.3);
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(x, y, size * 1.12, 0, Math.PI * 2);
        ctx.stroke();
        break;
    }
    default: {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
        if (outline) {
            ctx.strokeStyle = outline;
            ctx.lineWidth = 2.2;
            ctx.stroke();
        }
        break;
    }
    }
}


function drawTowers() {
    const now = performance.now() / 1000;
    ctx.save();
    for (const tower of towers) {
        const def = tower.def || getTowerDefinition(tower.type);
        const color = getTowerColor(def, tower.level);
        const size = TOWER_DRAW_BASE + (tower.level - 1) * 1.2;
        const glowColor = def.glowColor || color;
        const auraRadius = size * (1.8 + (prefersReducedMotion ? 0 : Math.sin(now * 2.4 + (tower.auraOffset || 0)) * 0.35));
        const gradient = ctx.createRadialGradient(tower.worldX, tower.worldY, size * 0.3, tower.worldX, tower.worldY, auraRadius);
        gradient.addColorStop(0, applyAlpha(glowColor, 0.4 + (tower.flashTimer || 0) * 0.6));
        gradient.addColorStop(1, applyAlpha(glowColor, 0));
        ctx.save();
        ctx.fillStyle = gradient;
        ctx.globalAlpha = 0.75;
        ctx.beginPath();
        ctx.arc(tower.worldX, tower.worldY, auraRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        if (selectedTower === tower) {
            ctx.save();
            ctx.strokeStyle = applyAlpha(glowColor, 0.35);
            ctx.lineWidth = 2;
            ctx.setLineDash([8, 6]);
            ctx.beginPath();
            ctx.arc(tower.worldX, tower.worldY, tower.range, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
        }

        ctx.save();
        ctx.shadowColor = applyAlpha(glowColor, 0.6 + (tower.flashTimer || 0) * 0.9);
        ctx.shadowBlur = size * (1.2 + (tower.flashTimer || 0) * 2.1);
        drawTowerShape(tower, color, def.outline, now, def);
        ctx.restore();
    }
    ctx.restore();
}


function drawEnemies() {
    const time = performance.now() / 1000;
    ctx.save();
    ctx.lineJoin = 'round';
    for (const enemy of enemies) {
        const style = enemy.enemyType || ENEMY_TYPE_DEFINITIONS[0];
        const heading = typeof enemy.heading === 'number' ? enemy.heading : 0;
        const pulse = prefersReducedMotion ? 0.5 : Math.sin(time * 3.2 + (enemy.pulseSeed || 0)) * 0.5 + 0.5;
        const size = (enemy.enemyType && enemy.enemyType.id === 'boss') ? ENEMY_RADIUS * 1.5 : ENEMY_RADIUS;

        ctx.save();
        ctx.translate(enemy.x, enemy.y);
        ctx.rotate(heading + Math.PI);
        const thrusterLength = size * (1.1 + pulse * 0.45);
        const thrusterWidth = size * 0.7;
        const thrusterGradient = ctx.createLinearGradient(-size * 0.2, 0, -thrusterLength - size * 0.2, 0);
        thrusterGradient.addColorStop(0, applyAlpha(style.thruster || '#ff9a6d', 0));
        thrusterGradient.addColorStop(1, applyAlpha(style.thruster || '#ff9a6d', 0.85));
        ctx.beginPath();
        ctx.moveTo(-size * 0.25, -thrusterWidth / 2);
        ctx.lineTo(-thrusterLength - size * 0.35, 0);
        ctx.lineTo(-size * 0.25, thrusterWidth / 2);
        ctx.closePath();
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = thrusterGradient;
        ctx.fill();
        ctx.restore();

        const auraGradient = ctx.createRadialGradient(enemy.x, enemy.y, size * 0.4, enemy.x, enemy.y, size * 1.9);
        auraGradient.addColorStop(0, applyAlpha(style.body, 0.4 + pulse * 0.25));
        auraGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = auraGradient;
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, size * (1.7 + pulse * 0.25), 0, Math.PI * 2);
        ctx.fill();

        const bodyGradient = ctx.createRadialGradient(enemy.x, enemy.y, size * 0.2, enemy.x, enemy.y, size * 1.05);
        bodyGradient.addColorStop(0, applyAlpha(style.core, 0.95));
        bodyGradient.addColorStop(0.6, style.body);
        bodyGradient.addColorStop(1, applyAlpha(style.body, 0.4));
        ctx.fillStyle = bodyGradient;
        ctx.beginPath();
        ctx.ellipse(enemy.x, enemy.y, size * 1.05, size * (0.85 + pulse * 0.05), heading, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = style.outline || '#1b1f24';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.ellipse(enemy.x, enemy.y, size * 1.05, size * (0.85 + pulse * 0.05), heading, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = applyAlpha(style.core, 0.8 + pulse * 0.15);
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, size * (0.48 + pulse * 0.08), 0, Math.PI * 2);
        ctx.fill();

        const hpRatio = Math.max(0, enemy.hp / enemy.maxHp);
        ctx.strokeStyle = applyAlpha(style.core, 0.65);
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, size * 1.22, -Math.PI / 2, -Math.PI / 2 + hpRatio * Math.PI * 2);
        ctx.stroke();
    }
    ctx.restore();
}


function drawProjectileTrail(projectile) {
    if (!projectile.trailLength) {
        return;
    }
    const norm = projectile.speed || Math.hypot(projectile.vx, projectile.vy) || 1;
    const tx = projectile.x - (projectile.vx / norm) * projectile.trailLength;
    const ty = projectile.y - (projectile.vy / norm) * projectile.trailLength;
    ctx.save();
    const color = projectile.trailColor || projectile.color;
    const gradient = ctx.createLinearGradient(tx, ty, projectile.x, projectile.y);
    gradient.addColorStop(0, applyAlpha(color, 0));
    gradient.addColorStop(0.65, applyAlpha(color, 0.4));
    gradient.addColorStop(1, applyAlpha(color, 0.9));
    ctx.strokeStyle = gradient;
    ctx.lineWidth = Math.max(1.5, (projectile.radius || 4) * 0.7);
    ctx.lineCap = 'round';
    ctx.shadowColor = applyAlpha(color, 0.45);
    ctx.shadowBlur = ctx.lineWidth * 1.8;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(projectile.x, projectile.y);
    ctx.stroke();
    ctx.restore();
}


function drawImpactEffects() {
    if (impactEffects.length === 0) {
        return;
    }
    ctx.save();
    const previousComposite = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';
    for (const effect of impactEffects) {
        const alpha = Math.max(0, effect.life / effect.initialLife);
        const radius = effect.radius * (effect.pulse ? 1 + Math.sin((1 - alpha) * Math.PI) * 0.25 : 1 + (1 - alpha) * 0.35);
        const gradient = ctx.createRadialGradient(effect.x, effect.y, radius * 0.15, effect.x, effect.y, radius);
        gradient.addColorStop(0, applyAlpha('#ffffff', Math.min(0.9, 0.6 + alpha * 0.4)));
        gradient.addColorStop(0.45, applyAlpha(effect.halo || effect.color, Math.min(1, 0.5 + alpha * 0.5)));
        gradient.addColorStop(1, applyAlpha(effect.color, 0));
        ctx.globalAlpha = Math.min(1, alpha + 0.15);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, radius, 0, Math.PI * 2);
        ctx.fill();

        if (effect.stroke) {
            ctx.globalAlpha = Math.min(1, alpha * 0.8);
            ctx.strokeStyle = applyAlpha(effect.stroke, 0.8);
            ctx.lineWidth = effect.lineWidth || Math.max(1.5, radius * 0.12);
            ctx.beginPath();
            ctx.arc(effect.x, effect.y, radius * 0.82, 0, Math.PI * 2);
            ctx.stroke();
        }
    }
    ctx.globalCompositeOperation = previousComposite;
    ctx.restore();
}


function drawLaserBeams() {
    ctx.save();
    for (const tower of towers) {
        const beam = tower.activeBeam;
        if (!beam || beam.alpha <= 0) {
            continue;
        }
        ctx.globalAlpha = Math.min(1, beam.alpha);
        ctx.strokeStyle = beam.glow || beam.color;
        ctx.lineWidth = (beam.width || 6) * 1.8;
        ctx.lineCap = 'round';
        ctx.shadowColor = beam.glow || beam.color;
        ctx.shadowBlur = (beam.width || 6) * 1.5;
        ctx.beginPath();
        ctx.moveTo(beam.x1, beam.y1);
        ctx.lineTo(beam.x2, beam.y2);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = Math.min(1, beam.alpha * 0.8);
        ctx.strokeStyle = beam.color;
        ctx.lineWidth = beam.width || 6;
        ctx.beginPath();
        ctx.moveTo(beam.x1, beam.y1);
        ctx.lineTo(beam.x2, beam.y2);
        ctx.stroke();
    }
    ctx.restore();
}

function drawMuzzleFlashes() {
    if (muzzleFlashes.length === 0) {
        return;
    }
    ctx.save();
    const previousComposite = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';
    for (const flash of muzzleFlashes) {
        const alpha = Math.max(0, flash.life / flash.initialLife);
        const radius = flash.radius;
        const gradient = ctx.createRadialGradient(flash.x, flash.y, radius * 0.1, flash.x, flash.y, radius);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
        gradient.addColorStop(0.45, applyAlpha(flash.color, Math.min(1, 0.7 + alpha * 0.3)));
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.globalAlpha = alpha;
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(flash.x, flash.y, radius, 0, Math.PI * 2);
        ctx.fill();

        if (flash.angle != null) {
            ctx.save();
            ctx.translate(flash.x, flash.y);
            ctx.rotate(flash.angle);
            ctx.globalAlpha = alpha * 0.8;
            ctx.fillStyle = applyAlpha(flash.color, 0.8);
            ctx.fillRect(-radius * 0.2, -radius * 0.08, radius * 1.8, radius * 0.16);
            ctx.restore();
        }
    }
    ctx.globalCompositeOperation = previousComposite;
    ctx.restore();
}

function drawProjectiles() {
    ctx.save();
    for (const projectile of projectiles) {
        if (projectile.delay > 0) {
            continue;
        }
        const alpha = projectile.initialLife > 0 ? Math.max(0.25, projectile.life / projectile.initialLife) : 1;
        ctx.save();
        ctx.globalAlpha = Math.min(1, alpha);
        if (projectile.trailLength && !prefersReducedMotion) {
            ctx.save();
            ctx.globalAlpha = Math.min(0.8, alpha);
            drawProjectileTrail(projectile);
            ctx.restore();
        }
        const glowColor = projectile.glowColor || projectile.color;
        ctx.shadowColor = applyAlpha(glowColor, 0.6);
        ctx.shadowBlur = (projectile.radius || 6) * 1.4;
        switch (projectile.shape) {
        case 'beam': {
            const length = projectile.trailLength || 40;
            ctx.lineCap = 'round';
            ctx.strokeStyle = projectile.color;
            ctx.lineWidth = (projectile.radius || 6) * 1.6;
            ctx.beginPath();
            ctx.moveTo(projectile.x - (projectile.vx / projectile.speed) * length,
                projectile.y - (projectile.vy / projectile.speed) * length);
            ctx.lineTo(projectile.x, projectile.y);
            ctx.stroke();
            break;
        }
        case 'triangle': {
            const size = projectile.radius || 6;
            const angle = projectile.rotation || 0;
            ctx.fillStyle = projectile.color;
            ctx.beginPath();
            ctx.moveTo(
                projectile.x + Math.cos(angle) * size * 1.4,
                projectile.y + Math.sin(angle) * size * 1.4
            );
            ctx.lineTo(
                projectile.x + Math.cos(angle + 2.5) * size,
                projectile.y + Math.sin(angle + 2.5) * size
            );
            ctx.lineTo(
                projectile.x + Math.cos(angle - 2.5) * size,
                projectile.y + Math.sin(angle - 2.5) * size
            );
            ctx.closePath();
            ctx.fill();
            if (projectile.outline) {
                ctx.strokeStyle = projectile.outline;
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }
            break;
        }
        case 'hex': {
            ctx.fillStyle = projectile.color;
            drawHexagon(projectile.x, projectile.y, projectile.radius || 8);
            ctx.fill();
            if (projectile.outline) {
                ctx.strokeStyle = projectile.outline;
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }
            break;
        }
        case 'orb': {
            const radius = projectile.radius || 6;
            const gradient = ctx.createRadialGradient(projectile.x, projectile.y, radius * 0.2,
                projectile.x, projectile.y, radius);
            gradient.addColorStop(0, '#ffffff');
            gradient.addColorStop(1, projectile.color);
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(projectile.x, projectile.y, radius, 0, Math.PI * 2);
            ctx.fill();
            if (projectile.outline) {
                ctx.strokeStyle = projectile.outline;
                ctx.lineWidth = 1.3;
                ctx.stroke();
            }
            break;
        }
        default: {
            ctx.fillStyle = projectile.color;
            ctx.beginPath();
            ctx.arc(projectile.x, projectile.y, projectile.radius || 6, 0, Math.PI * 2);
            ctx.fill();
            if (projectile.outline) {
                ctx.strokeStyle = projectile.outline;
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }
            break;
        }
        }
        ctx.restore();
    }
    ctx.restore();
    drawImpactEffects();
    drawLaserBeams();
}


function initKbCursor() {
    kbCursor = { x: Math.floor(GRID_COLS / 2), y: Math.floor(GRID_ROWS / 2) };
    kbCursorActive = true;
}

function moveKbCursor(dx, dy) {
    if (!kbCursor) initKbCursor();
    kbCursor.x = Math.max(0, Math.min(GRID_COLS - 1, kbCursor.x + dx));
    kbCursor.y = Math.max(0, Math.min(GRID_ROWS - 1, kbCursor.y + dy));
    kbCursorActive = true;
    hoverTile = { x: kbCursor.x, y: kbCursor.y };
    renderDirty = true;
}

function activateKbCursor(isUpgrade) {
    if (!kbCursor) return;
    const worldX = kbCursor.x * TILE_SIZE + TILE_CENTER_OFFSET;
    const worldY = kbCursor.y * TILE_SIZE + TILE_CENTER_OFFSET;
    handlePointerDown(worldX, worldY, isUpgrade);
}

function drawHover() {
    if (kbCursorActive && kbCursor) {
        ctx.save();
        ctx.strokeStyle = "rgba(255, 220, 100, 0.8)";
        ctx.lineWidth = 2;
        ctx.strokeRect(
            kbCursor.x * TILE_SIZE + 1,
            kbCursor.y * TILE_SIZE + 1,
            TILE_SIZE - 2,
            TILE_SIZE - 2
        );
        ctx.restore();
    }
    if (!hoverTile) {
        return;
    }
    const { x, y } = hoverTile;
    if (!canBuildAt(x, y)) {
        ctx.fillStyle = "rgba(215, 80, 80, 0.35)";
    } else {
        ctx.fillStyle = "rgba(98, 150, 255, 0.25)";
    }
    ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
}

function drawState() {
    if (gameLoopHalted) {
        ctx.save();
        ctx.fillStyle = "rgba(80, 0, 0, 0.7)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#ff6b6b";
        ctx.font = "36px 'Noto Sans KR', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("오류 발생", canvas.width / 2, canvas.height / 2 - 30);
        ctx.fillStyle = "#f5f5f5";
        ctx.font = "20px 'Noto Sans KR', sans-serif";
        ctx.fillText("페이지를 새로고침 해주세요", canvas.width / 2, canvas.height / 2 + 20);
        ctx.restore();
        return;
    }
    if (!paused) {
        return;
    }
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#f5f5f5";
    ctx.font = "48px 'Noto Sans KR', 'Malgun Gothic', 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const label = gameOver ? "패배" : "일시 정지";
    ctx.fillText(label, canvas.width / 2, canvas.height / 2);
    ctx.restore();
}

function render() {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (staticLayer) {
        ctx.drawImage(staticLayer, 0, 0);
    } else {
        drawGrid();
        drawPath();
    }
    drawHover();
    if (buildFailFlash && buildFailFlash.timer > 0) {
        const alpha = Math.min(1, buildFailFlash.timer * 3);
        ctx.fillStyle = `rgba(255, 80, 80, ${(0.45 * alpha).toFixed(2)})`;
        ctx.fillRect(buildFailFlash.x * TILE_SIZE, buildFailFlash.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
    drawTowers();
    drawEnemies();
    drawMuzzleFlashes();
    drawProjectiles();
    drawState();
}

// ── Shared pointer coordinate helpers ──────────────────────────────────────

/**
 * Convert a client-space point to canvas-space coordinates,
 * accounting for any CSS scaling applied to the canvas element.
 */
let _cachedCanvasRect = null;
function updateCanvasRect() {
    if (canvas) _cachedCanvasRect = canvas.getBoundingClientRect();
}
function getCanvasCoords(clientX, clientY) {
    const rect = _cachedCanvasRect || canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
    };
}

/**
 * Shared handler for pointer/touch hover (mousemove / touchmove).
 * @param {number} canvasX - Canvas-space X coordinate
 * @param {number} canvasY - Canvas-space Y coordinate
 */
const _hoverTileObj = { x: 0, y: 0 };
function handlePointerMove(canvasX, canvasY) {
    kbCursorActive = false;
    const tileX = Math.floor(canvasX / TILE_SIZE);
    const tileY = Math.floor(canvasY / TILE_SIZE);
    if (tileX >= 0 && tileX < GRID_COLS && tileY >= 0 && tileY < GRID_ROWS) {
        _hoverTileObj.x = tileX;
        _hoverTileObj.y = tileY;
        hoverTile = _hoverTileObj;
    } else {
        hoverTile = null;
    }
    renderDirty = true;
}

/**
 * Shared handler for pointer/touch down (click / touchstart).
 * @param {number} canvasX    - Canvas-space X coordinate
 * @param {number} canvasY    - Canvas-space Y coordinate
 * @param {boolean} isRightClick - true for secondary action (upgrade), false for primary (build/select)
 */
function handlePointerDown(canvasX, canvasY, isRightClick) {
    if (gameOver) return;
    if (isRightClick) {
        const tower = getTowerAtPoint(canvasX, canvasY);
        if (!tower) {
            return;
        }
        upgradeTower(tower);
        return;
    }

    // Primary action: select tower / enemy, or build
    const tower = getTowerAtPoint(canvasX, canvasY);
    if (tower) {
        showTowerStats(tower);
        return;
    }

    const enemy = getEnemyAtPoint(canvasX, canvasY);
    if (enemy) {
        showEnemyStats(enemy);
        return;
    }

    const x = Math.floor(canvasX / TILE_SIZE);
    const y = Math.floor(canvasY / TILE_SIZE);

    if (paused) {
        hideAllStats();
        return;
    }

    if (!canBuildAt(x, y)) {
        announce('해당 위치에 설치할 수 없습니다');
        buildFailFlash = { x, y, timer: 0.3 };
        hideAllStats();
        return;
    }

    const towerDef = getTowerDefinition(selectedTowerType);
    const cost = towerDef.cost || 25;
    if (gold < cost) {
        flashGoldInsufficient();
        return;
    }

    gold -= cost;
    updateGoldUI();
    const towerData = createTowerData(x, y, towerDef.id);
    towers.push(towerData);
    towerPositionSet.add(keyFromGrid(x, y));
    playSound('build');
    showTowerStats(towerData);
    announce(towerDef.label + ' 설치 완료');
}

// ── Mouse event handlers ────────────────────────────────────────────────────

canvas.addEventListener("mousemove", event => {
    const { x, y } = getCanvasCoords(event.clientX, event.clientY);
    handlePointerMove(x, y);
});

canvas.addEventListener("focus", () => {
    if (!kbCursor) initKbCursor();
    kbCursorActive = true;
    renderDirty = true;
});

canvas.addEventListener("mouseleave", () => {
    hoverTile = null;
});

canvas.addEventListener("click", event => {
    const { x, y } = getCanvasCoords(event.clientX, event.clientY);
    handlePointerDown(x, y, false);
});

canvas.addEventListener("contextmenu", event => {
    event.preventDefault();
    const { x, y } = getCanvasCoords(event.clientX, event.clientY);
    handlePointerDown(x, y, true);
});

// ── Touch event handlers ────────────────────────────────────────────────────

canvas.addEventListener('touchstart', function(e) {
    if (e.touches.length > 1) return;
    e.preventDefault();
    const touch = e.touches[0];
    if (!touch) return;
    const { x, y } = getCanvasCoords(touch.clientX, touch.clientY);
    _touchStartX = touch.clientX;
    _touchStartY = touch.clientY;
    _longPressFired = false;
    if (_longPressTimer) clearTimeout(_longPressTimer);
    _longPressTimer = setTimeout(() => {
        _longPressFired = true;
        handlePointerDown(x, y, true);
    }, LONG_PRESS_DURATION);
}, { passive: false });

canvas.addEventListener('touchmove', function(e) {
    if (e.touches.length > 1) return;
    e.preventDefault();
    const touch = e.touches[0];
    if (!touch) return;
    const dx = touch.clientX - _touchStartX;
    const dy = touch.clientY - _touchStartY;
    if (Math.hypot(dx, dy) > LONG_PRESS_MOVE_THRESHOLD) {
        if (_longPressTimer) { clearTimeout(_longPressTimer); _longPressTimer = null; }
    }
    const { x, y } = getCanvasCoords(touch.clientX, touch.clientY);
    handlePointerMove(x, y);
}, { passive: false });

canvas.addEventListener('touchend', function(e) {
    if (e.touches.length > 0) return;
    e.preventDefault();
    if (_longPressTimer) { clearTimeout(_longPressTimer); _longPressTimer = null; }
    if (!_longPressFired) {
        const touch = e.changedTouches[0];
        if (touch) {
            const { x, y } = getCanvasCoords(touch.clientX, touch.clientY);
            handlePointerDown(x, y, false);
        }
    }
    _longPressFired = false;
    hoverTile = null;
}, { passive: false });

populateTowerList();

if (BUILD_TOGGLE) {
    BUILD_TOGGLE.addEventListener('click', () => {
        setBuildPanelCollapsed(!buildPanelCollapsed, { user: true });
        playSound('toggle');
    });
}

setBuildPanelCollapsed(false);

const AUTOCOLLAPSE_WIDTH = 1180;
if (typeof window !== 'undefined') {
    const autoCollapse = () => {
        if (buildPanelUserOverride) {
            return;
        }
        setBuildPanelCollapsed(window.innerWidth < AUTOCOLLAPSE_WIDTH);
    };
    autoCollapse();
    let resizeRaf = 0;
    window.addEventListener('resize', () => {
        updateCanvasRect();
        if (buildPanelUserOverride) return;
        cancelAnimationFrame(resizeRaf);
        resizeRaf = requestAnimationFrame(autoCollapse);
    });
    updateCanvasRect();
} else {
    setBuildPanelCollapsed(false);
}

if (SOUND_TOGGLE) {
    SOUND_TOGGLE.addEventListener('click', () => {
        if (soundMuted) {
            if (!ensureAudioContext()) {
                return;
            }
            setSoundMuted(false);
            playSound('toggle');
        } else {
            playSound('toggle');
            setSoundMuted(true);
        }
    });
}

SPEED_BUTTONS.forEach(button => {
    button.addEventListener('click', () => {
        const multiplier = Number(button.dataset.speed) || 1;
        setGameSpeed(multiplier);
        announce(`게임 속도 ${multiplier}배`);
    });
});

if (WAVE_APPLY_BUTTON && WAVE_INPUT) {
    const applyWaveFromInput = () => {
        const value = Number(WAVE_INPUT.value);
        if (!Number.isFinite(value)) {
            WAVE_INPUT.value = wave;
            return;
        }
        setWave(value);
    };
    WAVE_APPLY_BUTTON.addEventListener('click', applyWaveFromInput);
    WAVE_INPUT.addEventListener('change', applyWaveFromInput);
    WAVE_INPUT.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
            applyWaveFromInput();
        }
    });
}

if (GOLD_APPLY_BUTTON && GOLD_INPUT) {
    const applyGold = () => {
        const value = Number(GOLD_INPUT.value);
        if (!Number.isFinite(value)) {
            GOLD_INPUT.value = gold;
            return;
        }
        gold = Math.max(0, Math.min(999999, Math.floor(value)));
        updateGoldUI();
    };
    GOLD_APPLY_BUTTON.addEventListener('click', applyGold);
    GOLD_INPUT.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
            applyGold();
        }
    });
}

GOLD_ADJUST_BUTTONS.forEach(button => {
    button.addEventListener('click', () => {
        const delta = Number(button.dataset.delta) || 0;
        gold = Math.min(999999, Math.max(0, gold + delta));
        updateGoldUI();
    });
});

const UPGRADE_TOWER_BUTTON = document.getElementById('upgrade-tower-button');
if (UPGRADE_TOWER_BUTTON) {
    UPGRADE_TOWER_BUTTON.addEventListener('click', () => {
        if (selectedTower && !gameOver) {
            upgradeTower(selectedTower);
        }
    });
}

const SELL_TOWER_BUTTON = document.getElementById('sell-tower-button');
if (SELL_TOWER_BUTTON) {
    SELL_TOWER_BUTTON.addEventListener('click', () => {
        if (selectedTower) sellTower(selectedTower);
    });
}

if (RETRY_BUTTON) {
    RETRY_BUTTON.addEventListener('click', () => {
        hideDefeatDialog();
        resetGame();
        populateMapList();
        showMapSelectOverlay();
    });
}

if (CANCEL_RETRY_BUTTON) {
    CANCEL_RETRY_BUTTON.addEventListener('click', () => {
        hideDefeatDialog();
        showMapSelectOverlay();
    });
}

if (START_GAME_BUTTON) {
    START_GAME_BUTTON.addEventListener('click', () => {
        hideMapSelectOverlay();
        resetGame();
        buildStaticLayer();
        paused = false;
        startLoop();
    });
}

if (DEFEAT_OVERLAY) {
    DEFEAT_OVERLAY.addEventListener('click', event => {
        if (event.target === DEFEAT_OVERLAY) {
            hideDefeatDialog();
        }
    });

    DEFEAT_OVERLAY.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            event.preventDefault();
            hideDefeatDialog();
            return;
        }
        if (event.key !== 'Tab') return;
        const focusable = Array.from(
            DEFEAT_OVERLAY.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
        ).filter(el => !el.disabled);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey) {
            if (document.activeElement === first) {
                event.preventDefault();
                last.focus();
            }
        } else {
            if (document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        }
    });
}

if (MAP_SELECT_OVERLAY) {
    MAP_SELECT_OVERLAY.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            event.preventDefault();
            // 맵 선택은 필수 단계이므로 Escape 무시
            return;
        }
        if (event.key !== 'Tab') return;
        const focusable = Array.from(
            MAP_SELECT_OVERLAY.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
        ).filter(el => !el.disabled);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey) {
            if (document.activeElement === first) {
                event.preventDefault();
                last.focus();
            }
        } else {
            if (document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        }
    });
}

document.addEventListener("keydown", event => {
    const tag = event.target ? event.target.tagName : '';
    const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    const overlayOpen = (DEFEAT_OVERLAY && !DEFEAT_OVERLAY.classList.contains('hidden'))
        || (MAP_SELECT_OVERLAY && !MAP_SELECT_OVERLAY.classList.contains('hidden'));

    if (event.code === "Space") {
        if (lives === 0 || gameOver || overlayOpen) {
            return;
        }
        paused = !paused;
        renderDirty = true;
        announce(paused ? '일시 정지' : '게임 재개');
        event.preventDefault();
        return;
    }

    if ((event.key === 'u' || event.key === 'U') && !isInput) {
        if (selectedTower && !gameOver) {
            const success = upgradeTower(selectedTower);
            if (!success && selectedTower) {
                const cost = selectedTower.upgradeCost;
                if (cost != null && gold < cost) {
                    flashGoldInsufficient();
                }
            }
        }
        return;
    }

    if (!isInput && !overlayOpen) {
        switch (event.key) {
            case 'ArrowUp':    event.preventDefault(); moveKbCursor(0, -1); return;
            case 'ArrowDown':  event.preventDefault(); moveKbCursor(0, 1); return;
            case 'ArrowLeft':  event.preventDefault(); moveKbCursor(-1, 0); return;
            case 'ArrowRight': event.preventDefault(); moveKbCursor(1, 0); return;
            case 'Enter':      event.preventDefault(); activateKbCursor(event.shiftKey); return;
            case 's': case 'S':
                if (selectedTower && !gameOver) sellTower(selectedTower);
                return;
            case 'Escape':
                kbCursorActive = false;
                kbCursor = null;
                hoverTile = null;
                hideAllStats();
                renderDirty = true;
                return;
        }
    }
});

let elapsedTime = 0;
let lastTime = performance.now();
let rafHandle = 0;
let loopErrorCount = 0;
let renderDirty = true;
function markRenderDirty() { renderDirty = true; }
const MAX_LOOP_ERRORS = 10;
function loop(timestamp) {
    try {
        const rawDt = (timestamp - lastTime) / 1000;
        const dt = Math.min(rawDt, 0.1);
        lastTime = timestamp;
        if (!paused) {
            const scaledDt = dt * gameSpeed;
            elapsedTime += scaledDt;
            update(scaledDt);
            render();
        } else if (renderDirty) {
            render();
            renderDirty = false;
        }
        loopErrorCount = 0;
    } catch (e) {
        console.error('Game loop error:', e.message || e);
        loopErrorCount++;
        if (loopErrorCount >= MAX_LOOP_ERRORS) {
            console.error('Game loop halted after repeated errors.');
            gameLoopHalted = true;
            announce('게임에 오류가 발생했습니다. 페이지를 새로고침 해주세요.');
            try { render(); } catch (_) {}
            return;
        }
    }
    rafHandle = requestAnimationFrame(loop);
}

function stopLoop() {
    if (rafHandle) {
        cancelAnimationFrame(rafHandle);
        rafHandle = 0;
    }
}

function startLoop() {
    stopLoop();
    loopErrorCount = 0;
    lastTime = performance.now();
    rafHandle = requestAnimationFrame(loop);
}

updateSpeedControls();
updateWavePreview();
updateGoldUI();
if (WAVE_INPUT) {
    WAVE_INPUT.value = wave;
}

populateMapList();
showMapSelectOverlay();

if (typeof module !== 'undefined') {
    module.exports = {
        calculateTowerDamage, calculateUpgradeCost, getWaveEnemyCount, getWaveEnemyStats,
        applyExplosion, sellTower, hexToRgba, applyAlpha, enemies, towers, gold: () => gold,
        canBuildAt, findTarget, createTowerData, upgradeTower, damageEnemy, damageEnemyAtIndex,
        pickEnemyType, pathTiles, ENEMY_TYPE_DEFINITIONS, ENEMY_TYPE_MAP, GRID_COLS, GRID_ROWS, TOWER_MAX_LEVEL,
        projectiles,
        setGameSpeed,
        getGameSpeed: () => gameSpeed,
        setGold: (v) => {
            if (typeof v !== 'number' || !Number.isFinite(v)) return;
            gold = Math.max(0, Math.min(999999, Math.floor(v)));
        },
        getGameOver: () => gameOver,
        setGameOver: (v) => { gameOver = v; },
        getEnemiesToSpawn: () => enemiesToSpawn,
        setEnemiesToSpawn: (v) => { enemiesToSpawn = v; },
        lerpAngle,
        resetGame,
        buildStaticLayer,
        buildMapData,
        startWave,
        handleLaserAttack,
        initKbCursor, moveKbCursor, activateKbCursor,
        getKbCursor: () => kbCursor,
        getKbCursorActive: () => kbCursorActive,
        getWaypoints: () => waypoints,
        getWave: () => wave,
        getLives: () => lives,
        getNextWaveTimer: () => nextWaveTimer,
        getWaveInProgress: () => waveInProgress,
        setWaveInProgress: (v) => { waveInProgress = v; },
        setNextWaveTimer: (v) => { nextWaveTimer = v; },
        setWave: (v) => {
            if (typeof v !== 'number' || !Number.isFinite(v)) return;
            wave = Math.max(1, Math.min(WAVE_MAX, Math.floor(v)));
        },
        setLives: (v) => {
            if (typeof v !== 'number' || !Number.isFinite(v)) return;
            lives = Math.max(0, Math.floor(v));
        },
        getPrefersReducedMotion: () => prefersReducedMotion,
        update,
        spawnEnemy,
        handlePointerDown,
        getPaused: () => paused,
        setPaused: (v) => { paused = !!v; },
        getGameSpeed: () => gameSpeed,
        getAdjustedPickRadius,
        getGameLoopHalted: () => gameLoopHalted,
        towerPositionSet,
        markRenderDirty,
        getRenderDirty: () => renderDirty
    };
}




