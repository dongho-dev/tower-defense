// 2D 오버레이 캔버스: 적 체력바, 떠오르는 숫자(골드·생명). 3D 위치를 화면에 투영해 선명하게 그린다.
import * as THREE from 'three';

const _v = new THREE.Vector3();

export class Overlay {
    constructor(canvas, camera, entities) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.camera = camera;
        this.entities = entities;
        this.floaters = [];
        this.dpr = 1;
        this.resize();
    }

    resize() {
        this.dpr = Math.min(2, window.devicePixelRatio || 1);
        this.w = window.innerWidth;
        this.h = window.innerHeight;
        this.canvas.width = this.w * this.dpr;
        this.canvas.height = this.h * this.dpr;
    }

    project(v) {
        _v.copy(v).project(this.camera);
        return { x: ((_v.x + 1) / 2) * this.w, y: ((1 - _v.y) / 2) * this.h, behind: _v.z > 1 };
    }

    float(text, worldPos, color, size = 16) {
        this.floaters.push({ text, pos: worldPos.clone(), color, size, t: 0, life: 1.1 });
    }

    handle(events, state) {
        for (const ev of events) {
            if (ev.type === 'death') {
                const p = new THREE.Vector3(ev.x, 1.3, ev.z);
                this.float('+' + ev.bounty, p, '#ffd66e', ev.elite || ev.enemy === 'colossus' ? 22 : 15);
            } else if (ev.type === 'leak') {
                const c = this.entities.world.core.top;
                this.float('-' + ev.lives, c.clone().add(new THREE.Vector3(0, 1.5, 0)), '#ff6a6a', 26);
            } else if (ev.type === 'income') {
                this.float('+' + ev.amount, new THREE.Vector3(ev.x, 2, ev.z), '#9dffbe', 18);
            } else if (ev.type === 'sell') {
                this.float('+' + ev.value, new THREE.Vector3(ev.x, 1.8, ev.z), '#ffd66e', 18);
            } else if (ev.type === 'waveStart' && ev.bonus > 0) {
                const pg = this.entities.world.portal.group.position;
                this.float('조기 호출 +' + ev.bonus, pg.clone().add(new THREE.Vector3(0, 3.2, 0)), '#ffd66e', 18);
            }
        }
        void state;
    }

    /** 공명 연결선: 받는 효과는 이웃 → 이 타워, 주는 효과는 이 타워 → 이웃 화살표와 라벨 */
    drawLinks(g, t) {
        if (!this.links || !this.links.length) return;
        const world = this.entities.world;
        const P = (p) => this.project(_v.set(p.x, world.heightAt(p.x, p.z) + 0.35, p.z));
        g.save();
        g.font = '700 12px "Noto Sans KR", sans-serif';
        g.textBaseline = 'middle';
        for (const L of this.links) {
            const a = P(L.a);
            const b = P(L.b);
            if (a.behind || b.behind) continue;
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const len = Math.hypot(dx, dy) || 1;
            const nx = -dy / len;
            const ny = dx / len;
            if (L.empty || L.same) {
                g.setLineDash([4, 6]);
                g.lineWidth = 1.5;
                g.strokeStyle = L.same ? 'rgba(200,190,210,0.45)' : 'rgba(255,227,163,0.55)';
                g.beginPath();
                g.moveTo(a.x, a.y);
                g.lineTo(b.x, b.y);
                g.stroke();
                g.setLineDash([]);
                this.chip(
                    g,
                    b.x,
                    b.y - 18,
                    L.same ? '같은 종류 · 공명 없음' : '빈 자리 · 다른 종류를 지으면 공명',
                    L.same ? '#a89fb8' : '#ffe3a3',
                    true
                );
                continue;
            }
            const both = L.recv && L.give;
            const arrow = (from, to, off, color, k) => {
                const fx = from.x + nx * off;
                const fy = from.y + ny * off;
                const tx = to.x + nx * off;
                const ty = to.y + ny * off;
                const ux = (tx - fx) / len;
                const uy = (ty - fy) / len;
                const sx = fx + ux * 22;
                const sy = fy + uy * 22;
                const ex = tx - ux * 26;
                const ey = ty - uy * 26;
                g.lineWidth = 3;
                g.strokeStyle = color;
                g.shadowColor = color;
                g.shadowBlur = 10;
                g.globalAlpha = 0.9;
                g.beginPath();
                g.moveTo(sx, sy);
                g.lineTo(ex, ey);
                g.stroke();
                g.beginPath();
                g.moveTo(ex + ux * 9, ey + uy * 9);
                g.lineTo(ex - uy * 6, ey + ux * 6);
                g.lineTo(ex + uy * 6, ey - ux * 6);
                g.closePath();
                g.fillStyle = color;
                g.fill();
                // 흐르는 빛 점
                const p = (t * 0.8 + k) % 1;
                g.beginPath();
                g.arc(sx + (ex - sx) * p, sy + (ey - sy) * p, 2.6, 0, Math.PI * 2);
                g.fillStyle = '#fff';
                g.fill();
                g.shadowBlur = 0;
                g.globalAlpha = 1;
            };
            if (L.recv) arrow(b, a, both ? 6 : 0, L.recv.color, 0);
            if (L.give) arrow(a, b, both ? -6 : 0, L.give.color, 0.5);
            // 라벨은 이웃 소켓 위에 한데 모은다: 받음(이웃 색) / 줌(내 색)
            let y = b.y - 30 - (both ? 11 : 0);
            if (L.recv) {
                this.chip(g, b.x, y, '받음 · ' + L.recv.label, L.recv.color);
                y += 22;
            }
            if (L.give) this.chip(g, b.x, y, '줌 · ' + L.give.label, L.give.color);
        }
        g.restore();
    }

    chip(g, x, y, text, color, faint = false) {
        const w = g.measureText(text).width + 14;
        g.fillStyle = faint ? 'rgba(14,9,22,0.6)' : 'rgba(14,9,22,0.85)';
        g.strokeStyle = color;
        g.lineWidth = 1;
        g.beginPath();
        g.roundRect(x - w / 2, y - 10, w, 20, 10);
        g.fill();
        g.globalAlpha = faint ? 0.6 : 1;
        g.stroke();
        g.fillStyle = color;
        g.textAlign = 'center';
        g.fillText(text, x, y + 0.5);
        g.globalAlpha = 1;
    }

    draw(state, dt, hoverEnemyId, selectedEnemyId) {
        const g = this.ctx;
        g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        g.clearRect(0, 0, this.w, this.h);
        this.time = (this.time || 0) + dt;
        this.drawLinks(g, this.time);
        // 선택한 적 표시
        const sel = selectedEnemyId != null && state.enemies.find((e) => e.id === selectedEnemyId);
        if (sel) {
            const c = this.entities.enemyCenter(sel, _v.set(0, 0, 0));
            const p = this.project(c);
            const r = 20 * sel.scale + Math.sin(this.time * 6) * 2;
            g.strokeStyle = '#ffe3a3';
            g.lineWidth = 2;
            g.beginPath();
            g.ellipse(p.x, p.y + r * 0.6, r, r * 0.45, 0, 0, Math.PI * 2);
            g.stroke();
        }
        // 체력바: 맞았거나 정예·보스이거나 마우스를 올린 적만
        for (const e of state.enemies) {
            const hurt = e.hp < e.maxHp;
            if (!hurt && !e.elite && e.id !== hoverEnemyId && e.id !== selectedEnemyId) continue;
            if (e.def.boss) continue; // 보스는 상단 전용 바
            const top = this.entities.enemyCenter(e, _v.set(0, 0, 0));
            top.y += 0.55 * e.scale + (e.def.flying ? 0.15 : 0.35);
            const p = this.project(top);
            if (p.behind) continue;
            const w = e.elite ? 46 : 34;
            const h = e.elite ? 6 : 5;
            const x = Math.round(p.x - w / 2);
            const y = Math.round(p.y);
            const r = Math.max(0, e.hp / e.maxHp);
            g.fillStyle = 'rgba(10,6,16,0.8)';
            g.fillRect(x - 1, y - 1, w + 2, h + 2);
            const grd = g.createLinearGradient(x, 0, x + w, 0);
            if (r > 0.5) {
                grd.addColorStop(0, '#4fc76a');
                grd.addColorStop(1, '#a6f07a');
            } else if (r > 0.25) {
                grd.addColorStop(0, '#e0a53a');
                grd.addColorStop(1, '#ffd66e');
            } else {
                grd.addColorStop(0, '#d63a3a');
                grd.addColorStop(1, '#ff7a6a');
            }
            g.fillStyle = grd;
            g.fillRect(x, y, Math.max(1, w * r), h);
            if (e.slowT > 0 || e.frozenT > 0) {
                g.fillStyle = '#8fe3ff';
                g.fillRect(x, y + h - 1, w * r, 1);
            }
            if (e.elite) {
                g.strokeStyle = '#e6b85c';
                g.lineWidth = 1;
                g.strokeRect(x - 1.5, y - 1.5, w + 3, h + 3);
            }
        }
        // 떠오르는 숫자
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        for (const f of this.floaters) {
            f.t += dt;
            const k = f.t / f.life;
            const p = this.project(f.pos);
            if (p.behind) continue;
            const y = p.y - k * 36;
            g.globalAlpha = k < 0.15 ? k / 0.15 : 1 - Math.max(0, (k - 0.6) / 0.4);
            g.font = `800 ${f.size}px Cinzel, "Noto Sans KR", serif`;
            g.lineWidth = 4;
            g.strokeStyle = 'rgba(12,6,18,0.85)';
            g.strokeText(f.text, p.x, y);
            g.fillStyle = f.color;
            g.fillText(f.text, p.x, y);
        }
        g.globalAlpha = 1;
        this.floaters = this.floaters.filter((f) => f.t < f.life);
    }
}
