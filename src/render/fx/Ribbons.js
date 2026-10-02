// 카메라를 향하는 띠(리본): 연쇄 번개, 광선, 궤적에 쓴다.
import * as THREE from 'three';

let lineTex = null;
function lineTexture() {
    if (lineTex) return lineTex;
    const c = document.createElement('canvas');
    c.width = 4;
    c.height = 64;
    const g = c.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 0, 64);
    grd.addColorStop(0, 'rgba(255,255,255,0)');
    grd.addColorStop(0.35, 'rgba(255,255,255,0.35)');
    grd.addColorStop(0.5, 'rgba(255,255,255,1)');
    grd.addColorStop(0.65, 'rgba(255,255,255,0.35)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 4, 64);
    lineTex = new THREE.CanvasTexture(c);
    return lineTex;
}

const MAX_PTS = 96;
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _t = new THREE.Vector3();
const _s = new THREE.Vector3();
const _view = new THREE.Vector3();

/** 리본 재질 (미리 굽기도 같은 설정을 쓴다) */
export function ribbonMaterial() {
    return new THREE.MeshBasicMaterial({
        map: lineTexture(),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false
    });
}

class Ribbon {
    constructor(scene) {
        const geo = new THREE.BufferGeometry();
        this.posAttr = new THREE.BufferAttribute(new Float32Array(MAX_PTS * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage);
        const uv = new Float32Array(MAX_PTS * 2 * 2);
        for (let i = 0; i < MAX_PTS; i++) {
            uv.set([i / (MAX_PTS - 1), 0, i / (MAX_PTS - 1), 1], i * 4);
        }
        geo.setAttribute('position', this.posAttr);
        geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
        const idx = [];
        for (let i = 0; i < MAX_PTS - 1; i++) {
            const a = i * 2;
            idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
        geo.setIndex(idx);
        geo.setDrawRange(0, 0);
        this.mat = ribbonMaterial();
        this.mesh = new THREE.Mesh(geo, this.mat);
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = 25;
        this.geo = geo;
        this.active = false;
        scene.add(this.mesh);
    }

    set(points, width, camera, taper = false) {
        const n = Math.min(points.length, MAX_PTS);
        const arr = this.posAttr.array;
        for (let i = 0; i < n; i++) {
            const p = points[i];
            _a.copy(points[Math.max(0, i - 1)]);
            _b.copy(points[Math.min(n - 1, i + 1)]);
            _t.subVectors(_b, _a).normalize();
            _view.subVectors(camera.position, p).normalize();
            _s.crossVectors(_t, _view).normalize();
            const w = width * (taper ? 1 - i / n : 1);
            arr.set(
                [p.x - _s.x * w, p.y - _s.y * w, p.z - _s.z * w, p.x + _s.x * w, p.y + _s.y * w, p.z + _s.z * w],
                i * 6
            );
        }
        this.posAttr.needsUpdate = true;
        this.geo.setDrawRange(0, Math.max(0, (n - 1) * 6));
        this.geo.computeBoundingSphere();
    }
}

export class Ribbons {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.pool = [];
        this.live = [];
    }

    get() {
        let r = this.pool.find((x) => !x.active);
        if (!r) {
            r = new Ribbon(this.scene);
            this.pool.push(r);
        }
        r.active = true;
        r.mesh.visible = true;
        return r;
    }

    /** 번개: 두 점 사이를 지그재그로 나눈 점열 */
    static jagged(from, to, jitter, segments) {
        const pts = [];
        const len = from.distanceTo(to);
        for (let i = 0; i <= segments; i++) {
            const k = i / segments;
            const p = new THREE.Vector3().lerpVectors(from, to, k);
            if (i > 0 && i < segments) {
                const amp = jitter * len * Math.sin(k * Math.PI);
                p.x += (Math.random() - 0.5) * amp;
                p.y += (Math.random() - 0.5) * amp * 0.7;
                p.z += (Math.random() - 0.5) * amp;
            }
            pts.push(p);
        }
        return pts;
    }

    /** 연쇄 번개: 점 목록을 따라 겉(색)·속(흰색) 두 겹 */
    bolt(points, color, life = 0.2, width = 0.12) {
        const outer = this.get();
        const inner = this.get();
        const item = { outer, inner, points, color: new THREE.Color(color), life, max: life, width, reroll: 0 };
        this.live.push(item);
        this.build(item);
        return item;
    }

    build(item) {
        const pts = [];
        for (let i = 0; i < item.points.length - 1; i++) {
            const seg = Ribbons.jagged(item.points[i], item.points[i + 1], 0.22, 8);
            if (i > 0) seg.shift();
            pts.push(...seg);
        }
        item.outer.set(pts, item.width, this.camera);
        item.inner.set(pts, item.width * 0.28, this.camera);
    }

    update(dt) {
        for (const it of this.live) {
            it.life -= dt;
            it.reroll -= dt;
            if (it.reroll <= 0 && it.life > 0) {
                it.reroll = 0.045;
                this.build(it);
            }
            const k = Math.max(0, it.life / it.max);
            it.outer.mat.color.copy(it.color).multiplyScalar(4 * k);
            it.inner.mat.color.setRGB(6 * k, 6 * k, 6 * k);
            if (it.life <= 0) {
                for (const r of [it.outer, it.inner]) {
                    r.active = false;
                    r.mesh.visible = false;
                }
                it.done = true;
            }
        }
        this.live = this.live.filter((it) => !it.done);
    }
}
