// 난이도: 보통이 기준 밸런스. 쉬움은 여유를, 영웅은 생명 하나만 준다.
// baseMul: 살아남기 맵에서 본진(수정) 체력 배율 (생명 대신)
export const DIFFICULTY = {
    easy: {
        id: 'easy',
        name: '쉬움',
        desc: '적 체력 80% · 시작 골드 +25% · 생명 30',
        hpMul: 0.8,
        goldMul: 1.25,
        lives: 30,
        baseMul: 1.3
    },
    normal: { id: 'normal', name: '보통', desc: '기본 밸런스 · 생명 20', hpMul: 1, goldMul: 1, lives: null },
    hero: {
        id: 'hero',
        name: '영웅',
        desc: '생명 1 · 한 마리도 놓치면 끝',
        hpMul: 1,
        goldMul: 1,
        lives: 1,
        baseMul: 0.6
    }
};
export const DIFFICULTY_ORDER = ['easy', 'normal', 'hero'];
