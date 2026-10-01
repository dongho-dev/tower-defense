// 살아남기(공성전 전용 맵 장르): 정해진 길 없이 섬 가장자리 사방에서 적이 수정으로 몰려온다.
// 동이 틀 때(dawn초)까지 버티면 승리. 웨이브는 시계(clock)에 맞춰 저절로 오고, 일찍 부르면 시계가
// 그 웨이브 시각까지 앞당겨진다(밤이 빨리 지나가는 대신 적이 겹친다).
//
// 길: 엔진은 경로를 따라 움직이므로, 가장자리 둘레에 laneStep도 간격으로 짧은 진입로(레인)를 미리 깔아 둔다.
// 레인은 가장자리에서 출발해 가장 가까운 골목(corridor, 수정에서 뻗은 빈 길목)으로 휘어 들어간 뒤 수정까지 곧장 간다.
// 레인 묶음은 맵을 만들 때 한 번만 만들고 다시 쓰므로, 적이 아무리 많이 나와도 경로·메시가 늘지 않는다.
// 좌표는 '단위 공간'(원)에서 만든 뒤 x만 stretch배 늘려서 타원형 섬에 맞춘다(거리는 줄지 않는다).

const DEG = Math.PI / 180;

/** 기본 설정 (맵의 survival 필드가 덮어쓴다) */
export const SURVIVAL_DEFAULTS = {
    dawn: 600,
    corridors: 6,
    corridorAt: 0,
    laneStep: 5,
    spawnR: 11.6,
    stretch: 1.27,
    // 소켓 고리: [반지름, 골목 사이 한가운데에서 벌어진 각도들]
    rings: [
        [3.0, [0]],
        [5.4, [-10, 10]],
        [7.6, [-8, 8]]
    ]
};

const norm = (deg) => ((deg % 360) + 360) % 360;
const angDiff = (a, b) => ((((a - b) % 360) + 540) % 360) - 180;

function config(cfg) {
    return { ...SURVIVAL_DEFAULTS, ...cfg };
}

function toWorld(c, r, deg) {
    return [+(Math.cos(deg * DEG) * r * c.stretch).toFixed(3), +(Math.sin(deg * DEG) * r).toFixed(3)];
}

/** 골목 각도 목록 (도, 0 = 동쪽 +x, 90 = 남쪽 +z 카메라 쪽) */
export function corridorAngles(cfg) {
    const c = config(cfg);
    return Array.from({ length: c.corridors }, (_, k) => norm(c.corridorAt + (k * 360) / c.corridors));
}

/** 가장자리 각도 deg에서 출발하는 레인이 들어갈 골목 */
function corridorFor(c, deg, k) {
    const cs = corridorAngles(c);
    let best = cs[0];
    let bd = Infinity;
    for (const a of cs) {
        // 정확히 가운데면 레인 번호로 번갈아 고른다
        const d = Math.abs(angDiff(deg, a)) + (k % 2 ? -1e-6 : 1e-6) * Math.sign(angDiff(deg, a));
        if (d < bd) {
            bd = d;
            best = a;
        }
    }
    return best;
}

/** 레인 제어점 목록: 맵의 paths가 된다. 레인 i는 가장자리 각도 i * laneStep에서 출발한다 */
export function survivalLanes(cfg) {
    const c = config(cfg);
    const n = Math.round(360 / c.laneStep);
    const lanes = [];
    for (let i = 0; i < n; i++) {
        const a = i * c.laneStep;
        const phi = a + angDiff(corridorFor(c, a, i), a);
        // 레인마다 살짝 다르게 휘도록 결정적인 흔들림
        const wob = Math.sin(i * 2.399) * 3;
        lanes.push([
            toWorld(c, c.spawnR, a),
            toWorld(c, c.spawnR - 1.5, a + (phi - a) * 0.3 + wob),
            toWorld(c, 8.9, phi + (a - phi) * 0.1 + wob * 0.3),
            toWorld(c, 7.4, phi),
            toWorld(c, 4.2, phi),
            [0, 0]
        ]);
    }
    return lanes;
}

/** 골목마다 다져진 흔적 (렌더용: 지형을 살짝 다지고 흙빛을 입힌다) */
export function corridorTrails(cfg) {
    const c = config(cfg);
    return corridorAngles(c).map((phi) => [toWorld(c, 9.4, phi), toWorld(c, 7.4, phi), toWorld(c, 4.2, phi), [0, 0]]);
}

/** 소켓과 공명 연결: 골목 사이마다 안쪽 1, 가운데 2, 바깥 2 (보루 하나) */
export function survivalSockets(cfg) {
    const c = config(cfg);
    const sockets = [];
    const links = [];
    for (const phi of corridorAngles(c)) {
        const mid = phi + 180 / c.corridors;
        const ids = c.rings.map(([r, offs]) =>
            offs.map((o) => {
                sockets.push(toWorld(c, r, mid + o));
                return sockets.length - 1;
            })
        );
        const [inner, middle, outer] = ids;
        const dist = (a, b) => Math.hypot(sockets[a][0] - sockets[b][0], sockets[a][1] - sockets[b][1]);
        // 안쪽은 가운데 고리에서 더 가까운 쪽과, 가운데 고리의 다른 쪽은 바깥 고리에서 더 가까운 쪽과 잇는다
        const [near, far] = dist(inner[0], middle[0]) <= dist(inner[0], middle[1]) ? middle : [...middle].reverse();
        const out = dist(far, outer[0]) <= dist(far, outer[1]) ? outer[0] : outer[1];
        links.push([middle[0], middle[1]], [inner[0], near], [outer[0], outer[1]], [far, out]);
    }
    return { sockets, links };
}

/** 레인 번호 → 출발 각도 */
export function laneAngle(state, pathIndex) {
    return pathIndex * config(state.map.survival).laneStep;
}

/**
 * 웨이브 그룹에서 이번 적이 나올 레인. grp.from(도)을 중심으로 ±spread(도) 안에서 고른다.
 * from이 없으면 사방(전 방위). id로 흩뜨려 결정적이다.
 */
export function pickLane(state, grp, id) {
    const c = config(state.map.survival);
    const n = Math.round(360 / c.laneStep);
    const spread = grp.from == null ? 180 : (grp.spread ?? 25);
    const u = (id * 0.7548776662) % 1;
    const deg = (grp.from ?? 0) + (u * 2 - 1) * spread;
    return Math.round(norm(deg) / c.laneStep) % n;
}

/** 방향 이름 (HUD 안내용) */
export function directionName(deg) {
    const names = ['동', '남동', '남', '남서', '서', '북서', '북', '북동'];
    return names[Math.round(norm(deg) / 45) % 8];
}

/** 웨이브가 몰려오는 방향 요약: [{ from, spread }] (중복 방향은 합친다) */
export function waveDirections(wave) {
    const out = [];
    for (const g of wave.groups) {
        const d = g.from == null ? { from: null, spread: 180 } : { from: norm(g.from), spread: g.spread ?? 25 };
        if (!out.some((o) => o.from === d.from)) out.push(d);
    }
    return out;
}

/** 웨이브 방향을 한 줄로: '사방' 또는 '북·남동' */
export function directionLabel(wave) {
    const dirs = waveDirections(wave);
    if (dirs.some((d) => d.from == null)) return '사방';
    return [...new Set(dirs.map((d) => directionName(d.from)))].join('·');
}

export function createSurvival(map) {
    const c = config(map.survival);
    return { dawn: c.dawn, clock: 0, dawned: false };
}

/**
 * 밤의 진행: f(0~1) 시계 비율, night(0~1) 어둠의 깊이, dawn(0~1) 동트는 정도, remain 남은 초.
 * 밤은 75%까지 깊어지고(막판 대공세는 가장 깊은 어둠 속), 마지막 8%에 동이 튼다.
 */
export function nightPhase(state) {
    const sv = state.survival;
    if (!sv) return { f: 0, night: 0, dawn: 0, remain: 0 };
    const f = sv.dawned ? 1 : Math.min(1, sv.clock / sv.dawn);
    const s = (a, b, x) => {
        const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
        return t * t * (3 - 2 * t);
    };
    return { f, night: s(0, 0.75, f), dawn: s(0.92, 1, f), remain: Math.max(0, sv.dawn - sv.clock) };
}

/** 남은 시간을 m:ss로 */
export function formatClock(sec) {
    const s = Math.max(0, Math.ceil(sec));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
