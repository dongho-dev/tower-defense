// 그림자 군세 모델: 흑요석 몸체 + 발광 눈·균열. 관절 피벗으로 절차적 보행 애니메이션.
import * as THREE from 'three';
import { materials, shadowAll } from './materials.js';

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

const BUILDERS = { grunt, stalker, ironclad, wraith, hexcaller, colossus };

export function buildEnemyModel(type, elite) {
    const M = materials();
    // 피격 섬광을 위해 몸체 재질만 개체별로 복제
    const body = M.shadowFlesh.clone();
    if (type === 'ironclad') body.color.set(0x241c24);
    if (type === 'wraith') body.color.set(0x1c2430);
    const v = BUILDERS[type](M, body);
    v.body = body;
    v.flashMats = [body];
    v.group.traverse((o) => {
        if (o.isMesh && o.material === M.iron && type === 'ironclad') {
            if (!v.ironClone) v.ironClone = M.iron.clone();
            o.material = v.ironClone;
        }
    });
    if (v.ironClone) v.flashMats.push(v.ironClone);
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
    const speedK = moving ? 1 - e.slow * 0.8 : 0;
    v.phase += dt * v.gait * speedK;
    const s = Math.sin(v.phase);
    for (let i = 0; i < v.legs.length; i++) {
        const dir = v.quad ? (i % 2 === 0) === i < 2 : i % 2 === 0;
        v.legs[i].rotation.z = (dir ? s : -s) * v.stride;
    }
    for (let i = 0; i < v.arms.length; i++) v.arms[i].rotation.y = (i % 2 ? s : -s) * v.stride * 0.6;
    v.group.position.y = (v.float || 0) + Math.abs(s) * v.bob + (v.float ? Math.sin(t * 2 + e.id) * 0.06 : 0);
    if (v.orb) v.orb.rotation.y += dt * 3;
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
}
