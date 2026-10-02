// 랜덤 타워 디펜스 3D 표시: 칸마다 등급 빛(칸 바닥 테두리), 합성 가능한 칸의 맥동, 소환·합성·이동 연출.
// 연출은 바닥 근처의 짧은 번쩍임·고리·불씨만 쓴다(하늘로 솟는 빛기둥 없음).
import * as THREE from 'three';
import { GRADES } from '../core/data/randomtd.js';
import { canMerge } from '../core/randomtd.js';

const HDR = (hex, k) => {
    const c = new THREE.Color(hex);
    return [c.r * k, c.g * k, c.b * k];
};
const rnd = (a, b) => a + Math.random() * (b - a);

/** 칸 바닥 등급 빛: 가장자리가 밝고 가운데가 빈 사각 (캔버스 텍스처 하나를 모두 쓴다) */
let tileTex = null;
function tileTexture() {
    if (tileTex) return tileTex;
    const N = 128;
    const c = document.createElement('canvas');
    c.width = c.height = N;
    const g = c.getContext('2d');
    const img = g.createImageData(N, N);
    for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
            const u = Math.abs(x / (N - 1) - 0.5) * 2;
            const v = Math.abs(y / (N - 1) - 0.5) * 2;
            const e = Math.max(u, v);
            const edge = Math.pow(Math.max(0, (e - 0.55) / 0.45), 2.2) * (1 - Math.max(0, (e - 0.97) / 0.03));
            const a = Math.min(1, edge * 1.1 + 0.08 * (1 - e));
            const i = (y * N + x) * 4;
            img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
            img.data[i + 3] = Math.round(a * 255);
        }
    }
    g.putImageData(img, 0, 0);
    tileTex = new THREE.CanvasTexture(c);
    tileTex.colorSpace = THREE.SRGBColorSpace;
    return tileTex;
}

export class RtdView {
    constructor(scene, world, effects, entities) {
        this.scene = scene;
        this.world = world;
        this.fx = effects;
        this.entities = entities;
        this.group = new THREE.Group();
        this.group.name = 'rtd';
        scene.add(this.group);
        this.geo = new THREE.PlaneGeometry(1.52, 1.52);
        this.geo.rotateX(-Math.PI / 2);
        this.tiles = new Map();
        this.cols = GRADES.map((g) => new THREE.Color(g.color));
    }

    reset() {
        for (const v of this.tiles.values()) {
            v.mesh.removeFromParent();
            v.mesh.material.dispose();
        }
        this.tiles.clear();
    }

    /** 칸 바닥의 등급 빛을 타워 목록에 맞춘다 */
    sync(state, t) {
        const seen = new Set();
        for (const tw of state.towers) {
            if (tw.grade == null) continue;
            seen.add(tw.socketId);
            let v = this.tiles.get(tw.socketId);
            if (!v) {
                const mat = new THREE.MeshBasicMaterial({
                    map: tileTexture(),
                    transparent: true,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false,
                    toneMapped: false
                });
                const mesh = new THREE.Mesh(this.geo, mat);
                const s = state.sockets[tw.socketId];
                mesh.position.set(s.x, this.world.sockets.topY(s.id) + 0.015, s.z);
                mesh.renderOrder = 3;
                this.group.add(mesh);
                v = { mesh, mat };
                this.tiles.set(tw.socketId, v);
            }
            const ready = canMerge(state, tw) && tw.count >= 2;
            const high = tw.grade >= 3;
            const pulse = ready || high ? 0.75 + 0.25 * Math.sin(t * (ready ? 6 : 2.4) + tw.socketId) : 1;
            const k = [0.55, 1.0, 1.25, 1.7, 2.1][tw.grade] * pulse * (ready ? 1.5 : 1);
            v.mat.color.copy(this.cols[tw.grade]).multiplyScalar(k);
        }
        for (const [id, v] of this.tiles) {
            if (seen.has(id)) continue;
            v.mesh.removeFromParent();
            v.mat.dispose();
            this.tiles.delete(id);
        }
    }

    // ---------- 연출 ----------
    handle(events) {
        for (const ev of events) {
            if (ev.type === 'rtdSummon') this.summon(ev);
            else if (ev.type === 'rtdMerge') this.merge(ev);
            else if (ev.type === 'rtdMove') this.move(ev);
            else if (ev.type === 'rtdBossDown') this.bossDown();
        }
    }

    ground(x, z, lift = 0) {
        return new THREE.Vector3(x, this.world.heightAt(x, z) + 0.08 + lift, z);
    }

    summon(ev) {
        const fx = this.fx;
        const g = ev.grade;
        const col = HDR(GRADES[g].color, 2.5 + g);
        const p = this.ground(ev.x, ev.z, 0.05);
        fx.ring(p, 1.0 + 0.25 * g, col, 0.5 + 0.1 * g, 1.2);
        if (g >= 1) fx.ring(p, 0.6, HDR('#ffffff', 2), 0.35);
        // 칸 가장자리에서 안쪽으로 모였다가 짧게 튀어 오르는 불씨 (높이 2 아래)
        const n = Math.round((16 + 14 * g) * fx.q);
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2;
            const r = rnd(0.5, 0.85);
            fx.add.emit({
                x: p.x + Math.cos(a) * r,
                y: p.y + rnd(0, 0.15),
                z: p.z + Math.sin(a) * r,
                vx: -Math.cos(a) * r * 1.6,
                vy: rnd(0.8, 2.2 + 0.4 * g),
                vz: -Math.sin(a) * r * 1.6,
                life: rnd(0.45, 0.8),
                size: rnd(0.07, 0.14 + 0.03 * g),
                color: col,
                drag: 2.4,
                grav: 2.5
            });
        }
        fx.flash(p, GRADES[g].color, 6 + 5 * g, 0.3 + 0.08 * g, 4 + g);
    }

    merge(ev) {
        const fx = this.fx;
        const g = ev.grade;
        const col = HDR(GRADES[g].color, 3 + g * 0.6);
        const to = this.ground(ev.x, ev.z, 0.3);
        // 재료 칸에서 결과 칸으로 빛 알갱이가 땅 위를 흐른다
        for (const part of ev.parts || []) {
            const from = this.ground(part.x, part.z, 0.25);
            const n = Math.round(22 * fx.q);
            const T = 0.38;
            for (let i = 0; i < n; i++) {
                const j = (Math.random() - 0.5) * 0.5;
                fx.add.emit({
                    x: from.x + j,
                    y: from.y + rnd(0, 0.4),
                    z: from.z + (Math.random() - 0.5) * 0.5,
                    vx: (to.x - from.x) / T,
                    vy: rnd(-0.2, 0.6),
                    vz: (to.z - from.z) / T,
                    life: T,
                    size: rnd(0.08, 0.15),
                    color: HDR(GRADES[Math.max(0, g - 1)].color, 3),
                    drag: 0
                });
            }
        }
        fx.later(0.36, () => {
            fx.ring(to, 1.4 + 0.3 * g, col, 0.7, 1.4);
            fx.ring(to, 0.8, HDR('#ffffff', 2.4), 0.4);
            fx.burst(fx.add, to, 40 + 20 * g, {
                color: col,
                size: 0.16,
                speed: 2.4 + 0.4 * g,
                upMin: 0.3,
                upMax: 1.2,
                life: 0.7,
                grav: 3,
                spread: 0.4
            });
            fx.flash(to, GRADES[g].color, 10 + 6 * g, 0.45, 6);
            if (ev.myth) {
                // 신화: 땅을 훑는 큰 충격파와 흔들림
                fx.ring(to, 4.2, col, 1.1, 1.8);
                fx.ring(to, 2.6, HDR('#ffe6c0', 3), 0.8, 1.2);
                fx.burst(fx.add, to, 90, {
                    color: col,
                    size: 0.2,
                    speed: 5,
                    upMin: 0.1,
                    upMax: 0.6,
                    life: 0.9,
                    grav: 2,
                    spread: 0.6
                });
                fx.rig.shake(0.35);
            } else if (g >= 3) fx.rig.shake(0.18);
        });
    }

    move(ev) {
        const fx = this.fx;
        const col = HDR(GRADES[ev.grade ?? 0].color, 2.4);
        fx.ring(this.ground(ev.fx, ev.fz, 0.05), 0.8, col, 0.35);
        fx.ring(this.ground(ev.x, ev.z, 0.05), 1.0, col, 0.45);
    }

    bossDown() {
        const p = this.world.portal.group.position;
        this.fx.ring(this.ground(p.x, p.z, 0.05), 2.4, HDR('#c070ff', 3), 0.8, 1.4);
    }

    update(t, state) {
        if (!state.rtd) {
            if (this.tiles.size) this.reset();
            return;
        }
        this.sync(state, t);
    }
}
