// 결정적 난수와 노이즈. 같은 시드면 항상 같은 섬이 나온다.
import { SimplexNoise } from 'three/addons/math/SimplexNoise.js';

export function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function createNoise(seed = 1) {
    const rand = mulberry32(seed);
    const simplex = new SimplexNoise({ random: rand });
    const n2 = (x, y) => simplex.noise(x, y);
    const fbm = (x, y, octaves = 4, lac = 2, gain = 0.5) => {
        let sum = 0;
        let amp = 1;
        let f = 1;
        let norm = 0;
        for (let i = 0; i < octaves; i++) {
            sum += amp * n2(x * f, y * f);
            norm += amp;
            amp *= gain;
            f *= lac;
        }
        return sum / norm;
    };
    return { rand, n2, n3: (x, y, z) => simplex.noise3d(x, y, z), fbm };
}

export const smoothstep = (a, b, x) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
};

export const lerp = (a, b, t) => a + (b - a) * t;
