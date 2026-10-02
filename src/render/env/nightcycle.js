// 살아남기의 밤 순환: 밤 시계에 따라 하늘·구름바다·안개·조명을 테마 기본색 → 깊은 밤 → 동틀 녘으로 옮긴다.
// 새로 만드는 개체는 없고 기존 재질의 색·세기만 바꾼다 (맵을 바꿀 때 disposeScene이 같이 정리).
import * as THREE from 'three';
import { NIGHT_CYCLE } from '../themes.js';
import { nightPhase } from '../../core/survival.js';

const SKY_KEYS = Object.entries({
    zenith: 'uZenith',
    upper: 'uUpper',
    horizon: 'uHorizon',
    below: 'uBelow',
    sunGlow: 'uSunGlow'
});
const CLOUD_KEYS = Object.entries({ lit: 'uLit', mid: 'uMid', shadow: 'uShadow', deep: 'uDeep', horizon: 'uHorizon' });

function palette(p) {
    const col = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, new THREE.Color(v)]));
    return {
        sky: col(p.sky),
        cloud: col(p.cloud),
        fog: new THREE.Color(p.fog),
        sun: new THREE.Color(p.sun.color),
        sunI: p.sun.intensity,
        hemiSky: new THREE.Color(p.hemi.sky),
        hemiGround: new THREE.Color(p.hemi.ground),
        hemiI: p.hemi.intensity,
        rim: new THREE.Color(p.rim.color),
        rimI: p.rim.intensity,
        env: p.env
    };
}

const lerp = (a, b, t) => a + (b - a) * t;
const mix3 = (out, a, b, c, kb, kc) => out.copy(a).lerp(b, kb).lerp(c, kc);

/**
 * refs: { scene, sky, cloud, sun, hemi, rim, core } — World가 가진 것들.
 * 살아남기가 아닌 맵에서는 아무것도 하지 않는다.
 */
export function createNightCycle(state, theme, refs) {
    if (!state.survival) return { update() {} };
    const base = palette(theme);
    const night = palette(NIGHT_CYCLE.night);
    const dawn = palette(NIGHT_CYCLE.dawn);
    const { scene, sky, cloud, sun, hemi, rim } = refs;
    const skyU = sky.material.uniforms;
    const cloudU = cloud.sea.material.uniforms;
    const puffs = cloud.puffs.children.map((s) => ({ m: s.material, c: s.material.color.clone() }));
    const puffNight = new THREE.Color('#2c3666');
    const puffDawn = new THREE.Color('#ffe0d0');
    const white = new THREE.Color(1, 1, 1);
    const tint = new THREE.Color();
    // 수정 빛은 밤이 깊을수록 또렷하게
    let coreLight = null;
    refs.core.group.traverse((o) => {
        if (o.isPointLight && !coreLight) coreLight = o;
    });
    const coreBase = coreLight ? coreLight.intensity : 0;
    const fog = scene.fog;
    const fogNear = fog.near;
    const fogFar = fog.far;
    let kn = -1;
    let kd = -1;

    function apply(n, d) {
        for (const [k, u] of SKY_KEYS) mix3(skyU[u].value, base.sky[k], night.sky[k], dawn.sky[k], n, d);
        for (const [k, u] of CLOUD_KEYS) mix3(cloudU[u].value, base.cloud[k], night.cloud[k], dawn.cloud[k], n, d);
        mix3(fog.color, base.fog, night.fog, dawn.fog, n, d);
        fog.near = lerp(lerp(fogNear, 34, n), fogNear, d);
        fog.far = lerp(lerp(fogFar, 105, n), fogFar, d);
        mix3(sun.color, base.sun, night.sun, dawn.sun, n, d);
        sun.intensity = lerp(lerp(base.sunI, night.sunI, n), dawn.sunI, d);
        mix3(hemi.color, base.hemiSky, night.hemiSky, dawn.hemiSky, n, d);
        mix3(hemi.groundColor, base.hemiGround, night.hemiGround, dawn.hemiGround, n, d);
        hemi.intensity = lerp(lerp(base.hemiI, night.hemiI, n), dawn.hemiI, d);
        mix3(rim.color, base.rim, night.rim, dawn.rim, n, d);
        rim.intensity = lerp(lerp(base.rimI, night.rimI, n), dawn.rimI, d);
        scene.environmentIntensity = lerp(lerp(base.env, night.env, n), dawn.env, d);
        tint.copy(white).lerp(puffNight, n).lerp(puffDawn, d);
        for (const p of puffs) p.m.color.copy(p.c).multiply(tint);
        if (coreLight) coreLight.intensity = coreBase * lerp(lerp(1, 1.7, n), 1, d);
    }

    return {
        /** dt: 화면 프레임 시간. 일찍 불러 시계가 뛰어도 몇 초에 걸쳐 부드럽게 따라간다 */
        update(dt) {
            const ph = nightPhase(state);
            const k = kn < 0 ? 1 : Math.min(1, dt * 0.8);
            const n2 = kn < 0 ? ph.night : kn + (ph.night - kn) * k;
            const d2 = kd < 0 ? ph.dawn : kd + (ph.dawn - kd) * k;
            if (Math.abs(n2 - kn) < 1e-4 && Math.abs(d2 - kd) < 1e-4) return;
            kn = n2;
            kd = d2;
            apply(kn, kd);
        }
    };
}
