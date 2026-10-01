// 살아남기 건설 격자: 건설 모드일 때 커서 둘레 칸마다 색을 깐다.
// 초록 = 지을 수 있는 빈 땅, 붉은색 = 절벽·바위(통행 불가), 주황 = 비탈(단을 오르내리는 유일한 길),
// 금빛 = 광맥(광산 자리), 회색 = 둥지 곁·건물·예정 자리. 탐험하지 않은 곳은 칠하지 않는다.
// 칸 사이를 조금 띄워 격자선처럼 보이게 하고, 비탈 위 칸은 경사를 따라 기울인다.
import * as THREE from 'three';
import { KIND } from '../../core/snowfield.js';

const R = 11;
const MAX = (2 * R + 1) * (2 * R + 1);
const COL = {
    ok: new THREE.Color('#3fcf7a'),
    cliff: new THREE.Color('#ff4a3a'),
    ramp: new THREE.Color('#ffb040'),
    vein: new THREE.Color('#ffd84a'),
    no: new THREE.Color('#8a90a0')
};

export function createBuildGrid(state, terrain) {
    const sv = state.survival;
    const f = sv.field;
    const T = f.T;
    const geo = new THREE.PlaneGeometry(T * 0.86, T * 0.86);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.26, depthWrite: false });
    const mesh = new THREE.InstancedMesh(geo, mat, MAX);
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.renderOrder = 4;
    mesh.setColorAt(0, COL.ok);
    const group = new THREE.Group();
    group.name = 'survival-build-grid';
    group.add(mesh);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const v = new THREE.Vector3();
    const n = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const one = new THREE.Vector3(1, 1, 1);
    let key = '';

    /** 칸의 종류 색 (null = 칠하지 않음) */
    function colorOf(k) {
        if (!sv.fog.explored[k]) return null;
        const K = f.kind[k];
        if (K === KIND.border) return null;
        if (K === KIND.cliff || K === KIND.rock || K === KIND.nest) return COL.cliff;
        if (sv.occ[k] !== 0 || sv.reserved[k] || f.nobuild[k]) return COL.no;
        if (f.vein[k] >= 0) return COL.vein;
        if (K === KIND.ramp) return COL.ramp;
        return COL.ok;
    }

    return {
        group,
        /** 커서 칸(ci, cj) 둘레를 칠한다. ci가 null이면 감춘다 */
        update(ci, cj) {
            if (ci == null) {
                mesh.count = 0;
                key = '';
                return;
            }
            const k0 = `${ci},${cj},${sv.buildVer},${sv.planVer || 0},${sv.fog.version >> 3}`;
            if (k0 === key) return;
            key = k0;
            let c = 0;
            for (let dj = -R; dj <= R; dj++)
                for (let di = -R; di <= R; di++) {
                    if (di * di + dj * dj > R * R) continue;
                    const i = ci + di;
                    const j = cj + dj;
                    if (!f.inside(i, j)) continue;
                    const k = j * f.N + i;
                    const col = colorOf(k);
                    if (!col) continue;
                    const x = -f.half + (i + 0.5) * T;
                    const z = -f.half + (j + 0.5) * T;
                    const y = f.kind[k] === KIND.ramp ? f.heightAt(x, z) : terrain.heightAt(x, z);
                    // 비탈은 경사를 따라 기울인다
                    if (f.kind[k] === KIND.ramp) {
                        const e = 0.3;
                        const gx = f.heightAt(x + e, z) - f.heightAt(x - e, z);
                        const gz = f.heightAt(x, z + e) - f.heightAt(x, z - e);
                        n.set(-gx, 2 * e, -gz).normalize();
                        q.setFromUnitVectors(up, n);
                    } else q.identity();
                    v.set(x, y + 0.07, z);
                    m4.compose(v, q, one);
                    mesh.setMatrixAt(c, m4);
                    mesh.setColorAt(c, col);
                    c++;
                }
            mesh.count = c;
            mesh.instanceMatrix.needsUpdate = true;
            if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        }
    };
}
