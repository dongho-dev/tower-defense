// 경로 수학: 제어점 → Catmull-Rom 곡선 → 균일 거리 샘플.
// 좌표계는 지면 평면 (x, z). 높이는 렌더러가 담당한다.

const SAMPLE_STEP = 0.1;

function catmullRom(p0, p1, p2, p3, t) {
    const t2 = t * t;
    const t3 = t2 * t;
    const f = (a, b, c, d) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
    return { x: f(p0.x, p1.x, p2.x, p3.x), z: f(p0.z, p1.z, p2.z, p3.z) };
}

/**
 * @param {Array<[number, number]>} control 제어점 [x, z] 목록 (첫 점 = 스폰, 마지막 점 = 수정)
 */
export function buildPath(control) {
    const pts = control.map(([x, z]) => ({ x, z }));
    const dense = [];
    for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[Math.max(0, i - 1)];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = pts[Math.min(pts.length - 1, i + 2)];
        const segLen = Math.hypot(p2.x - p1.x, p2.z - p1.z);
        const n = Math.max(4, Math.ceil(segLen / 0.05));
        for (let k = 0; k < n; k++) dense.push(catmullRom(p0, p1, p2, p3, k / n));
    }
    dense.push({ ...pts[pts.length - 1] });

    // 누적 거리로 재샘플해서 SAMPLE_STEP 간격의 균일한 점열을 만든다
    const cum = [0];
    for (let i = 1; i < dense.length; i++) {
        cum.push(cum[i - 1] + Math.hypot(dense[i].x - dense[i - 1].x, dense[i].z - dense[i - 1].z));
    }
    const length = cum[cum.length - 1];
    const count = Math.ceil(length / SAMPLE_STEP) + 1;
    const xs = new Float64Array(count);
    const zs = new Float64Array(count);
    let j = 1;
    for (let i = 0; i < count; i++) {
        const d = Math.min(length, i * SAMPLE_STEP);
        while (j < cum.length - 1 && cum[j] < d) j++;
        const span = cum[j] - cum[j - 1] || 1;
        const t = (d - cum[j - 1]) / span;
        xs[i] = dense[j - 1].x + (dense[j].x - dense[j - 1].x) * t;
        zs[i] = dense[j - 1].z + (dense[j].z - dense[j - 1].z) * t;
    }
    return { control: pts, xs, zs, length, step: SAMPLE_STEP, count };
}

/** 경로 거리 d에서의 위치와 진행 방향(단위 벡터) */
export function samplePath(path, d, out = {}) {
    const f = Math.max(0, Math.min(path.length, d)) / path.step;
    const i = Math.min(path.count - 2, Math.floor(f));
    const t = Math.min(1, f - i);
    const x0 = path.xs[i];
    const z0 = path.zs[i];
    const x1 = path.xs[i + 1];
    const z1 = path.zs[i + 1];
    out.x = x0 + (x1 - x0) * t;
    out.z = z0 + (z1 - z0) * t;
    const len = Math.hypot(x1 - x0, z1 - z0) || 1;
    out.dx = (x1 - x0) / len;
    out.dz = (z1 - z0) / len;
    return out;
}

/** 점에서 경로까지의 최단 거리 (배치 검증·지형 생성용) */
export function distanceToPath(path, x, z) {
    let best = Infinity;
    for (let i = 0; i < path.count; i += 2) {
        const d = (path.xs[i] - x) ** 2 + (path.zs[i] - z) ** 2;
        if (d < best) best = d;
    }
    return Math.sqrt(best);
}
