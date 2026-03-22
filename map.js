const MAP_DEFINITIONS = {
    map1: {
        id: 'map1',
        name: '기본 맵',
        difficulty: '보통',
        initialGold: 100,
        initialLives: 20,
        rawWaypoints: [
            { x: -2, y: 8 },
            { x: 2, y: 8 },
            { x: 2, y: 4 },
            { x: 10, y: 4 },
            { x: 10, y: 12 },
            { x: 18, y: 12 },
            { x: 18, y: 6 },
            { x: 26, y: 6 },
            { x: 26, y: 14 },
            { x: GRID_COLS + 1, y: 14 }
        ]
    },
    map2: {
        id: 'map2',
        name: 'S자 맵',
        difficulty: '어려움',
        initialGold: 120,
        initialLives: 15,
        rawWaypoints: [
            { x: -2, y: 3 },
            { x: 8, y: 3 },
            { x: 8, y: 17 },
            { x: 16, y: 17 },
            { x: 16, y: 3 },
            { x: 24, y: 3 },
            { x: 24, y: 17 },
            { x: GRID_COLS + 1, y: 17 }
        ]
    },
    map3: {
        id: 'map3',
        name: '나선 맵',
        difficulty: '쉬움',
        initialGold: 80,
        initialLives: 25,
        rawWaypoints: [
            { x: -2, y: 10 },
            { x: 4, y: 10 },
            { x: 4, y: 2 },
            { x: 26, y: 2 },
            { x: 26, y: 18 },
            { x: 4, y: 18 },
            { x: 4, y: 12 },
            { x: 20, y: 12 },
            { x: 20, y: 6 },
            { x: GRID_COLS + 1, y: 6 }
        ]
    }
};

let activeMapId = 'map1';
let waypoints = [];
let pathTiles = new Set();

function buildMapData(mapId) {
    const mapDef = MAP_DEFINITIONS[mapId] || MAP_DEFINITIONS['map1'];
    waypoints = mapDef.rawWaypoints.map((point) => ({
        x: point.x * TILE_SIZE + TILE_CENTER_OFFSET,
        y: point.y * TILE_SIZE + TILE_CENTER_OFFSET
    }));
    pathTiles = new Set();
    for (let i = 0; i < waypoints.length - 1; i++) {
        const a = gridFromPosition(waypoints[i]);
        const b = gridFromPosition(waypoints[i + 1]);
        if (a.x === b.x) {
            const step = Math.sign(b.y - a.y) || 1;
            for (let y = a.y; y !== b.y + step; y += step) {
                pathTiles.add(`${a.x},${y}`);
            }
        } else if (a.y === b.y) {
            const step = Math.sign(b.x - a.x) || 1;
            for (let x = a.x; x !== b.x + step; x += step) {
                pathTiles.add(`${x},${a.y}`);
            }
        }
    }
    staticLayer = null;
}

buildMapData(activeMapId);
