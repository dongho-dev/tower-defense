// 사거리 표시: 지형을 따라 휘는 원판 + 빛나는 테두리 + 흐르는 점선.
import * as THREE from 'three';

const frag = /* glsl */ `
uniform vec3 uColor;
uniform float uTime;
uniform float uAlpha;
varying vec2 vPolar;
void main() {
    float r = vPolar.x;
    float a = vPolar.y;
    float edge = smoothstep(0.93, 0.985, r) * (1.0 - smoothstep(0.985, 1.0, r));
    float dash = step(0.5, fract(a * 18.0 / 6.2831 * 2.0 + uTime * 0.25));
    float inner = smoothstep(0.86, 0.9, r) * (1.0 - smoothstep(0.9, 0.93, r)) * dash * 0.8;
    float fill = 0.06 + 0.06 * smoothstep(0.3, 0.95, r);
    float alpha = (fill + edge * 1.0 + inner) * uAlpha;
    gl_FragColor = vec4(uColor * (1.0 + edge * 2.0), alpha);
}`;

const vert = /* glsl */ `
attribute vec2 polar;
varying vec2 vPolar;
void main() {
    vPolar = polar;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

export function createRangeIndicator(heightAt) {
    const SEG = 96;
    const RINGS = 10;
    const count = SEG * (RINGS + 1) + 1;
    const pos = new Float32Array(count * 3);
    const polar = new Float32Array(count * 2);
    const idx = [];
    // 중심점 0, 이후 고리별 정점
    for (let r = 0; r <= RINGS; r++) {
        for (let s = 0; s < SEG; s++) {
            const i = 1 + r * SEG + s;
            polar[i * 2] = (r + 1) / (RINGS + 1);
            polar[i * 2 + 1] = (s / SEG) * Math.PI * 2;
        }
    }
    for (let s = 0; s < SEG; s++) idx.push(0, 1 + s, 1 + ((s + 1) % SEG));
    for (let r = 0; r < RINGS; r++) {
        for (let s = 0; s < SEG; s++) {
            const a = 1 + r * SEG + s;
            const b = 1 + r * SEG + ((s + 1) % SEG);
            const c = a + SEG;
            const d = b + SEG;
            idx.push(a, c, b, b, c, d);
        }
    }
    const geo = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(pos, 3);
    geo.setAttribute('position', posAttr);
    geo.setAttribute('polar', new THREE.BufferAttribute(polar, 2));
    geo.setIndex(idx);
    const mat = new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color() }, uTime: { value: 0 }, uAlpha: { value: 0 } },
        vertexShader: vert,
        fragmentShader: frag,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        toneMapped: false
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 16;
    mesh.frustumCulled = false;
    mesh.visible = false;
    let key = '';
    let alpha = 0;
    let want = 0;

    return {
        mesh,
        show(opt) {
            if (!opt) {
                want = 0;
                return;
            }
            want = 1;
            mesh.visible = true;
            mat.uniforms.uColor.value.set(opt.color);
            const k = `${opt.x.toFixed(2)},${opt.z.toFixed(2)},${opt.r.toFixed(2)}`;
            if (k === key) return;
            key = k;
            pos[0] = opt.x;
            pos[1] = heightAt(opt.x, opt.z) + 0.06;
            pos[2] = opt.z;
            for (let r = 0; r <= RINGS; r++) {
                const rr = ((r + 1) / (RINGS + 1)) * opt.r;
                for (let s = 0; s < SEG; s++) {
                    const i = 1 + r * SEG + s;
                    const a = (s / SEG) * Math.PI * 2;
                    const x = opt.x + Math.cos(a) * rr;
                    const z = opt.z + Math.sin(a) * rr;
                    pos[i * 3] = x;
                    pos[i * 3 + 1] = Math.max(-0.02, heightAt(x, z)) + 0.07;
                    pos[i * 3 + 2] = z;
                }
            }
            posAttr.needsUpdate = true;
        },
        update(t, dt) {
            mat.uniforms.uTime.value = t;
            alpha += (want - alpha) * Math.min(1, dt * 14);
            mat.uniforms.uAlpha.value = alpha;
            if (alpha < 0.01 && want === 0) mesh.visible = false;
        }
    };
}
