// 이벤트 → 이펙트 연출. 파티클·번개·충격파·지면 데칼·동적 광원·유성·빙결.
import * as THREE from 'three';
import { ParticleSystem } from './Particles.js';
import { Ribbons } from './Ribbons.js';
import { disposeObject } from '../dispose.js';
import { glowSprite, puffSprite } from '../util/textures.js';
import { TOWERS } from '../../core/data/towers.js';
import { ENEMIES } from '../../core/data/enemies.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const HDR = (hex, k) => {
    const c = new THREE.Color(hex);
    return [c.r * k, c.g * k, c.b * k];
};

const COL = {
    gold: HDR('#ffc45a', 4),
    goldSoft: HDR('#ffd98a', 2.2),
    fire: HDR('#ff7a26', 5),
    fireHot: HDR('#ffd27a', 6),
    ember: HDR('#ff5a1a', 4),
    ice: HDR('#8fe3ff', 3.2),
    iceWhite: HDR('#e8fbff', 3),
    storm: HDR('#b58cff', 4.5),
    void: HDR('#d04aff', 4),
    voidDark: HDR('#7a2aff', 2.5),
    heal: HDR('#6dff9a', 3.5),
    blood: HDR('#ff3d4a', 4),
    firefly: HDR('#ffe08a', 3.2),
    arcane: HDR('#ff6ad8', 4.5),
    mint: HDR('#7dffb0', 3.5)
};

let ringTex = null;
function ringTexture() {
    if (ringTex) return ringTex;
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(128, 128, 60, 128, 128, 128);
    grd.addColorStop(0, 'rgba(255,255,255,0)');
    grd.addColorStop(0.72, 'rgba(255,255,255,0.15)');
    grd.addColorStop(0.9, 'rgba(255,255,255,1)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 256, 256);
    ringTex = new THREE.CanvasTexture(c);
    return ringTex;
}

let scorchTex = null;
function scorchTexture() {
    if (scorchTex) return scorchTex;
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    for (let i = 0; i < 14; i++) {
        const x = 64 + (Math.random() - 0.5) * 34;
        const y = 64 + (Math.random() - 0.5) * 34;
        const r = 20 + Math.random() * 30;
        const grd = g.createRadialGradient(x, y, 0, x, y, r);
        grd.addColorStop(0, 'rgba(20,12,8,0.5)');
        grd.addColorStop(1, 'rgba(20,12,8,0)');
        g.fillStyle = grd;
        g.fillRect(0, 0, 128, 128);
    }
    scorchTex = new THREE.CanvasTexture(c);
    return scorchTex;
}

/** 장면에서 빼고 메시 전용 geometry·재질 해제 (텍스처는 공용 캐시라 둔다) */
function drop(...objs) {
    for (const o of objs) {
        o.removeFromParent();
        disposeObject(o);
    }
}

export class Effects {
    constructor(scene, camera, rig, entities, world, quality) {
        this.scene = scene;
        this.camera = camera;
        this.rig = rig;
        this.entities = entities;
        this.world = world;
        const q = quality.particles;
        this.q = q;
        this.add = new ParticleSystem(Math.round(5000 * q), glowSprite(), { additive: true });
        this.smoke = new ParticleSystem(Math.round(1800 * q), puffSprite(3), { additive: false });
        scene.add(this.add.points, this.smoke.points);
        this.ribbons = new Ribbons(scene, camera);
        this.rings = [];
        this.decals = [];
        this.meteors = [];
        this.shells = new Map();
        this.auraRings = new Map();
        this.lights = Array.from({ length: 5 }, () => {
            const l = new THREE.PointLight(0xffffff, 0, 6, 1.8);
            scene.add(l);
            return { light: l, life: 0, max: 1, power: 0 };
        });
        this.ambientT = 0;
        this.v = new THREE.Vector3();
        this.v2 = new THREE.Vector3();
    }

    reset() {
        this.releaseBeams(true);
        this.queue = [];
        this.add.count = 0;
        this.smoke.count = 0;
        for (const r of this.rings) r.mesh.visible = false;
        for (const d of this.decals) drop(d.mesh);
        this.decals = [];
        for (const m of this.meteors) drop(m.rock, m.warn);
        this.meteors = [];
        for (const s of this.shells.values()) drop(s);
        this.shells.clear();
        for (const r of this.auraRings.values()) drop(r);
        this.auraRings.clear();
        for (const l of this.lights) l.life = 0;
    }

    resize(h) {
        this.add.setScale(h, this.camera.fov);
        this.smoke.setScale(h, this.camera.fov);
    }

    // ---------- 기본 부품 ----------
    burst(sys, p, n, o) {
        n = Math.max(1, Math.round(n * this.q));
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2;
            const up = rnd(o.upMin ?? 0.2, o.upMax ?? 1);
            const sp = rnd(o.speedMin ?? 0.3, o.speed ?? 2);
            sys.emit({
                x: p.x + (Math.random() - 0.5) * (o.spread ?? 0.1),
                y: p.y + (Math.random() - 0.5) * (o.spreadY ?? 0.05),
                z: p.z + (Math.random() - 0.5) * (o.spread ?? 0.1),
                vx: Math.cos(a) * sp,
                vy: up * sp * (o.lift ?? 1),
                vz: Math.sin(a) * sp,
                life: rnd(o.lifeMin ?? (o.life ?? 0.6) * 0.6, o.life ?? 0.6),
                size: rnd((o.size ?? 0.3) * 0.6, o.size ?? 0.3),
                size1: o.size1,
                color: o.color,
                alpha: o.alpha ?? 1,
                grav: o.grav ?? 0,
                drag: o.drag ?? 2,
                spinV: o.spinV ?? 0,
                fadeIn: o.fadeIn
            });
        }
    }

    ring(p, radius, color, life = 0.45, width = 1, y = 0.06) {
        let r = this.rings.find((x) => !x.mesh.visible);
        if (!r) {
            const mesh = new THREE.Mesh(
                new THREE.PlaneGeometry(2, 2),
                new THREE.MeshBasicMaterial({
                    map: ringTexture(),
                    transparent: true,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false,
                    toneMapped: false
                })
            );
            mesh.rotation.x = -Math.PI / 2;
            mesh.renderOrder = 18;
            this.scene.add(mesh);
            r = { mesh };
            this.rings.push(r);
        }
        r.mesh.visible = true;
        r.mesh.position.set(p.x, this.world.heightAt(p.x, p.z) + y, p.z);
        r.color = new THREE.Color(color[0], color[1], color[2]);
        r.radius = radius;
        r.life = r.max = life;
        r.width = width;
    }

    decal(p, radius, kind, life) {
        const mat =
            kind === 'scorch'
                ? new THREE.MeshBasicMaterial({ map: scorchTexture(), transparent: true, depthWrite: false })
                : new THREE.MeshBasicMaterial({
                      map: glowSprite(),
                      transparent: true,
                      blending: THREE.AdditiveBlending,
                      depthWrite: false,
                      toneMapped: false
                  });
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2), mat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.rotation.z = Math.random() * 6;
        mesh.position.set(p.x, this.world.heightAt(p.x, p.z) + 0.03 + this.decals.length * 0.0005, p.z);
        mesh.renderOrder = 17;
        this.scene.add(mesh);
        const color =
            kind === 'fire'
                ? new THREE.Color('#ff6a20').multiplyScalar(2.5)
                : kind === 'frost'
                  ? new THREE.Color('#6fd4ff').multiplyScalar(2)
                  : null;
        if (color) mat.color.copy(color);
        this.decals.push({ mesh, life, max: life, color });
    }

    flash(p, color, power, life = 0.2, distance = 6) {
        const slot = this.lights.reduce((a, b) => (a.life < b.life ? a : b));
        slot.light.position.set(p.x, p.y + 0.6, p.z);
        slot.light.color.set(color);
        slot.light.distance = distance;
        slot.power = power;
        slot.life = slot.max = life;
    }

    groundPoint(x, z, lift = 0) {
        return new THREE.Vector3(x, this.world.heightAt(x, z) + lift, z);
    }

    enemyPoint(state, id, x, z) {
        const e = state.enemies.find((o) => o.id === id);
        if (e) return this.entities.enemyCenter(e, new THREE.Vector3());
        return this.groundPoint(x, z, 0.6);
    }

    // ---------- 이벤트 ----------
    handle(events, state) {
        for (const ev of events) {
            const fn = this['on_' + ev.type];
            if (fn) fn.call(this, ev, state);
        }
    }

    on_build(ev) {
        const p = this.groundPoint(ev.x, ev.z, 0.1);
        this.burst(this.smoke, p, 18, {
            color: [0.75, 0.66, 0.55],
            size: 0.7,
            size1: 1.2,
            speed: 1.8,
            upMax: 0.4,
            life: 0.9,
            alpha: 0.55,
            drag: 3
        });
        this.burst(this.add, p, 26, {
            color: COL.gold,
            size: 0.12,
            speed: 1.4,
            upMin: 0.8,
            upMax: 2.5,
            life: 1.1,
            grav: 1.2,
            spread: 0.8
        });
        this.ring(p, 1.4, COL.gold, 0.55);
        this.flash(p, 0xffc46a, 8, 0.3);
    }

    on_upgrade(ev) {
        const p = this.groundPoint(ev.x, ev.z, 0.2);
        for (let i = 0; i < Math.round(40 * this.q); i++) {
            const a = Math.random() * Math.PI * 2;
            const r = rnd(0.2, 0.55);
            this.add.emit({
                x: p.x + Math.cos(a) * r,
                y: p.y + rnd(0, 0.4),
                z: p.z + Math.sin(a) * r,
                vy: rnd(1.5, 4),
                life: rnd(0.6, 1.2),
                size: rnd(0.08, 0.18),
                color: ev.branch ? COL.fireHot : COL.gold,
                drag: 0.5
            });
        }
        this.ring(p, 1.6, COL.gold, 0.7, 1.2);
        this.ring(p, 0.9, COL.goldSoft, 0.5);
        this.flash(p, 0xffd27a, 14, 0.45, 7);
    }

    on_sell(ev) {
        const p = this.groundPoint(ev.x, ev.z, 0.3);
        this.burst(this.smoke, p, 20, {
            color: [0.6, 0.55, 0.5],
            size: 0.8,
            size1: 1.4,
            speed: 1.6,
            life: 1,
            alpha: 0.6
        });
        this.burst(this.add, p, 18, { color: COL.gold, size: 0.12, speed: 2, upMin: 1, upMax: 2, life: 0.9, grav: 4 });
    }

    on_fire(ev) {
        const m = this.entities.muzzleOf(ev.towerId, this.v);
        if (!m) return;
        if (ev.tower === 'ranger') {
            this.burst(this.add, m, 4, { color: COL.goldSoft, size: 0.08, speed: 1, life: 0.2 });
        } else if (ev.tower === 'ember') {
            this.burst(this.add, m, 14, {
                color: COL.fire,
                size: 0.28,
                size1: 0.05,
                speed: 2.2,
                upMin: 0.5,
                upMax: 1.5,
                life: 0.35
            });
            this.burst(this.smoke, m, 8, {
                color: [0.35, 0.3, 0.28],
                size: 0.45,
                size1: 1.1,
                speed: 0.8,
                upMin: 1,
                upMax: 2,
                life: 1.1,
                alpha: 0.5,
                drag: 1.5
            });
            this.flash(m, 0xff8a3a, 6, 0.12, 4);
            this.rig.shake(0.04);
        } else if (ev.tower === 'frost') {
            this.burst(this.add, m, 6, { color: COL.ice, size: 0.1, speed: 1, life: 0.35 });
        } else if (ev.tower === 'storm') {
            this.burst(this.add, m, 10, { color: COL.storm, size: 0.14, speed: 1.6, life: 0.3 });
        } else if (ev.tower === 'arcane') {
            this.burst(this.add, m, 12, { color: COL.arcane, size: 0.12, speed: 1.4, life: 0.35 });
            this.flash(m, 0xff6ad8, 5, 0.15, 4);
        }
    }

    /** 광산 수입: 초록 수정 조각과 금화가 솟는다 */
    on_income(ev) {
        const p = this.groundPoint(ev.x, ev.z, 1.1);
        this.burst(this.add, p, Math.round(24 * this.q), {
            color: COL.gold,
            size: 0.12,
            speed: 1.2,
            upMin: 2,
            upMax: 3.5,
            life: 1,
            grav: 4
        });
        this.burst(this.add, p, Math.round(14 * this.q), { color: COL.mint, size: 0.1, speed: 1.8, life: 0.7 });
        this.ring(this.groundPoint(ev.x, ev.z, 0.2), 1.1, COL.mint, 0.5);
    }

    /** 비전 광선: 타워의 beams를 매 프레임 리본으로 그린다. 오래 비출수록 굵고 하얗게 */
    updateBeams(state, t) {
        this.beams ??= new Map();
        const used = new Set();
        for (const tower of state.towers) {
            if (!tower.beams || !tower.beams.length) continue;
            const m = this.entities.muzzleOf(tower.id, new THREE.Vector3());
            if (!m) continue;
            tower.beams.forEach((b, i) => {
                const key = tower.id + ':' + i;
                let it = this.beams.get(key);
                if (!it) {
                    it = { outer: this.ribbons.get(), inner: this.ribbons.get() };
                    this.beams.set(key, it);
                }
                used.add(key);
                const end = this.enemyPoint(state, b.id, b.x, b.z);
                const pts = [];
                for (let j = 0; j <= 12; j++) {
                    const p = new THREE.Vector3().lerpVectors(m, end, j / 12);
                    const w = Math.sin((j / 12) * Math.PI) * 0.05;
                    p.x += Math.sin(t * 30 + j * 1.7 + i) * w;
                    p.y += Math.cos(t * 26 + j * 2.1) * w;
                    pts.push(p);
                }
                const width = 0.05 + 0.11 * b.k + Math.sin(t * 40) * 0.008;
                it.outer.set(pts, width, this.ribbons.camera);
                it.inner.set(pts, width * 0.32, this.ribbons.camera);
                it.outer.mat.color.setRGB(4.5, 1.2 + b.k * 1.5, 3.8).multiplyScalar(0.8 + b.k * 0.6);
                it.inner.mat.color.setRGB(6, 5, 6);
                if (Math.random() < 0.5 * this.q) {
                    this.add.emit({
                        x: end.x,
                        y: end.y,
                        z: end.z,
                        vx: (Math.random() - 0.5) * 2,
                        vy: Math.random() * 1.5,
                        vz: (Math.random() - 0.5) * 2,
                        life: 0.3,
                        size: 0.08 + b.k * 0.1,
                        size1: 0.01,
                        color: COL.arcane,
                        drag: 1
                    });
                }
            });
        }
        this.releaseBeams(false, used);
    }

    releaseBeams(all, used = null) {
        if (!this.beams) return;
        for (const [key, it] of this.beams) {
            if (!all && used.has(key)) continue;
            for (const r of [it.outer, it.inner]) {
                r.active = false;
                r.mesh.visible = false;
            }
            this.beams.delete(key);
        }
    }

    on_chain(ev, state) {
        const start = this.entities.muzzleOf(ev.towerId, new THREE.Vector3()) || this.groundPoint(ev.x, ev.z, 1.5);
        const pts = [start, ...ev.points.map((p) => this.enemyPoint(state, p.id, p.x, p.z))];
        const big = ev.branch === 'b';
        this.ribbons.bolt(pts, big ? '#e6d4ff' : '#a47cff', big ? 0.28 : 0.2, big ? 0.22 : 0.13);
        if (ev.branch === 'a' || big) this.ribbons.bolt(pts, '#c9b0ff', 0.16, 0.07);
        for (const p of pts.slice(1)) {
            this.burst(this.add, p, 8, { color: COL.storm, size: 0.16, speed: 2.5, life: 0.3 });
        }
        this.flash(pts[1] || start, 0xa47cff, big ? 12 : 6, 0.15, 5);
        if (big) {
            this.ring(pts[1], 1.2, COL.storm, 0.35);
            this.rig.shake(0.06);
        }
    }

    on_hit(ev, state) {
        const p = this.groundPoint(ev.x, ev.z, 0.6);
        if (ev.kind === 'arrow') {
            this.burst(this.add, p, 5, { color: COL.goldSoft, size: 0.07, speed: 1.6, life: 0.25 });
        } else if (ev.kind === 'lance') {
            this.burst(this.add, p, ev.shattered ? 34 : 18, {
                color: COL.iceWhite,
                size: 0.16,
                speed: ev.shattered ? 4 : 2.5,
                life: 0.6,
                grav: 4
            });
            this.ring(p, ev.shattered ? 1.6 : 1, COL.ice, 0.4);
            this.flash(p, 0x8fe3ff, ev.shattered ? 10 : 5, 0.2);
            if (ev.shattered) this.rig.shake(0.06);
        }
        void state;
    }

    on_frostHit(ev) {
        const p = this.groundPoint(ev.x, ev.z, 0.35);
        this.burst(this.add, p, 16, { color: COL.ice, size: 0.13, speed: 2.2, life: 0.5, grav: 2 });
        this.burst(this.smoke, p, 4, {
            color: [0.75, 0.9, 1],
            size: 0.4,
            size1: 0.8,
            speed: 1,
            upMax: 0.3,
            life: 0.7,
            alpha: 0.18
        });
        this.ring(p, ev.r, COL.ice, 0.45);
    }

    on_explode(ev) {
        const p = this.groundPoint(ev.x, ev.z, 0.2);
        const big = ev.branch === 'b';
        const s = big ? 1.5 : 1;
        this.burst(this.add, p, 26 * s, {
            color: COL.fireHot,
            size: 0.5 * s,
            size1: 0.1,
            speed: 3.2 * s,
            upMin: 0.3,
            upMax: 1.2,
            life: 0.45
        });
        this.burst(this.add, p, 18 * s, {
            color: COL.ember,
            size: 0.1,
            speed: 5 * s,
            upMin: 0.8,
            upMax: 2,
            life: 1,
            grav: 6,
            drag: 0.6
        });
        this.burst(this.smoke, p, 12 * s, {
            color: [0.28, 0.23, 0.22],
            size: 0.8 * s,
            size1: 1.8 * s,
            speed: 1.4,
            upMin: 0.6,
            upMax: 1.6,
            life: 1.6,
            alpha: 0.55,
            drag: 1.2
        });
        this.ring(p, ev.r * 1.3, COL.fire, 0.4, 1);
        this.decal(p, ev.r * 0.9, 'scorch', 5);
        this.flash(p, 0xff7a2a, big ? 22 : 12, 0.3, big ? 8 : 6);
        this.rig.shake(big ? 0.18 : 0.08);
    }

    on_death(ev, state) {
        const p = this.groundPoint(ev.x, ev.z, 0.5);
        const boss = !!ENEMIES[ev.enemy]?.boss;
        const s = boss ? 3 : ev.elite ? 1.6 : 1;
        this.burst(this.add, p, 16 * s, { color: COL.void, size: 0.2 * s, speed: 2 * s, life: 0.6, grav: -0.5 });
        this.burst(this.smoke, p, 10 * s, {
            color: [0.12, 0.08, 0.16],
            size: 0.6 * s,
            size1: 1.3 * s,
            speed: 1,
            upMin: 0.5,
            upMax: 1.2,
            life: 1.2,
            alpha: 0.6
        });
        this.burst(this.add, p, 5, {
            color: COL.gold,
            size: 0.1,
            speed: 1.2,
            upMin: 1.5,
            upMax: 2.5,
            life: 0.8,
            grav: 5
        });
        // 영혼이 위로 빠져나간다
        this.add.emit({
            x: p.x,
            y: p.y + 0.3,
            z: p.z,
            vy: 1.2,
            life: 1.2,
            size: 0.45 * s,
            size1: 0.1,
            color: COL.voidDark,
            drag: 0.2,
            fadeIn: 0.2
        });
        if (boss) {
            this.ring(p, 5, COL.void, 1.1, 1.5);
            this.flash(p, 0xd04aff, 40, 1, 12);
            this.rig.shake(0.6);
        } else if (ev.elite) {
            this.ring(p, 2, COL.void, 0.6);
            this.rig.shake(0.12);
        }
        void state;
    }

    on_spawn(ev) {
        const p = this.groundPoint(ev.x, ev.z, 0.5);
        this.burst(this.add, p, 10, { color: COL.void, size: 0.25, speed: 1.5, life: 0.5 });
    }

    on_leak() {
        const c = this.world.core.top;
        this.burst(this.add, c, 40, { color: COL.blood, size: 0.3, speed: 4, life: 0.7, grav: 2 });
        this.ring(new THREE.Vector3(c.x, 0, c.z), 3, COL.blood, 0.6, 1.3);
        this.flash(c, 0xff3040, 25, 0.5, 9);
        this.rig.shake(0.25);
    }

    on_heal(ev) {
        const p = this.groundPoint(ev.x, ev.z, 0.1);
        this.ring(p, ev.r, COL.heal, 0.6, 0.8);
        for (let i = 0; i < Math.round(18 * this.q); i++) {
            const a = Math.random() * Math.PI * 2;
            const r = Math.random() * ev.r;
            this.add.emit({
                x: p.x + Math.cos(a) * r,
                y: p.y,
                z: p.z + Math.sin(a) * r,
                vy: rnd(0.8, 1.8),
                life: rnd(0.6, 1),
                size: 0.12,
                color: COL.heal,
                drag: 0.5
            });
        }
    }

    on_meteorCast(ev) {
        const target = this.groundPoint(ev.x, ev.z, 0);
        const from = new THREE.Vector3(target.x - 9, target.y + 22, target.z + 3);
        const rock = new THREE.Mesh(
            new THREE.DodecahedronGeometry(0.55, 0),
            new THREE.MeshStandardMaterial({
                color: 0x2a1a12,
                emissive: 0xff5a10,
                emissiveIntensity: 3,
                flatShading: true
            })
        );
        this.scene.add(rock);
        const warn = this.decalLive(target, ev.r, '#ff5a20');
        this.meteors.push({ rock, from, target, t: 0, T: ev.delay, warn });
    }

    decalLive(p, radius, color) {
        const mesh = new THREE.Mesh(
            new THREE.PlaneGeometry(radius * 2, radius * 2),
            new THREE.MeshBasicMaterial({
                map: ringTexture(),
                color: new THREE.Color(color).multiplyScalar(3),
                transparent: true,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                toneMapped: false
            })
        );
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(p.x, p.y + 0.05, p.z);
        this.scene.add(mesh);
        return mesh;
    }

    on_meteorImpact(ev) {
        const p = this.groundPoint(ev.x, ev.z, 0.2);
        this.burst(this.add, p, 90, {
            color: COL.fireHot,
            size: 1.1,
            size1: 0.2,
            speed: 6,
            upMin: 0.2,
            upMax: 1.4,
            life: 0.6,
            spread: 0.6
        });
        this.burst(this.add, p, 60, {
            color: COL.ember,
            size: 0.14,
            speed: 9,
            upMin: 0.8,
            upMax: 2.2,
            life: 1.4,
            grav: 7,
            drag: 0.4
        });
        this.burst(this.smoke, p, 34, {
            color: [0.2, 0.15, 0.14],
            size: 1.4,
            size1: 3.2,
            speed: 2.5,
            upMin: 0.4,
            upMax: 1.5,
            life: 2.4,
            alpha: 0.65,
            drag: 1
        });
        this.ring(p, ev.r * 2.2, COL.fire, 0.7, 1.4);
        this.ring(p, ev.r * 1.2, COL.fireHot, 0.4, 1);
        this.decal(p, ev.r * 1.3, 'scorch', 9);
        this.decal(p, ev.r * 1.1, 'fire', 2.5);
        this.flash(p, 0xff8a3a, 60, 0.8, 14);
        this.rig.shake(0.55);
    }

    on_freeze(ev, state) {
        const c = this.world.core.top;
        this.ring(new THREE.Vector3(c.x, 0, c.z), 30, COL.ice, 1.1, 2);
        this.ring(new THREE.Vector3(c.x, 0, c.z), 18, COL.iceWhite, 0.8, 1.5);
        for (const e of state.enemies) {
            const p = this.entities.enemyCenter(e, new THREE.Vector3());
            this.burst(this.add, p, 10, { color: COL.iceWhite, size: 0.14, speed: 1.8, life: 0.6, grav: 2 });
        }
        this.flash(c, 0x8fe3ff, 30, 0.8, 30);
        void ev;
    }

    on_waveStart(ev) {
        if (ev.boss) {
            this.flash(this.world.portal.group.position, 0xd04aff, 40, 2, 14);
            this.rig.shake(0.35);
        }
    }

    // ---------- 병영·영웅 ----------
    on_unitSpawn(ev) {
        const p = this.groundPoint(ev.x, ev.z, 0.3);
        const hero = ev.kind === 'hero';
        this.burst(this.add, p, hero ? 30 : 10, {
            color: hero ? COL.gold : COL.ice,
            size: hero ? 0.16 : 0.1,
            speed: 1.4,
            upMin: 1,
            upMax: 2.5,
            life: 0.7,
            spread: 0.4
        });
        if (hero) {
            this.ring(p, 1.4, COL.gold, 0.6);
            this.flash(p, 0xffd27a, 10, 0.4);
        }
    }

    on_unitDeath(ev) {
        const p = this.groundPoint(ev.x, ev.z, 0.4);
        this.burst(this.smoke, p, 8, {
            color: [0.5, 0.5, 0.55],
            size: 0.4,
            size1: 0.8,
            speed: 0.8,
            life: 0.8,
            alpha: 0.5
        });
        this.burst(this.add, p, ev.kind === 'hero' ? 24 : 8, { color: COL.goldSoft, size: 0.1, speed: 1.6, life: 0.5 });
    }

    on_unitHit(ev) {
        const p = this.groundPoint(ev.x, ev.z, 0.55);
        const hero = ev.kind === 'hero';
        this.burst(this.add, p, hero ? 8 : 4, {
            color: hero ? COL.gold : COL.iceWhite,
            size: hero ? 0.12 : 0.08,
            speed: 2.2,
            life: 0.22
        });
        if (ev.cleave) this.ring(this.groundPoint(ev.x, ev.z, 0), 0.9, hero ? COL.goldSoft : COL.blood, 0.25, 0.6);
    }

    on_heroLevel(ev) {
        const p = this.groundPoint(ev.x, ev.z, 0.2);
        for (let i = 0; i < Math.round(50 * this.q); i++) {
            const a = Math.random() * Math.PI * 2;
            this.add.emit({
                x: p.x + Math.cos(a) * 0.4,
                y: p.y + rnd(0, 0.3),
                z: p.z + Math.sin(a) * 0.4,
                vy: rnd(2, 4.5),
                life: rnd(0.7, 1.3),
                size: rnd(0.08, 0.18),
                color: COL.gold,
                drag: 0.6
            });
        }
        this.ring(p, 2, COL.gold, 0.8, 1.4);
        this.flash(p, 0xffd27a, 18, 0.6, 7);
    }

    on_heroSlam(ev) {
        const p = this.groundPoint(ev.x, ev.z, 0.15);
        this.ring(p, ev.r * 1.25, COL.gold, 0.5, 1.6);
        this.ring(p, ev.r * 0.7, COL.goldSoft, 0.35, 1.2);
        this.burst(this.add, p, 50, {
            color: COL.fireHot,
            size: 0.25,
            size1: 0.05,
            speed: 5,
            upMin: 0.2,
            upMax: 0.8,
            life: 0.5
        });
        this.burst(this.smoke, p, 14, {
            color: [0.55, 0.48, 0.4],
            size: 0.6,
            size1: 1.4,
            speed: 2.4,
            upMax: 0.4,
            life: 1,
            alpha: 0.5
        });
        this.decal(p, ev.r * 0.6, 'scorch', 4);
        this.flash(p, 0xffd27a, 30, 0.5, 9);
        this.rig.shake(0.25);
    }

    on_rally(ev) {
        this.ring(this.groundPoint(ev.x, ev.z, 0), 0.9, COL.ice, 0.5);
    }

    // ---------- 공성전 ----------
    /** 적이 타워에 던지는 공격: 날아가는 불씨와 도착 시 파편 */
    on_enemyShot(ev) {
        const from = this.groundPoint(ev.x, ev.z, ev.boss ? 1.6 : 0.7);
        const to = this.entities.towerTop(ev.towerId, new THREE.Vector3()) || this.groundPoint(ev.tx, ev.tz, 1);
        to.y -= 0.3;
        const T = 0.32;
        const col = ev.boss ? COL.void : COL.ember;
        this.add.emit({
            x: from.x,
            y: from.y,
            z: from.z,
            vx: (to.x - from.x) / T,
            vy: (to.y - from.y) / T + 2.5,
            vz: (to.z - from.z) / T,
            grav: 15.6,
            life: T,
            size: ev.boss ? 0.5 : 0.22,
            color: col,
            drag: 0
        });
        this.later(T, () => {
            this.burst(this.add, to, ev.boss ? 20 : 7, { color: col, size: 0.12, speed: 2, life: 0.35, grav: 4 });
            this.burst(this.smoke, to, ev.boss ? 6 : 2, {
                color: [0.45, 0.4, 0.38],
                size: 0.3,
                size1: 0.7,
                speed: 0.8,
                life: 0.7,
                alpha: 0.45
            });
            if (ev.boss) this.rig.shake(0.08);
        });
    }

    on_towerDestroyed(ev) {
        const p = this.groundPoint(ev.x, ev.z, 0.5);
        this.burst(this.smoke, p, 40, {
            color: [0.42, 0.37, 0.33],
            size: 1,
            size1: 2.2,
            speed: 2.4,
            upMin: 0.4,
            upMax: 1.6,
            life: 2,
            alpha: 0.7,
            drag: 1.2
        });
        this.burst(this.add, p, 30, {
            color: COL.ember,
            size: 0.12,
            speed: 5,
            upMin: 1,
            upMax: 2.5,
            life: 1.2,
            grav: 8
        });
        this.decal(p, 0.9, 'scorch', 12);
        this.ring(p, 2.2, COL.blood, 0.6, 1.2);
        this.flash(p, 0xff6a3a, 20, 0.5, 8);
        this.rig.shake(0.35);
    }

    on_repair(ev) {
        const p = this.groundPoint(ev.x, ev.z, 0.3);
        this.burst(this.add, p, 24, {
            color: COL.ice,
            size: 0.1,
            speed: 1,
            upMin: 2,
            upMax: 3.5,
            life: 0.9,
            spread: 0.8
        });
        this.ring(p, 1.2, COL.ice, 0.5);
    }

    on_towerStun(ev) {
        const p = this.entities.towerTop(ev.towerId, new THREE.Vector3()) || this.groundPoint(ev.x, ev.z, 1.2);
        this.burst(this.add, p, 8, { color: COL.fireHot, size: 0.1, speed: 1.6, life: 0.4 });
    }

    // ---------- 특수 능력 ----------
    on_deathBlast(ev) {
        const p = this.groundPoint(ev.x, ev.z, 0.3);
        this.burst(this.add, p, 40, { color: COL.fireHot, size: 0.4, size1: 0.05, speed: 4, upMax: 1, life: 0.4 });
        this.burst(this.add, p, 20, { color: COL.ember, size: 0.1, speed: 6, upMin: 1, upMax: 2, life: 0.9, grav: 6 });
        this.ring(p, ev.r, COL.fire, 0.45, 1.3);
        this.decal(p, 0.7, 'scorch', 5);
        this.flash(p, 0xff7a2a, 16, 0.3, 6);
        this.rig.shake(0.1);
    }

    on_pulse(ev) {
        const p = this.groundPoint(ev.x, ev.z, 0.1);
        this.ring(p, ev.r, COL.fire, 0.7, 1.6);
        this.ring(p, ev.r * 0.6, COL.fireHot, 0.5, 1.2);
        this.burst(this.add, p, 40, {
            color: COL.ember,
            size: 0.14,
            speed: 5,
            upMin: 0.6,
            upMax: 1.8,
            life: 0.9,
            grav: 6
        });
        this.decal(p, ev.r * 0.5, 'fire', 1.5);
        this.flash(p, 0xff5a1a, 30, 0.5, 10);
        this.rig.shake(0.3);
    }

    on_blink(ev) {
        const a = this.groundPoint(ev.x0, ev.z0, 0.5);
        const b = this.groundPoint(ev.x, ev.z, 0.5);
        const s = ev.boss ? 2.4 : 1;
        this.burst(this.add, a, 16 * s, { color: COL.void, size: 0.2 * s, speed: 1.5, life: 0.4, grav: -1 });
        this.burst(this.add, b, 16 * s, { color: COL.void, size: 0.2 * s, speed: 2, life: 0.5 });
        this.ring(b, 0.8 * s, COL.void, 0.35);
        this.ribbons.bolt([a, b], '#d04aff', ev.boss ? 0.3 : 0.18, ev.boss ? 0.16 : 0.07);
        if (ev.boss) this.rig.shake(0.15);
    }

    on_burrow(ev) {
        const p = this.groundPoint(ev.x, ev.z, 0.1);
        this.burst(this.smoke, p, 10, {
            color: [0.4, 0.3, 0.22],
            size: 0.35,
            size1: 0.7,
            speed: 1.2,
            upMax: 0.6,
            life: 0.8,
            alpha: 0.7
        });
    }

    on_unburrow(ev) {
        this.on_burrow(ev);
        this.burst(this.add, this.groundPoint(ev.x, ev.z, 0.2), 6, {
            color: COL.goldSoft,
            size: 0.08,
            speed: 2,
            upMin: 1.5,
            upMax: 2.5,
            life: 0.5,
            grav: 6
        });
    }

    on_summon(ev) {
        const p = this.groundPoint(ev.x, ev.z, 0.2);
        this.ring(p, 1.6, COL.heal, 0.6, 1);
        this.burst(this.add, p, 20, { color: COL.heal, size: 0.14, speed: 1.6, upMin: 1, upMax: 2, life: 0.7 });
    }

    on_shield(ev) {
        const p = this.groundPoint(ev.x, ev.z, 1.6);
        this.burst(this.add, p, 30, { color: COL.iceWhite, size: 0.16, speed: 2.4, life: 0.6 });
        this.flash(p, 0x8fe3ff, 14, 0.4, 7);
    }

    on_shieldBreak(ev) {
        const p = this.groundPoint(ev.x, ev.z, 1.6);
        this.burst(this.add, p, 50, {
            color: COL.ice,
            size: 0.18,
            speed: 5,
            upMin: 0.2,
            upMax: 1.5,
            life: 0.8,
            grav: 6
        });
        this.ring(this.groundPoint(ev.x, ev.z, 0), 2.4, COL.iceWhite, 0.5, 1.3);
        this.rig.shake(0.15);
    }

    on_ward(ev) {
        const p = this.groundPoint(ev.x, ev.z, 1.2);
        this.burst(this.add, p, 24, { color: COL.storm, size: 0.16, speed: 3, life: 0.5 });
        this.flash(p, 0xa47cff, 14, 0.4, 7);
    }

    on_enrage(ev) {
        const p = this.groundPoint(ev.x, ev.z, 0.8);
        this.burst(this.add, p, 18, { color: COL.blood, size: 0.16, speed: 2.4, upMin: 0.8, upMax: 1.6, life: 0.6 });
        this.ring(this.groundPoint(ev.x, ev.z, 0), 1.2, COL.blood, 0.4);
    }

    on_split(ev) {
        const p = this.groundPoint(ev.x, ev.z, 0.4);
        this.burst(this.add, p, 26, { color: COL.arcane, size: 0.16, speed: 3, life: 0.5 });
        this.ring(this.groundPoint(ev.x, ev.z, 0), 1, COL.void, 0.35);
    }

    on_pollen(ev) {
        const p = this.groundPoint(ev.x, ev.z, 0.6);
        this.burst(this.add, p, 36, {
            color: HDR('#ffe36a', 2.4),
            size: 0.14,
            speed: 1.6,
            upMin: 0.3,
            upMax: 1.2,
            life: 1.4,
            drag: 1.4,
            spread: 0.6
        });
        this.ring(this.groundPoint(ev.x, ev.z, 0), ev.r, COL.heal, 0.6);
    }

    on_immune(ev) {
        this.burst(this.add, this.groundPoint(ev.x, ev.z, 0.7), 5, {
            color: [1.4, 1.4, 1.6],
            size: 0.08,
            speed: 1.2,
            life: 0.3
        });
    }

    on_stomp(ev) {
        const p = this.groundPoint(ev.x, ev.z, 0.05);
        this.ring(p, ev.r * 1.2, COL.void, 0.4, 0.9);
        this.burst(this.smoke, p, 8, {
            color: [0.35, 0.3, 0.32],
            size: 0.5,
            size1: 1.1,
            speed: 1.6,
            upMax: 0.3,
            life: 0.8,
            alpha: 0.5
        });
    }

    /** 잠깐 뒤에 실행 (날아가는 공격의 도착 연출) */
    later(t, fn) {
        (this.queue ||= []).push({ t, fn });
    }

    // ---------- 매 프레임 ----------
    update(dt, t, state) {
        if (this.queue && this.queue.length) {
            for (const q of this.queue) {
                q.t -= dt;
                if (q.t <= 0) q.fn();
            }
            this.queue = this.queue.filter((q) => q.t > 0);
        }
        this.ambient(dt, t, state);
        this.add.update(dt);
        this.smoke.update(dt);
        this.ribbons.update(dt);
        for (const r of this.rings) {
            if (!r.mesh.visible) continue;
            r.life -= dt;
            const k = 1 - r.life / r.max;
            const e = 1 - Math.pow(1 - k, 3);
            r.mesh.scale.setScalar(Math.max(0.01, r.radius * (0.15 + 0.85 * e)));
            r.mesh.material.color.copy(r.color).multiplyScalar(Math.max(0, 1 - k) * r.width);
            if (r.life <= 0) r.mesh.visible = false;
        }
        for (const d of this.decals) {
            d.life -= dt;
            const k = d.life / d.max;
            if (d.color) d.mesh.material.color.copy(d.color).multiplyScalar(Math.max(0, k));
            else d.mesh.material.opacity = Math.min(1, k * 2);
            if (d.life <= 0) {
                drop(d.mesh);
                d.done = true;
            }
        }
        this.decals = this.decals.filter((d) => !d.done);
        for (const s of this.lights) {
            s.life = Math.max(0, s.life - dt);
            s.light.intensity = s.life > 0 ? s.power * Math.pow(s.life / s.max, 1.5) : 0;
        }
        for (const m of this.meteors) {
            m.t += dt;
            const k = Math.min(1, m.t / m.T);
            m.rock.position.lerpVectors(m.from, m.target, k * k);
            m.rock.rotation.x += dt * 5;
            m.rock.rotation.z += dt * 3;
            m.warn.material.opacity = 0.5 + 0.5 * Math.sin(t * 20);
            m.warn.scale.setScalar(1.2 - k * 0.2);
            this.burst(this.add, m.rock.position, 6, {
                color: COL.fire,
                size: 0.7,
                size1: 0.1,
                speed: 0.4,
                life: 0.5,
                spread: 0.5
            });
            this.burst(this.smoke, m.rock.position, 2, {
                color: [0.25, 0.2, 0.2],
                size: 0.8,
                size1: 1.8,
                speed: 0.3,
                life: 1.2,
                alpha: 0.5
            });
            if (k >= 1) {
                drop(m.rock, m.warn);
                m.done = true;
            }
        }
        this.meteors = this.meteors.filter((m) => !m.done);
    }

    ambient(dt, t, state) {
        this.ambientT += dt;
        this.updateBeams(state, t);
        const q = this.q;
        // 투사체 궤적
        for (const p of state.projectiles) {
            const mesh = this.entities.projectileAt?.(p.id);
            const pos = mesh ? mesh.position : null;
            if (!pos) continue;
            if (p.kind === 'mortar') {
                this.add.emit({
                    x: pos.x,
                    y: pos.y,
                    z: pos.z,
                    life: 0.35,
                    size: 0.35,
                    size1: 0.05,
                    color: COL.fire,
                    drag: 0
                });
                if (Math.random() < 0.5 * q)
                    this.smoke.emit({
                        x: pos.x,
                        y: pos.y,
                        z: pos.z,
                        vy: 0.3,
                        life: 0.9,
                        size: 0.3,
                        size1: 0.8,
                        color: [0.3, 0.26, 0.25],
                        alpha: 0.45
                    });
            } else if (p.kind === 'shard' || p.kind === 'lance') {
                this.add.emit({
                    x: pos.x,
                    y: pos.y,
                    z: pos.z,
                    life: 0.25,
                    size: p.kind === 'lance' ? 0.3 : 0.16,
                    size1: 0.02,
                    color: COL.ice,
                    drag: 0
                });
            } else if (p.kind === 'arrow' && Math.random() < 0.6) {
                this.add.emit({
                    x: pos.x,
                    y: pos.y,
                    z: pos.z,
                    life: 0.15,
                    size: 0.07,
                    size1: 0.01,
                    color: COL.goldSoft,
                    drag: 0
                });
            }
        }
        // 불타는 지면
        for (const z of state.zones) {
            const n = z.meteor ? 3 : 2;
            for (let i = 0; i < n; i++) {
                if (Math.random() > q) continue;
                const a = Math.random() * Math.PI * 2;
                const r = Math.sqrt(Math.random()) * z.r;
                const x = z.x + Math.cos(a) * r;
                const zz = z.z + Math.sin(a) * r;
                const y = this.world.heightAt(x, zz) + 0.05;
                this.add.emit({
                    x,
                    y,
                    z: zz,
                    vy: rnd(0.6, 1.6),
                    life: rnd(0.3, 0.6),
                    size: rnd(0.2, 0.4),
                    size1: 0.02,
                    color: Math.random() < 0.3 ? COL.fireHot : COL.fire,
                    drag: 0.5,
                    alpha: z.t / z.max + 0.2
                });
            }
        }
        // 영구동토 오라
        const seen = new Set();
        for (const tower of state.towers) {
            if (tower.type !== 'frost' || tower.branch !== 'a') continue;
            seen.add(tower.id);
            let ring = this.auraRings.get(tower.id);
            const range = TOWERS.frost.branches.a.range;
            if (!ring) {
                ring = this.decalLive(this.groundPoint(tower.x, tower.z, 0), range, '#6fd4ff');
                ring.material.opacity = 0.35;
                this.auraRings.set(tower.id, ring);
            }
            ring.rotation.z = t * 0.2;
            if (tower.auraActive && Math.random() < 0.8 * q) {
                const a = Math.random() * Math.PI * 2;
                const r = Math.sqrt(Math.random()) * range;
                const x = tower.x + Math.cos(a) * r;
                const z = tower.z + Math.sin(a) * r;
                this.smoke.emit({
                    x,
                    y: this.world.heightAt(x, z) + 0.1,
                    z,
                    vy: 0.15,
                    life: 1.4,
                    size: 0.6,
                    size1: 1.2,
                    color: [0.7, 0.88, 1],
                    alpha: 0.28
                });
                this.add.emit({
                    x,
                    y: this.world.heightAt(x, z) + 0.3,
                    z,
                    vy: -0.2,
                    life: 1,
                    size: 0.07,
                    color: COL.iceWhite,
                    drag: 0.2
                });
            }
        }
        for (const [id, ring] of this.auraRings) {
            if (!seen.has(id)) {
                drop(ring);
                this.auraRings.delete(id);
            }
        }
        // 빙결 껍질
        const frozen = new Set();
        for (const e of state.enemies) {
            if (e.frozenT <= 0) continue;
            frozen.add(e.id);
            let shell = this.shells.get(e.id);
            if (!shell) {
                shell = new THREE.Mesh(
                    new THREE.IcosahedronGeometry(0.5, 0),
                    new THREE.MeshStandardMaterial({
                        color: 0xbfefff,
                        emissive: 0x2a8fd0,
                        emissiveIntensity: 0.8,
                        roughness: 0.05,
                        transparent: true,
                        opacity: 0.55,
                        flatShading: true
                    })
                );
                this.scene.add(shell);
                this.shells.set(e.id, shell);
            }
            const c = this.entities.enemyCenter(e, this.v2);
            shell.position.copy(c);
            shell.scale
                .set(0.8, 1.3, 0.8)
                .multiplyScalar(e.scale * (e.def.boss ? 2.4 : 1) * Math.min(1, e.frozenT * 4));
        }
        for (const [id, shell] of this.shells) {
            if (!frozen.has(id)) {
                drop(shell);
                this.burst(this.add, shell.position, 10, {
                    color: COL.iceWhite,
                    size: 0.1,
                    speed: 2,
                    life: 0.4,
                    grav: 5
                });
                this.shells.delete(id);
            }
        }
        // 적 몸에서 흐르는 기운
        for (const e of state.enemies) {
            if (e.type === 'wraith' && Math.random() < 0.35 * q) {
                const c = this.entities.enemyCenter(e, this.v2);
                this.add.emit({
                    x: c.x,
                    y: c.y - 0.3,
                    z: c.z,
                    vy: 0.1,
                    life: 0.7,
                    size: 0.28,
                    size1: 0.02,
                    color: [0.3, 1.4, 1.3],
                    drag: 0.5,
                    alpha: 0.6
                });
            } else if (e.type === 'colossus' && Math.random() < 0.8 * q) {
                const c = this.entities.enemyCenter(e, this.v2);
                this.smoke.emit({
                    x: c.x + rnd(-0.5, 0.5),
                    y: c.y + rnd(0, 1),
                    z: c.z + rnd(-0.5, 0.5),
                    vy: 0.6,
                    life: 1.5,
                    size: 0.8,
                    size1: 1.6,
                    color: [0.1, 0.06, 0.14],
                    alpha: 0.5
                });
                this.add.emit({
                    x: c.x + rnd(-0.6, 0.6),
                    y: c.y + rnd(0, 1.2),
                    z: c.z + rnd(-0.6, 0.6),
                    vy: 0.8,
                    life: 0.8,
                    size: 0.15,
                    color: COL.void,
                    drag: 0.5
                });
            }
        }
        // 수정 주변의 빛 입자, 포털의 어둠 입자, 반딧불
        if (Math.random() < 0.6 * q) {
            const c = this.world.core.top;
            const a = Math.random() * Math.PI * 2;
            const r = rnd(0.6, 2.2);
            this.add.emit({
                x: c.x + Math.cos(a) * r,
                y: c.y - 1.2,
                z: c.z + Math.sin(a) * r,
                vy: rnd(0.4, 1.2),
                life: 2.4,
                size: 0.09,
                color: COL.goldSoft,
                drag: 0.1,
                fadeIn: 0.3
            });
        }
        if (Math.random() < 0.7 * q) {
            const portals = this.world.portals;
            const pg = portals[Math.floor(Math.random() * portals.length)].group.position;
            const a = Math.random() * Math.PI * 2;
            const r = rnd(1.2, 2.2);
            const x = pg.x + Math.cos(a) * r;
            const z = pg.z + Math.sin(a) * r;
            this.add.emit({
                x,
                y: pg.y + rnd(0.3, 2.4),
                z,
                vx: (pg.x - x) * 0.8,
                vz: (pg.z - z) * 0.8,
                life: 1.1,
                size: 0.12,
                color: COL.void,
                drag: 0.1
            });
        }
        if (Math.random() < 0.25 * q) {
            const { rx, rz } = state.map.island;
            const x = rnd(-rx, rx) * 0.85;
            const z = rnd(-rz, rz) * 0.85;
            if (this.world.terrain.ellipseR(x, z) < 0.9) {
                this.add.emit({
                    x,
                    y: this.world.heightAt(x, z) + rnd(0.3, 1.2),
                    z,
                    vx: rnd(-0.2, 0.2),
                    vy: rnd(-0.05, 0.1),
                    vz: rnd(-0.2, 0.2),
                    life: rnd(3, 5),
                    size: 0.07,
                    color: COL.firefly,
                    drag: 0,
                    fadeIn: 0.3
                });
            }
        }
    }
}
