// 2D 탑다운 Canvas 렌더러. glow=false는 깔끔한 게임성 데모용, glow=true는 Q2-C "2D + 광원 연출" 비교용.
import { TOWERS, towerStats, key } from './sim.js';
import { FX } from './fx.js';

export function createFlatRenderer(canvas, sim, opts = {}) {
  const glow = !!opts.glow;
  const C = opts.cell || 56;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = sim.cols * C, H = sim.rows * C;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.aspectRatio = `${W} / ${H}`;
  const ctx = canvas.getContext('2d');
  const fx = new FX(glow ? 1.4 : 0.8);
  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = W * dpr / 2;
  glowCanvas.height = H * dpr / 2;
  const gctx = glowCanvas.getContext('2d');
  const trails = new Map();
  let staticLayer = null, staticSig = '';
  const stars = Array.from({ length: 90 }, () => ({ x: Math.random() * W, y: Math.random() * H, a: Math.random() }));

  const P = (v) => v * C;

  function buildStatic() {
    const layer = document.createElement('canvas');
    layer.width = W * dpr; layer.height = H * dpr;
    const c = layer.getContext('2d');
    c.scale(dpr, dpr);
    if (glow) {
      const g = c.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, W * 0.7);
      g.addColorStop(0, '#0b1424'); g.addColorStop(1, '#03050a');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      for (const s of stars) { c.fillStyle = `rgba(160,200,255,${s.a * 0.35})`; c.fillRect(s.x, s.y, 1.2, 1.2); }
      c.strokeStyle = 'rgba(60,150,200,0.10)'; c.lineWidth = 1;
      for (let x = 0; x <= sim.cols; x++) { c.beginPath(); c.moveTo(P(x), 0); c.lineTo(P(x), H); c.stroke(); }
      for (let y = 0; y <= sim.rows; y++) { c.beginPath(); c.moveTo(0, P(y)); c.lineTo(W, P(y)); c.stroke(); }
    } else {
      c.fillStyle = '#161e2b'; c.fillRect(0, 0, W, H);
      for (let y = 0; y < sim.rows; y++) for (let x = 0; x < sim.cols; x++) {
        c.fillStyle = (x + y) % 2 ? '#1d2737' : '#1a2332';
        roundRect(c, P(x) + 1.5, P(y) + 1.5, C - 3, C - 3, 6); c.fill();
      }
    }
    if (sim.mode === 'path') {
      for (const k of sim.pathCells) {
        const [x, y] = k.split(',').map(Number);
        if (glow) { c.fillStyle = 'rgba(40,120,170,0.14)'; c.fillRect(P(x), P(y), C, C); }
        else { c.fillStyle = '#34435c'; roundRect(c, P(x) + 1, P(y) + 1, C - 2, C - 2, 4); c.fill(); }
      }
      if (!glow) {
        c.strokeStyle = 'rgba(255,214,120,0.35)'; c.lineWidth = 2; c.setLineDash([3, 9]); c.lineCap = 'round';
        c.beginPath(); sim.path.forEach((p, i) => (i ? c.lineTo(P(p.x), P(p.y)) : c.moveTo(P(p.x), P(p.y)))); c.stroke(); c.setLineDash([]);
      }
      if (glow) {
        c.save();
        c.shadowColor = '#2fd0ff'; c.shadowBlur = 18;
        c.strokeStyle = 'rgba(80,210,255,0.55)'; c.lineWidth = 2;
        strokeOffsetPath(c, sim.path, -0.42); strokeOffsetPath(c, sim.path, 0.42);
        c.restore();
      }
      if (sim.map.sockets && opts.showSockets) {
        for (const [x, y] of sim.map.sockets) {
          c.strokeStyle = glow ? 'rgba(90,200,255,0.35)' : 'rgba(150,180,220,0.35)';
          c.setLineDash([5, 4]); c.lineWidth = 1.5;
          roundRect(c, P(x) + 7, P(y) + 7, C - 14, C - 14, 8); c.stroke(); c.setLineDash([]);
        }
      }
    } else {
      const [sx, sy] = sim.map.entry, [ex, ey] = sim.map.exit;
      c.fillStyle = 'rgba(255,90,90,0.25)'; c.fillRect(0, P(sy), C * 0.25, C);
      c.fillStyle = 'rgba(90,255,160,0.25)'; c.fillRect(W - C * 0.25, P(ey), C * 0.25, C);
      c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(P(sx), P(sy), C, C); c.fillRect(P(ex), P(ey), C, C);
    }
    return layer;
  }

  function strokeOffsetPath(c, pts, off) {
    c.beginPath();
    pts.forEach((p, i) => {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      const x = P(p.x + Math.cos(ang + Math.PI / 2) * off), y = P(p.y + Math.sin(ang + Math.PI / 2) * off);
      i ? c.lineTo(x, y) : c.moveTo(x, y);
    });
    c.stroke();
  }

  function drawTower(c, t, ui) {
    const d = TOWERS[t.type];
    const x = P(t.x), y = P(t.y);
    const selected = ui.selected === t;
    if (d.wall) {
      c.fillStyle = '#3b4658'; c.strokeStyle = selected ? '#fff' : '#566379'; c.lineWidth = 2;
      roundRect(c, x - C * 0.44, y - C * 0.44, C * 0.88, C * 0.88, 6); c.fill(); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.08)'; c.beginPath(); c.moveTo(x - C * 0.44, y); c.lineTo(x + C * 0.44, y); c.moveTo(x, y - C * 0.44); c.lineTo(x, y); c.stroke();
      return;
    }
    // 베이스
    c.save();
    c.translate(x, y);
    if (glow) { c.shadowColor = d.color; c.shadowBlur = selected ? 22 : 10; }
    c.fillStyle = glow ? '#08111d' : '#2b3647';
    c.strokeStyle = glow ? d.color : (selected ? '#ffffff' : '#44536b');
    c.lineWidth = glow ? 1.6 : 2;
    roundRect(c, -C * 0.4, -C * 0.4, C * 0.8, C * 0.8, 9); c.fill(); c.stroke();
    c.shadowBlur = 0;
    // 포신
    const rec = t.recoil * C * 0.06;
    c.rotate(t.type === 'frost' ? performance.now() / 900 : t.angle);
    c.fillStyle = d.color;
    c.strokeStyle = glow ? '#ffffff' : '#0e1622';
    c.lineWidth = 1.5;
    if (t.type === 'gun') {
      const long = t.branch === 'b';
      if (t.branch === 'a') { c.fillRect(C * 0.05 - rec, -C * 0.12, C * 0.34, C * 0.07); c.fillRect(C * 0.05 - rec, C * 0.05, C * 0.34, C * 0.07); }
      else c.fillRect(C * 0.05 - rec, -C * 0.045, C * (long ? 0.55 : 0.36), C * 0.09);
      circle(c, 0, 0, C * 0.19); c.fill(); c.stroke();
    } else if (t.type === 'cannon') {
      c.fillStyle = shade(d.color, -0.25);
      c.fillRect(C * 0.02 - rec * 1.5, -C * 0.08, C * 0.36, C * 0.16);
      c.fillStyle = d.color;
      circle(c, 0, 0, C * (t.branch === 'b' ? 0.26 : 0.23)); c.fill(); c.stroke();
    } else if (t.type === 'frost') {
      poly(c, 6, C * 0.25); c.fill(); c.stroke();
      c.fillStyle = '#ffffff'; poly(c, 6, C * 0.1); c.fill();
      if (t.branch === 'a') { c.strokeStyle = 'rgba(166,236,255,0.5)'; circle(c, 0, 0, C * 0.33); c.stroke(); }
    } else if (t.type === 'laser') {
      poly(c, 4, C * 0.26); c.fill(); c.stroke();
      c.fillStyle = '#fff'; circle(c, C * 0.12, 0, C * 0.06); c.fill();
    }
    c.restore();
    // 레벨 표시
    for (let i = 0; i < t.level; i++) {
      c.fillStyle = glow ? d.color : '#e8eef7';
      circle(c, x - C * 0.14 + i * C * 0.14, y + C * 0.3, 2.6); c.fill();
    }
    if (t.branch) {
      c.fillStyle = '#0b1220'; c.strokeStyle = d.color; c.lineWidth = 1.5;
      circle(c, x + C * 0.3, y - C * 0.3, 8); c.fill(); c.stroke();
      c.fillStyle = d.color; c.font = 'bold 10px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(t.branch.toUpperCase(), x + C * 0.3, y - C * 0.3 + 0.5);
    }
    if (t.buff > 1) {
      c.fillStyle = '#7dffb0'; c.font = 'bold 10px sans-serif'; c.textAlign = 'center';
      c.fillText('+' + Math.round((t.buff - 1) * 100) + '%', x - C * 0.24, y - C * 0.3);
    }
  }

  function drawEnemy(c, e) {
    const x = P(e.x), y = P(e.y), r = P(e.radius);
    c.fillStyle = 'rgba(0,0,0,0.35)';
    ellipse(c, x + 3, y + 5, r * 1.05, r * 0.7); c.fill();
    c.save();
    c.translate(x, y);
    c.rotate(e.heading);
    if (glow) { c.shadowColor = e.color; c.shadowBlur = 14; }
    c.fillStyle = e.hitT > 0 ? '#ffffff' : e.color;
    c.strokeStyle = glow ? '#fff' : '#10141c';
    c.lineWidth = glow ? 1 : 2;
    if (e.kind === 'runner') { c.beginPath(); c.moveTo(r * 1.3, 0); c.lineTo(-r, -r * 0.9); c.lineTo(-r * 0.5, 0); c.lineTo(-r, r * 0.9); c.closePath(); }
    else if (e.kind === 'tank') { roundRect(c, -r, -r * 0.85, r * 2, r * 1.7, 4); }
    else if (e.kind === 'boss') { poly(c, 6, r); }
    else { circle(c, 0, 0, r); }
    c.fill(); c.stroke();
    c.shadowBlur = 0;
    if (e.kind !== 'runner') { c.fillStyle = 'rgba(255,255,255,0.8)'; circle(c, r * 0.45, 0, r * 0.22); c.fill(); }
    c.restore();
    if (e.slowT > 0) { c.strokeStyle = 'rgba(166,236,255,0.9)'; c.lineWidth = 2; circle(c, x, y, r + 4); c.stroke(); }
    if (e.hp < e.maxHp) {
      const w = Math.max(18, r * 2.2);
      c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(x - w / 2, y - r - 10, w, 4);
      c.fillStyle = e.hp / e.maxHp > 0.4 ? '#6dff9a' : '#ff6a5a';
      c.fillRect(x - w / 2, y - r - 10, w * Math.max(0, e.hp / e.maxHp), 4);
    }
  }

  function drawProjectile(c, p, emissive) {
    const x = P(p.x), y = P(p.y) - P(p.arc ? p.z * 0.5 : 0);
    if (p.arc && !emissive) {
      c.fillStyle = 'rgba(0,0,0,0.3)'; ellipse(c, P(p.x), P(p.y) + 4, 5, 3); c.fill();
    }
    if (glow) {
      const tr = trails.get(p.id) || [];
      tr.push([x, y]); if (tr.length > 7) tr.shift(); trails.set(p.id, tr);
      c.strokeStyle = p.color; c.lineCap = 'round';
      for (let i = 1; i < tr.length; i++) {
        c.globalAlpha = i / tr.length * 0.8; c.lineWidth = (i / tr.length) * (p.arc ? 7 : 4);
        c.beginPath(); c.moveTo(tr[i - 1][0], tr[i - 1][1]); c.lineTo(tr[i][0], tr[i][1]); c.stroke();
      }
      c.globalAlpha = 1;
    }
    c.fillStyle = emissive ? p.color : (p.type === 'cannon' ? '#2a2f38' : p.color);
    circle(c, x, y, p.arc ? 5.5 : 3.5); c.fill();
    if (emissive || glow) { c.fillStyle = '#fff'; circle(c, x, y, p.arc ? 2.5 : 1.6); c.fill(); }
  }

  function drawBeams(c, byId, emissive) {
    for (const t of sim.towers) {
      if (!t.beams || !t.beams.length) continue;
      const d = TOWERS[t.type];
      for (const id of t.beams) {
        const e = byId.get(id); if (!e) continue;
        const w = 2 + (t.beamPower || 1) * 1.6;
        const x0 = P(t.x + Math.cos(t.angle) * 0.25), y0 = P(t.y + Math.sin(t.angle) * 0.25);
        c.lineCap = 'round';
        c.strokeStyle = d.color; c.lineWidth = w * (emissive ? 2.2 : 1.4);
        c.globalAlpha = emissive ? 0.9 : 0.55;
        c.beginPath(); c.moveTo(x0, y0); c.lineTo(P(e.x), P(e.y)); c.stroke();
        c.globalAlpha = 1; c.strokeStyle = '#fff'; c.lineWidth = w * 0.4;
        c.beginPath(); c.moveTo(x0, y0); c.lineTo(P(e.x), P(e.y)); c.stroke();
      }
    }
  }

  function drawFx(c, emissive) {
    for (const r of fx.rings) {
      const k = 1 - r.life / r.max;
      c.globalAlpha = (1 - k) * (emissive ? 1 : 0.8);
      c.strokeStyle = r.color; c.lineWidth = P(r.width) * (1 - k * 0.5) * (emissive ? 1.6 : 1);
      circle(c, P(r.x), P(r.y), P(r.r) * (0.3 + 0.7 * easeOut(k))); c.stroke();
    }
    for (const p of fx.particles) {
      c.globalAlpha = Math.min(1, p.life / p.max * 1.4);
      c.fillStyle = p.color;
      circle(c, P(p.x), P(p.y) - P(p.z * 0.5), Math.max(0.8, P(p.size) * (emissive ? 1.4 : 1))); c.fill();
    }
    for (const f of fx.flashes) {
      const k = f.life / f.max;
      const g = c.createRadialGradient(P(f.x), P(f.y), 0, P(f.x), P(f.y), P(f.size));
      g.addColorStop(0, 'rgba(255,255,255,' + k * 0.8 + ')'); g.addColorStop(0.4, hexA(f.color, k * 0.45)); g.addColorStop(1, hexA(f.color, 0));
      c.globalAlpha = 1; c.fillStyle = g; circle(c, P(f.x), P(f.y), P(f.size)); c.fill();
    }
    c.globalAlpha = 1;
  }

  function drawOverlay(c, ui) {
    if (sim.mode === 'flow' && sim.route) {
      c.strokeStyle = 'rgba(255,220,120,0.45)'; c.lineWidth = 3; c.setLineDash([2, 8]); c.lineCap = 'round';
      c.lineDashOffset = -performance.now() / 40;
      c.beginPath(); sim.route.forEach((p, i) => (i ? c.lineTo(P(p.x), P(p.y)) : c.moveTo(P(p.x), P(p.y)))); c.stroke();
      c.setLineDash([]);
    }
    for (const [a, b] of sim.links) {
      c.strokeStyle = 'rgba(125,255,176,0.55)'; c.lineWidth = 3; c.setLineDash([4, 4]);
      c.beginPath(); c.moveTo(P(a.x), P(a.y)); c.lineTo(P(b.x), P(b.y)); c.stroke(); c.setLineDash([]);
    }
    if (ui.hover) {
      const { cx, cy, valid } = ui.hover;
      c.fillStyle = valid ? 'rgba(120,255,170,0.18)' : 'rgba(255,90,90,0.18)';
      c.strokeStyle = valid ? 'rgba(120,255,170,0.8)' : 'rgba(255,90,90,0.8)';
      c.lineWidth = 2; roundRect(c, P(cx) + 3, P(cy) + 3, C - 6, C - 6, 8); c.fill(); c.stroke();
      if (ui.placeType && valid && !TOWERS[ui.placeType].wall) rangeCircle(c, cx + 0.5, cy + 0.5, TOWERS[ui.placeType].range * sim.mods.range, TOWERS[ui.placeType].color);
    }
    if (ui.selected && !TOWERS[ui.selected.type].wall) rangeCircle(c, ui.selected.x, ui.selected.y, towerStats(sim, ui.selected).range, TOWERS[ui.selected.type].color);
    if (ui.targeting && ui.pointer) {
      c.strokeStyle = 'rgba(255,140,60,0.9)'; c.fillStyle = 'rgba(255,140,60,0.15)'; c.lineWidth = 2;
      circle(c, P(ui.pointer.x), P(ui.pointer.y), P(1.5)); c.fill(); c.stroke();
    }
    for (const m of sim.meteors) {
      c.strokeStyle = 'rgba(255,120,40,0.9)'; c.lineWidth = 2;
      circle(c, P(m.x), P(m.y), P(m.r) * (1 - m.t / 0.7 * 0.5)); c.stroke();
      const h = m.t / 0.7;
      c.fillStyle = '#ffcf6b'; circle(c, P(m.x) + h * 120, P(m.y) - h * 260, 9); c.fill();
    }
  }

  function rangeCircle(c, x, y, r, color) {
    c.fillStyle = hexA(color, 0.08); c.strokeStyle = hexA(color, 0.6); c.lineWidth = 1.5;
    circle(c, P(x), P(y), P(r)); c.fill(); c.stroke();
  }

  function draw(ui = {}, dt = 0.016, events = []) {
    fx.consume(events);
    fx.update(dt);
    const sig = sim.mode === 'flow' ? 'f' : 'p';
    if (!staticLayer || sig !== staticSig) { staticLayer = buildStatic(); staticSig = sig; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.save();
    if (fx.shake > 0) ctx.translate((Math.random() - 0.5) * fx.shake * 30, (Math.random() - 0.5) * fx.shake * 30);
    ctx.drawImage(staticLayer, 0, 0, W, H);
    if (glow && sim.mode === 'path') drawPathFlow(ctx);
    const byId = new Map(sim.enemies.map((e) => [e.id, e]));
    drawOverlay(ctx, ui);
    for (const t of sim.towers) drawTower(ctx, t, ui);
    for (const e of sim.enemies) drawEnemy(ctx, e);
    if (glow) ctx.globalCompositeOperation = 'lighter';
    drawBeams(ctx, byId, false);
    for (const p of sim.projectiles) drawProjectile(ctx, p, false);
    drawFx(ctx, false);
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
    if (glow) {
      // 저해상도 발광 레이어를 블러해서 더하는 간이 블룸
      gctx.setTransform(dpr / 2, 0, 0, dpr / 2, 0, 0);
      gctx.globalCompositeOperation = 'source-over';
      gctx.clearRect(0, 0, W, H);
      gctx.globalCompositeOperation = 'lighter';
      drawBeams(gctx, byId, true);
      for (const p of sim.projectiles) drawProjectile(gctx, p, true);
      drawFx(gctx, true);
      for (const e of sim.enemies) { gctx.fillStyle = hexA(e.color, 0.5); circle(gctx, P(e.x), P(e.y), P(e.radius) * 1.3); gctx.fill(); }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'lighter';
      ctx.filter = 'blur(10px)';
      ctx.globalAlpha = 0.6;
      ctx.drawImage(glowCanvas, 0, 0, canvas.width, canvas.height);
      ctx.filter = 'blur(3px)';
      ctx.globalAlpha = 0.35;
      ctx.drawImage(glowCanvas, 0, 0, canvas.width, canvas.height);
      ctx.filter = 'none'; ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    for (const id of trails.keys()) if (!sim.projectiles.some((p) => p.id === id)) trails.delete(id);
  }

  function drawPathFlow(c) {
    const t = performance.now() / 1000;
    const total = sim.pathLen[sim.pathLen.length - 1];
    c.save();
    c.globalCompositeOperation = 'lighter';
    for (let d = (t * 1.6) % 1.2; d < total; d += 1.2) {
      const p = pointOn(d);
      c.fillStyle = 'rgba(80,200,255,0.35)'; circle(c, P(p.x), P(p.y), 2.2); c.fill();
    }
    c.restore();
  }
  function pointOn(d) {
    const Pp = sim.path, L = sim.pathLen;
    for (let i = 1; i < Pp.length; i++) if (d <= L[i]) {
      const k = (d - L[i - 1]) / (L[i] - L[i - 1]);
      return { x: Pp[i - 1].x + (Pp[i].x - Pp[i - 1].x) * k, y: Pp[i - 1].y + (Pp[i].y - Pp[i - 1].y) * k };
    }
    return Pp[Pp.length - 1];
  }

  function cellAt(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    const x = ((clientX - r.left) / r.width) * sim.cols;
    const y = ((clientY - r.top) / r.height) * sim.rows;
    return { x, y, cx: Math.floor(x), cy: Math.floor(y) };
  }

  function invalidate() { staticLayer = null; }

  return { draw, cellAt, fx, invalidate };
}

// ---------- 그리기 도우미 ----------
export function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
export function circle(c, x, y, r) { c.beginPath(); c.arc(x, y, Math.max(0.1, r), 0, Math.PI * 2); }
function ellipse(c, x, y, rx, ry) { c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); }
function poly(c, n, r) {
  c.beginPath();
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; i ? c.lineTo(Math.cos(a) * r, Math.sin(a) * r) : c.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  c.closePath();
}
function easeOut(k) { return 1 - (1 - k) * (1 - k); }
export function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a))})`;
}
export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + (amt < 0 ? v * amt : (255 - v) * amt))));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
export { key };
