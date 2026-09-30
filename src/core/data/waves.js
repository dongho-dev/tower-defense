// 웨이브 정의. 그룹 = { enemy, count, gap(초), delay(웨이브 시작 기준 초), elite?, path?, hpMul? }

const g = (enemy, count, gap, delay = 0, extra = {}) => ({ enemy, count, gap, delay, ...extra });

export const WAVES = {
    dusk: [
        { groups: [g('grunt', 8, 1.1)] },
        { groups: [g('grunt', 10, 0.9), g('stalker', 4, 0.6, 7)] },
        { groups: [g('grunt', 12, 0.8), g('stalker', 6, 0.5, 5)] },
        {
            groups: [g('ironclad', 3, 2.6), g('grunt', 10, 0.7, 3)],
            hint: '흑철 기사는 물리 피해에 강합니다. 마법 타워를 섞으세요.'
        },
        {
            groups: [g('wraith', 6, 1.0), g('grunt', 10, 0.7, 2)],
            hint: '망령은 마법 피해에 강합니다. 궁수탑과 박격포가 효과적이에요.'
        },
        { groups: [g('stalker', 14, 0.45), g('ironclad', 3, 2.0, 5)] },
        {
            groups: [g('grunt', 14, 0.6), g('hexcaller', 2, 4, 4), g('wraith', 6, 0.9, 6)],
            hint: '주술사는 주변 아군을 치유합니다. 먼저 쓰러뜨리세요.'
        },
        { groups: [g('ironclad', 6, 1.6), g('hexcaller', 2, 5, 3), g('stalker', 10, 0.4, 8)] },
        { groups: [g('wraith', 12, 0.7), g('grunt', 16, 0.5, 3)] },
        {
            groups: [g('ironclad', 2, 5, 0, { elite: true }), g('ironclad', 4, 1.8, 2), g('hexcaller', 3, 3, 4)],
            hint: '정예 흑철 기사 접근. 서리로 묶고 번개로 녹이세요.'
        },
        { groups: [g('stalker', 20, 0.35), g('wraith', 8, 0.8, 5)] },
        { groups: [g('grunt', 24, 0.4), g('ironclad', 6, 1.4, 4), g('hexcaller', 3, 3, 6)] },
        { groups: [g('wraith', 14, 0.6), g('hexcaller', 4, 2.5, 3)] },
        { groups: [g('ironclad', 10, 1.1), g('stalker', 16, 0.35, 6)] },
        { groups: [g('wraith', 3, 3, 0, { elite: true }), g('grunt', 20, 0.4, 2), g('wraith', 10, 0.6, 6)] },
        {
            groups: [
                g('grunt', 20, 0.35),
                g('stalker', 16, 0.3, 4),
                g('ironclad', 6, 1.2, 6),
                g('hexcaller', 4, 2.5, 8)
            ]
        },
        { groups: [g('ironclad', 14, 0.9), g('hexcaller', 6, 2, 4)] },
        { groups: [g('wraith', 20, 0.45), g('ironclad', 3, 4, 6, { elite: true })] },
        {
            groups: [
                g('stalker', 24, 0.3),
                g('grunt', 24, 0.35, 3),
                g('ironclad', 10, 1.0, 6),
                g('wraith', 12, 0.6, 9),
                g('hexcaller', 6, 2, 10)
            ]
        },
        {
            groups: [
                g('grunt', 16, 0.5),
                g('ironclad', 6, 1.5, 3),
                g('colossus', 1, 1, 9),
                g('hexcaller', 4, 3, 10),
                g('wraith', 10, 0.7, 14)
            ],
            hint: '공허의 거상이 깨어났습니다. 모든 힘을 쏟아부으세요!'
        }
    ]
};

// 서리 협곡: path 0 = 북쪽 갈래, 1 = 남쪽 갈래
const N = { path: 0 };
const S = { path: 1 };
WAVES.frostvale = [
    {
        groups: [g('grunt', 6, 1.1, 0, N), g('grunt', 6, 1.1, 4, S)],
        hint: '두 갈래 길에서 동시에 온다. 합류 지점의 소켓이 양쪽을 모두 노린다.'
    },
    { groups: [g('grunt', 8, 0.9, 0, N), g('stalker', 6, 0.6, 3, S)] },
    { groups: [g('stalker', 8, 0.5, 0, N), g('stalker', 8, 0.5, 0, S), g('grunt', 8, 0.7, 5, N)] },
    { groups: [g('ironclad', 3, 2.4, 0, S), g('grunt', 12, 0.6, 2, N)] },
    { groups: [g('wraith', 6, 0.9, 0, N), g('wraith', 6, 0.9, 2, S), g('grunt', 8, 0.6, 5, S)] },
    { groups: [g('hexcaller', 2, 4, 0, N), g('ironclad', 4, 1.8, 1, N), g('stalker', 12, 0.4, 3, S)] },
    { groups: [g('grunt', 16, 0.45, 0, S), g('wraith', 8, 0.7, 3, N), g('hexcaller', 2, 4, 5, S)] },
    { groups: [g('ironclad', 6, 1.4, 0, N), g('ironclad', 6, 1.4, 4, S), g('hexcaller', 3, 3, 6, N)] },
    { groups: [g('stalker', 18, 0.3, 0, N), g('wraith', 12, 0.55, 2, S)] },
    {
        groups: [
            g('ironclad', 2, 5, 0, { ...N, elite: true }),
            g('wraith', 2, 5, 2, { ...S, elite: true }),
            g('grunt', 14, 0.5, 4, S)
        ],
        hint: '양쪽에서 정예가 온다. 한쪽을 스킬로 묶어두자.'
    },
    { groups: [g('grunt', 20, 0.35, 0, N), g('stalker', 16, 0.3, 3, S), g('hexcaller', 4, 2.5, 6, N)] },
    { groups: [g('wraith', 14, 0.5, 0, S), g('ironclad', 8, 1.1, 3, N)] },
    { groups: [g('ironclad', 10, 0.9, 0, S), g('hexcaller', 5, 2, 3, S), g('stalker', 14, 0.35, 5, N)] },
    { groups: [g('wraith', 16, 0.45, 0, N), g('wraith', 16, 0.45, 2, S)] },
    {
        groups: [
            g('ironclad', 3, 3.5, 0, { ...S, elite: true }),
            g('grunt', 24, 0.35, 2, N),
            g('hexcaller', 4, 2.5, 5, S)
        ]
    },
    { groups: [g('stalker', 22, 0.28, 0, S), g('ironclad', 10, 0.9, 3, N), g('wraith', 10, 0.6, 6, S)] },
    { groups: [g('hexcaller', 6, 1.8, 0, N), g('ironclad', 14, 0.8, 1, N), g('grunt', 20, 0.4, 4, S)] },
    {
        groups: [
            g('wraith', 3, 3, 0, { ...N, elite: true }),
            g('ironclad', 3, 3, 0, { ...S, elite: true }),
            g('wraith', 20, 0.4, 5, N)
        ]
    },
    {
        groups: [
            g('stalker', 20, 0.28, 0, N),
            g('stalker', 20, 0.28, 0, S),
            g('ironclad', 12, 0.9, 5, N),
            g('wraith', 14, 0.5, 8, S),
            g('hexcaller', 6, 2, 10, N)
        ]
    },
    {
        groups: [
            g('grunt', 16, 0.45, 0, N),
            g('grunt', 16, 0.45, 0, S),
            g('colossus', 1, 1, 8, S),
            g('ironclad', 3, 3, 10, { ...N, elite: true }),
            g('wraith', 14, 0.6, 14, N)
        ],
        hint: '거상이 남쪽 갈래로 내려온다. 북쪽의 정예도 잊지 마라!'
    }
];

// 공허의 첨탑: path 0 = 북쪽, 1 = 서쪽, 2 = 남쪽
const PN = { path: 0 };
const PW = { path: 1 };
const PS = { path: 2 };
WAVES.voidspire = [
    {
        groups: [g('grunt', 5, 1.1, 0, PN), g('grunt', 5, 1.1, 2, PW), g('grunt', 5, 1.1, 4, PS)],
        hint: '균열 세 곳이 열렸다. 심장부 가까이에 화력을 모으자.'
    },
    { groups: [g('stalker', 6, 0.6, 0, PW), g('grunt', 8, 0.8, 2, PN), g('grunt', 8, 0.8, 2, PS)] },
    { groups: [g('ironclad', 3, 2.2, 0, PW), g('wraith', 6, 0.9, 2, PN), g('stalker', 8, 0.5, 4, PS)] },
    { groups: [g('grunt', 12, 0.5, 0, PS), g('hexcaller', 2, 4, 2, PS), g('stalker', 10, 0.45, 3, PN)] },
    { groups: [g('wraith', 10, 0.7, 0, PW), g('ironclad', 5, 1.6, 2, PN)] },
    { groups: [g('stalker', 10, 0.35, 0, PN), g('stalker', 10, 0.35, 0, PW), g('stalker', 10, 0.35, 0, PS)] },
    { groups: [g('ironclad', 6, 1.3, 0, PS), g('hexcaller', 3, 3, 2, PS), g('wraith', 10, 0.6, 4, PN)] },
    { groups: [g('grunt', 18, 0.4, 0, PW), g('wraith', 12, 0.55, 3, PS), g('hexcaller', 3, 3, 5, PN)] },
    { groups: [g('ironclad', 8, 1.1, 0, PN), g('ironclad', 8, 1.1, 2, PS), g('stalker', 14, 0.35, 5, PW)] },
    {
        groups: [
            g('ironclad', 2, 4, 0, { ...PW, elite: true }),
            g('wraith', 2, 4, 1, { ...PN, elite: true }),
            g('hexcaller', 2, 4, 2, { ...PS, elite: true }),
            g('grunt', 16, 0.45, 4, PS)
        ],
        hint: '정예 셋이 각 균열에서 동시에 온다.'
    },
    { groups: [g('wraith', 16, 0.45, 0, PW), g('stalker', 18, 0.3, 3, PN), g('hexcaller', 4, 2.5, 5, PW)] },
    { groups: [g('ironclad', 12, 0.9, 0, PS), g('grunt', 22, 0.35, 2, PN), g('hexcaller', 4, 2.5, 6, PS)] },
    { groups: [g('wraith', 14, 0.45, 0, PN), g('wraith', 14, 0.45, 0, PS), g('ironclad', 6, 1.2, 4, PW)] },
    { groups: [g('stalker', 24, 0.26, 0, PW), g('ironclad', 12, 0.85, 3, PN), g('hexcaller', 6, 2, 5, PN)] },
    {
        groups: [
            g('ironclad', 3, 3, 0, { ...PN, elite: true }),
            g('ironclad', 3, 3, 0, { ...PS, elite: true }),
            g('wraith', 18, 0.45, 4, PW)
        ]
    },
    {
        groups: [
            g('grunt', 26, 0.3, 0, PS),
            g('stalker', 20, 0.28, 2, PN),
            g('wraith', 14, 0.5, 5, PW),
            g('hexcaller', 6, 2, 7, PS)
        ]
    },
    { groups: [g('ironclad', 16, 0.75, 0, PW), g('hexcaller', 6, 1.8, 3, PW), g('wraith', 16, 0.45, 5, PN)] },
    {
        groups: [
            g('wraith', 3, 2.5, 0, { ...PW, elite: true }),
            g('stalker', 3, 2.5, 0, { ...PN, elite: true }),
            g('ironclad', 3, 2.5, 0, { ...PS, elite: true }),
            g('grunt', 24, 0.35, 5, PN)
        ]
    },
    {
        groups: [
            g('stalker', 20, 0.26, 0, PN),
            g('stalker', 20, 0.26, 0, PS),
            g('ironclad', 14, 0.8, 4, PW),
            g('wraith', 16, 0.45, 8, PN),
            g('hexcaller', 8, 1.6, 10, PS)
        ]
    },
    {
        groups: [
            g('grunt', 18, 0.4, 0, PN),
            g('grunt', 18, 0.4, 0, PS),
            g('colossus', 1, 1, 6, { ...PW, hpMul: 0.7 }),
            g('colossus', 1, 1, 40, { ...PN, hpMul: 0.7 }),
            g('wraith', 12, 0.5, 14, PS)
        ],
        hint: '거상이 둘이다. 첫 거상을 쓰러뜨릴 스킬을 아끼지 마라.'
    }
];

export function waveEnemyCount(wave) {
    return wave.groups.reduce((n, grp) => n + grp.count, 0);
}

/** 웨이브 미리보기용 요약: [{ enemy, count, elite }] */
export function waveSummary(wave) {
    const map = new Map();
    for (const grp of wave.groups) {
        const k = grp.enemy + (grp.elite ? '*' : '');
        const cur = map.get(k) || { enemy: grp.enemy, count: 0, elite: !!grp.elite };
        cur.count += grp.count;
        map.set(k, cur);
    }
    return [...map.values()];
}
