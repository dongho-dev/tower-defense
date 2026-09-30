// 월드 좌표(x, y, z=높이) 파티클 시스템. 세 렌더러가 같은 이펙트 데이터를 각자 방식으로 그린다.

const MAX = 1400;

export class FX {
  constructor(intensity = 1) {
    this.particles = [];
    this.rings = [];
    this.flashes = [];
    this.shake = 0;
    this.intensity = intensity;
  }

  burst(x, y, z, color, n, speed, life, size, grav = 6, up = 2) {
    n = Math.round(n * this.intensity);
    for (let i = 0; i < n && this.particles.length < MAX; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.35 + Math.random() * 0.65);
      this.particles.push({
        x, y, z, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: up * (0.4 + Math.random()),
        life: life * (0.6 + Math.random() * 0.4), max: life, color, size: size * (0.6 + Math.random() * 0.6), grav
      });
    }
  }

  ring(x, y, r, color, life = 0.45, width = 0.08) {
    this.rings.push({ x, y, r, color, life, max: life, width });
  }

  flash(x, y, z, color, size = 0.5, life = 0.08) {
    this.flashes.push({ x, y, z, color, size, life, max: life });
  }

  consume(events) {
    for (const ev of events) {
      switch (ev.type) {
        case 'fire':
          this.flash(ev.x, ev.y, 0.45, ev.color, ev.tower === 'cannon' ? 0.7 : 0.4);
          if (ev.tower === 'cannon') this.burst(ev.x, ev.y, 0.45, '#ffd9a0', 4, 1.2, 0.35, 0.07, 1, 0.6);
          break;
        case 'hit':
          this.burst(ev.x, ev.y, 0.3, ev.color, 4, 2.5, 0.25, 0.05, 4, 1);
          break;
        case 'explode':
          this.burst(ev.x, ev.y, 0.2, '#ffcf6b', 16, 3.2, 0.55, 0.09, 5, 2.5);
          this.burst(ev.x, ev.y, 0.2, '#ff6a2a', 10, 1.6, 0.8, 0.12, 1, 1.2);
          this.ring(ev.x, ev.y, ev.r, '#ffb050', 0.4);
          this.flash(ev.x, ev.y, 0.3, '#ffe0a0', ev.r * 1.2, 0.12);
          this.shake = Math.max(this.shake, 0.12);
          break;
        case 'frostburst':
          this.burst(ev.x, ev.y, 0.25, '#d8f7ff', 10, 1.8, 0.6, 0.06, 1, 1);
          this.ring(ev.x, ev.y, ev.r, '#9fe8ff', 0.5, 0.06);
          break;
        case 'death':
          this.burst(ev.x, ev.y, 0.3, ev.color, ev.kind === 'boss' ? 60 : 14, ev.kind === 'boss' ? 4.5 : 3, 0.7, 0.08, 6, 3);
          this.ring(ev.x, ev.y, ev.kind === 'boss' ? 2.2 : 0.7, ev.color, 0.35, 0.05);
          if (ev.kind === 'boss') this.shake = 0.35;
          break;
        case 'spawn':
          this.ring(ev.x, ev.y, 0.6, ev.color, 0.5, 0.04);
          break;
        case 'build':
        case 'upgrade':
          this.ring(ev.x, ev.y, 0.9, ev.color, 0.6, 0.06);
          this.burst(ev.x, ev.y, 0.1, ev.color, 18, 1.2, 0.8, 0.06, -1.5, 1.5);
          break;
        case 'meteor':
          this.burst(ev.x, ev.y, 0.2, '#ffb347', 50, 5, 0.9, 0.12, 6, 4);
          this.burst(ev.x, ev.y, 0.2, '#6b4a3a', 24, 2, 1.2, 0.14, 4, 3);
          this.ring(ev.x, ev.y, ev.r * 1.2, '#ff8a3d', 0.6, 0.12);
          this.flash(ev.x, ev.y, 0.5, '#fff0c0', ev.r * 1.1, 0.18);
          this.shake = 0.45;
          break;
        case 'leak':
          this.ring(ev.x, ev.y, 1.0, '#ff3d5a', 0.5, 0.08);
          break;
      }
    }
  }

  update(dt) {
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.vz -= p.grav * dt;
      p.vx *= 1 - dt * 2.2; p.vy *= 1 - dt * 2.2;
      if (p.z < 0) { p.z = 0; p.vz *= -0.3; }
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const r of this.rings) r.life -= dt;
    this.rings = this.rings.filter((r) => r.life > 0);
    for (const f of this.flashes) f.life -= dt;
    this.flashes = this.flashes.filter((f) => f.life > 0);
    this.shake = Math.max(0, this.shake - dt);
  }
}
