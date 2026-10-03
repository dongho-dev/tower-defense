// 타워 정의. tiers[0..2] = 레벨 1~3, branches.a / .b = 레벨 3 이후 특화.
// rate = 공격 간격(초), range/splash = 월드 단위, cost = 해당 단계로 가는 비용.

export const TOWER_ORDER = ['ranger', 'ember', 'frost', 'storm', 'arcane', 'mine', 'barracks'];

export const TOWERS = {
    ranger: {
        id: 'ranger',
        name: '궁수탑',
        en: 'Ranger Spire',
        hotkey: '1',
        dmgType: 'physical',
        color: '#f2c46b',
        role: '빠른 단일 사격',
        attack: 'arrow',
        projectileSpeed: 17,
        resonance: { stat: 'range', value: 0.12, name: '매의 눈', desc: '연결된 타워 사거리 +12%' },
        tiers: [
            { cost: 70, dmg: 12, rate: 0.6, range: 3.6 },
            { cost: 50, dmg: 20, rate: 0.55, range: 3.9 },
            { cost: 85, dmg: 32, rate: 0.5, range: 4.1 }
        ],
        branches: {
            a: {
                name: '저격수',
                desc: '한 발이 무거운 장거리 저격. 방어력 70% 관통',
                cost: 160,
                dmg: 140,
                rate: 1.5,
                range: 5.5,
                pierce: 0.7
            },
            b: {
                name: '일제 사격',
                desc: '세 표적에게 동시에 화살을 퍼붓는다',
                cost: 155,
                dmg: 30,
                rate: 0.42,
                range: 4.3,
                multi: 3
            }
        }
    },
    ember: {
        id: 'ember',
        name: '화염 박격포',
        en: 'Ember Mortar',
        hotkey: '2',
        dmgType: 'physical',
        color: '#ff7a3d',
        role: '광역 폭발',
        attack: 'mortar',
        projectileSpeed: 6.5,
        resonance: { stat: 'damage', value: 0.15, name: '열기', desc: '연결된 타워 피해 +15%' },
        tiers: [
            { cost: 110, dmg: 30, rate: 2.0, range: 4.2, splash: 1.0 },
            { cost: 75, dmg: 52, rate: 1.9, range: 4.4, splash: 1.1 },
            { cost: 120, dmg: 84, rate: 1.8, range: 4.6, splash: 1.2 }
        ],
        branches: {
            a: {
                name: '용염',
                desc: '착탄 지점을 3초간 불태운다 (초당 40 피해)',
                cost: 185,
                dmg: 96,
                rate: 1.7,
                range: 4.7,
                splash: 1.3,
                burn: { dps: 40, duration: 3, radius: 1.2 }
            },
            b: {
                name: '공성포',
                desc: '거대한 포탄. 피해와 폭발 반경이 크게 늘어난다',
                cost: 205,
                dmg: 220,
                rate: 2.2,
                range: 5.1,
                splash: 1.7
            }
        }
    },
    frost: {
        id: 'frost',
        name: '서리 첨탑',
        en: 'Frost Spire',
        hotkey: '3',
        dmgType: 'magic',
        color: '#8fe3ff',
        role: '광역 둔화',
        attack: 'shard',
        projectileSpeed: 11,
        resonance: { stat: 'vulnerable', value: 0.25, name: '취약', desc: '연결된 타워가 둔화된 적에게 피해 +25%' },
        tiers: [
            { cost: 90, dmg: 8, rate: 1.0, range: 3.3, splash: 0.9, slow: 0.35, slowTime: 1.6 },
            { cost: 60, dmg: 14, rate: 0.95, range: 3.5, splash: 1.0, slow: 0.42, slowTime: 1.8 },
            { cost: 95, dmg: 22, rate: 0.9, range: 3.7, splash: 1.1, slow: 0.5, slowTime: 2.0 }
        ],
        branches: {
            a: {
                name: '영구동토',
                desc: '사거리 안의 모든 적을 계속 둔화시키고 얼린다 (초당 30 피해)',
                cost: 170,
                dmg: 0,
                rate: 0,
                range: 3.7,
                aura: { dps: 30, slow: 0.55 }
            },
            b: {
                name: '빙결 창',
                desc: '거대한 얼음 창. 이미 둔화된 적에게 2배 피해',
                cost: 180,
                dmg: 160,
                rate: 1.4,
                range: 4.6,
                slow: 0.5,
                slowTime: 2.0,
                shatter: 2
            }
        }
    },
    storm: {
        id: 'storm',
        name: '폭풍 오벨리스크',
        en: 'Storm Obelisk',
        hotkey: '4',
        dmgType: 'magic',
        color: '#b08cff',
        role: '연쇄 번개',
        attack: 'chain',
        resonance: { stat: 'rate', value: 0.15, name: '충전', desc: '연결된 타워 공격 속도 +15%' },
        tiers: [
            { cost: 130, dmg: 22, rate: 1.5, range: 3.5, chain: 3, falloff: 0.75 },
            { cost: 85, dmg: 36, rate: 1.4, range: 3.7, chain: 3, falloff: 0.75 },
            { cost: 130, dmg: 56, rate: 1.3, range: 4, chain: 4, falloff: 0.78 }
        ],
        branches: {
            a: {
                name: '폭풍 군주',
                desc: '번개가 7번 튀고 더 빠르게 친다',
                cost: 205,
                dmg: 70,
                rate: 0.9,
                range: 4.2,
                chain: 7,
                falloff: 0.85
            },
            b: {
                name: '과충전',
                desc: '첫 표적에 거대한 피해와 0.6초 기절',
                cost: 195,
                dmg: 260,
                rate: 1.6,
                range: 4.2,
                chain: 3,
                falloff: 0.4,
                stun: 0.6
            }
        }
    },
    arcane: {
        id: 'arcane',
        name: '비전 광선탑',
        en: 'Arcane Prism',
        hotkey: '5',
        dmgType: 'magic',
        color: '#ff7ad9',
        role: '집중 광선 · 오래 비출수록 강해짐',
        attack: 'beam',
        resonance: {
            stat: 'pen',
            value: 0.25,
            name: '마력 침투',
            desc: '연결된 타워 피해가 방어·저항을 25% 무시'
        },
        // dmg는 0.1초마다, ramp: 같은 적을 비추는 동안 초당 rate씩 max배까지 강해진다
        tiers: [
            { cost: 120, dmg: 1.5, rate: 0.1, range: 3.3, ramp: { rate: 0.7, max: 3 } },
            { cost: 85, dmg: 2.5, rate: 0.1, range: 3.5, ramp: { rate: 0.75, max: 3 } },
            { cost: 120, dmg: 3.8, rate: 0.1, range: 3.7, ramp: { rate: 0.8, max: 3.5 } }
        ],
        branches: {
            a: {
                name: '집속 광선',
                desc: '한 대상에 집중해 최대 6배까지 타오르는 광선. 보스 사냥꾼',
                cost: 205,
                dmg: 5.5,
                rate: 0.1,
                range: 4.2,
                ramp: { rate: 1.1, max: 6 }
            },
            b: {
                name: '분광',
                desc: '광선이 세 갈래로 갈라져 세 적을 동시에 태운다',
                cost: 195,
                dmg: 3.6,
                rate: 0.1,
                range: 4,
                multi: 3,
                ramp: { rate: 0.8, max: 2.5 }
            }
        }
    },
    mine: {
        id: 'mine',
        name: '에테르 광산',
        en: 'Aether Mine',
        hotkey: '6',
        dmgType: 'none',
        color: '#7fe0a0',
        role: '공격하지 않는 대신 웨이브마다 골드를 캔다',
        attack: 'none',
        resonance: {
            stat: 'bounty',
            value: 0.25,
            name: '풍요',
            desc: '연결된 타워가 처치한 적 현상금 +25%'
        },
        tiers: [
            { cost: 100, range: 0, income: 20 },
            { cost: 75, range: 0, income: 34 },
            { cost: 100, range: 0, income: 50 }
        ],
        branches: {
            a: {
                name: '보물고',
                desc: '웨이브마다 80 골드를 캔다',
                cost: 170,
                range: 0,
                income: 80
            },
            b: {
                name: '연금 공방',
                desc: '수입은 조금 적지만 풍요 공명이 +60%로 커진다',
                cost: 155,
                range: 0,
                income: 45,
                resonanceValue: 0.6
            }
        }
    },
    barracks: {
        id: 'barracks',
        name: '병영',
        en: 'Garrison',
        hotkey: '7',
        dmgType: 'physical',
        color: '#9fc0ff',
        role: '병사를 길목에 보내 적을 막아 세운다',
        attack: 'barracks',
        resonance: {
            stat: 'pinned',
            value: 0.2,
            name: '협공',
            desc: '연결된 타워가 병사에게 붙잡힌 적에게 피해 +20%'
        },
        // range = 집결지를 둘 수 있는 거리. soldiers = 병사 수, hp/dmg/rate = 병사 한 명 기준, respawn = 부활 시간
        tiers: [
            { cost: 80, range: 3, soldiers: 2, hp: 130, dmg: 11, rate: 1, respawn: 9 },
            { cost: 65, range: 3.2, soldiers: 3, hp: 190, dmg: 17, rate: 1, respawn: 8.5 },
            { cost: 95, range: 3.4, soldiers: 3, hp: 270, dmg: 25, rate: 0.95, respawn: 8 }
        ],
        branches: {
            a: {
                name: '성기사단',
                desc: '갑옷이 두꺼운 성기사 3명. 받는 피해 30% 감소, 싸우는 동안에도 체력이 차오른다',
                cost: 165,
                range: 3.5,
                soldiers: 3,
                hp: 520,
                dmg: 32,
                rate: 1,
                respawn: 8,
                armor: 0.3,
                regen: 0.025
            },
            b: {
                name: '검귀',
                desc: '쌍검을 든 검사 3명. 빠르게 베고, 주변 적까지 절반 피해로 휩쓴다',
                cost: 175,
                range: 3.5,
                soldiers: 3,
                hp: 280,
                dmg: 42,
                rate: 0.6,
                respawn: 7,
                cleave: 0.5
            }
        }
    }
};

/**
 * 살아남기 전용 방벽. 고원으로 오르는 비탈(입구) 하나를 통째로 막는 큰 벽 하나다 (비탈 폭 × 1칸).
 * 건설 메뉴(TOWER_ORDER)에는 없고 자유 배치 건설 막대에만 나온다. 공격하지 않는다.
 * 생존자는 문처럼 지나가고, 적은 돌아가거나(다른 입구) 벽을 부순다. 그 자리에서 3단계까지 올린다.
 * 값·체력은 예전 1칸 방벽으로 입구 하나(3~5칸)를 막던 총량 언저리 (체력은 map.survival.wallHp를 곱한다).
 */
TOWERS.wall = {
    id: 'wall',
    name: '방벽',
    en: 'Barricade',
    hotkey: '1',
    dmgType: 'none',
    color: '#c9d4e6',
    role: '비탈 입구 하나를 통째로 막는 벽. 생존자는 지나가고, 적은 돌아가거나 벽부터 부순다',
    attack: 'wall',
    noBranch: true,
    resonance: { stat: 'none', value: 0, name: '없음', desc: '' },
    tiers: [
        { cost: 45, range: 0, hp: 3200, name: '나무 방책' },
        { cost: 70, range: 0, hp: 5600, name: '돌 방벽' },
        { cost: 120, range: 0, hp: 9000, name: '강화 방벽' }
    ],
    branches: {}
};

/** 공명 효과를 사람이 읽는 짧은 문구로 */
export function resonanceLabel(stat, value) {
    const p = Math.round(value * 100);
    return {
        range: `사거리 +${p}%`,
        damage: `피해 +${p}%`,
        vulnerable: `둔화된 적에게 피해 +${p}%`,
        rate: `공격 속도 +${p}%`,
        pen: `방어·저항 ${p}% 무시`,
        bounty: `처치 골드 +${p}%`,
        pinned: `붙잡힌 적에게 피해 +${p}%`
    }[stat];
}

/** 분기 이후 각성 단계: 레벨당 피해 +25%, 사거리 +5%, 광산 수입 +30% */
export const MAX_MASTERY = 2;
export function masteryCost(tower) {
    const br = TOWERS[tower.type].branches[tower.branch];
    return Math.round((br.cost * (0.5 + 0.25 * (tower.mastery || 0))) / 5) * 5;
}

export const MAX_TIER = 3;

/** 공성전 타워 체력: 레벨·분기·각성마다 늘어난다 */
export function towerMaxHp(tower) {
    const base = 320 + 140 * (tower.tier - 1) + (tower.branch ? 200 : 0) + 100 * (tower.mastery || 0);
    return tower.type === 'barracks' ? Math.round(base * 1.25) : base;
}
export const SELL_RATE = 0.7;
export const CHAIN_JUMP = 1.9;

/** 현재 단계의 기본 스탯 (공명 버프 제외) */
export function baseStats(tower) {
    const def = TOWERS[tower.type];
    if (tower.branch) return def.branches[tower.branch];
    return def.tiers[tower.tier - 1];
}

/** 다음 단계 비용. 분기 선택 전이면 null (분기별 비용은 UI가 branches에서 읽음) */
export function nextCost(tower) {
    const def = TOWERS[tower.type];
    if (tower.branch) return null;
    if (tower.tier < MAX_TIER) return def.tiers[tower.tier].cost;
    return null;
}
