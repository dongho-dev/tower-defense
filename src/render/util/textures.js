// 절차적 텍스처 생성기. 외부 이미지 없이 캔버스로 만든다. 모두 한 번만 만들고 캐시한다.
import * as THREE from 'three';
import { mulberry32 } from './noise.js';

const cache = new Map();
function cached(key, make) {
    if (!cache.has(key)) cache.set(key, make());
    return cache.get(key);
}

function canvas(size) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    return c;
}

function toTexture(c, { srgb = true, repeat = false } = {}) {
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    t.needsUpdate = true;
    return t;
}

/** 조약돌: 타일링되는 Worley 기반 색·노멀·거칠기 맵 */
export function cobblestone() {
    return cached('cobble', () => {
        const N = 512;
        const cells = 7;
        const rand = mulberry32(42);
        const pts = [];
        for (let j = 0; j < cells; j++) {
            for (let i = 0; i < cells; i++) {
                pts.push({ x: (i + 0.15 + rand() * 0.7) / cells, y: (j + 0.15 + rand() * 0.7) / cells, tone: rand() });
            }
        }
        const height = new Float32Array(N * N);
        const tone = new Float32Array(N * N);
        for (let py = 0; py < N; py++) {
            for (let px = 0; px < N; px++) {
                const u = px / N;
                const v = py / N;
                const ci = Math.floor(u * cells);
                const cj = Math.floor(v * cells);
                let f1 = 9;
                let f2 = 9;
                let t1 = 0;
                for (let dj = -1; dj <= 1; dj++) {
                    for (let di = -1; di <= 1; di++) {
                        const ii = (ci + di + cells) % cells;
                        const jj = (cj + dj + cells) % cells;
                        const p = pts[jj * cells + ii];
                        const ox = ci + di < 0 ? -1 : ci + di >= cells ? 1 : 0;
                        const oy = cj + dj < 0 ? -1 : cj + dj >= cells ? 1 : 0;
                        const dx = p.x + ox - u;
                        const dy = p.y + oy - v;
                        const d = Math.sqrt(dx * dx + dy * dy);
                        if (d < f1) {
                            f2 = f1;
                            f1 = d;
                            t1 = p.tone;
                        } else if (d < f2) f2 = d;
                    }
                }
                const edge = (f2 - f1) * cells;
                const h = Math.min(1, edge / 0.22);
                height[py * N + px] = Math.pow(h, 0.6);
                tone[py * N + px] = t1;
            }
        }
        const col = canvas(N);
        const nor = canvas(N);
        const rough = canvas(N);
        const cg = col.getContext('2d');
        const ng = nor.getContext('2d');
        const rg = rough.getContext('2d');
        const ci = cg.createImageData(N, N);
        const ni = ng.createImageData(N, N);
        const ri = rg.createImageData(N, N);
        const at = (x, y) => height[((y + N) % N) * N + ((x + N) % N)];
        const grain = mulberry32(7);
        for (let y = 0; y < N; y++) {
            for (let x = 0; x < N; x++) {
                const i = y * N + x;
                const h = height[i];
                const t = tone[i];
                const g = (grain() - 0.5) * 18;
                // 따뜻한 회색 사암 톤, 틈은 어두운 흙
                const stone = [150 + t * 40 + g, 138 + t * 34 + g, 120 + t * 26 + g];
                const mortar = [62, 52, 42];
                const k = Math.min(1, h * 1.6);
                ci.data[i * 4] = mortar[0] + (stone[0] - mortar[0]) * k;
                ci.data[i * 4 + 1] = mortar[1] + (stone[1] - mortar[1]) * k;
                ci.data[i * 4 + 2] = mortar[2] + (stone[2] - mortar[2]) * k;
                ci.data[i * 4 + 3] = 255;
                const sx = (at(x + 1, y) - at(x - 1, y)) * 3.5;
                const sy = (at(x, y + 1) - at(x, y - 1)) * 3.5;
                const len = Math.hypot(sx, sy, 1);
                ni.data[i * 4] = ((-sx / len) * 0.5 + 0.5) * 255;
                ni.data[i * 4 + 1] = ((sy / len) * 0.5 + 0.5) * 255;
                ni.data[i * 4 + 2] = (1 / len) * 255;
                ni.data[i * 4 + 3] = 255;
                const r = 0.95 - k * 0.3;
                ri.data[i * 4] = ri.data[i * 4 + 1] = ri.data[i * 4 + 2] = r * 255;
                ri.data[i * 4 + 3] = 255;
            }
        }
        cg.putImageData(ci, 0, 0);
        ng.putImageData(ni, 0, 0);
        rg.putImageData(ri, 0, 0);
        return {
            map: toTexture(col, { repeat: true }),
            normalMap: toTexture(nor, { srgb: false, repeat: true }),
            roughnessMap: toTexture(rough, { srgb: false, repeat: true })
        };
    });
}

/** 부드러운 원형 발광 스프라이트 */
export function glowSprite() {
    return cached('glow', () => {
        const c = canvas(128);
        const g = c.getContext('2d');
        const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
        grd.addColorStop(0, 'rgba(255,255,255,1)');
        grd.addColorStop(0.18, 'rgba(255,255,255,0.75)');
        grd.addColorStop(0.45, 'rgba(255,255,255,0.22)');
        grd.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grd;
        g.fillRect(0, 0, 128, 128);
        return toTexture(c, { srgb: false });
    });
}

/** 연기·구름 덩어리 */
export function puffSprite(seed = 3) {
    return cached('puff' + seed, () => {
        const N = 128;
        const c = canvas(N);
        const g = c.getContext('2d');
        const rand = mulberry32(seed);
        for (let i = 0; i < 26; i++) {
            const a = rand() * Math.PI * 2;
            const r = rand() * 26;
            const x = 64 + Math.cos(a) * r;
            const y = 64 + Math.sin(a) * r * 0.8;
            const s = 16 + rand() * 26;
            const grd = g.createRadialGradient(x, y, 0, x, y, s);
            grd.addColorStop(0, 'rgba(255,255,255,0.35)');
            grd.addColorStop(1, 'rgba(255,255,255,0)');
            g.fillStyle = grd;
            g.fillRect(0, 0, N, N);
        }
        return toTexture(c, { srgb: false });
    });
}

/**
 * 적운 덩어리: 위는 밝고 아래는 그늘진 둥근 봉우리, 바닥은 평평하게 사라진다.
 * RGB에 명암을 구워 두고 재질 색으로 물들인다.
 */
export function cumulusSprite(seed = 1) {
    return cached('cumulus' + seed, () => {
        const W = 256;
        const H = 128;
        const c = document.createElement('canvas');
        c.width = W;
        c.height = H;
        const g = c.getContext('2d');
        const rand = mulberry32(seed * 31 + 7);
        // 봉우리: 가운데가 높고 양 끝이 낮은 반원 위에 원을 겹친다
        const bumps = 9 + Math.floor(rand() * 5);
        for (let i = 0; i < bumps; i++) {
            const t = (i + 0.5) / bumps;
            const x = 34 + t * (W - 68) + (rand() - 0.5) * 14;
            const dome = Math.sin(t * Math.PI);
            const r = 16 + dome * 26 + rand() * 12;
            const y = H - 30 - dome * 34 - rand() * 10;
            const grd = g.createRadialGradient(x, y, r * 0.2, x, y, r);
            grd.addColorStop(0, 'rgba(255,255,255,1)');
            grd.addColorStop(0.7, 'rgba(255,255,255,0.92)');
            grd.addColorStop(1, 'rgba(255,255,255,0)');
            g.fillStyle = grd;
            g.beginPath();
            g.arc(x, y, r, 0, Math.PI * 2);
            g.fill();
        }
        // 명암: 위쪽(해) 밝고 아래로 갈수록 그늘
        g.globalCompositeOperation = 'source-atop';
        const shade = g.createLinearGradient(0, 8, 0, H - 14);
        shade.addColorStop(0, 'rgb(255,255,255)');
        shade.addColorStop(0.45, 'rgb(225,215,230)');
        shade.addColorStop(1, 'rgb(120,110,150)');
        g.fillStyle = shade;
        g.fillRect(0, 0, W, H);
        // 바닥은 안개처럼 풀어진다
        g.globalCompositeOperation = 'destination-out';
        const base = g.createLinearGradient(0, H - 34, 0, H);
        base.addColorStop(0, 'rgba(0,0,0,0)');
        base.addColorStop(1, 'rgba(0,0,0,1)');
        g.fillStyle = base;
        g.fillRect(0, 0, W, H);
        g.globalCompositeOperation = 'source-over';
        return toTexture(c, { srgb: false });
    });
}

/** 룬 원: 소켓 바닥·수정 고리에 쓰는 문양 (흰색, 재질 색으로 물든다) */
export function runeCircle() {
    return cached('rune', () => {
        const N = 512;
        const c = canvas(N);
        const g = c.getContext('2d');
        const rand = mulberry32(11);
        g.translate(N / 2, N / 2);
        g.strokeStyle = 'white';
        g.fillStyle = 'white';
        g.lineCap = 'round';
        const ring = (r, w) => {
            g.lineWidth = w;
            g.beginPath();
            g.arc(0, 0, r, 0, Math.PI * 2);
            g.stroke();
        };
        ring(240, 6);
        ring(222, 2.5);
        ring(150, 3);
        ring(138, 1.5);
        // 바깥 고리 사이 룬 글자
        const glyphs = 24;
        for (let i = 0; i < glyphs; i++) {
            g.save();
            g.rotate((i / glyphs) * Math.PI * 2);
            g.translate(0, -186);
            g.lineWidth = 3.5;
            g.beginPath();
            const strokes = 2 + Math.floor(rand() * 3);
            for (let s = 0; s < strokes; s++) {
                const x1 = (rand() - 0.5) * 22;
                const y1 = (rand() - 0.5) * 30;
                g.moveTo(x1, y1);
                g.lineTo(x1 + (rand() - 0.5) * 24, y1 + (rand() - 0.5) * 30);
            }
            g.stroke();
            g.restore();
        }
        // 안쪽 별 모양
        g.lineWidth = 3;
        for (const [n, r] of [
            [6, 138],
            [3, 138]
        ]) {
            g.beginPath();
            for (let i = 0; i <= n; i++) {
                const a = (i / n) * Math.PI * 2 - Math.PI / 2;
                const x = Math.cos(a) * r;
                const y = Math.sin(a) * r;
                i ? g.lineTo(x, y) : g.moveTo(x, y);
            }
            g.stroke();
        }
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
            g.beginPath();
            g.arc(Math.cos(a) * 204, Math.sin(a) * 204, 7, 0, Math.PI * 2);
            g.fill();
        }
        return toTexture(c, { srgb: false });
    });
}

/** 세로 그라데이션 빔 (수정의 빛기둥) */
export function beamGradient() {
    return cached('beam', () => {
        const c = canvas(64);
        c.width = 64;
        c.height = 256;
        const g = c.getContext('2d');
        const grd = g.createLinearGradient(0, 256, 0, 0);
        grd.addColorStop(0, 'rgba(255,255,255,1)');
        grd.addColorStop(0.25, 'rgba(255,255,255,0.5)');
        grd.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grd;
        g.fillRect(0, 0, 64, 256);
        const h = g.createLinearGradient(0, 0, 64, 0);
        h.addColorStop(0, 'rgba(0,0,0,1)');
        h.addColorStop(0.5, 'rgba(0,0,0,0)');
        h.addColorStop(1, 'rgba(0,0,0,1)');
        g.globalCompositeOperation = 'destination-out';
        g.fillStyle = h;
        g.fillRect(0, 0, 64, 256);
        return toTexture(c, { srgb: false });
    });
}

/** 잔디 디테일: 타일링 노이즈 (지형 색에 곱한다) */
export function grassDetail() {
    return cached('grassDetail', () => {
        const N = 256;
        const c = canvas(N);
        const g = c.getContext('2d');
        const img = g.createImageData(N, N);
        const rand = mulberry32(5);
        for (let i = 0; i < N * N; i++) {
            const v = 200 + rand() * 55;
            img.data[i * 4] = v;
            img.data[i * 4 + 1] = v;
            img.data[i * 4 + 2] = v;
            img.data[i * 4 + 3] = 255;
        }
        g.putImageData(img, 0, 0);
        // 짧은 풀잎 획
        for (let i = 0; i < 2600; i++) {
            const x = rand() * N;
            const y = rand() * N;
            const l = 3 + rand() * 6;
            g.strokeStyle = rand() > 0.5 ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.18)';
            g.lineWidth = 1;
            g.beginPath();
            g.moveTo(x, y);
            g.lineTo(x + (rand() - 0.5) * 2, y - l);
            g.stroke();
        }
        return toTexture(c, { repeat: true });
    });
}
