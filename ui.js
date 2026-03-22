const towers = [];
const towerPositionSet = new Set();
const enemies = [];
const projectiles = [];
const impactEffects = [];
const muzzleFlashes = [];

let kbCursor = null;
let kbCursorActive = false;
let _longPressTimer = null;
let _longPressFired = false;
let _touchStartX = 0;
let _touchStartY = 0;
const LONG_PRESS_DURATION = 500;
const LONG_PRESS_MOVE_THRESHOLD = 10;

const NUMBER_FORMAT = new Intl.NumberFormat('ko-KR');

const GOLD_LABEL = document.getElementById('gold');
const LIVES_LABEL = document.getElementById('lives');
const WAVE_LABEL = document.getElementById('wave');
const GOLD_INPUT = document.getElementById('gold-input');
const GOLD_APPLY_BUTTON = document.getElementById('gold-apply');
const GOLD_ADJUST_BUTTONS = Array.from(document.querySelectorAll('.gold-adjust'));

const TOWER_STATS_PANEL = document.getElementById('tower-stats');
const ENEMY_STATS_PANEL = document.getElementById('enemy-stats');
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
    enemyType: ENEMY_STATS_PANEL ? ENEMY_STATS_PANEL.querySelector('[data-field="enemy-type"]') : null,
    wave: ENEMY_STATS_PANEL ? ENEMY_STATS_PANEL.querySelector('[data-field="enemy-wave"]') : null,
    hp: ENEMY_STATS_PANEL ? ENEMY_STATS_PANEL.querySelector('[data-field="enemy-hp"]') : null,
    speed: ENEMY_STATS_PANEL ? ENEMY_STATS_PANEL.querySelector('[data-field="enemy-speed"]') : null,
    reward: ENEMY_STATS_PANEL ? ENEMY_STATS_PANEL.querySelector('[data-field="enemy-reward"]') : null
};

const SPEED_BUTTONS = Array.from(document.querySelectorAll('.speed-button'));
const WAVE_INPUT = document.getElementById('wave-input');
const WAVE_APPLY_BUTTON = document.getElementById('wave-apply');
const WAVE_PREVIEW_PANEL = document.getElementById('wave-preview');
const WAVE_PREVIEW_FIELDS = WAVE_PREVIEW_PANEL
    ? {
          status: WAVE_PREVIEW_PANEL.querySelector('[data-field="preview-status"]'),
          countdown: WAVE_PREVIEW_PANEL.querySelector('[data-field="preview-countdown"]'),
          wave: WAVE_PREVIEW_PANEL.querySelector('[data-field="preview-wave"]'),
          composition: WAVE_PREVIEW_PANEL.querySelector('[data-field="preview-composition"]'),
          remaining: WAVE_PREVIEW_PANEL.querySelector('[data-field="preview-remaining"]'),
          hp: WAVE_PREVIEW_PANEL.querySelector('[data-field="preview-hp"]'),
          speed: WAVE_PREVIEW_PANEL.querySelector('[data-field="preview-speed"]'),
          reward: WAVE_PREVIEW_PANEL.querySelector('[data-field="preview-reward"]')
      }
    : null;

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
const VOLUME_SLIDER = document.getElementById('volume-slider');
const A11Y_ANNOUNCER = document.getElementById('a11y-announcer');
const SELECTED_TOWER_INDICATOR = document.getElementById('selected-tower-indicator');
const UPGRADE_TOWER_BUTTON = document.getElementById('upgrade-tower-button');
const SELL_TOWER_BUTTON = document.getElementById('sell-tower-button');
const TARGET_PRIORITY_SELECT = document.getElementById('target-priority-select');
const SEND_NEXT_WAVE_BUTTON = document.getElementById('send-next-wave');

if (TARGET_PRIORITY_SELECT) {
    TARGET_PRIORITIES.forEach((p) => {
        const option = document.createElement('option');
        option.value = p.key;
        option.textContent = p.label;
        TARGET_PRIORITY_SELECT.appendChild(option);
    });
    TARGET_PRIORITY_SELECT.addEventListener('change', () => {
        if (gameState.selectedTower) {
            gameState.selectedTower.targetPriority = TARGET_PRIORITY_SELECT.value;
        }
    });
}

const announceQueue = [];
let announceProcessing = false;

function processAnnounceQueue() {
    if (announceQueue.length === 0) {
        announceProcessing = false;
        return;
    }
    announceProcessing = true;
    const msg = announceQueue.shift();
    A11Y_ANNOUNCER.textContent = '';
    requestAnimationFrame(() => {
        A11Y_ANNOUNCER.textContent = msg;
        setTimeout(processAnnounceQueue, 100);
    });
}

function announce(message) {
    if (!A11Y_ANNOUNCER) return;
    announceQueue.push(message);
    if (!announceProcessing) {
        processAnnounceQueue();
    }
}

function updateGoldUI() {
    if (GOLD_LABEL) {
        GOLD_LABEL.textContent = gameState.gold;
    }
    if (GOLD_INPUT) {
        GOLD_INPUT.value = gameState.gold;
    }
}

function hideTowerStats() {
    if (!TOWER_STATS_PANEL) {
        return;
    }
    gameState.selectedTower = null;
    TOWER_STATS_PANEL.classList.add('hidden');
}

function hideEnemyStats() {
    if (!ENEMY_STATS_PANEL) {
        return;
    }
    gameState.selectedEnemy = null;
    ENEMY_STATS_PANEL.classList.add('hidden');
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
        const dps = def.attackPattern === 'laser' ? baseDamage * (def.sustainMultiplier || 1) : baseDamage / fireDelay;
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
            if (gameState.selectedTowerType === id) {
                return;
            }
            gameState.selectedTowerType = id;
            setSelectedTowerButton(id);
            playSound('select');
        });
        TOWER_LIST_CONTAINER.appendChild(button);
        TOWER_SELECTOR_BUTTONS.push(button);
    }
    setSelectedTowerButton(gameState.selectedTowerType);
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
    const stats = getWaveEnemyStats(gameState.wave);
    const remaining = typeof remainingOverride === 'number' ? Math.max(0, Math.ceil(remainingOverride)) : stats.count;
    let status;
    if (gameState.gameOver) {
        status = '패배';
    } else if (gameState.waveInProgress) {
        status = '전투 중';
    } else if (gameState.nextWaveTimer > 0) {
        status = '휴식';
    } else {
        status = '대기';
    }
    setTextIfChanged(WAVE_PREVIEW_FIELDS.status, status);

    if (WAVE_PREVIEW_FIELDS.countdown) {
        let countdownText;
        if (gameState.nextWaveTimer > 0 && !gameState.waveInProgress && !gameState.gameOver) {
            countdownText = Math.ceil(gameState.nextWaveTimer) + '초';
        } else {
            countdownText = '-';
        }
        setTextIfChanged(WAVE_PREVIEW_FIELDS.countdown, countdownText);
    }

    setTextIfChanged(WAVE_PREVIEW_FIELDS.wave, '' + gameState.wave);

    if (WAVE_PREVIEW_FIELDS.composition) {
        const composition = getWaveEnemyComposition(gameState.wave);
        const compositionText = composition.map((c) => c.type.label + ' ' + c.percent + '%').join(' / ');
        setTextIfChanged(WAVE_PREVIEW_FIELDS.composition, compositionText);
    }

    setTextIfChanged(WAVE_PREVIEW_FIELDS.remaining, '' + remaining);
    setTextIfChanged(WAVE_PREVIEW_FIELDS.hp, '' + stats.hp);
    setTextIfChanged(WAVE_PREVIEW_FIELDS.speed, `${(stats.speed / TILE_SIZE).toFixed(2)} 타일/초`);
    setTextIfChanged(WAVE_PREVIEW_FIELDS.reward, '' + stats.reward);

    if (SEND_NEXT_WAVE_BUTTON) {
        const showButton = !gameState.gameOver && !gameState.waveInProgress && gameState.nextWaveTimer > 0;
        SEND_NEXT_WAVE_BUTTON.classList.toggle('hidden', !showButton);
    }
}

function updateSpeedControls() {
    if (SPEED_BUTTONS.length === 0) {
        return;
    }
    for (const button of SPEED_BUTTONS) {
        const value = Number(button.dataset.speed) || 1;
        const isActive = value === gameState.gameSpeed;
        button.classList.toggle('active', isActive);
        button.setAttribute('aria-pressed', String(isActive));
    }
}

function setGameSpeed(multiplier) {
    if (!Number.isFinite(multiplier) || multiplier <= 0) {
        multiplier = 1;
    }
    multiplier = Math.min(multiplier, 5);
    gameState.gameSpeed = multiplier;
    updateSpeedControls();
}

function setTextIfChanged(el, text) {
    if (el && el.textContent !== text) el.textContent = text;
}

function updateTowerStatsFields() {
    if (!gameState.selectedTower || !TOWER_STATS_PANEL) {
        return;
    }
    if (!towers.includes(gameState.selectedTower)) {
        hideTowerStats();
        return;
    }
    ensureTowerMetadata(gameState.selectedTower);
    const def = getTowerDefinition(gameState.selectedTower.type);
    setTextIfChanged(TOWER_STATS_FIELDS.type, def.label);
    setTextIfChanged(TOWER_STATS_FIELDS.position, `${gameState.selectedTower.x}, ${gameState.selectedTower.y}`);
    const level = gameState.selectedTower.level;
    const atMax = level >= TOWER_MAX_LEVEL;
    if (TOWER_STATS_FIELDS.range) {
        const currentRange = gameState.selectedTower.range;
        const tiles = (currentRange / TILE_SIZE).toFixed(1);
        let text = `${Math.round(currentRange)}px (${tiles}타일)`;
        if (!atMax) {
            const nextRange = def.range + (def.rangeGrowth || 0) * level;
            const nextTiles = (nextRange / TILE_SIZE).toFixed(1);
            text += ` → ${Math.round(nextRange)}px (${nextTiles}타일)`;
        }
        setTextIfChanged(TOWER_STATS_FIELDS.range, text);
    }
    if (TOWER_STATS_FIELDS.fireDelay) {
        if (def.attackPattern === 'laser') {
            const currentDps = (gameState.selectedTower.damage * (def.sustainMultiplier || 1)).toFixed(1);
            let text = `지속 (${currentDps} DPS)`;
            if (!atMax) {
                const nextDamage = calculateTowerDamage(def, level + 1);
                const nextDps = (nextDamage * (def.sustainMultiplier || 1)).toFixed(1);
                text += ` → ${nextDps} DPS`;
            }
            setTextIfChanged(TOWER_STATS_FIELDS.fireDelay, text);
        } else {
            const currentDelay = gameState.selectedTower.fireDelay.toFixed(2);
            let text = `${currentDelay}초`;
            if (!atMax) {
                const nextDelay = Math.max(def.fireDelay + (def.fireDelayGrowth || 0) * level, 0.05).toFixed(2);
                text += ` → ${nextDelay}초`;
            }
            setTextIfChanged(TOWER_STATS_FIELDS.fireDelay, text);
        }
    }
    {
        let dmgText = formatNumber(gameState.selectedTower.damage);
        if (!atMax) {
            const nextDamage = calculateTowerDamage(def, level + 1);
            dmgText += ` → ${formatNumber(nextDamage)}`;
        }
        setTextIfChanged(TOWER_STATS_FIELDS.damage, dmgText);
    }
    setTextIfChanged(TOWER_STATS_FIELDS.level, '' + gameState.selectedTower.level);
    if (TOWER_STATS_FIELDS.upgradeCost) {
        const cost = gameState.selectedTower.upgradeCost;
        setTextIfChanged(TOWER_STATS_FIELDS.upgradeCost, cost == null ? 'MAX' : formatNumber(cost));
    }
    if (UPGRADE_TOWER_BUTTON) {
        const atMax = gameState.selectedTower.upgradeCost == null;
        UPGRADE_TOWER_BUTTON.disabled = atMax || gameState.gameOver;
        const label = atMax ? '최대 레벨' : `업그레이드 (${formatNumber(gameState.selectedTower.upgradeCost)}G)`;
        setTextIfChanged(UPGRADE_TOWER_BUTTON, label);
        UPGRADE_TOWER_BUTTON.setAttribute('aria-label', label);
    }
    if (TOWER_STATS_FIELDS.sellRefund) {
        const refund = Math.floor((gameState.selectedTower.spentGold || 0) * TOWER_SELL_REFUND_RATE);
        setTextIfChanged(TOWER_STATS_FIELDS.sellRefund, formatNumber(refund));
    }
    if (SELL_TOWER_BUTTON) {
        const refund = Math.floor((gameState.selectedTower.spentGold || 0) * TOWER_SELL_REFUND_RATE);
        SELL_TOWER_BUTTON.setAttribute('aria-label', `판매 (${refund}G 환급)`);
    }
    if (TARGET_PRIORITY_SELECT) {
        const currentPriority = gameState.selectedTower.targetPriority || 'first';
        if (TARGET_PRIORITY_SELECT.value !== currentPriority) {
            TARGET_PRIORITY_SELECT.value = currentPriority;
        }
    }
}

function updateEnemyStatsFields() {
    if (!gameState.selectedEnemy || !ENEMY_STATS_PANEL) {
        return;
    }
    if (!enemies.includes(gameState.selectedEnemy)) {
        hideEnemyStats();
        return;
    }
    if (ENEMY_STATS_FIELDS.enemyType) {
        const typeName = (gameState.selectedEnemy.enemyType || ENEMY_TYPE_DEFINITIONS[0]).label;
        setTextIfChanged(ENEMY_STATS_FIELDS.enemyType, typeName);
    }
    const currentHp = Math.max(0, Math.ceil(gameState.selectedEnemy.hp));
    const maxHp = Math.max(0, Math.ceil(gameState.selectedEnemy.maxHp));
    const waveIndex =
        typeof gameState.selectedEnemy.waveIndex === 'number' ? gameState.selectedEnemy.waveIndex : gameState.wave;
    setTextIfChanged(ENEMY_STATS_FIELDS.wave, '' + waveIndex);
    setTextIfChanged(ENEMY_STATS_FIELDS.hp, `${NUMBER_FORMAT.format(currentHp)} / ${NUMBER_FORMAT.format(maxHp)}`);
    setTextIfChanged(ENEMY_STATS_FIELDS.speed, `${(gameState.selectedEnemy.speed / TILE_SIZE).toFixed(2)} 타일/초`);
    setTextIfChanged(ENEMY_STATS_FIELDS.reward, `${gameState.selectedEnemy.reward}`);
}

// ── EventBus listeners ──────────────────────────────────────────────────────
EventBus.on('gold:changed', updateGoldUI);
EventBus.on('wave:changed', function (data) {
    updateWavePreview(data != null ? data.remaining : undefined);
});
EventBus.on('tower:selected', updateTowerStatsFields);
EventBus.on('enemy:selected', updateEnemyStatsFields);
