// 모델 하나(적·타워)의 '움직이지 않는' 조각을 재질마다 한 메시로 합친다. 처음엔 살아남기 대공세용이었고 지금은 모든 모드의 적에 쓴다.
// 다리·팔·날개·포탑처럼 애니메이션이 움직이는 조각은 그대로 둔다. 적 150마리·타워 수십 개에서 그리기 호출을 크게 줄인다
// (끝없는 밤 200마리에서 적 하나가 메시 17개 → 그리기 호출 6,800번, 프레임 45ms).
// 재질 객체는 그대로 쓰므로 피격 섬광·둔화 색(flashMats)도 그대로 먹는다.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** animateEnemy가 움직이는 조각들 (모델 v의 키) */
export const ENEMY_MOVING = [
    'legs',
    'arms',
    'wings',
    'orb',
    'flicker',
    'flames',
    'rings',
    'petals',
    'cloud',
    'squish',
    'sigil'
];
/** animateTower가 움직이거나 다른 곳(포구 위치)이 찾는 조각들 */
export const TOWER_MOVING = ['turret', 'recoil', 'spin', 'orbit', 'cloths', 'rune', 'halo', 'muzzle'];

const _inv = new THREE.Matrix4();
const _m = new THREE.Matrix4();

/** v.group 아래 정적인 메시를 재질마다 합친다 (keys = 움직이는 조각의 키). 합친 메시 수를 돌려준다 */
export function mergeStaticParts(v, keys = ENEMY_MOVING, castShadow = false) {
    const group = v.group;
    const moving = new Set();
    for (const key of keys) {
        const x = v[key];
        if (!x) continue;
        for (const o of Array.isArray(x) ? x : [x]) if (o?.isObject3D) moving.add(o);
    }
    group.updateMatrixWorld(true);
    _inv.copy(group.matrixWorld).invert();
    const byMat = new Map();
    group.traverse((o) => {
        if (!o.isMesh || o === group || Array.isArray(o.material) || o.children.length) return;
        for (let p = o; p && p !== group; p = p.parent) if (moving.has(p)) return;
        let list = byMat.get(o.material);
        if (!list) byMat.set(o.material, (list = []));
        list.push(o);
    });
    let merged = 0;
    for (const [mat, list] of byMat) {
        if (list.length < 2) continue;
        const useUv = list.every((o) => o.geometry.getAttribute('uv'));
        const geos = list.map((o) => {
            let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
            for (const name of Object.keys(g.attributes))
                if (name !== 'position' && name !== 'normal' && !(useUv && name === 'uv')) g.deleteAttribute(name);
            if (!g.getAttribute('normal')) g.computeVertexNormals();
            g.morphAttributes = {};
            g = g.applyMatrix4(_m.multiplyMatrices(_inv, o.matrixWorld));
            return g;
        });
        const g = mergeGeometries(geos, false);
        for (const x of geos) x.dispose();
        if (!g) continue;
        for (const o of list) {
            o.removeFromParent();
            o.geometry.dispose();
        }
        const mesh = new THREE.Mesh(g, mat);
        mesh.castShadow = castShadow;
        group.add(mesh);
        merged++;
    }
    return merged;
}
