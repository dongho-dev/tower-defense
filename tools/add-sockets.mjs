// 맵 확장 도우미: 기존 소켓은 그대로 두고 경로 커버리지가 높은 자리를 더한 뒤, 가까운 소켓끼리 링크를 다시 잇는다.
// 사용: node tools/add-sockets.mjs <mapId> [추가 개수] [최소 간격] [링크 거리]
// 출력된 sockets/links를 maps.js에 붙여 넣는다 (기존 소켓 순서는 유지되므로 웨이브·테스트 번호가 바뀌지 않는다).
import { MAPS } from '../src/core/data/maps.js';
import { buildPath, distanceToPath } from '../src/core/path.js';

export function addSockets(map, add = 5, spacing = 2.1, linkDist = 2.7) {
    const paths = map.paths.map(buildPath);
    const samples = new Map();
    for (const p of paths) {
        for (let i = 0; i < p.count; i += 2) {
            const k = Math.round(p.xs[i] / 0.3) + ',' + Math.round(p.zs[i] / 0.3);
            if (!samples.has(k)) samples.set(k, [p.xs[i], p.zs[i]]);
        }
    }
    const pts = [...samples.values()];
    const { rx, rz } = map.island;
    const sockets = map.sockets.map((s) => s.slice());
    const cands = [];
    for (let x = -rx; x <= rx; x += 0.3) {
        for (let z = -rz; z <= rz; z += 0.3) {
            if ((x / rx) ** 2 + (z / rz) ** 2 > 0.78) continue;
            const d = Math.min(...paths.map((p) => distanceToPath(p, x, z)));
            if (d < 1.6 || d > 2.8) continue;
            let cov = 0;
            for (const [px, pz] of pts) if ((px - x) ** 2 + (pz - z) ** 2 <= 3.6 * 3.6) cov++;
            cands.push({ x, z, cov });
        }
    }
    cands.sort((a, b) => b.cov - a.cov);
    let added = 0;
    for (const c of cands) {
        if (added >= add) break;
        if (sockets.some(([sx, sz]) => Math.hypot(sx - c.x, sz - c.z) < spacing)) continue;
        sockets.push([Math.round(c.x * 10) / 10, Math.round(c.z * 10) / 10]);
        added++;
    }
    // 손으로 정한 기존 링크는 유지하고, 가까운 쌍을 더한다
    const links = map.links.map((l) => l.slice());
    const has = new Set(links.map(([a, b]) => a + ',' + b));
    for (let i = 0; i < sockets.length; i++) {
        for (let j = i + 1; j < sockets.length; j++) {
            if (
                Math.hypot(sockets[i][0] - sockets[j][0], sockets[i][1] - sockets[j][1]) <= linkDist &&
                !has.has(i + ',' + j)
            )
                links.push([i, j]);
        }
    }
    return { sockets, links, added };
}

if (process.argv[1] && process.argv[1].endsWith('add-sockets.mjs')) {
    const [mapId = 'dusk', add = '5', spacing = '2.1', link = '2.7'] = process.argv.slice(2);
    const r = addSockets(MAPS[mapId], Number(add), Number(spacing), Number(link));
    console.log(JSON.stringify({ sockets: r.sockets, links: r.links }));
    console.error(`${mapId}: +${r.added} sockets, ${r.links.length} links`);
}
