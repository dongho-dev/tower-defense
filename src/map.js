import { TILE_SIZE } from './constants.js';
import { GRID_COLS, GRID_ROWS, TILE_CENTER_OFFSET } from './state.js';
import { gridFromPosition, keyFromGrid } from './utils.js';
import { state } from './state.js';

export const waypoints = [
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
].map(point => ({
    x: point.x * TILE_SIZE + TILE_CENTER_OFFSET,
    y: point.y * TILE_SIZE + TILE_CENTER_OFFSET
}));

export const pathTiles = new Set();
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

export function canBuildAt(x, y) {
    if (x < 0 || x >= GRID_COLS || y < 0 || y >= GRID_ROWS) {
        return false;
    }
    if (pathTiles.has(keyFromGrid(x, y))) {
        return false;
    }
    return !state.towers.some(t => t.x === x && t.y === y);
}
