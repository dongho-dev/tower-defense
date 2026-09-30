import '@fontsource/cinzel/600.css';
import '@fontsource/cinzel/800.css';
import './ui/styles.css';
import { createGame, step, drainEvents, buildTower, upgradeTower, callWave, TICK } from './core/game.js';
import { Renderer } from './render/Renderer.js';
import { CameraRig } from './render/CameraRig.js';
import { World } from './render/World.js';
import { EntityView } from './render/EntityView.js';
import { Effects } from './render/fx/Effects.js';

const params = new URLSearchParams(location.search);
const quality = params.get('q') || 'high';

const container = document.getElementById('stage');
const renderer = new Renderer(container, quality);
const state = createGame(params.get('map') || 'dusk', { gold: params.has('demo') ? 99999 : undefined });
const world = new World(renderer.renderer, state, renderer.quality);
const rig = new CameraRig(state.map.island);
rig.attach(renderer.renderer.domElement);
renderer.buildComposer(world.scene, rig.camera);
const entities = new EntityView(world.scene, world);
const effects = new Effects(world.scene, rig.camera, rig, entities, world, renderer.quality);
function onResize() {
    renderer.resize();
    effects.resize(renderer.renderer.domElement.height);
}
window.addEventListener('resize', onResize);
onResize();

const loop = { speed: 1, paused: false };
let last = performance.now();
let acc = 0;
let t = 0;
let pending = [];
function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t += dt;
    if (!loop.paused) {
        acc += dt * loop.speed;
        let n = 0;
        while (acc >= TICK && n++ < 12) {
            step(state, TICK);
            acc -= TICK;
        }
    }
    const events = pending.concat(drainEvents(state));
    pending = [];
    entities.update(state, events, t, dt);
    effects.handle(events, state);
    effects.update(loop.paused ? 0 : dt * loop.speed, t, state);
    rig.update(dt);
    world.update(t, dt);
    renderer.render(t);
    requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// 개발용 훅: ?demo 로 열면 타워를 미리 세우고 웨이브를 시작한다
const dev = {
    state,
    world,
    rig,
    renderer,
    entities,
    effects,
    loop,
    wave(n) {
        state.waveIndex = n - 1;
        state.nextWaveIn = 0.01;
        state.spawners = [];
        return callWave(state);
    },
    advance(sec) {
        for (let s = 0; s < sec; s += TICK) {
            step(state, TICK);
            pending.push(...drainEvents(state));
        }
        pending = pending.slice(-60);
    }
};
window.__game = dev;
if (params.has('demo')) {
    const plan = [
        [4, 'ranger', 'b'],
        [6, 'frost', 'a'],
        [5, 'ember', 'a'],
        [7, 'storm', 'a'],
        [8, 'ranger', 'a'],
        [11, 'storm', 'b'],
        [9, 'frost', 'b'],
        [10, 'ember', 'b'],
        [2, 'ember', null],
        [12, 'ranger', null],
        [13, 'storm', null],
        [0, 'frost', null],
        [1, 'ranger', null]
    ];
    plan.forEach(([sid, type, br], i) => {
        const tw = buildTower(state, sid, type).tower;
        const tiers = br ? 2 : i % 3;
        for (let k = 0; k < tiers; k++) upgradeTower(state, tw.id);
        if (br) upgradeTower(state, tw.id, br);
    });
    state.waveIndex = Number(params.get('wave') || 6) - 1;
    if (state.waveIndex > 0) state.nextWaveIn = 0.01;
    callWave(state);
}
