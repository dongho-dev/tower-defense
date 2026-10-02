// 맵 한가운데 적 둥지: 흑요석 가시 고리에 둘러싸인 구덩이와 네 입구.
// 준비 시간에는 잠잠하게 어둡고, 깨어나면 구덩이 속이 보랏빛으로 끓어오른다 (하늘로 솟는 빛은 없다).
import * as THREE from 'three';
import { glowSprite } from '../util/textures.js';

export function createNest(state, terrain) {
    const sv = state.survival;
    const R = sv.nest.r;
    const g = new THREE.Group();
    g.name = 'nest';
    const y0 = terrain.heightAt(0, 0);
    g.position.set(0, y0, 0);
    const obsidian = new THREE.MeshStandardMaterial({
        color: 0x1a1424,
        roughness: 0.35,
        metalness: 0.4,
        flatShading: true,
        emissive: 0x5a1a8a,
        emissiveIntensity: 0.15
    });
    const glowMat = new THREE.MeshStandardMaterial({
        color: 0x2a0a3a,
        emissive: 0x8a2ad0,
        emissiveIntensity: 1.2,
        roughness: 0.6,
        flatShading: true
    });
    // 받침: 깨진 흑요석 단
    const plat = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.95, R * 1.08, 0.5, 11), obsidian);
    plat.position.y = 0.1;
    plat.receiveShadow = plat.castShadow = true;
    g.add(plat);
    // 구덩이 속 끓는 덩어리 (땅 높이에서만 빛난다)
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(R * 0.38, 1), glowMat);
    core.position.y = 0.35;
    core.scale.y = 0.55;
    g.add(core);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(R * 0.48, 0.32, 6, 14), obsidian);
    lip.rotation.x = Math.PI / 2;
    lip.position.y = 0.45;
    lip.castShadow = true;
    g.add(lip);
    // 가시 고리: 바깥으로 휜 흑요석 가시
    const spikeGeo = new THREE.ConeGeometry(0.42, 1, 5);
    spikeGeo.translate(0, 0.5, 0);
    const SPIKES = 14;
    const spikes = new THREE.InstancedMesh(spikeGeo, obsidian, SPIKES * 2);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const v = new THREE.Vector3();
    const s = new THREE.Vector3();
    for (let i = 0; i < SPIKES * 2; i++) {
        const outer = i < SPIKES;
        const a = ((i % SPIKES) / SPIKES) * Math.PI * 2 + (outer ? 0 : Math.PI / SPIKES);
        const r = outer ? R * 0.92 : R * 0.62;
        const h = outer ? 2.6 + ((i * 1.7) % 1.4) : 1.4 + ((i * 1.3) % 0.8);
        v.set(Math.cos(a) * r, 0.2, Math.sin(a) * r);
        e.set(0, -a, 0, 'YXZ');
        // 바깥쪽으로 기울인다
        const tilt = outer ? 0.45 : 0.25;
        e.set(Math.sin(a) * tilt, 0, -Math.cos(a) * tilt);
        q.setFromEuler(e);
        s.set(1, h, 1);
        m4.compose(v, q, s);
        spikes.setMatrixAt(i, m4);
    }
    spikes.castShadow = true;
    g.add(spikes);
    // 네 입구: 기둥 둘과 바닥의 빛 웅덩이
    const pillarGeo = new THREE.CylinderGeometry(0.22, 0.4, 2.4, 5);
    pillarGeo.translate(0, 1.2, 0);
    const gateGlow = [];
    const sprite = glowSprite();
    for (const gt of sv.nest.gates) {
        const a = Math.atan2(gt.z, gt.x);
        const px = -Math.sin(a);
        const pz = Math.cos(a);
        for (const side of [-1, 1]) {
            const p = new THREE.Mesh(pillarGeo, obsidian);
            const x = gt.x * 0.86 + px * side * 1.2;
            const z = gt.z * 0.86 + pz * side * 1.2;
            p.position.set(x, terrain.heightAt(x, z) - y0, z);
            p.rotation.set(px * side * 0.15, 0, -pz * side * 0.15);
            p.castShadow = true;
            g.add(p);
        }
        const pool = new THREE.Mesh(
            new THREE.PlaneGeometry(3.2, 3.2),
            new THREE.MeshBasicMaterial({
                map: sprite,
                color: new THREE.Color('#b040ff'),
                transparent: true,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                opacity: 0.3
            })
        );
        pool.rotation.x = -Math.PI / 2;
        pool.position.set(gt.x, terrain.heightAt(gt.x, gt.z) - y0 + 0.08, gt.z);
        g.add(pool);
        gateGlow.push(pool);
    }
    // 바닥에 번지는 보랏빛 (가로로 누운 빛, 기둥 연출 없음)
    const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(R * 4.2, R * 4.2),
        new THREE.MeshBasicMaterial({
            map: sprite,
            color: new THREE.Color('#7a20c0'),
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            opacity: 0.25
        })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.6;
    g.add(floor);
    const light = new THREE.PointLight(0xb048ff, 6, R * 4, 1.6);
    light.position.y = 1.2;
    g.add(light);
    let wake = 0;
    let flash = 0;

    return {
        group: g,
        /** 웨이브가 나올 때 입구가 번쩍인다 */
        pulse() {
            flash = 1;
        },
        update(t, dt) {
            const sv2 = state.survival;
            const next = state.waves[state.waveIndex];
            // 첫 습격 10초 전부터 깨어난다
            const awake = sv2.started && (state.waveIndex > 0 || (next && sv2.clock > next.at - 10));
            wake += ((awake ? 1 : 0) - wake) * Math.min(1, dt * 0.8);
            flash = Math.max(0, flash - dt * 1.2);
            const p = 0.5 + 0.5 * Math.sin(t * (1.4 + wake * 2.2));
            glowMat.emissiveIntensity = 0.2 + wake * (0.55 + p * 0.5) + flash * 0.8;
            obsidian.emissiveIntensity = 0.05 + wake * 0.25 * p + flash * 0.3;
            light.intensity = 1.5 + wake * (6 + p * 5) + flash * 10;
            core.rotation.y = t * 0.2;
            core.scale.y = 0.5 + 0.08 * p * wake;
            floor.material.opacity = 0.08 + wake * (0.22 + 0.1 * p) + flash * 0.2;
            for (const gg of gateGlow) gg.material.opacity = 0.06 + wake * (0.25 + 0.15 * p) + flash * 0.5;
        }
    };
}
