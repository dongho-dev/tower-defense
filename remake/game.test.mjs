import assert from "node:assert/strict";
import {
  MAPS,
  TOWER_WORLD_SCALE,
  TOWER_TYPES,
  buildTower,
  createGameState,
  pointOnRoute,
  projectBoardPoint,
  resolveMap,
  sellTower,
  startWave,
  stepSimulation,
  towerStats,
  turnTowardAngle,
  upgradeCost,
  upgradeTower,
  waveSpec
} from "./game.mjs";

assert.equal(Object.keys(MAPS).length, 3, "three route profiles should be available");
assert.equal(TOWER_TYPES.length, 8, "the armory should expose eight tower families");
assert.ok(TOWER_TYPES.every((tower) => ["turret", "reactor"].includes(tower.motion)), "every tower needs a visible motion family");
assert.ok(TOWER_WORLD_SCALE >= 0.6 && TOWER_WORLD_SCALE <= 0.75, "towers should read as compact battlefield units");

const boardTop = projectBoardPoint([0, 0]);
const boardRight = projectBoardPoint([1, 0]);
const boardBottom = projectBoardPoint([1, 1]);
const boardLeft = projectBoardPoint([0, 1]);
assert.equal(boardTop.x, boardBottom.x, "isometric board should keep its vertical center axis");
assert.equal(boardRight.y, boardLeft.y, "isometric board side corners should share a horizon line");
assert.ok(boardBottom.y - boardTop.y > 480, "isometric board should retain meaningful visual depth");
assert.ok(boardRight.x - boardLeft.x > 1100, "battlefield should use almost the full canvas width");
assert.ok(turnTowardAngle(Math.PI - 0.05, -Math.PI + 0.05, 0.04) > Math.PI - 0.05, "turret turning should take the shortest wrapped path");

function pointSegmentDistance(point, from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const denominator = dx * dx + dy * dy || 1;
  const amount = Math.max(0, Math.min(1, ((point.x - from.x) * dx + (point.y - from.y) * dy) / denominator));
  return Math.hypot(point.x - from.x - amount * dx, point.y - from.y - amount * dy);
}

for (const mapId of Object.keys(MAPS)) {
  const route = resolveMap(mapId);
  assert.ok(route.totalLength > 1200, mapId + " route should sustain a wide-map battle");
  assert.equal(route.pads.length, 18, mapId + " should provide a deliberate 18-socket layout");
  const routeXs = route.points.map((point) => point.x);
  assert.ok(Math.max(...routeXs) - Math.min(...routeXs) > 850, mapId + " should use the expanded horizontal field");
  for (const pad of route.pads) {
    const laneClearance = Math.min(...route.segments.map((segment) => pointSegmentDistance(pad, segment.from, segment.to)));
    assert.ok(laneClearance > 50, mapId + " sockets should stay clear of the armored lane");
    const otherPads = route.pads.filter((candidate) => candidate !== pad);
    assert.ok(Math.min(...otherPads.map((candidate) => Math.hypot(pad.x - candidate.x, pad.y - candidate.y))) > 65, mapId + " sockets should remain visually distinct");
  }
  const start = pointOnRoute(route, 0);
  const end = pointOnRoute(route, route.totalLength);
  assert.ok(Number.isFinite(start.x) && Number.isFinite(end.y), "route positions should be finite");
}

const state = createGameState("riftline");
assert.equal(state.started, false);
state.started = true;

const built = buildTower(state, "pulse", 0);
assert.equal(built.ok, true);
assert.equal(state.towers.length, 1);
assert.equal(state.credits, 200);
assert.equal(buildTower(state, "rail", 0).ok, false, "occupied sockets cannot be reused");

const tower = built.tower;
const initialVisualAngle = tower.visualAngle;
stepSimulation(state, 1 / 60);
assert.notEqual(tower.visualAngle, initialVisualAngle, "an idle tower should mechanically sweep instead of staying frozen");
const beforeStats = towerStats(tower);
const cost = upgradeCost(tower);
const upgraded = upgradeTower(state, tower.id);
assert.equal(upgraded.ok, true);
assert.equal(state.credits, 200 - cost);
assert.ok(towerStats(tower).damage > beforeStats.damage);

const sold = sellTower(state, tower.id);
assert.equal(sold.ok, true);
assert.equal(state.towers.length, 0);
assert.ok(sold.value > 0);

assert.equal(waveSpec(5).bossWave, true);
assert.equal(startWave(state), true);
assert.equal(state.wave, 1);
assert.equal(state.waveActive, true);

for (let index = 0; index < 240; index += 1) stepSimulation(state, 1 / 60);
assert.ok(state.enemies.length > 0 || state.spawnRemaining > 0, "wave simulation should create enemies");
assert.ok(state.enemies.every((enemy) => Number.isFinite(enemy.x) && Number.isFinite(enemy.y)));

console.log("Last Light core tests passed");
