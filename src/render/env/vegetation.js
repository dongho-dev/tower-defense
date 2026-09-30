// 나무·풀·꽃·바위. 인스턴싱으로 수천 개를 한 번에 그리고, 바람은 버텍스 셰이더로 흔든다.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../util/noise.js';

export const windUniforms = { uTime: { value: 0 } };

/** 높이에 비례해 흔들리는 재질 */
function windMaterial(params, strength = 0.05) {
    const m = new THREE.MeshStandardMaterial(params);
    m.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = windUniforms.uTime;
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nuniform float uTime;')
            .replace(
                '#include <begin_vertex>',
                `#include <begin_vertex>
                #ifdef USE_INSTANCING
                vec3 ip = instanceMatrix[3].xyz;
                #else
                vec3 ip = vec3(0.0);
                #endif
                float sway = sin(uTime * 1.6 + ip.x * 0.7 + ip.z * 0.5) + 0.5 * sin(uTime * 2.7 + ip.z);
                transformed.x += sway * ${strength.toFixed(3)} * max(0.0, position.y);
                transformed.z += sway * ${(strength * 0.6).toFixed(3)} * max(0.0, position.y);`
            );
    };
    return m;
}

function paint(geo, bottom, top) {
    const pos = geo.attributes.position;
    geo.computeBoundingBox();
    const { min, max } = geo.boundingBox;
    const cols = [];
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
        const t = (pos.getY(i) - min.y) / (max.y - min.y || 1);
        c.copy(bottom).lerp(top, t);
        cols.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    return geo;
}

function blobFoliage() {
    const parts = [
        [0, 0.95, 0, 0.42],
        [0.22, 0.8, 0.12, 0.3],
        [-0.2, 0.82, -0.08, 0.32],
        [0.02, 1.22, 0.02, 0.3]
    ].map(([x, y, z, r]) => {
        const g = new THREE.IcosahedronGeometry(r, 1);
        g.translate(x, y, z);
        return g;
    });
    const g = mergeGeometries(parts.map((p) => p.toNonIndexed()));
    return paint(g, new THREE.Color(0.55, 0.55, 0.6), new THREE.Color(1.15, 1.12, 1.0));
}

function pineFoliage() {
    const parts = [
        [0.62, 0.46, 0.55],
        [0.95, 0.36, 0.45],
        [1.24, 0.25, 0.38]
    ].map(([y, r, h]) => {
        const g = new THREE.ConeGeometry(r, h, 7, 1);
        g.translate(0, y, 0);
        return g.toNonIndexed();
    });
    return paint(mergeGeometries(parts), new THREE.Color(0.5, 0.55, 0.6), new THREE.Color(1.1, 1.1, 1.0));
}

function trunkGeo(h = 0.75) {
    const g = new THREE.CylinderGeometry(0.05, 0.085, h, 6);
    g.translate(0, h / 2, 0);
    return g;
}

const BROAD_COLORS = ['#4f7d2f', '#5e8a35', '#6f9a3a', '#c98a2e', '#d9a441', '#b8562e', '#8a9a36'];
const PINE_COLORS = ['#2f5a36', '#3a6b3c', '#2c4f3a'];

/** 떠 있는 작은 섬용 단일 나무 */
export function makeTree(rand, veg = null) {
    const g = new THREE.Group();
    const pine = rand() < 0.4;
    const trunk = new THREE.Mesh(
        trunkGeo(pine ? 0.5 : 0.75),
        new THREE.MeshStandardMaterial({ color: 0x5a3e2a, roughness: 0.9 })
    );
    const broadCols = veg?.broad || BROAD_COLORS;
    const pineCols = veg?.pine || PINE_COLORS;
    const col = new THREE.Color(pine ? pineCols[0] : broadCols[Math.floor(rand() * broadCols.length)]);
    const leaves = new THREE.Mesh(
        pine ? pineFoliage() : blobFoliage(),
        new THREE.MeshStandardMaterial({ color: col, vertexColors: true, roughness: 0.85, flatShading: true })
    );
    g.add(trunk, leaves);
    return g;
}

function snowCaps() {
    const parts = [
        [0.745, 0.29, 0.3],
        [1.05, 0.23, 0.25],
        [1.325, 0.16, 0.21]
    ].map(([y, r, h]) => {
        const g = new THREE.ConeGeometry(r, h, 7, 1);
        g.translate(0, y, 0);
        return g.toNonIndexed();
    });
    return mergeGeometries(parts);
}

function deadTree() {
    const parts = [new THREE.CylinderGeometry(0.035, 0.08, 1.1, 5).translate(0, 0.55, 0)];
    for (const [y, rz, ry, len] of [
        [0.6, 0.9, 0, 0.45],
        [0.75, -0.8, 1.8, 0.4],
        [0.9, 0.7, 3.6, 0.35],
        [0.45, -1.0, 4.8, 0.3]
    ]) {
        const b = new THREE.CylinderGeometry(0.012, 0.03, len, 4);
        b.translate(0, len / 2, 0);
        b.rotateZ(rz);
        b.rotateY(ry);
        b.translate(0, y, 0);
        parts.push(b);
    }
    return mergeGeometries(parts.map((p) => p.toNonIndexed()));
}

function crystalCluster() {
    const parts = [
        [0, 0.28, 0, 0.13, 2.4, 0],
        [0.14, 0.16, 0.06, 0.08, 2.0, 0.5],
        [-0.12, 0.14, -0.05, 0.07, 1.8, -0.45],
        [0.02, 0.1, -0.15, 0.06, 1.6, 0.3]
    ].map(([x, y, z, r, sy, tilt]) => {
        const g = new THREE.OctahedronGeometry(r, 0);
        g.scale(1, sy, 1);
        g.rotateZ(tilt);
        g.translate(x, y, z);
        return g.toNonIndexed();
    });
    return mergeGeometries(parts);
}

export function createVegetation(terrain, opts = {}) {
    const veg = opts.theme.veg;
    const rand = mulberry32(777);
    const group = new THREE.Group();
    group.name = 'vegetation';
    const { rx, rz } = opts.island;
    const quality = opts.quality ?? 1;
    const place = (count, accept, tries = count * 12) => {
        const out = [];
        for (let i = 0; i < tries && out.length < count; i++) {
            const x = (rand() * 2 - 1) * rx;
            const z = (rand() * 2 - 1) * rz;
            if (accept(x, z)) out.push([x, z]);
        }
        return out;
    };

    // ---------- 나무 ----------
    const treeSpots = place(veg.trees, (x, z) => {
        if (!terrain.isFree(x, z, 0.9)) return false;
        const e = terrain.ellipseR(x, z);
        const density = 0.18 + 0.82 * Math.max(0, (e - 0.45) / 0.5);
        return rand() < density;
    });
    // 너무 붙은 나무 제거
    const trees = [];
    for (const p of treeSpots) if (!trees.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 0.8)) trees.push(p);
    const broad = trees.filter(() => rand() < veg.broadRatio || veg.dead);
    const pines = trees.filter((t) => !broad.includes(t));
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();

    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3e2a, roughness: 0.9 });
    const leafMat = windMaterial({ vertexColors: true, roughness: 0.82, flatShading: true }, 0.035);
    const makeInstanced = (geo, mat, spots, colors, scaleFn) => {
        const im = new THREE.InstancedMesh(geo, mat, spots.length);
        spots.forEach(([x, z], i) => {
            const s = scaleFn(i);
            dummy.position.set(x, terrain.heightAt(x, z) - 0.02, z);
            dummy.rotation.set(0, rand() * Math.PI * 2, 0);
            dummy.scale.set(s, s * (0.9 + rand() * 0.25), s);
            dummy.updateMatrix();
            im.setMatrixAt(i, dummy.matrix);
            if (colors) {
                col.set(colors[Math.floor(rand() * colors.length)]);
                col.offsetHSL((rand() - 0.5) * 0.02, 0, (rand() - 0.5) * 0.06);
                im.setColorAt(i, col);
            }
        });
        im.castShadow = true;
        im.receiveShadow = true;
        return im;
    };
    const broadScales = broad.map(() => 0.8 + rand() * 0.55);
    const pineScales = pines.map(() => 0.85 + rand() * 0.6);
    // 같은 난수 순서로 줄기와 잎이 맞도록 스케일을 먼저 뽑고, 회전은 같은 행렬을 복사한다
    const broadLeaves = veg.dead
        ? makeInstanced(
              deadTree(),
              new THREE.MeshStandardMaterial({ color: 0x2a2030, roughness: 0.85, flatShading: true }),
              broad,
              null,
              (i) => broadScales[i]
          )
        : makeInstanced(blobFoliage(), leafMat, broad, veg.broad, (i) => broadScales[i]);
    const broadTrunks = new THREE.InstancedMesh(trunkGeo(0.75), trunkMat, veg.dead ? 0 : broad.length);
    const pineLeaves = makeInstanced(pineFoliage(), leafMat, pines, veg.pine, (i) => pineScales[i]);
    const pineTrunks = new THREE.InstancedMesh(trunkGeo(0.5), trunkMat, pines.length);
    const m = new THREE.Matrix4();
    for (let i = 0; i < pines.length; i++) {
        pineLeaves.getMatrixAt(i, m);
        pineTrunks.setMatrixAt(i, m);
    }
    if (veg.snow && pines.length) {
        const caps = new THREE.InstancedMesh(
            snowCaps(),
            windMaterial({ color: 0xf4f8ff, roughness: 0.75, flatShading: true }, 0.035),
            pines.length
        );
        for (let i = 0; i < pines.length; i++) {
            pineLeaves.getMatrixAt(i, m);
            caps.setMatrixAt(i, m);
        }
        caps.castShadow = true;
        group.add(caps);
    }
    if (!veg.dead) {
        for (let i = 0; i < broad.length; i++) {
            broadLeaves.getMatrixAt(i, m);
            broadTrunks.setMatrixAt(i, m);
        }
    }
    broadTrunks.castShadow = pineTrunks.castShadow = true;
    group.add(broadLeaves, broadTrunks, pineLeaves, pineTrunks);

    // ---------- 풀 ----------
    const blades = [];
    for (let i = 0; i < 3; i++) {
        const b = new THREE.PlaneGeometry(0.07, 0.3, 1, 2);
        const pos = b.attributes.position;
        for (let k = 0; k < pos.count; k++) {
            const y = pos.getY(k) + 0.15;
            pos.setY(k, y);
            if (y > 0.25) pos.setX(k, 0);
            pos.setZ(k, pos.getZ(k) + y * y * 0.5);
        }
        b.rotateY((i / 3) * Math.PI);
        b.translate((i - 1) * 0.04, 0, 0);
        blades.push(b.toNonIndexed());
    }
    const tuftGeo = paint(mergeGeometries(blades), new THREE.Color(0.35, 0.4, 0.3), new THREE.Color(0.95, 0.95, 0.8));
    const grassSpots = place(
        Math.round(2100 * quality * veg.grassDensity),
        (x, z) => terrain.pathDist(x, z) > 1.05 && terrain.socketDist(x, z) > 0.95 && terrain.ellipseR(x, z) < 0.985
    );
    const grassMat = windMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }, 0.18);
    const grass = new THREE.InstancedMesh(tuftGeo, grassMat, grassSpots.length);
    const grassCols = veg.grass;
    grassSpots.forEach(([x, z], i) => {
        const s = 0.7 + rand() * 0.9;
        dummy.position.set(x, terrain.heightAt(x, z) - 0.01, z);
        dummy.rotation.set(0, rand() * Math.PI, 0);
        dummy.scale.set(s, s * (0.7 + rand() * 0.8), s);
        dummy.updateMatrix();
        grass.setMatrixAt(i, dummy.matrix);
        grass.setColorAt(i, col.set(grassCols[Math.floor(rand() * grassCols.length)]));
    });
    grass.receiveShadow = true;
    group.add(grass);

    // ---------- 꽃 ----------
    const flowerSpots = [];
    const clusters = place(Math.round(70 * quality), (x, z) => terrain.isFree(x, z, 0.1));
    for (const [cx, cz] of clusters) {
        const n = 4 + Math.floor(rand() * 7);
        for (let i = 0; i < n; i++) flowerSpots.push([cx + (rand() - 0.5) * 0.8, cz + (rand() - 0.5) * 0.8]);
    }
    const flowerGeo = new THREE.IcosahedronGeometry(0.045, 0);
    flowerGeo.translate(0, 0.12, 0);
    const flowers = new THREE.InstancedMesh(flowerGeo, windMaterial({ roughness: 0.6 }, 0.3), flowerSpots.length);
    const flowerCols = veg.flowers;
    flowerSpots.forEach(([x, z], i) => {
        dummy.position.set(x, terrain.heightAt(x, z), z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(0.7 + rand() * 0.6);
        dummy.updateMatrix();
        flowers.setMatrixAt(i, dummy.matrix);
        flowers.setColorAt(i, col.set(flowerCols[Math.floor(rand() * flowerCols.length)]));
    });
    group.add(flowers);

    // ---------- 바위 ----------
    const rockSpots = place(60, (x, z) => terrain.isFree(x, z, 0.3) && rand() < 0.6);
    const rockGeo = new THREE.DodecahedronGeometry(0.22, 0);
    const rocks = new THREE.InstancedMesh(
        rockGeo,
        new THREE.MeshStandardMaterial({ color: veg.rock, roughness: 0.9, flatShading: true }),
        rockSpots.length
    );
    rockSpots.forEach(([x, z], i) => {
        const s = 0.5 + rand() * 1.6;
        dummy.position.set(x, terrain.heightAt(x, z) + 0.05 * s, z);
        dummy.rotation.set(rand() * 3, rand() * 3, rand() * 3);
        dummy.scale.set(s * (0.8 + rand() * 0.5), s * (0.5 + rand() * 0.4), s * (0.8 + rand() * 0.5));
        dummy.updateMatrix();
        rocks.setMatrixAt(i, dummy.matrix);
        rocks.setColorAt(i, col.set('#ffffff').offsetHSL(0, 0, (rand() - 0.5) * 0.2));
    });
    rocks.castShadow = true;
    rocks.receiveShadow = true;
    group.add(rocks);

    // ---------- 수정 군락 (서리·공허) ----------
    if (veg.crystals) {
        const spots = place(veg.crystals.count, (x, z) => terrain.isFree(x, z, 0.2));
        const mat = new THREE.MeshStandardMaterial({
            color: veg.crystals.color,
            emissive: veg.crystals.emissive,
            emissiveIntensity: veg.crystals.intensity ?? 2,
            roughness: 0.15,
            flatShading: true
        });
        const crystals = new THREE.InstancedMesh(crystalCluster(), mat, spots.length);
        spots.forEach(([x, z], i) => {
            const s = 0.7 + rand() * 1.2;
            dummy.position.set(x, terrain.heightAt(x, z) - 0.02, z);
            dummy.rotation.set((rand() - 0.5) * 0.3, rand() * 6, (rand() - 0.5) * 0.3);
            dummy.scale.setScalar(s);
            dummy.updateMatrix();
            crystals.setMatrixAt(i, dummy.matrix);
        });
        crystals.castShadow = true;
        group.add(crystals);
    }

    return { group };
}
