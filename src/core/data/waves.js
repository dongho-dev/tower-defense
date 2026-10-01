import { ENEMIES } from './enemies.js';

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

// ---------- 공용 캠페인 템플릿 (새 맵용) ----------
// [enemy, count, gap, delay, extra]. 갈래가 여럿이면 큰 무리는 갈래마다 나눠 보낸다.
const TEMPLATE = [
    { g: [['grunt', 10, 1.0]] },
    {
        g: [
            ['grunt', 10, 0.9],
            ['stalker', 6, 0.6, 5]
        ]
    },
    {
        g: [
            ['grunt', 12, 0.7],
            ['stalker', 8, 0.5, 4]
        ]
    },
    {
        g: [
            ['ironclad', 3, 2.4],
            ['grunt', 12, 0.6, 3]
        ],
        hint: '흑철 기사는 물리 피해에 강합니다. 마법 타워를 섞으세요.'
    },
    {
        g: [
            ['wraith', 8, 0.9],
            ['grunt', 10, 0.6, 3]
        ],
        hint: '망령은 마법 피해에 강합니다. 궁수탑과 박격포가 효과적이에요.'
    },
    {
        g: [
            ['stalker', 16, 0.4],
            ['ironclad', 4, 1.8, 5]
        ]
    },
    {
        g: [
            ['grunt', 16, 0.5],
            ['hexcaller', 2, 4, 4],
            ['wraith', 8, 0.8, 6]
        ],
        hint: '주술사는 주변 아군을 치유합니다. 먼저 쓰러뜨리세요.'
    },
    {
        g: [
            ['ironclad', 8, 1.3],
            ['hexcaller', 3, 3, 3],
            ['stalker', 12, 0.4, 7]
        ]
    },
    {
        g: [
            ['wraith', 14, 0.6],
            ['grunt', 18, 0.45, 3]
        ]
    },
    {
        g: [
            ['ironclad', 2, 4, 0, { elite: true }],
            ['ironclad', 5, 1.6, 2],
            ['hexcaller', 3, 3, 4]
        ],
        hint: '정예 등장. 공명과 스킬을 아끼지 마세요.'
    },
    {
        g: [
            ['stalker', 22, 0.3],
            ['wraith', 10, 0.7, 4]
        ]
    },
    {
        g: [
            ['grunt', 26, 0.35],
            ['ironclad', 8, 1.2, 4],
            ['hexcaller', 4, 2.5, 6]
        ]
    },
    {
        g: [
            ['wraith', 16, 0.5],
            ['hexcaller', 5, 2.2, 3]
        ]
    },
    {
        g: [
            ['ironclad', 12, 0.9],
            ['stalker', 18, 0.3, 6]
        ]
    },
    {
        g: [
            ['wraith', 3, 3, 0, { elite: true }],
            ['grunt', 24, 0.35, 2],
            ['wraith', 12, 0.55, 6]
        ]
    },
    {
        g: [
            ['grunt', 22, 0.32],
            ['stalker', 18, 0.28, 4],
            ['ironclad', 8, 1.1, 6],
            ['hexcaller', 5, 2.2, 8]
        ]
    },
    {
        g: [
            ['ironclad', 16, 0.8],
            ['hexcaller', 6, 1.8, 4]
        ]
    },
    {
        g: [
            ['wraith', 22, 0.42],
            ['ironclad', 4, 3.5, 6, { elite: true }]
        ]
    },
    {
        g: [
            ['stalker', 26, 0.26],
            ['grunt', 24, 0.32, 3],
            ['ironclad', 12, 0.9, 6],
            ['wraith', 14, 0.5, 9],
            ['hexcaller', 6, 1.8, 10]
        ]
    },
    {
        g: [
            ['grunt', 18, 0.45],
            ['ironclad', 8, 1.3, 3],
            ['colossus', 1, 1, 9],
            ['hexcaller', 5, 2.5, 10],
            ['wraith', 12, 0.6, 14]
        ],
        hint: '공허의 거상이 깨어났습니다. 모든 힘을 쏟아부으세요!'
    }
];

const FLAVOR = {
    swarm: { grunt: 1.25, stalker: 1.3, ironclad: 0.8 },
    armored: { ironclad: 1.35, wraith: 0.8 },
    spectral: { wraith: 1.35, grunt: 0.85 }
};

/** 템플릿을 맵에 맞춘다: 갈래 수만큼 나누고, 맛(flavor)에 따라 종류별 수를 바꾼다 */
export function campaignWaves(pathCount = 1, flavor = null) {
    const fl = FLAVOR[flavor] || {};
    return TEMPLATE.map((w, wi) => {
        const groups = [];
        w.g.forEach(([enemy, count, gap, delay = 0, extra = {}], gi) => {
            const n = enemy === 'colossus' ? count : Math.max(1, Math.round(count * (fl[enemy] || 1)));
            if (pathCount > 1 && n >= 6) {
                const per = Math.ceil(n / pathCount);
                for (let p = 0; p < pathCount; p++) {
                    groups.push(g(enemy, per, gap * 1.15, delay + p * 1.5, { ...extra, path: p }));
                }
            } else {
                groups.push(g(enemy, n, gap, delay, { ...extra, path: (wi + gi) % pathCount }));
            }
        });
        return { groups, ...(w.hint ? { hint: w.hint } : {}) };
    });
}

WAVES.cinder = campaignWaves(1, 'swarm');
WAVES.bloom = campaignWaves(2, 'spectral');
WAVES.stormreach = campaignWaves(2, 'armored');

// 성채 방어(공성전 전용): path 0 = 북문, 1 = 동문, 2 = 남문, 3 = 서문.
// 매 웨이브 주공 방향이 바뀌어서 어느 성문을 보강할지 고르게 만든다.
const GN = { path: 0 };
const GE = { path: 1 };
const GS = { path: 2 };
const GW = { path: 3 };
WAVES.fortress = [
    {
        groups: [g('grunt', 8, 1.1, 0, GW)],
        hint: '적은 성문 앞에서 멈춰 문을 부순다. 문이 버티는 동안 성벽 위 타워로 쓰러뜨리세요.'
    },
    { groups: [g('grunt', 8, 1.0, 0, GN), g('stalker', 5, 0.7, 4, GW)] },
    { groups: [g('grunt', 10, 0.9, 0, GE), g('grunt', 6, 0.9, 3, GS), g('stalker', 6, 0.6, 6, GW)] },
    {
        groups: [g('ironclad', 3, 2.4, 0, GN), g('grunt', 10, 0.7, 2, GN), g('stalker', 8, 0.5, 4, GS)],
        hint: '흑철 기사가 북문을 두드린다. 성문을 눌러 보강하거나 수리할 수 있어요.'
    },
    {
        groups: [g('wraith', 6, 0.9, 0, GE), g('grunt', 12, 0.6, 2, GW)],
        hint: '망령은 날아서 성벽을 넘습니다. 성 안쪽에도 궁수탑이 필요해요.'
    },
    { groups: [g('stalker', 14, 0.4, 0, GS), g('ironclad', 4, 1.8, 4, GE), g('grunt', 8, 0.7, 6, GN)] },
    {
        groups: [
            g('grunt', 14, 0.55, 0, GW),
            g('hexcaller', 2, 4, 4, GW),
            g('wraith', 6, 0.8, 6, GN),
            g('ironclad', 3, 2, 3, GS)
        ]
    },
    {
        groups: [
            g('ironclad', 6, 1.4, 0, GE),
            g('hexcaller', 2, 4, 3, GE),
            g('stalker', 10, 0.4, 5, GN),
            g('grunt', 10, 0.6, 7, GS)
        ]
    },
    { groups: [g('wraith', 10, 0.7, 0, GS), g('grunt', 16, 0.45, 2, GN), g('stalker', 10, 0.4, 5, GW)] },
    {
        groups: [
            g('ironclad', 2, 4, 0, { ...GW, elite: true }),
            g('ironclad', 5, 1.6, 2, GW),
            g('hexcaller', 3, 3, 4, GN),
            g('grunt', 12, 0.6, 5, GE)
        ],
        hint: '정예 흑철 기사가 서문으로 온다. 서문을 보강해 두세요.'
    },
    { groups: [g('stalker', 18, 0.3, 0, GE), g('wraith', 8, 0.7, 4, GN), g('grunt', 14, 0.5, 6, GS)] },
    {
        groups: [
            g('grunt', 20, 0.35, 0, GN),
            g('ironclad', 6, 1.4, 4, GS),
            g('hexcaller', 3, 3, 6, GW),
            g('stalker', 12, 0.35, 8, GE)
        ]
    },
    { groups: [g('wraith', 14, 0.5, 0, GW), g('hexcaller', 4, 2.5, 3, GE), g('ironclad', 8, 1.1, 5, GE)] },
    {
        groups: [
            g('ironclad', 10, 0.9, 0, GN),
            g('stalker', 14, 0.35, 4, GS),
            g('grunt', 14, 0.45, 6, GW),
            g('ironclad', 4, 1.8, 8, GE)
        ],
        hint: '네 성문을 한꺼번에 친다. 가장 약한 문부터 수리하세요.'
    },
    {
        groups: [
            g('wraith', 3, 3, 0, { ...GS, elite: true }),
            g('grunt', 20, 0.4, 2, GE),
            g('wraith', 10, 0.6, 6, GN),
            g('stalker', 12, 0.35, 8, GW)
        ]
    },
    {
        groups: [
            g('grunt', 16, 0.4, 0, GN),
            g('stalker', 14, 0.3, 3, GE),
            g('ironclad', 8, 1.1, 5, GS),
            g('hexcaller', 4, 2.5, 7, GW),
            g('grunt', 12, 0.45, 9, GW)
        ]
    },
    {
        groups: [
            g('ironclad', 12, 0.8, 0, GW),
            g('hexcaller', 5, 2, 3, GW),
            g('ironclad', 6, 1.4, 6, GN),
            g('stalker', 16, 0.3, 6, GS)
        ]
    },
    {
        groups: [
            g('wraith', 18, 0.42, 0, GE),
            g('ironclad', 3, 3.5, 6, { ...GN, elite: true }),
            g('grunt', 16, 0.4, 4, GS)
        ]
    },
    {
        groups: [
            g('stalker', 18, 0.3, 0, GN),
            g('grunt', 18, 0.35, 3, GS),
            g('ironclad', 10, 0.9, 6, GE),
            g('wraith', 12, 0.5, 9, GW),
            g('hexcaller', 5, 2, 10, GE)
        ]
    },
    {
        groups: [
            g('grunt', 14, 0.5, 0, GN),
            g('ironclad', 6, 1.4, 3, GE),
            g('colossus', 1, 1, 9, GW),
            g('hexcaller', 4, 3, 10, GW),
            g('wraith', 10, 0.6, 14, GS),
            g('ironclad', 6, 1.4, 16, GS)
        ],
        hint: '공허의 거상이 서문으로 온다. 거상은 성문을 두 배 가까이 세게 친다!'
    }
];

// 얼어붙은 분지(살아남기): 판이 시작되면 밤 시계가 흐르고, at = 시계(초)에 웨이브가 저절로 온다.
// 적은 모두 맵 한가운데 둥지에서 쏟아진다. 첫 습격까지 110초는 생존자가 고원을 찾아 본진을 짓는 시간,
// 930초(15분 30초)에 동이 튼다. 6:30 · 10:30 · 14:30에 빙하 거신(보스)이 나온다 (HUD가 30초 전부터 경고한다).
const NEST = {};
const BOSS = (hpMul) => ({ hpMul });

WAVES.mountain = [
    {
        at: 110,
        groups: [g('grunt', 8, 0.8, 0, NEST)],
        hint: '둥지가 깨어났다! 적은 가장 가까운 건물을 노린다. 비탈(입구)을 방벽으로 막고 그 뒤에 타워를 세우세요.'
    },
    { at: 150, groups: [g('grunt', 10, 0.7, 0, NEST), g('stalker', 4, 0.5, 4, NEST)] },
    {
        at: 190,
        groups: [g('grunt', 12, 0.6, 0, NEST), g('stalker', 6, 0.5, 3, NEST), g('rimeguard', 2, 2, 6, NEST)],
        hint: '길이 막혔거나 너무 돌아가야 하면 적은 방벽부터 부순다. 다친 벽은 G로 수리하세요.'
    },
    {
        at: 230,
        groups: [g('harpy', 6, 0.6, 0, NEST), g('grunt', 12, 0.6, 2, NEST)],
        hint: '하피는 하늘을 날아 벽을 넘는다. 본진 둘레에도 타워를 두세요.'
    },
    { at: 270, groups: [g('grunt', 16, 0.5, 0, NEST), g('rimeguard', 3, 1.5, 3, NEST), g('hexcaller', 2, 3, 6, NEST)] },
    { at: 310, groups: [g('stalker', 18, 0.3, 0, NEST), g('yeti', 2, 3, 4, NEST)] },
    { at: 350, groups: [g('grunt', 20, 0.45, 0, NEST), g('rimeguard', 6, 1.2, 3, NEST), g('harpy', 8, 0.6, 6, NEST)] },
    {
        at: 390,
        groups: [g('glacier', 1, 1, 0, BOSS(0.4)), g('grunt', 16, 0.5, 2, NEST), g('rimeguard', 4, 1.4, 6, NEST)],
        hint: '빙하 거신이 깨어났다. 체력이 엄청나다 · 방벽 여러 겹으로 붙잡아 두고 화력을 모으세요.'
    },
    { at: 430, groups: [g('yeti', 5, 1.6, 0, NEST), g('hexcaller', 3, 2.5, 3, NEST), g('grunt', 20, 0.45, 4, NEST)] },
    {
        at: 470,
        groups: [g('harpy', 14, 0.45, 0, NEST), g('wraith', 6, 1, 3, NEST), g('stalker', 16, 0.35, 5, NEST)],
        hint: '하늘이 새까맣다. 외딴 광산을 먼저 노린다.'
    },
    {
        at: 510,
        groups: [g('rimeguard', 10, 0.9, 0, NEST), g('ironclad', 6, 1.4, 3, NEST), g('grunt', 24, 0.4, 5, NEST)]
    },
    {
        at: 550,
        groups: [g('yeti', 8, 1.2, 0, NEST), g('yeti', 1, 1, 6, { elite: true }), g('stalker', 24, 0.3, 3, NEST)]
    },
    { at: 590, groups: [g('grunt', 30, 0.35, 0, NEST), g('hexcaller', 4, 2.5, 3, NEST), g('harpy', 12, 0.5, 6, NEST)] },
    {
        at: 630,
        groups: [g('glacier', 1, 1, 0, BOSS(0.7)), g('yeti', 6, 1.5, 3, NEST), g('rimeguard', 8, 1, 6, NEST)],
        hint: '두 번째 빙하 거신. 벽이 무너지기 전에 수리하고, 서리로 묶어 두세요.'
    },
    {
        at: 670,
        groups: [g('rimeguard', 14, 0.7, 0, NEST), g('wraith', 10, 0.8, 3, NEST), g('grunt', 30, 0.35, 5, NEST)]
    },
    { at: 710, groups: [g('stalker', 40, 0.2, 0, NEST), g('yeti', 6, 1.4, 4, NEST)] },
    { at: 750, groups: [g('ironclad', 12, 0.9, 0, NEST), g('hexcaller', 5, 2, 3, NEST), g('harpy', 16, 0.4, 5, NEST)] },
    {
        at: 790,
        groups: [g('grunt', 40, 0.3, 0, NEST), g('rimeguard', 14, 0.7, 3, NEST), g('yeti', 8, 1.2, 6, NEST)]
    },
    {
        at: 830,
        groups: [
            g('wraith', 16, 0.6, 0, NEST),
            g('harpy', 16, 0.5, 2, NEST),
            g('yeti', 8, 1.2, 4, NEST),
            g('ironclad', 8, 1.2, 6, NEST)
        ]
    },
    {
        at: 870,
        // 동이 틀 때까지 끊이지 않고 몰려온다 (60초)
        groups: [
            g('glacier', 1, 1, 0, NEST),
            g('grunt', 50, 1.0, 1, NEST),
            g('stalker', 36, 1.4, 2, NEST),
            g('rimeguard', 16, 3.4, 4, NEST),
            g('yeti', 10, 5, 6, NEST),
            g('harpy', 20, 2.6, 8, NEST),
            g('hexcaller', 6, 8, 10, NEST)
        ],
        hint: '마지막 대공세! 동이 틀 때까지 본진을 지키면 승리한다.'
    }
];

// ---------- 맵 컨셉: 전용 적과 보스 ----------
// mix: [바꿀 적, 전용 적, 처음 섞이는 웨이브, 비율]. 전용 적 수는 체력 합이 비슷하도록 맞춘다.
export const THEMES = {
    cinder: {
        boss: 'magmaLord',
        mix: [
            ['stalker', 'cinderling', 3, 0.5],
            ['grunt', 'flameborn', 5, 0.35],
            ['wraith', 'flameborn', 9, 0.3]
        ]
    },
    frostvale: {
        boss: 'glacier',
        mix: [
            ['ironclad', 'rimeguard', 4, 0.35],
            ['grunt', 'yeti', 6, 0.3]
        ]
    },
    voidspire: {
        boss: 'riftlord',
        mix: [
            ['stalker', 'shade', 3, 0.5],
            ['grunt', 'splitter', 5, 0.35]
        ]
    },
    bloom: {
        boss: 'thornwood',
        mix: [
            ['grunt', 'bloomer', 3, 0.35],
            ['ironclad', 'burrower', 5, 0.5]
        ]
    },
    // 성채 방어: 성문을 터뜨리는 자폭병과 빙결에 버티는 서리 갑주병이 공성 부대를 이룬다
    fortress: {
        mix: [
            ['stalker', 'cinderling', 4, 0.4],
            ['ironclad', 'rimeguard', 7, 0.35]
        ]
    },
    // 눈마루 고개: 산의 주인 빙하 거신, 눈사태 거인·서리 갑주병, 바위산 하피
    mountain: {
        boss: 'glacier',
        mix: [
            ['wraith', 'harpy', 5, 0.45],
            ['ironclad', 'rimeguard', 7, 0.35],
            ['grunt', 'yeti', 9, 0.25]
        ]
    },
    stormreach: {
        boss: 'tempest',
        mix: [
            ['wraith', 'harpy', 3, 0.5],
            ['ironclad', 'stormeater', 4, 0.3]
        ]
    }
};

/** 분열·소환까지 친 실질 체력 */
function effHp(id) {
    const d = ENEMIES[id];
    return d.hp + (d.split ? d.split.count * ENEMIES[d.split.into].hp : 0);
}

/** 웨이브에 맵 전용 적을 섞고, 거상을 맵 보스로 바꾼다 */
export function applyTheme(wave, themeId, waveNo) {
    const th = THEMES[themeId];
    if (!th) return wave;
    const groups = [];
    let bossName = null;
    const fresh = [];
    for (const grp of wave.groups) {
        // 거상이 여럿이면 첫 거상만 맵 보스로 바꾼다
        if (grp.enemy === 'colossus' && th.boss && !bossName) {
            groups.push({ ...grp, enemy: th.boss });
            bossName = th.boss;
            continue;
        }
        const rule = th.mix.find(([from, , at]) => from === grp.enemy && waveNo >= at);
        if (!rule || grp.count < 2) {
            groups.push(grp);
            continue;
        }
        const [from, to, , share] = rule;
        const take = Math.max(1, Math.round(grp.count * share));
        const n = Math.max(1, Math.round((take * effHp(from)) / effHp(to)));
        if (grp.count - take > 0) groups.push({ ...grp, count: grp.count - take });
        groups.push({
            ...grp,
            enemy: to,
            count: n,
            gap: Math.min(4, (grp.gap * grp.count) / n),
            delay: grp.delay + grp.gap * 0.5
        });
        fresh.push(to);
    }
    let hint = wave.hint || null;
    if (bossName) hint = `${ENEMIES[bossName].name} 출현! ${ENEMIES[bossName].tip}`;
    return { ...wave, groups, hint, themed: fresh };
}

for (const id of Object.keys(THEMES)) {
    if (WAVES[id]) WAVES[id] = WAVES[id].map((w, i) => applyTheme(w, id, i + 1));
}

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

// ---------- 끝없는 밤: 20웨이브 이후 자동 생성 ----------

export const CAMPAIGN_WAVES = 20;

function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// 적 종류별 기본 수와 간격 (후반 웨이브 기준)
const ENDLESS_POOL = [
    ['grunt', 20, 0.38],
    ['stalker', 20, 0.28],
    ['ironclad', 10, 0.9],
    ['wraith', 14, 0.5],
    ['hexcaller', 5, 2]
];

/**
 * waveNo(21~)번째 웨이브를 결정적으로 만든다. 같은 맵·같은 번호면 항상 같은 웨이브.
 * 체력은 hpScale(waveNo)로 계속 오르고, 수와 정예 비중이 조금씩 늘며 5웨이브마다 거상이 온다.
 */
export function endlessWave(waveNo, pathCount = 1, seed = 0) {
    const k = waveNo - CAMPAIGN_WAVES;
    const rand = rng(waveNo * 7919 + seed * 104729);
    const pick = (arr) => arr[Math.floor(rand() * arr.length)];
    const path = () => ({ path: Math.floor(rand() * pathCount) });
    const grow = 1 + Math.min(1.2, k * 0.05);
    const groups = [];
    const n = 3 + Math.min(3, Math.floor(k / 4));
    for (let i = 0; i < n; i++) {
        const [enemy, count, gap] = pick(ENDLESS_POOL);
        groups.push(g(enemy, Math.round((count * grow) / Math.max(1, pathCount * 0.6)), gap, i * 3, path()));
    }
    const elite = pick(['ironclad', 'wraith', 'stalker', 'hexcaller']);
    groups.push(g(elite, Math.min(8, 2 + Math.floor(k / 4)), 2.5, 4, { ...path(), elite: true }));
    let hint = null;
    if (k % 5 === 0) {
        const bosses = 1 + Math.floor(k / 15);
        for (let i = 0; i < bosses; i++) {
            groups.push(g('colossus', 1, 1, 8 + i * 18, { path: (i + Math.floor(rand() * pathCount)) % pathCount }));
        }
        hint = bosses > 1 ? `거상 ${bosses}체가 몰려온다. 끝없는 밤이 깊어진다.` : '거상이 다시 깨어났다.';
    }
    return { groups, hint, endless: true };
}
