const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const TILE_SIZE = 30;
const GRID_COLS = Math.floor(canvas.width / TILE_SIZE);
const GRID_ROWS = Math.floor(canvas.height / TILE_SIZE);
const TILE_CENTER_OFFSET = TILE_SIZE / 2;
const TOWER_RADIUS = 12;
const ENEMY_RADIUS = 14;
const ENEMY_BASE_HP = 78;
const ENEMY_HP_GROWTH_RATE = 1.25;
const ENEMY_SPEED = 49;
const ENEMY_BASE_REWARD = 14;
const TOWER_BASE_DAMAGE = 35;
const TOWER_UPGRADE_BASE_COST = 40;
const TOWER_UPGRADE_DAMAGE_MULTIPLIER = 1.5;
const TOWER_UPGRADE_COST_MULTIPLIER = 2;
const TOWER_MAX_LEVEL = 7;

const waypoints = [
    { x: -2, y: 8 },
    { x: 2, y: 8 },
    { x: 2, y: 4 },
    { x: 10, y: 4 },
    { x: 10, y: 12 },
    { x: 18, y: 12 },
    { x: 18, y: 6 },
    { x: 26, y: 6 },
    { x: 26, y: 14 },
    { x: GRID_COLS + 1, y: 14 }
].map(point => ({
    x: point.x * TILE_SIZE + TILE_CENTER_OFFSET,
    y: point.y * TILE_SIZE + TILE_CENTER_OFFSET
}));

const pathTiles = new Set();
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

const towers = [];
const enemies = [];
const projectiles = [];

let gold = 100;
let lives = 20;
let wave = 1;
let waveInProgress = false;
let enemiesToSpawn = 0;
let spawnCooldown = 0;
let nextWaveTimer = 0;
let paused = false;
let hoverTile = null;
let selectedTower = null;
let selectedEnemy = null;
let gameSpeed = 1;
let gameOver = false;

const GOLD_LABEL = document.getElementById("gold");
const LIVES_LABEL = document.getElementById("lives");
const WAVE_LABEL = document.getElementById("wave");

const TOWER_STATS_PANEL = document.getElementById("tower-stats");
const ENEMY_STATS_PANEL = document.getElementById("enemy-stats");
const TOWER_STATS_FIELDS = {
    position: TOWER_STATS_PANEL.querySelector('[data-field="tower-position"]'),
    range: TOWER_STATS_PANEL.querySelector('[data-field="tower-range"]'),
    fireDelay: TOWER_STATS_PANEL.querySelector('[data-field="tower-fire-delay"]'),
    damage: TOWER_STATS_PANEL.querySelector('[data-field="tower-damage"]'),
    level: TOWER_STATS_PANEL.querySelector('[data-field="tower-level"]'),
    upgradeCost: TOWER_STATS_PANEL.querySelector('[data-field="tower-upgrade-cost"]')
};
const ENEMY_STATS_FIELDS = {
    wave: ENEMY_STATS_PANEL.querySelector('[data-field="enemy-wave"]'),
    hp: ENEMY_STATS_PANEL.querySelector('[data-field="enemy-hp"]'),
    speed: ENEMY_STATS_PANEL.querySelector('[data-field="enemy-speed"]'),
    reward: ENEMY_STATS_PANEL.querySelector('[data-field="enemy-reward"]')
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

function gridFromPosition(point) {
    return {
        x: Math.floor(point.x / TILE_SIZE),
        y: Math.floor(point.y / TILE_SIZE)
    };
}

function keyFromGrid(x, y) {
    return `${x},${y}`;
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

function getWaveEnemyCount(waveNumber) {
    return 8 + Math.floor(waveNumber * 1.5);
}

function getWaveEnemyStats(waveNumber) {
    const growth = Math.pow(ENEMY_HP_GROWTH_RATE, Math.max(0, waveNumber - 1));
    const hp = Math.round(ENEMY_BASE_HP * growth);
    const speed = ENEMY_SPEED;
    const reward = ENEMY_BASE_REWARD;
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
        status = '진행 중';
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
        button.classList.toggle('active', value === gameSpeed);
    }
}

function setGameSpeed(multiplier) {
    if (!Number.isFinite(multiplier) || multiplier <= 0) {
        multiplier = 1;
    }
    gameSpeed = multiplier;
    updateSpeedControls();
}

function clearCurrentWave() {
    enemies.length = 0;
    projectiles.length = 0;
    enemiesToSpawn = 0;
    spawnCooldown = 0;
    waveInProgress = false;
    nextWaveTimer = 0;
    hideEnemyStats();
}

function ensureTowerMetadata(tower) {
    if (typeof tower.level !== 'number' || tower.level < 1) {
        tower.level = 1;
    }
    if (typeof tower.damage !== 'number') {
        tower.damage = TOWER_BASE_DAMAGE;
    }
    if (typeof tower.upgradeCost !== 'number' || tower.upgradeCost <= 0) {
        tower.upgradeCost = Math.round(TOWER_UPGRADE_BASE_COST * Math.pow(TOWER_UPGRADE_COST_MULTIPLIER, tower.level - 1));
    }
}

function setWave(targetWave) {
    if (gameOver) {
        if (WAVE_INPUT) {
            WAVE_INPUT.value = wave;
        }
        return;
    }
    const desiredWave = Math.max(1, Math.floor(targetWave));
    clearCurrentWave();
    wave = desiredWave;
    WAVE_LABEL.textContent = wave;
    if (WAVE_INPUT) {
        WAVE_INPUT.value = wave;
    }
    updateWavePreview();
}

function updateTowerStatsFields() {
    if (!selectedTower || !TOWER_STATS_PANEL) {
        return;
    }
    ensureTowerMetadata(selectedTower);
    TOWER_STATS_FIELDS.position.textContent = `${selectedTower.x}, ${selectedTower.y}`;
    TOWER_STATS_FIELDS.range.textContent = `${(selectedTower.range / TILE_SIZE).toFixed(1)} 타일`;
    TOWER_STATS_FIELDS.fireDelay.textContent = `${selectedTower.fireDelay.toFixed(2)}초`;
    TOWER_STATS_FIELDS.damage.textContent = `${selectedTower.damage.toFixed(1)}`;
    TOWER_STATS_FIELDS.level.textContent = `${selectedTower.level}`;
    const nextCost = selectedTower.level >= TOWER_MAX_LEVEL ? 'MAX' : selectedTower.upgradeCost;
    TOWER_STATS_FIELDS.upgradeCost.textContent = nextCost;
}

function updateEnemyStatsFields() {
    if (!selectedEnemy || !ENEMY_STATS_PANEL) {
        return;
    }
    const currentHp = Math.max(0, Math.ceil(selectedEnemy.hp));
    const maxHp = Math.max(0, Math.ceil(selectedEnemy.maxHp));
    const waveIndex = typeof selectedEnemy.waveIndex === "number" ? selectedEnemy.waveIndex : wave;
    ENEMY_STATS_FIELDS.wave.textContent = waveIndex;
    ENEMY_STATS_FIELDS.hp.textContent = `${currentHp} / ${maxHp}`;
    ENEMY_STATS_FIELDS.speed.textContent = `${(selectedEnemy.speed / TILE_SIZE).toFixed(2)} 타일/초`;
    ENEMY_STATS_FIELDS.reward.textContent = `${selectedEnemy.reward}`;
}

function showTowerStats(tower) {
    if (!tower || !TOWER_STATS_PANEL) {
        return;
    }
    ensureTowerMetadata(tower);
    selectedTower = tower;
    TOWER_STATS_PANEL.classList.remove("hidden");
    updateTowerStatsFields();
}

function showEnemyStats(enemy) {
    if (!enemy || !ENEMY_STATS_PANEL) {
        return;
    }
    selectedEnemy = enemy;
    ENEMY_STATS_PANEL.classList.remove("hidden");
    updateEnemyStatsFields();
}

function getTowerAtPoint(px, py) {
    for (let i = towers.length - 1; i >= 0; i--) {
        const tower = towers[i];
        if (Math.hypot(px - tower.worldX, py - tower.worldY) <= TOWER_RADIUS) {
            return tower;
        }
    }
    return null;
}

function getEnemyAtPoint(px, py) {
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        if (Math.hypot(px - enemy.x, py - enemy.y) <= ENEMY_RADIUS) {
            return enemy;
        }
    }
    return null;
}

function getTowerUpgradeCost(tower) {
    ensureTowerMetadata(tower);
    if (tower.level >= TOWER_MAX_LEVEL) {
        return null;
    }
    return tower.upgradeCost;
}

function upgradeTower(tower) {
    ensureTowerMetadata(tower);
    if (tower.level >= TOWER_MAX_LEVEL) {
        return false;
    }
    const cost = tower.upgradeCost;
    if (gold < cost) {
        return false;
    }
    gold -= cost;
    GOLD_LABEL.textContent = gold;
    tower.level += 1;
    tower.damage = parseFloat((tower.damage * TOWER_UPGRADE_DAMAGE_MULTIPLIER).toFixed(2));
    if (tower.level < TOWER_MAX_LEVEL) {
        tower.upgradeCost = Math.round(tower.upgradeCost * TOWER_UPGRADE_COST_MULTIPLIER);
    }
    if (selectedTower === tower) {
        updateTowerStatsFields();
    }
    return true;
}

function showDefeatDialog() {
    if (!DEFEAT_OVERLAY || gameOver) {
        return;
    }
    gameOver = true;
    paused = true;
    clearCurrentWave();
    setGameSpeed(1);
    DEFEAT_OVERLAY.classList.remove('hidden');
    updateWavePreview(0);
}

function hideDefeatDialog() {
    if (!DEFEAT_OVERLAY) {
        return;
    }
    DEFEAT_OVERLAY.classList.add('hidden');
}

function resetGame() {
    gold = 100;
    lives = 20;
    wave = 1;
    gameOver = false;
    paused = false;
    hoverTile = null;
    hideAllStats();
    towers.length = 0;
    clearCurrentWave();
    GOLD_LABEL.textContent = gold;
    LIVES_LABEL.textContent = lives;
    WAVE_LABEL.textContent = wave;
    if (WAVE_INPUT) {
        WAVE_INPUT.value = wave;
    }
    hideDefeatDialog();
    setGameSpeed(1);
    updateWavePreview();
    lastTime = performance.now();
}

function startWave() {
    waveInProgress = true;
    enemiesToSpawn = getWaveEnemyCount(wave);
    spawnCooldown = 0;
    nextWaveTimer = 0;
    WAVE_LABEL.textContent = wave;
    if (WAVE_INPUT) {
        WAVE_INPUT.value = wave;
    }
    updateWavePreview(enemiesToSpawn + enemies.length);
}

canvas.addEventListener("mousemove", event => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) / TILE_SIZE);
    const y = Math.floor((event.clientY - rect.top) / TILE_SIZE);
    if (x >= 0 && x < GRID_COLS && y >= 0 && y < GRID_ROWS) {
        hoverTile = { x, y };
    } else {
        hoverTile = null;
    }
});

canvas.addEventListener("mouseleave", () => {
    hoverTile = null;
});

canvas.addEventListener("click", event => {
    const rect = canvas.getBoundingClientRect();
    const canvasX = event.clientX - rect.left;
    const canvasY = event.clientY - rect.top;

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
        hideAllStats();
        return;
    }

    const cost = 25;
    if (gold < cost) {
        return;
    }

    gold -= cost;
    GOLD_LABEL.textContent = gold;
    const towerData = {
        x,
        y,
        worldX: x * TILE_SIZE + TILE_CENTER_OFFSET,
        worldY: y * TILE_SIZE + TILE_CENTER_OFFSET,
        range: 140,
        fireDelay: 0.55,
        cooldown: 0,
        damage: TOWER_BASE_DAMAGE,
        level: 1,
        upgradeCost: TOWER_UPGRADE_BASE_COST
    };
    towers.push(towerData);
    showTowerStats(towerData);
});

canvas.addEventListener("contextmenu", event => {
    event.preventDefault();
    if (gameOver) {
        return;
    }
    const rect = canvas.getBoundingClientRect();
    const canvasX = event.clientX - rect.left;
    const canvasY = event.clientY - rect.top;
    const tower = getTowerAtPoint(canvasX, canvasY);
    if (!tower) {
        return;
    }
    upgradeTower(tower);
});

SPEED_BUTTONS.forEach(button => {
    button.addEventListener('click', () => {
        const multiplier = Number(button.dataset.speed) || 1;
        setGameSpeed(multiplier);
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

if (RETRY_BUTTON) {
    RETRY_BUTTON.addEventListener('click', () => {
        resetGame();
    });
}

if (CANCEL_RETRY_BUTTON) {
    CANCEL_RETRY_BUTTON.addEventListener('click', () => {
        hideDefeatDialog();
    });
}

document.addEventListener("keydown", event => {
    if (event.code === "Space") {
        if (lives === 0 || gameOver) {
            return;
        }
        paused = !paused;
        event.preventDefault();
    }
});

function canBuildAt(x, y) {
    if (x < 0 || x >= GRID_COLS || y < 0 || y >= GRID_ROWS) {
        return false;
    }
    if (pathTiles.has(keyFromGrid(x, y))) {
        return false;
    }
    return !towers.some(t => t.x === x && t.y === y);
}

function spawnEnemy() {
    const start = waypoints[0];
    const stats = getWaveEnemyStats(wave);
    enemies.push({
        x: start.x,
        y: start.y,
        speed: stats.speed,
        hp: stats.hp,
        maxHp: stats.hp,
        waypoint: 0,
        reward: stats.reward,
        waveIndex: wave
    });
}

function update(dt) {
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
                spawnCooldown = Math.max(0.6 - wave * 0.02, 0.25);
            }
        } else if (enemies.length === 0) {
            waveInProgress = false;
            nextWaveTimer = 4;
            wave += 1;
            WAVE_LABEL.textContent = wave;
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
            LIVES_LABEL.textContent = lives;
            if (lives === 0) {
                showDefeatDialog();
                return;
            }
            continue;
        }
        const dx = target.x - enemy.x;
        const dy = target.y - enemy.y;
        const dist = Math.hypot(dx, dy);
        if (dist < enemy.speed * dt) {
            enemy.x = target.x;
            enemy.y = target.y;
            enemy.waypoint += 1;
        } else {
            enemy.x += (dx / dist) * enemy.speed * dt;
            enemy.y += (dy / dist) * enemy.speed * dt;
        }
    }

    for (const tower of towers) {
        if (tower.cooldown > 0) {
            tower.cooldown -= dt;
            continue;
        }
        const target = findTarget(tower);
        if (!target) {
            continue;
        }
        fireProjectile(tower, target);
        tower.cooldown = tower.fireDelay;
    }

    for (let i = projectiles.length - 1; i >= 0; i--) {
        const projectile = projectiles[i];
        projectile.x += projectile.vx * dt;
        projectile.y += projectile.vy * dt;
        projectile.life -= dt;
        if (projectile.life <= 0) {
            projectiles.splice(i, 1);
            continue;
        }
        let hit = false;
        for (let j = enemies.length - 1; j >= 0; j--) {
            const enemy = enemies[j];
            const dx = enemy.x - projectile.x;
            const dy = enemy.y - projectile.y;
            if (dx * dx + dy * dy <= 18 * 18) {
                enemy.hp -= projectile.damage;
                if (enemy.hp <= 0) {
                    if (selectedEnemy === enemy) {
                        hideEnemyStats();
                    }
                    enemies.splice(j, 1);
                    gold += enemy.reward;
                    GOLD_LABEL.textContent = gold;
                }
                hit = true;
                break;
            }
        }
        if (hit) {
            projectiles.splice(i, 1);
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

function findTarget(tower) {
    let chosen = null;
    let bestScore = -Infinity;
    for (const enemy of enemies) {
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

function fireProjectile(tower, target) {
    const dx = target.x - tower.worldX;
    const dy = target.y - tower.worldY;
    const dist = Math.hypot(dx, dy) || 1;
    const speed = 320;
    projectiles.push({
        x: tower.worldX,
        y: tower.worldY,
        vx: (dx / dist) * speed,
        vy: (dy / dist) * speed,
        damage: tower.damage,
        life: 1.6
    });
}

function drawGrid() {
    ctx.save();
    ctx.strokeStyle = "#2a333d";
    ctx.lineWidth = 1;
    for (let x = 0; x <= GRID_COLS; x++) {
        ctx.beginPath();
        ctx.moveTo(x * TILE_SIZE + 0.5, 0);
        ctx.lineTo(x * TILE_SIZE + 0.5, GRID_ROWS * TILE_SIZE);
        ctx.stroke();
    }
    for (let y = 0; y <= GRID_ROWS; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * TILE_SIZE + 0.5);
        ctx.lineTo(GRID_COLS * TILE_SIZE, y * TILE_SIZE + 0.5);
        ctx.stroke();
    }
    ctx.restore();
}

function drawPath() {
    ctx.save();
    ctx.fillStyle = "#3b4637";
    pathTiles.forEach(key => {
        const [gx, gy] = key.split(",").map(Number);
        if (gx < 0 || gy < 0 || gx >= GRID_COLS || gy >= GRID_ROWS) {
            return;
        }
        ctx.fillRect(gx * TILE_SIZE, gy * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    });
    ctx.restore();
}

function drawTowers() {
    ctx.save();
    for (const tower of towers) {
        ctx.fillStyle = "#6296ff";
        ctx.beginPath();
        ctx.arc(tower.worldX, tower.worldY, TOWER_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#1f2f5a";
        ctx.lineWidth = 3;
        ctx.stroke();
    }
    ctx.restore();
}

function drawEnemies() {
    ctx.save();
    for (const enemy of enemies) {
        ctx.fillStyle = "#d65a57";
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, ENEMY_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#1b1f24";
        ctx.fillRect(enemy.x - 16, enemy.y - 22, 32, 6);
        ctx.fillStyle = "#2d9248";
        const w = Math.max(0, (enemy.hp / enemy.maxHp) * 32);
        ctx.fillRect(enemy.x - 16, enemy.y - 22, w, 6);
    }
    ctx.restore();
}

function drawProjectiles() {
    ctx.save();
    ctx.fillStyle = "#ffd966";
    for (const projectile of projectiles) {
        ctx.beginPath();
        ctx.arc(projectile.x, projectile.y, 6, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}

function drawHover() {
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
    if (!paused) {
        return;
    }
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#f5f5f5";
    ctx.font = "48px Segoe UI";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const label = gameOver ? "패배" : "일시 정지";
    ctx.fillText(label, canvas.width / 2, canvas.height / 2);
    ctx.restore();
}

function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawPath();
    drawGrid();
    drawHover();
    drawTowers();
    drawEnemies();
    drawProjectiles();
    drawState();
}

let lastTime = performance.now();
function loop(timestamp) {
    const dt = (timestamp - lastTime) / 1000;
    lastTime = timestamp;
    if (!paused) {
        update(dt * gameSpeed);
    }
    render();
    requestAnimationFrame(loop);
}

updateSpeedControls();
updateWavePreview();
if (WAVE_INPUT) {
    WAVE_INPUT.value = wave;
}

requestAnimationFrame(loop);




















