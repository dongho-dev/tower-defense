// 웨이브 정의. 그룹 = { enemy, count, gap(초), delay(웨이브 시작 기준 초), elite?, path? }

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
