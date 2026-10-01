// 장면 쪽 누수 회귀 테스트: 실제 게임을 돌리며 EntityView·Effects를 갱신하고,
// 재시작(reset)을 여러 번 해도 장면 개체 수·살아 있는 geometry 수가 처음과 같은지 본다.
// WebGL 없이 three의 장면 그래프만 쓴다. 텍스처용 canvas는 가짜로 둔다.
import { test } from 'node:test';
import assert from 'node:assert/strict';

// ---- 가짜 canvas (2D 그리기 호출은 모두 무시) ----
const ctx2d = new Proxy(
    {},
    {
        get(_t, k) {
            if (k === 'getImageData' || k === 'createImageData')
                return (...a) => {
                    const w = a.length >= 4 ? a[2] : a[0]?.width || a[0] || 1;
                    const h = a.length >= 4 ? a[3] : a[0]?.height || a[1] || 1;
                    return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
                };
            if (k === 'createRadialGradient' || k === 'createLinearGradient' || k === 'createPattern')
                return () => ({ addColorStop() {} });
            if (k === 'measureText') return () => ({ width: 10 });
            return () => {};
        },
        set: () => true
    }
);
globalThis.document ??= {
    createElement: () => ({ width: 1, height: 1, style: {}, getContext: () => ctx2d, addEventListener() {} })
};

const THREE = await import('three');
const { createGame, step, drainEvents, buildTower, callWave, castSkill, TICK } = await import('../src/core/game.js');
const { TOWER_ORDER } = await import('../src/core/data/towers.js');
const { EntityView } = await import('../src/render/EntityView.js');
const { Effects } = await import('../src/render/fx/Effects.js');

// 살아 있는 geometry 수: 처음 속성을 붙일 때 +1, dispose 때 -1
let liveGeo = 0;
const origDispose = THREE.BufferGeometry.prototype.dispose;
const tracked = new WeakSet();
const origInit = THREE.BufferGeometry.prototype.setAttribute;
THREE.BufferGeometry.prototype.setAttribute = function (...a) {
    if (!tracked.has(this)) {
        tracked.add(this);
        liveGeo++;
        this.__live = true;
    }
    return origInit.apply(this, a);
};
THREE.BufferGeometry.prototype.dispose = function () {
    if (this.__live) {
        this.__live = false;
        liveGeo--;
    }
    return origDispose.call(this);
};

function stubWorld() {
    return {
        heightAt: () => 0,
        sockets: { topY: () => 0.5 },
        portals: [{ group: new THREE.Group() }],
        portal: { group: new THREE.Group() },
        core: { top: new THREE.Vector3(0, 2, 0) },
        terrain: { ellipseR: () => 0.5 }
    };
}

function countObjects(scene) {
    let n = 0;
    scene.traverse(() => n++);
    return n;
}

/** 한 판을 secs초 동안 돌린다: 타워를 짓고 웨이브를 부르고 이펙트·모델을 갱신 */
function playFor(state, view, fx, secs) {
    let t = 0;
    let k = 0;
    for (; t < secs && state.status === 'playing'; t += TICK) {
        step(state, TICK);
        const evs = drainEvents(state);
        view.update(state, evs, t, TICK);
        fx.handle(evs, state);
        fx.update(TICK, t, state);
        if (++k % 30 === 0) {
            state.gold = Math.max(state.gold, 3000);
            state.lives = Math.max(state.lives, 20);
            const free = state.sockets.find((s) => s.towerId == null);
            if (free) buildTower(state, free.id, TOWER_ORDER[k % TOWER_ORDER.length]);
            callWave(state);
            if (k % 300 === 0 && state.enemies[0]) castSkill(state, 'meteor', state.enemies[0].x, state.enemies[0].z);
        }
    }
}

test('재시작을 여러 번 해도 장면 개체·geometry 수가 처음과 같다 (reset 누수 없음)', () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    const rig = { shake() {}, camera };
    let state;
    const world = stubWorld();
    const view = new EntityView(scene, world);
    const fx = new Effects(scene, camera, rig, view, world, { particles: 0.3 });
    const baseObjs = countObjects(scene);
    const counts = [];
    for (let run = 0; run < 4; run++) {
        state = createGame('dusk');
        playFor(state, view, fx, 40);
        view.reset();
        fx.reset();
        // 재시작 직후 한 프레임 (빈 상태로 동기화)
        state = createGame('dusk');
        view.update(state, [], 0, 0);
        fx.update(0.016, 0, state);
        counts.push({ objs: countObjects(scene), geo: liveGeo });
    }
    // 이펙트 풀(고리 등)은 처음 몇 판에 걸쳐 자랄 수 있으니 2판째부터 같아야 한다
    for (let i = 2; i < counts.length; i++) {
        assert.ok(counts[i].objs <= counts[1].objs + 2, `objs ${JSON.stringify(counts)} base ${baseObjs}`);
        assert.ok(counts[i].geo <= counts[1].geo + 2, `geo ${JSON.stringify(counts)}`);
    }
    assert.equal(view.enemies.size, 0);
    assert.equal(view.towers.size, 0);
    assert.equal(view.dying.length, 0);
});

test('오래 플레이해도 장면 개체 수는 화면 속 개체 수를 따라간다 (계속 늘지 않음)', () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    const rig = { shake() {}, camera };
    const world = stubWorld();
    const view = new EntityView(scene, world);
    const fx = new Effects(scene, camera, rig, view, world, { particles: 0.3 });
    const state = createGame('dusk', { endless: true });
    const samples = [];
    for (let i = 0; i < 4; i++) {
        playFor(state, view, fx, 40);
        const live = state.enemies.length + state.towers.length + (state.units?.length || 0);
        samples.push({ objs: countObjects(scene), live, geo: liveGeo });
    }
    // 개체 하나당 장면 오브젝트 수가 일정 범위 안: 끝에서 처음보다 크게 늘지 않는다
    const per = samples.map((s) => (s.objs - 50) / Math.max(1, s.live));
    assert.ok(per.at(-1) < per[1] * 1.6 + 5, JSON.stringify(samples));
});
