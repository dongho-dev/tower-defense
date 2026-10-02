import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { defaultSave, loadSave, SAVE_KEY } from '../src/save.js';
import { createGame } from '../src/core/game.js';
import { CameraRig } from '../src/render/CameraRig.js';

// App's UI imports styles; its transition methods can run without a browser/GPU.
const cssHook = registerHooks({
    load(url, context, nextLoad) {
        if (url.endsWith('.css')) return { format: 'module', source: '', shortCircuit: true };
        return nextLoad(url, context);
    }
});
const { App } = await import('../src/app.js');
cssHook.deregister();

function storageWith(value) {
    return { getItem: () => JSON.stringify(value) };
}

test('손상된 저장 구조도 타이틀을 깨뜨리지 않고 기본 형태로 정규화한다', () => {
    const save = loadSave(
        storageWith({
            records: { dusk: null, frost: { normal: { stars: 2, best: 4 }, broken: null } },
            seen: {},
            settings: { quality: 'ultra', sound: 'yes', shake: null },
            lastDifficulty: 'nightmare',
            lastEndless: 'yes',
            stars: { ember: 3 }
        })
    );

    assert.deepEqual(save.records, {
        frost: { normal: { stars: 2, best: 4 } },
        ember: { normal: { stars: 3, best: 0 } }
    });
    assert.deepEqual(save.seen, []);
    assert.deepEqual(save.settings, { quality: 'high', sound: true, shake: true });
    assert.equal(save.lastDifficulty, 'normal');
    assert.equal(save.lastEndless, false);
});

test('유효한 발견 기록은 중복을 제거하고 이전 저장의 별을 보존한다', () => {
    const save = loadSave(
        storageWith({
            records: { dusk: { normal: { stars: 2, best: 17 } } },
            seen: ['grunt', 'grunt', 7, 'wraith'],
            settings: { quality: 'low', sound: false, shake: false },
            lastDifficulty: 'hero',
            lastEndless: true,
            lastMode: 'siege',
            stars: { dusk: 3 }
        })
    );

    assert.deepEqual(save.seen, ['grunt', 'wraith']);
    assert.deepEqual(save.settings, { quality: 'low', sound: false, shake: false });
    assert.deepEqual(save.records.dusk.normal, { stars: 3, best: 17 });
    assert.equal(save.lastDifficulty, 'hero');
    assert.equal(save.lastEndless, true);
    assert.equal(save.lastMode, 'siege');
});

test('저장소 접근 실패와 잘못된 JSON은 새 저장으로 폴백한다', () => {
    const expected = defaultSave();
    assert.deepEqual(loadSave({ getItem: () => '{bad json' }), expected);
    assert.deepEqual(
        loadSave({
            getItem() {
                throw new Error('storage blocked');
            }
        }),
        expected
    );
    assert.equal(SAVE_KEY, 'lastlight.v2');
});

function transitionApp(t) {
    const timers = [];
    t.mock.method(globalThis, 'setTimeout', (callback) => {
        timers.push(callback);
        return timers.length;
    });
    const oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
    Object.defineProperty(globalThis, 'window', { value: { innerWidth: 1280 }, configurable: true });
    t.after(() => {
        if (oldWindow) Object.defineProperty(globalThis, 'window', oldWindow);
        else delete globalThis.window;
    });
    const app = Object.create(App.prototype);
    const noop = () => {};
    const state = createGame('dusk');
    Object.assign(app, {
        state,
        save: { ...defaultSave(), tutorialDone: true },
        mode: 'select',
        fade: { classList: { add: noop, remove: noop } },
        worldMap: 'dusk',
        worldQuality: 'high',
        renderer: { qualityName: 'high' },
        world: { state },
        entities: { reset: t.mock.fn() },
        effects: { reset: t.mock.fn() },
        rig: new CameraRig(state.map.island),
        loop: {},
        hud: { setVisible: noop, reset: noop, showBanner: noop, showHint: t.mock.fn() },
        screens: { clear: noop, title: noop, select: noop },
        endSurvivalUI: noop,
        closeMenus: noop,
        persist: noop,
        buildWorld: t.mock.fn(() => {
            app.world = { state: app.state };
            app.worldMap = app.state.mapId;
            app.worldQuality = app.renderer.qualityName;
        })
    });
    return { app, timers };
}

test('품질을 바꾼 뒤 같은 맵을 다시 시작해도 월드와 이펙트를 새 품질로 만든다', (t) => {
    const { app, timers } = transitionApp(t);
    app.renderer.qualityName = 'low';
    app.startMap('dusk');
    timers.shift()();
    assert.equal(app.buildWorld.mock.callCount(), 1);
    assert.equal(app.worldQuality, 'low');
    app.startMap('dusk');
    timers.shift()();
    assert.equal(app.buildWorld.mock.callCount(), 1);
    assert.equal(app.entities.reset.mock.callCount(), 1);
});

test('빠르게 전장을 다시 고르면 마지막 전장과 난이도만 시작한다', (t) => {
    const { app, timers } = transitionApp(t);
    const initial = app.state;
    app.startMap('dusk', { difficulty: 'easy' });
    app.startMap('frostvale', { difficulty: 'hero' });
    timers.shift()();
    assert.equal(app.state, initial);
    timers.shift()();
    assert.equal(app.state.mapId, 'frostvale');
    assert.equal(app.state.difficulty, 'hero');
    assert.equal(app.buildWorld.mock.callCount(), 1);
});

test('이전 공성전의 지연 안내가 다음 일반 전투에 나타나지 않는다', (t) => {
    const { app, timers } = transitionApp(t);
    app.startMap('fortress');
    timers.shift()();
    const oldHint = timers.shift();
    assert.equal(typeof oldHint, 'function');
    app.startMap('dusk');
    timers.shift()();
    oldHint();
    assert.equal(app.state.mapId, 'dusk');
    assert.equal(app.hud.showHint.mock.callCount(), 0);
});

for (const destination of ['toTitle', 'toSelect']) {
    test(`${destination} 취소 후 예약된 전투가 뒤늦게 시작하지 않는다`, (t) => {
        const { app, timers } = transitionApp(t);
        const initial = app.state;
        app.startMap('frostvale');
        app[destination]();
        const mode = app.mode;
        timers.shift()();
        assert.equal(app.state, initial);
        assert.equal(app.mode, mode);
        assert.equal(app.buildWorld.mock.callCount(), 0);
    });
}

test('현재 존재하지 않는 저장된 난이도는 보통으로 돌아간다', () => {
    assert.equal(loadSave(storageWith({ lastDifficulty: 'hard' })).lastDifficulty, 'normal');
});
