import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { TOWER_TYPES, buildTower, createGameState, startWave, stepSimulation } from "./game.mjs";

const state = createGameState("switchback");
state.started = true;
state.credits = 999999;

state.route.pads.forEach((pad, index) => {
  const definition = TOWER_TYPES[index % TOWER_TYPES.length];
  assert.equal(buildTower(state, definition.id, pad.index).ok, true);
});

state.wave = 29;
assert.equal(startWave(state), true);

const samples = [];
for (let frame = 0; frame < 1800; frame += 1) {
  const startedAt = performance.now();
  stepSimulation(state, 1 / 60);
  samples.push(performance.now() - startedAt);
  if (!state.waveActive && !state.gameOver) startWave(state);
}

samples.sort((a, b) => a - b);
const average = samples.reduce((sum, sample) => sum + sample, 0) / samples.length;
const p95 = samples[Math.floor(samples.length * 0.95)];
const max = samples[samples.length - 1];

assert.ok(average < 1, "simulation average should remain below 1ms");
assert.ok(p95 < 2, "simulation p95 should remain below 2ms");

console.log(JSON.stringify({
  scenario: "wave-30-plus",
  towers: state.towers.length,
  frames: samples.length,
  averageMs: Number(average.toFixed(4)),
  p95Ms: Number(p95.toFixed(4)),
  maxMs: Number(max.toFixed(4))
}));
