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
            } else if (ev.type === 'sell') {
                this.float('+' + ev.value, new THREE.Vector3(ev.x, 1.8, ev.z), '#ffd66e', 18);
            } else if (ev.type === 'waveStart' && ev.bonus > 0) {
                const pg = this.entities.world.portal.group.position;
                this.float('조기 호출 +' + ev.bonus, pg.clone().add(new THREE.Vector3(0, 3.2, 0)), '#ffd66e', 18);
            }
        }
        void state;
    }

    draw(state, dt, hoverEnemyId) {
        const g = this.ctx;
        g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        g.clearRect(0, 0, this.w, this.h);
        // 체력바: 맞았거나 정예·보스이거나 마우스를 올린 적만
        for (const e of state.enemies) {
            const hurt = e.hp < e.maxHp;
            if (!hurt && !e.elite && e.id !== hoverEnemyId) continue;
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
