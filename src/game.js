import { TILE_SIZE, TOWER_DRAW_BASE, ENEMY_RADIUS, TOWER_MAX_LEVEL, DEFAULT_TOWER_TYPE } from './constants.js';
import { state } from './state.js';
import { canvas, ctx, GRID_COLS, GRID_ROWS, TILE_CENTER_OFFSET } from './state.js';
import {
    getTowerDefinition,
    getTowerColor,
    getProjectileColor,
    calculateTowerDamage,
    calculateUpgradeCost,
    recalcTowerStats,
    ensureTowerMetadata,
    lerpAngle,
    getWaveEnemyCount,
    getWaveEnemyStats
} from './utils.js';
import { playSound } from './audio.js';
import {
    updateGoldUI,
    hideEnemyStats,
    hideAllStats,
    setSelectedTowerButton,
    updateWavePreview,
    setGameSpeed,
    updateTowerStatsFields,
    updateEnemyStatsFields,
    hideDefeatDialog,
    LIVES_LABEL,
    WAVE_LABEL,
    WAVE_INPUT,
    DEFEAT_OVERLAY
} from './ui.js';
import { waypoints } from './map.js';
import { ENEMY_STYLES } from './data/enemyStyles.js';
import { TOWER_PICK_RADIUS, ENEMY_BASE_REWARD } from './constants.js';

function clearCurrentWave() {
    state.enemies.length = 0;
    state.projectiles.length = 0;
    state.impactEffects.length = 0;
    state.muzzleFlashes.length = 0;
    state.enemiesToSpawn = 0;
    state.spawnCooldown = 0;
    state.waveInProgress = false;
    state.nextWaveTimer = 0;
    hideEnemyStats();
}

export function setWave(targetWave) {
    if (state.gameOver) {
        if (WAVE_INPUT) {
            WAVE_INPUT.value = state.wave;
        }
        return;
    }
    const desiredWave = Math.max(1, Math.floor(targetWave));
    clearCurrentWave();
    state.selectedTowerType = DEFAULT_TOWER_TYPE;
    setSelectedTowerButton(state.selectedTowerType);
    state.wave = desiredWave;
    WAVE_LABEL.textContent = state.wave;
    if (WAVE_INPUT) {
        WAVE_INPUT.value = state.wave;
    }
    updateWavePreview();
}

function spawnImpactEffect(x, y, radius, color, options = {}) {
    const life = options.life ?? 0.35;
    state.impactEffects.push({
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

function spawnMuzzleFlash(x, y, radius, color, angle, options = {}) {
    const life = options.life ?? 0.18;
    state.muzzleFlashes.push({
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

function damageEnemyAtIndex(index, amount) {
    const enemy = state.enemies[index];
    if (!enemy) {
        return false;
    }
    enemy.hp -= amount;
    if (enemy.hp <= 0) {
        const style = enemy.style || ENEMY_STYLES[0];
        spawnImpactEffect(enemy.x, enemy.y, ENEMY_RADIUS * 1.9, style.core || 'rgba(255, 220, 190, 0.7)', {
            haloColor: style.halo || style.body,
            stroke: style.outline || 'rgba(20, 16, 26, 0.7)',
            lineWidth: ENEMY_RADIUS * 0.5,
            life: 0.5,
            pulse: true
        });
        if (state.selectedEnemy === enemy) {
            hideEnemyStats();
        }
        state.enemies.splice(index, 1);
        state.gold += enemy.reward;
        updateGoldUI();
        playSound('kill');
        return true;
    }
    return false;
}

function damageEnemy(enemy, amount) {
    const idx = state.enemies.indexOf(enemy);
    if (idx === -1) {
        return false;
    }
    return damageEnemyAtIndex(idx, amount);
}

function applyExplosion(projectile, originX, originY) {
    const radius = projectile.explosionRadius || 0;
    if (radius <= 0) {
        return;
    }
    const radiusSq = radius * radius;
    for (let k = state.enemies.length - 1; k >= 0; k--) {
        const foe = state.enemies[k];
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

export function getTowerAtPoint(px, py) {
    for (let i = state.towers.length - 1; i >= 0; i--) {
        const tower = state.towers[i];
        if (Math.hypot(px - tower.worldX, py - tower.worldY) <= TOWER_PICK_RADIUS) {
            return tower;
        }
    }
    return null;
}

export function getEnemyAtPoint(px, py) {
    for (let i = state.enemies.length - 1; i >= 0; i--) {
        const enemy = state.enemies[i];
        if (Math.hypot(px - enemy.x, py - enemy.y) <= ENEMY_RADIUS) {
            return enemy;
        }
    }
    return null;
}

export function upgradeTower(tower) {
    ensureTowerMetadata(tower);
    if (tower.level >= TOWER_MAX_LEVEL) {
        return false;
    }
    const cost = tower.upgradeCost;
    if (cost == null || state.gold < cost) {
        return false;
    }
    state.gold -= cost;
    updateGoldUI();
    tower.level += 1;
    recalcTowerStats(tower);
    playSound('upgrade');
    if (state.selectedTower === tower) {
        updateTowerStatsFields();
    }
    return true;
}

export function showDefeatDialog() {
    if (!DEFEAT_OVERLAY || state.gameOver) {
        return;
    }
    state.gameOver = true;
    state.paused = true;
    clearCurrentWave();
    state.selectedTowerType = DEFAULT_TOWER_TYPE;
    setSelectedTowerButton(state.selectedTowerType);
    setGameSpeed(1);
    DEFEAT_OVERLAY.classList.remove('hidden');
    updateWavePreview(0);
}

export function resetGame() {
    state.gold = 100;
    state.lives = 20;
    state.wave = 1;
    state.gameOver = false;
    state.paused = false;
    state.hoverTile = null;
    hideAllStats();
    state.towers.length = 0;
    clearCurrentWave();
    state.selectedTowerType = DEFAULT_TOWER_TYPE;
    setSelectedTowerButton(state.selectedTowerType);
    updateGoldUI();
    LIVES_LABEL.textContent = state.lives;
    WAVE_LABEL.textContent = state.wave;
    if (WAVE_INPUT) {
        WAVE_INPUT.value = state.wave;
    }
    hideDefeatDialog();
    setGameSpeed(1);
    updateWavePreview();
    state.elapsedTime = 0;
    state.lastTime = performance.now();
}

function startWave() {
    state.waveInProgress = true;
    state.enemiesToSpawn = getWaveEnemyCount(state.wave);
    state.spawnCooldown = 0;
    state.nextWaveTimer = 0;
    WAVE_LABEL.textContent = state.wave;
    if (WAVE_INPUT) {
        WAVE_INPUT.value = state.wave;
    }
    updateWavePreview(state.enemiesToSpawn + state.enemies.length);
}

export function createTowerData(x, y, typeId) {
    const def = getTowerDefinition(typeId);
    return {
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
        auraOffset: Math.random() * Math.PI * 2
    };
}

function spawnEnemy() {
    const start = waypoints[0];
    const stats = getWaveEnemyStats(state.wave);
    const style = ENEMY_STYLES[(state.wave - 1) % ENEMY_STYLES.length];
    state.enemies.push({
        x: start.x,
        y: start.y,
        speed: stats.speed,
        hp: stats.hp,
        maxHp: stats.hp,
        waypoint: 0,
        reward: stats.reward,
        waveIndex: state.wave,
        heading: 0,
        style,
        pulseSeed: Math.random() * Math.PI * 2
    });
}

function findTarget(tower) {
    let chosen = null;
    let bestScore = -Infinity;
    for (const enemy of state.enemies) {
        const dx = enemy.x - tower.worldX;
        const dy = enemy.y - tower.worldY;
        const dist = Math.hypot(dx, dy);
        if (dist > tower.range) {
            continue;
        }
        const score = enemy.waypoint * 1000 - dist;
        if (score > bestScore) {
            bestScore = score;
            chosen = enemy;
        }
    }
    return chosen;
}

function spawnProjectile(options) {
    const speed = Math.hypot(options.vx, options.vy) || 1;
    state.projectiles.push({
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

function performTowerAttack(tower, target) {
    const def = getTowerDefinition(tower.type);
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

function handleLaserAttack(tower, dt) {
    const def = getTowerDefinition(tower.type);
    const hadBeam = Boolean(tower.activeBeam && tower.activeBeam.alpha > 0.2);
    if (tower.activeBeam) {
        tower.activeBeam.alpha = Math.max(0, tower.activeBeam.alpha - dt * 8);
        if (tower.activeBeam.alpha <= 0.01) {
            tower.activeBeam = null;
        }
    }
    const target = findTarget(tower);
    if (!target) {
        tower.aimAngle = null;
        return;
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
    const killed = damageEnemy(target, appliedDamage);
    const beamColor = def.beamColor || getProjectileColor(def, tower.level);
    tower.activeBeam = {
        x1: tower.worldX,
        y1: tower.worldY,
        x2: target.x,
        y2: target.y,
        width: (def.beamWidth || 6) + (tower.level - 1) * 0.35,
        color: beamColor,
        glow: def.beamGlowColor || beamColor,
        alpha: 0.95
    };
    if (!hadBeam) {
        playSound('laser');
    }
    if (killed) {
        spawnImpactEffect(target.x, target.y, 36 + tower.level * 2, def.beamGlowColor || 'rgba(150, 255, 255, 0.4)', {
            haloColor: '#d4fbff',
            life: 0.4,
            pulse: true
        });
    }
}

export function update(dt) {
    if (state.gameOver) {
        return;
    }
    if (!state.waveInProgress && state.nextWaveTimer <= 0) {
        startWave();
    }
    if (state.waveInProgress) {
        if (state.enemiesToSpawn > 0) {
            state.spawnCooldown -= dt;
            if (state.spawnCooldown <= 0) {
                spawnEnemy();
                state.enemiesToSpawn--;
                state.spawnCooldown = Math.max(0.6 - state.wave * 0.02, 0.25);
            }
        } else if (state.enemies.length === 0) {
            state.waveInProgress = false;
            state.nextWaveTimer = 4;
            state.wave += 1;
            WAVE_LABEL.textContent = state.wave;
            if (WAVE_INPUT) {
                WAVE_INPUT.value = state.wave;
            }
            updateWavePreview();
        }
    } else if (state.nextWaveTimer > 0) {
        state.nextWaveTimer -= dt;
    }

    for (let i = state.enemies.length - 1; i >= 0; i--) {
        const enemy = state.enemies[i];
        const target = waypoints[enemy.waypoint + 1];
        if (!target) {
            if (state.selectedEnemy === enemy) {
                hideEnemyStats();
            }
            state.enemies.splice(i, 1);
            state.lives = Math.max(0, state.lives - 1);
            LIVES_LABEL.textContent = state.lives;
            if (state.lives === 0) {
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

    for (const tower of state.towers) {
        const def = getTowerDefinition(tower.type);
        tower.flashTimer = Math.max(0, (tower.flashTimer || 0) - dt * 4.6);
        tower.recoil = Math.max(0, (tower.recoil || 0) - dt * (def.recoilRecovery || 3));
        if (def.attackPattern === 'laser') {
            handleLaserAttack(tower, dt);
            continue;
        }
        if (tower.activeBeam) {
            tower.activeBeam.alpha = Math.max(0, tower.activeBeam.alpha - dt * 6);
            if (tower.activeBeam.alpha <= 0.05) {
                tower.activeBeam = null;
            }
        }
        let target = findTarget(tower);
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
        performTowerAttack(tower, target);
        tower.cooldown = tower.fireDelay;
    }

    for (let i = state.projectiles.length - 1; i >= 0; i--) {
        const projectile = state.projectiles[i];
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
        if (projectile.spin) {
            projectile.rotation += projectile.spin * dt;
        } else {
            projectile.rotation = Math.atan2(projectile.vy, projectile.vx);
        }
        projectile.speed = Math.hypot(projectile.vx, projectile.vy) || 1;

        let remove = false;
        let impacted = false;
        for (let j = state.enemies.length - 1; j >= 0; j--) {
            const enemy = state.enemies[j];
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
            state.projectiles.splice(i, 1);
        }
    }

    for (let i = state.muzzleFlashes.length - 1; i >= 0; i--) {
        const flash = state.muzzleFlashes[i];
        flash.life -= dt;
        flash.radius += flash.growth * dt;
        if (flash.life <= 0) {
            state.muzzleFlashes.splice(i, 1);
        }
    }

    for (let i = state.impactEffects.length - 1; i >= 0; i--) {
        const effect = state.impactEffects[i];
        effect.life -= dt;
        if (effect.life <= 0) {
            state.impactEffects.splice(i, 1);
        }
    }

    if (state.selectedEnemy) {
        updateEnemyStatsFields();
    }
    if (state.selectedTower) {
        updateTowerStatsFields();
    }
    updateWavePreview(state.waveInProgress ? state.enemiesToSpawn + state.enemies.length : null);
}
