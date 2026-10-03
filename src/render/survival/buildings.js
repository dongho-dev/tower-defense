// 살아남기 건물 보조 렌더: 큰 방벽(비탈 폭만큼 긴 벽, 단계마다 나무 방책 → 돌 방벽 → 강화 방벽),
// 2×2·4×4 건물의 돌 기단, 배치 미리보기 고스트, 생존자가 지으러 갈 예정 자리(하늘색 상자), 짓는 중인 건물의 나무 비계.
// 타워·광산 모델 자체는 EntityView가 그리고, 여기서는 그 아래 기단 높이를 알려 준다.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { workerOrders } from '../../core/survival.js';

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

/** 단계별 방벽 높이 (땅 위) */
const WALL_TOP = [1.15, 1.3, 1.5];
const WALL_BOTTOM = -0.9;

/**
 * 큰 방벽: X축으로 len만큼 긴 벽 (두께 d). 바닥은 비탈에 묻히게 깊다. 가운데에 생존자가 드나드는 쪽문.
 * tier 1 = 끝을 깎은 통나무를 줄지어 박은 나무 방책, 2 = 돌 쌓은 벽 + 성가퀴,
 * 3 = 더 높고 어두운 돌벽에 쇠띠·부벽·징을 덧댄 강화 방벽. 윗면에는 눈.
 */
function wallGeometry(len, d, tier) {
    const parts = [];
    const box = (w, h, dd, x, y, z, color, snowAbove = null) => {
        const g = new THREE.BoxGeometry(w, h, dd);
        g.translate(x, y, z);
        parts.push(painted(g, color, snowAbove));
    };
    const top = WALL_TOP[tier - 1] ?? WALL_TOP[0];
    const bot = WALL_BOTTOM;
    if (tier <= 1) {
        // 통나무 말뚝: 높이를 조금씩 달리해 손으로 박은 느낌
        const n = Math.max(6, Math.round(len / 0.26));
        const step = len / n;
        for (let k = 0; k < n; k++) {
            const x = -len / 2 + step * (k + 0.5);
            const h = top - 0.12 + ((k * 37) % 5) * 0.03;
            const log = new THREE.CylinderGeometry(step * 0.48, step * 0.52, h - bot, 6);
            log.translate(x, (h + bot) / 2, 0);
            parts.push(painted(log, k % 2 ? '#7b5a3a' : '#8d6a45'));
            const tip = new THREE.ConeGeometry(step * 0.48, 0.22, 6);
            tip.translate(x, h + 0.11, 0);
            parts.push(painted(tip, '#e9edf5'));
        }
        // 가로 버팀목 두 줄 (앞뒤)
        for (const y of [0.25, 0.8])
            for (const z of [-1, 1]) box(len * 1.01, 0.1, 0.08, 0, y, z * (d * 0.5 + 0.02), '#5c4128');
        // 쪽문: 가운데 판자문
        box(0.62, 0.92, d * 1.08, 0, 0.46, 0, '#4a3422');
    } else {
        const dark = tier >= 3;
        const stone = dark ? '#7a7672' : '#8f877c';
        const band = dark ? '#4a4f58' : '#5e5750';
        const dd = d * (dark ? 1.0 : 0.9);
        box(len, top - bot, dd, 0, (top + bot) / 2, 0, stone);
        // 줄눈 띠
        for (const y of dark ? [0.2, 0.62, 1.04] : [0.22, 0.7]) box(len * 1.005, 0.06, dd * 1.03, 0, y, 0, band);
        // 위 덮개(눈)와 성가퀴
        box(len * 1.02, 0.1, dd * 1.06, 0, top + 0.03, 0, '#eef2fa');
        const n = Math.max(3, Math.round(len / 0.5));
        const step = len / n;
        for (let k = 0; k < n; k++) {
            if (k % 2) continue;
            const x = -len / 2 + step * (k + 0.5);
            box(step * 0.62, 0.15, dd * 0.78, x, top + 0.155, 0, stone);
            box(step * 0.66, 0.035, dd * 0.82, x, top + 0.245, 0, '#eef2fa');
        }
        // 쪽문 (돌벽에 박은 나무문, 강화는 쇠띠를 두른 문)
        box(0.64, 0.95, dd * 1.06, 0, 0.47, 0, dark ? '#3c3a3a' : '#4a3422');
        box(0.8, 0.12, dd * 1.1, 0, 1.0, 0, band);
        if (dark) {
            // 부벽: 양 끝과 사이사이 (앞뒤로 튀어나온 돌기둥)
            const nb = Math.max(2, Math.round(len / 1.3));
            for (let k = 0; k <= nb; k++) {
                const x = -len / 2 + (len * k) / nb;
                if (Math.abs(x) < 0.5) continue;
                for (const z of [-1, 1]) {
                    const zz = z * (dd / 2 + 0.07);
                    box(0.22, top - bot - 0.22, 0.16, x, (top + bot - 0.22) / 2, zz, '#5f5b58');
                    box(0.25, 0.04, 0.19, x, top - 0.2, zz, '#eef2fa');
                }
            }
            // 쇠 징
            for (let k = 0; k < Math.round(len / 0.32); k++) {
                const x = -len / 2 + 0.16 + k * 0.32;
                if (Math.abs(x) < 0.45) continue;
                for (const z of [-1, 1]) box(0.06, 0.06, 0.04, x, 0.83, z * (dd / 2 + 0.02), '#2c3038');
            }
        }
    }
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

const HURT = new THREE.Color('#6a3a30');

export function createSurvivalBuildings(state, terrain) {
    const sv = state.survival;
    const f = sv.field;
    const T = f.T;
    const group = new THREE.Group();
    group.name = 'survival-buildings';

    const stone = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true });
    // 큰 방벽: 방벽마다 메시 하나 (입구 수만큼이라 몇 개 안 된다). 단계가 바뀌면 모델을 바꾼다
    const wallGroup = new THREE.Group();
    wallGroup.name = 'survival-walls';
    group.add(wallGroup);
    const wallViews = new Map();
    const wallLen = (t) => {
        const cw = t.cell.cw ?? t.cell.s;
        const ch = t.cell.ch ?? t.cell.s;
        return { len: Math.max(cw, ch) * T, along: cw >= ch };
    };
    function wallView(t) {
        let v = wallViews.get(t.id);
        if (v && v.tier === t.tier) return v;
        if (v) {
            v.mesh.geometry.dispose();
            v.mesh.removeFromParent();
        }
        const { len, along } = wallLen(t);
        const mat = v?.mesh.material ?? stone.clone();
        const mesh = new THREE.Mesh(wallGeometry(len * 0.995, T * 0.78, t.tier), mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.rotation.y = along ? 0 : Math.PI / 2;
        mesh.userData.towerId = t.id;
        wallGroup.add(mesh);
        v = { mesh, tier: t.tier };
        wallViews.set(t.id, v);
        return v;
    }
    /** 방벽이 설 땅 높이: 벽이 덮은 칸들 가운데 가장 낮은 곳 (비탈에 묻히게) */
    const wallGround = (t) => {
        const { len, along } = wallLen(t);
        let h = Infinity;
        for (const s of [-0.4, 0, 0.4])
            h = Math.min(h, terrain.heightAt(t.x + (along ? s * len : 0), t.z + (along ? 0 : s * len)));
        return h;
    };
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
        /** 방벽 메시들 (고르기용 광선 검사) */
        wallGroup,
        /** 방벽 체력바 위치 */
        wallTop(tower, out) {
            return out.set(tower.x, wallGround(tower) + (WALL_TOP[tower.tier - 1] ?? 1.2) + 0.15, tower.z);
        },
        update() {
            let np = 0;
            const now = state.time;
            const seen = new Set();
            for (const t of state.towers) {
                if (!t.cell) continue;
                if (t.type === 'wall') {
                    seen.add(t.id);
                    const wv = wallView(t);
                    const y = wallGround(t);
                    // 맞은 직후 살짝 흔들린다
                    const hit = t.hitT != null && now - t.hitT < 0.15 ? 0.04 : 0;
                    wv.mesh.position.set(t.x + (hit ? Math.sin(now * 90) * hit : 0), y, t.z);
                    // 짓는 중이면 다 지은 만큼만 솟아 있다 (묻힌 바닥부터)
                    const k = t.build ? Math.max(0.15, t.build.t / t.build.T) : 1;
                    wv.mesh.scale.set(1, k, 1);
                    wv.mesh.position.y = y + WALL_BOTTOM * (1 - k);
                    const r = t.hp / t.maxHp;
                    wv.mesh.material.color.set('#ffffff').lerp(HURT, Math.max(0, 0.7 - r) * 1.1);
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
            // 무너지거나 팔린 방벽
            for (const [id, wv] of wallViews)
                if (!seen.has(id)) {
                    wv.mesh.geometry.dispose();
                    wv.mesh.material.dispose();
                    wv.mesh.removeFromParent();
                    wallViews.delete(id);
                }
            pads.count = np;
            // 비계: 짓는 중인 건물 (본진 포함)
            let ns = 0;
            const scaffold = (x, z, sw, sd, hgt) => {
                if (ns >= MAX_SCAFFOLD) return;
                v.set(x, terrain.heightAt(x, z) + hgt / 2, z);
                m4.compose(v, q.identity(), s.set(sw * T * 0.92, hgt, sd * T * 0.92));
                scaffolds.setMatrixAt(ns++, m4);
            };
            for (const t of state.towers)
                if (t.build && t.cell)
                    scaffold(t.x, t.z, t.cell.cw ?? t.cell.s, t.cell.ch ?? t.cell.s, t.type === 'wall' ? 1.3 : 2.2);
            if (b?.build) scaffold(b.x, b.z, b.s, b.s, 3.2);
            scaffolds.count = ns;
            scaffolds.instanceMatrix.needsUpdate = true;
            // 예정 자리
            let npl = 0;
            for (const o of workerOrders(sv)) {
                if (o.type !== 'build' || o.started || npl >= MAX_PLAN) continue;
                const cw = o.cw ?? o.s;
                const ch = o.ch ?? o.s;
                const c = { x: -f.half + (o.i + cw / 2) * T, z: -f.half + (o.j + ch / 2) * T };
                const hgt = o.btype === 'wall' ? 1.1 : o.btype === 'base' ? 2.6 : o.btype === 'mine' ? 1.3 : 1.9;
                const k = o.btype === 'wall' ? 0.96 : 0.8;
                v.set(c.x, terrain.heightAt(c.x, c.z) + hgt / 2, c.z);
                m4.compose(v, q.identity(), s.set(cw * T * k, hgt, ch * T * k));
                plans.setMatrixAt(npl++, m4);
            }
            plans.count = npl;
            plans.instanceMatrix.needsUpdate = true;
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
         * 배치 고스트: items = [{ cells: [{ i, j, ok }], i, j, cw, ch, type }]. null이면 숨긴다.
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
                const cw = it.cw ?? 1;
                const ch = it.ch ?? 1;
                const x = -f.half + (it.i + cw / 2) * T;
                const z = -f.half + (it.j + ch / 2) * T;
                const hgt = it.type === 'wall' ? 1.15 : it.type === 'base' ? 2.6 : it.type === 'mine' ? 1.3 : 1.9;
                const k = it.type === 'wall' ? 0.98 : 0.8;
                v.set(x, terrain.heightAt(x, z) + hgt / 2, z);
                m4.compose(v, q.identity(), s.set(cw * T * k, hgt, ch * T * k));
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
