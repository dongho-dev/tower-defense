// 살아남기 미니맵: 지형(미리 그린 그림) + 탐험 안개 + 건물·적 점 + 생존자 + 카메라 사각형 + 공격 경고 핑.
// 탐험하지 않은 곳은 검게 가리고, 적은 지금 보이는 것만 그린다 (맵 구조를 미리 드러내지 않는다).
// 누르거나 끌면 그곳으로 카메라가 간다. 화면 왼쪽 아래에 늘 있다 (스타1처럼 경보 노릇).
import * as THREE from 'three';

const SIZE = 220;

export class Minimap {
    /** opts: { state, world, rig, camera, onJump(x, z) } */
    constructor(parent, opts) {
        this.o = opts;
        this.el = document.createElement('div');
        this.el.className = 'sv-mini panel';
        this.el.innerHTML = `<canvas></canvas><div class="sv-mini-cap"><span>미니맵</span><span data-mm-info></span></div>`;
        parent.appendChild(this.el);
        this.canvas = this.el.querySelector('canvas');
        this.info = this.el.querySelector('[data-mm-info]');
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        this.canvas.width = SIZE * dpr;
        this.canvas.height = SIZE * dpr;
        this.canvas.style.width = SIZE + 'px';
        this.canvas.style.height = SIZE + 'px';
        this.ctx = this.canvas.getContext('2d');
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const f = opts.state.survival.field;
        this.N = f.N;
        this.half = f.half;
        // 지형 바탕 (타일당 1픽셀)
        this.base = document.createElement('canvas');
        this.base.width = this.base.height = f.N;
        const bctx = this.base.getContext('2d');
        const img = bctx.createImageData(f.N, f.N);
        img.data.set(opts.world.terrain.minimapPixels());
        bctx.putImageData(img, 0, 0);
        this.fogC = document.createElement('canvas');
        this.fogC.width = this.fogC.height = f.N;
        this.fogCtx = this.fogC.getContext('2d');
        this.fogImg = this.fogCtx.createImageData(f.N, f.N);
        this.fogVer = -1;
        this.t = 0;
        this.acc = 1;
        let down = false;
        const jump = (e) => {
            const r = this.canvas.getBoundingClientRect();
            const u = (e.clientX - r.left) / r.width;
            const v = (e.clientY - r.top) / r.height;
            opts.onJump(-this.half + u * 2 * this.half, -this.half + v * 2 * this.half);
        };
        this.canvas.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            down = true;
            this.canvas.setPointerCapture(e.pointerId);
            jump(e);
        });
        this.canvas.addEventListener('pointermove', (e) => down && jump(e));
        this.canvas.addEventListener('pointerup', () => (down = false));
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        this.ray = new THREE.Raycaster();
        this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.5);
    }

    destroy() {
        this.el.remove();
    }

    /** 지도 좌표(픽셀) */
    px(x) {
        return ((x + this.half) / (2 * this.half)) * SIZE;
    }

    refreshFog() {
        const sv = this.o.state.survival;
        if (sv.fog.version === this.fogVer) return;
        this.fogVer = sv.fog.version;
        const d = this.fogImg.data;
        const { explored, visible } = sv.fog;
        for (let k = 0; k < explored.length; k++) {
            d[k * 4] = 4;
            d[k * 4 + 1] = 5;
            d[k * 4 + 2] = 12;
            d[k * 4 + 3] = visible[k] ? 0 : explored[k] ? 120 : 255;
        }
        this.fogCtx.putImageData(this.fogImg, 0, 0);
    }

    /** 화면 네 귀퉁이가 땅(평원 높이)에 닿는 자리 */
    frustum() {
        const cam = this.o.rig.camera;
        const pts = [];
        const v = new THREE.Vector3();
        for (const [x, y] of [
            [-1, 1],
            [1, 1],
            [1, -1],
            [-1, -1]
        ]) {
            this.ray.setFromCamera({ x, y }, cam);
            if (!this.ray.ray.intersectPlane(this.plane, v)) return null;
            pts.push([this.px(v.x), this.px(v.z)]);
        }
        return pts;
    }

    update(dt, extra = {}) {
        this.t += dt;
        this.acc += dt;
        // 초당 15번이면 충분하다
        if (this.acc < 1 / 15) return;
        this.acc = 0;
        const { state } = this.o;
        const sv = state.survival;
        const g = this.ctx;
        const S = SIZE;
        g.imageSmoothingEnabled = false;
        g.clearRect(0, 0, S, S);
        g.drawImage(this.base, 0, 0, S, S);
        const k = S / this.N;
        // 건물
        for (const t of state.towers) {
            if (!t.cell) continue;
            const { i, j, s } = t.cell;
            const hurt = t.hp < t.maxHp * 0.5;
            g.fillStyle =
                t.type === 'wall' ? (hurt ? '#e0a050' : '#9ff0b0') : t.type === 'mine' ? '#5cf0b8' : '#36d86a';
            g.fillRect(i * k, j * k, s * k, s * k);
        }
        // 안개
        this.refreshFog();
        g.drawImage(this.fogC, 0, 0, S, S);
        // 본진
        if (sv.base) {
            const b = sv.base;
            g.fillStyle = '#ffe08a';
            g.fillRect(b.i * k - 1, b.j * k - 1, b.s * k + 2, b.s * k + 2);
            g.strokeStyle = '#1a1206';
            g.lineWidth = 1;
            g.strokeRect(b.i * k - 1, b.j * k - 1, b.s * k + 2, b.s * k + 2);
        }
        // 둥지 (탐험한 뒤에만)
        const awake = state.waveIndex > 0;
        const nestSeen = sv.fog.explored[sv.field.cellAt(0, 0)];
        const nr = sv.nest.r * (S / (2 * this.half)) + (awake ? Math.sin(this.t * 5) * 1.2 : 0);
        if (nestSeen) {
            g.fillStyle = awake ? 'rgba(200,70,255,0.9)' : 'rgba(150,70,200,0.7)';
            g.beginPath();
            g.arc(S / 2, S / 2, nr, 0, Math.PI * 2);
            g.fill();
            g.strokeStyle = '#1a0624';
            g.lineWidth = 1.5;
            g.stroke();
        }
        // 생존자 예정 건설 자리
        for (const o of extra.plans || []) {
            if (o.type !== 'build' || o.started) continue;
            g.strokeStyle = 'rgba(127,224,255,0.9)';
            g.lineWidth = 1;
            g.strokeRect(o.i * k, o.j * k, o.s * k, o.s * k);
        }
        // 생존자: 하늘색 점 (쓰러졌으면 본진에 부활 표시)
        const w = sv.worker;
        if (w.alive) {
            const x = this.px(w.x);
            const y = this.px(w.z);
            const r = 3 + Math.sin(this.t * 6) * 0.6;
            g.fillStyle = '#7fe0ff';
            g.beginPath();
            g.arc(x, y, r, 0, Math.PI * 2);
            g.fill();
            g.strokeStyle = '#06222c';
            g.lineWidth = 1.2;
            g.stroke();
        }
        // 적 (보이는 것만)
        let shown = 0;
        for (const e of state.enemies) {
            if (e.fogged) continue;
            shown++;
            const x = this.px(e.x);
            const y = this.px(e.z);
            const r = e.def.boss ? 3.5 : 1.6;
            g.fillStyle = e.def.boss ? '#ff60ff' : '#ff3b3b';
            g.fillRect(x - r, y - r, r * 2, r * 2);
        }
        // 공격 경고 핑: 넓어지는 붉은 고리
        for (const p of sv.pings) {
            const age = state.time - p.t;
            if (age > 2.4 || age < 0) continue;
            const x = this.px(p.x);
            const y = this.px(p.z);
            const kk = (age % 1.2) / 1.2;
            g.strokeStyle = `rgba(255,70,60,${1 - kk})`;
            g.lineWidth = 2;
            g.beginPath();
            g.arc(x, y, 4 + kk * 14, 0, Math.PI * 2);
            g.stroke();
        }
        // 보스 경고: 둥지에 고리
        if (extra.bossSoon) {
            const kk = (this.t % 0.8) / 0.8;
            g.strokeStyle = `rgba(255,120,255,${1 - kk})`;
            g.lineWidth = 2.5;
            g.beginPath();
            g.arc(S / 2, S / 2, nr + 4 + kk * 16, 0, Math.PI * 2);
            g.stroke();
        }
        // 카메라가 보는 곳
        const fr = this.frustum();
        if (fr) {
            g.strokeStyle = 'rgba(255,255,255,0.9)';
            g.lineWidth = 1.2;
            g.beginPath();
            fr.forEach(([x, y], n) => (n ? g.lineTo(x, y) : g.moveTo(x, y)));
            g.closePath();
            g.stroke();
        }
        const txt = !w.alive
            ? `생존자 부활 ${Math.ceil(w.respawnT)}초`
            : sv.base
              ? `보이는 적 ${shown}`
              : '고원을 찾아 본진을 지으세요';
        if (this.info.textContent !== txt) this.info.textContent = txt;
    }
}
