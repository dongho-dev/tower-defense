// 살아남기 산 지형의 소품: 산기슭 동굴(적이 나오는 곳)과 광맥 표식.
// 동굴은 바위벽에 박힌 돌 아치와 어두운 입구. 이번(또는 다음) 웨이브가 나올 동굴은 보랏빛으로 타오른다.
// HUD의 웨이브 호출 마커는 portal.group(다음 웨이브의 첫 동굴 위)에 붙는다.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../util/noise.js';
import { glowSprite } from '../util/textures.js';
import { waveCaves } from '../../core/survival.js';

const ACTIVE = new THREE.Color('#c04cff');
const CALM = new THREE.Color('#3a2a5a');

/** 울퉁불퉁한 바위 하나 (꼭짓점을 흔든 정이십면체) */
function boulder(rand, r) {
    const g = new THREE.IcosahedronGeometry(r, 0);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
        const k = 0.78 + rand() * 0.4;
        p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.85, p.getZ(i) * k);
    }
    return g.toNonIndexed();
}

/** 동굴 아치 한 채의 바위 형상 (로컬: +x가 입구 앞, y 위, z 좌우) */
function archGeometry(rand) {
    const parts = [];
    const add = (r, x, y, z, rot) => {
        const g = boulder(rand, r);
        g.rotateX(rot);
        g.rotateY(rand() * 3);
        g.translate(x, y, z);
        parts.push(g);
    };
    // 반원으로 쌓은 돌
    const N = 9;
    for (let i = 0; i < N; i++) {
        const a = (i / (N - 1)) * Math.PI;
        const R = 1.35;
        add(0.42 + rand() * 0.22, -0.1 + (rand() - 0.5) * 0.2, Math.sin(a) * R * 1.15 + 0.1, Math.cos(a) * R, rand());
    }
    // 밑동의 큰 바위와 이마 돌
    add(0.75, 0.05, 0.35, 1.55, 0.3);
    add(0.7, 0.0, 0.3, -1.55, 0.8);
    add(0.62, -0.25, 1.75, 0.15, 1.1);
    // 뒤쪽을 메우는 바위 덩어리 (입구 뒤 어둠을 감싼다)
    add(0.95, -1.0, 0.9, 0.9, 0.4);
    add(0.95, -1.0, 0.9, -0.9, 1.4);
    add(1.0, -1.1, 1.9, 0, 2.1);
    // 입구 앞에 흩어진 돌
    for (let i = 0; i < 5; i++) add(0.12 + rand() * 0.16, 0.6 + rand() * 1.2, 0.05, (rand() - 0.5) * 2.6, rand() * 3);
    return mergeGeometries(parts);
}

export function createCaves(state, terrain, theme) {
    const group = new THREE.Group();
    group.name = 'caves';
    const anchor = new THREE.Group();
    group.add(anchor);
    const sv = state.survival;
    if (!sv) return { group, portal: { group: anchor }, update() {} };
    const rand = mulberry32(91);
    const rock = new THREE.MeshStandardMaterial({
        color: new THREE.Color(theme.cliff.bands[0]).multiplyScalar(0.85),
        roughness: 0.95,
        flatShading: true
    });
    const voidMat = new THREE.MeshBasicMaterial({ color: 0x07040c });
    const glowTex = glowSprite();
    const caves = sv.caves.map((cv) => {
        // 입구는 이어진 비탈길 쪽(맵 안쪽)을 본다
        const ramp = sv.layout.ramps.find((r) => r.a === cv.id || r.b === cv.id);
        const next = ramp.a === cv.id ? ramp.pts[1] : ramp.pts[ramp.pts.length - 2];
        const dx = next[0] - cv.x;
        const dz = next[1] - cv.z;
        const len = Math.hypot(dx, dz) || 1;
        const ux = dx / len;
        const uz = dz / len;
        const g = new THREE.Group();
        g.name = 'cave-' + cv.id;
        const ax = cv.x - ux * 0.95;
        const az = cv.z - uz * 0.95;
        g.position.set(ax, terrain.heightAt(ax, az) - 0.12, az);
        g.rotation.y = -Math.atan2(uz, ux);
        const arch = new THREE.Mesh(archGeometry(rand), rock);
        arch.castShadow = arch.receiveShadow = true;
        g.add(arch);
        // 입구의 어둠 (반원)
        const mouth = new THREE.Mesh(new THREE.CircleGeometry(1.25, 20, 0, Math.PI), voidMat);
        mouth.rotation.y = Math.PI / 2;
        mouth.scale.set(1, 1.2, 1);
        mouth.position.set(-0.35, 0.02, 0);
        g.add(mouth);
        // 입구 바닥의 어둠: 산속으로 꺼져 들어가는 구멍처럼 보이게
        const pit = new THREE.Mesh(
            new THREE.PlaneGeometry(3.2, 2.8),
            new THREE.MeshBasicMaterial({
                map: glowTex,
                color: 0x000000,
                transparent: true,
                opacity: 0.85,
                depthWrite: false
            })
        );
        pit.rotation.x = -Math.PI / 2;
        pit.position.set(-0.15, 0.17, 0);
        g.add(pit);
        // 안쪽에서 새어 나오는 빛
        const glowMat = new THREE.SpriteMaterial({
            map: glowTex,
            color: CALM.clone(),
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            toneMapped: false
        });
        const glow = new THREE.Sprite(glowMat);
        glow.scale.set(3.4, 3.0, 1);
        glow.position.set(0.1, 0.9, 0);
        g.add(glow);
        // 바닥에 번지는 빛
        const floorMat = new THREE.MeshBasicMaterial({
            map: glowTex,
            color: CALM.clone(),
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            toneMapped: false
        });
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 3.2), floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(1.2, 0.2, 0);
        g.add(floor);
        // 어둠 속에서 번뜩이는 눈
        const eyes = new THREE.Group();
        const eyeMat = new THREE.SpriteMaterial({
            map: glowTex,
            color: new THREE.Color('#ff5a7a').multiplyScalar(3),
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            toneMapped: false
        });
        for (let i = 0; i < 3; i++) {
            const y = 0.45 + rand() * 0.7;
            const z = (rand() - 0.5) * 1.4;
            for (const s of [-1, 1]) {
                const e = new THREE.Sprite(eyeMat);
                e.scale.setScalar(0.11);
                e.position.set(-0.3, y, z + s * 0.07);
                eyes.add(e);
            }
        }
        g.add(eyes);
        const light = new THREE.PointLight(0xb040ff, 0, 6, 1.6);
        light.position.set(0.9, 1.0, 0);
        g.add(light);
        group.add(g);
        return { id: cv.id, g, glowMat, floorMat, eyeMat, eyes, light, k: 0, top: new THREE.Vector3(ax, 0, az) };
    });
    anchor.position.set(caves[0].g.position.x, caves[0].g.position.y + 1.2, caves[0].g.position.z);
    let shownWave = null;
    let active = new Set();
    const tmp = new THREE.Color();

    return {
        group,
        portal: { group: anchor },
        update(t, dt) {
            // 카운트다운 중이면 다음 웨이브 동굴이 맥박치고, 몰려나오는 중이면 이번 웨이브 동굴이 타오른다
            const incoming = state.status === 'playing' && state.nextWaveIn != null;
            const wave = incoming ? state.waves[state.waveIndex] : state.waves[state.waveIndex - 1];
            if (wave !== shownWave) {
                shownWave = wave;
                active = new Set(wave ? waveCaves(state, wave) : []);
                const first = caves.find((c) => active.has(c.id)) || caves[0];
                anchor.position.set(first.g.position.x, first.g.position.y + 1.2, first.g.position.z);
            }
            const busy = state.spawners.length > 0;
            for (const c of caves) {
                let want = 0.12;
                if (state.status === 'playing' && active.has(c.id))
                    want = busy && !incoming ? 1 : 0.45 + 0.25 * Math.sin(t * 3);
                c.k += (want - c.k) * Math.min(1, dt * 3);
                tmp.copy(CALM).lerp(ACTIVE, c.k);
                const flick = 0.85 + 0.15 * Math.sin(t * 7 + c.g.position.x);
                c.glowMat.color.copy(tmp).multiplyScalar(0.6 + 2.2 * c.k * flick);
                c.floorMat.color.copy(tmp).multiplyScalar(0.3 + 1.4 * c.k);
                c.light.intensity = 14 * c.k * flick;
                c.eyes.visible = c.k > 0.3 && Math.sin(t * 1.3 + c.g.position.z * 3) > -0.6;
            }
        }
    };
}

/** 광맥: 광산만 지을 수 있는 소켓 둘레의 금빛 수정 무리 */
export function createVeins(state, terrain) {
    const group = new THREE.Group();
    group.name = 'veins';
    const veins = state.sockets.filter((s) => s.vein);
    if (!veins.length) return { group, update() {} };
    const rand = mulberry32(17);
    const shard = new THREE.OctahedronGeometry(0.13, 0);
    shard.scale(0.8, 2.4, 0.8);
    shard.translate(0, 0.2, 0);
    const mat = new THREE.MeshStandardMaterial({
        color: 0xffe2a0,
        emissive: 0xffa22a,
        emissiveIntensity: 1.6,
        roughness: 0.2,
        flatShading: true
    });
    const PER = 9;
    const im = new THREE.InstancedMesh(shard, mat, veins.length * PER);
    const ore = new THREE.InstancedMesh(
        new THREE.DodecahedronGeometry(0.16, 0),
        new THREE.MeshStandardMaterial({ color: 0x6a5a4a, roughness: 0.9, flatShading: true }),
        veins.length * 6
    );
    const d = new THREE.Object3D();
    const glowTex = glowSprite();
    const glows = [];
    veins.forEach((s, vi) => {
        for (let i = 0; i < PER; i++) {
            const a = (i / PER) * Math.PI * 2 + rand() * 0.4;
            const r = 0.8 + rand() * 0.22;
            const x = s.x + Math.cos(a) * r;
            const z = s.z + Math.sin(a) * r;
            d.position.set(x, terrain.heightAt(x, z) - 0.04, z);
            d.rotation.set(
                (rand() - 0.5) * 0.7 + Math.cos(a) * 0.35,
                rand() * 3,
                (rand() - 0.5) * 0.7 + Math.sin(a) * 0.35
            );
            d.scale.setScalar(0.6 + rand() * 0.75);
            d.updateMatrix();
            im.setMatrixAt(vi * PER + i, d.matrix);
        }
        for (let i = 0; i < 6; i++) {
            const a = rand() * Math.PI * 2;
            const r = 0.85 + rand() * 0.35;
            const x = s.x + Math.cos(a) * r;
            const z = s.z + Math.sin(a) * r;
            d.position.set(x, terrain.heightAt(x, z), z);
            d.rotation.set(rand() * 3, rand() * 3, rand() * 3);
            d.scale.set(0.8 + rand(), 0.5 + rand() * 0.4, 0.8 + rand());
            d.updateMatrix();
            ore.setMatrixAt(vi * 6 + i, d.matrix);
        }
        const gm = new THREE.SpriteMaterial({
            map: glowTex,
            color: new THREE.Color('#ffb84a').multiplyScalar(1.2),
            transparent: true,
            opacity: 0.55,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            toneMapped: false
        });
        const sp = new THREE.Sprite(gm);
        sp.scale.setScalar(2.6);
        sp.position.set(s.x, terrain.heightAt(s.x, s.z) + 0.35, s.z);
        group.add(sp);
        glows.push({ gm, s, ph: vi * 1.7 });
    });
    im.castShadow = true;
    ore.castShadow = ore.receiveShadow = true;
    group.add(im, ore);
    return {
        group,
        update(t) {
            // 아직 차지하지 않은 광맥은 더 밝게 맥박친다
            for (const g of glows) {
                const free = g.s.towerId == null;
                g.gm.opacity = free ? 0.45 + 0.25 * Math.sin(t * 2 + g.ph) : 0.22;
            }
        }
    };
}
