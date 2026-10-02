import { test } from 'node:test';
import { registerHooks } from 'node:module';
import assert from 'node:assert/strict';
import { createGame, buildTower, upgradeTower } from '../src/core/game.js';
import { keyOf } from '../src/ui/keys.js';

// 패널이 쓰는 만큼만 흉내 낸 DOM
class El {
    constructor() {
        this.dataset = {};
        this.listeners = {};
        this.innerHTML = '';
        this.classList = { add() {}, remove() {}, toggle() {} };
    }
    appendChild(c) {
        return c;
    }
    addEventListener(type, fn) {
        (this.listeners[type] ??= []).push(fn);
    }
    dispatch(type) {
        for (const fn of this.listeners[type] || []) fn({});
    }
    querySelectorAll() {
        return [];
    }
    querySelector() {
        return new El();
    }
}
const win = new El();
globalThis.window ??= win;
globalThis.document ??= { createElement: () => new El() };
// 패널이 끌어오는 UI 모듈이 스타일 파일을 import한다
const cssHook = registerHooks({
    load(url, context, nextLoad) {
        if (url.endsWith('.css')) return { format: 'module', source: '', shortCircuit: true };
        return nextLoad(url, context);
    }
});
const { Inspector } = await import('../src/ui/panel.js');
cssHook.deregister();

function rig() {
    const s = createGame('dusk', { gold: 5000 });
    const t = buildTower(s, 0, 'ranger').tower;
    const ins = new Inspector(new El(), { preview() {}, closed() {} });
    let renders = 0;
    const html = ins.towerHtml.bind(ins);
    ins.towerHtml = (...a) => (renders++, html(...a));
    ins.showTower(t, s);
    return { s, t, ins, renders: () => renders };
}

test('강화 버튼에 커서를 둔 채 최고 레벨이 되어도 패널이 터지지 않는다', () => {
    const { s, t, ins } = rig();
    upgradeTower(s, t.id);
    ins.hoverOpt = { kind: 'tier', key: '' };
    upgradeTower(s, t.id);
    assert.equal(t.tier, 3);
    assert.doesNotThrow(() => ins.update(s));
    assert.equal(ins.hoverOpt, null, '지난 단계의 미리보기는 지운다');
});

test('버튼을 누르는 동안에는 패널을 다시 그리지 않는다 (click이 사라지지 않게)', () => {
    const { s, ins, renders } = rig();
    ins.el.dispatch('pointerdown');
    const before = renders();
    s.gold += 500;
    ins.update(s);
    assert.equal(renders(), before, '누르는 중 다시 그림');
    win.dispatch('pointerup');
    ins.update(s);
    assert.equal(renders(), before + 1, '떼고 나면 밀린 갱신을 그린다');
});

test('한글 입력 상태에서도 글자·숫자 단축키를 자판 위치로 읽는다', () => {
    assert.equal(keyOf({ code: 'KeyU', key: 'ㅕ' }), 'u');
    assert.equal(keyOf({ code: 'KeyA', key: 'Process' }), 'a');
    assert.equal(keyOf({ code: 'Digit3', key: '3' }), '3');
    assert.equal(keyOf({ code: 'Space', key: ' ' }), ' ');
    assert.equal(keyOf({ code: 'Escape', key: 'Escape' }), 'Escape');
});

test('커서가 패널 위에 있는 동안은 버튼을 새로 만들지 않고 골드 부족 표시만 고친다', () => {
    const { s, ins, renders } = rig();
    ins.el.dispatch('pointerenter');
    const before = renders();
    s.gold += 500;
    ins.update(s);
    assert.equal(renders(), before);
    ins.el.dispatch('pointerleave');
    ins.update(s);
    assert.equal(renders(), before + 1);
});
