import { TILE_SIZE, TOWER_MAX_LEVEL, DEFAULT_TOWER_TYPE, AUTOCOLLAPSE_WIDTH } from './constants.js';
import { state } from './state.js';
import {
    formatNumber,
    getTowerDefinition,
    ensureTowerMetadata,
    getWaveEnemyStats,
    recalcTowerStats
} from './utils.js';
import { TOWER_TYPES, TOWER_ORDER } from './data/towerTypes.js';
import { playSound } from './audio.js';

export const GOLD_LABEL = document.getElementById("gold");
export const LIVES_LABEL = document.getElementById("lives");
export const WAVE_LABEL = document.getElementById("wave");
export const GOLD_INPUT = document.getElementById("gold-input");
export const GOLD_APPLY_BUTTON = document.getElementById("gold-apply");
export const GOLD_ADJUST_BUTTONS = Array.from(document.querySelectorAll('.gold-adjust'));

const TOWER_STATS_PANEL = document.getElementById("tower-stats");
const ENEMY_STATS_PANEL = document.getElementById("enemy-stats");
const TOWER_STATS_FIELDS = {
    type: TOWER_STATS_PANEL ? TOWER_STATS_PANEL.querySelector('[data-field="tower-type"]') : null,
    position: TOWER_STATS_PANEL ? TOWER_STATS_PANEL.querySelector('[data-field="tower-position"]') : null,
    range: TOWER_STATS_PANEL ? TOWER_STATS_PANEL.querySelector('[data-field="tower-range"]') : null,
    fireDelay: TOWER_STATS_PANEL ? TOWER_STATS_PANEL.querySelector('[data-field="tower-fire-delay"]') : null,
    damage: TOWER_STATS_PANEL ? TOWER_STATS_PANEL.querySelector('[data-field="tower-damage"]') : null,
    level: TOWER_STATS_PANEL ? TOWER_STATS_PANEL.querySelector('[data-field="tower-level"]') : null,
    upgradeCost: TOWER_STATS_PANEL ? TOWER_STATS_PANEL.querySelector('[data-field="tower-upgrade-cost"]') : null
};
const ENEMY_STATS_FIELDS = {
    wave: ENEMY_STATS_PANEL ? ENEMY_STATS_PANEL.querySelector('[data-field="enemy-wave"]') : null,
    hp: ENEMY_STATS_PANEL ? ENEMY_STATS_PANEL.querySelector('[data-field="enemy-hp"]') : null,
    speed: ENEMY_STATS_PANEL ? ENEMY_STATS_PANEL.querySelector('[data-field="enemy-speed"]') : null,
    reward: ENEMY_STATS_PANEL ? ENEMY_STATS_PANEL.querySelector('[data-field="enemy-reward"]') : null
};

export const SPEED_BUTTONS = Array.from(document.querySelectorAll('.speed-button'));
export const WAVE_INPUT = document.getElementById('wave-input');
export const WAVE_APPLY_BUTTON = document.getElementById('wave-apply');
const WAVE_PREVIEW_PANEL = document.getElementById('wave-preview');
const WAVE_PREVIEW_FIELDS = WAVE_PREVIEW_PANEL ? {
    status: WAVE_PREVIEW_PANEL.querySelector('[data-field="preview-status"]'),
    wave: WAVE_PREVIEW_PANEL.querySelector('[data-field="preview-wave"]'),
    remaining: WAVE_PREVIEW_PANEL.querySelector('[data-field="preview-remaining"]'),
    hp: WAVE_PREVIEW_PANEL.querySelector('[data-field="preview-hp"]'),
    speed: WAVE_PREVIEW_PANEL.querySelector('[data-field="preview-speed"]'),
    reward: WAVE_PREVIEW_PANEL.querySelector('[data-field="preview-reward"]')
} : null;

export const DEFEAT_OVERLAY = document.getElementById('defeat-overlay');
export const RETRY_BUTTON = document.getElementById('retry-button');
export const CANCEL_RETRY_BUTTON = document.getElementById('cancel-retry-button');
export const BUILD_CONTAINER = document.querySelector('.build-shell');
export const BUILD_TOGGLE = document.getElementById('build-toggle');
const TOWER_LIST_CONTAINER = document.getElementById('tower-list');

export function updateGoldUI() {
    if (GOLD_LABEL) {
        GOLD_LABEL.textContent = state.gold;
    }
    if (GOLD_INPUT) {
        GOLD_INPUT.value = state.gold;
    }
}

export function hideTowerStats() {
    if (!TOWER_STATS_PANEL) {
        return;
    }
    state.selectedTower = null;
    TOWER_STATS_PANEL.classList.add("hidden");
}

export function hideEnemyStats() {
    if (!ENEMY_STATS_PANEL) {
        return;
    }
    state.selectedEnemy = null;
    ENEMY_STATS_PANEL.classList.add("hidden");
}

export function hideAllStats() {
    hideTowerStats();
    hideEnemyStats();
}

export function setSelectedTowerButton(typeId) {
    if (!state.TOWER_SELECTOR_BUTTONS || state.TOWER_SELECTOR_BUTTONS.length === 0) {
        return;
    }
    for (const button of state.TOWER_SELECTOR_BUTTONS) {
        const isSelected = button.dataset.tower === typeId;
        button.classList.toggle('selected', isSelected);
        button.classList.toggle('active', isSelected);
        button.setAttribute('aria-pressed', String(isSelected));
    }
}

export function populateTowerList() {
    if (!TOWER_LIST_CONTAINER) {
        return;
    }
    TOWER_LIST_CONTAINER.innerHTML = '';
    const order = Array.isArray(TOWER_ORDER) ? TOWER_ORDER : Object.keys(TOWER_TYPES);
    state.TOWER_SELECTOR_BUTTONS = [];
    for (const id of order) {
        const def = getTowerDefinition(id);
        if (!def) {
            continue;
        }
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'tower-card tower-button';
        button.dataset.tower = id;
        button.setAttribute('role', 'radio');
        button.setAttribute('aria-pressed', 'false');
        const cost = typeof def.cost === 'number' ? def.cost : 0;
        const range = typeof def.range === 'number' ? def.range : 0;
        const baseDamage = typeof def.baseDamage === 'number' ? def.baseDamage : 0;
        const fireDelay = typeof def.fireDelay === 'number' && def.fireDelay > 0 ? def.fireDelay : 1;
        const dps = baseDamage / fireDelay;
        button.innerHTML = `
            <span class="tower-name">${def.label}</span>
            <span class="tower-meta">
                <span>비용 ${formatNumber(cost)}</span>
                <span>사거리 ${Math.round(range)}px</span>
                <span>DPS ${formatNumber(Number(dps.toFixed(1)))}</span>
            </span>
        `;
        button.addEventListener('click', () => {
            if (state.selectedTowerType === id) {
                return;
            }
            state.selectedTowerType = id;
            setSelectedTowerButton(id);
            playSound('select');
        });
        TOWER_LIST_CONTAINER.appendChild(button);
        state.TOWER_SELECTOR_BUTTONS.push(button);
    }
    setSelectedTowerButton(state.selectedTowerType);
}

export function setBuildPanelCollapsed(collapsed, options = {}) {
    if (!BUILD_CONTAINER) {
        return;
    }
    state.buildPanelCollapsed = collapsed;
    if (options.user) {
        state.buildPanelUserOverride = true;
    }
    BUILD_CONTAINER.classList.toggle('collapsed', collapsed);
    if (BUILD_TOGGLE) {
        BUILD_TOGGLE.setAttribute('aria-expanded', String(!collapsed));
        BUILD_TOGGLE.innerHTML = collapsed ? '▶' : '◀';
        BUILD_TOGGLE.setAttribute('title', collapsed ? '포탑 패널 펼치기' : '포탑 패널 접기');
    }
}

export function updateWavePreview(remainingOverride) {
    if (!WAVE_PREVIEW_FIELDS) {
        return;
    }
    const stats = getWaveEnemyStats(state.wave);
    const remaining = typeof remainingOverride === 'number' ? Math.max(0, Math.ceil(remainingOverride)) : stats.count;
    let status;
    if (state.gameOver) {
        status = '패배';
    } else if (state.waveInProgress) {
        status = '전투 중';
    } else if (state.nextWaveTimer > 0) {
        status = '휴식';
    } else {
        status = '대기';
    }
    WAVE_PREVIEW_FIELDS.status.textContent = status;
    WAVE_PREVIEW_FIELDS.wave.textContent = state.wave;
    WAVE_PREVIEW_FIELDS.remaining.textContent = remaining;
    WAVE_PREVIEW_FIELDS.hp.textContent = stats.hp;
    WAVE_PREVIEW_FIELDS.speed.textContent = `${(stats.speed / TILE_SIZE).toFixed(2)} 타일/초`;
    WAVE_PREVIEW_FIELDS.reward.textContent = stats.reward;
}

export function updateSpeedControls() {
    if (SPEED_BUTTONS.length === 0) {
        return;
    }
    for (const button of SPEED_BUTTONS) {
        const value = Number(button.dataset.speed) || 1;
        button.classList.toggle('active', value === state.gameSpeed);
    }
}

export function setGameSpeed(multiplier) {
    if (!Number.isFinite(multiplier) || multiplier <= 0) {
        multiplier = 1;
    }
    state.gameSpeed = multiplier;
    updateSpeedControls();
}

export function updateTowerStatsFields() {
    if (!state.selectedTower || !TOWER_STATS_PANEL) {
        return;
    }
    ensureTowerMetadata(state.selectedTower);
    const def = getTowerDefinition(state.selectedTower.type);
    if (TOWER_STATS_FIELDS.type) {
        TOWER_STATS_FIELDS.type.textContent = def.label;
    }
    if (TOWER_STATS_FIELDS.position) {
        TOWER_STATS_FIELDS.position.textContent = `${state.selectedTower.x}, ${state.selectedTower.y}`;
    }
    if (TOWER_STATS_FIELDS.range) {
        const tiles = (state.selectedTower.range / TILE_SIZE).toFixed(1);
        TOWER_STATS_FIELDS.range.textContent = `${Math.round(state.selectedTower.range)}px (${tiles}타일)`;
    }
    if (TOWER_STATS_FIELDS.fireDelay) {
        TOWER_STATS_FIELDS.fireDelay.textContent = `${state.selectedTower.fireDelay.toFixed(2)}초`;
    }
    if (TOWER_STATS_FIELDS.damage) {
        TOWER_STATS_FIELDS.damage.textContent = formatNumber(state.selectedTower.damage);
    }
    if (TOWER_STATS_FIELDS.level) {
        TOWER_STATS_FIELDS.level.textContent = state.selectedTower.level;
    }
    if (TOWER_STATS_FIELDS.upgradeCost) {
        const cost = state.selectedTower.upgradeCost;
        TOWER_STATS_FIELDS.upgradeCost.textContent = cost == null ? 'MAX' : formatNumber(cost);
    }
}

export function updateEnemyStatsFields() {
    if (!state.selectedEnemy || !ENEMY_STATS_PANEL) {
        return;
    }
    const currentHp = Math.max(0, Math.ceil(state.selectedEnemy.hp));
    const maxHp = Math.max(0, Math.ceil(state.selectedEnemy.maxHp));
    const waveIndex = typeof state.selectedEnemy.waveIndex === "number" ? state.selectedEnemy.waveIndex : state.wave;
    if (ENEMY_STATS_FIELDS.wave) {
        ENEMY_STATS_FIELDS.wave.textContent = waveIndex;
    }
    if (ENEMY_STATS_FIELDS.hp) {
        ENEMY_STATS_FIELDS.hp.textContent = `${currentHp.toLocaleString('ko-KR')} / ${maxHp.toLocaleString('ko-KR')}`;
    }
    if (ENEMY_STATS_FIELDS.speed) {
        ENEMY_STATS_FIELDS.speed.textContent = `${(state.selectedEnemy.speed / TILE_SIZE).toFixed(2)} 타일/초`;
    }
    if (ENEMY_STATS_FIELDS.reward) {
        ENEMY_STATS_FIELDS.reward.textContent = `${state.selectedEnemy.reward}`;
    }
}

export function showTowerStats(tower) {
    if (!tower || !TOWER_STATS_PANEL) {
        return;
    }
    ensureTowerMetadata(tower);
    state.selectedTower = tower;
    TOWER_STATS_PANEL.classList.remove("hidden");
    updateTowerStatsFields();
}

export function showEnemyStats(enemy) {
    if (!enemy || !ENEMY_STATS_PANEL) {
        return;
    }
    state.selectedEnemy = enemy;
    ENEMY_STATS_PANEL.classList.remove("hidden");
    updateEnemyStatsFields();
}

export function hideDefeatDialog() {
    if (!DEFEAT_OVERLAY) {
        return;
    }
    DEFEAT_OVERLAY.classList.add('hidden');
}
