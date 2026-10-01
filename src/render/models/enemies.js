// 그림자 군세 모델: 흑요석 몸체 + 발광 눈·균열. 관절 피벗으로 절차적 보행 애니메이션.
import * as THREE from 'three';
import { materials, shadowAll } from './materials.js';
import { markShared } from '../dispose.js';

function limb(mat, len, r, pivotY) {
    const pivot = new THREE.Group();
    pivot.position.y = pivotY;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.8, len, 6), mat);
    m.position.y = -len / 2;
    pivot.add(m);
    return pivot;
}

function eyes(M, x, y, spread, size, mat = M.eyeGlow) {
    const g = new THREE.Group();
    for (const s of [-1, 1]) {
        const e = new THREE.Mesh(new THREE.SphereGeometry(size, 6, 5), mat);
        e.position.set(x, y, s * spread);
        g.add(e);
    }
    return g;
}

function grunt(M, body) {
    const g = new THREE.Group();
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.2, 4, 8), body);
    torso.position.y = 0.46;
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11, 0), body);
    head.position.set(0.02, 0.72, 0);
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.12, 5), M.obsidian);
    horn.position.set(-0.02, 0.84, 0);
    const crack = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.18, 0.08), M.voidGlow);
    crack.position.set(0.14, 0.46, 0);
    g.add(torso, head, horn, crack, eyes(M, 0.09, 0.74, 0.045, 0.022));
    const legs = [];
    const arms = [];
    for (const s of [-1, 1]) {
        const leg = limb(body, 0.3, 0.05, 0.32);
        leg.position.z = s * 0.07;
        const arm = limb(body, 0.26, 0.04, 0.58);
        arm.position.z = s * 0.18;
        legs.push(leg);
        arms.push(arm);
        g.add(leg, arm);
    }
    // 뒤집힌 창
    const spear = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.7, 4), M.iron);
    spear.rotation.z = 0.4;
    spear.position.set(0.05, -0.2, 0);
    arms[1].add(spear);
    return { group: g, legs, arms, gait: 9, stride: 0.6, bob: 0.03 };
}

function stalker(M, body) {
    const g = new THREE.Group();
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.34, 4, 8), body);
    torso.rotation.z = Math.PI / 2;
    torso.position.y = 0.34;
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.26, 6), body);
    head.rotation.z = -Math.PI / 2;
    head.position.set(0.34, 0.4, 0);
    for (const s of [-1, 1]) {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.12, 4), M.obsidian);
        ear.position.set(0.26, 0.5, s * 0.05);
        g.add(ear);
    }
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.3, 5), body);
    tail.rotation.z = Math.PI / 2 + 0.5;
    tail.position.set(-0.32, 0.4, 0);
    const spine = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.03), M.voidGlow);
    spine.position.set(0, 0.46, 0);
    g.add(torso, head, tail, spine, eyes(M, 0.36, 0.44, 0.04, 0.018));
    const legs = [];
    for (const [x, s] of [
        [0.16, -1],
        [0.16, 1],
        [-0.16, -1],
        [-0.16, 1]
    ]) {
        const leg = limb(body, 0.24, 0.035, 0.28);
        leg.position.set(x, 0, s * 0.08);
        legs.push(leg);
        g.add(leg);
    }
    return { group: g, legs, arms: [], gait: 16, stride: 0.8, bob: 0.05, quad: true };
}

function ironclad(M, body) {
    const g = new THREE.Group();
    const armor = M.iron;
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.36, 0.44), armor);
    torso.position.y = 0.62;
    const belly = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.1, 4, 8), body);
    belly.position.y = 0.46;
    const helm = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.2, 8), armor);
    helm.position.set(0.02, 0.92, 0);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.03, 0.14), M.voidGlow);
    visor.position.set(0.13, 0.93, 0);
    g.add(torso, belly, helm, visor);
    for (const s of [-1, 1]) {
        const pauldron = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), armor);
        pauldron.position.set(0, 0.78, s * 0.26);
        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.2, 5), M.obsidian);
        horn.position.set(-0.02, 1.04, s * 0.09);
        horn.rotation.x = s * 0.5;
        g.add(pauldron, horn);
    }
    const shield = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.44, 0.3), armor);
    shield.position.set(0.24, 0.55, 0.18);
    const boss = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), M.voidGlow);
    boss.position.set(0.27, 0.58, 0.18);
    g.add(shield, boss);
    const legs = [];
    const arms = [];
    for (const s of [-1, 1]) {
        const leg = limb(armor, 0.36, 0.075, 0.4);
        leg.position.z = s * 0.11;
        legs.push(leg);
        g.add(leg);
    }
    const arm = limb(armor, 0.34, 0.06, 0.74);
    arm.position.z = -0.27;
    const mace = new THREE.Mesh(new THREE.DodecahedronGeometry(0.08), M.obsidian);
    mace.position.y = -0.4;
    arm.add(mace);
    arms.push(arm);
    g.add(arm);
    return { group: g, legs, arms, gait: 5, stride: 0.4, bob: 0.02 };
}

function wraith(M, body) {
    const g = new THREE.Group();
    const cloak = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.8, 9, 3, true), body);
    cloak.position.y = 0.55;
    const pos = cloak.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        if (pos.getY(i) < -0.3) {
            pos.setY(i, pos.getY(i) + Math.sin(i * 2.3) * 0.07);
        }
    }
    cloak.geometry.computeVertexNormals();
    cloak.material = body.clone();
    cloak.material.side = THREE.DoubleSide;
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), body);
    hood.position.set(0, 0.92, 0);
    hood.scale.set(1, 1.15, 1);
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshBasicMaterial({ color: 0x000000 }));
    face.position.set(0.06, 0.9, 0);
    g.add(cloak, hood, face, eyes(M, 0.13, 0.92, 0.035, 0.022, M.wraithGlow));
    const arms = [];
    for (const s of [-1, 1]) {
        const arm = limb(body, 0.3, 0.035, 0.78);
        arm.position.z = s * 0.2;
        arm.rotation.z = -0.9;
        arms.push(arm);
        g.add(arm);
    }
    return { group: g, legs: [], arms, gait: 3, stride: 0.25, bob: 0.08, float: 0.35 };
}

function hexcaller(M, body) {
    const g = new THREE.Group();
    const robe = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.62, 8), body);
    robe.position.y = 0.31;
    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), body);
    chest.position.y = 0.64;
    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.28, 8), body);
    hood.position.set(-0.02, 0.86, 0);
    hood.rotation.z = 0.25;
    const sash = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.02, 5, 14), M.healGlow);
    sash.rotation.x = Math.PI / 2;
    sash.position.y = 0.5;
    g.add(robe, chest, hood, sash, eyes(M, 0.1, 0.78, 0.035, 0.02, M.healGlow));
    const arm = limb(body, 0.24, 0.035, 0.68);
    arm.position.z = 0.17;
    const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.9, 5), M.woodDark);
    staff.position.set(0.02, 0.05, 0);
    const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06, 0), M.healGlow);
    orb.position.set(0.02, 0.52, 0);
    arm.add(staff, orb);
    arm.rotation.z = -0.3;
    g.add(arm);
    return { group: g, legs: [], arms: [], gait: 4, stride: 0.2, bob: 0.03, orb };
}

function colossus(M, body) {
    const g = new THREE.Group();
    const torso = new THREE.Mesh(new THREE.DodecahedronGeometry(0.42, 0), body);
    torso.scale.set(1, 1.2, 1.25);
    torso.position.y = 1.15;
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), M.voidGlow);
    core.position.set(0.34, 1.18, 0);
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 0), body);
    head.position.set(0.18, 1.72, 0);
    g.add(torso, core, head, eyes(M, 0.36, 1.75, 0.08, 0.04, M.voidGlow));
    for (const s of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
            const spike = new THREE.Mesh(new THREE.ConeGeometry(0.07 - i * 0.012, 0.5 - i * 0.1, 5), M.obsidian);
            spike.position.set(-0.1 - i * 0.14, 1.55 + i * 0.05, s * (0.28 + i * 0.05));
            spike.rotation.set(s * 0.6, 0, 0.4 + i * 0.25);
            g.add(spike);
        }
        const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.1), M.voidGlow);
        crystal.position.set(0.1, 1.95, s * 0.14);
        crystal.scale.y = 2.2;
        crystal.rotation.x = s * 0.4;
        g.add(crystal);
    }
    const legs = [];
    const arms = [];
    for (const s of [-1, 1]) {
        const leg = limb(body, 0.75, 0.13, 0.8);
        leg.position.z = s * 0.28;
        legs.push(leg);
        const arm = limb(body, 0.85, 0.11, 1.45);
        arm.position.z = s * 0.58;
        const fist = new THREE.Mesh(new THREE.DodecahedronGeometry(0.17, 0), M.obsidian);
        fist.position.y = -0.9;
        arm.add(fist);
        arms.push(arm);
        g.add(leg, arm);
    }
    return { group: g, legs, arms, gait: 3.2, stride: 0.45, bob: 0.06, heavy: true };
}

// ---------- 맵 전용 군세 ----------
let X = null;
function extraMats() {
    if (X) return X;
    const glow = (color, k) =>
        new THREE.MeshStandardMaterial({ color: 0x111111, emissive: color, emissiveIntensity: k, roughness: 0.3 });
    X = {
        lava: glow(0xff5a10, 4),
        flame: new THREE.MeshStandardMaterial({
            color: 0xffa040,
            emissive: 0xff5a10,
            emissiveIntensity: 2.4,
            roughness: 0.4,
            transparent: true,
            opacity: 0.88,
            flatShading: true
        }),
        ice: new THREE.MeshStandardMaterial({
            color: 0xbfe6ff,
            emissive: 0x2f8fd0,
            emissiveIntensity: 0.9,
            roughness: 0.1,
            metalness: 0.1,
            flatShading: true
        }),
        iceGlow: glow(0x7dd8ff, 4),
        fur: new THREE.MeshStandardMaterial({ color: 0xdfe6ee, roughness: 0.95, flatShading: true }),
        bark: new THREE.MeshStandardMaterial({ color: 0x4a3324, roughness: 0.95, flatShading: true }),
        leaf: new THREE.MeshStandardMaterial({
            color: 0x4f9a4a,
            roughness: 0.8,
            flatShading: true,
            side: THREE.DoubleSide
        }),
        petal: new THREE.MeshStandardMaterial({
            color: 0xffb8e8,
            emissive: 0xff6ac8,
            emissiveIntensity: 0.6,
            roughness: 0.6,
            side: THREE.DoubleSide
        }),
        pollen: glow(0xffe36a, 4),
        dirt: new THREE.MeshStandardMaterial({ color: 0x5a4030, roughness: 1, flatShading: true }),
        storm: glow(0xb890ff, 5),
        cloud: new THREE.MeshStandardMaterial({
            color: 0x5a5470,
            roughness: 0.9,
            transparent: true,
            opacity: 0.85,
            flatShading: true
        }),
        wing: new THREE.MeshStandardMaterial({
            color: 0x3a3450,
            roughness: 0.7,
            side: THREE.DoubleSide,
            flatShading: true
        })
    };
    return markShared(X);
}

/** 거상 골격을 재질만 바꿔 쓰는 보스 변형 */
function giant(M, body, o) {
    const g = new THREE.Group();
    const torso = new THREE.Mesh(new THREE.DodecahedronGeometry(0.42, 0), body);
    torso.scale.set(1, 1.2, 1.25);
    torso.position.y = 1.15;
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), o.glow);
    core.position.set(0.34, 1.18, 0);
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 0), body);
    head.position.set(0.18, 1.72, 0);
    g.add(torso, core, head, eyes(M, 0.36, 1.75, 0.08, 0.04, o.eye || o.glow));
    for (const s of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
            const spike = new THREE.Mesh(new THREE.ConeGeometry(0.07 - i * 0.012, 0.5 - i * 0.1, 5), o.spike);
            spike.position.set(-0.1 - i * 0.14, 1.55 + i * 0.05, s * (0.28 + i * 0.05));
            spike.rotation.set(s * 0.6, 0, 0.4 + i * 0.25);
            g.add(spike);
        }
        const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.1), o.crystal || o.glow);
        crystal.position.set(0.1, 1.95, s * 0.14);
        crystal.scale.y = 2.2;
        crystal.rotation.x = s * 0.4;
        g.add(crystal);
    }
    const legs = [];
    const arms = [];
    for (const s of [-1, 1]) {
        const leg = limb(body, 0.75, 0.13, 0.8);
        leg.position.z = s * 0.28;
        legs.push(leg);
        const arm = limb(body, 0.85, 0.11, 1.45);
        arm.position.z = s * 0.58;
        const fist = new THREE.Mesh(new THREE.DodecahedronGeometry(0.17, 0), o.fist || M.obsidian);
        fist.position.y = -0.9;
        arm.add(fist);
        arms.push(arm);
        g.add(leg, arm);
    }
    if (o.extra) o.extra(g);
    return { group: g, legs, arms, gait: 3.2, stride: 0.45, bob: 0.06, heavy: true };
}

function cinderling(M, body) {
    const X = extraMats();
    const v = grunt(M, body);
    v.group.traverse((o) => {
        if (o.material === M.voidGlow) o.material = X.lava;
    });
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 6), X.flame);
    flame.position.set(0, 0.9, 0);
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), X.lava);
    belly.position.set(0.1, 0.46, 0);
    v.group.add(flame, belly);
    v.flicker = flame;
    v.gait = 11;
    return v;
}

function flameborn(M, body) {
    const X = extraMats();
    const g = new THREE.Group();
    const parts = [];
    for (let i = 0; i < 3; i++) {
        const c = new THREE.Mesh(new THREE.ConeGeometry(0.2 - i * 0.05, 0.42 - i * 0.08, 7), X.flame);
        c.position.y = 0.3 + i * 0.22;
        c.rotation.y = i;
        parts.push(c);
        g.add(c);
    }
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), M.fireGlow);
    core.position.y = 0.45;
    const crown = new THREE.Mesh(new THREE.DodecahedronGeometry(0.11, 0), body);
    crown.position.y = 0.72;
    g.add(core, crown, eyes(M, 0.09, 0.74, 0.04, 0.022, M.eyeGlow));
    const arms = [];
    for (const s of [-1, 1]) {
        const arm = limb(X.flame, 0.24, 0.035, 0.62);
        arm.position.z = s * 0.18;
        arm.rotation.x = s * 0.3;
        arms.push(arm);
        g.add(arm);
    }
    return { group: g, legs: [], arms, gait: 4, stride: 0.3, bob: 0.05, float: 0.12, flames: parts };
}

function magmaLord(M, body) {
    const X = extraMats();
    return giant(M, body, {
        glow: X.lava,
        spike: M.obsidian,
        crystal: M.fireGlow,
        fist: X.lava,
        extra: (g) => {
            for (let i = 0; i < 5; i++) {
                const crack = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.3, 0.06), X.lava);
                crack.position.set(0.3 + (i % 2) * 0.05, 0.95 + i * 0.1, -0.25 + i * 0.12);
                crack.rotation.x = i * 0.7;
                g.add(crack);
            }
        }
    });
}

function rimeguard(M, body) {
    const X = extraMats();
    const v = ironclad(M, body);
    v.iceArmor = true;
    for (const s of [-1, 1]) {
        for (let i = 0; i < 2; i++) {
            const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.06), X.ice);
            c.scale.y = 2.4;
            c.position.set(-0.04 + i * 0.08, 0.92, s * (0.3 + i * 0.03));
            c.rotation.x = s * 0.6;
            v.group.add(c);
        }
    }
    v.group.traverse((o) => {
        if (o.material === M.voidGlow) o.material = X.iceGlow;
    });
    return v;
}

function yeti(M, body) {
    const X = extraMats();
    const g = new THREE.Group();
    const torso = new THREE.Mesh(new THREE.DodecahedronGeometry(0.34, 1), X.fur);
    torso.scale.set(1.1, 1.05, 1.15);
    torso.position.y = 0.72;
    const head = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16, 1), X.fur);
    head.position.set(0.28, 0.98, 0);
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), body);
    face.position.set(0.38, 0.96, 0);
    face.scale.set(0.6, 1, 1.1);
    g.add(torso, head, face, eyes(M, 0.45, 1.0, 0.045, 0.025, M.wraithGlow));
    for (const s of [-1, 1]) {
        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.2, 5), X.ice);
        horn.position.set(0.24, 1.14, s * 0.1);
        horn.rotation.x = s * 0.6;
        g.add(horn);
    }
    const legs = [];
    const arms = [];
    for (const s of [-1, 1]) {
        const leg = limb(X.fur, 0.42, 0.1, 0.46);
        leg.position.z = s * 0.16;
        legs.push(leg);
        const arm = limb(X.fur, 0.56, 0.085, 0.95);
        arm.position.set(0.05, 0, s * 0.38);
        const fist = new THREE.Mesh(new THREE.DodecahedronGeometry(0.11, 0), X.fur);
        fist.position.y = -0.6;
        arm.add(fist);
        arms.push(arm);
        g.add(leg, arm);
    }
    return { group: g, legs, arms, gait: 5, stride: 0.5, bob: 0.06, heavy: true };
}

function glacier(M, body) {
    const X = extraMats();
    return giant(M, body, {
        glow: X.iceGlow,
        spike: X.ice,
        crystal: X.ice,
        fist: X.ice,
        extra: (g) => {
            const cap = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.5, 6), X.ice);
            cap.position.set(-0.05, 1.5, 0);
            cap.rotation.z = 0.3;
            g.add(cap);
        }
    });
}

function shade(M, body) {
    const v = stalker(M, body);
    for (let i = 0; i < 3; i++) {
        const fin = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.22, 4), M.voidGlow);
        fin.position.set(-0.1 + i * 0.12, 0.52, 0);
        fin.rotation.z = 0.5;
        v.group.add(fin);
    }
    const trail = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.5, 6, 1, true), body);
    trail.rotation.z = Math.PI / 2;
    trail.position.set(-0.45, 0.38, 0);
    v.group.add(trail);
    v.gait = 14;
    return v;
}

function blob(M, body, r, glowSeam) {
    const g = new THREE.Group();
    const a = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), body);
    a.position.set(-r * 0.3, r + 0.05, 0);
    a.scale.y = 0.85;
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(r * 0.85, 1), body);
    b.position.set(r * 0.45, r * 0.95, 0);
    b.scale.y = 0.85;
    g.add(a, b);
    if (glowSeam) {
        const seam = new THREE.Mesh(new THREE.TorusGeometry(r * 0.75, 0.02, 4, 16), M.voidGlow);
        seam.rotation.y = Math.PI / 2;
        seam.position.set(r * 0.1, r, 0);
        g.add(seam);
    }
    g.add(eyes(M, r * 1.15, r * 1.1, r * 0.25, r * 0.12, M.voidGlow));
    return g;
}

function splitter(M, body) {
    const g = blob(M, body, 0.24, true);
    return { group: g, legs: [], arms: [], gait: 6, stride: 0, bob: 0.08, squish: g };
}

function mite(M, body) {
    const g = blob(M, body, 0.13, false);
    const legs = [];
    for (const [x, s] of [
        [0.08, -1],
        [0.08, 1],
        [-0.08, -1],
        [-0.08, 1]
    ]) {
        const leg = limb(body, 0.12, 0.018, 0.14);
        leg.position.set(x, 0, s * 0.09);
        legs.push(leg);
        g.add(leg);
    }
    return { group: g, legs, arms: [], gait: 18, stride: 0.8, bob: 0.03, quad: true };
}

function riftlord(M, body) {
    return giant(M, body, {
        glow: M.voidGlow,
        spike: M.obsidian,
        crystal: M.voidGlow,
        extra: (g) => {
            const rift = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.9), M.voidGlow);
            rift.position.set(0.43, 1.2, 0);
            rift.rotation.y = Math.PI / 2;
            g.add(rift);
            for (const s of [-1, 1]) {
                const horn = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.5, 5), M.obsidian);
                horn.position.set(0.12, 1.98, s * 0.2);
                horn.rotation.set(s * 0.7, 0, -0.3);
                g.add(horn);
            }
        }
    });
}

function bloomer(M, body) {
    const X = extraMats();
    const v = hexcaller(M, body);
    const ring = new THREE.Group();
    for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const p = new THREE.Mesh(new THREE.CircleGeometry(0.08, 6), X.petal);
        p.position.set(Math.cos(a) * 0.15, 0, Math.sin(a) * 0.15);
        p.rotation.set(-Math.PI / 2 + 0.5, 0, a);
        ring.add(p);
    }
    ring.position.y = 0.98;
    const bud = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), X.pollen);
    bud.position.y = 0.98;
    v.group.add(ring, bud);
    v.group.traverse((o) => {
        if (o.material === M.healGlow) o.material = X.pollen;
    });
    v.petals = ring;
    return v;
}

function burrower(M, body) {
    const X = extraMats();
    const g = new THREE.Group();
    const torso = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), X.dirt);
    torso.scale.set(1.5, 0.8, 1);
    torso.position.y = 0.26;
    const snout = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.2, 6), body);
    snout.rotation.z = -Math.PI / 2;
    snout.position.set(0.38, 0.26, 0);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), M.voidGlow);
    nose.position.set(0.48, 0.26, 0);
    g.add(torso, snout, nose, eyes(M, 0.3, 0.34, 0.06, 0.02));
    const legs = [];
    for (const [x, s] of [
        [0.18, -1],
        [0.18, 1],
        [-0.16, -1],
        [-0.16, 1]
    ]) {
        const leg = limb(body, 0.14, 0.04, 0.16);
        leg.position.set(x, 0, s * 0.14);
        const claw = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.08, 4), M.obsidian);
        claw.position.y = -0.16;
        claw.rotation.z = -Math.PI / 2;
        leg.add(claw);
        legs.push(leg);
        g.add(leg);
    }
    for (let i = 0; i < 4; i++) {
        const sp = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.12, 4), M.obsidian);
        sp.position.set(-0.15 + i * 0.1, 0.44, 0);
        sp.rotation.z = 0.4;
        g.add(sp);
    }
    return { group: g, legs, arms: [], gait: 12, stride: 0.6, bob: 0.03, quad: true };
}

function thornwood(M, body) {
    const X = extraMats();
    const v = giant(M, X.bark, {
        glow: M.healGlow,
        spike: X.bark,
        crystal: X.leaf,
        fist: X.bark,
        eye: M.healGlow,
        extra: (g) => {
            for (let i = 0; i < 7; i++) {
                const a = (i / 7) * Math.PI * 2;
                const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.34, 4), X.leaf);
                leaf.position.set(Math.cos(a) * 0.32 - 0.05, 2.0 + (i % 2) * 0.12, Math.sin(a) * 0.32);
                leaf.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6);
                g.add(leaf);
            }
            for (let i = 0; i < 4; i++) {
                const flower = new THREE.Mesh(new THREE.CircleGeometry(0.07, 6), X.petal);
                flower.position.set(0.38, 0.9 + i * 0.22, -0.2 + i * 0.13);
                flower.rotation.y = Math.PI / 2;
                g.add(flower);
            }
        }
    });
    void body;
    return v;
}

function sprout(M, body) {
    const X = extraMats();
    const g = new THREE.Group();
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), X.bark);
    bulb.position.y = 0.16;
    bulb.scale.y = 0.9;
    g.add(bulb, eyes(M, 0.1, 0.2, 0.04, 0.018, M.healGlow));
    for (const s of [-1, 1]) {
        const leaf = new THREE.Mesh(new THREE.CircleGeometry(0.1, 5), X.leaf);
        leaf.position.set(0, 0.34, s * 0.06);
        leaf.rotation.set(s * 0.8, 0, 0);
        g.add(leaf);
    }
    const legs = [];
    for (const s of [-1, 1]) {
        const leg = limb(X.bark, 0.1, 0.02, 0.1);
        leg.position.z = s * 0.05;
        legs.push(leg);
        g.add(leg);
    }
    void body;
    return { group: g, legs, arms: [], gait: 16, stride: 0.8, bob: 0.04 };
}

function stormeater(M, body) {
    const X = extraMats();
    const g = new THREE.Group();
    const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 1), body);
    orb.position.y = 0.55;
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.1), X.storm);
    core.position.y = 0.55;
    g.add(orb, core, eyes(M, 0.18, 0.6, 0.06, 0.025, X.storm));
    const rings = [];
    for (let i = 0; i < 2; i++) {
        const r = new THREE.Mesh(new THREE.TorusGeometry(0.32 + i * 0.07, 0.015, 4, 28), X.storm);
        r.position.y = 0.55;
        r.rotation.set(Math.PI / 2 + (i ? 0.5 : -0.4), 0, 0);
        rings.push(r);
        g.add(r);
    }
    for (let i = 0; i < 3; i++) {
        const t = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.3, 4), M.obsidian);
        const a = (i / 3) * Math.PI * 2;
        t.position.set(Math.cos(a) * 0.12, 0.28, Math.sin(a) * 0.12);
        t.rotation.set(Math.sin(a) * 0.5, 0, Math.PI - Math.cos(a) * 0.5);
        g.add(t);
    }
    return { group: g, legs: [], arms: [], gait: 3, stride: 0, bob: 0.05, float: 0.15, rings };
}

function harpy(M, body) {
    const X = extraMats();
    const g = new THREE.Group();
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.18, 4, 8), body);
    torso.rotation.z = Math.PI / 2 - 0.3;
    torso.position.y = 0.6;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), body);
    head.position.set(0.18, 0.72, 0);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.09, 4), M.gold);
    beak.rotation.z = -Math.PI / 2;
    beak.position.set(0.27, 0.71, 0);
    g.add(torso, head, beak, eyes(M, 0.23, 0.75, 0.035, 0.016));
    const wings = [];
    for (const s of [-1, 1]) {
        const pivot = new THREE.Group();
        pivot.position.set(0.02, 0.66, s * 0.06);
        const w = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.5, 2, 1), X.wing);
        w.rotation.x = -Math.PI / 2;
        w.position.z = s * 0.26;
        const p = w.geometry.attributes.position;
        for (let i = 0; i < p.count; i++) if (Math.abs(p.getY(i)) > 0.2) p.setX(i, p.getX(i) - 0.1);
        w.geometry.computeVertexNormals();
        pivot.add(w);
        pivot.userData.side = s;
        wings.push(pivot);
        g.add(pivot);
    }
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.24, 4), X.wing);
    tail.rotation.z = Math.PI / 2 + 0.3;
    tail.position.set(-0.2, 0.52, 0);
    g.add(tail);
    return { group: g, legs: [], arms: [], gait: 3, stride: 0, bob: 0.08, float: 0.5, wings };
}

function tempest(M, body) {
    const X = extraMats();
    const v = giant(M, body, {
        glow: X.storm,
        spike: M.obsidian,
        crystal: M.stormCrystal,
        extra: (g) => {
            const cloud = new THREE.Group();
            for (let i = 0; i < 8; i++) {
                const a = (i / 8) * Math.PI * 2;
                const puff = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16 + (i % 3) * 0.04, 0), X.cloud);
                puff.position.set(Math.cos(a) * 0.62, 0, Math.sin(a) * 0.62);
                cloud.add(puff);
            }
            cloud.position.y = 2.25;
            g.add(cloud);
            g.userData.cloud = cloud;
        }
    });
    v.cloud = v.group.userData.cloud;
    return v;
}

const BUILDERS = {
    grunt,
    stalker,
    ironclad,
    wraith,
    hexcaller,
    colossus,
    cinderling,
    flameborn,
    magmaLord,
    rimeguard,
    yeti,
    glacier,
    shade,
    splitter,
    mite,
    riftlord,
    bloomer,
    burrower,
    thornwood,
    sprout,
    stormeater,
    harpy,
    tempest
};

// 몸 색: 맵 테마에 맞춰 살짝씩 다르게
const BODY = {
    ironclad: 0x241c24,
    wraith: 0x1c2430,
    cinderling: 0x2e1a16,
    flameborn: 0x3a1a10,
    magmaLord: 0x2a1612,
    rimeguard: 0x22303e,
    yeti: 0x3a4a5a,
    glacier: 0x5a7a98,
    shade: 0x160f22,
    splitter: 0x2a1640,
    mite: 0x2a1640,
    riftlord: 0x1a1028,
    bloomer: 0x2a3a24,
    burrower: 0x3a2a20,
    stormeater: 0x2a2440,
    harpy: 0x2a2838,
    tempest: 0x24223a
};

// 종류별 윤곽 빛: 어두운 몸이 땅에 묻히지 않게 가장자리를 은은하게 밝힌다
const RIM = {
    grunt: 0xb07aff,
    stalker: 0xff8a5a,
    ironclad: 0xffb060,
    wraith: 0x5affe0,
    hexcaller: 0x6dff9a,
    colossus: 0xff4fd0,
    cinderling: 0xff7a2a,
    flameborn: 0xffb04a,
    magmaLord: 0xff5a1a,
    rimeguard: 0x7fd8ff,
    yeti: 0xbfefff,
    glacier: 0x8fe3ff,
    shade: 0xd04aff,
    splitter: 0xff6ad8,
    mite: 0xff6ad8,
    riftlord: 0xff3fd0,
    bloomer: 0xffb8e8,
    burrower: 0xffd27a,
    thornwood: 0x6dff9a,
    sprout: 0x9dff7a,
    stormeater: 0xb890ff,
    harpy: 0xe0ccff,
    tempest: 0xa47cff
};

function addRim(mat, color, strength) {
    mat.userData.rim = { value: new THREE.Color(color).multiplyScalar(strength) };
    mat.onBeforeCompile = (sh) => {
        sh.uniforms.uRim = mat.userData.rim;
        sh.fragmentShader = sh.fragmentShader
            .replace('#include <common>', '#include <common>' + String.fromCharCode(10) + 'uniform vec3 uRim;')
            .replace(
                '#include <emissivemap_fragment>',
                `#include <emissivemap_fragment>
                float rimK = 1.0 - abs(dot(normalize(normal), normalize(vViewPosition)));
                totalEmissiveRadiance += uRim * pow(rimK, 2.6);`
            );
    };
    mat.customProgramCacheKey = () => 'rim';
}

export function buildEnemyModel(type, elite) {
    const M = materials();
    // 피격 섬광을 위해 몸체 재질만 개체별로 복제
    const body = M.shadowFlesh.clone();
    if (BODY[type]) body.color.set(BODY[type]);
    addRim(body, elite ? 0xffa040 : RIM[type], elite ? 1.2 : 1.1);
    const v = BUILDERS[type](M, body);
    v.body = body;
    v.flashMats = [body];
    v.group.traverse((o) => {
        if (o.isMesh && o.material === M.iron && (type === 'ironclad' || type === 'rimeguard')) {
            if (!v.ironClone) v.ironClone = M.iron.clone();
            o.material = v.ironClone;
        }
    });
    if (v.ironClone) {
        if (type === 'rimeguard') v.ironClone.color.set(0x8aa8c8);
        v.flashMats.push(v.ironClone);
    }
    if (elite) {
        // 가시 왕관 + 발밑의 주황 룬 고리
        const crown = new THREE.Group();
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.022, 5, 14), M.gold);
        band.rotation.x = Math.PI / 2;
        crown.add(band);
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2;
            const spike = new THREE.Mesh(new THREE.ConeGeometry(0.028, i % 2 ? 0.09 : 0.14, 4), M.gold);
            spike.position.set(Math.cos(a) * 0.15, 0.05, Math.sin(a) * 0.15);
            crown.add(spike);
        }
        const jewel = new THREE.Mesh(new THREE.OctahedronGeometry(0.035), M.eyeGlow);
        jewel.position.set(0, 0.03, 0.16);
        crown.add(jewel);
        crown.position.y = 1.15;
        v.group.add(crown);
        const sigil = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.47, 6), M.emberGlow);
        sigil.rotation.x = -Math.PI / 2;
        sigil.position.y = 0.03;
        v.sigil = sigil;
    }
    shadowAll(v.group, true, false);
    const root = new THREE.Group();
    root.add(v.group);
    if (v.sigil) root.add(v.sigil);
    v.root = root;
    v.phase = Math.random() * 6;
    return v;
}

const _c = new THREE.Color();

export function animateEnemy(v, e, t, dt) {
    const moving = e.stunT <= 0;
    // 성문 앞에 멈춘 적은 제자리에서 문을 두드린다
    const halted = e.gateId != null;
    const speedK = moving ? (halted ? 0.3 : 1 - e.slow * 0.8) : 0;
    v.group.position.x = halted && moving ? Math.max(0, Math.sin(t * 7 + e.id)) * 0.1 : 0;
    v.phase += dt * v.gait * speedK;
    const s = Math.sin(v.phase);
    for (let i = 0; i < v.legs.length; i++) {
        const dir = v.quad ? (i % 2 === 0) === i < 2 : i % 2 === 0;
        v.legs[i].rotation.z = (dir ? s : -s) * v.stride;
    }
    for (let i = 0; i < v.arms.length; i++) v.arms[i].rotation.y = (i % 2 ? s : -s) * v.stride * 0.6;
    v.group.position.y = (v.float || 0) + Math.abs(s) * v.bob + (v.float ? Math.sin(t * 2 + e.id) * 0.06 : 0);
    if (v.orb) v.orb.rotation.y += dt * 3;
    if (v.flicker) v.flicker.scale.set(1, 0.8 + Math.sin(t * 17 + e.id) * 0.25, 1);
    if (v.flames) v.flames.forEach((f, i) => (f.rotation.y += dt * (2 + i)));
    if (v.rings) v.rings.forEach((r, i) => (r.rotation.z += dt * (i ? -2.5 : 3)));
    if (v.wings) for (const w of v.wings) w.rotation.x = w.userData.side * Math.sin(t * 14 + e.id) * 0.6;
    if (v.petals) v.petals.rotation.y += dt * 1.5;
    if (v.cloud) v.cloud.rotation.y += dt * 0.8;
    if (v.squish) v.squish.scale.set(1 + Math.sin(t * 6 + e.id) * 0.06, 1 - Math.sin(t * 6 + e.id) * 0.06, 1);
    if (v.sigil) v.sigil.rotation.z += dt * 1.2;
    // 피격·둔화·빙결 색
    const hit = v.hitT > 0 ? v.hitT / 0.12 : 0;
    for (const m of v.flashMats) {
        if (e.frozenT > 0) m.emissive.set(0x5fb8ff).multiplyScalar(0.8);
        else if (e.slowT > 0) m.emissive.copy(_c.set(0x2a6a9a));
        else m.emissive.setRGB(0, 0, 0);
        if (hit > 0) m.emissive.lerp(_c.setRGB(1, 0.85, 0.8), hit);
    }
    v.hitT = Math.max(0, (v.hitT || 0) - dt);
    if (e.enraged && e.frozenT <= 0 && hit <= 0) for (const m of v.flashMats) m.emissive.set(0x6a1400);
    bossFx(v, e, t, dt);
}

let shieldMat = null;
let wardMat = null;
/** 보스 상태 표시: 얼음 보호막 구체, 바람 장막 고리 */
function bossFx(v, e, t, dt) {
    if (e.def.shield) {
        if (!v.shieldMesh) {
            shieldMat ??= markShared([
                new THREE.MeshBasicMaterial({
                    color: new THREE.Color(0x7fd8ff),
                    transparent: true,
                    opacity: 0.08,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false
                }),
                new THREE.MeshBasicMaterial({
                    color: new THREE.Color(0xbfefff).multiplyScalar(1.8),
                    wireframe: true,
                    transparent: true,
                    opacity: 0.35,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false,
                    toneMapped: false
                })
            ]);
            v.shieldMesh = new THREE.Group();
            const geo = new THREE.IcosahedronGeometry(1.3, 1);
            v.shieldMesh.add(new THREE.Mesh(geo, shieldMat[0]), new THREE.Mesh(geo, shieldMat[1]));
            v.shieldMesh.position.y = 1.15;
            v.root.add(v.shieldMesh);
        }
        const k = e.shieldMax ? e.shield / e.shieldMax : 0;
        v.shieldMesh.visible = k > 0.01;
        v.shieldMesh.scale.setScalar(0.85 + 0.15 * k + Math.sin(t * 3) * 0.01);
        v.shieldMesh.rotation.y += dt * 0.4;
    }
    if (e.def.ward) {
        if (!v.wardMesh) {
            wardMat ??= markShared([
                new THREE.MeshBasicMaterial({
                    color: new THREE.Color(0xc8b0ff).multiplyScalar(2),
                    transparent: true,
                    opacity: 0.55,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false,
                    side: THREE.DoubleSide,
                    toneMapped: false
                })
            ])[0];
            const g = new THREE.Group();
            for (let i = 0; i < 3; i++) {
                const ring = new THREE.Mesh(new THREE.TorusGeometry(1.1 + i * 0.15, 0.025, 4, 40), wardMat);
                ring.rotation.x = Math.PI / 2 + (i - 1) * 0.35;
                ring.position.y = 0.6 + i * 0.5;
                g.add(ring);
            }
            v.wardMesh = g;
            v.root.add(g);
        }
        v.wardMesh.visible = e.wardT > 0;
        v.wardMesh.rotation.y += dt * 5;
    }
}
