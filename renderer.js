function drawGrid(targetCtx) {
    const c = targetCtx || ctx;
    c.save();
    c.strokeStyle = '#2a333d';
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
    c.fillStyle = '#3b4637';
    pathTiles.forEach((key) => {
        const [gx, gy] = key.split(',').map(Number);
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
        const angle = (Math.PI / 3) * i + Math.PI / 6;
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

function renderTurret(
    x,
    y,
    size,
    heading,
    recoil,
    flashIntensity,
    baseColor,
    coreColor,
    barrelColor,
    glowColor,
    outline,
    def
) {
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
}

function renderVulcan(
    x,
    y,
    size,
    heading,
    recoil,
    flashIntensity,
    baseColor,
    coreColor,
    barrelColor,
    glowColor,
    outline,
    def
) {
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
}

function renderRail(
    x,
    y,
    size,
    heading,
    recoil,
    flashIntensity,
    baseColor,
    coreColor,
    barrelColor,
    glowColor,
    outline,
    def
) {
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
}

function renderPrism(
    x,
    y,
    size,
    heading,
    recoil,
    flashIntensity,
    baseColor,
    coreColor,
    barrelColor,
    glowColor,
    outline,
    def
) {
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
}

function renderGyro(
    x,
    y,
    size,
    heading,
    recoil,
    flashIntensity,
    baseColor,
    coreColor,
    barrelColor,
    glowColor,
    outline,
    def,
    tower,
    time
) {
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
}

function renderHowitzer(
    x,
    y,
    size,
    heading,
    recoil,
    flashIntensity,
    baseColor,
    coreColor,
    barrelColor,
    glowColor,
    outline,
    def
) {
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
}

function renderSentinel(
    x,
    y,
    size,
    heading,
    recoil,
    flashIntensity,
    baseColor,
    coreColor,
    barrelColor,
    glowColor,
    outline,
    def
) {
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
}

function renderArtillery(
    x,
    y,
    size,
    heading,
    recoil,
    flashIntensity,
    baseColor,
    coreColor,
    barrelColor,
    glowColor,
    outline,
    def
) {
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
}

function renderDefault(
    x,
    y,
    size,
    heading,
    recoil,
    flashIntensity,
    baseColor,
    coreColor,
    barrelColor,
    glowColor,
    outline,
    def,
    tower,
    time,
    color
) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
    if (outline) {
        ctx.strokeStyle = outline;
        ctx.lineWidth = 2.2;
        ctx.stroke();
    }
}

const SHAPE_RENDERERS = {
    turret: renderTurret,
    vulcan: renderVulcan,
    rail: renderRail,
    prism: renderPrism,
    gyro: renderGyro,
    howitzer: renderHowitzer,
    sentinel: renderSentinel,
    artillery: renderArtillery
};

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

    const renderer = SHAPE_RENDERERS[def.shape] || renderDefault;
    renderer(
        x,
        y,
        size,
        heading,
        recoil,
        flashIntensity,
        baseColor,
        coreColor,
        barrelColor,
        glowColor,
        outline,
        def,
        tower,
        time,
        color
    );
}

const _towerAuraCache = new Map();
const _TOWER_AURA_CACHE_MAX = 64;

function _getCachedAuraColor(glowColor) {
    let cached = _towerAuraCache.get(glowColor);
    if (cached !== undefined) return cached;
    cached = applyAlpha(glowColor, 0.15);
    if (_towerAuraCache.size >= _TOWER_AURA_CACHE_MAX) {
        const firstKey = _towerAuraCache.keys().next().value;
        _towerAuraCache.delete(firstKey);
    }
    _towerAuraCache.set(glowColor, cached);
    return cached;
}

function drawTowers() {
    const now = elapsedTime;
    ctx.save();
    for (const tower of towers) {
        const def = tower.def || getTowerDefinition(tower.type);
        const color = getTowerColor(def, tower.level);
        const size = TOWER_DRAW_BASE + (tower.level - 1) * 1.2;
        const glowColor = def.glowColor || color;
        const auraRadius = size * 1.8;
        const auraColor = _getCachedAuraColor(glowColor);
        ctx.fillStyle = auraColor;
        ctx.beginPath();
        ctx.arc(tower.worldX, tower.worldY, auraRadius, 0, Math.PI * 2);
        ctx.fill();

        if (gameState.selectedTower === tower) {
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
        ctx.shadowBlur = 0;
        drawTowerShape(tower, color, def.outline, now, def);
        ctx.restore();
    }
    ctx.restore();
}

function drawEnemies() {
    const time = elapsedTime;
    ctx.save();
    ctx.lineJoin = 'round';
    for (const enemy of enemies) {
        const style = enemy.enemyType || ENEMY_TYPE_DEFINITIONS[0];
        const heading = typeof enemy.heading === 'number' ? enemy.heading : 0;
        const pulse = 0.5;
        const size = enemy.enemyType && enemy.enemyType.id === 'boss' ? ENEMY_RADIUS * 1.5 : ENEMY_RADIUS;

        ctx.save();
        ctx.translate(enemy.x, enemy.y);
        ctx.rotate(heading + Math.PI);
        const thrusterLength = size * (1.1 + pulse * 0.45);
        const thrusterWidth = size * 0.7;
        ctx.fillStyle = applyAlpha(style.thruster || '#ff9a6d', 0.5);
        ctx.beginPath();
        ctx.moveTo(-size * 0.25, -thrusterWidth / 2);
        ctx.lineTo(-thrusterLength - size * 0.35, 0);
        ctx.lineTo(-size * 0.25, thrusterWidth / 2);
        ctx.closePath();
        ctx.globalAlpha = 0.85;
        ctx.fill();
        ctx.restore();

        ctx.globalAlpha = 0.9;
        ctx.fillStyle = applyAlpha(style.body, 0.3);
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, size * (1.7 + pulse * 0.25), 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = style.body;
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
    ctx.strokeStyle = applyAlpha(color, 0.5);
    ctx.lineWidth = Math.max(1.5, (projectile.radius || 4) * 0.7);
    ctx.lineCap = 'round';
    ctx.shadowColor = applyAlpha(color, 0.45);
    ctx.shadowBlur = 0;
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
        const radius =
            effect.radius * (effect.pulse ? 1 + Math.sin((1 - alpha) * Math.PI) * 0.25 : 1 + (1 - alpha) * 0.35);
        ctx.globalAlpha = Math.min(1, alpha + 0.15);
        ctx.fillStyle = applyAlpha(effect.halo || effect.color, Math.min(1, 0.5 + alpha * 0.5));
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
        ctx.globalAlpha = alpha;
        ctx.fillStyle = applyAlpha(flash.color, Math.min(1, 0.7 + alpha * 0.3));
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
        if (projectile.trailLength) {
            ctx.save();
            ctx.globalAlpha = Math.min(0.8, alpha);
            drawProjectileTrail(projectile);
            ctx.restore();
        }
        const glowColor = projectile.glowColor || projectile.color;
        ctx.shadowColor = applyAlpha(glowColor, 0.6);
        ctx.shadowBlur = 0;
        switch (projectile.shape) {
            case 'beam': {
                const length = projectile.trailLength || 40;
                ctx.lineCap = 'round';
                ctx.strokeStyle = projectile.color;
                ctx.lineWidth = (projectile.radius || 6) * 1.6;
                ctx.beginPath();
                ctx.moveTo(
                    projectile.x - (projectile.vx / projectile.speed) * length,
                    projectile.y - (projectile.vy / projectile.speed) * length
                );
                ctx.lineTo(projectile.x, projectile.y);
                ctx.stroke();
                break;
            }
            case 'triangle': {
                const size = projectile.radius || 6;
                const angle = projectile.rotation || 0;
                ctx.fillStyle = projectile.color;
                ctx.beginPath();
                ctx.moveTo(projectile.x + Math.cos(angle) * size * 1.4, projectile.y + Math.sin(angle) * size * 1.4);
                ctx.lineTo(projectile.x + Math.cos(angle + 2.5) * size, projectile.y + Math.sin(angle + 2.5) * size);
                ctx.lineTo(projectile.x + Math.cos(angle - 2.5) * size, projectile.y + Math.sin(angle - 2.5) * size);
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
                ctx.fillStyle = projectile.color;
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
    gameState.hoverTile = { x: kbCursor.x, y: kbCursor.y };
    renderDirty = true;
    const tileInfo = canBuildAt(kbCursor.x, kbCursor.y) ? '빈 타일' : '배치 불가';
    announce(`${kbCursor.x + 1}, ${kbCursor.y + 1} ${tileInfo}`);
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
        ctx.strokeStyle = 'rgba(255, 220, 100, 0.8)';
        ctx.lineWidth = 2;
        ctx.strokeRect(kbCursor.x * TILE_SIZE + 1, kbCursor.y * TILE_SIZE + 1, TILE_SIZE - 2, TILE_SIZE - 2);
        ctx.restore();
    }
    if (!gameState.hoverTile) {
        return;
    }
    const { x, y } = gameState.hoverTile;
    if (!canBuildAt(x, y)) {
        ctx.fillStyle = 'rgba(215, 80, 80, 0.35)';
    } else {
        ctx.fillStyle = 'rgba(98, 150, 255, 0.25)';
    }
    ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);

    // Range preview circle
    const centerX = x * TILE_SIZE + TILE_CENTER_OFFSET;
    const centerY = y * TILE_SIZE + TILE_CENTER_OFFSET;
    let rangeRadius = 0;
    let rangeColor = 'rgba(98, 150, 255, 0.3)';

    // Check if hovering over an existing tower
    const existingTower = towers.find((t) => t.x === x && t.y === y);
    if (existingTower) {
        rangeRadius = existingTower.range;
        const def = getTowerDefinition(existingTower.type);
        rangeColor = applyAlpha(def.glowColor || getTowerColor(def, existingTower.level), 0.3);
    } else if (canBuildAt(x, y)) {
        const def = getTowerDefinition(gameState.selectedTowerType);
        rangeRadius = def.range;
    }

    if (rangeRadius > 0) {
        ctx.save();
        ctx.strokeStyle = existingTower
            ? applyAlpha(getTowerColor(getTowerDefinition(existingTower.type), existingTower.level), 0.5)
            : 'rgba(98, 150, 255, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 4]);
        ctx.fillStyle = rangeColor;
        ctx.beginPath();
        ctx.arc(centerX, centerY, rangeRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fill();
        ctx.setLineDash([]);
        ctx.restore();
    }
}

function drawState() {
    if (gameState.gameLoopHalted) {
        ctx.save();
        ctx.fillStyle = 'rgba(80, 0, 0, 0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ff6b6b';
        ctx.font = "36px 'Noto Sans KR', sans-serif";
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('오류 발생', canvas.width / 2, canvas.height / 2 - 30);
        ctx.fillStyle = '#f5f5f5';
        ctx.font = "20px 'Noto Sans KR', sans-serif";
        ctx.fillText('페이지를 새로고침 해주세요', canvas.width / 2, canvas.height / 2 + 20);
        ctx.restore();
        return;
    }
    if (!gameState.paused) {
        return;
    }
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#f5f5f5';
    ctx.font = "48px 'Noto Sans KR', 'Malgun Gothic', 'Segoe UI', sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = gameState.gameOver ? '패배' : '일시 정지';
    ctx.fillText(label, canvas.width / 2, canvas.height / 2);
    ctx.restore();
}

let contextLostNotified = false;

function tryRecoverContext() {
    try {
        ctx = canvas.getContext('2d');
        if (ctx) {
            contextLostNotified = false;
            console.info('Canvas 2D context recovered.');
            buildStaticLayer();
            return true;
        }
    } catch (e) {
        console.error('Canvas context recovery failed:', e);
    }
    if (!contextLostNotified) {
        contextLostNotified = true;
        announce('렌더링 오류가 발생했습니다. 페이지를 새로고침 해주세요.');
    }
    return false;
}

function render() {
    if (!ctx) {
        tryRecoverContext();
        return;
    }
    try {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    } catch (e) {
        console.error('Canvas context lost during render:', e);
        ctx = null;
        tryRecoverContext();
        return;
    }
    if (staticLayer) {
        ctx.drawImage(staticLayer, 0, 0);
    } else {
        drawGrid();
        drawPath();
    }
    drawHover();
    if (gameState.buildFailFlash && gameState.buildFailFlash.timer > 0) {
        const alpha = Math.min(1, gameState.buildFailFlash.timer * 3);
        ctx.fillStyle = `rgba(255, 80, 80, ${(0.45 * alpha).toFixed(2)})`;
        ctx.fillRect(
            gameState.buildFailFlash.x * TILE_SIZE,
            gameState.buildFailFlash.y * TILE_SIZE,
            TILE_SIZE,
            TILE_SIZE
        );
    }
    drawTowers();
    drawEnemies();
    drawMuzzleFlashes();
    drawProjectiles();
    drawState();
}
