// 성채(공성전 전용 맵): 수정을 둘러싼 사각 성벽, 모서리 보루, 성문(문루·문짝).
// 성문은 state.gates를 매 프레임 읽어 손상·보강·붕괴 모습을 맞춘다. 장면에서 지우는 개체는 없다
// (잔해도 처음부터 만들어 두고 숨겼다 보인다) — 맵을 바꿀 때 disposeScene이 한꺼번에 해제한다.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mulberry32 } from '../util/noise.js';
import { stoneMaterial, goldMaterial } from './structures.js';

const WALL_H = 0.95;
const WALL_T = 0.5;
const BASTION_R = 1.08;
/** 문루 탑 중심까지의 거리 (성문 중심 기준, 성벽 방향) */
const TOWER_Z = 1.42;
/** 문짝 경첩 위치 */
const HINGE_Z = 1.04;
/** 성벽이 비는 반폭: 문루 탑 바깥 끝 */
const GATE_GAP = 1.85;

const WOOD = new THREE.Color('#9a6432');
const CHAR = new THREE.Color('#231610');

const shadows = (o) =>
    o.traverse((m) => {
        if (m.isMesh) {
            m.castShadow = true;
            m.receiveShadow = true;
        }
    });

export function createFortress(state, terrain, theme) {
    const group = new THREE.Group();
    group.name = 'fortress';
    const fort = state.map.fortress;
    const views = [];
    const empty = { group, views, pickables: [], update() {}, gateTop: () => null };
    if (!fort) return empty;
    const { hx, hz } = fort;
    const wallMat = stoneMaterial(new THREE.Color(theme.wall), 0.88);
    const darkMat = stoneMaterial(new THREE.Color(theme.wall).multiplyScalar(0.68), 0.92);
    const darkInner = darkMat.clone();
    darkInner.side = THREE.BackSide;
    const roofMat = new THREE.MeshStandardMaterial({ color: theme.roof, roughness: 0.7 });
    const bannerMat = new THREE.MeshStandardMaterial({ color: theme.banner, roughness: 0.8, side: THREE.DoubleSide });
    const iron = new THREE.MeshStandardMaterial({ color: 0x4a4650, roughness: 0.4, metalness: 0.8 });
    const gold = goldMaterial();
    const merlonGeo = new THREE.BoxGeometry(0.26, 0.24, 0.2);
    const merlons = [];
    const dummy = new THREE.Object3D();

    // ---------- 성벽 ----------
    const corners = [
        [-hx, -hz],
        [hx, -hz],
        [hx, hz],
        [-hx, hz]
    ];
    for (let i = 0; i < 4; i++) {
        const [ax, az] = corners[i];
        const [bx, bz] = corners[(i + 1) % 4];
        const len = Math.hypot(bx - ax, bz - az);
        const ux = (bx - ax) / len;
        const uz = (bz - az) / len;
        // 바깥쪽 법선 (사각형 중심에서 멀어지는 쪽)
        const ox = uz;
        const oz = -ux;
        const cuts = [
            [-1, BASTION_R - 0.15],
            [len - BASTION_R + 0.15, len + 1]
        ];
        for (const g of state.gates) {
            const t = (g.x - ax) * ux + (g.z - az) * uz;
            const off = Math.abs((g.x - ax) * ox + (g.z - az) * oz);
            if (off < 0.8 && t > 0 && t < len) cuts.push([t - GATE_GAP, t + GATE_GAP]);
        }
        cuts.sort((a, b) => a[0] - b[0]);
        let from = 0;
        const free = [];
        for (const [c0, c1] of cuts) {
            if (c0 > from) free.push([from, c0]);
            from = Math.max(from, c1);
        }
        for (const [t0, t1] of free) {
            const l = t1 - t0;
            if (l < 0.2) continue;
            const mx = ax + ux * (t0 + l / 2);
            const mz = az + uz * (t0 + l / 2);
            const y = terrain.heightAt(mx, mz);
            const rot = -Math.atan2(uz, ux);
            const body = new THREE.Mesh(new THREE.BoxGeometry(l, WALL_H, WALL_T), wallMat);
            body.position.set(mx, y + WALL_H / 2 - 0.05, mz);
            body.rotation.y = rot;
            const plinth = new THREE.Mesh(new THREE.BoxGeometry(l, 0.22, WALL_T + 0.16), darkMat);
            plinth.position.set(mx, y + 0.06, mz);
            plinth.rotation.y = rot;
            const cap = new THREE.Mesh(new THREE.BoxGeometry(l, 0.07, WALL_T + 0.08), darkMat);
            cap.position.set(mx, y + WALL_H - 0.04, mz);
            cap.rotation.y = rot;
            group.add(body, plinth, cap);
            // 바깥 가장자리 총안
            const n = Math.floor(l / 0.46);
            for (let k = 0; k < n; k++) {
                const t = t0 + (k + 0.5) * (l / n);
                merlons.push({
                    x: ax + ux * t + ox * (WALL_T / 2 - 0.1),
                    z: az + uz * t + oz * (WALL_T / 2 - 0.1),
                    y: y + WALL_H + 0.08,
                    rot
                });
            }
        }
    }

    // ---------- 모서리 보루 (소켓을 감싸는 낮은 원형 벽) ----------
    for (const [cx, cz] of corners) {
        const y = terrain.heightAt(cx, cz);
        const ring = new THREE.Mesh(new THREE.CylinderGeometry(BASTION_R, BASTION_R + 0.1, 0.62, 28, 1, true), wallMat);
        ring.position.set(cx, y + 0.28, cz);
        const inner = new THREE.Mesh(
            new THREE.CylinderGeometry(BASTION_R - 0.2, BASTION_R - 0.2, 0.6, 28, 1, true),
            darkInner
        );
        inner.position.copy(ring.position);
        const top = new THREE.Mesh(new THREE.RingGeometry(BASTION_R - 0.2, BASTION_R + 0.02, 28), darkMat);
        top.rotation.x = -Math.PI / 2;
        top.position.set(cx, y + 0.6, cz);
        group.add(ring, inner, top);
        for (let k = 0; k < 10; k++) {
            const a = (k / 10) * Math.PI * 2;
            merlons.push({
                x: cx + Math.cos(a) * (BASTION_R - 0.05),
                z: cz + Math.sin(a) * (BASTION_R - 0.05),
                y: y + 0.7,
                rot: -a + Math.PI / 2
            });
        }
    }
    const mer = new THREE.InstancedMesh(merlonGeo, wallMat, merlons.length);
    merlons.forEach((m, i) => {
        dummy.position.set(m.x, m.y, m.z);
        dummy.rotation.set(0, m.rot, 0);
        dummy.updateMatrix();
        mer.setMatrixAt(i, dummy.matrix);
    });
    group.add(mer);

    // ---------- 성문 ----------
    const pickables = [];
    const rand = mulberry32(77);
    for (const g of state.gates) {
        const root = new THREE.Group();
        root.position.set(g.x, terrain.heightAt(g.x, g.z), g.z);
        // 로컬 x = 적이 들어오는 방향, z = 성벽 방향
        root.rotation.y = -Math.atan2(g.dirZ, g.dirX);
        const body = new THREE.Group();
        root.add(body);
        const banners = [];
        const roofs = [];
        // 문루 탑 두 개
        for (const s of [-1, 1]) {
            const tower = new THREE.Group();
            const shaft = new THREE.Mesh(new RoundedBoxGeometry(0.9, 1.75, 0.78, 2, 0.05), wallMat);
            shaft.position.y = 0.85;
            const band = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.1, 0.86), darkMat);
            band.position.y = 1.62;
            const roof = new THREE.Mesh(new THREE.ConeGeometry(0.72, 0.8, 4), roofMat);
            roof.rotation.y = Math.PI / 4;
            roof.position.y = 2.08;
            const tip = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), gold);
            tip.position.y = 2.5;
            // 바깥쪽 벽면의 깃발
            const banner = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.7), bannerMat);
            banner.rotation.y = Math.PI / 2;
            banner.position.set(-0.47, 1.05, 0);
            banners.push(banner);
            tower.add(shaft, band, roof, tip, banner);
            roofs.push({ roof, tip, y: roof.position.y, s });
            tower.position.z = s * TOWER_Z;
            body.add(tower);
        }
        // 바깥쪽 아치 들보 (얇게: 위에서 문짝이 보이도록)
        const lintel = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.24, 2.3), darkMat);
        lintel.position.set(-0.24, 1.62, 0);
        const crest = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 0.46), gold);
        crest.position.set(-0.4, 1.62, 0);
        // 안쪽 빗장: 닫힌 문을 가로지르는 굵은 나무 막대 (위에서도 문이 닫힌 게 보인다)
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 2.2), iron);
        bar.position.set(0.26, 0.95, 0);
        // 문턱 돌
        const sill = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 2.2), darkMat);
        sill.position.y = 0.02;
        body.add(lintel, crest, bar, sill);
        // 문짝: 경첩(피벗)을 문루 안쪽 끝에 두고 가운데로 닫힌다
        const doorMat = new THREE.MeshStandardMaterial({ color: WOOD.clone(), roughness: 0.85 });
        const leaves = [];
        const bands1 = [];
        const bands2 = [];
        for (const s of [-1, 1]) {
            const pivot = new THREE.Group();
            pivot.position.set(0, 0, s * HINGE_Z);
            const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.36, HINGE_Z - 0.02), doorMat);
            leaf.position.set(0, 0.7, -s * (HINGE_Z / 2));
            pivot.add(leaf);
            // 기본 쇠띠
            for (const y of [0.3, 1.0]) {
                const b = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, HINGE_Z - 0.06), iron);
                b.position.set(0, y, -s * (HINGE_Z / 2));
                pivot.add(b);
            }
            // 보강 1단계: 쇠띠 추가, 2단계: 금빛 징
            for (const y of [0.55, 0.78]) {
                const b = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.09, HINGE_Z - 0.06), iron);
                b.position.set(0, y, -s * (HINGE_Z / 2));
                pivot.add(b);
                bands1.push(b);
            }
            for (let k = 0; k < 4; k++) {
                const stud = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 4), gold);
                stud.position.set(-0.17, 0.2 + k * 0.32, -s * (HINGE_Z * 0.5));
                pivot.add(stud);
                bands2.push(stud);
            }
            body.add(pivot);
            leaves.push({ pivot, s, leaf });
        }
        // 무너졌을 때의 잔해 (처음엔 숨김)
        const rubble = new THREE.Group();
        for (let k = 0; k < 11; k++) {
            const r = 0.12 + rand() * 0.2;
            const m = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), k % 3 ? wallMat : darkMat);
            m.position.set((rand() - 0.3) * 1.6, r * 0.6, (rand() - 0.5) * 2.4);
            m.rotation.set(rand() * 3, rand() * 3, rand() * 3);
            rubble.add(m);
        }
        for (let k = 0; k < 4; k++) {
            const plank = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.5 + rand() * 0.4), doorMat);
            plank.position.set(0.3 + rand() * 0.9, 0.05, (rand() - 0.5) * 1.8);
            plank.rotation.set(0, rand() * 3, (rand() - 0.5) * 0.4);
            rubble.add(plank);
        }
        rubble.visible = false;
        root.add(rubble);
        shadows(root);
        root.traverse((o) => {
            if (o.isMesh) {
                o.userData.gateId = g.id;
                pickables.push(o);
            }
        });
        group.add(root);
        views.push({
            id: g.id,
            root,
            body,
            lintel,
            crest,
            bar,
            roofs,
            leaves,
            banners,
            bands1,
            bands2,
            rubble,
            doorMat,
            k: 0,
            baseY: root.position.y
        });
    }
    shadows(group);

    const _c = new THREE.Color();
    return {
        group,
        views,
        pickables,
        /** 체력바·이펙트용: 성문 꼭대기 월드 좌표 */
        gateTop(id, out = new THREE.Vector3()) {
            const v = views[id];
            if (!v) return null;
            return out.set(v.root.position.x, v.baseY + 2.35, v.root.position.z);
        },
        update(t, dt, st) {
            for (const v of views) {
                const g = st.gates[v.id];
                if (!g) continue;
                const goal = g.broken ? 1 : 0;
                // 무너질 땐 빠르게, 재건될 땐 천천히
                v.k += (goal - v.k) * Math.min(1, dt * (goal ? 7 : 2.5));
                const k = v.k;
                const hpK = g.broken ? 0 : g.hp / g.maxHp;
                const sag = Math.max(0, 0.5 - hpK) * 0.3;
                for (const { pivot, s } of v.leaves) {
                    if (s < 0) {
                        // 왼짝: 안쪽으로 밀려 열리며 기운다
                        pivot.rotation.set(k * 0.35, -s * (sag + k * 1.7), 0);
                        pivot.position.y = 0;
                    } else {
                        // 오른짝: 경첩이 뜯겨 안쪽 땅바닥에 쓰러진다
                        pivot.rotation.set(0, -s * sag * 0.6 - k * 0.5, -k * 1.45);
                        pivot.position.set(k * 0.35, 0, s * HINGE_Z);
                    }
                }
                v.lintel.visible = k < 0.5;
                v.crest.visible = k < 0.5;
                v.bar.visible = k < 0.2;
                // 문루 지붕: 하나는 굴러떨어지고 하나는 기운다
                for (const r of v.roofs) {
                    const fall = r.s < 0 ? 1 : 0.35;
                    r.roof.rotation.set(k * 0.9 * fall * r.s, Math.PI / 4, k * 0.6 * fall);
                    r.roof.position.set(-k * 0.5 * fall, r.y - k * 1.5 * fall * fall, k * 0.3 * fall * r.s);
                    r.tip.visible = k < 0.5;
                }
                v.rubble.visible = k > 0.15;
                v.rubble.scale.setScalar(Math.max(0.01, Math.min(1, k * 1.2)));
                for (const b of v.bands1) b.visible = g.level >= 1;
                for (const b of v.bands2) b.visible = g.level >= 2;
                // 손상될수록 검게 그을린다
                v.doorMat.color.copy(WOOD).lerp(CHAR, Math.min(1, (1 - hpK) * 0.75 + k));
                const hit = g.hitT != null && st.time - g.hitT < 0.12 && !g.broken;
                v.doorMat.emissive.copy(hit ? _c.setRGB(0.55, 0.18, 0.06) : _c.setRGB(0, 0, 0));
                const shake = hit ? (Math.random() - 0.5) * 0.05 : 0;
                v.body.position.set(shake, 0, shake * 0.6);
                v.banners.forEach((b, i) => (b.rotation.x = Math.sin(t * 2.4 + v.id * 1.7 + i) * 0.12));
            }
        }
    };
}
