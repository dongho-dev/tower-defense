// 맵별 시각 테마. 게임 로직과 무관하게 하늘·조명·지형·식생·구조물 색만 바꾼다.

export const THEMES = {
    dusk: {
        sky: { zenith: '#161236', upper: '#4b2c72', horizon: '#f08a64', below: '#8a4e78', sunGlow: '#ffc07a' },
        cloud: { lit: '#ffe2b8', mid: '#f2a38e', shadow: '#a4739c', deep: '#5a4580', horizon: '#e48a6e' },
        fog: '#c9788a',
        sun: { color: '#ffa25e', intensity: 2.9 },
        hemi: { sky: '#9a8ce8', ground: '#5a3a2a', intensity: 0.75 },
        rim: { color: '#8f7cff', intensity: 0.9 },
        env: 0.6,
        ground: { grassA: '#3f6a26', grassB: '#6e8a30', dry: '#9a7e44', dirt: '#7b5a3a', rim: '#8b7d68' },
        cliff: { soil: '#4a3526', bands: ['#9a8468', '#7c6a56', '#a8937a', '#6a5a4a', '#8f7c66'], deep: '#2e2824' },
        veg: {
            broad: ['#4f7d2f', '#5e8a35', '#6f9a3a', '#c98a2e', '#d9a441', '#b8562e', '#8a9a36'],
            pine: ['#2f5a36', '#3a6b3c', '#2c4f3a'],
            broadRatio: 0.68,
            trees: 150,
            grass: ['#4f7a2c', '#648f33', '#7a9338', '#56802f', '#8f7f3e'],
            grassDensity: 1,
            flowers: ['#fff3d6', '#ffd24a', '#ff8fb1', '#b58cff', '#ff6a4a'],
            snow: false,
            dead: false,
            crystals: null,
            rock: '#a09482'
        },
        wall: '#b5a489',
        roof: '#3d4e8a',
        banner: '#8a2230',
        road: '#ffffff'
    },
    frost: {
        sky: { zenith: '#0e1430', upper: '#34407e', horizon: '#f2a0a4', below: '#6a6a9e', sunGlow: '#ffd2b4' },
        cloud: { lit: '#fff0e6', mid: '#d8b8d8', shadow: '#8a86b8', deep: '#4a4f86', horizon: '#d8a0b0' },
        fog: '#a89ac0',
        sun: { color: '#ffc4a0', intensity: 2.5 },
        hemi: { sky: '#a4b8ff', ground: '#6a6a80', intensity: 0.85 },
        rim: { color: '#8fb4ff', intensity: 1.0 },
        env: 0.7,
        ground: { grassA: '#d6e0ec', grassB: '#bccbde', dry: '#a4b4cc', dirt: '#7e7c8a', rim: '#9aa4b6' },
        cliff: { soil: '#5a5a6a', bands: ['#9aa6b8', '#7c889c', '#aab4c4', '#6a748a', '#8e9ab0'], deep: '#2a2e3e' },
        veg: {
            broad: ['#8aa0b4', '#9ab0c0', '#7a94aa'],
            pine: ['#3f6f5e', '#4a7c66', '#386452'],
            broadRatio: 0.2,
            trees: 130,
            grass: ['#c6d4e4', '#aebed4', '#dde6f0'],
            grassDensity: 0.35,
            flowers: ['#bff4ff', '#e8fbff', '#9fdcff'],
            snow: true,
            dead: false,
            crystals: { color: '#8fe3ff', emissive: '#2fa8ff', count: 28, intensity: 1.4 },
            rock: '#b0b8c8'
        },
        wall: '#c4ccd8',
        roof: '#2f4f7a',
        banner: '#2a5a9a',
        road: '#c8d2e4'
    },
    void: {
        sky: { zenith: '#07030f', upper: '#2a0b3a', horizon: '#b0306a', below: '#3a1040', sunGlow: '#ff6ad0' },
        cloud: { lit: '#ff9ad8', mid: '#9a3a8a', shadow: '#4a1a5a', deep: '#1a0a2a', horizon: '#7a2060' },
        fog: '#4a1a4a',
        sun: { color: '#ffb0cc', intensity: 2.8 },
        hemi: { sky: '#a88aff', ground: '#3a2030', intensity: 1.05 },
        rim: { color: '#ff6ad8', intensity: 0.7 },
        env: 0.75,
        ground: { grassA: '#524862', grassB: '#665878', dry: '#6e4a6e', dirt: '#463a4e', rim: '#5a5064' },
        cliff: { soil: '#1e1624', bands: ['#4a3e56', '#362c42', '#5a4a66', '#2a2234', '#44384e'], deep: '#0e0a14' },
        veg: {
            broad: ['#5a3a6a'],
            pine: ['#2a2036'],
            broadRatio: 0,
            trees: 70,
            grass: ['#4a3a56', '#5a4666', '#3a2e46'],
            grassDensity: 0.4,
            flowers: ['#8a5a9a', '#6a4a8a', '#9a6aaa'],
            snow: false,
            dead: true,
            crystals: { color: '#d8a0ff', emissive: '#a040ff', count: 22, intensity: 1.8 },
            rock: '#4a4252'
        },
        wall: '#6a6078',
        roof: '#3a1a4a',
        banner: '#6a1a5a',
        road: '#dcd0e8'
    }
};

export function themeOf(map) {
    return THEMES[map.theme || 'dusk'];
}
