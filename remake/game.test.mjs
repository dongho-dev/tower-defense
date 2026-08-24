import assert from "node:assert/strict";
import {
  MAPS,
  TOWER_TYPES,
  buildTower,
  createGameState,
  pointOnRoute,
  resolveMap,
  sellTower,
  startWave,
  stepSimulation,
  towerStats,
  upgradeCost,
  upgradeTower,
  waveSpec
} from "./game.mjs";

assert.equal(Object.keys(MAPS).length, 3, "three route profiles should be available");
assert.equal(TOWER_TYPES.length, 8, "the armory should expose eight tower families");

for (const mapId of Object.keys(MAPS)) {
  const route = resolveMap(mapId);
  assert.ok(route.totalLength > 900, mapId + " route should have meaningful length");
  assert.ok(route.pads.length >= 12, mapId + " should provide enough build sockets");
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
