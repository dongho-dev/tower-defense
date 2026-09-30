// Canvas2D 아이소메트릭(2.5D) 렌더러. 에셋 없이 절차적 프리즘/구체로 입체감을 낸다.
import { TOWERS } from './sim.js';
import { FX } from './fx.js';
import { hexA, shade } from './flat.js';

export function createIsoRenderer(canvas, sim) {
  const TW = 68, TH = 34, ZH = 34;
  const W = (sim.cols + sim.rows) * TW / 2 + 80;
  const H = (sim.cols + sim.rows) * TH / 2 + 140;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = W * dpr; canvas.height = H * dpr;
  canvas.style.aspectRatio = `${W} / ${H}`;
  const ctx = canvas.getContext('2d');
  const ox = W / 2 - (sim.cols - sim.rows) * TW / 4;
  const oy = 80;
  const fx = new FX(1);
  const iso = (x, y, z = 0) => [ox + (x - y) * TW / 2, oy + (x + y) * TH / 2 - z * ZH];
  let staticLayer = null;
  const rand = mulberry(7);
  const props = [];
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(rand() * sim.cols), y = Math.floor(rand() * sim.rows);
    const k = x + ',' + y;
    if (sim.pathCells.has(k) || sim.towers.some((t) => t.cx === x && t.cy === y) || (sim.map.sockets || []).some(([a, b]) => a === x && b === y)) continue;
    props.push({ x: x + 0.2 + rand() * 0.5, y: y + 0.2 + rand() * 0.5, s: 0.12 + rand() * 0.16, h: 0.15 + rand() * 0.5, kind: rand() > 0.5 ? 'crate' : 'pylon' });
  }

  function poly(c, pts, fill, stroke) {
    c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath();
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1; c.stroke(); }
  }

  // 축 정렬 박스: 위/앞(+y)/오른쪽(+x) 면만 보인다
  function box(c, x0, y0, x1, y1, z0, z1, color, edge) {
    const top = [iso(x0, y0, z1), iso(x1, y0, z1), iso(x1, y1, z1), iso(x0, y1, z1)];
    const front = [iso(x0, y1, z1), iso(x1, y1, z1), iso(x1, y1, z0), iso(x0, y1, z0)];
    const right = [iso(x1, y0, z1), iso(x1, y1, z1), iso(x1, y1, z0), iso(x1, y0, z0)];
    poly(c, front, shade(color, -0.28), edge);
    poly(c, right, shade(color, -0.45), edge);
    poly(c, top, color, edge);
  }

  function cylinder(c, x, y, z0, z1, r, color) {
    const [bx, by] = iso(x, y, z0), [tx, ty] = iso(x, y, z1);
    const rx = r * TW * 0.72, ry = r * TH * 0.72;
    const g = c.createLinearGradient(bx - rx, 0, bx + rx, 0);
    g.addColorStop(0, shade(color, -0.2)); g.addColorStop(0.45, shade(color, 0.05)); g.addColorStop(1, shade(color, -0.55));
    c.fillStyle = g;
    c.beginPath(); c.ellipse(bx, by, rx, ry, 0, 0, Math.PI); c.lineTo(tx - rx, ty); c.ellipse(tx, ty, rx, ry, 0, Math.PI, 0, true); c.closePath(); c.fill();
    c.fillStyle = shade(color, 0.15);
    c.beginPath(); c.ellipse(tx, ty, rx, ry, 0, 0, Math.PI * 2); c.fill();
  }

  function buildStatic() {
    const layer = document.createElement('canvas');
    layer.width = W * dpr; layer.height = H * dpr;
    const c = layer.getContext('2d');
    c.scale(dpr, dpr);
    const bg = c.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#162033'); bg.addColorStop(1, '#070a11');
    c.fillStyle = bg; c.fillRect(0, 0, W, H);
    // 보드 두께
    const D = 0.7;
    poly(c, [iso(0, sim.rows, 0), iso(sim.cols, sim.rows, 0), iso(sim.cols, sim.rows, -D), iso(0, sim.rows, -D)], '#2a3448');
    poly(c, [iso(sim.cols, 0, 0), iso(sim.cols, sim.rows, 0), iso(sim.cols, sim.rows, -D), iso(sim.cols, 0, -D)], '#1c2433');
    const PZ = -0.16;
    for (let s = 0; s < sim.cols + sim.rows; s++) {
      for (let x = 0; x < sim.cols; x++) {
        const y = s - x;
        if (y < 0 || y >= sim.rows) continue;
        const isPath = sim.pathCells.has(x + ',' + y);
        if (isPath) {
          poly(c, [iso(x, y, PZ), iso(x + 1, y, PZ), iso(x + 1, y + 1, PZ), iso(x, y + 1, PZ)], (x + y) % 2 ? '#3a3f4a' : '#363b46', 'rgba(0,0,0,0.25)');
          if (!sim.pathCells.has(x + ',' + (y - 1))) poly(c, [iso(x, y, 0), iso(x + 1, y, 0), iso(x + 1, y, PZ), iso(x, y, PZ)], '#4b5870');
          if (!sim.pathCells.has((x - 1) + ',' + y)) poly(c, [iso(x, y, 0), iso(x, y + 1, 0), iso(x, y + 1, PZ), iso(x, y, PZ)], '#56657f');
        } else {
          const v = ((x * 7 + y * 13) % 5) * 0.012;
          poly(c, [iso(x, y), iso(x + 1, y), iso(x + 1, y + 1), iso(x, y + 1)], shade('#3d5a6e', v - 0.02), 'rgba(10,20,30,0.35)');
        }
      }
    }
    // 경로 방향 표시
    c.strokeStyle = 'rgba(255,210,120,0.25)'; c.lineWidth = 2; c.setLineDash([6, 10]);
    c.beginPath(); sim.path.forEach((p, i) => { const [sx, sy] = iso(p.x, p.y, PZ); i ? c.lineTo(sx, sy) : c.moveTo(sx, sy); }); c.stroke(); c.setLineDash([]);
    for (const [x, y] of sim.map.sockets || []) {
      if (sim.towers.some((t) => t.cx === x && t.cy === y)) continue;
      poly(c, [iso(x + 0.2, y + 0.2), iso(x + 0.8, y + 0.2), iso(x + 0.8, y + 0.8), iso(x + 0.2, y + 0.8)], 'rgba(120,200,255,0.10)', 'rgba(120,200,255,0.45)');
    }
    return layer;
  }

  function drawTower(c, t) {
    const d = TOWERS[t.type];
    const x0 = t.cx + 0.14, y0 = t.cy + 0.14, x1 = t.cx + 0.86, y1 = t.cy + 0.86;
    box(c, x0, y0, x1, y1, 0, 0.28, '#4a5670', 'rgba(0,0,0,0.25)');
    box(c, x0 + 0.08, y0 + 0.08, x1 - 0.08, y1 - 0.08, 0.28, 0.34, shade(d.color, -0.35));
    const cx = t.x, cy = t.y, now = performance.now() / 1000;
    const rec = t.recoil * 0.08;
    const dir = [Math.cos(t.angle), Math.sin(t.angle)];
    const barrelBehind = (dir[0] + dir[1]) < 0;
    const barrel = (len, zc, width, color) => {
      const [ax, ay] = iso(cx - dir[0] * rec, cy - dir[1] * rec, zc);
      const [bx, by] = iso(cx + dir[0] * (len - rec), cy + dir[1] * (len - rec), zc);
      c.strokeStyle = color; c.lineWidth = width; c.lineCap = 'round';
      c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke();
    };
    if (t.type === 'gun') {
      const len = t.branch === 'b' ? 0.62 : 0.44;
      const draw = () => { if (t.branch === 'a') { barrel(len, 0.62, 5, '#1c2230'); barrel(len, 0.52, 5, '#1c2230'); } else barrel(len, 0.57, 7, '#1c2230'); };
      if (barrelBehind) draw();
      cylinder(c, cx, cy, 0.34, 0.66, 0.22, '#dfe7f2');
      const [lx, ly] = iso(cx, cy, 0.66); c.fillStyle = d.color; c.beginPath(); c.ellipse(lx, ly, 6, 3, 0, 0, Math.PI * 2); c.fill();
      if (!barrelBehind) draw();
    } else if (t.type === 'cannon') {
      if (barrelBehind) barrel(0.42, 0.6, 12, '#2a2f3a');
      cylinder(c, cx, cy, 0.34, 0.62, t.branch === 'b' ? 0.3 : 0.27, d.color);
      if (!barrelBehind) barrel(0.42, 0.6, 12, '#2a2f3a');
    } else if (t.type === 'frost') {
      cylinder(c, cx, cy, 0.34, 0.46, 0.18, '#c9d6e6');
      const bob = Math.sin(now * 2 + t.id) * 0.06;
      const [px, py] = iso(cx, cy, 0.95 + bob);
      c.save(); c.translate(px, py);
      const g = c.createLinearGradient(-10, 0, 10, 0); g.addColorStop(0, '#ffffff'); g.addColorStop(1, d.color);
      c.fillStyle = g; c.strokeStyle = 'rgba(255,255,255,0.8)';
      c.beginPath(); c.moveTo(0, -20); c.lineTo(10, 0); c.lineTo(0, 16); c.lineTo(-10, 0); c.closePath(); c.fill(); c.stroke();
      c.restore();
      c.fillStyle = hexA(d.color, 0.22); c.beginPath(); const [gx, gy] = iso(cx, cy, 0.34); c.ellipse(gx, gy, 20, 10, 0, 0, Math.PI * 2); c.fill();
    } else if (t.type === 'laser') {
      cylinder(c, cx, cy, 0.34, 0.95, 0.12, '#cfd6e2');
      const [lx, ly] = iso(cx, cy, 1.0);
      const pulse = t.beams.length ? 1 : 0.5;
      const g = c.createRadialGradient(lx, ly, 0, lx, ly, 16);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, hexA(d.color, pulse)); g.addColorStop(1, hexA(d.color, 0));
      c.fillStyle = g; c.beginPath(); c.arc(lx, ly, 16, 0, Math.PI * 2); c.fill();
    }
    // 레벨
    for (let i = 0; i < t.level; i++) {
      const [px, py] = iso(t.cx + 0.86, t.cy + 0.3 + i * 0.2, 0.14);
      c.fillStyle = d.color; c.fillRect(px - 2, py - 2, 4, 4);
    }
  }

  function drawEnemy(c, e) {
    const bob = Math.sin(performance.now() / 180 + e.id) * 0.03;
    const [sx, sy] = iso(e.x, e.y, 0);
    c.fillStyle = 'rgba(0,0,0,0.35)';
    c.beginPath(); c.ellipse(sx, sy, e.radius * TW * 0.8, e.radius * TH * 0.8, 0, 0, Math.PI * 2); c.fill();
    const col = e.hitT > 0 ? '#ffffff' : e.color;
    if (e.kind === 'tank') {
      const r = e.radius;
      box(c, e.x - r, e.y - r, e.x + r, e.y + r, 0.02, 0.36, col, 'rgba(0,0,0,0.3)');
    } else {
      const zc = e.radius + 0.1 + bob;
      const [bx, by] = iso(e.x, e.y, zc);
      const R = e.radius * TW * 0.62;
      const g = c.createRadialGradient(bx - R * 0.35, by - R * 0.4, R * 0.1, bx, by, R);
      g.addColorStop(0, shade(col, 0.55)); g.addColorStop(0.5, col); g.addColorStop(1, shade(col, -0.55));
      c.fillStyle = g; c.beginPath(); c.arc(bx, by, R, 0, Math.PI * 2); c.fill();
      if (e.kind === 'boss') {
        c.strokeStyle = hexA('#ffd0f0', 0.8); c.lineWidth = 2;
        c.beginPath(); c.ellipse(bx, by, R * 1.45, R * 0.55, performance.now() / 900, 0, Math.PI * 2); c.stroke();
      }
    }
    if (e.slowT > 0) { c.strokeStyle = 'rgba(170,236,255,0.85)'; c.lineWidth = 2; c.beginPath(); c.ellipse(sx, sy, e.radius * TW, e.radius * TH, 0, 0, Math.PI * 2); c.stroke(); }
    if (e.hp < e.maxHp) {
      const [hx, hy] = iso(e.x, e.y, e.radius * 2 + 0.45);
      const w = 26;
      c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(hx - w / 2, hy, w, 4);
      c.fillStyle = e.hp / e.maxHp > 0.4 ? '#6dff9a' : '#ff6a5a'; c.fillRect(hx - w / 2, hy, w * e.hp / e.maxHp, 4);
    }
  }

  function draw(ui, dt, events) {
    fx.consume(events);
    fx.update(dt);
    if (!staticLayer) staticLayer = buildStatic();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.save();
    if (fx.shake > 0) ctx.translate((Math.random() - 0.5) * fx.shake * 26, (Math.random() - 0.5) * fx.shake * 26);
    ctx.drawImage(staticLayer, 0, 0, W, H);
    const items = [];
    for (const p of props) items.push({ d: p.x + p.y, f: () => p.kind === 'crate' ? box(ctx, p.x - p.s, p.y - p.s, p.x + p.s, p.y + p.s, 0, p.s * 1.6, '#6b5a45', 'rgba(0,0,0,0.3)') : cylinder(ctx, p.x, p.y, 0, p.h + 0.3, 0.07, '#8b9bb4') });
    for (const t of sim.towers) items.push({ d: t.x + t.y, f: () => drawTower(ctx, t) });
    for (const e of sim.enemies) items.push({ d: e.x + e.y, f: () => drawEnemy(ctx, e) });
    for (const p of sim.projectiles) {
      items.push({ d: p.x + p.y + 0.01, f: () => {
        const [gx, gy] = iso(p.x, p.y, 0);
        if (p.arc) { ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(gx, gy, 6, 3, 0, 0, Math.PI * 2); ctx.fill(); }
        const [sx, sy] = iso(p.x, p.y, p.arc ? 0.5 + p.z : 0.57);
        ctx.fillStyle = p.type === 'cannon' ? '#2a2f3a' : p.color;
        ctx.beginPath(); ctx.arc(sx, sy, p.arc ? 6 : 3.5, 0, Math.PI * 2); ctx.fill();
        if (p.type !== 'cannon') { ctx.fillStyle = hexA(p.color, 0.3); ctx.beginPath(); ctx.arc(sx, sy, 8, 0, Math.PI * 2); ctx.fill(); }
      } });
    }
    items.sort((a, b) => a.d - b.d);
    for (const it of items) it.f();
    // 광선과 이펙트는 가산 합성으로 위에
    ctx.globalCompositeOperation = 'lighter';
    const byId = new Map(sim.enemies.map((e) => [e.id, e]));
    for (const t of sim.towers) {
      for (const id of t.beams || []) {
        const e = byId.get(id); if (!e) continue;
        const [ax, ay] = iso(t.x, t.y, 1.0), [bx, by] = iso(e.x, e.y, e.radius + 0.1);
        const w = 2 + (t.beamPower || 1) * 1.5;
        ctx.strokeStyle = hexA(TOWERS[t.type].color, 0.5); ctx.lineWidth = w * 2.5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = w * 0.5; ctx.stroke();
      }
    }
    for (const r of fx.rings) {
      const k = 1 - r.life / r.max;
      ctx.strokeStyle = hexA(r.color, 1 - k); ctx.lineWidth = 3 * (1 - k) + 1;
      const [sx, sy] = iso(r.x, r.y, 0.02);
      const R = r.r * (0.3 + 0.7 * (1 - (1 - k) ** 2));
      ctx.beginPath(); ctx.ellipse(sx, sy, R * TW * 0.707, R * TH * 0.707, 0, 0, Math.PI * 2); ctx.stroke();
    }
    for (const p of fx.particles) {
      const [sx, sy] = iso(p.x, p.y, p.z);
      ctx.fillStyle = hexA(toHex(p.color), Math.min(1, p.life / p.max * 1.5));
      ctx.beginPath(); ctx.arc(sx, sy, Math.max(1, p.size * TW * 0.5), 0, Math.PI * 2); ctx.fill();
    }
    for (const f of fx.flashes) {
      const k = f.life / f.max;
      const [sx, sy] = iso(f.x, f.y, f.z);
      const R = f.size * TW * 0.6;
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, R);
      g.addColorStop(0, `rgba(255,255,255,${k * 0.8})`); g.addColorStop(1, hexA(toHex(f.color), 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, R, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }

  return { draw, fx };
}

function toHex(c) { return c.startsWith('#') ? c : '#ffffff'; }
function mulberry(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
