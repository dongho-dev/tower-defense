// 타워 정의. tiers[0..2] = 레벨 1~3, branches.a / .b = 레벨 3 이후 특화.
// rate = 공격 간격(초), range/splash = 월드 단위, cost = 해당 단계로 가는 비용.

export const TOWER_ORDER = ['ranger', 'ember', 'frost', 'storm'];

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
            { cost: 70, dmg: 12, rate: 0.6, range: 3.3 },
            { cost: 60, dmg: 20, rate: 0.55, range: 3.5 },
            { cost: 100, dmg: 32, rate: 0.5, range: 3.7 }
        ],
        branches: {
            a: {
                name: '저격수',
                desc: '한 발이 무거운 장거리 저격. 방어력 70% 관통',
                cost: 190,
                dmg: 140,
                rate: 1.5,
                range: 5.0,
                pierce: 0.7
            },
            b: {
                name: '일제 사격',
                desc: '세 표적에게 동시에 화살을 퍼붓는다',
                cost: 180,
                dmg: 30,
                rate: 0.42,
                range: 3.9,
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
            { cost: 110, dmg: 30, rate: 2.0, range: 3.8, splash: 1.0 },
            { cost: 90, dmg: 52, rate: 1.9, range: 4.0, splash: 1.1 },
            { cost: 140, dmg: 84, rate: 1.8, range: 4.2, splash: 1.2 }
        ],
        branches: {
            a: {
                name: '용염',
                desc: '착탄 지점을 3초간 불태운다 (초당 40 피해)',
                cost: 220,
                dmg: 96,
                rate: 1.7,
                range: 4.3,
                splash: 1.3,
                burn: { dps: 40, duration: 3, radius: 1.2 }
            },
            b: {
                name: '공성포',
                desc: '거대한 포탄. 피해와 폭발 반경이 크게 늘어난다',
                cost: 240,
                dmg: 220,
                rate: 2.2,
                range: 4.6,
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
            { cost: 90, dmg: 8, rate: 1.0, range: 3.0, splash: 0.9, slow: 0.35, slowTime: 1.6 },
            { cost: 70, dmg: 14, rate: 0.95, range: 3.2, splash: 1.0, slow: 0.42, slowTime: 1.8 },
            { cost: 110, dmg: 22, rate: 0.9, range: 3.4, splash: 1.1, slow: 0.5, slowTime: 2.0 }
        ],
        branches: {
            a: {
                name: '영구동토',
                desc: '사거리 안의 모든 적을 계속 둔화시키고 얼린다 (초당 30 피해)',
                cost: 200,
                dmg: 0,
                rate: 0,
                range: 3.4,
                aura: { dps: 30, slow: 0.55 }
            },
            b: {
                name: '빙결 창',
                desc: '거대한 얼음 창. 이미 둔화된 적에게 2배 피해',
                cost: 210,
                dmg: 160,
                rate: 1.4,
                range: 4.2,
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
            { cost: 130, dmg: 22, rate: 1.5, range: 3.2, chain: 3, falloff: 0.75 },
            { cost: 100, dmg: 36, rate: 1.4, range: 3.4, chain: 3, falloff: 0.75 },
            { cost: 150, dmg: 56, rate: 1.3, range: 3.6, chain: 4, falloff: 0.78 }
        ],
        branches: {
            a: {
                name: '폭풍 군주',
                desc: '번개가 7번 튀고 더 빠르게 친다',
                cost: 240,
                dmg: 70,
                rate: 0.9,
                range: 3.8,
                chain: 7,
                falloff: 0.85
            },
            b: {
                name: '과충전',
                desc: '첫 표적에 거대한 피해와 0.6초 기절',
                cost: 230,
                dmg: 260,
                rate: 1.6,
                range: 3.8,
                chain: 3,
                falloff: 0.4,
                stun: 0.6
            }
        }
    }
};

export const MAX_TIER = 3;
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
