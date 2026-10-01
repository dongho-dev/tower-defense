// 게임 상태(타워·적·투사체)를 3D 오브젝트로 동기화한다. 로직은 건드리지 않는다.
import * as THREE from 'three';
import { buildTowerModel, animateTower } from './models/towers.js';
import { buildEnemyModel, animateEnemy } from './models/enemies.js';
import { materials } from './models/materials.js';

const _v = new THREE.Vector3();
export const ENEMY_SCALE = 1.5;

export class EntityView {
    constructor(scene, world) {
        this.scene = scene;
        this.world = world;
        this.towers = new Map();
        this.enemies = new Map();
        this.dying = [];
        this.projectiles = new Map();
        this.root = new THREE.Group();
        this.root.name = 'entities';
        scene.add(this.root);
        this.pools = { arrow: [], mortar: [], shard: [], lance: [] };
        this.projMesh = new Map();
    }

    /** 새 게임 시작 시 모든 오브젝트 제거 */
    reset() {
        for (const v of this.towers.values()) this.root.remove(v.root);
        for (const v of this.enemies.values()) this.root.remove(v.root);
        for (const d of this.dying) this.root.remove(d.v.root);
        this.towers.clear();
        this.enemies.clear();
        this.dying = [];
        this.projectiles.clear();
        this.projMesh.clear();
        for (const pool of Object.values(this.pools)) for (const m of pool) m.visible = false;
    }

    projectileAt(id) {
        return this.projMesh.get(id);
    }

    socketY(id) {
        return this.world.sockets.topY(id);
    }

    groundY(x, z) {
        return this.world.heightAt(x, z);
    }

    /** 타워 포구의 월드 좌표 (이펙트용) */
    muzzleOf(towerId, out = new THREE.Vector3()) {
        const v = this.towers.get(towerId);
        if (!v) return null;
        v.model.muzzle.getWorldPosition(out);
        return out;
    }

    towerTop(towerId, out = new THREE.Vector3()) {
        const v = this.towers.get(towerId);
        if (!v) return null;
        return out.set(v.root.position.x, v.root.position.y + v.model.height, v.root.position.z);
    }

    enemyCenter(e, out = new THREE.Vector3()) {
        const v = this.enemies.get(e.id);
        const h = (e.def.flying ? 0.9 : 0.45) * (e.def.boss ? 2.4 : 1) * e.scale * ENEMY_SCALE;
        return out.set(e.x, (v ? v.root.position.y : this.groundY(e.x, e.z)) + h, e.z);
    }

    handleEvents(events) {
        for (const ev of events) {
            if (ev.type === 'fire') {
                const v = this.towers.get(ev.towerId);
                if (v) v.recoil = 1;
            } else if (ev.type === 'death' || ev.type === 'leak') {
                const v = this.enemies.get(ev.id);
                if (v) {
                    this.enemies.delete(ev.id);
                    this.dying.push({ v, t: 0, leak: ev.type === 'leak' });
                }
            } else if (ev.type === 'upgrade' || ev.type === 'build') {
                const v = this.towers.get(ev.towerId);
                if (v) v.pop = 0;
            }
        }
    }

    update(state, events, t, dt) {
        this.handleEvents(events);
        this.syncTowers(state, t, dt);
        this.syncEnemies(state, t, dt);
        this.syncProjectiles(state);
        this.updateDying(dt);
    }

    syncTowers(state, t, dt) {
        const alive = new Set();
        for (const tower of state.towers) {
            alive.add(tower.id);
            let v = this.towers.get(tower.id);
            const sig = tower.tier + (tower.branch || '') + (tower.mastery || 0);
            if (!v) {
                v = { root: new THREE.Group(), model: null, sig: null, recoil: 0, pop: 0, built: 0 };
                v.root.userData.towerId = tower.id;
                v.root.position.set(tower.x, this.socketY(tower.socketId), tower.z);
                this.root.add(v.root);
                this.towers.set(tower.id, v);
            }
            if (v.sig !== sig) {
                if (v.model) v.root.remove(v.model.group);
                v.model = buildTowerModel(tower.type, tower.tier, tower.branch, tower.id, tower.mastery);
                if (v.model.turret) v.model.turret.rotation.y = -tower.aim;
                v.root.add(v.model.group);
                v.sig = sig;
                v.pop = 0;
            }
            // 건설·업그레이드 팝
            v.pop = Math.min(1, v.pop + dt * 2.6);
            const k = v.pop;
            const s = k < 1 ? 1 - Math.pow(1 - k, 3) * Math.cos(k * 9) * 0.9 : 1;
            v.root.scale.set(s, Math.max(0.05, s), s);
            v.recoil = Math.max(0, v.recoil - dt * 6);
            animateTower(v.model, tower, t, dt, v.recoil);
        }
        for (const [id, v] of this.towers) {
            if (!alive.has(id)) {
                this.root.remove(v.root);
                this.towers.delete(id);
            }
        }
    }

    syncEnemies(state, t, dt) {
        for (const e of state.enemies) {
            let v = this.enemies.get(e.id);
            if (!v) {
                v = buildEnemyModel(e.type, e.elite);
                v.root.userData.enemyId = e.id;
                v.root.scale.setScalar(e.scale * ENEMY_SCALE);
                v.lastHp = e.hp;
                v.spawnT = 0;
                this.root.add(v.root);
                this.enemies.set(e.id, v);
            }
            if (e.hp < v.lastHp - 0.01) v.hitT = 0.12;
            v.lastHp = e.hp;
            v.spawnT = Math.min(1, v.spawnT + dt * 2.5);
            v.root.position.set(e.x, this.groundY(e.x, e.z), e.z);
            const want = -Math.atan2(e.dirZ, e.dirX);
            let diff = want - v.root.rotation.y;
            diff = Math.atan2(Math.sin(diff), Math.cos(diff));
            v.root.rotation.y += diff * Math.min(1, dt * 10);
            const sk = e.scale * ENEMY_SCALE * (0.3 + 0.7 * v.spawnT);
            v.root.scale.setScalar(sk);
            animateEnemy(v, e, t, dt);
        }
    }

    updateDying(dt) {
        for (const d of this.dying) {
            d.t += dt;
            const k = d.t / (d.leak ? 0.25 : 0.45);
            d.v.root.scale.multiplyScalar(d.leak ? 0.85 : 0.94);
            d.v.root.position.y -= dt * (d.leak ? 0 : 0.8);
            d.v.group.rotation.z = -k * 1.2;
            if (k >= 1) {
                this.root.remove(d.v.root);
                d.done = true;
            }
        }
        this.dying = this.dying.filter((d) => !d.done);
    }

    projectileMesh(kind) {
        const pool = this.pools[kind];
        for (const m of pool) if (!m.visible) return m;
        const M = materials();
        let m;
        if (kind === 'arrow') {
            m = new THREE.Group();
            const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.42, 4), M.wood);
            shaft.rotation.z = Math.PI / 2;
            const tip = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.08, 4), M.gold);
            tip.rotation.z = -Math.PI / 2;
            tip.position.x = 0.24;
            const glow = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), M.goldCrystal);
            glow.position.x = 0.24;
            m.add(shaft, tip, glow);
        } else if (kind === 'mortar') {
            m = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), M.fireGlow);
        } else if (kind === 'shard') {
            m = new THREE.Mesh(new THREE.OctahedronGeometry(0.08), M.iceCrystal);
            m.scale.set(2.2, 0.8, 0.8);
        } else {
            m = new THREE.Mesh(new THREE.OctahedronGeometry(0.12), M.iceCrystal);
            m.scale.set(4.5, 0.9, 0.9);
        }
        m.castShadow = true;
        this.scene.add(m);
        pool.push(m);
        return m;
    }

    syncProjectiles(state) {
        for (const pool of Object.values(this.pools)) for (const m of pool) m.visible = false;
        this.projMesh.clear();
        const byId = new Map(state.enemies.map((e) => [e.id, e]));
        for (const p of state.projectiles) {
            const m = this.projectileMesh(p.kind);
            m.visible = true;
            this.projMesh.set(p.id, m);
            let start = this.projectiles.get(p.id);
            if (!start) {
                start = this.muzzleOf(p.towerId, new THREE.Vector3()) || new THREE.Vector3(p.sx, 1, p.sz);
                this.projectiles.set(p.id, start);
            }
            const k = Math.min(1, p.t / Math.max(0.05, p.T));
            if (p.kind === 'mortar') {
                const endY = this.groundY(p.tx, p.tz) + 0.1;
                const H = 1.6 + Math.hypot(p.tx - p.sx, p.tz - p.sz) * 0.25;
                const y = THREE.MathUtils.lerp(start.y, endY, k) + 4 * H * k * (1 - k);
                m.position.set(THREE.MathUtils.lerp(start.x, p.tx, k), y, THREE.MathUtils.lerp(start.z, p.tz, k));
                m.userData.vy = H * 4 * (1 - 2 * k);
            } else {
                const target = byId.get(p.targetId);
                const endY = target ? this.enemyCenter(target, _v).y : this.groundY(p.x, p.z) + 0.4;
                const y = THREE.MathUtils.lerp(start.y, endY, k) + Math.sin(k * Math.PI) * 0.25;
                const px = m.position.x;
                const pz = m.position.z;
                const py = m.position.y;
                m.position.set(p.x, y, p.z);
                const dx = p.x - px;
                const dz = p.z - pz;
                const dy = y - py;
                if (dx * dx + dz * dz > 1e-6) {
                    m.rotation.set(0, -Math.atan2(dz, dx), Math.atan2(dy, Math.hypot(dx, dz)));
                }
            }
        }
        // 끝난 투사체 시작점 기록 정리
        if (this.projectiles.size > state.projectiles.length + 50) {
            const live = new Set(state.projectiles.map((p) => p.id));
            for (const id of this.projectiles.keys()) if (!live.has(id)) this.projectiles.delete(id);
        }
    }
}
