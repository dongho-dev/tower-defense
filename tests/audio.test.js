import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Audio } from '../src/audio/audio.js';

// WebAudio 흉내: 만든 노드 수, 연결 상태, 끝난 소스를 센다
class Param {
    constructor(v = 0) {
        this.value = v;
    }
    setValueAtTime() {}
    linearRampToValueAtTime() {}
    exponentialRampToValueAtTime() {}
    setTargetAtTime() {}
    cancelScheduledValues() {}
    cancelAndHoldAtTime() {}
}
class Node {
    constructor(ctx) {
        this.ctx = ctx;
        this.out = new Set();
        ctx.made++;
        for (const k of [
            'gain',
            'frequency',
            'Q',
            'detune',
            'pan',
            'delayTime',
            'threshold',
            'knee',
            'ratio',
            'attack',
            'release'
        ])
            this[k] = new Param(1);
    }
    connect(n) {
        this.out.add(n);
        return n;
    }
    disconnect() {
        this.out.clear();
    }
}
class Source extends Node {
    start() {
        this.ctx.sources.add(this);
    }
    stop(t) {
        this.end = t;
    }
}
class FakeCtx {
    constructor() {
        this.made = 0;
        this.currentTime = 0;
        this.sampleRate = 8000;
        this.sources = new Set();
        this.destination = new Node(this);
    }
    createBuffer(ch, len) {
        return { getChannelData: () => new Float32Array(len) };
    }
    createOscillator() {
        return new Source(this);
    }
    createBufferSource() {
        return new Source(this);
    }
    createGain() {
        return new Node(this);
    }
    createBiquadFilter() {
        return new Node(this);
    }
    createDynamicsCompressor() {
        return new Node(this);
    }
    createDelay() {
        return new Node(this);
    }
    createStereoPanner() {
        return new Node(this);
    }
    /** 시간을 흘려 끝난 소스의 onended를 부른다 */
    advance(t) {
        this.currentTime = t;
        for (const s of this.sources)
            if (s.end <= t) {
                this.sources.delete(s);
                s.onended?.();
            }
    }
}

const calm = { spawners: [], enemies: [], towers: [], lives: 20, maxLives: 20 };
const combat = { spawners: [1], enemies: [{ def: {} }], towers: [], lives: 20, maxLives: 20 };

function rig() {
    const a = new Audio({ mode: () => 'playing' });
    const ctx = new FakeCtx();
    a.attach(ctx);
    return { a, ctx };
}

test('같은 소리는 동시 발음 수를 넘지 않는다 (처치가 한꺼번에 몰려도)', () => {
    const { a, ctx } = rig();
    let peak = 0;
    for (let f = 0; f < 120; f++) {
        ctx.advance(f / 60);
        a.handle(
            Array.from({ length: 40 }, () => ({ type: 'death', x: 0, z: 0 })),
            combat
        );
        peak = Math.max(peak, a.voices.filter((v) => v.name === 'death' && v.end > ctx.currentTime).length);
    }
    assert.ok(peak <= 4, `동시 처치음 ${peak}개`);
});

test('끝난 소리의 voice 노드는 떼어 내고 목록에서도 지운다', () => {
    const { a, ctx } = rig();
    for (let f = 0; f < 300; f++) {
        ctx.advance(f / 60);
        a.handle([{ type: 'hit' }, { type: 'death' }, { type: 'explode' }], combat);
    }
    ctx.advance(60);
    a.play('ui');
    assert.ok(a.voices.length <= 1, `남은 voice ${a.voices.length}개`);
    const live = [...ctx.sources].filter((s) => s.end > ctx.currentTime);
    assert.ok(live.length < 40, `아직 울리는 소스 ${live.length}개`);
});

test('음악은 탭이 오래 숨었다 돌아와도 밀린 마디를 몰아서 예약하지 않는다', () => {
    const { a, ctx } = rig();
    for (let f = 0; f < 600; f++) {
        ctx.advance(f / 60);
        a.handle([], combat);
    }
    const before = ctx.made;
    ctx.advance(600);
    a.handle([], combat);
    // 한 마디(북 16칸 + 오스티나토 8음 + 패드) 정도만 새로 만든다
    assert.ok(ctx.made - before < 200, `노드 ${ctx.made - before}개`);
});

test('웨이브를 막으면 전투 음악에서 준비 음악으로 돌아간다', () => {
    const { a, ctx } = rig();
    ctx.advance(0.1);
    a.handle([], combat);
    assert.equal(a.music.mood, 'combat');
    ctx.advance(0.5);
    a.handle([], calm);
    assert.equal(a.music.mood, 'combat', '적이 잠깐 비어도 바로 끊지 않는다');
    ctx.advance(2);
    a.handle([], calm);
    assert.equal(a.music.mood, 'calm');
});

test('소리를 끄면 아무것도 만들지 않는다', () => {
    const { a, ctx } = rig();
    a.enabled = false;
    const before = ctx.made;
    ctx.advance(1);
    a.handle([{ type: 'death' }, { type: 'waveStart' }], combat);
    assert.equal(ctx.made, before);
});
