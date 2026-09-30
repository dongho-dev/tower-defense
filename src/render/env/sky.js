// 노을 하늘, IBL 환경맵, 섬 아래 구름바다, 떠다니는 작은 섬들.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { puffSprite } from '../util/textures.js';
import { mulberry32 } from '../util/noise.js';

export const SUN_AZIMUTH = THREE.MathUtils.degToRad(158); // 서쪽(포털 쪽), 약간 카메라 쪽
export const LIGHT_ELEVATION = THREE.MathUtils.degToRad(25);
const SKY_ELEVATION = THREE.MathUtils.degToRad(3.5);

export function sunDirection(elevation) {
    return new THREE.Vector3(
        Math.cos(elevation) * Math.cos(SUN_AZIMUTH),
        Math.sin(elevation),
        Math.cos(elevation) * Math.sin(SUN_AZIMUTH)
    ).normalize();
}

export function createSky(renderer) {
    const sky = new Sky();
    sky.scale.setScalar(1500);
    const u = sky.material.uniforms;
    u.turbidity.value = 7;
    u.rayleigh.value = 2.2;
    u.mieCoefficient.value = 0.006;
    u.mieDirectionalG.value = 0.86;
    u.sunPosition.value.copy(sunDirection(SKY_ELEVATION));

    // 하늘로 환경맵을 굽는다 (금속 반사·간접광)
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    const envSky = new Sky();
    envSky.scale.setScalar(1500);
    envSky.material.uniforms.turbidity.value = 7;
    envSky.material.uniforms.rayleigh.value = 2.2;
    envSky.material.uniforms.mieCoefficient.value = 0.006;
    envSky.material.uniforms.mieDirectionalG.value = 0.86;
    envSky.material.uniforms.sunPosition.value.copy(sunDirection(THREE.MathUtils.degToRad(12)));
    envScene.add(envSky);
    // 아래쪽 반구를 따뜻한 구름 색으로 채워 바닥 반사가 검게 뜨지 않게 한다
    const floor = new THREE.Mesh(
        new THREE.SphereGeometry(900, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0x8a6a7a, side: THREE.BackSide })
    );
    envScene.add(floor);
    const env = pmrem.fromScene(envScene, 0.02).texture;
    pmrem.dispose();
    return { sky, env };
}

const cloudVert = /* glsl */ `
varying vec3 vWorld;
void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
}`;

const cloudFrag = /* glsl */ `
uniform float uTime;
uniform vec3 uSun;
uniform vec3 uLit;
uniform vec3 uMid;
uniform vec3 uShadow;
uniform vec3 uDeep;
uniform vec3 uHorizon;
varying vec3 vWorld;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
    float s = 0.0, a = 0.5;
    for (int i = 0; i < 6; i++) { s += a * vnoise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
    return s;
}
void main() {
    vec2 p = vWorld.xz * 0.028 + vec2(uTime * 0.006, uTime * 0.002);
    float d = fbm(p);
    float e = 0.02;
    float dx = fbm(p + vec2(e, 0.0)) - d;
    float dz = fbm(p + vec2(0.0, e)) - d;
    vec3 n = normalize(vec3(-dx * 22.0, 1.0, -dz * 22.0));
    float lit = clamp(dot(n, normalize(uSun)) * 0.7 + 0.35, 0.0, 1.0);
    float dens = smoothstep(0.32, 0.78, d);
    vec3 col = mix(uDeep, uShadow, dens);
    col = mix(col, uMid, smoothstep(0.4, 0.8, dens) * lit);
    col = mix(col, uLit, pow(lit, 3.0) * smoothstep(0.55, 0.9, dens));
    // 해 쪽으로 갈수록 밝게
    vec2 toSun = normalize(uSun.xz);
    float sunSide = clamp(dot(normalize(vWorld.xz + 0.001), toSun), 0.0, 1.0);
    col += uLit * 0.18 * sunSide * dens;
    float dist = length(vWorld.xz);
    col = mix(col, uHorizon, smoothstep(60.0, 190.0, dist));
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}`;

export function createCloudSea(sunDir) {
    const mat = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uSun: { value: sunDir.clone() },
            uLit: { value: new THREE.Color('#ffe2b8') },
            uMid: { value: new THREE.Color('#f2a38e') },
            uShadow: { value: new THREE.Color('#a4739c') },
            uDeep: { value: new THREE.Color('#5a4580') },
            uHorizon: { value: new THREE.Color('#f0b490') }
        },
        vertexShader: cloudVert,
        fragmentShader: cloudFrag,
        fog: false
    });
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(600, 600, 1, 1), mat);
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = -13;
    sea.name = 'cloudSea';

    // 섬 둘레의 구름 덩어리 (깊이감)
    const puffs = new THREE.Group();
    const rand = mulberry32(99);
    const tex = [puffSprite(3), puffSprite(8), puffSprite(13)];
    for (let i = 0; i < 70; i++) {
        const a = rand() * Math.PI * 2;
        const r = 17 + rand() * 40;
        const mat2 = new THREE.SpriteMaterial({
            map: tex[i % 3],
            color: new THREE.Color().setHSL(0.02 + rand() * 0.07, 0.65, 0.78 + rand() * 0.12),
            transparent: true,
            opacity: 0.55 + rand() * 0.3,
            depthWrite: false,
            fog: false
        });
        const s = new THREE.Sprite(mat2);
        const size = 14 + rand() * 22;
        s.scale.set(size, size * 0.55, 1);
        s.position.set(Math.cos(a) * r * 1.2, -6 - rand() * 7, Math.sin(a) * r * 0.9);
        s.userData.drift = 0.2 + rand() * 0.4;
        s.userData.base = s.position.clone();
        puffs.add(s);
    }
    return {
        sea,
        puffs,
        update(t) {
            mat.uniforms.uTime.value = t;
            for (const s of puffs.children) {
                s.position.x = s.userData.base.x + Math.sin(t * 0.05 * s.userData.drift + s.userData.base.z) * 2;
            }
        }
    };
}

/** 멀리 떠 있는 작은 섬들 */
export function createIslets(treeFactory) {
    const group = new THREE.Group();
    const rand = mulberry32(2024);
    const rock = new THREE.MeshStandardMaterial({ color: 0x7c6a58, roughness: 0.9, flatShading: true });
    const grass = new THREE.MeshStandardMaterial({ color: 0x6a8a36, roughness: 0.95 });
    const spots = [
        [-30, -4, -15, 2.2],
        [-22, -7, 13, 1.6],
        [30, -5, -14, 2.6],
        [34, -9, 3, 1.6],
        [-6, -9, -21, 1.8],
        [16, -10, 24, 1.5],
        [-33, -11, 2, 3.0]
    ];
    for (const [x, y, z, s] of spots) {
        const g = new THREE.Group();
        const cone = new THREE.Mesh(new THREE.ConeGeometry(1, 2.6, 7, 3), rock);
        cone.rotation.x = Math.PI;
        cone.position.y = -1.3;
        const pos = cone.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            pos.setX(i, pos.getX(i) * (0.85 + rand() * 0.3));
            pos.setZ(i, pos.getZ(i) * (0.85 + rand() * 0.3));
        }
        cone.geometry.computeVertexNormals();
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1, 0.22, 10), grass);
        cap.position.y = 0.05;
        g.add(cone, cap);
        const trees = 1 + Math.floor(rand() * 3);
        for (let i = 0; i < trees; i++) {
            const t = treeFactory(rand);
            t.position.set((rand() - 0.5) * 1.1, 0.14, (rand() - 0.5) * 1.1);
            t.scale.multiplyScalar(0.8);
            g.add(t);
        }
        g.scale.setScalar(s);
        g.position.set(x, y, z);
        g.userData.base = y;
        g.userData.phase = rand() * 6;
        g.traverse((o) => {
            if (o.isMesh) o.castShadow = false;
        });
        group.add(g);
    }
    return {
        group,
        update(t) {
            for (const g of group.children)
                g.position.y = g.userData.base + Math.sin(t * 0.4 + g.userData.phase) * 0.25;
        }
    };
}
