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
    const flashColor = def.muzzleFlashColor || tower.cachedTowerColor;
    const flashRadius = baseSize * (def.flashSizeMultiplier || 0.9);
    spawnMuzzleFlash(muzzleX, muzzleY, flashRadius, flashColor, angle, {
        growth: flashRadius * 9,
        life: def.flashDuration || 0.16
    });
}

function attackShotgun(tower, def, dirX, dirY, baseAngle) {
    const ls = def.levelScaling || {};
    const pellets = def.pellets || 4;
    const spread = def.spread || Math.PI / 4;
    const color = tower.cachedProjectileColor;
    const trailColor = tower.cachedTrailColor;
    for (let i = 0; i < pellets; i++) {
        const ratio = pellets === 1 ? 0 : i / (pellets - 1) - 0.5;
        const jitter = (Math.random() - 0.5) * 0.35;
        const angle = baseAngle + (ratio + jitter) * spread;
        const speed = (def.projectileSpeed || 580) * (0.9 + Math.random() * 0.3);
        spawnProjectile({
            x: tower.worldX,
            y: tower.worldY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            damage: tower.damage,
            life: def.projectileLife + (tower.level - 1) * (ls.lifePerLevel ?? 0.05),
            radius: def.projectileRadius + (tower.level - 1) * (ls.radiusPerLevel ?? 0.7),
            color,
            glowColor: def.glowColor || color,
            outline: '#2e2e2e',
            trailColor,
            trailLength: def.trailLength + (tower.level - 1) * (ls.trailPerLevel ?? 10),
            hitRadius: (ls.hitRadiusBase ?? 14) + tower.level * (ls.hitRadiusPerLevel ?? 1),
            spin: (Math.random() - 0.5) * 6,
            shape: 'circle'
        });
    }
}

function attackBeam(tower, def, dirX, dirY, baseAngle) {
    const ls = def.levelScaling || {};
    const speed = (def.projectileSpeed || 580) + (tower.level - 1) * (ls.speedPerLevel ?? 25);
    const color = tower.cachedProjectileColor;
    spawnProjectile({
        x: tower.worldX,
        y: tower.worldY,
        vx: dirX * speed,
        vy: dirY * speed,
        damage: tower.damage,
        life: def.projectileLife + (tower.level - 1) * (ls.lifePerLevel ?? 0.2),
        radius: def.beamWidth + (tower.level - 1) * (ls.radiusPerLevel ?? 1.2),
        color,
        glowColor: def.glowColor || color,
        outline: '#ffffff33',
        shape: 'beam',
        trailColor: color,
        trailLength: def.trailLength + (tower.level - 1) * (ls.trailPerLevel ?? 30),
        hitRadius: (ls.hitRadiusBase ?? 24) + tower.level * (ls.hitRadiusPerLevel ?? 1.5)
    });
}

function attackBurst(tower, def, dirX, dirY, baseAngle) {
    const ls = def.levelScaling || {};
    const speed = (def.projectileSpeed || 580) + (tower.level - 1) * (ls.speedPerLevel ?? 25);
    const burstCount = def.burstCount || 3;
    const delayStep = def.burstDelay ?? 0.07;
    const color = tower.cachedProjectileColor;
    for (let i = 0; i < burstCount; i++) {
        const delay = i * delayStep;
        spawnProjectile({
            x: tower.worldX,
            y: tower.worldY,
            vx: dirX * speed,
            vy: dirY * speed,
            damage: tower.damage,
            life: def.projectileLife + (tower.level - 1) * (ls.lifePerLevel ?? 0.08) + delay,
            radius: def.projectileRadius + (tower.level - 1) * (ls.radiusPerLevel ?? 0.5),
            color,
            glowColor: def.glowColor || color,
            outline: '#351a05',
            shape: 'triangle',
            trailColor: '#fffbf2',
            trailLength: def.trailLength + (tower.level - 1) * (ls.trailPerLevel ?? 12),
            delay,
            spin: 6,
            hitRadius: (ls.hitRadiusBase ?? 18) + tower.level * (ls.hitRadiusPerLevel ?? 1.4)
        });
    }
}

function attackExplosive(tower, def, dirX, dirY, baseAngle) {
    const ls = def.levelScaling || {};
    const speed = (def.projectileSpeed || 580) + (tower.level - 1) * (ls.speedPerLevel ?? 20);
    const color = tower.cachedProjectileColor;
    spawnProjectile({
        x: tower.worldX,
        y: tower.worldY,
        vx: dirX * speed,
        vy: dirY * speed,
        damage: tower.damage,
        life: def.projectileLife + (tower.level - 1) * (ls.lifePerLevel ?? 0.12),
        radius: def.projectileRadius + (tower.level - 1) * (ls.radiusPerLevel ?? 0.6),
        color,
        glowColor: def.glowColor || color,
        outline: def.outline,
        shape: 'hex',
        trailColor: tower.cachedTrailColor,
        trailLength: def.trailLength + (tower.level - 1) * (ls.trailPerLevel ?? 15),
        explosionRadius: def.explosionRadius + tower.level * (ls.explosionRadiusPerLevel ?? 4),
        explosionColor: def.explosionColor,
        explosionHaloColor: def.explosionHaloColor,
        explosionStrokeColor: def.explosionStrokeColor,
        explosionLife: def.explosionLife,
        hitRadius: (ls.hitRadiusBase ?? 22) + tower.level * (ls.hitRadiusPerLevel ?? 1.5),
        detonateOnExpire: true
    });
}

function attackMortar(tower, def, dirX, dirY, baseAngle) {
    const ls = def.levelScaling || {};
    const speed = (def.projectileSpeed || 580) + (tower.level - 1) * (ls.speedPerLevel ?? 12);
    const lift = def.mortarLift + (tower.level - 1) * (ls.liftPerLevel ?? 12);
    const color = tower.cachedProjectileColor;
    spawnProjectile({
        x: tower.worldX,
        y: tower.worldY,
        vx: dirX * speed,
        vy: dirY * speed - lift,
        damage: tower.damage,
        life: def.projectileLife + (tower.level - 1) * (ls.lifePerLevel ?? 0.18),
        radius: def.projectileRadius + (tower.level - 1) * (ls.radiusPerLevel ?? 1.2),
        color,
        glowColor: def.glowColor || color,
        outline: def.outline,
        shape: 'orb',
        trailColor: tower.cachedTrailColor,
        trailLength: def.trailLength + (tower.level - 1) * (ls.trailPerLevel ?? 14),
        gravity: def.gravity,
        explosionRadius: def.explosionRadius + tower.level * (ls.explosionRadiusPerLevel ?? 5),
        explosionColor: def.explosionColor,
        explosionHaloColor: def.explosionHaloColor,
        explosionStrokeColor: def.explosionStrokeColor,
        explosionLife: def.explosionLife,
        hitRadius: (ls.hitRadiusBase ?? 26) + tower.level * (ls.hitRadiusPerLevel ?? 2),
        detonateOnExpire: true
    });
}

function attackDefault(tower, def, dirX, dirY, baseAngle) {
    const ls = def.levelScaling || {};
    const speed = (def.projectileSpeed || 580) + (tower.level - 1) * (ls.speedPerLevel ?? 20);
    const color = tower.cachedProjectileColor;
    spawnProjectile({
        x: tower.worldX,
        y: tower.worldY,
        vx: dirX * speed,
        vy: dirY * speed,
        damage: tower.damage,
        life: (def.projectileLife || 0.8) + (tower.level - 1) * (ls.lifePerLevel ?? 0.06),
        radius: (def.projectileRadius || 6) + (tower.level - 1) * (ls.radiusPerLevel ?? 0.4),
        color,
        glowColor: def.glowColor || color,
        outline: def.outline,
        shape: def.shape === 'triangle' ? 'triangle' : 'circle',
        trailColor: tower.cachedTrailColor,
        trailLength: def.trailLength + (tower.level - 1) * (ls.trailPerLevel ?? 12),
        hitRadius: (ls.hitRadiusBase ?? 16) + tower.level * (ls.hitRadiusPerLevel ?? 1.2)
    });
}

const ATTACK_PATTERNS = {
    shotgun: attackShotgun,
    beam: attackBeam,
    burst: attackBurst,
    explosive: attackExplosive,
    mortar: attackMortar
};

function performTowerAttack(tower, target, def) {
    const baseDx = target.x - tower.worldX;
    const baseDy = target.y - tower.worldY;
    const baseDist = Math.hypot(baseDx, baseDy) || 1;
    const baseAngle = Math.atan2(baseDy, baseDx);
    const dirX = baseDx / baseDist;
    const dirY = baseDy / baseDist;

    handleTowerFireVisuals(tower, def, baseAngle);

    const attackFn = ATTACK_PATTERNS[def.attackPattern] || attackDefault;
    attackFn(tower, def, dirX, dirY, baseAngle);
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
        if (targetIndex === -1) {
            tower.activeBeam = null;
            return;
        }
    }
    const angle = Math.atan2(target.y - tower.worldY, target.x - tower.worldX);
    tower.aimAngle = angle;
    if (typeof tower.heading !== 'number') {
        tower.heading = angle;
    } else {
        const turnSpeed = Math.max(4, (def.turnSpeed || 8) * 1.25);
        tower.heading = lerpAngle(tower.heading, angle, Math.min(1, dt * turnSpeed));
    }
    tower.flashTimer = Math.max(tower.flashTimer || 0, def.flashDuration || 0.08);
    const damagePerSecond = tower.damage * (def.sustainMultiplier || 1);
    const appliedDamage = damagePerSecond * dt;
    const targetX = target.x;
    const targetY = target.y;
    const killed = damageEnemyAtIndex(targetIndex, appliedDamage);
    const beamColor = def.beamColor || tower.cachedProjectileColor;
    if (tower.activeBeam) {
        tower.activeBeam.x1 = tower.worldX;
        tower.activeBeam.y1 = tower.worldY;
        tower.activeBeam.x2 = targetX;
        tower.activeBeam.y2 = targetY;
        tower.activeBeam.alpha = 0.95;
    } else {
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
    }
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
