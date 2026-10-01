// 맵 설계 도우미: 경로 커버리지가 높은 소켓 자리를 탐욕적으로 고른다.
// 사용: node tools/place-sockets.mjs <mapId> [count] [spacing]
// 출력된 sockets/links를 maps.js에 붙여 넣고 tools/map-preview.html에서 확인·손질한다.
import { MAPS } from '../src/core/data/maps.js';
import { buildPath, distanceToPath } from '../src/core/path.js';

const [mapId = 'dusk', countArg = '20', spacingArg = '2.2'] = process.argv.slice(2);
const map = MAPS[mapId];
const paths = map.paths.map(buildPath);
const count = Number(countArg);
const spacing = Number(spacingArg);
const R = 3.3;

// 합류 구간을 두 번 세지 않도록 경로 샘플을 0.3 격자로 중복 제거
const samples = new Map();
for (const p of paths) {
    for (let i = 0; i < p.count; i += 2) {
        const k = Math.round(p.xs[i] / 0.3) + ',' + Math.round(p.zs[i] / 0.3);
        if (!samples.has(k)) samples.set(k, [p.xs[i], p.zs[i]]);
    }
}
const pts = [...samples.values()];
const { rx, rz } = map.island;
const candidates = [];
for (let x = -rx; x <= rx; x += 0.4) {
    for (let z = -rz; z <= rz; z += 0.4) {
        if ((x / rx) ** 2 + (z / rz) ** 2 > 0.8) continue;
        const d = Math.min(...paths.map((p) => distanceToPath(p, x, z)));
        if (d < 1.55 || d > 2.9) continue;
        let cov = 0;
        for (const [px, pz] of pts) if ((px - x) ** 2 + (pz - z) ** 2 <= R * R) cov++;
        candidates.push({ x, z, cov });
    }
}
candidates.sort((a, b) => b.cov - a.cov);
const chosen = [];
for (const c of candidates) {
    if (chosen.length >= count) break;
    if (chosen.some((o) => Math.hypot(o.x - c.x, o.z - c.z) < spacing)) continue;
    chosen.push(c);
}
const r1 = (v) => Math.round(v * 10) / 10;
const sockets = chosen.map((c) => [r1(c.x), r1(c.z)]);
const links = [];
for (let i = 0; i < sockets.length; i++) {
    for (let j = i + 1; j < sockets.length; j++) {
        const d = Math.hypot(sockets[i][0] - sockets[j][0], sockets[i][1] - sockets[j][1]);
        if (d <= 2.7) links.push([i, j]);
    }
}
console.log(JSON.stringify({ sockets, links }));
console.error(chosen.map((c, i) => `${i}:${c.cov}`).join(' '));
