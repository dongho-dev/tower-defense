// 비교 데모 공통 시뮬레이션 코어.
// 좌표는 타일 단위(x: 열, y: 행). 셀 (cx, cy)의 중심은 (cx + 0.5, cy + 0.5).

export const MAPS = {
  demo: {
    cols: 16,
    rows: 10,
    waypoints: [[-1, 2], [4, 2], [4, 7], [9, 7], [9, 2], [13, 2], [13, 7], [16, 7]],
    sockets: [[2, 3], [5, 4], [3, 6], [6, 6], [8, 5], [10, 4], [7, 1], [11, 3], [12, 5], [14, 5], [14, 8], [10, 8], [2, 1], [6, 8], [11, 1]]
  },
  open: { cols: 16, rows: 10, entry: [0, 4], exit: [15, 5] }
};

export const TOWERS = {
  gun: {
    key: '1', name: '펄스 건', color: '#5fd4ff', cost: 50, dmg: 9, range: 2.7, rate: 0.32, projSpeed: 14,
    desc: '빠른 단일 사격',
    branches: {
      a: { name: '개틀링', desc: '연사 ×2.2 · 피해 ×0.7', mod: { rate: 1 / 2.2, dmg: 0.7 } },
      b: { name: '저격', desc: '사거리 ×1.6 · 피해 ×3.2 · 연사 느림', mod: { range: 1.6, dmg: 3.2, rate: 2.2 } }
    }
  },
  cannon: {
    key: '2', name: '캐논', color: '#ffae4a', cost: 80, dmg: 26, range: 2.9, rate: 1.25, splash: 1.0, projSpeed: 6.5, arc: true,
    desc: '범위 폭발',
    branches: {
      a: { name: '집속탄', desc: '폭발 반경 ×1.7', mod: { splash: 1.7 } },
      b: { name: '중포', desc: '피해 ×2.3 · 연사 약간 느림', mod: { dmg: 2.3, rate: 1.25 } }
    }
  },
  frost: {
    key: '3', name: '프로스트', color: '#a6ecff', cost: 60, dmg: 5, range: 2.5, rate: 0.85, slow: 0.45, slowTime: 1.4, splash: 0.6, projSpeed: 10,
    desc: '범위 둔화',
    branches: {
      a: { name: '빙결장', desc: '둔화 반경 ×2 · 둔화 +15%', mod: { splash: 2, slowAdd: 0.15 } },
      b: { name: '파쇄', desc: '피해 ×5 · 둔화된 적은 모든 피해 +50%', mod: { dmg: 5 }, shatter: true }
    }
  },
  laser: {
    key: '4', name: '레이저', color: '#ff5fd2', cost: 100, dps: 30, range: 3.0, beam: true,
    desc: '지속 광선',
    branches: {
      a: { name: '분광', desc: '동시에 3개 표적', mod: { multi: 3 } },
      b: { name: '과부하', desc: '같은 표적을 계속 쏘면 피해 최대 ×4', mod: {}, ramp: true }
    }
  }
};

// 미로 데모 전용: 공격하지 않고 길만 막는 싼 블록
TOWERS.wall = { key: '5', name: '벽', color: '#8b9ab3', cost: 10, range: 0, wall: true, desc: '공격 없음 · 길만 막음', branches: {} };

export const ENEMIES = {
  grunt: { hp: 40, speed: 1.35, reward: 6, radius: 0.22, color: '#ff6b5a' },
  runner: { hp: 22, speed: 2.3, reward: 5, radius: 0.17, color: '#ffd65a' },
  tank: { hp: 170, speed: 0.8, reward: 14, radius: 0.3, color: '#a78bfa' },
  boss: { hp: 950, speed: 0.62, reward: 90, radius: 0.42, color: '#ff3d8b' }
};

export const MAX_LEVEL = 3;

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function createSim(opts = {}) {
  const mode = opts.mode || 'path';
  const map = MAPS[opts.map || (mode === 'flow' ? 'open' : 'demo')];
  const sim = {
    mode,
    map,
    cols: map.cols,
    rows: map.rows,
    gold: opts.gold ?? 250,
    lives: opts.lives ?? 20,
    wave: 0,
    time: 0,
    spectator: !!opts.spectator,
    maxWave: opts.maxWave || 0,
    enemies: [],
    towers: [],
    projectiles: [],
    meteors: [],
    events: [],
    queue: [],
    spawnT: 0,
    spawnGap: 0.55,
    waveActive: false,
    autoNext: !!opts.spectator,
    autoT: 1.2,
    overclockT: 0,
    shatter: false,
    synergy: !!opts.synergy,
    links: [],
    over: false,
    kills: 0,
    leaks: 0,
    nextId: 1,
    blocked: new Set(),
    mods: { dmg: 1, range: 1, rate: 1, gold: 1, splash: 1, slowAdd: 0, interest: 0, multiBonus: 0, typeDmg: {} },
    onWaveEnd: null
  };
  if (mode === 'path') {
    sim.path = map.waypoints.map(([x, y]) => ({ x: x + 0.5, y: y + 0.5 }));
    sim.pathLen = [0];
    for (let i = 1; i < sim.path.length; i++) {
      const a = sim.path[i - 1], b = sim.path[i];
      sim.pathLen.push(sim.pathLen[i - 1] + Math.hypot(b.x - a.x, b.y - a.y));
    }
    sim.pathCells = new Set();
    for (let i = 1; i < map.waypoints.length; i++) {
      let [x, y] = map.waypoints[i - 1];
      const [tx, ty] = map.waypoints[i];
      while (x !== tx || y !== ty) {
        if (inGrid(sim, x, y)) sim.pathCells.add(key(x, y));
        x += Math.sign(tx - x);
        y += Math.sign(ty - y);
      }
      if (inGrid(sim, tx, ty)) sim.pathCells.add(key(tx, ty));
    }
  } else {
    computeFlow(sim);
  }
  return sim;
}

export const key = (x, y) => x + ',' + y;
export const inGrid = (sim, x, y) => x >= 0 && y >= 0 && x < sim.cols && y < sim.rows;

export function towerAt(sim, cx, cy) {
  return sim.towers.find((t) => t.cx === cx && t.cy === cy) || null;
}

export function isSocket(sim, cx, cy) {
  return !!sim.map.sockets && sim.map.sockets.some(([x, y]) => x === cx && y === cy);
}

// ---------- 흐름장(자유 배치 미로) ----------
function bfs(sim, blocked) {
  const dist = new Int32Array(sim.cols * sim.rows).fill(-1);
  const [ex, ey] = sim.map.exit;
  if (blocked.has(key(ex, ey))) return dist;
  const q = [[ex, ey]];
  dist[ey * sim.cols + ex] = 0;
  while (q.length) {
    const [x, y] = q.shift();
    const d = dist[y * sim.cols + x];
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (!inGrid(sim, nx, ny) || blocked.has(key(nx, ny))) continue;
      const i = ny * sim.cols + nx;
      if (dist[i] >= 0) continue;
      dist[i] = d + 1;
      q.push([nx, ny]);
    }
  }
  return dist;
}

function computeFlow(sim) {
  sim.dist = bfs(sim, sim.blocked);
  // 표시용 최단 경로
  const [sx, sy] = sim.map.entry;
  const route = [{ x: -0.5, y: sy + 0.5 }];
  let x = sx, y = sy, guard = 0;
  while (guard++ < 400) {
    route.push({ x: x + 0.5, y: y + 0.5 });
    const n = bestNeighbor(sim, x, y);
    if (!n) break;
    [x, y] = n;
  }
  const [ex, ey] = sim.map.exit;
  route.push({ x: ex + 1.5, y: ey + 0.5 });
  sim.route = route;
}

function distAt(sim, x, y) {
  return inGrid(sim, x, y) ? sim.dist[y * sim.cols + x] : -1;
}

function bestNeighbor(sim, x, y) {
  const here = distAt(sim, x, y);
  if (here <= 0) return null;
  let best = null, bd = here;
  for (const [dx, dy] of DIRS) {
    const d = distAt(sim, x + dx, y + dy);
    if (d >= 0 && d < bd) { bd = d; best = [x + dx, y + dy]; }
  }
  return best;
}

// 자유 배치에서 이 셀을 막아도 길이 남는지
export function canBlock(sim, cx, cy) {
  if (!inGrid(sim, cx, cy) || sim.blocked.has(key(cx, cy))) return false;
  const [sx, sy] = sim.map.entry, [ex, ey] = sim.map.exit;
  if ((cx === sx && cy === sy) || (cx === ex && cy === ey)) return false;
  for (const e of sim.enemies) {
    if (e.cell && e.cell[0] === cx && e.cell[1] === cy) return false;
    if (e.next && e.next[0] === cx && e.next[1] === cy) return false;
  }
  const test = new Set(sim.blocked);
  test.add(key(cx, cy));
  const d = bfs(sim, test);
  if (d[sy * sim.cols + sx] < 0) return false;
  // 이미 그리드 안의 적이 갇히지 않는지
  for (const e of sim.enemies) {
    if (!e.cell) continue;
    const [x, y] = e.next || e.cell;
    if (inGrid(sim, x, y) && d[y * sim.cols + x] < 0) return false;
  }
  return true;
}

// ---------- 웨이브 ----------
export function waveComposition(n) {
  const list = [];
  const count = 8 + n * 2;
  for (let i = 0; i < count; i++) {
    let kind = 'grunt';
    if (n >= 2 && i % 3 === 2) kind = 'runner';
    if (n >= 3 && i % 5 === 4) kind = 'tank';
    list.push(kind);
  }
  if (n % 5 === 0) list.push('boss');
  return list;
}

export function startWave(sim) {
  if (sim.waveActive || sim.over) return false;
  sim.wave += 1;
  sim.queue = waveComposition(sim.wave);
  sim.hpScale = Math.pow(1.17, sim.wave - 1) * (sim.hpMult || 1);
  sim.spawnT = 0;
  sim.waveActive = true;
  sim.events.push({ type: 'wave', wave: sim.wave });
  return true;
}

function spawn(sim, kind) {
  const def = ENEMIES[kind];
  const hp = def.hp * sim.hpScale;
  const e = {
    id: sim.nextId++, kind, hp, maxHp: hp, speed: def.speed, radius: def.radius, color: def.color,
    reward: def.reward, d: 0, x: 0, y: 0, heading: 0, slowT: 0, slowAmt: 0, hitT: 0, prog: 0
  };
  if (sim.mode === 'path') {
    const p = pointOnPath(sim, 0);
    e.x = p.x; e.y = p.y;
  } else {
    const [sx, sy] = sim.map.entry;
    e.x = -0.5; e.y = sy + 0.5; e.cell = null; e.next = [sx, sy];
  }
  sim.enemies.push(e);
  sim.events.push({ type: 'spawn', x: e.x, y: e.y, color: e.color, kind });
}

export function pointOnPath(sim, d) {
  const P = sim.path, L = sim.pathLen;
  if (d <= 0) return { x: P[0].x, y: P[0].y, heading: Math.atan2(P[1].y - P[0].y, P[1].x - P[0].x) };
  for (let i = 1; i < P.length; i++) {
    if (d <= L[i]) {
      const t = (d - L[i - 1]) / (L[i] - L[i - 1]);
      const a = P[i - 1], b = P[i];
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, heading: Math.atan2(b.y - a.y, b.x - a.x) };
    }
  }
  const a = P[P.length - 2], b = P[P.length - 1];
  return { x: b.x, y: b.y, heading: Math.atan2(b.y - a.y, b.x - a.x), end: true };
}

// ---------- 타워 ----------
export function towerStats(sim, t) {
  const d = TOWERS[t.type];
  const lv = Math.min(t.level, MAX_LEVEL);
  const s = {
    dmg: (d.dmg || 0) * (1 + 0.45 * (lv - 1)),
    dps: (d.dps || 0) * (1 + 0.45 * (lv - 1)),
    range: d.range * (1 + 0.07 * (lv - 1)),
    rate: d.rate || 0,
    splash: d.splash || 0,
    slow: d.slow || 0,
    slowTime: d.slowTime || 0,
    multi: 1,
    ramp: false
  };
  if (t.branch) {
    const b = d.branches[t.branch];
    for (const [k, v] of Object.entries(b.mod)) {
      if (k === 'slowAdd') s.slow += v;
      else if (k === 'multi') s.multi = v;
      else s[k] *= v;
    }
    s.ramp = !!b.ramp;
  }
  const m = sim.mods;
  const mult = m.dmg * (t.buff || 1) * (m.typeDmg[t.type] || 1);
  s.dmg *= mult;
  s.dps *= mult;
  s.range *= m.range;
  s.rate *= m.rate;
  s.splash *= m.splash;
  if (s.slow) s.slow = Math.min(0.8, s.slow + m.slowAdd);
  if (d.beam) s.multi += m.multiBonus;
  if (sim.overclockT > 0) { s.rate *= 0.5; s.dps *= 1.8; }
  return s;
}

export function upgradeCost(t) {
  const d = TOWERS[t.type];
  return t.level < MAX_LEVEL ? Math.round(d.cost * 0.75 * t.level) : Math.round(d.cost * 1.6);
}

export function buildTower(sim, type, cx, cy, free = false) {
  const d = TOWERS[type];
  if (!free && sim.gold < d.cost) return null;
  if (!free) sim.gold -= d.cost;
  const t = {
    id: sim.nextId++, type, cx, cy, x: cx + 0.5, y: cy + 0.5, level: 1, branch: null,
    cooldown: 0, angle: -Math.PI / 2, recoil: 0, beams: [], rampT: 0, rampTarget: null, buff: 1,
    spent: free ? 0 : d.cost, built: sim.time
  };
  sim.towers.push(t);
  if (sim.mode === 'flow') { sim.blocked.add(key(cx, cy)); computeFlow(sim); }
  refreshSynergy(sim);
  sim.events.push({ type: 'build', x: t.x, y: t.y, color: d.color });
  return t;
}

export function upgradeTower(sim, t, branch = null) {
  const cost = upgradeCost(t);
  if (sim.gold < cost) return false;
  if (t.level < MAX_LEVEL) t.level += 1;
  else if (!t.branch && branch) t.branch = branch;
  else return false;
  sim.gold -= cost;
  t.spent += cost;
  if (t.branch && TOWERS[t.type].branches[t.branch].shatter) sim.shatter = true;
  sim.events.push({ type: 'upgrade', x: t.x, y: t.y, color: TOWERS[t.type].color });
  return true;
}

export function sellTower(sim, t) {
  sim.towers = sim.towers.filter((o) => o !== t);
  sim.gold += Math.floor(t.spent * 0.7);
  if (sim.mode === 'flow') { sim.blocked.delete(key(t.cx, t.cy)); computeFlow(sim); }
  sim.shatter = sim.towers.some((o) => o.branch && TOWERS[o.type].branches[o.branch].shatter);
  refreshSynergy(sim);
  sim.events.push({ type: 'sell', x: t.x, y: t.y });
}

// 시너지: 8방향으로 붙어 있는 "다른 종류" 타워 하나당 피해 +15%
export function refreshSynergy(sim) {
  sim.links = [];
  for (const t of sim.towers) t.buff = 1;
  if (!sim.synergy) return;
  for (const t of sim.towers) {
    const kinds = new Set();
    for (const o of sim.towers) {
      if (o === t) continue;
      if (Math.abs(o.cx - t.cx) <= 1 && Math.abs(o.cy - t.cy) <= 1 && o.type !== t.type) {
        kinds.add(o.type);
        if (o.id > t.id) sim.links.push([t, o]);
      }
    }
    t.buff = 1 + 0.15 * kinds.size;
  }
}

// ---------- 스킬 ----------
export function castMeteor(sim, x, y) {
  sim.meteors.push({ x, y, t: 0.7, r: 1.5, dmg: 90 * Math.max(1, sim.hpScale || 1) ** 0.8 });
  sim.events.push({ type: 'meteorCast', x, y });
}

export function castOverclock(sim) {
  sim.overclockT = 5;
  sim.events.push({ type: 'overclock' });
}

// ---------- 전투 ----------
function damage(sim, e, amount, color) {
  if (e.hp <= 0) return;
  if (sim.shatter && e.slowT > 0) amount *= 1.5;
  e.hp -= amount;
  e.hitT = 0.12;
  if (e.hp <= 0) {
    sim.kills += 1;
    sim.gold += Math.round(e.reward * sim.mods.gold);
    sim.events.push({ type: 'death', x: e.x, y: e.y, color: e.color, kind: e.kind, r: e.radius });
  } else if (color) {
    sim.events.push({ type: 'hit', x: e.x, y: e.y, color });
  }
}

function applySlow(e, amt, time) {
  e.slowAmt = Math.max(e.slowAmt, amt);
  e.slowT = Math.max(e.slowT, time);
}

function inRange(sim, t, range) {
  const r2 = range * range;
  return sim.enemies.filter((e) => e.hp > 0 && (e.x - t.x) ** 2 + (e.y - t.y) ** 2 <= r2 && e.x > -0.2 && e.x < sim.cols + 0.2);
}

function moveEnemies(sim, dt) {
  for (const e of sim.enemies) {
    if (e.hp <= 0) continue;
    e.hitT = Math.max(0, e.hitT - dt);
    if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) e.slowAmt = 0; }
    const v = e.speed * (1 - e.slowAmt) * dt;
    if (sim.mode === 'path') {
      e.d += v;
      const p = pointOnPath(sim, e.d);
      e.x = p.x; e.y = p.y; e.heading = p.heading; e.prog = e.d;
      if (p.end) leak(sim, e);
    } else {
      let remaining = v, guard = 0;
      while (remaining > 0 && guard++ < 4) {
        if (!e.next) { leak(sim, e); break; }
        const tx = e.next[0] === -99 ? e.exitX : e.next[0] + 0.5;
        const ty = e.next[0] === -99 ? e.exitY : e.next[1] + 0.5;
        const dx = tx - e.x, dy = ty - e.y, dist = Math.hypot(dx, dy);
        if (dist > 1e-6) e.heading = Math.atan2(dy, dx);
        if (dist <= remaining) {
          e.x = tx; e.y = ty; remaining -= dist;
          if (e.next[0] === -99) { e.next = null; continue; }
          e.cell = e.next;
          const [ex, ey] = sim.map.exit;
          if (e.cell[0] === ex && e.cell[1] === ey) {
            e.next = [-99, -99]; e.exitX = ex + 1.5; e.exitY = ey + 0.5;
          } else {
            e.next = bestNeighbor(sim, e.cell[0], e.cell[1]);
          }
        } else {
          e.x += (dx / dist) * remaining; e.y += (dy / dist) * remaining; remaining = 0;
        }
      }
      const c = e.next && e.next[0] !== -99 ? e.next : e.cell;
      e.prog = c ? 1000 - distAt(sim, c[0], c[1]) : 1000;
    }
  }
}

function leak(sim, e) {
  if (e.hp <= 0) return;
  e.hp = 0;
  e.leaked = true;
  sim.leaks += 1;
  if (!sim.spectator) {
    sim.lives -= e.kind === 'boss' ? 5 : 1;
    if (sim.lives <= 0) { sim.lives = 0; sim.over = true; sim.events.push({ type: 'gameover' }); }
  }
  sim.events.push({ type: 'leak', x: e.x, y: e.y });
}

function fireTowers(sim, dt) {
  for (const t of sim.towers) {
    const d = TOWERS[t.type];
    if (d.wall) continue;
    const s = towerStats(sim, t);
    t.recoil = Math.max(0, t.recoil - dt * 5);
    t.cooldown -= dt;
    const targets = inRange(sim, t, s.range).sort((a, b) => b.prog - a.prog);
    if (d.beam) {
      const chosen = targets.slice(0, s.multi);
      if (chosen.length) {
        const first = chosen[0];
        if (s.ramp) {
          if (t.rampTarget === first.id) t.rampT += dt; else { t.rampT = 0; t.rampTarget = first.id; }
        }
        const rampMult = s.ramp ? 1 + Math.min(3, t.rampT * 0.9) : 1;
        t.angle = aimToward(t.angle, Math.atan2(first.y - t.y, first.x - t.x), dt * 10);
        for (const e of chosen) damage(sim, e, s.dps * rampMult * dt, null);
        t.beams = chosen.map((e) => e.id);
        t.beamPower = rampMult;
      } else {
        t.beams = [];
        t.rampT = 0;
      }
      continue;
    }
    const target = targets[0];
    if (!target) continue;
    const want = Math.atan2(target.y - t.y, target.x - t.x);
    t.angle = aimToward(t.angle, want, dt * 9);
    if (t.cooldown <= 0) {
      t.cooldown = s.rate;
      t.recoil = 1;
      const mx = t.x + Math.cos(t.angle) * 0.35, my = t.y + Math.sin(t.angle) * 0.35;
      sim.projectiles.push({
        id: sim.nextId++, type: t.type, x: mx, y: my, sx: mx, sy: my, z: 0, targetId: target.id,
        tx: target.x, ty: target.y, speed: d.projSpeed, dmg: s.dmg, splash: s.splash, slow: s.slow,
        slowTime: s.slowTime, color: d.color, arc: !!d.arc, p: 0
      });
      sim.events.push({ type: 'fire', x: mx, y: my, angle: t.angle, color: d.color, tower: t.type });
    }
  }
}

function aimToward(cur, want, step) {
  const diff = Math.atan2(Math.sin(want - cur), Math.cos(want - cur));
  return Math.abs(diff) <= step ? want : cur + Math.sign(diff) * step;
}

function moveProjectiles(sim, dt) {
  const byId = new Map(sim.enemies.map((e) => [e.id, e]));
  for (const p of sim.projectiles) {
    const e = byId.get(p.targetId);
    if (e && e.hp > 0) { p.tx = e.x; p.ty = e.y; }
    const dx = p.tx - p.x, dy = p.ty - p.y, dist = Math.hypot(dx, dy);
    const stepLen = p.speed * dt;
    const total = Math.hypot(p.tx - p.sx, p.ty - p.sy) || 1;
    if (dist <= stepLen) {
      p.x = p.tx; p.y = p.ty; p.done = true;
      if (p.splash > 0) {
        for (const o of sim.enemies) {
          if (o.hp > 0 && (o.x - p.x) ** 2 + (o.y - p.y) ** 2 <= p.splash * p.splash) {
            damage(sim, o, p.dmg, null);
            if (p.slow) applySlow(o, p.slow, p.slowTime);
          }
        }
        sim.events.push({ type: p.type === 'frost' ? 'frostburst' : 'explode', x: p.x, y: p.y, r: p.splash, color: p.color });
      } else if (e && e.hp > 0) {
        damage(sim, e, p.dmg, p.color);
      }
    } else {
      p.x += (dx / dist) * stepLen; p.y += (dy / dist) * stepLen;
    }
    p.p = Math.min(1, 1 - dist / Math.max(total, dist));
    p.z = p.arc ? Math.sin(p.p * Math.PI) * Math.min(1.4, total * 0.35) : 0.35;
  }
  sim.projectiles = sim.projectiles.filter((p) => !p.done);
}

function updateMeteors(sim, dt) {
  for (const m of sim.meteors) {
    m.t -= dt;
    if (m.t <= 0) {
      for (const e of sim.enemies) {
        if (e.hp > 0 && (e.x - m.x) ** 2 + (e.y - m.y) ** 2 <= m.r * m.r) damage(sim, e, m.dmg, null);
      }
      sim.events.push({ type: 'meteor', x: m.x, y: m.y, r: m.r });
    }
  }
  sim.meteors = sim.meteors.filter((m) => m.t > 0);
}

export function step(sim, dt) {
  if (sim.over) return;
  sim.time += dt;
  sim.overclockT = Math.max(0, sim.overclockT - dt);
  if (sim.queue.length) {
    sim.spawnT -= dt;
    if (sim.spawnT <= 0) {
      spawn(sim, sim.queue.shift());
      sim.spawnT = sim.spawnGap;
    }
  }
  moveEnemies(sim, dt);
  fireTowers(sim, dt);
  moveProjectiles(sim, dt);
  updateMeteors(sim, dt);
  sim.enemies = sim.enemies.filter((e) => e.hp > 0);
  if (sim.waveActive && !sim.queue.length && !sim.enemies.length) {
    sim.waveActive = false;
    if (sim.mods.interest) sim.gold += Math.floor(sim.gold * sim.mods.interest);
    sim.gold += 20 + sim.wave * 4;
    sim.events.push({ type: 'waveEnd', wave: sim.wave });
    if (sim.onWaveEnd) sim.onWaveEnd(sim);
    sim.autoT = 1.4;
    if (sim.spectator && sim.maxWave && sim.wave >= sim.maxWave) sim.wave = 0;
  }
  if (!sim.waveActive && sim.autoNext && !sim.paused) {
    sim.autoT -= dt;
    if (sim.autoT <= 0) startWave(sim);
  }
}

export function drainEvents(sim) {
  const ev = sim.events;
  sim.events = [];
  return ev;
}

// 렌더링 비교 데모용 관전 세팅
export function createShowcase() {
  const sim = createSim({ mode: 'path', spectator: true, gold: 99999, maxWave: 10 });
  const plan = [
    ['gun', 2, 3, 2], ['cannon', 5, 4, 3, 'a'], ['frost', 3, 6, 2], ['laser', 8, 5, 3, 'a'], ['gun', 10, 4, 3, 'a'],
    ['cannon', 12, 5, 2], ['laser', 14, 5, 3, 'b'], ['frost', 11, 3, 3, 'a'], ['gun', 6, 6, 1], ['cannon', 7, 1, 1], ['gun', 14, 8, 2]
  ];
  for (const [type, x, y, lv, br] of plan) {
    const t = buildTower(sim, type, x, y);
    t.level = lv;
    if (br) t.branch = br;
  }
  sim.gold = 0;
  sim.wave = 2;
  sim.hpMult = 6;
  return sim;
}
