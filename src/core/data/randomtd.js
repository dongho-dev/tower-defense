// 랜덤 타워 디펜스(공성전 전용 맵 '운명의 제단') 데이터: 등급·확률·비용 상수, 신화 레시피, 고리 길과 소켓 격자, 40웨이브.
// 스타크래프트 유즈맵 랜덤 타워 디펜스·개인 랜덤 디펜스와 그 후계(운빨존많겜)의 규칙을 따른다.
// 게임 로직(src/core/randomtd.js)과 맵 데이터(maps.js)가 함께 쓰므로 여기에는 순수 데이터만 둔다.

/** 등급: 흔함 → 희귀 → 영웅 → 전설 → 신화. 기존 타워의 레벨·분기·각성 단계에 대응시킨다 */
export const GRADES = [
    { id: 'common', name: '흔함', color: '#cfd6de', tier: 1 },
    { id: 'rare', name: '희귀', color: '#4fa8ff', tier: 2 },
    { id: 'epic', name: '영웅', color: '#b678ff', tier: 3 },
    { id: 'legend', name: '전설', color: '#ffb22e', tier: 3, branch: true },
    { id: 'myth', name: '신화', color: '#ff4f6e', tier: 3, branch: true, mastery: 2 }
];
export const COMMON = 0;
export const RARE = 1;
export const EPIC = 2;
export const LEGEND = 3;
export const MYTH = 4;

/** 소환으로 나오는 타워 종류 (모든 기존 타워) */
export const RTD_POOL = ['ranger', 'ember', 'frost', 'storm', 'arcane'];

export const RTD = {
    // 필드 몹 한도: 넘으면 패배. 한도의 80%·90%에서 경고. 영웅 난이도는 한도가 70%
    mobLimit: 100,
    warn: [0.8, 0.9],
    heroLimit: 0.7,
    // 소환: 20골드에서 시작해 한 번 할 때마다 +2
    summonBase: 20,
    summonStep: 2,
    // 소환 확률(%) [흔함, 희귀, 영웅]. 확률 강화 단계마다 아래 줄로
    odds: [
        [70, 25, 5],
        [60, 32, 8],
        [50, 38, 12],
        [40, 44, 16]
    ],
    oddsCost: [150, 350, 700],
    // 천장: 흔함만 이만큼 연속으로 나오면 이번 소환은 희귀 이상 확정
    pity: 20,
    // 합성: 같은 타워(종류·등급) 셋 → 한 등급 위 무작위 하나. 재료 종류(공명 속성)를 이을 확률
    inherit: 0.5,
    // 등급별 능력치 배율(피해·지속 피해·병사 체력). 레벨·분기·각성 상승분 위에 곱한다
    gradeMul: [1, 2.8, 7.8, 17, 34],
    // 종류별 피해 보정: 뽑기로만 얻으므로 보조형(서리)도 보스를 칠 수 있게 단일 대상 화력을 고르게
    typeMul: { ranger: 1, ember: 1.2, frost: 1.8, storm: 1.1, arcane: 0.85, mine: 1, barracks: 1 },
    // 고리 길을 따라 싸우므로 사거리를 조금 넓힌다 (격자 안쪽 칸도 길에 닿게)
    rangeMul: 1.1,
    // 광산 수입은 소환 한 번 값과 겨루지 않게 줄인다
    incomeMul: 0.35,
    // 판매: 등급별 환급 골드와 룬 파편
    sellGold: [8, 24, 60, 150, 300],
    sellRunes: [1, 2, 4, 6, 0],
    // 행운 소환: 룬 파편으로 영웅 등급 도박. 실패할 때마다 다음 성공 확률이 오른다
    luckCost: 4,
    luckChance: 0.55,
    luckStep: 0.1,
    // 웨이브: 일정 시간마다 저절로 온다. 보스는 제한 시간 안에 잡아야 한다
    prep: 18,
    waveTime: 20,
    bossTime: 30,
    afterBoss: 4,
    // 경제: 웨이브 보상(기본 + 웨이브당), 이자(보유 골드의 5%, 상한 50)
    waveGold: 20,
    waveGoldStep: 2,
    interest: 0.05,
    interestCap: 50,
    // 보통 적 체력 배율 (hpCurve에 곱한다)
    mobHp: 2.4,
    // 웨이브마다 보통 적 체력이 이만큼씩 곱해진다
    hpGrowth: 1.08,
    bossRunes: 5,
    bossGold: 60
};

/**
 * 신화 레시피: 전설 하나(그 종류) + 영웅 둘(정해진 종류) + 룬 파편.
 * 결과는 전설 재료 자리에서 같은 분기의 신화(각성 2단계)가 된다.
 */
export const MYTHS = {
    ranger: { name: '별사냥 성궁', en: 'Starhunter', parts: ['storm', 'frost'], runes: 6 },
    ember: { name: '태양 용광로', en: 'Sunforge', parts: ['ranger', 'arcane'], runes: 6 },
    frost: { name: '영겁의 빙관', en: 'Eternal Crown', parts: ['storm', 'ember'], runes: 6 },
    storm: { name: '뇌신의 첨탑', en: 'Thunder Throne', parts: ['frost', 'arcane'], runes: 6 },
    arcane: { name: '별무리 프리즘', en: 'Star Prism', parts: ['ranger', 'storm'], runes: 6 }
};
export const MYTH_ORDER = ['ranger', 'ember', 'frost', 'storm', 'arcane'];

// ---------- 경기장: 사각 고리 길과 칸 격자 ----------
// 레퍼런스(운빨존많겜·스타 랜타디·원랜디)처럼 직사각형 들판 가운데에 칸 격자가 있고, 그 둘레를 사각 고리 길이
// 바짝 감싼다. 타워는 받침대 없이 칸 땅 위에 바로 선다(한 칸에 같은 타워 셋까지).

/** 칸 크기 CELL, 4행 × 7열. 고리 길 중심선은 바깥 칸 중심에서 GAP만큼 떨어지고 모서리는 r만큼 둥글다 */
export const CELL = 1.6;
const GAP = 1.45;
export const ARENA = {
    cell: CELL,
    cols: [-3, -2, -1, 0, 1, 2, 3].map((i) => i * CELL),
    rows: [-1.5, -0.5, 0.5, 1.5].map((j) => j * CELL),
    hx: 3 * CELL + GAP,
    hz: 1.5 * CELL + GAP,
    r: 0.9,
    // 길 폭
    road: 1.2
};

/**
 * 고리 길 제어점: 왼쪽 위 모서리(균열)에서 출발해 시계 방향(화면에서)으로 한 바퀴. 첫 점 = 끝 점.
 * 촘촘하게 찍어서 Catmull-Rom 보간이 둥근 사각을 그대로 따라가게 한다.
 */
export function loopTrack(cfg = ARENA) {
    const { hx, hz, r } = cfg;
    const ax = hx - r;
    const az = hz - r;
    const pts = [];
    const STEP = 0.3;
    const line = (x0, z0, x1, z1) => {
        const n = Math.max(1, Math.round(Math.hypot(x1 - x0, z1 - z0) / STEP));
        for (let i = 0; i < n; i++) pts.push([x0 + ((x1 - x0) * i) / n, z0 + ((z1 - z0) * i) / n]);
    };
    const arc = (cx, cz, a0) => {
        const n = 6;
        for (let i = 0; i < n; i++) {
            const a = a0 + ((Math.PI / 2) * i) / n;
            pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
        }
    };
    // 위쪽 왼편 → 동쪽으로
    line(-ax, -hz, ax, -hz);
    arc(ax, -az, -Math.PI / 2);
    line(hx, -az, hx, az);
    arc(ax, az, 0);
    line(ax, hz, -ax, hz);
    arc(-ax, az, Math.PI / 2);
    line(-hx, az, -hx, -az);
    arc(-ax, -az, Math.PI);
    pts.push([-ax, -hz]);
    return pts.map(([x, z]) => [+x.toFixed(3), +z.toFixed(3)]);
}

/** 칸 격자(소켓)와 공명 링크(상하좌우 이웃) */
export function arenaCells(cfg = ARENA) {
    const sockets = [];
    for (const z of cfg.rows) for (const x of cfg.cols) sockets.push([+x.toFixed(3), +z.toFixed(3)]);
    const n = cfg.cols.length;
    const links = [];
    cfg.rows.forEach((_, j) =>
        cfg.cols.forEach((_, i) => {
            const a = j * n + i;
            if (i + 1 < n) links.push([a, a + 1]);
            if (j + 1 < cfg.rows.length) links.push([a, a + n]);
        })
    );
    return { sockets, links };
}

// ---------- 웨이브 ----------

const g = (enemy, count, extra = {}) => ({ enemy, count, ...extra });

/**
 * 40웨이브 표. 보통 웨이브는 한 종류(또는 둘)로 몰려오고, 10웨이브마다 보스.
 * 체력은 hpCurve가 정한 '웨이브 체력'을 기준으로, 원래 체력이 높은 적은 수를 줄여 총량을 맞춘다.
 */
const TABLE = [
    [g('grunt', 24)],
    [g('grunt', 28)],
    [g('stalker', 30)],
    [g('grunt', 22), g('hexcaller', 4)],
    [g('wraith', 24)],
    [g('cinderling', 28)],
    [g('ironclad', 10), g('grunt', 14)],
    [g('shade', 26)],
    [g('stalker', 24), g('grunt', 12, { elite: true, count: 3 })],
    [g('colossus', 1)],
    [g('splitter', 14)],
    [g('harpy', 30)],
    [g('rimeguard', 18)],
    [g('bloomer', 26)],
    [g('grunt', 26), g('ironclad', 3, { elite: true })],
    [g('burrower', 22)],
    [g('stormeater', 18)],
    [g('yeti', 10), g('stalker', 16)],
    [g('flameborn', 22)],
    [g('glacier', 1)],
    [g('cinderling', 20), g('hexcaller', 8)],
    [g('wraith', 20), g('harpy', 14)],
    [g('ironclad', 14), g('shade', 10)],
    [g('splitter', 18)],
    [g('rimeguard', 12), g('yeti', 4, { elite: true })],
    [g('bloomer', 18), g('burrower', 12)],
    [g('stalker', 36)],
    [g('stormeater', 14), g('flameborn', 14)],
    [g('shade', 22), g('hexcaller', 6, { elite: true })],
    [g('thornwood', 1)],
    [g('grunt', 34), g('ironclad', 5, { elite: true })],
    [g('harpy', 26), g('wraith', 12, { elite: true, count: 4 })],
    [g('splitter', 20), g('cinderling', 12)],
    [g('yeti', 14), g('rimeguard', 10)],
    [g('bloomer', 22), g('hexcaller', 8)],
    [g('burrower', 18), g('shade', 18)],
    [g('stormeater', 16), g('ironclad', 10)],
    [g('flameborn', 20), g('stalker', 6, { elite: true })],
    [g('yeti', 6, { elite: true }), g('harpy', 20), g('grunt', 20)],
    [g('magmaLord', 1)]
];

const HINTS = {
    1: '골드로 <b>소환</b>하면 무작위 타워가 빈 칸에 선다. 같은 타워 셋을 모아 <b>합성</b>하면 한 등급 위가 된다.',
    5: '<b>망령</b>은 마법을 흘려낸다. 궁수·박격포 같은 물리 타워를 길가 칸에.',
    6: '<b>자폭병</b>이 쓰러지면 주변 타워가 잠시 멈춘다. 몰려 있는 칸을 조심.',
    7: '<b>흑철 기사</b>는 물리를 막는다. 서리·폭풍·광선으로.',
    10: '보스는 <b>30초</b> 안에 잡아야 한다. 놓치면 빛이 꺼진다.',
    11: '<b>분열체</b>는 쓰러지며 둘로 갈라진다. 필드 수가 순식간에 늘어난다.',
    17: '<b>폭풍 포식자</b>는 번개를 먹는다. 폭풍 오벨리스크는 쉬게 두자.',
    19: '<b>화염 정령</b>은 불에 강하다. 박격포 피해가 절반.',
    20: '<b>빙하 거인</b>은 10초마다 보호막을 두른다. 화력을 몰아서.',
    30: '<b>가시나무 군주</b>는 새싹을 불러낸다. 보스를 놓치면 필드가 넘친다.',
    40: '마지막 보스, <b>용암 군주</b>. 주변 타워를 기절시킨다. 신화를 준비하라.'
};

/** 웨이브별 '보통 적 하나의 체력 배율' (기존 hpScale 대신) */
export function hpCurve(waveNo) {
    return Math.pow(RTD.hpGrowth, waveNo - 1) * (1 + 0.012 * waveNo);
}

/** 보스 체력 배율 (기본 체력 기준) */
export const BOSS_HP = { 10: 0.6, 20: 2.3, 30: 5.6, 40: 9.6 };
export const BOSS_SPEED = 2.6;

/**
 * 웨이브 목록을 만든다. hpScale(wave) 배율은 엔진이 곱하므로, 그룹 hpMul로 hpCurve에 맞춘다.
 * 소환 간격은 웨이브 안에서 고르게(보통 14초 안), 그룹 둘이면 번갈아 섞인다.
 */
export function rtdWaves(hpScale) {
    return TABLE.map((groups, i) => {
        const waveNo = i + 1;
        const boss = waveNo % 10 === 0;
        const scale = hpScale(waveNo);
        const out = groups.map((grp, k) => {
            const span = boss ? 0 : 13 - (groups.length - 1) * 1.5;
            const gap = boss ? 1 : Math.max(0.25, span / grp.count);
            const hpMul = boss ? BOSS_HP[waveNo] / scale : (RTD.mobHp * hpCurve(waveNo)) / scale;
            return {
                enemy: grp.enemy,
                count: grp.count,
                gap: +gap.toFixed(3),
                delay: boss ? 0.5 : k * 0.6,
                elite: !!grp.elite,
                hpMul,
                // 보스는 제한 시간 안에 고리를 거의 한 바퀴 돈다 (모든 칸의 타워가 한 번씩 노릴 수 있게)
                speedMul: boss ? BOSS_SPEED : 1,
                // 처치 골드: 랜디는 마리당 적게 주고 웨이브 보상·이자로 굴린다
                bounty: boss ? RTD.bossGold : grp.elite ? 10 : waveNo > 25 ? 4 : waveNo > 10 ? 3 : 2
            };
        });
        return { groups: out, boss, hint: HINTS[waveNo] || null };
    });
}
