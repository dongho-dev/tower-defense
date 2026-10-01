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
        const pos = worldPos.clone();
        // 살아남기: 땅 높이가 제각각이라 땅 위로 올린다
        const w = this.entities.world;
        if (w.survival) pos.y += w.heightAt(pos.x, pos.z);
        this.floaters.push({ text, pos, color, size, t: 0, life: 1.1 });
    }

    handle(events, state) {
        for (const ev of events) {
            if (ev.type === 'death') {
                const p = new THREE.Vector3(ev.x, 1.3, ev.z);
                this.float('+' + ev.bounty, p, '#ffd66e', ev.elite || ev.boss ? 22 : 15);
            } else if (ev.type === 'leak') {
                const c = this.entities.world.core.top;
                this.float('-' + ev.lives, c.clone().add(new THREE.Vector3(0, 1.5, 0)), '#ff6a6a', 26);
            } else if (ev.type === 'income') {
                this.float('+' + ev.amount, new THREE.Vector3(ev.x, 2, ev.z), '#9dffbe', 18);
            } else if (ev.type === 'sell') {
                this.float('+' + ev.value, new THREE.Vector3(ev.x, 1.8, ev.z), '#ffd66e', 18);
            } else if (ev.type === 'towerDestroyed') {
                this.float('붕괴!', new THREE.Vector3(ev.x, 2, ev.z), '#ff6a6a', 22);
            } else if (ev.type === 'repair') {
                const y = ev.gateId != null ? 3 : 2;
                this.float(
                    (ev.rebuilt ? '재건 -' : '수리 -') + ev.cost,
                    new THREE.Vector3(ev.x, y, ev.z),
                    '#9fd8ff',
                    16
                );
            } else if (ev.type === 'gateBroken') {
                this.float('성문 붕괴!', new THREE.Vector3(ev.x, 3.2, ev.z), '#ff6a6a', 26);
            } else if (ev.type === 'gateReinforce') {
                this.float('보강 -' + ev.cost, new THREE.Vector3(ev.x, 3, ev.z), '#ffe3a3', 18);
            } else if (ev.type === 'heroLevel') {
                this.float('LEVEL ' + ev.level, new THREE.Vector3(ev.x, 2.2, ev.z), '#ffe3a3', 22);
            } else if (ev.type === 'immune') {
                this.float('면역', new THREE.Vector3(ev.x, 1.6, ev.z), '#c8c0d8', 13);
            } else if (ev.type === 'shieldBreak') {
                this.float('보호막 파괴', new THREE.Vector3(ev.x, 3.2, ev.z), '#bfefff', 20);
            } else if (ev.type === 'enrage') {
                this.float('분노!', new THREE.Vector3(ev.x, 1.8, ev.z), '#ff8a5a', 18);
            } else if (ev.type === 'heroMove') {
                this.moveMark = { x: ev.x, z: ev.z, t: 0 };
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

    /** 아군 유닛·타워 체력, 기절 표시, 집결지 깃발, 영웅 이동 표시 */
    drawField(g, state) {
        const world = this.entities.world;
        const ui = this.ui || {};
        // 영웅 이동 목표
        if (this.moveMark) {
            const m = this.moveMark;
            m.t += 1 / 60;
            const p = this.project(_v.set(m.x, world.heightAt(m.x, m.z) + 0.05, m.z));
            const k = Math.min(1, m.t / 0.6);
            if (!p.behind) {
                g.strokeStyle = `rgba(255,227,163,${1 - k})`;
                g.lineWidth = 2;
                for (const r of [1, 0.55]) {
                    g.beginPath();
                    g.ellipse(p.x, p.y, 26 * r * (1.2 - k * 0.5), 11 * r * (1.2 - k * 0.5), 0, 0, Math.PI * 2);
                    g.stroke();
                }
            }
            if (k >= 1) this.moveMark = null;
        }
        // 집결지 깃발
        if (ui.rally) {
            const r = ui.rally;
            const p = this.project(_v.set(r.x, world.heightAt(r.x, r.z), r.z));
            if (!p.behind) {
                g.strokeStyle = '#e8eefc';
                g.lineWidth = 2;
                g.beginPath();
                g.moveTo(p.x, p.y);
                g.lineTo(p.x, p.y - 30);
                g.stroke();
                g.fillStyle = '#9fc0ff';
                g.beginPath();
                g.moveTo(p.x, p.y - 30);
                g.lineTo(p.x + 18, p.y - 25);
                g.lineTo(p.x, p.y - 19);
                g.fill();
                g.strokeStyle = 'rgba(159,192,255,0.6)';
                g.beginPath();
                g.ellipse(p.x, p.y, 16, 7, 0, 0, Math.PI * 2);
                g.stroke();
            }
        }
        const bar = (x, y, w, h, r, c1, c2, frame) => {
            g.fillStyle = 'rgba(10,6,16,0.85)';
            g.fillRect(x - 1, y - 1, w + 2, h + 2);
            g.fillStyle = c1;
            g.fillRect(x, y, Math.max(1, w * r), h);
            if (c2) {
                g.fillStyle = c2;
                g.fillRect(x, y, Math.max(1, w * r), 1);
            }
            if (frame) {
                g.strokeStyle = frame;
                g.lineWidth = 1;
                g.strokeRect(x - 1.5, y - 1.5, w + 3, h + 3);
            }
        };
        // 유닛 체력
        for (const u of state.units || []) {
            if (u.dead) continue;
            const hero = u.kind === 'hero';
            if (!hero && u.hp >= u.maxHp) continue;
            const top = this.entities.unitTop(u, _v);
            if (!top) continue;
            const p = this.project(top);
            if (p.behind) continue;
            const w = hero ? 44 : 22;
            const h = hero ? 5 : 3;
            const r = Math.max(0, u.hp / u.maxHp);
            bar(
                Math.round(p.x - w / 2),
                Math.round(p.y),
                w,
                h,
                r,
                hero ? '#ffcf5a' : '#7fb0ff',
                hero ? '#fff2c0' : null,
                hero ? '#e6b85c' : null
            );
            if (hero) {
                g.font = '800 11px Cinzel, "Noto Sans KR", serif';
                g.textAlign = 'right';
                g.textBaseline = 'middle';
                g.lineWidth = 3;
                g.strokeStyle = 'rgba(12,6,18,0.9)';
                g.strokeText(String(u.level), p.x - w / 2 - 4, p.y + 2);
                g.fillStyle = '#ffe3a3';
                g.fillText(String(u.level), p.x - w / 2 - 4, p.y + 2);
            }
            if (hero && ui.heroSelected) {
                const f = this.project(_v.set(u.x, world.heightAt(u.x, u.z) + 0.03, u.z));
                const rr = 22 + Math.sin((this.time || 0) * 6) * 2;
                g.strokeStyle = '#ffe3a3';
                g.lineWidth = 2;
                g.beginPath();
                g.ellipse(f.x, f.y, rr, rr * 0.45, 0, 0, Math.PI * 2);
                g.stroke();
            }
        }
        // 성문 체력: 늘 보인다 (무너지면 표시만)
        const now = state.time;
        const fortress = world.fortress;
        for (const gt of state.gates || []) {
            const top = fortress?.gateTop(gt.id, _v);
            if (!top) continue;
            const p = this.project(top);
            if (p.behind) continue;
            const x = Math.round(p.x - 30);
            const y = Math.round(p.y);
            if (gt.broken) {
                g.font = '800 11px "Noto Sans KR", sans-serif';
                g.textAlign = 'center';
                g.textBaseline = 'middle';
                g.lineWidth = 3;
                g.strokeStyle = 'rgba(12,6,18,0.9)';
                g.strokeText(gt.name + ' 붕괴', p.x, y + 2);
                g.fillStyle = '#ff8a7a';
                g.fillText(gt.name + ' 붕괴', p.x, y + 2);
                continue;
            }
            const r = Math.max(0, gt.hp / gt.maxHp);
            const recent = gt.hitT != null && now - gt.hitT < 0.15;
            bar(
                x,
                y,
                60,
                6,
                r,
                r > 0.5 ? '#ffd98a' : r > 0.25 ? '#ffb24a' : '#ff5f5a',
                r > 0.5 ? '#fff2c0' : null,
                recent ? '#ffffff' : gt.level ? '#ffd66e' : 'rgba(230,184,92,0.7)'
            );
        }
        // 타워 체력(공성전)과 기절
        for (const t of state.towers || []) {
            const stunned = t.stunT > 0;
            const showHp = t.hp != null && (t.hp < t.maxHp || (t.hitT != null && now - t.hitT < 2));
            if (!stunned && !showHp) continue;
            const top = this.entities.towerTop(t.id, _v);
            if (!top) continue;
            top.y += 0.35;
            const p = this.project(top);
            if (p.behind) continue;
            if (showHp) {
                const r = Math.max(0, t.hp / t.maxHp);
                const recent = t.hitT != null && now - t.hitT < 0.15;
                const bw = t.type === 'wall' ? 26 : 44;
                bar(
                    Math.round(p.x - bw / 2),
                    Math.round(p.y),
                    bw,
                    5,
                    r,
                    r > 0.5 ? '#c9d6ea' : r > 0.25 ? '#ffb24a' : '#ff5f5a',
                    null,
                    recent ? '#ffffff' : 'rgba(230,184,92,0.6)'
                );
            }
            if (stunned) {
                const tt = this.time || 0;
                for (let i = 0; i < 3; i++) {
                    const a = tt * 4 + (i / 3) * Math.PI * 2;
                    g.fillStyle = '#ffe36a';
                    g.beginPath();
                    g.arc(p.x + Math.cos(a) * 14, p.y - 12 + Math.sin(a) * 5, 2.6, 0, Math.PI * 2);
                    g.fill();
                }
            }
        }
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
        this.drawField(g, state);
        // 체력바: 맞았거나 정예·보스이거나 마우스를 올린 적만
        for (const e of state.enemies) {
            if (e.burrowT > 0 || e.fogged) continue;
            const hurt = e.hp < e.maxHp || e.shield > 0;
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
            if (e.shield > 0) {
                g.fillStyle = 'rgba(200,240,255,0.9)';
                g.fillRect(x, y - 3, w * Math.min(1, e.shield / e.maxHp / 0.3), 2);
            }
            if (e.enraged) {
                g.fillStyle = '#ff6a3a';
                g.fillRect(x - 4, y, 2, h);
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
