// 살아남기 지형 소품: 절벽·바위 능선의 바윗덩이, 가장자리 산맥의 눈 덮인 전나무, 광맥 수정.
// 모두 인스턴스 메시 한두 개로 그린다 (수천 개여도 그리기 호출 몇 번).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { KIND } from '../../core/snowfield.js';

/** 결정적 난수 */
function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => {
        s ^= s << 13;
        s ^= s >>> 17;
        s ^= s << 5;
        return (s >>> 0) / 4294967296;
    };
}

/** 눈 모자를 쓴 바윗덩이 (위쪽 꼭짓점은 흰색) */
function rockGeometry() {
    const g = new THREE.DodecahedronGeometry(0.5, 0);
    const p = g.getAttribute('position');
    const r = rng(77);
    for (let i = 0; i < p.count; i++) {
        p.setXYZ(i, p.getX(i) * (0.85 + r() * 0.3), p.getY(i) * 0.8, p.getZ(i) * (0.85 + r() * 0.3));
    }
    g.computeVertexNormals();
    const col = new Float32Array(p.count * 3);
    const rock = new THREE.Color('#6e655e');
    const snow = new THREE.Color('#eef2fb');
    const c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
        c.copy(rock).lerp(snow, THREE.MathUtils.smoothstep(p.getY(i), 0.12, 0.34));
        col.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
}

/** 전나무: 줄기 + 원뿔 세 층, 가지 끝에 눈 */
function pineGeometry() {
    const parts = [];
    const paint = (g, color, snowFrom = null) => {
        const p = g.getAttribute('position');
        const col = new Float32Array(p.count * 3);
        const a = new THREE.Color(color);
        const snow = new THREE.Color('#eef3fb');
        const c = new THREE.Color();
        for (let i = 0; i < p.count; i++) {
            c.copy(a);
            if (snowFrom != null && p.getY(i) > snowFrom) c.lerp(snow, 0.85);
            col.set([c.r, c.g, c.b], i * 3);
        }
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        return g;
    };
    const trunk = new THREE.CylinderGeometry(0.06, 0.09, 0.5, 5).toNonIndexed();
    trunk.translate(0, 0.25, 0);
    parts.push(paint(trunk, '#4a3428'));
    const layers = [
        [0.55, 0.9, 0.55],
        [0.42, 0.75, 1.0],
        [0.28, 0.6, 1.4]
    ];
    for (const [r, h, y] of layers) {
        const cone = new THREE.ConeGeometry(r, h, 7).toNonIndexed();
        cone.translate(0, y, 0);
        parts.push(paint(cone, '#24423a', y + h * 0.12));
    }
    const g = mergeGeometries(parts);
    g.computeVertexNormals();
    return g;
}

export function createSurvivalProps(state, terrain, fogLayer) {
    const sv = state.survival;
    const f = sv.field;
    const { N, T, kind } = f;
    const group = new THREE.Group();
    const r = rng(1234);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const v = new THREE.Vector3();
    const sc = new THREE.Vector3();

    // 바윗덩이: 절벽칸마다 하나, 바위 능선칸마다 둘, 걸을 수 있는 땅에 닿은 가장자리 칸에 하나
    const rocks = [];
    const nearWalk = (i, j) => {
        for (let dj = -1; dj <= 1; dj++)
            for (let di = -1; di <= 1; di++) {
                const ni = i + di;
                const nj = j + dj;
                if (f.inside(ni, nj) && f.walkableKind(nj * N + ni)) return true;
            }
        return false;
    };
    for (let j = 0; j < N; j++)
        for (let i = 0; i < N; i++) {
            const k = j * N + i;
            const K = kind[k];
            let count = 0;
            let size = 1;
            if (K === KIND.cliff) {
                // 절벽 가장자리는 또렷하게 둔다: 바윗덩이는 드물고 작게 (비탈 양옆 벽에는 없다)
                count = !f.flank[k] && r() < 0.12 ? 1 : 0;
                size = 0.6;
            } else if (K === KIND.rock) {
                count = 2;
                size = 1.25;
            } else if (K === KIND.border && nearWalk(i, j)) {
                count = 1;
                size = 1.4;
            }
            for (let n = 0; n < count; n++) rocks.push({ i, j, size });
        }
    const rockMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true });
    fogLayer.patch(rockMat);
    const rockMesh = new THREE.InstancedMesh(rockGeometry(), rockMat, rocks.length);
    const tint = new THREE.Color();
    rocks.forEach((o, n) => {
        const x = -f.half + (o.i + 0.15 + r() * 0.7) * T;
        const z = -f.half + (o.j + 0.15 + r() * 0.7) * T;
        const s = o.size * (0.7 + r() * 0.8);
        v.set(x, terrain.heightAt(x, z) - 0.15 * s, z);
        e.set(r() * 0.5, r() * Math.PI * 2, r() * 0.5);
        q.setFromEuler(e);
        sc.set(s * (0.9 + r() * 0.5), s * (0.7 + r() * 0.6), s * (0.9 + r() * 0.5));
        m4.compose(v, q, sc);
        rockMesh.setMatrixAt(n, m4);
        tint.setScalar(0.8 + r() * 0.35);
        rockMesh.setColorAt(n, tint);
    });
    rockMesh.castShadow = true;
    rockMesh.receiveShadow = true;
    group.add(rockMesh);

    // 전나무: 가장자리 산맥 비탈과 바위 능선 둘레에 무리 지어
    const pines = [];
    for (let j = 0; j < N; j++)
        for (let i = 0; i < N; i++) {
            const k = j * N + i;
            const K = kind[k];
            const p = K === KIND.border ? 0.55 : K === KIND.rock ? 0.25 : 0;
            if (p && r() < p) pines.push({ i, j });
            if (K === KIND.border && r() < 0.3) pines.push({ i, j });
        }
    const pineMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true });
    fogLayer.patch(pineMat);
    const pineMesh = new THREE.InstancedMesh(pineGeometry(), pineMat, pines.length);
    pines.forEach((o, n) => {
        const x = -f.half + (o.i + r()) * T;
        const z = -f.half + (o.j + r()) * T;
        const s = 1.1 + r() * 1.1;
        v.set(x, terrain.heightAt(x, z) - 0.05, z);
        e.set((r() - 0.5) * 0.12, r() * Math.PI * 2, (r() - 0.5) * 0.12);
        q.setFromEuler(e);
        sc.setScalar(s);
        m4.compose(v, q, sc);
        pineMesh.setMatrixAt(n, m4);
        tint.setScalar(0.75 + r() * 0.4);
        pineMesh.setColorAt(n, tint);
    });
    pineMesh.castShadow = true;
    group.add(pineMesh);

    // 잔돌: 절벽·바위 발치의 빈 땅에 흩어진 작은 돌 (건물이 서면 감춘다)
    const pebbles = [];
    for (let j = 1; j < N - 1; j++)
        for (let i = 1; i < N - 1; i++) {
            const k = j * N + i;
            if (kind[k] !== KIND.ground || f.vein[k] >= 0) continue;
            let near = false;
            for (const [di, dj] of [
                [1, 0],
                [-1, 0],
                [0, 1],
                [0, -1]
            ]) {
                const nk = (j + dj) * N + i + di;
                if (kind[nk] === KIND.cliff || kind[nk] === KIND.rock) near = true;
            }
            const p = near ? 0.2 : f.level[k] === 1 ? 0.02 : 0;
            if (r() < p) pebbles.push(k);
        }
    const pebbleMesh = new THREE.InstancedMesh(rockGeometry(), rockMat, pebbles.length);
    const pebbleMats = pebbles.map((k, n) => {
        const x = -f.half + ((k % N) + 0.15 + r() * 0.7) * T;
        const z = -f.half + (Math.floor(k / N) + 0.15 + r() * 0.7) * T;
        const sz = 0.25 + r() * 0.35;
        v.set(x, terrain.heightAt(x, z) - 0.05, z);
        e.set(r(), r() * Math.PI * 2, r());
        q.setFromEuler(e);
        sc.set(sz * (1 + r()), sz, sz * (1 + r() * 0.6));
        m4.compose(v, q, sc);
        pebbleMesh.setMatrixAt(n, m4);
        tint.setScalar(0.85 + r() * 0.3);
        pebbleMesh.setColorAt(n, tint);
        return m4.clone();
    });
    pebbleMesh.castShadow = true;
    pebbleMesh.receiveShadow = true;
    group.add(pebbleMesh);
    let occVer = -1;

    // 광맥: 2×2마다 금빛 수정 다섯 (광산이 서면 감춘다)
    const PER = 5;
    const crystMat = new THREE.MeshStandardMaterial({
        color: 0xffe6a0,
        emissive: 0xffb43a,
        emissiveIntensity: 0.9,
        roughness: 0.25,
        metalness: 0.1,
        flatShading: true
    });
    fogLayer.patch(crystMat);
    const crystGeo = new THREE.OctahedronGeometry(0.22, 0);
    crystGeo.scale(0.7, 2.2, 0.7);
    const veins = f.veins;
    const crystals = new THREE.InstancedMesh(crystGeo, crystMat, veins.length * PER);
    const veinMats = [];
    veins.forEach((vn, a) => {
        const list = [];
        for (let b = 0; b < PER; b++) {
            const ang = (b / PER) * Math.PI * 2 + r();
            const rad = b === 0 ? 0 : 0.35 + r() * 0.45;
            const x = vn.x + Math.cos(ang) * rad;
            const z = vn.z + Math.sin(ang) * rad;
            const s = b === 0 ? 1.4 : 0.7 + r() * 0.5;
            v.set(x, terrain.heightAt(x, z) + 0.2 * s, z);
            e.set((r() - 0.5) * 0.6, r() * Math.PI, (r() - 0.5) * 0.6);
            q.setFromEuler(e);
            sc.setScalar(s);
            m4.compose(v, q, sc);
            crystals.setMatrixAt(a * PER + b, m4);
            list.push(m4.clone());
        }
        veinMats.push(list);
    });
    crystals.castShadow = true;
    group.add(crystals);
    const hidden = new Set();
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);

    return {
        group,
        update(t) {
            // 건물이 바뀌면 그 칸의 잔돌을 감추거나 되살린다
            if ((sv.buildVer || 0) !== occVer) {
                occVer = sv.buildVer || 0;
                pebbles.forEach((k, n) => pebbleMesh.setMatrixAt(n, sv.occ[k] ? zero : pebbleMats[n]));
                pebbleMesh.instanceMatrix.needsUpdate = true;
            }
            crystMat.emissiveIntensity = 0.8 + Math.sin(t * 2.2) * 0.25;
            // 광산이 선 광맥은 수정을 감춘다 (광산이 무너지면 다시 보인다)
            const taken = new Set();
            for (const tw of state.towers) if (tw.veinId != null) taken.add(tw.veinId);
            let dirty = false;
            veins.forEach((vn, a) => {
                const want = taken.has(a);
                if (want === hidden.has(a)) return;
                dirty = true;
                if (want) hidden.add(a);
                else hidden.delete(a);
                for (let b = 0; b < PER; b++) crystals.setMatrixAt(a * PER + b, want ? zero : veinMats[a][b]);
            });
            if (dirty) crystals.instanceMatrix.needsUpdate = true;
        }
    };
}
