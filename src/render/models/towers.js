// 타워 모델: 종류 × 레벨(1~3) × 분기(A/B). 절차적 조립, 공용 재질.
import * as THREE from 'three';
import { materials, shadowAll, lathe } from './materials.js';

const oct = 8;

function plinth(M, tier) {
    const g = new THREE.Group();
    const base = new THREE.Mesh(
        lathe(
            [
                [0.0, 0],
                [0.52, 0],
                [0.54, 0.05],
                [0.5, 0.16],
                [0.0, 0.16]
            ],
            oct
        ),
        M.stoneDark
    );
    base.rotation.y = Math.PI / oct;
    g.add(base);
    if (tier >= 2) {
        const trim = new THREE.Mesh(new THREE.CylinderGeometry(0.515, 0.515, 0.035, oct), M.gold);
        trim.position.y = 0.13;
        trim.rotation.y = Math.PI / oct;
        g.add(trim);
    }
    return g;
}

function merlons(M, radius, y, count, mat = M.stone, size = 0.12) {
    const g = new THREE.Group();
    for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        const m = new THREE.Mesh(new THREE.BoxGeometry(size, size * 1.1, size * 0.9), mat);
        m.position.set(Math.cos(a) * radius, y + size * 0.55, Math.sin(a) * radius);
        m.rotation.y = -a;
        g.add(m);
    }
    return g;
}

function banner(M, h, color) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.55), M.gold);
    pole.position.y = h + 0.27;
    const mat = M.cloth.clone();
    mat.color.set(color);
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.15), mat);
    cloth.position.set(0.13, h + 0.45, 0);
    g.add(pole, cloth);
    g.userData.cloth = cloth;
    return g;
}

// ---------- 궁수탑 ----------
function ballista(M, len = 0.5, scale = 1) {
    const g = new THREE.Group();
    const stock = new THREE.Mesh(new THREE.BoxGeometry(len, 0.06, 0.08), M.wood);
    stock.position.x = len * 0.25;
    g.add(stock);
    for (const s of [-1, 1]) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.26), M.woodDark);
        arm.position.set(len * 0.55, 0.02, s * 0.12);
        arm.rotation.y = s * 0.45;
        g.add(arm);
    }
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, len * 0.9, 5), M.wood);
    bolt.rotation.z = Math.PI / 2;
    bolt.position.set(len * 0.35, 0.05, 0);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.07, 5), M.gold);
    tip.rotation.z = -Math.PI / 2;
    tip.position.set(len * 0.8, 0.05, 0);
    const mount = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.1, 8), M.iron);
    mount.position.y = -0.06;
    g.add(bolt, tip, mount);
    g.scale.setScalar(scale);
    return g;
}

function ranger(M, tier, branch) {
    const g = new THREE.Group();
    g.add(plinth(M, tier));
    const tall = branch === 'a' ? 1.5 : 0.78 + tier * 0.14;
    const topR = branch === 'b' ? 0.46 : 0.38;
    const body = new THREE.Mesh(
        lathe(
            [
                [0, 0.16],
                [0.44, 0.16],
                [0.38, 0.35],
                [0.33, tall],
                [topR + 0.04, tall + 0.03],
                [topR + 0.04, tall + 0.13],
                [0, tall + 0.13]
            ],
            12
        ),
        M.stone
    );
    g.add(body);
    // 화살 구멍
    for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + 0.4;
        const slit = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.14, 0.02), M.iron);
        slit.position.set(Math.cos(a) * 0.36, tall * 0.62, Math.sin(a) * 0.36);
        slit.rotation.y = -a + Math.PI / 2;
        g.add(slit);
    }
    g.add(merlons(M, topR, tall + 0.13, branch === 'b' ? 10 : 8));
    if (tier >= 3 || branch) {
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.025, 6, 20), M.gold);
        band.rotation.x = Math.PI / 2;
        band.position.y = tall * 0.45;
        g.add(band);
    }
    const turret = new THREE.Group();
    turret.position.y = tall + 0.22;
    g.add(turret);
    let muzzleX = 0.4;
    if (branch === 'b') {
        for (const z of [-0.17, 0, 0.17]) {
            const b = ballista(M, 0.42, 0.9);
            b.position.z = z;
            turret.add(b);
        }
    } else if (branch === 'a') {
        const b = ballista(M, 0.82, 1.05);
        turret.add(b);
        const scope = new THREE.Mesh(new THREE.OctahedronGeometry(0.06), M.goldCrystal);
        scope.position.set(0.2, 0.11, 0);
        scope.scale.set(1.8, 1, 1);
        turret.add(scope);
        muzzleX = 0.8;
    } else {
        turret.add(ballista(M, 0.5 + tier * 0.03));
    }
    const muzzle = new THREE.Object3D();
    muzzle.position.set(muzzleX, 0.05, 0);
    turret.add(muzzle);
    const extras = [];
    if (tier >= 2 || branch) {
        const b = banner(M, tall + 0.13, branch === 'a' ? '#2f4f9a' : '#a3263a');
        b.position.set(-0.3, 0, -0.25);
        g.add(b);
        extras.push(b.userData.cloth);
    }
    return {
        group: g,
        turret,
        muzzle,
        recoil: turret.children[0],
        recoilAxis: 'x',
        cloths: extras,
        height: tall + 0.3
    };
}

// ---------- 화염 박격포 ----------
function ember(M, tier, branch) {
    const g = new THREE.Group();
    g.add(plinth(M, tier));
    const h = 0.42 + tier * 0.06;
    const body = new THREE.Mesh(
        lathe(
            [
                [0, 0.16],
                [0.5, 0.16],
                [0.47, h],
                [0.52, h + 0.03],
                [0.52, h + 0.12],
                [0, h + 0.12]
            ],
            14
        ),
        M.stoneDark
    );
    g.add(body);
    for (const y of [0.26, h - 0.04]) {
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.49, 0.022, 6, 24), M.iron);
        band.rotation.x = Math.PI / 2;
        band.position.y = y;
        g.add(band);
    }
    g.add(merlons(M, 0.46, h + 0.12, 10, M.stoneDark, 0.1));
    // 틈새로 새어 나오는 불빛
    for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + 0.3;
        const vent = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.02), M.emberGlow);
        vent.position.set(Math.cos(a) * 0.48, 0.3, Math.sin(a) * 0.48);
        vent.rotation.y = -a + Math.PI / 2;
        g.add(vent);
    }
    const turret = new THREE.Group();
    turret.position.y = h + 0.14;
    g.add(turret);
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.08, 12), M.iron);
    turret.add(plate);
    const barrels = new THREE.Group();
    barrels.position.y = 0.12;
    barrels.rotation.z = 0.85; // 위로 치켜든 박격포
    turret.add(barrels);
    const addBarrel = (z, rTop, rBot, len, mat) => {
        const b = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, len, 14), mat);
        b.position.set(0, len / 2, z);
        const inner = new THREE.Mesh(new THREE.CircleGeometry(rTop * 0.8, 14), M.fireGlow);
        inner.rotation.x = -Math.PI / 2;
        inner.position.set(0, len + 0.003, z);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(rTop, 0.02, 6, 16), M.gold);
        ring.rotation.x = Math.PI / 2;
        ring.position.set(0, len, z);
        const breech = new THREE.Mesh(new THREE.SphereGeometry(rBot * 1.05, 12, 8), mat);
        breech.position.set(0, 0, z);
        barrels.add(b, inner, ring, breech);
    };
    let muzzleY;
    if (branch === 'a') {
        // 용머리 포
        const head = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.62, 8), M.bronze);
        head.position.y = 0.34;
        barrels.add(head);
        const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.18, 0.26), M.bronze);
        jaw.position.y = 0.05;
        barrels.add(jaw);
        for (const s of [-1, 1]) {
            const horn = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.3, 6), M.gold);
            horn.position.set(-0.12, 0.12, s * 0.12);
            horn.rotation.set(s * 0.5, 0, 1.9);
            const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 5), M.fireGlow);
            eye.position.set(0.08, 0.22, s * 0.09);
            barrels.add(horn, eye);
        }
        const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), M.fireGlow);
        mouth.position.y = 0.62;
        barrels.add(mouth);
        muzzleY = 0.66;
    } else if (branch === 'b') {
        addBarrel(-0.13, 0.12, 0.16, 0.58, M.iron);
        addBarrel(0.13, 0.12, 0.16, 0.58, M.iron);
        muzzleY = 0.6;
    } else {
        addBarrel(0, 0.1 + tier * 0.015, 0.14 + tier * 0.015, 0.42 + tier * 0.04, M.iron);
        muzzleY = 0.46 + tier * 0.04;
    }
    const muzzle = new THREE.Object3D();
    muzzle.position.set(0, muzzleY, 0);
    barrels.add(muzzle);
    return { group: g, turret, muzzle, recoil: barrels, recoilAxis: 'barrel', height: h + 0.8 };
}

// ---------- 서리 첨탑 ----------
function frost(M, tier, branch) {
    const g = new THREE.Group();
    g.add(plinth(M, tier));
    const H = 0.9 + tier * 0.14 + (branch ? 0.15 : 0);
    const body = new THREE.Mesh(
        lathe(
            [
                [0, 0.16],
                [0.4, 0.16],
                [0.3, 0.3],
                [0.2, 0.55],
                [0.16, H],
                [0.27, H + 0.05],
                [0.2, H + 0.12],
                [0.1, H + 0.16],
                [0, H + 0.16]
            ],
            10
        ),
        M.stoneBlue
    );
    g.add(body);
    for (let i = 0; i < Math.min(3, tier + (branch ? 1 : 0)); i++) {
        const ring = new THREE.Mesh(
            new THREE.TorusGeometry(0.2 + i * 0.015, 0.018, 6, 18),
            i === 0 ? M.gold : M.stoneBlue
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.45 + i * 0.22;
        g.add(ring);
    }
    // 발치의 얼음 결정
    for (let i = 0; i < 3 + tier; i++) {
        const a = (i / (3 + tier)) * Math.PI * 2 + 0.7;
        const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.06 + (i % 2) * 0.03), M.iceCrystal);
        c.position.set(Math.cos(a) * 0.38, 0.2, Math.sin(a) * 0.38);
        c.scale.y = 2;
        c.rotation.set(Math.cos(a) * 0.4, 0, Math.sin(a) * 0.4);
        g.add(c);
    }
    const spin = new THREE.Group();
    spin.position.y = H + 0.55;
    g.add(spin);
    let core;
    if (branch === 'b') {
        core = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), M.iceCrystal);
        core.scale.set(0.9, 4.2, 0.9);
        spin.position.y = H + 0.95;
    } else {
        core = new THREE.Mesh(new THREE.OctahedronGeometry(0.17 + tier * 0.02), M.iceCrystal);
        core.scale.y = 1.8;
    }
    spin.add(core);
    const orbit = new THREE.Group();
    spin.add(orbit);
    const n = branch === 'a' ? 6 : tier >= 2 ? tier + 1 : 0;
    for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.06), M.iceCrystal);
        const r = branch === 'a' ? 0.48 : 0.3;
        s.position.set(Math.cos(a) * r, Math.sin(a * 2) * 0.06, Math.sin(a) * r);
        s.scale.y = 1.8;
        orbit.add(s);
    }
    const muzzle = new THREE.Object3D();
    spin.add(muzzle);
    return { group: g, turret: null, muzzle, spin, orbit, bob: spin, height: H + 0.9 };
}

// ---------- 폭풍 오벨리스크 ----------
function storm(M, tier, branch) {
    const g = new THREE.Group();
    g.add(plinth(M, tier));
    const H = 1.0 + tier * 0.16 + (branch === 'a' ? 0.3 : 0);
    const obelisk = new THREE.Mesh(
        lathe(
            [
                [0, 0.16],
                [0.36, 0.16],
                [0.3, 0.28],
                [0.18, H],
                [0.24, H + 0.04],
                [0.12, H + 0.14],
                [0, H + 0.16]
            ],
            4
        ),
        M.stoneStorm
    );
    obelisk.rotation.y = Math.PI / 4;
    g.add(obelisk);
    // 룬 틈새 발광
    for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        const rune = new THREE.Mesh(new THREE.BoxGeometry(0.02, H * 0.45, 0.05), M.stormCrystal);
        const r = 0.21;
        rune.position.set(Math.cos(a) * r, 0.2 + H * 0.35, Math.sin(a) * r);
        rune.rotation.y = -a;
        rune.rotation.z = 0.12;
        g.add(rune);
    }
    const coils = new THREE.Group();
    g.add(coils);
    const coilCount = branch === 'b' ? 0 : tier;
    for (let i = 0; i < coilCount; i++) {
        const c = new THREE.Mesh(new THREE.TorusGeometry(0.28 - i * 0.03, 0.025, 6, 20), M.bronze);
        c.rotation.x = Math.PI / 2;
        c.position.y = 0.45 + i * 0.25;
        coils.add(c);
    }
    const spin = new THREE.Group();
    spin.position.y = H + 0.5;
    g.add(spin);
    const core = new THREE.Mesh(
        new THREE.OctahedronGeometry(branch === 'b' ? 0.3 : 0.18 + tier * 0.02),
        M.stormCrystal
    );
    core.scale.y = 1.6;
    spin.add(core);
    const orbit = new THREE.Group();
    spin.add(orbit);
    if (branch === 'a') {
        for (let i = 0; i < 3; i++) {
            const a = (i / 3) * Math.PI * 2;
            const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.1), M.stormCrystal);
            s.position.set(Math.cos(a) * 0.42, 0, Math.sin(a) * 0.42);
            s.scale.y = 1.6;
            orbit.add(s);
        }
    } else if (branch === 'b') {
        for (const [rx, rz] of [
            [Math.PI / 2, 0],
            [0.6, 0.9]
        ]) {
            const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.03, 6, 32), M.gold);
            ring.rotation.set(rx, 0, rz);
            orbit.add(ring);
        }
    } else {
        for (let i = 0; i < tier + 1; i++) {
            const a = (i / (tier + 1)) * Math.PI * 2;
            const s = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), M.stormCrystal);
            s.position.set(Math.cos(a) * 0.3, Math.sin(a * 3) * 0.05, Math.sin(a) * 0.3);
            orbit.add(s);
        }
    }
    const muzzle = new THREE.Object3D();
    spin.add(muzzle);
    return {
        group: g,
        turret: null,
        muzzle,
        spin,
        orbit,
        bob: spin,
        orbitSpeed: branch === 'a' ? 3 : 1.6,
        height: H + 0.9
    };
}

const BUILDERS = { ranger, ember, frost, storm };

// 종류별 상징색: 룬 고리와 레벨 보석
const TYPE_GLOW = { ranger: 0xffc45a, ember: 0xff6a2a, frost: 0x5cc8ff, storm: 0xa86cff };
const glowCache = new Map();
function typeGlow(type) {
    if (!glowCache.has(type)) {
        glowCache.set(type, {
            rune: new THREE.MeshStandardMaterial({
                color: 0x111111,
                emissive: TYPE_GLOW[type],
                emissiveIntensity: 2.6,
                roughness: 0.4
            }),
            gem: new THREE.MeshStandardMaterial({
                color: 0xffffff,
                emissive: TYPE_GLOW[type],
                emissiveIntensity: 5,
                roughness: 0.15,
                flatShading: true
            })
        });
    }
    return glowCache.get(type);
}

/** 모든 타워 공통 장식: 받침 위 룬 고리, 앞쪽 레벨 보석, 받침 둘레 돌·이끼 */
function decorate(M, g, type, tier, branch, id) {
    const G = typeGlow(type);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.012, 4, 40), G.rune);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.165;
    g.add(ring);
    // 레벨 보석: 카메라 쪽(+z) 받침 둘레에 레벨 수만큼, 분기는 금테 큰 보석 하나 추가
    const n = branch ? 3 : tier;
    for (let i = 0; i < n; i++) {
        const a = Math.PI / 2 + (i - (n - 1) / 2) * 0.32;
        const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.038), G.gem);
        gem.position.set(Math.cos(a) * 0.53, 0.085, Math.sin(a) * 0.53);
        gem.scale.y = 1.4;
        g.add(gem);
    }
    if (branch) {
        const a = Math.PI / 2 + Math.PI;
        const set = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 5, 10), M.gold);
        set.position.set(Math.cos(a) * 0.535, 0.09, Math.sin(a) * 0.535);
        set.rotation.y = -a + Math.PI / 2;
        const big = new THREE.Mesh(new THREE.OctahedronGeometry(0.05), G.gem);
        big.position.copy(set.position);
        g.add(set, big);
    }
    // 받침 둘레 자갈 (타워마다 다르게)
    let r = (id * 2654435761) >>> 0;
    const rnd = () => (r = (r * 1664525 + 1013904223) >>> 0) / 4294967296;
    const pebbles = 3 + Math.floor(rnd() * 3);
    for (let i = 0; i < pebbles; i++) {
        const a = rnd() * Math.PI * 2;
        const p = new THREE.Mesh(new THREE.DodecahedronGeometry(0.035 + rnd() * 0.05), M.stoneDark);
        p.position.set(Math.cos(a) * (0.6 + rnd() * 0.12), 0.02, Math.sin(a) * (0.6 + rnd() * 0.12));
        p.scale.y = 0.6;
        p.rotation.set(rnd() * 3, rnd() * 3, 0);
        g.add(p);
    }
    return ring;
}

export function buildTowerModel(type, tier, branch, id = 1) {
    const M = materials();
    const v = BUILDERS[type](M, tier, branch);
    v.rune = decorate(M, v.group, type, tier, branch, id);
    shadowAll(v.group);
    v.spinBase = v.spin ? v.spin.position.y : 0;
    v.cloths = v.cloths || [];
    return v;
}

/** 매 프레임 애니메이션: 조준·반동·회전·부유 */
export function animateTower(v, tower, t, dt, recoilK) {
    if (v.turret) {
        // 모델의 +x가 포신 방향. 게임 aim은 x-z 평면 각도
        const want = -tower.aim;
        let diff = want - v.turret.rotation.y;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        v.turret.rotation.y += diff * Math.min(1, dt * 12);
    }
    if (v.recoil) {
        if (v.recoilAxis === 'x') v.recoil.position.x = -0.08 * recoilK;
        else v.recoil.scale.set(1 + recoilK * 0.08, 1 - recoilK * 0.12, 1 + recoilK * 0.08);
    }
    if (v.spin) {
        v.spin.rotation.y += dt * (0.8 + recoilK * 6);
        v.spin.position.y = v.spinBase + Math.sin(t * 1.8 + tower.id) * 0.05;
    }
    if (v.orbit) v.orbit.rotation.y += dt * (v.orbitSpeed || 1.2);
    for (const c of v.cloths) c.rotation.y = Math.sin(t * 2.4 + tower.id) * 0.4;
    if (v.rune) v.rune.scale.setScalar(1 + recoilK * 0.05);
}
