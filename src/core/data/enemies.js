// 적 정의. speed = 월드 단위/초, armor = 물리 경감, resist = 마법 경감 (0~1).

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
        radius: 0.28
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
        radius: 0.26
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
        radius: 0.38
    },
    wraith: {
        id: 'wraith',
        name: '망령',
        desc: '떠다니는 영체. 마법 피해를 55% 흘려낸다.',
        tip: '마법에 강하다. 궁수탑과 박격포 같은 물리 피해로.',
        hp: 95,
        speed: 1.6,
        armor: 0,
        resist: 0.55,
        bounty: 9,
        lives: 1,
        radius: 0.3,
        flying: true
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
        heal: { every: 3, radius: 1.8, amount: 0.1 }
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
        ccResist: 0.7
    }
};

/** 정예 변형 배율 */
export const ELITE = { hp: 3, bounty: 3, lives: 3, scale: 1.3 };

/** 웨이브별 체력 배율 */
export function hpScale(wave) {
    return Math.pow(1.105, Math.max(0, wave - 1));
}
