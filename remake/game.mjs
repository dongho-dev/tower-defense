export const CANVAS_WIDTH = 1200;
export const CANVAS_HEIGHT = 720;

const FIELD = Object.freeze({ x: 54, y: 62, width: 1092, height: 596 });
const MAX_SHOTS = 90;
const MAX_PARTICLES = 120;

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
  Object.freeze({ id: "pulse", key: "1", glyph: "PX", name: "PULSE", role: "균형형 요격 포탑", cost: 60, damage: 18, range: 150, reload: 0.52, mode: "direct", color: "#72e7ff" }),
  Object.freeze({ id: "scatter", key: "2", glyph: "SG", name: "SCATTER", role: "근거리 다중 탄막", cost: 80, damage: 12, range: 126, reload: 0.78, mode: "scatter", color: "#ffb36b" }),
  Object.freeze({ id: "rail", key: "3", glyph: "RL", name: "RAIL", role: "초장거리 중장갑 관통", cost: 125, damage: 64, range: 245, reload: 1.65, mode: "pierce", color: "#f3f7ff" }),
  Object.freeze({ id: "arc", key: "4", glyph: "AR", name: "ARC", role: "연쇄 전기 공격", cost: 105, damage: 24, range: 165, reload: 0.92, mode: "chain", color: "#a991ff" }),
  Object.freeze({ id: "flak", key: "5", glyph: "FL", name: "FLAK", role: "밀집 편대 광역 제압", cost: 115, damage: 34, range: 174, reload: 1.28, mode: "splash", color: "#ff7b5c" }),
  Object.freeze({ id: "beam", key: "6", glyph: "BM", name: "BEAM", role: "고속 단일 표적 추적", cost: 110, damage: 10, range: 188, reload: 0.19, mode: "direct", color: "#65f3bd" }),
  Object.freeze({ id: "cryo", key: "7", glyph: "CR", name: "CRYO", role: "감속 지원 포탑", cost: 95, damage: 14, range: 178, reload: 0.72, mode: "slow", color: "#77aaff" }),
  Object.freeze({ id: "nova", key: "8", glyph: "NV", name: "NOVA", role: "고비용 전역 충격파", cost: 170, damage: 48, range: 205, reload: 1.9, mode: "nova", color: "#ff76b8" })
]);

const TOWER_BY_ID = new Map(TOWER_TYPES.map((tower) => [tower.id, tower]));

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function absolutePoint(point) {
  return {
    x: FIELD.x + point[0] * FIELD.width,
    y: FIELD.y + point[1] * FIELD.height
  };
}

export function resolveMap(mapId = "riftline") {
  const source = MAPS[mapId] || MAPS.riftline;
  const points = source.route.map(absolutePoint);
  const pads = source.pads.map((point, index) => ({ ...absolutePoint(point), index }));
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
    angle: -Math.PI / 2,
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
  if (boss) return { kind: "titan", hp: spec.hp * 8, speed: spec.speed * 0.58, reward: spec.reward * 12, radius: 18, coreDamage: 4, color: "#ff769f" };
  if (index % 7 === 4) return { kind: "armor", hp: spec.hp * 2.5, speed: spec.speed * 0.68, reward: spec.reward * 2, radius: 13, coreDamage: 2, color: "#a7b5c8" };
  if (index % 5 === 2) return { kind: "skirmisher", hp: spec.hp * 0.62, speed: spec.speed * 1.55, reward: spec.reward, radius: 9, coreDamage: 1, color: "#79edc5" };
  return { kind: "drone", hp: spec.hp, speed: spec.speed, reward: spec.reward, radius: 11, coreDamage: 1, color: "#ff9a6f" };
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

function addShot(state, tower, target, color, width = 2.2, ttl = 0.15) {
  if (state.shots.length >= MAX_SHOTS) state.shots.splice(0, state.shots.length - MAX_SHOTS + 1);
  state.shots.push({
    x1: tower.x,
    y1: tower.y,
    x2: target.x,
    y2: target.y,
    color,
    width,
    ttl,
    maxTtl: ttl
  });
  tower.angle = Math.atan2(target.y - tower.y, target.x - tower.x);
  tower.flash = 0.12;
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
    .filter((enemy) => !enemy.dead && Math.hypot(enemy.x - tower.x, enemy.y - tower.y) <= range)
    .sort((a, b) => b.routeDistance - a.routeDistance);
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
      addShot(state, tower, target, definition.color, 1.4, 0.11);
      dealDamage(state, target, stats.damage, definition.color);
    }
  } else if (definition.mode === "chain") {
    const group = targets.slice(0, 3);
    let previous = tower;
    group.forEach((target, index) => {
      addShot(state, previous, target, definition.color, 2.1 - index * 0.35, 0.18);
      dealDamage(state, target, stats.damage * (1 - index * 0.22), definition.color);
      previous = target;
    });
  } else if (definition.mode === "splash") {
    addShot(state, tower, primary, definition.color, 3.6, 0.22);
    dealDamage(state, primary, stats.damage, definition.color);
    for (const target of state.enemies) {
      if (target !== primary && !target.dead && Math.hypot(target.x - primary.x, target.y - primary.y) < 72) {
        dealDamage(state, target, stats.damage * 0.55, definition.color);
      }
    }
    burstParticles(state, primary.x, primary.y, definition.color, 7);
  } else if (definition.mode === "pierce") {
    addShot(state, tower, primary, definition.color, 4, 0.2);
    dealDamage(state, primary, stats.damage, definition.color);
    const angle = Math.atan2(primary.y - tower.y, primary.x - tower.x);
    for (const target of targets.slice(1)) {
      const targetAngle = Math.atan2(target.y - tower.y, target.x - tower.x);
      if (Math.abs(targetAngle - angle) < 0.1) dealDamage(state, target, stats.damage * 0.42, definition.color);
    }
  } else if (definition.mode === "slow") {
    addShot(state, tower, primary, definition.color, 2.5, 0.17);
    dealDamage(state, primary, stats.damage, definition.color);
    primary.slowFactor = 0.56;
    primary.slowTime = 1.7;
  } else if (definition.mode === "nova") {
    const group = targets.slice(0, 6);
    group.forEach((target) => {
      addShot(state, tower, target, definition.color, 2, 0.24);
      dealDamage(state, target, stats.damage * 0.72, definition.color);
    });
    burstParticles(state, tower.x, tower.y, definition.color, 14);
  } else {
    addShot(state, tower, primary, definition.color, definition.id === "beam" ? 2.8 : 2.1, definition.id === "beam" ? 0.08 : 0.14);
    dealDamage(state, primary, stats.damage, definition.color);
  }
  tower.cooldown += stats.reload;
  return true;
}

export function stepSimulation(state, dt) {
  if (!state.started || state.paused || state.gameOver) return state;
  const step = clamp(Number(dt) || 0, 0, 0.05);

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

function drawRoutePath(context, route) {
  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";
  context.beginPath();
  route.points.forEach((point, index) => {
    if (index === 0) context.moveTo(point.x, point.y);
    else context.lineTo(point.x, point.y);
  });
  context.strokeStyle = "rgba(0, 0, 0, 0.55)";
  context.lineWidth = 62;
  context.stroke();
  context.strokeStyle = "rgba(28, 55, 66, 0.96)";
  context.lineWidth = 52;
  context.stroke();
  context.strokeStyle = "rgba(116, 221, 244, 0.14)";
  context.lineWidth = 44;
  context.stroke();
  context.strokeStyle = "rgba(146, 224, 239, 0.38)";
  context.lineWidth = 2;
  context.setLineDash([10, 18]);
  context.stroke();
  context.setLineDash([]);

  for (let routeDistance = 78; routeDistance < route.totalLength - 54; routeDistance += 98) {
    const point = pointOnRoute(route, routeDistance);
    context.save();
    context.translate(point.x, point.y);
    context.rotate(point.angle);
    context.beginPath();
    context.moveTo(-7, -6);
    context.lineTo(2, 0);
    context.lineTo(-7, 6);
    context.strokeStyle = "rgba(255, 177, 93, 0.7)";
    context.lineWidth = 2;
    context.stroke();
    context.restore();
  }
  context.restore();
}

function buildStaticLayer(state) {
  const layer = document.createElement("canvas");
  layer.width = CANVAS_WIDTH;
  layer.height = CANVAS_HEIGHT;
  const context = layer.getContext("2d", { alpha: true });
  const fieldGradient = context.createLinearGradient(0, FIELD.y, 0, FIELD.y + FIELD.height);
  fieldGradient.addColorStop(0, "rgba(8, 25, 34, 0.86)");
  fieldGradient.addColorStop(1, "rgba(3, 12, 18, 0.9)");

  context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  roundedRectPath(context, 28, 28, CANVAS_WIDTH - 56, CANVAS_HEIGHT - 56, 30);
  context.fillStyle = fieldGradient;
  context.fill();
  context.strokeStyle = "rgba(118, 210, 235, 0.22)";
  context.lineWidth = 2;
  context.stroke();

  context.save();
  roundedRectPath(context, FIELD.x, FIELD.y, FIELD.width, FIELD.height, 18);
  context.clip();
  context.fillStyle = "rgba(2, 9, 14, 0.54)";
  context.fillRect(FIELD.x, FIELD.y, FIELD.width, FIELD.height);
  context.strokeStyle = "rgba(122, 192, 211, 0.07)";
  context.lineWidth = 1;
  for (let x = FIELD.x; x <= FIELD.x + FIELD.width; x += 36) {
    context.beginPath();
    context.moveTo(x, FIELD.y);
    context.lineTo(x, FIELD.y + FIELD.height);
    context.stroke();
  }
  for (let y = FIELD.y; y <= FIELD.y + FIELD.height; y += 36) {
    context.beginPath();
    context.moveTo(FIELD.x, y);
    context.lineTo(FIELD.x + FIELD.width, y);
    context.stroke();
  }
  drawRoutePath(context, state.route);
  context.restore();

  for (const pad of state.route.pads) {
    hexPath(context, pad.x, pad.y, 23);
    context.fillStyle = "rgba(14, 33, 43, 0.94)";
    context.fill();
    context.strokeStyle = "rgba(110, 207, 232, 0.27)";
    context.lineWidth = 2;
    context.stroke();
    hexPath(context, pad.x, pad.y, 9);
    context.strokeStyle = "rgba(110, 207, 232, 0.18)";
    context.lineWidth = 1;
    context.stroke();
  }

  const start = state.route.points[0];
  const end = state.route.points[state.route.points.length - 1];
  context.save();
  context.translate(start.x + 12, start.y);
  context.fillStyle = "rgba(255, 124, 92, 0.1)";
  context.beginPath();
  context.arc(0, 0, 38, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "rgba(255, 124, 92, 0.65)";
  context.lineWidth = 2;
  context.beginPath();
  context.arc(0, 0, 26, -Math.PI * 0.4, Math.PI * 0.4);
  context.stroke();
  context.restore();

  context.save();
  context.translate(end.x - 12, end.y);
  context.fillStyle = "rgba(111, 231, 255, 0.08)";
  context.beginPath();
  context.arc(0, 0, 42, 0, Math.PI * 2);
  context.fill();
  hexPath(context, 0, 0, 27);
  context.strokeStyle = "rgba(111, 231, 255, 0.72)";
  context.lineWidth = 3;
  context.stroke();
  hexPath(context, 0, 0, 14);
  context.strokeStyle = "rgba(255, 177, 93, 0.65)";
  context.lineWidth = 2;
  context.stroke();
  context.restore();

  context.fillStyle = "rgba(137, 181, 196, 0.45)";
  context.font = "700 10px ui-monospace, monospace";
  context.letterSpacing = "1px";
  context.fillText("BREACH", 68, 52);
  context.textAlign = "right";
  context.fillText("CORE", 1132, 52);
  context.textAlign = "left";
  return layer;
}

function drawTower(context, tower, definition, selected, effectsFull) {
  context.save();
  context.translate(tower.x, tower.y);

  if (selected) {
    const stats = towerStats(tower);
    context.beginPath();
    context.arc(0, 0, stats.range, 0, Math.PI * 2);
    context.fillStyle = "rgba(111, 231, 255, 0.035)";
    context.fill();
    context.strokeStyle = "rgba(111, 231, 255, 0.23)";
    context.lineWidth = 1.5;
    context.setLineDash([5, 7]);
    context.stroke();
    context.setLineDash([]);
  }

  if (effectsFull) {
    context.shadowColor = definition.color;
    context.shadowBlur = tower.flash > 0 ? 20 : 8;
  }
  context.beginPath();
  context.arc(0, 0, 20, 0, Math.PI * 2);
  context.fillStyle = "rgba(4, 11, 16, 0.96)";
  context.fill();
  context.strokeStyle = definition.color;
  context.lineWidth = selected ? 3 : 2;
  context.stroke();
  context.shadowBlur = 0;

  context.rotate(tower.angle);
  context.fillStyle = definition.color;
  context.globalAlpha = tower.flash > 0 ? 1 : 0.84;
  roundedRectPath(context, -7, -7, 29, 14, 4);
  context.fill();
  context.fillStyle = "#eafaff";
  roundedRectPath(context, 13, -3, 15, 6, 2);
  context.fill();
  context.globalAlpha = 1;
  context.rotate(-tower.angle);

  context.beginPath();
  context.arc(0, 0, 7 + tower.level * 0.35, 0, Math.PI * 2);
  context.fillStyle = "rgba(5, 15, 21, 0.94)";
  context.fill();
  context.strokeStyle = "#effcff";
  context.lineWidth = 1.3;
  context.stroke();

  const dots = Math.min(6, tower.level);
  for (let index = 0; index < dots; index += 1) {
    const angle = -Math.PI / 2 + (index - (dots - 1) / 2) * 0.28;
    context.beginPath();
    context.arc(Math.cos(angle) * 27, Math.sin(angle) * 27, 2.2, 0, Math.PI * 2);
    context.fillStyle = definition.color;
    context.fill();
  }
  context.restore();
}

function drawEnemy(context, enemy, effectsFull) {
  context.save();
  context.translate(enemy.x, enemy.y);
  context.rotate(enemy.angle);
  if (effectsFull) {
    context.shadowColor = enemy.color;
    context.shadowBlur = enemy.kind === "titan" ? 16 : 7;
  }
  const radius = enemy.radius;
  context.beginPath();
  context.moveTo(radius * 1.25, 0);
  context.lineTo(-radius * 0.8, -radius * 0.78);
  context.lineTo(-radius * 0.48, 0);
  context.lineTo(-radius * 0.8, radius * 0.78);
  context.closePath();
  context.fillStyle = enemy.hitFlash > 0 ? "#ffffff" : enemy.color;
  context.fill();
  context.shadowBlur = 0;
  context.strokeStyle = "rgba(4, 10, 14, 0.9)";
  context.lineWidth = 2;
  context.stroke();
  if (enemy.kind === "armor" || enemy.kind === "titan") {
    context.beginPath();
    context.moveTo(-radius * 0.25, -radius * 0.72);
    context.lineTo(radius * 0.55, 0);
    context.lineTo(-radius * 0.25, radius * 0.72);
    context.strokeStyle = "rgba(255,255,255,.62)";
    context.lineWidth = 1.5;
    context.stroke();
  }
  context.restore();

  const ratio = clamp(enemy.hp / enemy.maxHp, 0, 1);
  const width = enemy.kind === "titan" ? 48 : 30;
  context.fillStyle = "rgba(0,0,0,.7)";
  context.fillRect(enemy.x - width / 2, enemy.y - enemy.radius - 10, width, 3);
  context.fillStyle = ratio > 0.45 ? "#76efb1" : ratio > 0.2 ? "#ffb15d" : "#ff715f";
  context.fillRect(enemy.x - width / 2, enemy.y - enemy.radius - 10, width * ratio, 3);
}

function drawShot(context, shot, effectsFull) {
  const alpha = clamp(shot.ttl / shot.maxTtl, 0, 1);
  context.save();
  context.globalAlpha = alpha;
  if (effectsFull) {
    context.shadowColor = shot.color;
    context.shadowBlur = 10;
  }
  context.strokeStyle = shot.color;
  context.lineWidth = shot.width;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(shot.x1, shot.y1);
  context.lineTo(shot.x2, shot.y2);
  context.stroke();
  context.shadowBlur = 0;
  context.beginPath();
  context.arc(shot.x2, shot.y2, shot.width * 1.6, 0, Math.PI * 2);
  context.fillStyle = shot.color;
  context.fill();
  context.restore();
}

function drawParticle(context, particle) {
  const alpha = clamp(particle.ttl / particle.maxTtl, 0, 1);
  context.save();
  context.globalAlpha = alpha;
  context.fillStyle = particle.color;
  context.beginPath();
  context.arc(particle.x, particle.y, particle.size * alpha, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function bootGame() {
  const canvas = document.getElementById("battlefield");
  const context = canvas && canvas.getContext("2d", { alpha: true, desynchronized: true });
  if (!canvas || !context) return;

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
      glyph.textContent = definition.glyph;
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

    const scanX = FIELD.x + ((now * 0.028) % FIELD.width);
    context.fillStyle = "rgba(111, 231, 255, 0.025)";
    context.fillRect(scanX, FIELD.y, 2, FIELD.height);

    const occupiedPads = new Set(state.towers.map((tower) => tower.padIndex));
    if (state.selectedType) {
      const definition = TOWER_BY_ID.get(state.selectedType);
      for (const pad of state.route.pads) {
        if (occupiedPads.has(pad.index)) continue;
        const hovered = pad.index === state.hoverPad;
        context.save();
        context.globalAlpha = hovered ? 0.95 : 0.48;
        hexPath(context, pad.x, pad.y, hovered ? 27 : 24);
        context.fillStyle = hovered ? definition.color : "rgba(111, 231, 255, 0.08)";
        context.fill();
        context.strokeStyle = definition.color;
        context.lineWidth = hovered ? 3 : 1.5;
        context.stroke();
        context.restore();
      }
    }

    const chosen = selectedTower();
    state.towers.forEach((tower) => drawTower(context, tower, TOWER_BY_ID.get(tower.typeId), Boolean(chosen && chosen.id === tower.id), effectsFull));
    state.enemies.forEach((enemy) => drawEnemy(context, enemy, effectsFull));
    state.shots.forEach((shot) => drawShot(context, shot, effectsFull));
    state.particles.forEach((particle) => drawParticle(context, particle));

    const end = state.route.points[state.route.points.length - 1];
    const pulse = 0.5 + Math.sin(now * 0.004) * 0.5;
    context.beginPath();
    context.arc(end.x - 12, end.y, 30 + pulse * 5, 0, Math.PI * 2);
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
      ui.towerMark.textContent = definition.glyph;
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
  updateUi(true);
  window.requestAnimationFrame(frame);

  window.LastLightRuntime = {
    version: "last-light-canvas-v2",
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
      assetStrategy: "one-static-background-plus-cached-field"
    })
  };
}

if (typeof document !== "undefined") {
  bootGame();
}
