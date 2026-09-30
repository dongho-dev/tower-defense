// CPU 시뮬레이션 + GPU 포인트 스프라이트 파티클. 가산(불꽃·마법)과 일반(연기·흙먼지) 두 계열로 쓴다.
import * as THREE from 'three';

const vert = /* glsl */ `
attribute vec4 aColor;
attribute float aSize;
attribute float aSpin;
uniform float uScale;
varying vec4 vColor;
varying float vSpin;
void main() {
    vColor = aColor;
    vSpin = aSpin;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uScale / max(0.1, -mv.z);
    gl_Position = projectionMatrix * mv;
}`;

const frag = /* glsl */ `
uniform sampler2D uMap;
varying vec4 vColor;
varying float vSpin;
void main() {
    vec2 p = gl_PointCoord - 0.5;
    float c = cos(vSpin), s = sin(vSpin);
    p = vec2(c * p.x - s * p.y, s * p.x + c * p.y) + 0.5;
    vec4 tex = texture2D(uMap, p);
    gl_FragColor = vec4(vColor.rgb, vColor.a * tex.a * tex.r);
    if (gl_FragColor.a < 0.003) discard;
}`;

export class ParticleSystem {
    constructor(max, map, { additive = true } = {}) {
        this.max = max;
        this.count = 0;
        this.pos = new Float32Array(max * 3);
        this.vel = new Float32Array(max * 3);
        this.col = new Float32Array(max * 3);
        this.life = new Float32Array(max);
        this.maxLife = new Float32Array(max);
        this.size0 = new Float32Array(max);
        this.size1 = new Float32Array(max);
        this.alpha = new Float32Array(max);
        this.grav = new Float32Array(max);
        this.drag = new Float32Array(max);
        this.spin = new Float32Array(max);
        this.spinV = new Float32Array(max);
        this.fadeIn = new Float32Array(max);

        const geo = new THREE.BufferGeometry();
        this.aPos = new THREE.BufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage);
        this.aColor = new THREE.BufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
        this.aSize = new THREE.BufferAttribute(new Float32Array(max), 1).setUsage(THREE.DynamicDrawUsage);
        this.aSpin = new THREE.BufferAttribute(new Float32Array(max), 1).setUsage(THREE.DynamicDrawUsage);
        geo.setAttribute('position', this.aPos);
        geo.setAttribute('aColor', this.aColor);
        geo.setAttribute('aSize', this.aSize);
        geo.setAttribute('aSpin', this.aSpin);
        geo.setDrawRange(0, 0);
        this.material = new THREE.ShaderMaterial({
            uniforms: { uMap: { value: map }, uScale: { value: 400 } },
            vertexShader: vert,
            fragmentShader: frag,
            transparent: true,
            depthWrite: false,
            blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
            toneMapped: false
        });
        this.points = new THREE.Points(geo, this.material);
        this.points.frustumCulled = false;
        this.points.renderOrder = additive ? 20 : 19;
        this.geo = geo;
    }

    /** aSize를 월드 단위 지름으로 쓰도록 화면 높이·시야각으로 환산 */
    setScale(pixelHeight, fovDeg) {
        this.material.uniforms.uScale.value = pixelHeight / (2 * Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2));
    }

    /**
     * o: { x,y,z, vx,vy,vz, life, size, size1, color:[r,g,b], alpha, grav, drag, spin, fadeIn }
     */
    emit(o) {
        if (this.count >= this.max) return;
        const i = this.count++;
        const i3 = i * 3;
        this.pos[i3] = o.x;
        this.pos[i3 + 1] = o.y;
        this.pos[i3 + 2] = o.z;
        this.vel[i3] = o.vx || 0;
        this.vel[i3 + 1] = o.vy || 0;
        this.vel[i3 + 2] = o.vz || 0;
        this.col[i3] = o.color[0];
        this.col[i3 + 1] = o.color[1];
        this.col[i3 + 2] = o.color[2];
        this.life[i] = this.maxLife[i] = o.life;
        this.size0[i] = o.size;
        this.size1[i] = o.size1 ?? o.size * 0.2;
        this.alpha[i] = o.alpha ?? 1;
        this.grav[i] = o.grav ?? 0;
        this.drag[i] = o.drag ?? 1.5;
        this.spin[i] = o.spin ?? Math.random() * 6.28;
        this.spinV[i] = o.spinV ?? 0;
        this.fadeIn[i] = o.fadeIn ?? 0.05;
    }

    update(dt) {
        let n = this.count;
        const P = this.aPos.array;
        const C = this.aColor.array;
        const S = this.aSize.array;
        const R = this.aSpin.array;
        for (let i = 0; i < n; i++) {
            this.life[i] -= dt;
            if (this.life[i] <= 0) {
                // 마지막 원소와 교체해서 빈칸을 없앤다
                n--;
                this.copy(n, i);
                i--;
                continue;
            }
            const i3 = i * 3;
            const d = Math.max(0, 1 - this.drag[i] * dt);
            this.vel[i3] *= d;
            this.vel[i3 + 1] = this.vel[i3 + 1] * d - this.grav[i] * dt;
            this.vel[i3 + 2] *= d;
            this.pos[i3] += this.vel[i3] * dt;
            this.pos[i3 + 1] += this.vel[i3 + 1] * dt;
            this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
            this.spin[i] += this.spinV[i] * dt;
            const k = 1 - this.life[i] / this.maxLife[i];
            const fade = Math.min(1, k / Math.max(0.001, this.fadeIn[i])) * (1 - k * k);
            P[i3] = this.pos[i3];
            P[i3 + 1] = this.pos[i3 + 1];
            P[i3 + 2] = this.pos[i3 + 2];
            C[i * 4] = this.col[i3];
            C[i * 4 + 1] = this.col[i3 + 1];
            C[i * 4 + 2] = this.col[i3 + 2];
            C[i * 4 + 3] = this.alpha[i] * fade;
            S[i] = this.size0[i] + (this.size1[i] - this.size0[i]) * k;
            R[i] = this.spin[i];
        }
        this.count = n;
        this.geo.setDrawRange(0, n);
        this.aPos.needsUpdate = this.aColor.needsUpdate = this.aSize.needsUpdate = this.aSpin.needsUpdate = true;
    }

    copy(from, to) {
        if (from === to) return;
        for (const arr of [this.pos, this.vel, this.col]) {
            arr[to * 3] = arr[from * 3];
            arr[to * 3 + 1] = arr[from * 3 + 1];
            arr[to * 3 + 2] = arr[from * 3 + 2];
        }
        for (const arr of [
            this.life,
            this.maxLife,
            this.size0,
            this.size1,
            this.alpha,
            this.grav,
            this.drag,
            this.spin,
            this.spinV,
            this.fadeIn
        ]) {
            arr[to] = arr[from];
        }
    }
}
