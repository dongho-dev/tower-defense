// 아군 유닛 모델: 병영 병사(기본·성기사·검귀)와 영웅. 관절 피벗으로 걷기·휘두르기 애니메이션.
import * as THREE from 'three';
import { materials, shadowAll } from './materials.js';
import { markShared } from '../dispose.js';

let U = null;
function unitMats() {
    if (U) return U;
    const std = (color, roughness = 0.5, metalness = 0.6, extra = {}) =>
        new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
    U = {
        steel: std(0xc4d0e4, 0.42, 0.35),
        steelDark: std(0x6a7488, 0.5, 0.3),
        white: std(0xf4eee0, 0.4, 0.2),
        heroGold: std(0xf2c870, 0.35, 0.45),
        haloGlow: new THREE.MeshStandardMaterial({
            color: 0xfff6dc,
            emissive: 0xffd27a,
            emissiveIntensity: 1.3,
            roughness: 0.3
        }),
        tabardBlue: std(0x2f4f9a, 0.85, 0, { side: THREE.DoubleSide }),
        tabardRed: std(0x9a2630, 0.85, 0, { side: THREE.DoubleSide }),
        cape: std(0xb0283a, 0.8, 0, { side: THREE.DoubleSide }),
        skin: std(0xd8a888, 0.8, 0),
        plume: std(0xf0f4ff, 0.9, 0),
        holy: new THREE.MeshStandardMaterial({
            color: 0xfff6dc,
            emissive: 0xffd27a,
            emissiveIntensity: 3.2,
            roughness: 0.2
        }),
        blade: new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: 0x9fd8ff,
            emissiveIntensity: 1.6,
            roughness: 0.15,
            metalness: 0.9
        })
    };
    return markShared(U);
}

function limb(mat, len, r, pivotY) {
    const pivot = new THREE.Group();
    pivot.position.y = pivotY;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.85, len, 6), mat);
    m.position.y = -len / 2;
    pivot.add(m);
    return pivot;
}

/** 병사: variant = 'base' | 'a'(성기사) | 'b'(검귀) */
function soldier(variant) {
    const M = materials();
    const S = unitMats();
    const g = new THREE.Group();
    const armor = variant === 'a' ? S.white : S.steel;
    const tabard = variant === 'b' ? S.tabardRed : S.tabardBlue;
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.16, 4, 8), armor);
    torso.position.y = 0.48;
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, 0.18, 8, 1, true), tabard);
    skirt.position.y = 0.34;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), armor);
    head.position.y = 0.72;
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.025, 0.1), M.iron);
    visor.position.set(0.08, 0.72, 0);
    g.add(torso, skirt, head, visor);
    if (variant === 'a') {
        const crest = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.02), M.gold);
        crest.position.y = 0.8;
        const emblem = new THREE.Mesh(new THREE.OctahedronGeometry(0.035), S.holy);
        emblem.position.set(0.12, 0.5, 0);
        g.add(crest, emblem);
    } else if (variant === 'b') {
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.086, 0.015, 4, 12), S.tabardRed);
        band.rotation.x = Math.PI / 2;
        band.position.y = 0.74;
        const tail = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.04), S.tabardRed);
        tail.position.set(-0.13, 0.74, 0);
        g.add(band, tail);
    } else {
        const plume = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.12, 5), S.tabardBlue);
        plume.position.y = 0.83;
        g.add(plume);
    }
    const legs = [];
    for (const s of [-1, 1]) {
        const leg = limb(S.steelDark, 0.28, 0.04, 0.3);
        leg.position.z = s * 0.06;
        legs.push(leg);
        g.add(leg);
    }
    // 오른팔(무기), 왼팔(방패 또는 두 번째 검)
    const arm = limb(armor, 0.24, 0.035, 0.6);
    arm.position.z = 0.16;
    const off = limb(armor, 0.22, 0.035, 0.6);
    off.position.z = -0.16;
    g.add(arm, off);
    if (variant === 'b') {
        for (const a of [arm, off]) {
            const sword = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.36, 0.035), S.blade);
            sword.position.set(0.04, -0.4, 0);
            sword.rotation.z = -0.5;
            a.add(sword);
        }
    } else {
        const weapon =
            variant === 'a'
                ? new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.38, 5), M.woodDark)
                : new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.6, 4), M.wood);
        weapon.position.set(0.03, variant === 'a' ? -0.3 : -0.15, 0);
        weapon.rotation.z = -0.35;
        arm.add(weapon);
        const head2 =
            variant === 'a'
                ? new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.07, 0.07), M.gold)
                : new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.08, 4), S.steel);
        head2.position.set(variant === 'a' ? 0.1 : 0.13, variant === 'a' ? -0.47 : -0.42, 0);
        arm.add(head2);
        const shield = new THREE.Mesh(
            new THREE.CylinderGeometry(variant === 'a' ? 0.15 : 0.12, variant === 'a' ? 0.15 : 0.12, 0.025, 6),
            variant === 'a' ? S.white : tabard
        );
        shield.rotation.z = Math.PI / 2;
        shield.position.set(0.08, -0.2, -0.03);
        const rim = new THREE.Mesh(new THREE.TorusGeometry(variant === 'a' ? 0.15 : 0.12, 0.012, 4, 12), M.gold);
        rim.rotation.y = Math.PI / 2;
        rim.position.copy(shield.position);
        rim.position.x += 0.01;
        off.add(shield, rim);
    }
    shadowAll(g, true, false);
    return { group: g, legs, arm, off, scale: variant === 'a' ? 1.12 : 1 };
}

function hero() {
    const M = materials();
    const S = unitMats();
    const g = new THREE.Group();
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.2, 4, 10), S.heroGold);
    torso.position.y = 0.6;
    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.025, 5, 14), M.bronze);
    belt.rotation.x = Math.PI / 2;
    belt.position.y = 0.47;
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.19, 0.22, 10, 1, true), S.tabardBlue);
    skirt.position.y = 0.4;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), S.heroGold);
    head.position.y = 0.92;
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.03, 0.12), S.holy);
    visor.position.set(0.095, 0.92, 0);
    const plume = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.26, 6), S.plume);
    plume.position.set(-0.05, 1.08, 0);
    plume.rotation.z = 0.6;
    g.add(torso, belt, skirt, head, visor, plume);
    for (const s of [-1, 1]) {
        const pauldron = new THREE.Mesh(
            new THREE.SphereGeometry(0.11, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2),
            S.heroGold
        );
        pauldron.position.set(0, 0.76, s * 0.18);
        g.add(pauldron);
    }
    // 망토: 등 뒤로 늘어진 천
    const capeGeo = new THREE.PlaneGeometry(0.42, 0.7, 1, 4);
    const cape = new THREE.Mesh(capeGeo, S.cape);
    cape.position.set(-0.14, 0.5, 0);
    cape.rotation.y = Math.PI / 2;
    g.add(cape);
    const legs = [];
    for (const s of [-1, 1]) {
        const leg = limb(S.steelDark, 0.34, 0.05, 0.36);
        leg.position.z = s * 0.08;
        legs.push(leg);
        g.add(leg);
    }
    const arm = limb(S.heroGold, 0.28, 0.045, 0.74);
    arm.position.z = 0.21;
    const off = limb(S.heroGold, 0.26, 0.045, 0.74);
    off.position.z = -0.21;
    g.add(arm, off);
    const sword = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.62, 0.05), S.holy);
    sword.position.set(0.05, -0.5, 0);
    sword.rotation.z = -0.35;
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.16), M.gold);
    guard.position.set(0.0, -0.2, 0);
    arm.add(sword, guard);
    const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.035, 8), S.tabardBlue);
    shield.rotation.z = Math.PI / 2;
    shield.position.set(0.09, -0.2, -0.03);
    const boss = new THREE.Mesh(new THREE.OctahedronGeometry(0.05), S.holy);
    boss.position.set(0.12, -0.2, -0.03);
    off.add(shield, boss);
    // 머리 위 빛 고리
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.01, 4, 24), S.haloGlow);
    halo.rotation.x = Math.PI / 2;
    halo.position.y = 1.18;
    g.add(halo);
    shadowAll(g, true, false);
    return { group: g, legs, arm, off, cape, halo, scale: 1.25, hero: true };
}

export function buildUnitModel(kind, variant = 'base') {
    const v = kind === 'hero' ? hero() : soldier(variant);
    const root = new THREE.Group();
    root.add(v.group);
    v.group.scale.setScalar(v.scale);
    // 발밑 그림자 원 (아군 표시)
    const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.2, 0.25, 20),
        new THREE.MeshBasicMaterial({
            color: kind === 'hero' ? 0xffd27a : 0x9fc0ff,
            transparent: true,
            opacity: 0.55,
            depthWrite: false
        })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    ring.scale.setScalar(kind === 'hero' ? 1.6 : 1);
    root.add(ring);
    v.ring = ring;
    v.root = root;
    v.phase = Math.random() * 6;
    return v;
}

/** 걷기(이동 중)·공격(atkT)·대기 */
export function animateUnit(v, u, t, dt) {
    const moving = u.moving;
    v.phase += dt * (moving ? 12 : 2);
    const s = Math.sin(v.phase);
    v.legs[0].rotation.z = moving ? s * 0.7 : 0;
    v.legs[1].rotation.z = moving ? -s * 0.7 : 0;
    const swing = u.atkT > 0 ? Math.sin((1 - u.atkT / 0.25) * Math.PI) : 0;
    v.arm.rotation.z = moving ? -s * 0.4 : -swing * 1.6 + 0.1;
    v.off.rotation.z = moving ? s * 0.4 : swing * 0.4;
    v.group.position.y = moving ? Math.abs(s) * 0.03 : Math.sin(t * 2 + u.id) * 0.01;
    // 맞으면 몸이 살짝 움찔
    const hit = u.hitT > 0 ? u.hitT / 0.15 : 0;
    v.group.scale.setScalar(v.scale * (1 - hit * 0.08));
    if (v.cape) v.cape.rotation.z = (moving ? 0.5 : 0.1) + Math.sin(t * 3 + u.id) * 0.08;
    if (v.halo) v.halo.rotation.z += dt * 2;
}
