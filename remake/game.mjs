export const CANVAS_WIDTH = 1200;
export const CANVAS_HEIGHT = 540;

const BOARD = Object.freeze({
  top: Object.freeze({ x: 600, y: 16 }),
  right: Object.freeze({ x: 1088, y: 264 }),
  bottom: Object.freeze({ x: 600, y: 520 }),
  left: Object.freeze({ x: 112, y: 264 })
});
const MAX_SHOTS = 90;
const MAX_PARTICLES = 120;

const ART_PATHS = Object.freeze({
  field: "assets/field/rift-deck-game.webp",
  towers: Object.freeze({
    pulse: "assets/towers/pulse-game.webp",
    scatter: "assets/towers/scatter-game.webp",
    rail: "assets/towers/rail-game.webp",
    arc: "assets/towers/arc-game.webp",
    flak: "assets/towers/flak-game.webp",
    beam: "assets/towers/beam-game.webp",
    cryo: "assets/towers/cryo-game.webp",
    nova: "assets/towers/nova-game.webp"
  }),
  enemies: Object.freeze({
    drone: "assets/enemies/drone-game.webp",
    skirmisher: "assets/enemies/skirmisher-game.webp",
    armor: "assets/enemies/armor-game.webp",
    titan: "assets/enemies/titan-game.webp"
  })
});

const ART_IMAGES = {
  field: null,
  towers: new Map(),
  enemies: new Map()
};

export const MAPS = Object.freeze({
  riftline: Object.freeze({
    id: "riftline",
    name: "RIFTLINE 07",
    shortName: "Riftline",
    difficulty: "STANDARD",
    description: "긴 직선과 두 개의 굴절점. 균형 잡힌 첫 작전.",
    route: [[-0.04, 0.20], [0.22, 0.20], [0.22, 0.47], [0.48, 0.47], [0.48, 0.76], [0.73, 0.76], [0.73, 0.36], [1.04, 0.36]],
    pads: [[0.10, 0.36], [0.32, 0.13], [0.34, 0.35], [0.11, 0.60], [0.33, 0.66], [0.43, 0.26], [0.57, 0.39], [0.59, 0.65], [0.66, 0.89], [0.81, 0.64], [0.82, 0.22], [0.93, 0.51], [0.91, 0.82], [0.55, 0.91]]
  }),
  switchback: Object.freeze({
    id: "switchback",
    name: "SABLE SWITCH",
    shortName: "Switch",
    difficulty: "HARD",
    description: "짧고 촘촘한 굴절로 광역 포탑 효율이 높습니다.",
    route: [[-0.04, 0.18], [0.35, 0.18], [0.35, 0.38], [0.10, 0.38], [0.10, 0.62], [0.62, 0.62], [0.62, 0.32], [0.88, 0.32], [0.88, 0.78], [1.04, 0.78]],
    pads: [[0.13, 0.10], [0.28, 0.30], [0.47, 0.16], [0.20, 0.50], [0.44, 0.50], [0.58, 0.76], [0.70, 0.54], [0.75, 0.20], [0.97, 0.47], [0.78, 0.90], [0.48, 0.87], [0.26, 0.78], [0.05, 0.84]]
  }),
  breakwater: Object.freeze({
    id: "breakwater",
    name: "BREAKWATER",
    shortName: "Breakwater",
    difficulty: "EXPERT",
    description: "넓은 우회로와 분산된 소켓. 사거리 운용이 핵심입니다.",
    route: [[-0.04, 0.52], [0.15, 0.52], [0.15, 0.19], [0.46, 0.19], [0.46, 0.82], [0.78, 0.82], [0.78, 0.47], [1.04, 0.47]],
    pads: [[0.07, 0.34], [0.25, 0.34], [0.31, 0.10], [0.51, 0.08], [0.58, 0.30], [0.34, 0.57], [0.34, 0.89], [0.57, 0.70], [0.70, 0.92], [0.70, 0.59], [0.88, 0.31], [0.91, 0.67], [0.82, 0.13]]
  })
});

export const TOWER_TYPES = Object.freeze([
  Object.freeze({ id: "pulse", key: "1", glyph: "PX", name: "PULSE", role: "균형형 요격 포탑", cost: 60, damage: 18, range: 150, reload: 0.52, mode: "direct", motion: "turret", color: "#72e7ff", sprite: ART_PATHS.towers.pulse, spriteSize: 148, anchor: [0.5, 0.75], split: 0.62, pivot: [0, -0.18], muzzle: [0.28, -0.5] }),
  Object.freeze({ id: "scatter", key: "2", glyph: "SG", name: "SCATTER", role: "근거리 다중 탄막", cost: 80, damage: 12, range: 126, reload: 0.78, mode: "scatter", motion: "turret", color: "#ffb36b", sprite: ART_PATHS.towers.scatter, spriteSize: 150, anchor: [0.5, 0.75], split: 0.62, pivot: [0, -0.17], muzzle: [0.28, -0.47] }),
  Object.freeze({ id: "rail", key: "3", glyph: "RL", name: "RAIL", role: "초장거리 중장갑 관통", cost: 125, damage: 64, range: 245, reload: 1.65, mode: "pierce", motion: "turret", color: "#f3f7ff", sprite: ART_PATHS.towers.rail, spriteSize: 174, anchor: [0.31, 0.76], split: 0.66, pivot: [0, -0.18], muzzle: [0.58, -0.58] }),
  Object.freeze({ id: "arc", key: "4", glyph: "AR", name: "ARC", role: "연쇄 전기 공격", cost: 105, damage: 24, range: 165, reload: 0.92, mode: "chain", motion: "reactor", color: "#b58cff", sprite: ART_PATHS.towers.arc, spriteSize: 158, anchor: [0.5, 0.76], pivot: [0, -0.24], core: [0, -0.32], muzzle: [0, -0.5] }),
  Object.freeze({ id: "flak", key: "5", glyph: "FL", name: "FLAK", role: "밀집 편대 광역 제압", cost: 115, damage: 34, range: 174, reload: 1.28, mode: "splash", motion: "turret", color: "#ff745d", sprite: ART_PATHS.towers.flak, spriteSize: 166, anchor: [0.51, 0.76], split: 0.62, pivot: [0, -0.18], muzzle: [0.29, -0.5] }),
  Object.freeze({ id: "beam", key: "6", glyph: "BM", name: "BEAM", role: "고속 단일 표적 추적", cost: 110, damage: 10, range: 188, reload: 0.19, mode: "beam", motion: "turret", color: "#63f2a3", sprite: ART_PATHS.towers.beam, spriteSize: 154, anchor: [0.5, 0.79], split: 0.65, pivot: [0, -0.22], muzzle: [0.25, -0.52] }),
  Object.freeze({ id: "cryo", key: "7", glyph: "CR", name: "CRYO", role: "감속 지원 포탑", cost: 95, damage: 14, range: 178, reload: 0.72, mode: "slow", motion: "turret", color: "#69b8ff", sprite: ART_PATHS.towers.cryo, spriteSize: 158, anchor: [0.5, 0.77], split: 0.63, pivot: [0, -0.18], muzzle: [0.22, -0.44] }),
  Object.freeze({ id: "nova", key: "8", glyph: "NV", name: "NOVA", role: "고비용 전역 충격파", cost: 170, damage: 48, range: 205, reload: 1.9, mode: "nova", motion: "reactor", color: "#ff69c6", sprite: ART_PATHS.towers.nova, spriteSize: 170, anchor: [0.5, 0.77], pivot: [0, -0.22], core: [0, -0.31], muzzle: [0, -0.47] })
]);

const TOWER_BY_ID = new Map(TOWER_TYPES.map((tower) => [tower.id, tower]));

function loadImageAsset(path) {
  return new Promise((resolve) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = path;
  });
}

async function preloadArt() {
  const fieldPromise = loadImageAsset(ART_PATHS.field).then((image) => {
    ART_IMAGES.field = image;
  });
  const towerPromises = Object.entries(ART_PATHS.towers).map(([id, path]) =>
    loadImageAsset(path).then((image) => {
      if (image) ART_IMAGES.towers.set(id, image);
    })
  );
  const enemyPromises = Object.entries(ART_PATHS.enemies).map(([id, path]) =>
    loadImageAsset(path).then((image) => {
      if (image) ART_IMAGES.enemies.set(id, image);
    })
  );
  await Promise.all([fieldPromise, ...towerPromises, ...enemyPromises]);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function perspectiveScaleForY(y) {
  const depth = clamp((y - BOARD.top.y) / Math.max(1, BOARD.bottom.y - BOARD.top.y), 0, 1);
  return 0.78 + depth * 0.24;
}

function isometricRangeDistance(a, b) {
  return Math.hypot(a.x - b.x, (a.y - b.y) / 0.49);
}

export function projectBoardPoint(point) {
  const u = point[0];
  const v = point[1];
  return {
    x: BOARD.top.x + (BOARD.right.x - BOARD.top.x) * u + (BOARD.left.x - BOARD.top.x) * v,
    y: BOARD.top.y + (BOARD.right.y - BOARD.top.y) * u + (BOARD.left.y - BOARD.top.y) * v
  };
}

function absolutePoint(point) {
  return projectBoardPoint(point);
}

function absolutePadPoint(point) {
  return projectBoardPoint([0.065 + point[0] * 0.87, 0.075 + point[1] * 0.84]);
}

export function resolveMap(mapId = "riftline") {
  const source = MAPS[mapId] || MAPS.riftline;
  const points = source.route.map(absolutePoint);
  const pads = source.pads.map((point, index) => ({ ...absolutePadPoint(point), index }));
  const segments = [];
  let totalLength = 0;
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1];
    const to = points[index];
    const length = distance(from, to);
    segments.push({ from, to, length, start: totalLength });
    totalLength += length;
  }
  return { ...source, points, pads, segments, totalLength };
}

export function pointOnRoute(route, routeDistance) {
  const value = clamp(routeDistance, 0, route.totalLength);
  const segment = route.segments.find((candidate) => value <= candidate.start + candidate.length) || route.segments[route.segments.length - 1];
  const local = clamp((value - segment.start) / Math.max(1, segment.length), 0, 1);
  return {
    x: segment.from.x + (segment.to.x - segment.from.x) * local,
    y: segment.from.y + (segment.to.y - segment.from.y) * local,
    angle: Math.atan2(segment.to.y - segment.from.y, segment.to.x - segment.from.x)
  };
}

export function waveSpec(wave) {
  const safeWave = Math.max(1, Math.floor(wave || 1));
  const bossWave = safeWave % 5 === 0;
  return {
    wave: safeWave,
    count: 7 + safeWave * 2 + (bossWave ? 1 : 0),
    hp: Math.round(42 * Math.pow(1.16, safeWave - 1)),
    speed: Math.min(88, 43 + safeWave * 1.55),
    reward: 8 + Math.floor(safeWave * 0.7),
    spawnGap: Math.max(0.27, 0.72 - safeWave * 0.018),
    bossWave
  };
}

export function createGameState(mapId = "riftline") {
  const route = resolveMap(mapId);
  return {
    mapId: route.id,
    route,
    started: false,
    paused: false,
    gameOver: false,
    credits: 260,
    core: 20,
    wave: 0,
    waveActive: false,
    spawnRemaining: 0,
    spawnIndex: 0,
    spawnCooldown: 0,
    towers: [],
    enemies: [],
    shots: [],
    particles: [],
    selectedType: null,
    selectedTowerId: null,
    hoverPad: null,
    kills: 0,
    leaks: 0,
    elapsed: 0,
    nextId: 1,
    message: "방어망을 구축하세요.",
    messageTone: "neutral",
    waveTotal: 0,
    waveClearedAt: 0
  };
}

export function towerStats(tower) {
  const definition = TOWER_BY_ID.get(tower.typeId);
  const level = Math.max(1, tower.level || 1);
  return {
    damage: Math.round(definition.damage * (1 + (level - 1) * 0.42)),
    range: Math.round(definition.range * (1 + (level - 1) * 0.025)),
    reload: Math.max(0.1, definition.reload * Math.pow(0.93, level - 1))
  };
}

function towerArtHeading(definition) {
  return Math.atan2(
    definition.muzzle[1] - definition.pivot[1],
    definition.muzzle[0] - definition.pivot[0]
  );
}

export function turnTowardAngle(current, target, maxStep) {
  const turn = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  if (Math.abs(turn) <= maxStep) return target;
  return current + Math.sign(turn) * maxStep;
}

export function upgradeCost(tower) {
  const definition = TOWER_BY_ID.get(tower.typeId);
  return Math.round(definition.cost * (0.62 + tower.level * 0.58));
}

export function sellValue(tower) {
  return Math.floor((tower.spent || 0) * 0.68);
}

export function buildTower(state, typeId, padIndex) {
  const definition = TOWER_BY_ID.get(typeId);
  const pad = state.route.pads[padIndex];
  if (!definition || !pad) return { ok: false, reason: "유효하지 않은 배치입니다." };
  if (!state.started || state.gameOver) return { ok: false, reason: "작전을 먼저 전개하세요." };
  if (state.towers.some((tower) => tower.padIndex === padIndex)) return { ok: false, reason: "이미 사용 중인 소켓입니다." };
  if (state.credits < definition.cost) return { ok: false, reason: "크레딧이 부족합니다." };
  const tower = {
    id: state.nextId++,
    typeId,
    padIndex,
    x: pad.x,
    y: pad.y,
    level: 1,
    cooldown: 0,
    angle: towerArtHeading(definition),
    visualAngle: towerArtHeading(definition),
    idlePhase: padIndex * 1.73 + state.nextId * 0.61,
    tracking: 0,
    recoil: 0,
    spent: definition.cost,
    flash: 0
  };
  state.credits -= definition.cost;
  state.towers.push(tower);
  state.selectedTowerId = tower.id;
  state.selectedType = null;
  burstParticles(state, tower.x, tower.y, definition.color, 12);
  state.message = definition.name + " 배치 완료";
  state.messageTone = "good";
  return { ok: true, tower };
}

export function upgradeTower(state, towerId) {
  const tower = state.towers.find((candidate) => candidate.id === towerId);
  if (!tower) return { ok: false, reason: "선택한 포탑이 없습니다." };
  if (tower.level >= 6) return { ok: false, reason: "최대 출력에 도달했습니다." };
  const cost = upgradeCost(tower);
  if (state.credits < cost) return { ok: false, reason: "업그레이드 크레딧이 부족합니다." };
  state.credits -= cost;
  tower.level += 1;
  tower.spent += cost;
  const definition = TOWER_BY_ID.get(tower.typeId);
  burstParticles(state, tower.x, tower.y, definition.color, 16);
  state.message = definition.name + " 출력 레벨 " + tower.level;
  state.messageTone = "good";
  return { ok: true, tower, cost };
}

export function sellTower(state, towerId) {
  const index = state.towers.findIndex((candidate) => candidate.id === towerId);
  if (index < 0) return { ok: false, reason: "선택한 포탑이 없습니다." };
  const tower = state.towers[index];
  const value = sellValue(tower);
  const definition = TOWER_BY_ID.get(tower.typeId);
  state.towers.splice(index, 1);
  state.credits += value;
  state.selectedTowerId = null;
  burstParticles(state, tower.x, tower.y, definition.color, 8);
  state.message = definition.name + " 회수 +" + value;
  state.messageTone = "neutral";
  return { ok: true, value };
}

export function startWave(state) {
  if (!state.started || state.paused || state.gameOver || state.waveActive) return false;
  state.wave += 1;
  const spec = waveSpec(state.wave);
  state.waveActive = true;
  state.spawnRemaining = spec.count;
  state.spawnIndex = 0;
  state.spawnCooldown = 0;
  state.waveTotal = spec.count;
  state.message = "웨이브 " + state.wave + " 접근 중";
  state.messageTone = spec.bossWave ? "danger" : "warn";
  return true;
}

function enemyProfile(spec, index) {
  const boss = spec.bossWave && index === spec.count - 1;
  if (boss) return { kind: "titan", hp: spec.hp * 8, speed: spec.speed * 0.58, reward: spec.reward * 12, radius: 22, spriteSize: 78, coreDamage: 4, color: "#ff55c8" };
  if (index % 7 === 4) return { kind: "armor", hp: spec.hp * 2.5, speed: spec.speed * 0.68, reward: spec.reward * 2, radius: 15, spriteSize: 54, coreDamage: 2, color: "#ff8b54" };
  if (index % 5 === 2) return { kind: "skirmisher", hp: spec.hp * 0.62, speed: spec.speed * 1.55, reward: spec.reward, radius: 9, spriteSize: 39, coreDamage: 1, color: "#64f2a4" };
  return { kind: "drone", hp: spec.hp, speed: spec.speed, reward: spec.reward, radius: 12, spriteSize: 46, coreDamage: 1, color: "#ff644f" };
}

function spawnEnemy(state) {
  const spec = waveSpec(state.wave);
  const profile = enemyProfile(spec, state.spawnIndex);
  const position = pointOnRoute(state.route, 0);
  state.enemies.push({
    id: state.nextId++,
    ...profile,
    maxHp: profile.hp,
    routeDistance: 0,
    x: position.x,
    y: position.y,
    angle: position.angle,
    slowFactor: 1,
    slowTime: 0,
    hitFlash: 0,
    dead: false
  });
  state.spawnRemaining -= 1;
  state.spawnIndex += 1;
  state.spawnCooldown = spec.spawnGap;
}

function burstParticles(state, x, y, color, count) {
  for (let index = 0; index < count && state.particles.length < MAX_PARTICLES; index += 1) {
    const angle = (Math.PI * 2 * index) / Math.max(1, count) + Math.random() * 0.45;
    const speed = 18 + Math.random() * 55;
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color,
      size: 1.4 + Math.random() * 2.8,
      ttl: 0.35 + Math.random() * 0.45,
      maxTtl: 0.8
    });
  }
}

function towerMuzzle(tower, definition) {
  const size = definition.spriteSize
    * (1 + Math.max(0, tower.level - 1) * 0.018)
    * perspectiveScaleForY(tower.y);
  if (definition.motion === "reactor") {
    return {
      x: tower.x + definition.core[0] * size,
      y: tower.y + definition.core[1] * size
    };
  }
  const pivotX = definition.pivot[0] * size;
  const pivotY = definition.pivot[1] * size;
  const muzzleRadius = Math.hypot(
    definition.muzzle[0] - definition.pivot[0],
    definition.muzzle[1] - definition.pivot[1]
  ) * size;
  const angle = Number.isFinite(tower.visualAngle) ? tower.visualAngle : tower.angle;
  const recoil = clamp(tower.recoil || 0, 0, 1) * Math.min(8, size * 0.055);
  return {
    x: tower.x + pivotX + Math.cos(angle) * (muzzleRadius - recoil),
    y: tower.y + pivotY + Math.sin(angle) * (muzzleRadius - recoil)
  };
}

function addShot(state, source, target, color, width = 2.2, ttl = 0.15, style = null) {
  if (state.shots.length >= MAX_SHOTS) state.shots.splice(0, state.shots.length - MAX_SHOTS + 1);
  const definition = source.typeId ? TOWER_BY_ID.get(source.typeId) : null;
  if (definition) {
    source.angle = Math.atan2(target.y - source.y, target.x - source.x);
    source.tracking = 1;
    source.recoil = 1;
  }
  const origin = definition ? towerMuzzle(source, definition) : source;
  state.shots.push({
    x1: origin.x,
    y1: origin.y,
    x2: target.x,
    y2: target.y,
    color,
    width,
    style: style || (definition ? definition.mode : "direct"),
    seed: ((source.id || 1) * 31 + (target.id || 1) * 17) % 97,
    ttl,
    maxTtl: ttl
  });
  if (definition) {
    source.flash = 0.12;
  }
}

function dealDamage(state, enemy, amount, color) {
  if (!enemy || enemy.dead) return false;
  enemy.hp -= amount;
  enemy.hitFlash = 0.1;
  if (enemy.hp > 0) return false;
  enemy.dead = true;
  state.credits += enemy.reward;
  state.kills += 1;
  burstParticles(state, enemy.x, enemy.y, color || enemy.color, enemy.kind === "titan" ? 26 : 9);
  return true;
}

function targetsInRange(state, tower, range) {
  return state.enemies
    .filter((enemy) => !enemy.dead && isometricRangeDistance(enemy, tower) <= range)
    .sort((a, b) => b.routeDistance - a.routeDistance);
}

function leadingTargetInRange(state, tower, range) {
  let target = null;
  let progress = -Infinity;
  for (const enemy of state.enemies) {
    if (enemy.dead || enemy.routeDistance <= progress) continue;
    if (isometricRangeDistance(enemy, tower) > range) continue;
    target = enemy;
    progress = enemy.routeDistance;
  }
  return target;
}

function advanceTowerMotion(state, tower, step) {
  const definition = TOWER_BY_ID.get(tower.typeId);
  const stats = towerStats(tower);
  const target = leadingTargetInRange(state, tower, stats.range);
  const restingAngle = towerArtHeading(definition);
  const idleSweep = Math.sin(state.elapsed * 0.72 + tower.idlePhase) * (definition.motion === "reactor" ? 0.08 : 0.24);
  const desiredAngle = target
    ? Math.atan2(target.y - tower.y, target.x - tower.x)
    : restingAngle + idleSweep;
  const turnRate = definition.id === "rail" || definition.id === "flak" ? 2.35 : 3.8;

  tower.angle = desiredAngle;
  tower.visualAngle = turnTowardAngle(
    Number.isFinite(tower.visualAngle) ? tower.visualAngle : restingAngle,
    desiredAngle,
    turnRate * step
  );
  tower.tracking = clamp((tower.tracking || 0) + (target ? step * 5.5 : -step * 2.3), 0, 1);
  tower.recoil = Math.max(0, (tower.recoil || 0) - step * (definition.id === "rail" ? 2.9 : 5.8));
}

function attack(state, tower) {
  const definition = TOWER_BY_ID.get(tower.typeId);
  const stats = towerStats(tower);
  const targets = targetsInRange(state, tower, stats.range);
  if (!targets.length) return false;
  const primary = targets[0];

  if (definition.mode === "scatter") {
    const group = targets.slice(0, 3);
    for (const target of group) {
      addShot(state, tower, target, definition.color, 1.4, 0.24, definition.mode);
      dealDamage(state, target, stats.damage, definition.color);
    }
  } else if (definition.mode === "chain") {
    const group = targets.slice(0, 3);
    let previous = tower;
    group.forEach((target, index) => {
      addShot(state, previous, target, definition.color, 2.1 - index * 0.35, 0.34, definition.mode);
      dealDamage(state, target, stats.damage * (1 - index * 0.22), definition.color);
      previous = target;
    });
  } else if (definition.mode === "splash") {
    addShot(state, tower, primary, definition.color, 3.6, 0.42, definition.mode);
    dealDamage(state, primary, stats.damage, definition.color);
    for (const target of state.enemies) {
      if (target !== primary && !target.dead && Math.hypot(target.x - primary.x, target.y - primary.y) < 72) {
        dealDamage(state, target, stats.damage * 0.55, definition.color);
      }
    }
    burstParticles(state, primary.x, primary.y, definition.color, 7);
  } else if (definition.mode === "pierce") {
    addShot(state, tower, primary, definition.color, 4, 0.34, definition.mode);
    dealDamage(state, primary, stats.damage, definition.color);
    const angle = Math.atan2(primary.y - tower.y, primary.x - tower.x);
    for (const target of targets.slice(1)) {
      const targetAngle = Math.atan2(target.y - tower.y, target.x - tower.x);
      if (Math.abs(targetAngle - angle) < 0.1) dealDamage(state, target, stats.damage * 0.42, definition.color);
    }
  } else if (definition.mode === "slow") {
    addShot(state, tower, primary, definition.color, 2.5, 0.32, definition.mode);
    dealDamage(state, primary, stats.damage, definition.color);
    primary.slowFactor = 0.56;
    primary.slowTime = 1.7;
  } else if (definition.mode === "nova") {
    const group = targets.slice(0, 6);
    group.forEach((target) => {
      addShot(state, tower, target, definition.color, 2, 0.44, definition.mode);
      dealDamage(state, target, stats.damage * 0.72, definition.color);
    });
    burstParticles(state, tower.x, tower.y, definition.color, 14);
  } else {
    addShot(state, tower, primary, definition.color, definition.id === "beam" ? 2.8 : 2.1, definition.id === "beam" ? 0.16 : 0.26, definition.mode);
    dealDamage(state, primary, stats.damage, definition.color);
  }
  tower.cooldown += stats.reload;
  return true;
}

export function stepSimulation(state, dt) {
  if (!state.started || state.paused || state.gameOver) return state;
  const step = clamp(Number(dt) || 0, 0, 0.05);
  state.elapsed = (state.elapsed || 0) + step;

  if (state.waveActive && state.spawnRemaining > 0) {
    state.spawnCooldown -= step;
    if (state.spawnCooldown <= 0) spawnEnemy(state);
  }

  for (const enemy of state.enemies) {
    if (enemy.dead) continue;
    enemy.slowTime = Math.max(0, enemy.slowTime - step);
    if (enemy.slowTime <= 0) enemy.slowFactor = 1;
    enemy.hitFlash = Math.max(0, enemy.hitFlash - step);
    enemy.routeDistance += enemy.speed * enemy.slowFactor * step;
    if (enemy.routeDistance >= state.route.totalLength) {
      enemy.dead = true;
      state.core = Math.max(0, state.core - enemy.coreDamage);
      state.leaks += 1;
      state.message = "코어 피격 -" + enemy.coreDamage;
      state.messageTone = "danger";
      const end = state.route.points[state.route.points.length - 1];
      burstParticles(state, end.x, end.y, "#ff6b57", 18);
      if (state.core <= 0) {
        state.gameOver = true;
        state.waveActive = false;
        state.message = "코어가 붕괴했습니다.";
      }
      continue;
    }
    const position = pointOnRoute(state.route, enemy.routeDistance);
    enemy.x = position.x;
    enemy.y = position.y;
    enemy.angle = position.angle;
  }

  for (const tower of state.towers) {
    advanceTowerMotion(state, tower, step);
    tower.cooldown -= step;
    tower.flash = Math.max(0, tower.flash - step);
    if (tower.cooldown <= 0) attack(state, tower);
  }

  state.enemies = state.enemies.filter((enemy) => !enemy.dead);

  for (const shot of state.shots) shot.ttl -= step;
  state.shots = state.shots.filter((shot) => shot.ttl > 0);

  for (const particle of state.particles) {
    particle.ttl -= step;
    particle.x += particle.vx * step;
    particle.y += particle.vy * step;
    particle.vx *= 0.965;
    particle.vy *= 0.965;
  }
  state.particles = state.particles.filter((particle) => particle.ttl > 0);

  if (state.waveActive && state.spawnRemaining <= 0 && state.enemies.length === 0 && !state.gameOver) {
    state.waveActive = false;
    const bonus = 24 + state.wave * 5;
    state.credits += bonus;
    state.waveClearedAt = Date.now();
    state.message = "웨이브 " + state.wave + " 소거 · 보너스 +" + bonus;
    state.messageTone = "good";
  }

  return state;
}

function roundedRectPath(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

function hexPath(context, x, y, radius, rotation = Math.PI / 6) {
  context.beginPath();
  for (let index = 0; index < 6; index += 1) {
    const angle = rotation + (index * Math.PI) / 3;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (index === 0) context.moveTo(px, py);
    else context.lineTo(px, py);
  }
  context.closePath();
}

function traceRoute(context, route, verticalOffset = 0) {
  context.beginPath();
  route.points.forEach((point, index) => {
    if (index === 0) context.moveTo(point.x, point.y + verticalOffset);
    else context.lineTo(point.x, point.y + verticalOffset);
  });
}

function traceBoard(context, verticalOffset = 0) {
  context.beginPath();
  context.moveTo(BOARD.top.x, BOARD.top.y + verticalOffset);
  context.lineTo(BOARD.right.x, BOARD.right.y + verticalOffset);
  context.lineTo(BOARD.bottom.x, BOARD.bottom.y + verticalOffset);
  context.lineTo(BOARD.left.x, BOARD.left.y + verticalOffset);
  context.closePath();
}

function isoHexPath(context, x, y, radius) {
  context.save();
  context.translate(x, y);
  context.scale(1, 0.52);
  hexPath(context, 0, 0, radius);
  context.restore();
}

function drawRoutePath(context, route) {
  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";

  traceRoute(context, route, 10);
  context.strokeStyle = "rgba(0, 2, 5, 0.78)";
  context.lineWidth = 62;
  context.stroke();

  traceRoute(context, route, 5);
  context.strokeStyle = "rgba(3, 9, 13, 0.98)";
  context.lineWidth = 57;
  context.stroke();

  const laneMetal = context.createLinearGradient(0, BOARD.top.y, 0, BOARD.bottom.y);
  laneMetal.addColorStop(0, "#42616b");
  laneMetal.addColorStop(0.5, "#203b45");
  laneMetal.addColorStop(1, "#10262f");
  traceRoute(context, route);
  context.strokeStyle = laneMetal;
  context.lineWidth = 49;
  context.stroke();

  traceRoute(context, route, -2);
  context.strokeStyle = "rgba(173, 235, 244, 0.22)";
  context.lineWidth = 41;
  context.stroke();

  traceRoute(context, route);
  context.strokeStyle = "rgba(74, 169, 188, 0.28)";
  context.lineWidth = 33;
  context.stroke();

  traceRoute(context, route);
  context.strokeStyle = "rgba(192, 242, 248, 0.58)";
  context.lineWidth = 1.5;
  context.setLineDash([14, 9, 2, 9]);
  context.stroke();
  context.setLineDash([]);

  for (let routeDistance = 26; routeDistance < route.totalLength - 18; routeDistance += 31) {
    const point = pointOnRoute(route, routeDistance);
    context.save();
    context.translate(point.x, point.y);
    context.rotate(point.angle);
    context.fillStyle = "rgba(2, 9, 13, 0.32)";
    context.fillRect(-12, -22, 24, 4);
    context.fillRect(-12, 18, 24, 4);
    context.strokeStyle = "rgba(151, 224, 238, 0.2)";
    context.lineWidth = 1;
    context.strokeRect(-11.5, -17, 23, 34);
    context.restore();
  }

  context.restore();
}

function buildStaticLayer(state) {
  const layer = document.createElement("canvas");
  layer.width = CANVAS_WIDTH;
  layer.height = CANVAS_HEIGHT;
  const context = layer.getContext("2d", { alpha: true });
  const voidGradient = context.createRadialGradient(600, 300, 80, 600, 320, 760);
  voidGradient.addColorStop(0, "#0c2530");
  voidGradient.addColorStop(0.46, "#06141d");
  voidGradient.addColorStop(1, "#01060b");
  context.fillStyle = voidGradient;
  context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  for (let index = 0; index < 34; index += 1) {
    const x = 18 + ((index * 173) % 1160);
    const y = 24 + ((index * 97) % 590);
    const radius = 0.7 + (index % 4) * 0.45;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fillStyle = index % 5 === 0 ? "rgba(255, 153, 76, 0.34)" : "rgba(97, 218, 242, 0.24)";
    context.fill();
  }

  traceBoard(context, 26);
  context.fillStyle = "rgba(0, 2, 5, 0.94)";
  context.shadowColor = "rgba(0, 0, 0, 0.92)";
  context.shadowBlur = 38;
  context.shadowOffsetY = 22;
  context.fill();
  context.shadowBlur = 0;
  context.shadowOffsetY = 0;

  traceBoard(context, 17);
  context.fillStyle = "#06131a";
  context.fill();
  context.strokeStyle = "rgba(78, 158, 181, 0.38)";
  context.lineWidth = 6;
  context.stroke();

  context.save();
  traceBoard(context);
  context.clip();
  if (ART_IMAGES.field) {
    const image = ART_IMAGES.field;
    context.setTransform(
      (BOARD.right.x - BOARD.top.x) / image.naturalWidth,
      (BOARD.right.y - BOARD.top.y) / image.naturalWidth,
      (BOARD.left.x - BOARD.top.x) / image.naturalHeight,
      (BOARD.left.y - BOARD.top.y) / image.naturalHeight,
      BOARD.top.x,
      BOARD.top.y
    );
    context.drawImage(image, 0, 0);
    context.setTransform(1, 0, 0, 1, 0, 0);
  } else {
    const fallback = context.createLinearGradient(0, BOARD.top.y, 0, BOARD.bottom.y);
    fallback.addColorStop(0, "#17343b");
    fallback.addColorStop(1, "#08151b");
    context.fillStyle = fallback;
    context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  const deckShade = context.createLinearGradient(0, BOARD.top.y, 0, BOARD.bottom.y);
  deckShade.addColorStop(0, "rgba(4, 15, 20, 0.08)");
  deckShade.addColorStop(0.55, "rgba(2, 9, 14, 0.18)");
  deckShade.addColorStop(1, "rgba(0, 4, 8, 0.42)");
  context.fillStyle = deckShade;
  context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  context.strokeStyle = "rgba(151, 221, 235, 0.09)";
  context.lineWidth = 1;
  for (let value = 0.08; value < 1; value += 0.08) {
    const fromU = projectBoardPoint([value, 0]);
    const toU = projectBoardPoint([value, 1]);
    context.beginPath();
    context.moveTo(fromU.x, fromU.y);
    context.lineTo(toU.x, toU.y);
    context.stroke();
    const fromV = projectBoardPoint([0, value]);
    const toV = projectBoardPoint([1, value]);
    context.beginPath();
    context.moveTo(fromV.x, fromV.y);
    context.lineTo(toV.x, toV.y);
    context.stroke();
  }
  drawRoutePath(context, state.route);
  context.restore();

  traceBoard(context);
  context.strokeStyle = "rgba(122, 220, 241, 0.52)";
  context.lineWidth = 3;
  context.stroke();
  traceBoard(context, 7);
  context.strokeStyle = "rgba(255, 170, 77, 0.16)";
  context.lineWidth = 2;
  context.stroke();

  for (const pad of state.route.pads) {
    context.beginPath();
    context.ellipse(pad.x, pad.y + 10, 31, 12, 0, 0, Math.PI * 2);
    context.fillStyle = "rgba(0, 3, 6, 0.76)";
    context.fill();

    isoHexPath(context, pad.x, pad.y + 5, 29);
    context.fillStyle = "rgba(5, 14, 19, 0.98)";
    context.fill();
    context.strokeStyle = "rgba(2, 7, 11, 0.92)";
    context.lineWidth = 3;
    context.stroke();

    const socketMetal = context.createLinearGradient(pad.x, pad.y - 14, pad.x, pad.y + 14);
    socketMetal.addColorStop(0, "rgba(71, 104, 116, 0.98)");
    socketMetal.addColorStop(0.52, "rgba(25, 48, 57, 0.98)");
    socketMetal.addColorStop(1, "rgba(7, 17, 23, 0.98)");
    isoHexPath(context, pad.x, pad.y, 26);
    context.fillStyle = socketMetal;
    context.fill();
    context.strokeStyle = "rgba(124, 222, 241, 0.58)";
    context.lineWidth = 2;
    context.stroke();

    context.beginPath();
    context.ellipse(pad.x, pad.y, 14, 7, 0, 0, Math.PI * 2);
    context.fillStyle = "rgba(3, 11, 16, 0.82)";
    context.fill();
    context.strokeStyle = "rgba(121, 218, 239, 0.34)";
    context.lineWidth = 1.5;
    context.stroke();

    for (let index = 0; index < 6; index += 1) {
      const angle = Math.PI / 6 + index * Math.PI / 3;
      context.beginPath();
      context.arc(pad.x + Math.cos(angle) * 21, pad.y + Math.sin(angle) * 10.5, 1.5, 0, Math.PI * 2);
      context.fillStyle = index % 2 ? "rgba(255, 171, 81, 0.65)" : "rgba(137, 224, 240, 0.5)";
      context.fill();
    }
  }

  const breach = pointOnRoute(state.route, Math.min(28, state.route.totalLength));
  const core = pointOnRoute(state.route, Math.max(0, state.route.totalLength - 28));
  context.save();
  context.translate(breach.x, breach.y);
  const breachGlow = context.createRadialGradient(0, 0, 3, 0, 0, 44);
  breachGlow.addColorStop(0, "rgba(255, 93, 72, 0.48)");
  breachGlow.addColorStop(0.42, "rgba(255, 89, 64, 0.15)");
  breachGlow.addColorStop(1, "rgba(255, 89, 64, 0)");
  context.fillStyle = breachGlow;
  context.beginPath();
  context.arc(0, 0, 46, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "rgba(255, 111, 84, 0.9)";
  context.lineWidth = 4;
  context.beginPath();
  context.ellipse(0, 0, 31, 16, breach.angle, -Math.PI * 0.48, Math.PI * 0.48);
  context.stroke();
  context.strokeStyle = "rgba(255, 192, 116, 0.48)";
  context.lineWidth = 1.5;
  context.beginPath();
  context.ellipse(0, 0, 22, 11, breach.angle, -Math.PI * 0.46, Math.PI * 0.46);
  context.stroke();
  context.restore();

  context.save();
  context.translate(core.x, core.y);
  const coreGlow = context.createRadialGradient(0, 0, 3, 0, 0, 50);
  coreGlow.addColorStop(0, "rgba(108, 233, 255, 0.42)");
  coreGlow.addColorStop(0.46, "rgba(99, 222, 245, 0.11)");
  coreGlow.addColorStop(1, "rgba(99, 222, 245, 0)");
  context.fillStyle = coreGlow;
  context.beginPath();
  context.arc(0, 0, 50, 0, Math.PI * 2);
  context.fill();
  context.scale(1, 0.55);
  hexPath(context, 0, 0, 32);
  context.fillStyle = "rgba(5, 17, 24, 0.76)";
  context.fill();
  context.strokeStyle = "rgba(117, 234, 255, 0.9)";
  context.lineWidth = 3;
  context.stroke();
  hexPath(context, 0, 0, 17);
  context.strokeStyle = "rgba(255, 183, 91, 0.82)";
  context.lineWidth = 2;
  context.stroke();
  context.restore();

  context.fillStyle = "rgba(180, 229, 239, 0.76)";
  context.font = "800 10px ui-monospace, SFMono-Regular, monospace";
  context.fillText("RIFT INGRESS", 24, 32);
  context.textAlign = "right";
  context.fillText("NEXUS CORE", CANVAS_WIDTH - 24, CANVAS_HEIGHT - 22);
  context.textAlign = "left";
  return layer;
}

function drawBoardActivity(context, route, now, effectsFull) {
  context.save();
  traceBoard(context);
  context.clip();
  const scanX = -180 + ((now * 0.075) % (CANVAS_WIDTH + 360));
  const scanGradient = context.createLinearGradient(scanX - 70, 0, scanX + 70, 0);
  scanGradient.addColorStop(0, "rgba(111, 231, 255, 0)");
  scanGradient.addColorStop(0.5, "rgba(111, 231, 255, 0.075)");
  scanGradient.addColorStop(1, "rgba(111, 231, 255, 0)");
  context.fillStyle = scanGradient;
  context.transform(1, 0.32, -0.32, 1, 0, -150);
  context.fillRect(scanX - 70, 0, 140, CANVAS_HEIGHT + 300);
  context.restore();

  const pulseCount = effectsFull ? 9 : 6;
  for (let index = 0; index < pulseCount; index += 1) {
    const distanceValue = ((now * 0.052) + index * route.totalLength / pulseCount) % route.totalLength;
    const point = pointOnRoute(route, distanceValue);
    const pulse = 0.68 + Math.sin(now * 0.006 + index * 1.9) * 0.24;
    context.save();
    context.translate(point.x, point.y);
    context.rotate(point.angle);
    context.globalCompositeOperation = "lighter";
    context.globalAlpha = pulse;
    context.shadowColor = "#7beaff";
    context.shadowBlur = effectsFull ? 13 : 5;
    context.strokeStyle = index % 3 === 0 ? "#ffc06c" : "#9cf3ff";
    context.lineWidth = 2.2;
    context.beginPath();
    context.moveTo(-10, -7);
    context.lineTo(1, 0);
    context.lineTo(-10, 7);
    context.stroke();
    context.globalAlpha *= 0.32;
    context.beginPath();
    context.moveTo(-22, 0);
    context.lineTo(-5, 0);
    context.stroke();
    context.restore();
  }
}

function drawTower(context, tower, definition, selected, effectsFull, now) {
  context.save();
  const size = definition.spriteSize
    * (1 + Math.max(0, tower.level - 1) * 0.018)
    * perspectiveScaleForY(tower.y);
  const phase = (now || 0) * 0.001 + tower.idlePhase;
  const bob = Math.sin(phase * 1.8) * (definition.motion === "reactor" ? 2.1 : 1.25) - (tower.recoil || 0) * 1.8;
  const tracking = clamp(tower.tracking || 0, 0, 1);
  context.translate(tower.x, tower.y + bob);

  if (selected) {
    const stats = towerStats(tower);
    context.beginPath();
    context.ellipse(0, -bob, stats.range, stats.range * 0.49, 0, 0, Math.PI * 2);
    context.fillStyle = "rgba(111, 231, 255, 0.025)";
    context.fill();
    context.strokeStyle = "rgba(111, 231, 255, 0.38)";
    context.lineWidth = 1.8;
    context.setLineDash([7, 9]);
    context.stroke();
    context.setLineDash([]);
  }

  context.beginPath();
  context.ellipse(0, 16 - bob, size * 0.3, size * 0.09, 0, 0, Math.PI * 2);
  context.fillStyle = "rgba(0, 3, 6, 0.7)";
  context.fill();

  context.save();
  context.scale(1, 0.5);
  context.rotate(phase * 0.18);
  context.beginPath();
  context.arc(0, 10, size * 0.245, phase % (Math.PI * 2), phase % (Math.PI * 2) + Math.PI * 0.72);
  context.strokeStyle = definition.color;
  context.globalAlpha = 0.18 + tracking * 0.28;
  context.lineWidth = selected ? 5 : 3;
  context.stroke();
  context.restore();

  context.beginPath();
  context.ellipse(0, 9, size * 0.245, size * 0.085, 0, 0, Math.PI * 2);
  context.fillStyle = "rgba(5, 14, 19, 0.94)";
  context.fill();
  context.strokeStyle = selected ? definition.color : "rgba(132, 221, 238, 0.28)";
  context.lineWidth = selected ? 3 : 1.5;
  context.stroke();

  const image = ART_IMAGES.towers.get(definition.id);
  if (image) {
    if (effectsFull) {
      context.shadowColor = definition.color;
      context.shadowBlur = tower.flash > 0 ? 22 : 5;
    }
    const anchorX = definition.anchor[0];
    const anchorY = definition.anchor[1];
    if (definition.motion === "turret") {
      const split = definition.split;
      const overlap = 0.055;
      const baseStart = Math.max(0, split - overlap);
      const pivotX = definition.pivot[0] * size;
      const pivotY = definition.pivot[1] * size;
      const artHeading = towerArtHeading(definition);
      const visualAngle = Number.isFinite(tower.visualAngle) ? tower.visualAngle : artHeading;
      const rotation = Math.atan2(Math.sin(visualAngle - artHeading), Math.cos(visualAngle - artHeading));
      const recoil = clamp(tower.recoil || 0, 0, 1) * Math.min(8, size * 0.055);

      context.drawImage(
        image,
        0,
        image.naturalHeight * baseStart,
        image.naturalWidth,
        image.naturalHeight * (1 - baseStart),
        -anchorX * size,
        (baseStart - anchorY) * size,
        size,
        (1 - baseStart) * size
      );

      context.save();
      context.translate(pivotX, pivotY);
      context.translate(-Math.cos(visualAngle) * recoil, -Math.sin(visualAngle) * recoil);
      context.rotate(rotation);
      context.drawImage(
        image,
        0,
        0,
        image.naturalWidth,
        image.naturalHeight * split,
        -anchorX * size - pivotX,
        -anchorY * size - pivotY,
        size,
        split * size
      );
      context.restore();

      context.beginPath();
      context.ellipse(pivotX, pivotY + size * 0.045, size * 0.12, size * 0.042, 0, 0, Math.PI * 2);
      context.strokeStyle = definition.color;
      context.globalAlpha = 0.16 + tracking * 0.34;
      context.lineWidth = 1.5;
      context.stroke();
      context.globalAlpha = 1;
    } else {
      context.drawImage(image, -anchorX * size, -anchorY * size, size, size);
      const coreX = definition.core[0] * size;
      const coreY = definition.core[1] * size;
      const corePulse = 0.5 + Math.sin(phase * 3.4) * 0.5;
      context.save();
      context.translate(coreX, coreY);
      context.rotate(phase * (definition.id === "nova" ? -0.72 : 0.92));
      context.globalAlpha = 0.42 + corePulse * 0.34;
      context.strokeStyle = definition.color;
      context.lineWidth = 2.2;
      context.setLineDash([8, 6]);
      context.beginPath();
      context.arc(0, 0, size * (0.09 + corePulse * 0.018), 0, Math.PI * 1.45);
      context.stroke();
      context.setLineDash([]);
      for (let index = 0; index < 3; index += 1) {
        const angle = index * Math.PI * 2 / 3;
        context.beginPath();
        context.arc(Math.cos(angle) * size * 0.12, Math.sin(angle) * size * 0.055, 1.8 + corePulse, 0, Math.PI * 2);
        context.fillStyle = "#ffffff";
        context.fill();
      }
      context.restore();
    }
    context.shadowBlur = 0;
  } else {
    const fallback = context.createLinearGradient(-24, -28, 22, 24);
    fallback.addColorStop(0, "#dae6eb");
    fallback.addColorStop(0.42, "#536673");
    fallback.addColorStop(1, "#14212a");
    hexPath(context, 0, 0, 29);
    context.fillStyle = fallback;
    context.fill();
    context.strokeStyle = definition.color;
    context.lineWidth = 2;
    context.stroke();
    context.save();
    context.rotate(tower.visualAngle);
    roundedRectPath(context, -8, -8, 42, 16, 5);
    context.fillStyle = "#d8e3e7";
    context.fill();
    context.restore();
  }

  if (tower.flash > 0) {
    const muzzle = towerMuzzle(tower, definition);
    const muzzleX = muzzle.x - tower.x;
    const muzzleY = muzzle.y - tower.y - bob;
    const flashRatio = clamp(tower.flash / 0.12, 0, 1);
    const flash = context.createRadialGradient(muzzleX, muzzleY, 0, muzzleX, muzzleY, 19);
    flash.addColorStop(0, "rgba(255,255,255," + flashRatio + ")");
    flash.addColorStop(0.25, definition.color);
    flash.addColorStop(1, "rgba(255,255,255,0)");
    context.globalAlpha = 0.95 * flashRatio;
    context.fillStyle = flash;
    context.beginPath();
    context.arc(muzzleX, muzzleY, 19, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = flashRatio * 0.72;
    context.save();
    context.translate(muzzleX, muzzleY);
    context.rotate(tower.visualAngle);
    context.fillStyle = "#ffffff";
    context.beginPath();
    context.moveTo(0, -5);
    context.lineTo(30 + flashRatio * 16, 0);
    context.lineTo(0, 5);
    context.closePath();
    context.fill();
    context.restore();
    context.globalAlpha = 1;
  }

  const pips = Math.min(6, tower.level);
  const startX = -(pips - 1) * 3.6;
  for (let index = 0; index < pips; index += 1) {
    context.beginPath();
    context.arc(startX + index * 7.2, 30, 2.1, 0, Math.PI * 2);
    context.fillStyle = definition.color;
    context.fill();
  }

  if (selected) {
    roundedRectPath(context, -18, 35, 36, 16, 8);
    context.fillStyle = "rgba(2, 9, 14, 0.92)";
    context.fill();
    context.strokeStyle = definition.color;
    context.lineWidth = 1;
    context.stroke();
    context.fillStyle = "#effaff";
    context.font = "800 9px ui-monospace, SFMono-Regular, monospace";
    context.textAlign = "center";
    context.fillText("L" + tower.level, 0, 46);
    context.textAlign = "left";
  }
  context.restore();
}

function drawEnemy(context, enemy, effectsFull) {
  context.save();
  context.translate(enemy.x, enemy.y);
  const size = (enemy.spriteSize || (enemy.kind === "titan" ? 78 : 46)) * perspectiveScaleForY(enemy.y);

  context.beginPath();
  context.ellipse(0, size * 0.18, size * 0.32, size * 0.12, 0, 0, Math.PI * 2);
  context.fillStyle = "rgba(0, 2, 5, 0.64)";
  context.fill();

  context.rotate(enemy.angle);
  if (effectsFull) {
    context.shadowColor = enemy.color;
    context.shadowBlur = enemy.kind === "titan" ? 18 : 8;
  }
  const image = ART_IMAGES.enemies.get(enemy.kind);
  if (image) {
    context.globalAlpha = enemy.hitFlash > 0 ? 0.58 : 1;
    context.drawImage(image, -size / 2, -size / 2, size, size);
    if (enemy.hitFlash > 0) {
      context.globalCompositeOperation = "lighter";
      context.globalAlpha = 0.72;
      context.drawImage(image, -size / 2, -size / 2, size, size);
    }
  } else {
    const radius = enemy.radius;
    context.beginPath();
    context.moveTo(radius * 1.35, 0);
    context.lineTo(-radius * 0.8, -radius * 0.86);
    context.lineTo(-radius * 0.45, 0);
    context.lineTo(-radius * 0.8, radius * 0.86);
    context.closePath();
    context.fillStyle = enemy.hitFlash > 0 ? "#ffffff" : enemy.color;
    context.fill();
  }
  context.globalCompositeOperation = "source-over";
  context.globalAlpha = 1;
  context.shadowBlur = 0;
  context.restore();

  const ratio = clamp(enemy.hp / enemy.maxHp, 0, 1);
  const width = enemy.kind === "titan" ? 62 : enemy.kind === "armor" ? 42 : 34;
  const barY = enemy.y - size * 0.42 - 8;
  roundedRectPath(context, enemy.x - width / 2 - 2, barY - 2, width + 4, 7, 3.5);
  context.fillStyle = "rgba(0, 3, 6, 0.82)";
  context.fill();
  context.fillStyle = "rgba(255,255,255,.13)";
  context.fillRect(enemy.x - width / 2, barY, width, 3);
  context.fillStyle = ratio > 0.45 ? "#76efb1" : ratio > 0.2 ? "#ffb15d" : "#ff715f";
  context.fillRect(enemy.x - width / 2, barY, width * ratio, 3);
}

function drawShot(context, shot, effectsFull) {
  const alpha = clamp(shot.ttl / shot.maxTtl, 0, 1);
  const dx = shot.x2 - shot.x1;
  const dy = shot.y2 - shot.y1;
  const length = Math.max(1, Math.hypot(dx, dy));
  const normalX = -dy / length;
  const normalY = dx / length;
  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";
  if (effectsFull) {
    context.shadowColor = shot.color;
    context.shadowBlur = shot.style === "beam" || shot.style === "pierce" ? 16 : 10;
  }

  if (shot.style === "chain") {
    const segments = Math.max(5, Math.min(11, Math.round(length / 24)));
    context.beginPath();
    context.moveTo(shot.x1, shot.y1);
    for (let index = 1; index < segments; index += 1) {
      const ratio = index / segments;
      const jitter = Math.sin((index + shot.seed) * 2.37) * (3 + (index % 3)) * Math.sin(ratio * Math.PI);
      context.lineTo(shot.x1 + dx * ratio + normalX * jitter, shot.y1 + dy * ratio + normalY * jitter);
    }
    context.lineTo(shot.x2, shot.y2);
    context.globalAlpha = alpha * 0.28;
    context.strokeStyle = shot.color;
    context.lineWidth = shot.width + 5;
    context.stroke();
    context.globalAlpha = alpha;
    context.strokeStyle = "#f4eaff";
    context.lineWidth = Math.max(1, shot.width * 0.66);
    context.stroke();
  } else if (shot.style === "beam") {
    context.beginPath();
    context.moveTo(shot.x1, shot.y1);
    context.lineTo(shot.x2, shot.y2);
    context.globalAlpha = alpha * 0.2;
    context.strokeStyle = shot.color;
    context.lineWidth = 12;
    context.stroke();
    context.globalAlpha = alpha * 0.68;
    context.lineWidth = 5;
    context.stroke();
    context.globalAlpha = alpha;
    context.strokeStyle = "#ecfff8";
    context.lineWidth = 1.4;
    context.stroke();
  } else if (shot.style === "pierce") {
    const endX = shot.x2 + (dx / length) * 48;
    const endY = shot.y2 + (dy / length) * 48;
    context.beginPath();
    context.moveTo(shot.x1, shot.y1);
    context.lineTo(endX, endY);
    context.globalAlpha = alpha * 0.18;
    context.strokeStyle = shot.color;
    context.lineWidth = 15;
    context.stroke();
    context.globalAlpha = alpha * 0.72;
    context.lineWidth = 5;
    context.stroke();
    context.globalAlpha = alpha;
    context.strokeStyle = "#ffffff";
    context.lineWidth = 1.8;
    context.stroke();
  } else {
    context.beginPath();
    context.moveTo(shot.x1, shot.y1);
    context.lineTo(shot.x2, shot.y2);
    context.globalAlpha = alpha * 0.2;
    context.strokeStyle = shot.color;
    context.lineWidth = shot.width + (shot.style === "splash" ? 7 : 4);
    context.stroke();
    context.globalAlpha = alpha;
    context.strokeStyle = shot.color;
    context.lineWidth = shot.width;
    context.stroke();
  }

  context.shadowBlur = 0;

  if (shot.style === "splash") {
    const radius = 12 + (1 - alpha) * 34;
    context.globalAlpha = alpha * 0.72;
    context.beginPath();
    context.arc(shot.x2, shot.y2, radius, 0, Math.PI * 2);
    context.strokeStyle = shot.color;
    context.lineWidth = 3;
    context.stroke();
    context.globalAlpha = alpha * 0.28;
    context.beginPath();
    context.arc(shot.x2, shot.y2, radius * 0.62, 0, Math.PI * 2);
    context.fillStyle = shot.color;
    context.fill();
  } else if (shot.style === "slow") {
    context.save();
    context.translate(shot.x2, shot.y2);
    context.globalAlpha = alpha * 0.9;
    context.strokeStyle = "#e7f7ff";
    context.lineWidth = 1.4;
    for (let index = 0; index < 6; index += 1) {
      context.rotate(Math.PI / 3);
      context.beginPath();
      context.moveTo(0, 0);
      context.lineTo(0, 10 + (1 - alpha) * 7);
      context.stroke();
    }
    context.restore();
  } else if (shot.style === "nova") {
    context.globalAlpha = alpha * 0.48;
    context.beginPath();
    context.arc(shot.x1, shot.y1, 24 + (1 - alpha) * 78, 0, Math.PI * 2);
    context.strokeStyle = shot.color;
    context.lineWidth = 4;
    context.stroke();
  }

  const impact = context.createRadialGradient(shot.x2, shot.y2, 0, shot.x2, shot.y2, 13 + shot.width * 2);
  impact.addColorStop(0, "rgba(255,255,255," + Math.min(1, alpha * 1.2) + ")");
  impact.addColorStop(0.22, shot.color);
  impact.addColorStop(1, "rgba(255,255,255,0)");
  context.globalAlpha = Math.min(1, alpha * 0.9);
  context.beginPath();
  context.arc(shot.x2, shot.y2, 13 + shot.width * 2, 0, Math.PI * 2);
  context.fillStyle = impact;
  context.fill();
  context.restore();
}

function drawParticle(context, particle) {
  const alpha = clamp(particle.ttl / particle.maxTtl, 0, 1);
  context.save();
  context.translate(particle.x, particle.y);
  context.rotate(Math.atan2(particle.vy, particle.vx));
  context.globalAlpha = alpha * 0.38;
  context.fillStyle = particle.color;
  roundedRectPath(context, -particle.size * 2.5, -particle.size, particle.size * 5, particle.size * 2, particle.size);
  context.fill();
  context.globalAlpha = alpha;
  context.fillStyle = "#ffffff";
  roundedRectPath(context, -particle.size * 1.4, -0.55, particle.size * 2.8, 1.1, 0.55);
  context.fill();
  context.restore();
}

function bootGame() {
  const canvas = document.getElementById("battlefield");
  const context = canvas && canvas.getContext("2d", { alpha: true, desynchronized: true });
  if (!canvas || !context) return;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  const ui = {
    statWave: document.getElementById("stat-wave"),
    statCore: document.getElementById("stat-core"),
    statCredits: document.getElementById("stat-credits"),
    statThreat: document.getElementById("stat-threat"),
    perfReadout: document.getElementById("perf-readout"),
    fxToggle: document.getElementById("fx-toggle"),
    pauseButton: document.getElementById("pause-button"),
    sectorName: document.getElementById("sector-name"),
    battleStatus: document.getElementById("battle-status"),
    waveButton: document.getElementById("wave-button"),
    missionBrief: document.getElementById("mission-brief"),
    mapOptions: document.getElementById("map-options"),
    deployButton: document.getElementById("deploy-button"),
    endCard: document.getElementById("end-card"),
    endSummary: document.getElementById("end-summary"),
    retryButton: document.getElementById("retry-button"),
    missionMessage: document.getElementById("mission-message"),
    fieldCallout: document.getElementById("field-callout"),
    missionIntel: document.getElementById("mission-intel"),
    towerIntel: document.getElementById("tower-intel"),
    intelTitle: document.getElementById("intel-title"),
    intelCopy: document.getElementById("intel-copy"),
    intelRoute: document.getElementById("intel-route"),
    intelPads: document.getElementById("intel-pads"),
    intelWave: document.getElementById("intel-wave"),
    towerMark: document.getElementById("tower-mark"),
    towerName: document.getElementById("tower-name"),
    towerRole: document.getElementById("tower-role"),
    towerLevel: document.getElementById("tower-level"),
    towerDamage: document.getElementById("tower-damage"),
    towerRange: document.getElementById("tower-range"),
    towerReload: document.getElementById("tower-reload"),
    upgradeButton: document.getElementById("upgrade-button"),
    upgradeCost: document.getElementById("upgrade-cost"),
    sellButton: document.getElementById("sell-button"),
    sellValue: document.getElementById("sell-value"),
    forecastCount: document.getElementById("forecast-count"),
    forecastCopy: document.getElementById("forecast-copy"),
    threatFill: document.getElementById("threat-fill"),
    towerList: document.getElementById("tower-list"),
    dockTip: document.getElementById("dock-tip"),
    toast: document.getElementById("toast")
  };

  let selectedMapId = "riftline";
  let state = createGameState(selectedMapId);
  let staticLayer = buildStaticLayer(state);
  let effectsFull = false;
  let lastFrameAt = performance.now();
  let lastRenderAt = 0;
  let lastUiAt = 0;
  let lastPerfAt = 0;
  let renderInterval = 1000 / 60;
  let frameSamples = [];
  let toastTimer = 0;
  let calloutTimer = 0;
  let visibilityPaused = false;
  let gameOverShown = false;

  function selectedTower() {
    return state.towers.find((tower) => tower.id === state.selectedTowerId) || null;
  }

  function rebuildStatic() {
    staticLayer = buildStaticLayer(state);
  }

  function showToast(message) {
    window.clearTimeout(toastTimer);
    ui.toast.textContent = message;
    ui.toast.classList.add("visible");
    toastTimer = window.setTimeout(() => ui.toast.classList.remove("visible"), 1700);
  }

  function showCallout(message) {
    window.clearTimeout(calloutTimer);
    ui.fieldCallout.textContent = message;
    ui.fieldCallout.classList.add("visible");
    calloutTimer = window.setTimeout(() => ui.fieldCallout.classList.remove("visible"), 2200);
  }

  function refreshMapOptions() {
    ui.mapOptions.replaceChildren();
    Object.values(MAPS).forEach((map) => {
      const button = document.createElement("button");
      button.className = "map-option";
      button.type = "button";
      button.setAttribute("role", "radio");
      button.setAttribute("aria-checked", String(map.id === selectedMapId));
      button.dataset.mapId = map.id;
      const copy = document.createElement("span");
      const name = document.createElement("strong");
      const description = document.createElement("span");
      const difficulty = document.createElement("b");
      name.textContent = map.shortName;
      description.textContent = map.description;
      difficulty.textContent = map.difficulty;
      copy.append(name, description);
      button.append(copy, difficulty);
      button.addEventListener("click", () => {
        selectedMapId = map.id;
        state = createGameState(selectedMapId);
        rebuildStatic();
        refreshMapOptions();
        updateUi(true);
      });
      ui.mapOptions.append(button);
    });
  }

  const towerButtons = new Map();
  function refreshTowerCards() {
    ui.towerList.replaceChildren();
    TOWER_TYPES.forEach((definition) => {
      const button = document.createElement("button");
      button.className = "tower-card";
      button.type = "button";
      button.setAttribute("role", "radio");
      button.setAttribute("aria-checked", "false");
      button.style.setProperty("--tower-color", definition.color);
      button.dataset.towerId = definition.id;

      const glyph = document.createElement("span");
      glyph.className = "tower-glyph";
      const thumbnail = document.createElement("img");
      thumbnail.className = "tower-thumb";
      thumbnail.src = definition.sprite;
      thumbnail.alt = "";
      thumbnail.decoding = "async";
      const code = document.createElement("span");
      code.className = "tower-code";
      code.textContent = definition.glyph;
      glyph.append(thumbnail, code);
      const name = document.createElement("strong");
      name.textContent = definition.name;
      const cost = document.createElement("small");
      cost.textContent = "C " + definition.cost;
      const key = document.createElement("span");
      key.className = "tower-key";
      key.textContent = definition.key;
      button.append(glyph, name, cost, key);
      button.addEventListener("click", () => selectTowerType(definition.id));
      towerButtons.set(definition.id, button);
      ui.towerList.append(button);
    });
  }

  function selectTowerType(typeId) {
    const definition = TOWER_BY_ID.get(typeId);
    if (!definition) return;
    if (!state.started) {
      showToast("먼저 방어선을 전개하세요.");
      return;
    }
    state.selectedType = state.selectedType === typeId ? null : typeId;
    state.selectedTowerId = null;
    if (state.selectedType) {
      showCallout(definition.name + " 선택 · 점등된 소켓에 배치");
      ui.dockTip.textContent = definition.role;
    } else {
      ui.dockTip.textContent = "포탑을 선택하세요";
    }
    updateUi(true);
  }

  function deploy() {
    state = createGameState(selectedMapId);
    state.started = true;
    state.message = "포탑을 배치한 뒤 웨이브를 시작하세요.";
    rebuildStatic();
    ui.missionBrief.classList.add("hidden");
    ui.endCard.classList.add("hidden");
    gameOverShown = false;
    showToast(MAPS[selectedMapId].name + " 방어선 전개");
    updateUi(true);
    canvas.focus({ preventScroll: true });
  }

  function resetToBrief() {
    state = createGameState(selectedMapId);
    rebuildStatic();
    gameOverShown = false;
    ui.endCard.classList.add("hidden");
    ui.missionBrief.classList.remove("hidden");
    refreshMapOptions();
    updateUi(true);
  }

  function runUpgrade() {
    const tower = selectedTower();
    const result = upgradeTower(state, tower && tower.id);
    if (!result.ok) showToast(result.reason);
    else showToast("출력 레벨 " + result.tower.level + " 동기화");
    updateUi(true);
  }

  function runSell() {
    const tower = selectedTower();
    const result = sellTower(state, tower && tower.id);
    if (!result.ok) showToast(result.reason);
    else showToast("포탑 회수 +" + result.value);
    updateUi(true);
  }

  function togglePause() {
    if (!state.started || state.gameOver) return;
    state.paused = !state.paused;
    state.message = state.paused ? "전술 시간 정지" : "작전 재개";
    state.messageTone = "neutral";
    updateUi(true);
  }

  function launchWave() {
    if (startWave(state)) {
      const spec = waveSpec(state.wave);
      showToast(spec.bossWave ? "타이탄 신호 감지" : "웨이브 " + state.wave + " 접근");
    }
    updateUi(true);
  }

  function pointerPosition(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / Math.max(1, rect.width)) * CANVAS_WIDTH,
      y: ((event.clientY - rect.top) / Math.max(1, rect.height)) * CANVAS_HEIGHT
    };
  }

  function nearestPad(point) {
    let closest = null;
    let closestDistance = 36;
    for (const pad of state.route.pads) {
      const value = Math.hypot(point.x - pad.x, point.y - pad.y);
      if (value < closestDistance) {
        closest = pad;
        closestDistance = value;
      }
    }
    return closest;
  }

  function towerAt(point) {
    return state.towers.find((tower) => Math.hypot(point.x - tower.x, point.y - tower.y) < 29) || null;
  }

  canvas.addEventListener("pointermove", (event) => {
    const point = pointerPosition(event);
    const pad = nearestPad(point);
    state.hoverPad = pad ? pad.index : null;
  }, { passive: true });

  canvas.addEventListener("pointerleave", () => {
    state.hoverPad = null;
  });

  canvas.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    if (!state.started || state.gameOver) return;
    const point = pointerPosition(event);
    const tower = towerAt(point);
    if (tower) {
      state.selectedTowerId = tower.id;
      state.selectedType = null;
      updateUi(true);
      return;
    }
    const pad = nearestPad(point);
    if (!pad) {
      state.selectedTowerId = null;
      updateUi(true);
      return;
    }
    if (!state.selectedType) {
      showToast("병기고에서 포탑을 먼저 선택하세요.");
      return;
    }
    const result = buildTower(state, state.selectedType, pad.index);
    if (!result.ok) showToast(result.reason);
    else showToast(TOWER_BY_ID.get(result.tower.typeId).name + " 온라인");
    updateUi(true);
  });

  ui.deployButton.addEventListener("click", deploy);
  ui.retryButton.addEventListener("click", resetToBrief);
  ui.waveButton.addEventListener("click", launchWave);
  ui.pauseButton.addEventListener("click", togglePause);
  ui.upgradeButton.addEventListener("click", runUpgrade);
  ui.sellButton.addEventListener("click", runSell);
  ui.fxToggle.addEventListener("click", () => {
    effectsFull = !effectsFull;
    ui.fxToggle.setAttribute("aria-pressed", String(effectsFull));
    ui.fxToggle.textContent = effectsFull ? "FX FULL" : "FX ECO";
    showToast(effectsFull ? "고급 효과 활성화" : "절전 효과 활성화");
  });

  window.addEventListener("keydown", (event) => {
    if (event.target && ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName)) return;
    const tower = TOWER_TYPES.find((definition) => definition.key === event.key);
    if (tower) {
      event.preventDefault();
      selectTowerType(tower.id);
      return;
    }
    if (event.code === "Space") {
      event.preventDefault();
      togglePause();
    } else if (event.key.toLowerCase() === "w") {
      event.preventDefault();
      launchWave();
    } else if (event.key.toLowerCase() === "u") {
      event.preventDefault();
      runUpgrade();
    } else if (event.key.toLowerCase() === "s") {
      event.preventDefault();
      runSell();
    } else if (event.key === "Escape") {
      state.selectedType = null;
      state.selectedTowerId = null;
      updateUi(true);
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state.started && !state.paused) {
      visibilityPaused = true;
      state.paused = true;
    } else if (!document.hidden && visibilityPaused) {
      visibilityPaused = false;
      state.paused = false;
      lastFrameAt = performance.now();
    }
  });

  function drawFrame(now) {
    context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    context.drawImage(staticLayer, 0, 0);
    drawBoardActivity(context, state.route, now, effectsFull);

    const occupiedPads = new Set(state.towers.map((tower) => tower.padIndex));
    if (state.selectedType) {
      const definition = TOWER_BY_ID.get(state.selectedType);
      for (const pad of state.route.pads) {
        if (occupiedPads.has(pad.index)) continue;
        const hovered = pad.index === state.hoverPad;
        const pulse = 0.5 + Math.sin(now * 0.006 + pad.index) * 0.5;
        context.save();
        context.globalAlpha = hovered ? 0.98 : 0.42 + pulse * 0.16;
        context.beginPath();
        context.ellipse(pad.x, pad.y, hovered ? 38 : 31 + pulse * 2, hovered ? 18 : 14 + pulse, 0, 0, Math.PI * 2);
        context.fillStyle = hovered ? definition.color : "rgba(111, 231, 255, 0.08)";
        context.fill();
        isoHexPath(context, pad.x, pad.y, hovered ? 32 : 28);
        context.strokeStyle = definition.color;
        context.lineWidth = hovered ? 3 : 1.7;
        context.stroke();
        context.restore();
      }
    }

    const chosen = selectedTower();
    const entities = [
      ...state.towers.map((tower) => ({ kind: "tower", y: tower.y, value: tower })),
      ...state.enemies.map((enemy) => ({ kind: "enemy", y: enemy.y, value: enemy }))
    ].sort((left, right) => left.y - right.y);
    for (const entity of entities) {
      if (entity.kind === "tower") {
        const tower = entity.value;
        drawTower(context, tower, TOWER_BY_ID.get(tower.typeId), Boolean(chosen && chosen.id === tower.id), effectsFull, now);
      } else {
        drawEnemy(context, entity.value, effectsFull);
      }
    }
    state.shots.forEach((shot) => drawShot(context, shot, effectsFull));
    state.particles.forEach((particle) => drawParticle(context, particle));

    const core = pointOnRoute(state.route, Math.max(0, state.route.totalLength - 28));
    const pulse = 0.5 + Math.sin(now * 0.004) * 0.5;
    context.beginPath();
    context.ellipse(core.x, core.y, 35 + pulse * 7, 17 + pulse * 3.5, 0, 0, Math.PI * 2);
    context.strokeStyle = state.core <= 6 ? "rgba(255, 107, 87, " + (0.35 + pulse * 0.4) + ")" : "rgba(111, 231, 255, " + (0.22 + pulse * 0.22) + ")";
    context.lineWidth = 2;
    context.stroke();

    if (state.paused && state.started && !state.gameOver) {
      context.fillStyle = "rgba(2, 8, 12, 0.58)";
      context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      context.textAlign = "center";
      context.fillStyle = "#eef7fb";
      context.font = "800 34px system-ui, sans-serif";
      context.fillText("TACTICAL HOLD", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 4);
      context.fillStyle = "#8ea2ad";
      context.font = "600 13px system-ui, sans-serif";
      context.fillText("Space 또는 상단 버튼으로 작전을 재개하세요", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 26);
      context.textAlign = "left";
    }
  }

  function updateUi(force = false) {
    const tower = selectedTower();
    const next = waveSpec(state.wave + 1);
    const remaining = state.spawnRemaining + state.enemies.length;
    const threatRatio = state.waveActive ? clamp(remaining / Math.max(1, state.waveTotal), 0, 1) : 0;

    ui.statWave.textContent = String(state.wave);
    ui.statCore.textContent = String(state.core);
    ui.statCredits.textContent = String(state.credits);
    ui.statThreat.textContent = !state.started ? "대기" : state.gameOver ? "붕괴" : state.waveActive ? (remaining > 12 ? "고조" : "접촉") : "안정";
    ui.sectorName.textContent = state.route.name;
    ui.battleStatus.textContent = !state.started ? "배치 대기" : state.paused ? "시간 정지" : state.waveActive ? "교전 중 · " + remaining : "방어망 구축";
    ui.battleStatus.classList.toggle("active", state.waveActive);
    ui.waveButton.disabled = !state.started || state.paused || state.waveActive || state.gameOver;
    ui.pauseButton.disabled = !state.started || state.gameOver;
    ui.pauseButton.setAttribute("aria-pressed", String(state.paused));
    ui.pauseButton.textContent = state.paused ? "▶" : "Ⅱ";
    ui.missionMessage.textContent = state.message;
    ui.forecastCount.textContent = String(next.count);
    ui.forecastCopy.textContent = next.bossWave ? "타이탄 동반 편대" : "예상 적 개체";
    ui.threatFill.style.width = (threatRatio * 100).toFixed(1) + "%";

    for (const definition of TOWER_TYPES) {
      const button = towerButtons.get(definition.id);
      button.setAttribute("aria-checked", String(state.selectedType === definition.id));
      button.classList.toggle("poor", state.started && state.credits < definition.cost);
    }

    if (tower) {
      const definition = TOWER_BY_ID.get(tower.typeId);
      const stats = towerStats(tower);
      const cost = upgradeCost(tower);
      ui.missionIntel.classList.add("hidden");
      ui.towerIntel.classList.remove("hidden");
      ui.towerMark.textContent = "";
      ui.towerMark.style.backgroundImage = "url(" + definition.sprite + ")";
      ui.towerMark.style.color = definition.color;
      ui.towerMark.style.borderColor = definition.color;
      ui.towerName.textContent = definition.name;
      ui.towerRole.textContent = definition.role;
      ui.towerLevel.textContent = tower.level + " / 6";
      ui.towerDamage.textContent = String(stats.damage);
      ui.towerRange.textContent = String(stats.range);
      ui.towerReload.textContent = stats.reload.toFixed(2) + "s";
      ui.upgradeCost.textContent = tower.level >= 6 ? "MAX" : "C " + cost;
      ui.sellValue.textContent = "C " + sellValue(tower);
      ui.upgradeButton.disabled = tower.level >= 6 || state.credits < cost;
    } else {
      ui.missionIntel.classList.remove("hidden");
      ui.towerIntel.classList.add("hidden");
      ui.intelTitle.textContent = !state.started ? "방어망 구축" : state.waveActive ? "접촉 유지" : "다음 웨이브 준비";
      ui.intelCopy.textContent = !state.started
        ? "전장을 선택하고 전개한 뒤, 하단 병기고에서 포탑을 선택하세요."
        : state.selectedType
          ? TOWER_BY_ID.get(state.selectedType).role + " · 빈 소켓을 선택하세요."
          : state.waveActive
            ? "선두 표적을 자동 추적 중입니다. 포탑을 선택해 즉시 강화할 수 있습니다."
            : "포탑을 추가 배치하거나 기존 포탑을 선택해 강화하세요.";
      ui.intelRoute.textContent = Math.round(state.route.totalLength / 10) + "m";
      ui.intelPads.textContent = state.towers.length + " / " + state.route.pads.length;
      ui.intelWave.textContent = next.count + (next.bossWave ? " + TITAN" : "");
    }

    if (state.gameOver && !gameOverShown) {
      gameOverShown = true;
      ui.endSummary.textContent = "웨이브 " + state.wave + " · 제거 " + state.kills + " · 누수 " + state.leaks;
      ui.endCard.classList.remove("hidden");
    }

    if (force) drawFrame(performance.now());
  }

  function frame(now) {
    const rawFrameMs = Math.min(100, Math.max(0, now - lastFrameAt));
    lastFrameAt = now;
    if (state.started && !state.paused && !state.gameOver) stepSimulation(state, rawFrameMs / 1000);

    frameSamples.push(rawFrameMs);
    if (frameSamples.length > 90) frameSamples.shift();
    if (frameSamples.length >= 30) {
      const average = frameSamples.reduce((sum, value) => sum + value, 0) / frameSamples.length;
      renderInterval = average > 30 ? 1000 / 30 : average > 21 ? 1000 / 45 : 1000 / 60;
      if (now - lastPerfAt > 480) {
        const fps = Math.round(1000 / Math.max(1, average));
        ui.perfReadout.textContent = "PERF " + Math.min(60, fps);
        ui.perfReadout.style.color = fps >= 50 ? "#7ef0b1" : fps >= 38 ? "#ffb15d" : "#ff715f";
        lastPerfAt = now;
      }
    }

    if (now - lastRenderAt >= renderInterval) {
      drawFrame(now);
      lastRenderAt = now;
    }
    if (now - lastUiAt >= 120) {
      updateUi();
      lastUiAt = now;
    }
    window.requestAnimationFrame(frame);
  }

  refreshMapOptions();
  refreshTowerCards();
  const showcaseMode = new URLSearchParams(window.location.search).get("showcase") === "1";
  if (showcaseMode) {
    state = createGameState(selectedMapId);
    state.started = true;
    state.credits = 2400;
    const showcasePads = [0, 1, 3, 5, 7, 9, 10, 12];
    TOWER_TYPES.forEach((definition, index) => buildTower(state, definition.id, showcasePads[index]));
    state.selectedTowerId = null;
    state.wave = 4;
    startWave(state);
    effectsFull = true;
    ui.fxToggle.setAttribute("aria-pressed", "true");
    ui.fxToggle.textContent = "FX FULL";
    ui.missionBrief.classList.add("hidden");
    rebuildStatic();
  }
  updateUi(true);
  window.requestAnimationFrame(frame);

  window.LastLightRuntime = {
    version: "last-light-isometric-motion-v4",
    getState: () => state,
    getDiagnostics: () => ({
      renderer: "canvas2d-single-pass",
      targetFps: Math.round(1000 / renderInterval),
      frameSamples: frameSamples.slice(),
      objects: {
        towers: state.towers.length,
        enemies: state.enemies.length,
        shots: state.shots.length,
        particles: state.particles.length
      },
      limits: { shots: MAX_SHOTS, particles: MAX_PARTICLES },
      assets: {
        field: Boolean(ART_IMAGES.field),
        towers: ART_IMAGES.towers.size,
        enemies: ART_IMAGES.enemies.size
      },
      assetStrategy: "imagegen-units-plus-one-cached-field",
      sceneProjection: "cached-isometric-board",
      towerMotion: "split-base-tracking-turret-plus-reactor-idle"
    })
  };
}

if (typeof document !== "undefined") {
  preloadArt().then(bootGame).catch(bootGame);
}
