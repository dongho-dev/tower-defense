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
    return getColorFromArray(definition.levelColors, level, '#6296ff');
}

function getProjectileColor(definition, level) {
    return getColorFromArray(definition.projectileColors, level, '#ffd966');
}

function hexToRgba(hex, alpha) {
    if (!hex) {
        return `rgba(255, 255, 255, ${alpha})`;
    }
    const sanitized = hex.replace('#', '');
    let normalized;
    if (sanitized.length === 3) {
        normalized = sanitized
            .split('')
            .map((ch) => ch + ch)
            .join('');
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
    if (cached !== undefined) {
        alphaCache.delete(key);
        alphaCache.set(key, cached);
        return cached;
    }

    let result;
    if (color.startsWith('#')) {
        result = hexToRgba(color, alpha);
    } else if (color.startsWith('rgba')) {
        result = color.replace(/rgba\(([^)]+)\)/, (_, inner) => {
            const parts = inner.split(',').map((part) => part.trim());
            if (parts.length < 3) return color;
            return 'rgba(' + parts[0] + ', ' + parts[1] + ', ' + parts[2] + ', ' + alpha + ')';
        });
    } else if (color.startsWith('rgb')) {
        result = color.replace(/rgb\(([^)]+)\)/, (_, inner) => 'rgba(' + inner + ', ' + alpha + ')');
    } else {
        result = color;
    }

    if (alphaCache.size >= ALPHA_CACHE_MAX) {
        const keys = Array.from(alphaCache.keys()).slice(0, 128);
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
        return '-';
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
    tower.range = def.range + (def.rangeGrowth || 0) * (tower.level - 1);
    tower.fireDelay = Math.max(def.fireDelay + (def.fireDelayGrowth || 0) * (tower.level - 1), 0.05);
    tower.damage = calculateTowerDamage(def, tower.level);
    tower.upgradeCost = tower.level >= TOWER_MAX_LEVEL ? null : calculateUpgradeCost(def, tower.level);
}
