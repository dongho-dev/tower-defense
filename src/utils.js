import {
    TILE_SIZE,
    TOWER_DAMAGE_GROWTH,
    TOWER_UPGRADE_BASE_COST,
    TOWER_UPGRADE_COST_MULTIPLIER,
    TOWER_MAX_LEVEL,
    DEFAULT_TOWER_TYPE,
    NUMBER_FORMAT,
    ENEMY_BASE_HP,
    ENEMY_HP_GROWTH_RATE,
    ENEMY_SPEED,
    ENEMY_BASE_REWARD
} from './constants.js';
import { TOWER_TYPES } from './data/towerTypes.js';

export function gridFromPosition(point) {
    return {
        x: Math.floor(point.x / TILE_SIZE),
        y: Math.floor(point.y / TILE_SIZE)
    };
}

export function keyFromGrid(x, y) {
    return `${x},${y}`;
}

export function getTowerDefinition(id) {
    return TOWER_TYPES[id] || TOWER_TYPES[DEFAULT_TOWER_TYPE];
}

export function getTowerColor(definition, level) {
    const colors = definition.levelColors || [];
    return colors[Math.min(colors.length - 1, Math.max(0, level - 1))] || "#6296ff";
}

export function getProjectileColor(definition, level) {
    const colors = definition.projectileColors || [];
    return colors[Math.min(colors.length - 1, Math.max(0, level - 1))] || "#ffd966";
}

export function hexToRgba(hex, alpha) {
    if (!hex) {
        return `rgba(255, 255, 255, ${alpha})`;
    }
    const sanitized = hex.replace('#', '');
    const normalized = sanitized.length === 3 ? sanitized.split('').map(ch => ch + ch).join('') : sanitized.padEnd(6, '0');
    const value = parseInt(normalized, 16);
    const r = (value >> 16) & 255;
    const g = (value >> 8) & 255;
    const b = value & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function applyAlpha(color, alpha) {
    if (!color) {
        return `rgba(255, 255, 255, ${alpha})`;
    }
    if (color.startsWith('#')) {
        return hexToRgba(color, alpha);
    }
    if (color.startsWith('rgba')) {
        return color.replace(/rgba\(([^)]+)\)/, (_, inner) => {
            const parts = inner.split(',').map(part => part.trim());
            if (parts.length < 3) {
                return color;
            }
            return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
        });
    }
    if (color.startsWith('rgb')) {
        return color.replace(/rgb\(([^)]+)\)/, (_, inner) => `rgba(${inner}, ${alpha})`);
    }
    return color;
}

export function lerpAngle(current, target, t) {
    const twoPi = Math.PI * 2;
    let delta = (target - current) % twoPi;
    if (delta > Math.PI) {
        delta -= twoPi;
    } else if (delta < -Math.PI) {
        delta += twoPi;
    }
    return current + delta * t;
}

export function formatNumber(value) {
    if (!Number.isFinite(value)) {
        return "-";
    }
    if (Math.abs(value) < 1000) {
        return Number.isInteger(value) ? `${value}` : value.toFixed(2);
    }
    return NUMBER_FORMAT.format(Math.round(value));
}

export function calculateTowerDamage(definition, level) {
    return parseFloat((definition.baseDamage * Math.pow(TOWER_DAMAGE_GROWTH, level - 1)).toFixed(4));
}

export function calculateUpgradeCost(definition, level) {
    const base = definition.baseUpgradeCost ?? TOWER_UPGRADE_BASE_COST;
    return Math.round(base * Math.pow(TOWER_UPGRADE_COST_MULTIPLIER, level - 1));
}

export function recalcTowerStats(tower) {
    const def = getTowerDefinition(tower.type);
    tower.range = def.range;
    tower.fireDelay = def.fireDelay;
    tower.damage = calculateTowerDamage(def, tower.level);
    tower.upgradeCost = tower.level >= TOWER_MAX_LEVEL ? null : calculateUpgradeCost(def, tower.level);
}

export function ensureTowerMetadata(tower) {
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

export function getWaveEnemyCount(waveNumber) {
    return 8 + Math.floor(waveNumber * 1.5);
}

export function getWaveEnemyStats(waveNumber) {
    const growth = Math.pow(ENEMY_HP_GROWTH_RATE, Math.max(0, waveNumber - 1));
    const hp = Math.round(ENEMY_BASE_HP * growth);
    const speed = ENEMY_SPEED;
    const reward = ENEMY_BASE_REWARD;
    const count = getWaveEnemyCount(waveNumber);
    return { hp, speed, reward, count };
}
