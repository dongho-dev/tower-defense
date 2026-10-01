// 적 정의. speed = 월드 단위/초, armor = 물리 경감, resist = 마법 경감 (0~1).
// atk = 공성전·근접전에서 한 번에 주는 피해, home = 주로 나오는 맵(도감 분류용).
// 특수 능력은 필드 하나씩: takes(원인별 피해 배율), slowImmune, enrage, blink, split, pollen, burrow,
// deathBlast(타워 기절), pulse(보스: 타워 기절 파동), shield, summon, ward.

export const ENEMIES = {
    grunt: {
        id: 'grunt',
        name: '그림자 병사',
        desc: '군세의 주력. 특별한 약점도 강점도 없다.',
        tip: '아무 타워나 잘 통한다. 박격포 광역으로 쓸어 담자.',
        hp: 60,
        speed: 1.4,
        armor: 0,
        resist: 0,
        bounty: 6,
        lives: 1,
        radius: 0.28,
        atk: 7
    },
    stalker: {
        id: 'stalker',
        name: '추적자',
        desc: '네 발로 달리는 사냥개. 빠르지만 약하다.',
        tip: '빨라서 지나치기 쉽다. 서리 둔화와 궁수 일제 사격이 좋다.',
        hp: 38,
        speed: 2.5,
        armor: 0,
        resist: 0,
        bounty: 5,
        lives: 1,
        radius: 0.26,
        atk: 5
    },
    ironclad: {
        id: 'ironclad',
        name: '흑철 기사',
        desc: '두꺼운 갑주가 물리 피해를 45% 막는다. 마법에 약하다.',
        tip: '물리에 강하다. 폭풍·서리·광선 같은 마법이나 저격수 관통으로.',
        hp: 240,
        speed: 0.85,
        armor: 0.45,
        resist: 0,
        bounty: 15,
        lives: 2,
        radius: 0.38,
        atk: 20
    },
    wraith: {
        id: 'wraith',
        name: '망령',
        desc: '떠다니는 영체. 마법 피해를 55% 흘려낸다. 병사가 막을 수 없다.',
        tip: '마법에 강하다. 궁수탑과 박격포 같은 물리 피해로.',
        hp: 95,
        speed: 1.6,
        armor: 0,
        resist: 0.55,
        bounty: 9,
        lives: 1,
        radius: 0.3,
        flying: true,
        atk: 9
    },
    hexcaller: {
        id: 'hexcaller',
        name: '주술사',
        desc: '3초마다 주변 아군의 체력을 10% 회복시킨다. 우선 처치 대상.',
        tip: '치유를 막으려면 먼저 잡자. 조준을 "최강"으로 두면 좋다.',
        hp: 130,
        speed: 1.15,
        armor: 0,
        resist: 0.25,
        bounty: 14,
        lives: 1,
        radius: 0.3,
        heal: { every: 3, radius: 1.8, amount: 0.1 },
        atk: 4
    },
    colossus: {
        id: 'colossus',
        name: '공허의 거상',
        desc: '균열의 주인. 기절·빙결 효과가 30%만 적용된다.',
        tip: '체력이 막대하다. 집속 광선과 유성 낙하를 아껴 두자.',
        hp: 4200,
        speed: 0.55,
        armor: 0.3,
        resist: 0.3,
        bounty: 250,
        lives: 10,
        radius: 0.8,
        boss: true,
        ccResist: 0.7,
        atk: 70
    },

    // ---------- 잿불 고원 ----------
    cinderling: {
        id: 'cinderling',
        name: '잿불 자폭병',
        home: 'cinder',
        desc: '몸속에 불씨를 품은 졸병. 쓰러지면 터지며 근처 타워를 1.2초 기절시킨다.',
        tip: '길에서 먼 타워로 잡거나, 박격포로 소켓에 닿기 전에 터뜨리자.',
        hp: 70,
        speed: 1.7,
        armor: 0,
        resist: 0,
        bounty: 6,
        lives: 1,
        radius: 0.28,
        atk: 6,
        deathBlast: { radius: 2.2, stun: 1.2 }
    },
    flameborn: {
        id: 'flameborn',
        name: '불꽃 정령',
        home: 'cinder',
        desc: '살아 있는 불길. 화염 지대 피해를 받지 않고, 박격포 폭발도 절반만 받는다.',
        tip: '불로는 안 된다. 궁수·서리·폭풍으로 상대하자.',
        hp: 150,
        speed: 1.35,
        armor: 0,
        resist: 0.2,
        bounty: 10,
        lives: 1,
        radius: 0.3,
        atk: 10,
        takes: { burn: 0, ember: 0.5 }
    },
    magmaLord: {
        id: 'magmaLord',
        name: '용암 군주',
        home: 'cinder',
        desc: '고원의 심장에서 깨어난 거인. 7초마다 땅을 내려쳐 주변 타워를 1.5초 기절시킨다.',
        tip: '기절 파동이 닿지 않는 먼 타워와 광선으로 녹이자. 파동 직후가 반격 시간.',
        hp: 4400,
        speed: 0.55,
        armor: 0.35,
        resist: 0.2,
        bounty: 260,
        lives: 10,
        radius: 0.85,
        boss: true,
        ccResist: 0.7,
        atk: 80,
        pulse: { every: 7, radius: 3.4, stun: 1.5 }
    },

    // ---------- 서리 협곡 ----------
    rimeguard: {
        id: 'rimeguard',
        name: '서리 갑주병',
        home: 'frostvale',
        desc: '얼음 갑옷을 두른 병사. 둔화와 빙결에 면역이고 물리 피해를 35% 막는다.',
        tip: '서리 첨탑이 안 통한다. 폭풍·광선 같은 마법 피해로.',
        hp: 200,
        speed: 0.95,
        armor: 0.35,
        resist: 0,
        bounty: 13,
        lives: 1,
        radius: 0.34,
        atk: 14,
        slowImmune: true
    },
    yeti: {
        id: 'yeti',
        name: '눈사태 거인',
        home: 'frostvale',
        desc: '거대한 설인. 체력이 절반 아래로 떨어지면 분노해 1.8배 빨라진다.',
        tip: '한 번에 몰아서 잡자. 둔화로 분노한 뒤의 질주를 막아야 한다.',
        hp: 420,
        speed: 0.8,
        armor: 0.15,
        resist: 0.1,
        bounty: 22,
        lives: 2,
        radius: 0.45,
        atk: 24,
        enrage: { below: 0.5, speed: 1.8 }
    },
    glacier: {
        id: 'glacier',
        name: '빙하 거신',
        home: 'frostvale',
        desc: '협곡을 가로막는 얼음산. 10초마다 최대 체력 15%짜리 얼음 보호막을 두른다.',
        tip: '보호막이 깨진 직후에 화력을 몰자. 공성포와 집속 광선이 좋다.',
        hp: 3400,
        speed: 0.46,
        armor: 0.3,
        resist: 0.3,
        bounty: 260,
        lives: 10,
        radius: 0.85,
        boss: true,
        ccResist: 0.7,
        atk: 75,
        shield: { every: 10, amount: 0.15 }
    },

    // ---------- 공허의 첨탑 ----------
    shade: {
        id: 'shade',
        name: '그림자 도약자',
        home: 'voidspire',
        desc: '3.5초마다 길을 따라 2칸 앞으로 순간이동한다. 병사에게 막혀도 빠져나간다.',
        tip: '도약 거리를 생각해 길 뒤쪽까지 사거리가 닿게 배치하자.',
        hp: 85,
        speed: 1.45,
        armor: 0,
        resist: 0.3,
        bounty: 8,
        lives: 1,
        radius: 0.28,
        atk: 8,
        blink: { every: 3.5, dist: 2 }
    },
    splitter: {
        id: 'splitter',
        name: '분열체',
        home: 'voidspire',
        desc: '쓰러지면 작은 조각 둘로 갈라진다.',
        tip: '광역 피해로 조각까지 한 번에 쓸어 버리자.',
        hp: 200,
        speed: 1.0,
        armor: 0.1,
        resist: 0.1,
        bounty: 8,
        lives: 1,
        radius: 0.36,
        atk: 12,
        split: { into: 'mite', count: 2 }
    },
    mite: {
        id: 'mite',
        name: '분열 조각',
        home: 'voidspire',
        minion: true,
        desc: '분열체에서 떨어져 나온 조각. 작고 빠르다.',
        tip: '서리 둔화나 박격포로 한꺼번에.',
        hp: 55,
        speed: 1.8,
        armor: 0,
        resist: 0,
        bounty: 2,
        lives: 1,
        radius: 0.2,
        atk: 4
    },
    riftlord: {
        id: 'riftlord',
        name: '균열 군주',
        home: 'voidspire',
        desc: '균열을 찢고 걷는 군주. 7초마다 2.2칸 앞으로 순간이동한다.',
        tip: '수정 가까이에도 화력을 남겨 두자. 도약 끝 지점에 서리를 깔면 좋다.',
        hp: 3200,
        speed: 0.42,
        armor: 0.3,
        resist: 0.35,
        bounty: 260,
        lives: 10,
        radius: 0.8,
        boss: true,
        ccResist: 0.7,
        atk: 70,
        blink: { every: 7, dist: 2.2 }
    },

    // ---------- 새벽 정원 ----------
    bloomer: {
        id: 'bloomer',
        name: '꽃가루 정령',
        home: 'bloom',
        desc: '쓰러지면 꽃가루를 터뜨려 주변 아군의 체력을 30% 회복시킨다.',
        tip: '무리에서 떨어졌을 때 잡거나, 무리를 통째로 한 번에 정리하자.',
        hp: 110,
        speed: 1.3,
        armor: 0,
        resist: 0.15,
        bounty: 9,
        lives: 1,
        radius: 0.28,
        atk: 5,
        pollen: { radius: 2, amount: 0.3 }
    },
    burrower: {
        id: 'burrower',
        name: '땅굴 두더지',
        home: 'bloom',
        desc: '5초마다 땅속으로 숨어 1.8초 동안 빠르게 파고든다. 숨은 동안은 공격받지 않는다.',
        tip: '땅 위로 나온 순간을 노리자. 사거리가 긴 타워가 유리하다.',
        hp: 170,
        speed: 1.2,
        armor: 0.2,
        resist: 0,
        bounty: 11,
        lives: 1,
        radius: 0.32,
        atk: 10,
        burrow: { every: 5, time: 1.8, speed: 2 }
    },
    thornwood: {
        id: 'thornwood',
        name: '가시 고목',
        home: 'bloom',
        desc: '정원의 오래된 나무가 깨어났다. 6초마다 가시 새싹 둘을 낳는다.',
        tip: '새싹이 쌓이기 전에 빨리 쓰러뜨리자. 광역 타워로 새싹을 정리.',
        hp: 4600,
        speed: 0.45,
        armor: 0.25,
        resist: 0.25,
        bounty: 260,
        lives: 10,
        radius: 0.85,
        boss: true,
        ccResist: 0.7,
        atk: 70,
        summon: { every: 6, enemy: 'sprout', count: 2 }
    },
    sprout: {
        id: 'sprout',
        name: '가시 새싹',
        home: 'bloom',
        minion: true,
        desc: '가시 고목이 떨군 새싹. 약하지만 계속 나온다.',
        tip: '광역 피해로 쓸자.',
        hp: 45,
        speed: 1.5,
        armor: 0,
        resist: 0,
        bounty: 1,
        lives: 1,
        radius: 0.2,
        atk: 4
    },

    // ---------- 폭풍 해안 ----------
    stormeater: {
        id: 'stormeater',
        name: '번개 흡수체',
        home: 'stormreach',
        desc: '번개를 먹고 사는 구체. 폭풍 오벨리스크의 피해를 받지 않는다.',
        tip: '폭풍 탑 대신 궁수·박격포·광선으로.',
        hp: 230,
        speed: 1.05,
        armor: 0.15,
        resist: 0.3,
        bounty: 14,
        lives: 1,
        radius: 0.32,
        atk: 12,
        takes: { storm: 0 }
    },
    harpy: {
        id: 'harpy',
        name: '폭풍 하피',
        home: 'stormreach',
        desc: '돌풍을 타고 나는 하피. 빠르고 날아다녀서 병사가 막을 수 없다.',
        tip: '궁수탑 일제 사격과 서리 둔화로 붙잡자.',
        hp: 70,
        speed: 2.3,
        armor: 0,
        resist: 0.1,
        bounty: 7,
        lives: 1,
        radius: 0.26,
        atk: 6,
        flying: true
    },
    tempest: {
        id: 'tempest',
        name: '폭풍 폭군',
        home: 'stormreach',
        desc: '해안을 덮친 폭풍의 화신. 8초마다 3초 동안 바람 장막을 둘러 피해를 60% 줄인다.',
        tip: '장막이 걷힌 5초에 스킬과 화력을 쏟자.',
        hp: 3400,
        speed: 0.55,
        armor: 0.25,
        resist: 0.3,
        bounty: 260,
        lives: 10,
        radius: 0.8,
        boss: true,
        ccResist: 0.7,
        atk: 70,
        ward: { every: 8, time: 3, reduce: 0.6 }
    }
};

/** 정예 변형 배율 */
export const ELITE = { hp: 3, bounty: 3, lives: 3, scale: 1.3 };

/** 웨이브별 체력 배율 */
export function hpScale(wave) {
    return Math.pow(1.105, Math.max(0, wave - 1));
}

/** 공성전에서 적 공격력 배율 (웨이브가 갈수록 조금씩) */
export function atkScale(wave) {
    return 1 + 0.04 * Math.max(0, wave - 1);
}

/**
 * 특성 목록 (UI 공용): [{ label, kind }] kind = 'phys' | 'magic' | 'warn' | 'info'
 * 짧은 표시(short)와 긴 설명(long)을 함께 준다.
 */
export function enemyTraits(d) {
    const t = [];
    if (d.armor)
        t.push({
            kind: 'phys',
            short: `방어 ${Math.round(d.armor * 100)}%`,
            long: `물리 피해 ${Math.round(d.armor * 100)}% 경감`
        });
    if (d.resist)
        t.push({
            kind: 'magic',
            short: `저항 ${Math.round(d.resist * 100)}%`,
            long: `마법 피해 ${Math.round(d.resist * 100)}% 경감`
        });
    if (d.flying) t.push({ kind: 'info', short: '비행', long: '날아다녀서 병사가 막지 못함' });
    if (d.heal) t.push({ kind: 'warn', short: '치유', long: '주변 아군 치유' });
    if (d.takes?.burn === 0) t.push({ kind: 'warn', short: '화염 면역', long: '화염 지대 면역 · 폭발 피해 절반' });
    if (d.takes?.storm === 0) t.push({ kind: 'warn', short: '번개 면역', long: '폭풍 오벨리스크 피해 면역' });
    if (d.slowImmune) t.push({ kind: 'warn', short: '둔화 면역', long: '둔화·빙결 면역' });
    if (d.enrage)
        t.push({
            kind: 'warn',
            short: '분노',
            long: `체력 ${Math.round(d.enrage.below * 100)}% 아래에서 ${d.enrage.speed}배 빨라짐`
        });
    if (d.blink) t.push({ kind: 'warn', short: '순간이동', long: `${d.blink.every}초마다 ${d.blink.dist}칸 도약` });
    if (d.split) t.push({ kind: 'warn', short: '분열', long: `쓰러지면 ${d.split.count}마리로 갈라짐` });
    if (d.pollen)
        t.push({
            kind: 'warn',
            short: '꽃가루',
            long: `쓰러지면 주변 아군 ${Math.round(d.pollen.amount * 100)}% 치유`
        });
    if (d.burrow) t.push({ kind: 'warn', short: '잠복', long: `${d.burrow.every}초마다 땅속으로 숨음 (공격 불가)` });
    if (d.deathBlast) t.push({ kind: 'warn', short: '자폭', long: `쓰러지면 주변 타워 ${d.deathBlast.stun}초 기절` });
    if (d.pulse)
        t.push({ kind: 'warn', short: '기절 파동', long: `${d.pulse.every}초마다 주변 타워 ${d.pulse.stun}초 기절` });
    if (d.shield)
        t.push({
            kind: 'warn',
            short: '얼음 보호막',
            long: `${d.shield.every}초마다 체력 ${Math.round(d.shield.amount * 100)}% 보호막`
        });
    if (d.summon)
        t.push({ kind: 'warn', short: '소환', long: `${d.summon.every}초마다 부하 ${d.summon.count}마리 소환` });
    if (d.ward)
        t.push({
            kind: 'warn',
            short: '바람 장막',
            long: `${d.ward.every}초마다 ${d.ward.time}초간 피해 ${Math.round(d.ward.reduce * 100)}% 감소`
        });
    if (d.boss) t.push({ kind: 'warn', short: '보스', long: '빙결·기절 30%만 받음 · 병사에게 붙잡히지 않음' });
    if (d.speed >= 2) t.push({ kind: 'info', short: '빠름', long: '매우 빠름' });
    if (d.speed <= 0.9 && !d.boss) t.push({ kind: 'info', short: '느림', long: '느림' });
    return t;
}
