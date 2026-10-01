// 공용 재질. 한 번 만들어 모든 모델이 공유한다 (적 피격 섬광처럼 개별 상태가 필요한 것만 복제).
import * as THREE from 'three';
import { markShared } from '../dispose.js';

let M = null;

export function materials() {
    if (M) return M;
    const std = (color, roughness = 0.8, metalness = 0, extra = {}) =>
        new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
    const glow = (color, intensity) =>
        new THREE.MeshStandardMaterial({
            color: 0x111111,
            emissive: color,
            emissiveIntensity: intensity,
            roughness: 0.3
        });
    M = {
        stone: std(0xb3a386, 0.82),
        stoneDark: std(0x8e806c, 0.88),
        stoneBlue: std(0x9fb0c2, 0.7),
        stoneStorm: std(0x4a4458, 0.6, 0.1),
        gold: std(0xe8b95c, 0.28, 1),
        bronze: std(0xb0703a, 0.35, 1),
        iron: std(0x2e2b2e, 0.45, 0.7),
        wood: std(0x7a5234, 0.85),
        woodDark: std(0x4e3322, 0.9),
        roofRed: std(0x9a2f2a, 0.7),
        roofBlue: std(0x34528f, 0.7),
        roofPurple: std(0x5b3a8f, 0.65),
        cloth: new THREE.MeshStandardMaterial({ color: 0xa3263a, roughness: 0.85, side: THREE.DoubleSide }),
        fireGlow: glow(0xff6a1a, 6),
        emberGlow: glow(0xff8a3a, 3),
        iceCrystal: new THREE.MeshStandardMaterial({
            color: 0x9fdcff,
            emissive: 0x2fa8ff,
            emissiveIntensity: 1.1,
            roughness: 0.08,
            metalness: 0.1,
            flatShading: true,
            transparent: true,
            opacity: 0.92
        }),
        stormCrystal: new THREE.MeshStandardMaterial({
            color: 0xe0ccff,
            emissive: 0x9a5cff,
            emissiveIntensity: 3.4,
            roughness: 0.1,
            flatShading: true
        }),
        goldCrystal: new THREE.MeshStandardMaterial({
            color: 0xfff0c8,
            emissive: 0xffb84a,
            emissiveIntensity: 3.6,
            roughness: 0.1,
            flatShading: true
        }),
        obsidian: std(0x1b1622, 0.32, 0.25, { flatShading: true }),
        shadowFlesh: std(0x2a2033, 0.6, 0.05),
        voidGlow: glow(0xff3fd0, 6),
        eyeGlow: glow(0xffd24a, 7),
        healGlow: glow(0x6dff9a, 5),
        wraithGlow: glow(0x7dfff0, 6)
    };
    return markShared(M);
}

/** 모든 메시에 그림자 설정 */
export function shadowAll(obj, cast = true, receive = true) {
    obj.traverse((o) => {
        if (o.isMesh) {
            o.castShadow = cast;
            o.receiveShadow = receive;
        }
    });
    return obj;
}

/** 회전체 프로필로 탑 몸통 만들기: pts = [[r, y], ...] */
export function lathe(pts, segments = 12) {
    return new THREE.LatheGeometry(
        pts.map(([r, y]) => new THREE.Vector2(r, y)),
        segments
    );
}
