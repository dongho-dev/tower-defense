// 살아남기 건물 보조 렌더: 방벽(인스턴스 메시 하나로 수백 개), 2×2·4×4 건물의 돌 기단, 배치 미리보기 고스트,
// 생존자가 지으러 갈 예정 자리(하늘색 상자), 짓는 중인 건물의 나무 비계.
// 타워·광산 모델 자체는 EntityView가 그리고, 여기서는 그 아래 기단 높이를 알려 준다.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { workerOrders } from '../../core/survival.js';

const MAX_WALLS = 3000;
const MAX_PADS = 400;
const MAX_GHOST = 400;
const MAX_PLAN = 200;
const MAX_SCAFFOLD = 8;

function painted(g, color, snowAbove = null) {
    g = g.index ? g.toNonIndexed() : g;
    const p = g.getAttribute('position');
    const col = new Float32Array(p.count * 3);
    const a = new THREE.Color(color);
    const snow = new THREE.Color('#f2f5fc');
    for (let i = 0; i < p.count; i++) {
        const c = snowAbove != null && p.getY(i) > snowAbove ? snow : a;
        col.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
}

/** 방벽 한 칸: 땅에 깊이 박힌 돌 블록 + 줄눈 띠 + 눈 덮인 윗면 (칸 크기 T 기준) */
function wallGeometry(T) {
    const w = T * 0.9;
    const top = 1.05;
    const bottom = -0.7;
    const parts = [];
    const body = new THREE.BoxGeometry(w, top - bottom, w);
    body.translate(0, (top + bottom) / 2, 0);
    parts.push(painted(body, '#8f877c'));
    for (const y of [0.18, 0.62]) {
        const band = new THREE.BoxGeometry(w * 1.015, 0.06, w * 1.015);
        band.translate(0, y, 0);
        parts.push(painted(band, '#5e5750'));
    }
    const cap = new THREE.BoxGeometry(w * 1.03, 0.12, w * 1.03);
    cap.translate(0, top + 0.03, 0);
    parts.push(painted(cap, '#eef2fa'));
    const g = mergeGeometries(parts);
    g.computeVertexNormals();
    return g;
}

/** 2×2 건물 기단 (위가 평평한 돌단, 땅이 기울어도 묻히게 아래로 길다) */
function padGeometry() {
    const g = new THREE.CylinderGeometry(0.62, 0.7, 1, 8, 1);
    g.rotateY(Math.PI / 8);
    return painted(g, '#8a8278', 0.45);
}

/** 비계: 네 기둥 + 위아래 테두리 + 엇갈린 가새 (1×1×1 상자 크기, 가운데가 원점) */
function scaffoldGeometry() {
    const parts = [];
    const bar = (w, h, d, x, y, z, rz = 0, rx = 0) => {
        const g = new THREE.BoxGeometry(w, h, d);
        g.rotateZ(rz);
        g.rotateX(rx);
        g.translate(x, y, z);
        parts.push(painted(g, '#b08a5a'));
    };
    const t = 0.05;
    for (const sx of [-0.5, 0.5]) for (const sz of [-0.5, 0.5]) bar(t, 1, t, sx, 0, sz);
    for (const y of [-0.45, 0.5])
        for (const s of [-0.5, 0.5]) {
            bar(1, t, t, 0, y, s);
            bar(t, t, 1, s, y, 0);
        }
    for (const s of [-0.5, 0.5]) {
        bar(t, 1.35, t, 0, 0, s, Math.PI / 4);
        bar(t, 1.35, t, s, 0, 0, 0, Math.PI / 4);
    }
    const g = mergeGeometries(parts);
    g.computeVertexNormals();
    return g;
}

const WALL_TINT = [new THREE.Color('#ffffff'), new THREE.Color('#d8e2ee'), new THREE.Color('#aebfe0')];
const HURT = new THREE.Color('#6a3a30');

export function createSurvivalBuildings(state, terrain) {
    const sv = state.survival;
    const f = sv.field;
    const T = f.T;
    const group = new THREE.Group();
    group.name = 'survival-buildings';

    const stone = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true });
    const walls = new THREE.InstancedMesh(wallGeometry(T), stone, MAX_WALLS);
    walls.count = 0;
    walls.castShadow = true;
    walls.receiveShadow = true;
    walls.frustumCulled = false;
    walls.setColorAt(0, WALL_TINT[0]);
    group.add(walls);
    const pads = new THREE.InstancedMesh(padGeometry(), stone, MAX_PADS);
    pads.count = 0;
    pads.castShadow = true;
    pads.receiveShadow = true;
    pads.frustumCulled = false;
    group.add(pads);

    // 배치 고스트: 칸마다 초록/빨강 사각형 + 반투명 덩어리
    const ghostMat = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
        vertexColors: false
    });
    const quadGeo = new THREE.PlaneGeometry(T * 0.9, T * 0.9);
    quadGeo.rotateX(-Math.PI / 2);
    const ghostQuads = new THREE.InstancedMesh(quadGeo, ghostMat, MAX_GHOST);
    ghostQuads.count = 0;
    ghostQuads.frustumCulled = false;
    ghostQuads.renderOrder = 5;
    ghostQuads.setColorAt(0, new THREE.Color());
    const blockMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.2, depthWrite: false });
    const ghostBlocks = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), blockMat, MAX_GHOST);
    ghostBlocks.count = 0;
    ghostBlocks.frustumCulled = false;
    ghostBlocks.renderOrder = 6;
    ghostBlocks.setColorAt(0, new THREE.Color());
    group.add(ghostQuads, ghostBlocks);

    // 생존자가 지으러 갈 예정 자리: 옅은 하늘색 상자
    const planMat = new THREE.MeshBasicMaterial({
        color: 0x7fe0ff,
        transparent: true,
        opacity: 0.22,
        depthWrite: false
    });
    const plans = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), planMat, MAX_PLAN);
    plans.count = 0;
    plans.frustumCulled = false;
    plans.renderOrder = 6;
    group.add(plans);
    // 짓는 중인 건물의 비계
    const wood = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, flatShading: true });
    const scaffolds = new THREE.InstancedMesh(scaffoldGeometry(), wood, MAX_SCAFFOLD);
    scaffolds.count = 0;
    scaffolds.frustumCulled = false;
    scaffolds.castShadow = true;
    group.add(scaffolds);

    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const v = new THREE.Vector3();
    const s = new THREE.Vector3();
    const c = new THREE.Color();
    const GOOD = new THREE.Color('#4dff8a');
    const BAD = new THREE.Color('#ff4a4a');

    /** 2×2 건물의 기단 꼭대기 높이 (네 귀퉁이 중 가장 높은 땅 + 조금) */
    function padTop(x, z, half) {
        let h = -Infinity;
        for (const [a, b] of [
            [-1, -1],
            [1, -1],
            [-1, 1],
            [1, 1],
            [0, 0]
        ])
            h = Math.max(h, terrain.heightAt(x + a * half * 0.8, z + b * half * 0.8));
        return h + 0.18;
    }
    const tops = new Map();

    return {
        group,
        /** 건물(타워·광산)이 설 높이 */
        buildingY(tower) {
            let y = tops.get(tower.id);
            if (y == null) {
                y = padTop(tower.x, tower.z, (tower.cell.s * T) / 2);
                tops.set(tower.id, y);
            }
            return y;
        },
        /** 방벽 체력바 위치 */
        wallTop(tower, out) {
            return out.set(tower.x, terrain.heightAt(tower.x, tower.z) + 1.0, tower.z);
        },
        update() {
            let nw = 0;
            let np = 0;
            const now = state.time;
            for (const t of state.towers) {
                if (!t.cell) continue;
                if (t.type === 'wall') {
                    if (nw >= MAX_WALLS) continue;
                    const y = terrain.heightAt(t.x, t.z);
                    // 맞은 직후 살짝 흔들린다
                    const hit = t.hitT != null && now - t.hitT < 0.15 ? 0.04 : 0;
                    v.set(t.x + (hit ? Math.sin(now * 90) * hit : 0), y, t.z);
                    // 짓는 중이면 다 지은 만큼만 솟아 있다
                    s.set(1, t.build ? Math.max(0.15, t.build.t / t.build.T) : 1, 1);
                    m4.compose(v, q.identity(), s);
                    walls.setMatrixAt(nw, m4);
                    const r = t.hp / t.maxHp;
                    c.copy(WALL_TINT[t.tier - 1] || WALL_TINT[0]).lerp(HURT, Math.max(0, 0.7 - r) * 1.1);
                    walls.setColorAt(nw, c);
                    nw++;
                } else if (np < MAX_PADS) {
                    const half = (t.cell.s * T) / 2;
                    const top = this.buildingY(t);
                    const ground = terrain.heightAt(t.x, t.z);
                    const h = top - ground + 1.2;
                    v.set(t.x, top - h / 2, t.z);
                    s.set(half * 1.45, h, half * 1.45);
                    m4.compose(v, q.identity(), s);
                    pads.setMatrixAt(np++, m4);
                }
            }
            // 본진 기단
            const b = sv.base;
            if (b && np < MAX_PADS) {
                const half = (b.s * T) / 2;
                const top = padTop(b.x, b.z, half) - 0.1;
                const h = top - terrain.heightAt(b.x, b.z) + 1.4;
                v.set(b.x, top - h / 2, b.z);
                s.set(half * 1.4, h, half * 1.4);
                m4.compose(v, q.identity(), s);
                pads.setMatrixAt(np++, m4);
            }
            walls.count = nw;
            pads.count = np;
            // 비계: 짓는 중인 건물 (본진 포함)
            let ns = 0;
            const scaffold = (x, z, size, hgt) => {
                if (ns >= MAX_SCAFFOLD) return;
                const w = size * T * 0.92;
                v.set(x, terrain.heightAt(x, z) + hgt / 2, z);
                m4.compose(v, q.identity(), s.set(w, hgt, w));
                scaffolds.setMatrixAt(ns++, m4);
            };
            for (const t of state.towers)
                if (t.build && t.cell) scaffold(t.x, t.z, t.cell.s, t.type === 'wall' ? 1.1 : 2.2);
            if (b?.build) scaffold(b.x, b.z, b.s, 3.2);
            scaffolds.count = ns;
            scaffolds.instanceMatrix.needsUpdate = true;
            // 예정 자리
            let npl = 0;
            for (const o of workerOrders(sv)) {
                if (o.type !== 'build' || o.started || npl >= MAX_PLAN) continue;
                const c = { x: -f.half + (o.i + o.s / 2) * T, z: -f.half + (o.j + o.s / 2) * T };
                const hgt = o.btype === 'wall' ? 1.0 : o.btype === 'base' ? 2.6 : o.btype === 'mine' ? 1.3 : 1.9;
                const w = o.s * T * (o.btype === 'wall' ? 0.94 : 0.8);
                v.set(c.x, terrain.heightAt(c.x, c.z) + hgt / 2, c.z);
                m4.compose(v, q.identity(), s.set(w, hgt, w));
                plans.setMatrixAt(npl++, m4);
            }
            plans.count = npl;
            plans.instanceMatrix.needsUpdate = true;
            walls.instanceMatrix.needsUpdate = true;
            if (walls.instanceColor) walls.instanceColor.needsUpdate = true;
            pads.instanceMatrix.needsUpdate = true;
            // 사라진 건물의 높이 기록은 지운다
            if (tops.size > state.towers.length + 20) {
                const live = new Set(state.towers.map((t) => t.id));
                for (const id of tops.keys()) if (!live.has(id)) tops.delete(id);
            }
        },
        /** 본진이 설 높이 */
        baseTop() {
            const b = sv.base;
            return b ? padTop(b.x, b.z, (b.s * T) / 2) - 0.1 : 0;
        },
        /**
         * 배치 고스트: items = [{ cells: [{ i, j, ok }], size, type }]. null이면 숨긴다.
         */
        setGhost(items) {
            let nq = 0;
            let nb = 0;
            for (const it of items || []) {
                for (const cell of it.cells) {
                    if (nq >= MAX_GHOST) break;
                    const x = -f.half + (cell.i + 0.5) * T;
                    const z = -f.half + (cell.j + 0.5) * T;
                    v.set(x, terrain.heightAt(x, z) + 0.06, z);
                    m4.compose(v, q.identity(), s.set(1, 1, 1));
                    ghostQuads.setMatrixAt(nq, m4);
                    ghostQuads.setColorAt(nq, cell.ok ? GOOD : BAD);
                    nq++;
                }
                if (nb >= MAX_GHOST || !it.cells.length) continue;
                const i0 = it.cells[0].i;
                const j0 = it.cells[0].j;
                const x = -f.half + (i0 + it.size / 2) * T;
                const z = -f.half + (j0 + it.size / 2) * T;
                const hgt = it.type === 'wall' ? 1.0 : it.type === 'base' ? 2.6 : it.type === 'mine' ? 1.3 : 1.9;
                const w = it.size * T * (it.type === 'wall' ? 0.96 : 0.8);
                v.set(x, terrain.heightAt(x, z) + hgt / 2, z);
                m4.compose(v, q.identity(), s.set(w, hgt, w));
                ghostBlocks.setMatrixAt(nb, m4);
                ghostBlocks.setColorAt(nb, it.cells.every((cl) => cl.ok) ? GOOD : BAD);
                nb++;
            }
            ghostQuads.count = nq;
            ghostBlocks.count = nb;
            ghostQuads.instanceMatrix.needsUpdate = true;
            ghostBlocks.instanceMatrix.needsUpdate = true;
            if (ghostQuads.instanceColor) ghostQuads.instanceColor.needsUpdate = true;
            if (ghostBlocks.instanceColor) ghostBlocks.instanceColor.needsUpdate = true;
        }
    };
}
