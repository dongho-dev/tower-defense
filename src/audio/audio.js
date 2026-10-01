// WebAudio 합성 효과음 + 상태별 음악. 외부 음원 없음.
// 소리 길: 소리마다 voice(음량·좌우) → 버스(sfx·ui·music·amb) → master → 글루 컴프레서 → 리미터 → 출력
import { Vector3 } from 'three';
import { Music } from './music.js';

// gap: 같은 소리 최소 간격(초), max: 같은 소리 동시 발음 수, prio: 붐빌 때 남길 순서(클수록 중요),
// vol: 소리별 음량, full: 저역을 깎지 않는 드문 큰 소리
const SPEC = {
    fire_ranger: { gap: 0.045, max: 4, prio: 1, vol: 2.1 },
    fire_ember: { gap: 0.08, max: 3, prio: 2, vol: 0.6 },
    fire_frost: { gap: 0.06, max: 3, prio: 1, vol: 0.67 },
    fire_arcane: { gap: 0.1, max: 3, prio: 1, vol: 0.56 },
    hit: { gap: 0.035, max: 4, prio: 1, vol: 2 },
    frost_hit: { gap: 0.05, max: 3, prio: 1, vol: 1 },
    shatter: { gap: 0.06, max: 2, prio: 2, vol: 0.4 },
    chain: { gap: 0.06, max: 3, prio: 2, vol: 1.4 },
    chain_big: { gap: 0.08, max: 2, prio: 2, vol: 0.9 },
    explode: { gap: 0.06, max: 3, prio: 2, vol: 0.78 },
    death: { gap: 0.045, max: 4, prio: 3, vol: 1.75 },
    death_big: { prio: 4, vol: 0.7, full: true },
    income: { gap: 0.08, max: 2, prio: 1, vol: 0.6 },
    clash: { gap: 0.07, max: 3, prio: 1, vol: 2.4 },
    siege_hit: { gap: 0.1, max: 2, prio: 2, vol: 0.95 },
    blink: { gap: 0.1, max: 2, prio: 2 },
    immune: { gap: 0.3, max: 1, prio: 1 },
    stun: { gap: 0.2, max: 2, prio: 2 },
    heal: { gap: 0.12, max: 2, prio: 1, vol: 1 },
    boss: { prio: 5, full: true },
    meteor_impact: { prio: 5, vol: 0.8, full: true },
    collapse: { prio: 4, full: true },
    defeat: { prio: 5, full: true },
    ui: { gap: 0.03, max: 2, prio: 5, bus: 'ui', vol: 1.4 },
    deny: { gap: 0.15, max: 1, prio: 5, bus: 'ui', vol: 0.6 },
    tick: { gap: 0.3, max: 1, prio: 5, bus: 'ui', vol: 1.8 }
};
const BASE = { gap: 0, max: 3, prio: 4, vol: 1 };
// 덕킹: 꼭 들려야 하는 순간 음악과 바람을 잠깐 낮춘다 [dB, 유지 초]
const DUCK = {
    wave: [-5, 1.2],
    boss: [-10, 2.2],
    meteor_impact: [-8, 1],
    leak: [-6, 0.6],
    death_big: [-5, 0.8],
    collapse: [-6, 1],
    freeze: [-4, 0.8],
    victory: [-12, 2.5],
    defeat: [-12, 2.5]
};
const MAX_VOICES = 28;
const LEVEL = { sfx: 1, ui: 0.8, music: 0.08, amb: 0.4 };
// 처치 보상음: D 도리안 위쪽 음
const SPARKLE = [1175, 1319, 1568, 1760];
const _v = new Vector3();

export class Audio {
    /** @param {{ mode?: () => string, camera?: () => import('three').Camera }} [hooks] 화면 상태(일시정지·결과)와 카메라(좌우 위치) */
    constructor(hooks = {}) {
        this.hooks = hooks;
        this.ctx = null;
        this._enabled = true;
        this.volume = 0.8;
        this.lastPlay = {};
        this.voices = [];
        this.paused = false;
        this.calmSince = 0;
        this.waveIn = null;
        // 버튼 누름은 UI 파일을 고치지 않고 여기서 한 번에 듣는다. 첫 누름에 소리도 깨운다(타이틀 음악).
        if (typeof document !== 'undefined') document.addEventListener('pointerdown', (e) => this.onPointer(e), true);
    }

    unlock() {
        if (!this._enabled) return;
        if (!this.ctx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return;
            this.attach(new AC());
        }
        if (this.ctx.state === 'suspended') this.ctx.resume();
    }

    /** 소리 길을 만든다. 측정 도구는 OfflineAudioContext를 넘긴다 */
    attach(ctx) {
        this.ctx = ctx;
        const c = ctx;
        const glue = c.createDynamicsCompressor();
        glue.threshold.value = -20;
        glue.knee.value = 10;
        glue.ratio.value = 3;
        glue.attack.value = 0.01;
        glue.release.value = 0.25;
        const limit = c.createDynamicsCompressor();
        limit.threshold.value = -6;
        limit.knee.value = 0;
        limit.ratio.value = 20;
        limit.attack.value = 0.002;
        limit.release.value = 0.12;
        this.master = c.createGain();
        this.master.gain.value = this._enabled ? this.volume : 0;
        // 리미터가 막 넘친 순간도 -1dBFS 아래에 두도록 조금 깎아 내보낸다
        const trim = c.createGain();
        trim.gain.value = 0.88;
        this.master.connect(glue).connect(limit).connect(trim).connect(c.destination);
        const gain = (v, to) => {
            const g = c.createGain();
            g.gain.value = v;
            g.connect(to);
            return g;
        };
        // 잦은 효과음의 저역이 쌓여 웅웅거리지 않게 100Hz 아래를 깎는다. 드문 큰 소리는 따로 보낸다.
        const hp = c.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 100;
        hp.Q.value = 0.6;
        hp.connect(this.master);
        // 음악: 덕킹 → 일시정지 때 먹먹하게 하는 저역통과 → 120Hz 아래 정리
        this.musicTone = c.createBiquadFilter();
        this.musicTone.type = 'lowpass';
        this.musicTone.frequency.value = 16000;
        const mhp = c.createBiquadFilter();
        mhp.type = 'highpass';
        mhp.frequency.value = 110;
        this.musicTone.connect(mhp).connect(this.master);
        this.duckM = gain(1, this.musicTone);
        this.duckA = gain(1, this.master);
        this.bus = {
            sfx: gain(LEVEL.sfx, hp),
            full: gain(LEVEL.sfx, this.master),
            ui: gain(LEVEL.ui, this.master),
            music: gain(LEVEL.music, this.duckM),
            amb: gain(LEVEL.amb, this.duckA)
        };
        this.noiseBuf = this.makeNoise();
        this.music = new Music(c, this.bus.music, this.noiseBuf);
        this.startAmbience();
    }

    set enabled(v) {
        this._enabled = v;
        if (this.master) this.master.gain.setTargetAtTime(v ? this.volume : 0, this.ctx.currentTime, 0.05);
        // 소리를 켠 그 누름에서 바로 깨운다
        if (v && typeof navigator !== 'undefined' && navigator.userActivation?.isActive) this.unlock();
    }

    get enabled() {
        return this._enabled;
    }

    makeNoise() {
        const len = this.ctx.sampleRate * 1.5;
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        return buf;
    }

    onPointer(e) {
        this.unlock();
        const b = e.target?.closest?.('button, [data-a], [data-opt], [data-map]');
        if (!b) return;
        const no = b.disabled || b.matches('.disabled, .poor, .off, [aria-disabled="true"]');
        this.play(no ? 'deny' : 'ui');
    }

    // ---------- 합성 부품 (this.out = 지금 만드는 소리의 voice) ----------
    env(node, t, a, peak, d, sustain = 0.0001) {
        const g = node.gain;
        g.setValueAtTime(0.0001, t);
        g.exponentialRampToValueAtTime(peak, t + a);
        g.exponentialRampToValueAtTime(Math.max(0.0001, sustain), t + a + d);
    }

    track(src, end) {
        if (end > this._end) {
            this._end = end;
            this._last = src;
        }
    }

    tone(type, f0, f1, dur, peak, t = this.ctx.currentTime, attack = 0.005) {
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(f0, t);
        if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
        this.env(g, t, attack, peak, dur);
        o.connect(g).connect(this.out);
        o.start(t);
        o.stop(t + attack + dur + 0.05);
        this.track(o, t + attack + dur + 0.05);
    }

    noise(filterType, f0, f1, q, dur, peak, t = this.ctx.currentTime, attack = 0.003) {
        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuf;
        const f = this.ctx.createBiquadFilter();
        f.type = filterType;
        f.Q.value = q;
        f.frequency.setValueAtTime(f0, t);
        if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
        const g = this.ctx.createGain();
        this.env(g, t, attack, peak, dur);
        src.connect(f).connect(g).connect(this.out);
        src.start(t, Math.random() * 0.5);
        src.stop(t + attack + dur + 0.05);
        this.track(src, t + attack + dur + 0.05);
    }

    /** 아주 짧은 '틱': 타격 순간을 또렷하게 */
    click(t, f, peak) {
        this.noise('bandpass', f, f, 0.9, 0.006, peak, t, 0.0005);
    }

    horn(t, freqs, dur, peak) {
        for (const f of freqs) {
            const o = this.ctx.createOscillator();
            o.type = 'sawtooth';
            o.frequency.setValueAtTime(f * 0.97, t);
            o.frequency.linearRampToValueAtTime(f, t + 0.25);
            const filt = this.ctx.createBiquadFilter();
            filt.type = 'lowpass';
            filt.frequency.setValueAtTime(300, t);
            filt.frequency.linearRampToValueAtTime(1600, t + 0.35);
            filt.frequency.linearRampToValueAtTime(500, t + dur);
            const g = this.ctx.createGain();
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(peak / freqs.length, t + 0.2);
            g.gain.setValueAtTime(peak / freqs.length, t + dur * 0.6);
            g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
            o.connect(filt).connect(g).connect(this.out);
            o.start(t);
            o.stop(t + dur + 0.05);
            this.track(o, t + dur + 0.05);
        }
    }

    /** 화면 위치 → 좌우와 음량. 화면 밖 사건은 작게 */
    locate(x, z) {
        const cam = x == null ? null : this.hooks.camera?.();
        if (!cam) return null;
        _v.set(x, 0, z).project(cam);
        const off = _v.z > 1 || Math.abs(_v.x) > 1.05 || Math.abs(_v.y) > 1.05;
        return { pan: Math.max(-1, Math.min(1, _v.x)) * 0.6, gain: off ? 0.45 : 1 };
    }

    duck(db, hold) {
        const t = this.ctx.currentTime;
        const v = 10 ** (db / 20);
        for (const g of [this.duckM.gain, this.duckA.gain]) {
            g.cancelScheduledValues(t);
            g.setTargetAtTime(v, t, 0.03);
            g.setTargetAtTime(1, t + hold, 0.5);
        }
    }

    // ---------- 효과음 ----------
    play(name, x, z) {
        if (!this.ctx || !this._enabled) return;
        const now = this.ctx.currentTime;
        const sp = { ...BASE, ...SPEC[name] };
        if (now - (this.lastPlay[name] ?? -1) < sp.gap) return;
        let same = 0,
            live = 0;
        for (const v of this.voices) {
            if (v.end <= now) continue;
            this.voices[live++] = v;
            if (v.name === name) same++;
        }
        this.voices.length = live;
        if (same >= sp.max) return;
        // 붐빌 때는 잦은 소리부터 뺀다
        if (live >= MAX_VOICES && sp.prio <= 3) return;
        this.lastPlay[name] = now;

        const c = this.ctx;
        const at = this.locate(x, z);
        // 같은 소리가 겹겹이 쌓여 커지지 않게 겹친 수만큼 조금씩 줄인다
        const vg = c.createGain();
        vg.gain.value = (sp.vol * (at?.gain ?? 1)) / Math.sqrt(1 + same * 0.6);
        const bus = this.bus[sp.bus || (sp.full ? 'full' : 'sfx')];
        let pan = null;
        if (at?.pan && c.createStereoPanner) {
            pan = c.createStereoPanner();
            pan.pan.value = at.pan;
            vg.connect(pan).connect(bus);
        } else vg.connect(bus);
        this.out = vg;
        this._end = now;
        this._last = null;
        this.recipe(name, now);
        if (!this._last) return vg.disconnect();
        // 마지막 소스가 끝나면 voice 노드를 떼어 낸다 (오래 해도 노드가 남지 않게)
        this._last.onended = () => {
            vg.disconnect();
            pan?.disconnect();
        };
        this.voices.push({ name, end: this._end });
        if (DUCK[name]) this.duck(...DUCK[name]);
    }

    recipe(name, t) {
        const r = (a = 0.08) => 1 - a + Math.random() * 2 * a;
        const v3 = (Math.random() * 3) | 0;
        switch (name) {
            case 'fire_ranger': // 시위 '퉁' + 화살 바람
                this.noise('bandpass', 3400 * r(), 1500, 2.2, 0.07, 0.5, t, 0.002);
                this.tone('triangle', [620, 700, 560][v3] * r(0.04), 330, 0.06, 0.35, t, 0.002);
                this.click(t, 5200, 0.25);
                break;
            case 'fire_ember': // 화염포: 둔탁한 '펑' + 불길
                this.tone('sine', 240 * r(), 110, 0.16, 0.6, t, 0.003);
                this.noise('lowpass', 2600, 380, 0.7, 0.28, 0.45, t);
                for (let i = 0; i < 3; i++)
                    this.noise(
                        'bandpass',
                        1800 + Math.random() * 1400,
                        1500,
                        3,
                        0.015,
                        0.3,
                        t + 0.03 + Math.random() * 0.12,
                        0.001
                    );
                break;
            case 'fire_frost':
                this.tone('sine', 1560 * r(), 2080, 0.12, 0.3, t);
                this.tone('triangle', 2340 * r(), 1760, 0.16, 0.18, t + 0.015);
                break;
            case 'fire_arcane':
                this.tone('sine', 880 * r(), 1320, 0.22, 0.3, t);
                this.tone('triangle', 1320 * r(), 1760, 0.26, 0.18, t + 0.03);
                break;
            case 'hit': // 박히는 '탁'
                this.noise('bandpass', 2100 * r(0.15), 1100, 1.4, 0.035, 0.9, t, 0.001);
                this.tone('sine', [430, 480, 390][v3] * r(0.04), 240, 0.035, 0.22, t, 0.001);
                this.click(t, 3800, 0.3);
                break;
            case 'frost_hit': // 얼음 '쨍'
                this.tone('sine', 2350 * r(), 2150, 0.11, 0.35, t, 0.001);
                this.tone('triangle', 3500 * r(), 3100, 0.06, 0.15, t, 0.001);
                this.noise('bandpass', 3200, 2600, 3, 0.03, 0.3, t, 0.001);
                break;
            case 'shatter':
                for (let i = 0; i < 5; i++)
                    this.tone('sine', 1800 + Math.random() * 2000, 1300, 0.18, 0.2, t + i * 0.02, 0.001);
                this.noise('bandpass', 3000, 1800, 1.2, 0.2, 0.4, t, 0.001);
                break;
            case 'chain': // 번개 '지지직'
                for (let i = 0; i < 4; i++)
                    this.noise('bandpass', 2200 + Math.random() * 2400, 1300, 4, 0.03, 0.45, t + i * 0.028, 0.001);
                this.tone('sawtooth', 190 * r(), 120, 0.14, 0.12, t);
                break;
            case 'chain_big':
                for (let i = 0; i < 6; i++)
                    this.noise('bandpass', 1800 + Math.random() * 3200, 900, 4, 0.05, 0.5, t + i * 0.032, 0.001);
                this.tone('sawtooth', 170, 95, 0.3, 0.18, t);
                break;
            case 'explode': // 짧은 몸통 + 부서지는 중역
                this.tone('sine', 150 * r(), 60, 0.22, 0.5, t, 0.002);
                this.noise('lowpass', 3600, 300, 0.7, 0.42, 0.55, t, 0.002);
                this.noise('bandpass', 1200 * r(), 500, 1.2, 0.14, 0.45, t, 0.001);
                break;
            case 'death': // 처치 '퍽' + 작은 보상음
                this.noise('bandpass', [1300, 1600, 1100][v3] * r(), 380, 1.1, 0.13, 0.55, t, 0.001);
                this.tone('triangle', [560, 640, 500][v3] * r(), 170, 0.11, 0.3, t, 0.001);
                {
                    const f = SPARKLE[(Math.random() * 4) | 0];
                    this.tone('sine', f, f, 0.09, 0.1, t + 0.035, 0.002);
                }
                break;
            case 'death_big':
                this.tone('sawtooth', 200, 50, 1, 0.22, t);
                this.noise('lowpass', 2400, 120, 0.6, 1.2, 0.55, t);
                this.noise('bandpass', 900, 300, 1, 0.3, 0.45, t, 0.002);
                this.tone('sine', 70, 35, 1.2, 0.45, t);
                [1175, 1568, 1760].forEach((f, i) => this.tone('sine', f, f, 0.3, 0.1, t + 0.15 + i * 0.07));
                break;
            case 'build': // 나무 '쿵' + 맑은 두 음
                this.noise('bandpass', 900, 280, 1, 0.12, 0.45, t, 0.002);
                this.tone('sine', 240, 150, 0.12, 0.4, t, 0.002);
                this.tone('triangle', 660, 660, 0.25, 0.2, t + 0.08);
                this.tone('triangle', 990, 990, 0.35, 0.16, t + 0.16);
                break;
            case 'upgrade':
                [523, 659, 784, 1047].forEach((f, i) => this.tone('triangle', f, f, 0.3, 0.18, t + i * 0.07));
                this.noise('highpass', 5000, 8000, 0.5, 0.5, 0.06, t + 0.1);
                break;
            case 'branch':
                [392, 523, 659, 784, 1047, 1319].forEach((f, i) =>
                    this.tone('triangle', f, f, 0.45, 0.16, t + i * 0.06)
                );
                this.tone('sine', 196, 196, 0.9, 0.25, t);
                break;
            case 'sell':
                [1318, 1568, 2093].forEach((f, i) => this.tone('square', f, f, 0.08, 0.05, t + i * 0.05));
                break;
            case 'income':
                for (let i = 0; i < 3; i++)
                    this.tone('triangle', 1400 + i * 350, 1500 + i * 350, 0.12, 0.1, t + i * 0.06);
                break;
            case 'leak': // 경보: 어긋난 두 음
                this.tone('sawtooth', 440, 330, 0.35, 0.16, t);
                this.tone('sawtooth', 466, 349, 0.35, 0.13, t);
                this.tone('sine', 170, 95, 0.4, 0.45, t);
                break;
            case 'wave':
                this.horn(t, [146.8, 196, 220], 1.3, 0.3);
                break;
            case 'boss':
                this.horn(t, [73.4, 87.3, 110, 146.8], 2.6, 0.4);
                for (let i = 0; i < 4; i++) {
                    this.tone('sine', 120, 50, 0.4, 0.5, t + 0.5 + i * 0.5, 0.002);
                    this.noise('bandpass', 700, 300, 1, 0.12, 0.3, t + 0.5 + i * 0.5, 0.002);
                }
                break;
            case 'meteor_cast':
                this.noise('bandpass', 300, 2400, 2, 0.9, 0.35, t, 0.4);
                break;
            case 'meteor_impact':
                this.tone('sine', 80, 26, 1.2, 0.8, t);
                this.noise('lowpass', 3000, 60, 0.7, 1.6, 0.8, t);
                this.noise('bandpass', 1100, 250, 1, 0.6, 0.5, t + 0.03);
                break;
            case 'freeze':
                for (let i = 0; i < 10; i++)
                    this.tone('sine', 1500 + Math.random() * 3500, 2000, 0.6, 0.04, t + i * 0.04);
                this.noise('highpass', 7000, 3000, 0.5, 1.2, 0.15, t, 0.05);
                this.tone('sine', 220, 110, 1.2, 0.25, t);
                break;
            case 'heal':
                this.tone('sine', 880, 1320, 0.3, 0.08, t);
                break;
            case 'victory':
                [
                    [392, 0],
                    [523, 0.18],
                    [659, 0.36],
                    [784, 0.54],
                    [1047, 0.8]
                ].forEach(([f, d]) => {
                    this.tone('triangle', f, f, 1.2, 0.14, t + d);
                    this.tone('sine', f / 2, f / 2, 1.2, 0.1, t + d);
                });
                break;
            case 'defeat':
                [
                    [392, 0],
                    [349, 0.4],
                    [311, 0.8],
                    [262, 1.2]
                ].forEach(([f, d]) => this.tone('sawtooth', f, f * 0.98, 1.1, 0.08, t + d, 0.08));
                this.tone('sine', 55, 40, 3, 0.4, t);
                break;
            case 'ui': // 맑은 '톡'
                this.tone('sine', 1320, 1180, 0.035, 0.3, t, 0.001);
                this.click(t, 3200, 0.15);
                break;
            case 'deny': // 낮은 '뿝뿝'
                this.tone('square', 233, 220, 0.06, 0.14, t, 0.002);
                this.tone('square', 196, 185, 0.08, 0.14, t + 0.085, 0.002);
                break;
            case 'tick': // 웨이브 3초 전 나무 똑딱
                this.tone('sine', 1800, 1700, 0.03, 0.3, t, 0.001);
                this.noise('bandpass', 2500, 2500, 6, 0.02, 0.25, t, 0.001);
                break;
            case 'clash':
                this.noise('bandpass', 3400 * r(), 2400, 3, 0.06, 0.6, t, 0.001);
                this.tone('square', 1200 * r(), 900, 0.05, 0.12, t, 0.001);
                break;
            case 'slam':
                this.tone('sine', 140, 60, 0.5, 0.5, t);
                this.noise('lowpass', 2400, 200, 0.8, 0.5, 0.4, t);
                [523, 659, 784].forEach((f, i) => this.tone('triangle', f, f, 0.5, 0.08, t + i * 0.04));
                break;
            case 'level':
                [659, 784, 988, 1319].forEach((f, i) => this.tone('triangle', f, f, 0.35, 0.12, t + i * 0.08));
                break;
            case 'siege_hit':
                this.noise('bandpass', 1100, 400, 1, 0.16, 0.45, t, 0.002);
                this.tone('sine', 220 * r(), 110, 0.15, 0.3, t);
                break;
            case 'collapse':
                this.noise('lowpass', 1600, 120, 0.7, 1.4, 0.6, t);
                this.noise('bandpass', 800, 250, 1, 0.5, 0.35, t + 0.05);
                this.tone('sine', 60, 30, 1.4, 0.45, t);
                break;
            case 'repair':
                [880, 1175].forEach((f, i) => this.tone('triangle', f, f * 1.02, 0.12, 0.08, t + i * 0.09));
                this.noise('bandpass', 4200, 3000, 6, 0.05, 0.12, t);
                break;
            case 'blink':
                this.tone('sine', 300, 1400, 0.18, 0.1, t);
                break;
            case 'stun':
                this.tone('sawtooth', 220, 110, 0.4, 0.08, t);
                this.noise('lowpass', 1800, 200, 0.7, 0.4, 0.25, t);
                break;
            case 'shield':
                this.tone('sine', 1200, 2000, 0.5, 0.08, t);
                this.tone('triangle', 1800, 2600, 0.6, 0.05, t + 0.05);
                break;
            case 'shatter_big':
                for (let i = 0; i < 6; i++)
                    this.tone('triangle', 2000 + Math.random() * 2400, 900, 0.3, 0.06, t + i * 0.03);
                break;
            case 'immune':
                this.tone('triangle', 400, 380, 0.08, 0.2, t);
                break;
        }
    }

    startAmbience() {
        // 바람: 천천히 오가는 띠 잡음. 저역은 깎아 음악·효과음과 겹치지 않게 한다.
        const c = this.ctx;
        const t = c.currentTime;
        const src = c.createBufferSource();
        src.buffer = this.noiseBuf;
        src.loop = true;
        const f = c.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = 700;
        f.Q.value = 0.5;
        const lfo = c.createOscillator();
        lfo.frequency.value = 0.07;
        const depth = c.createGain();
        depth.gain.value = 300;
        lfo.connect(depth).connect(f.frequency);
        const hp = c.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 220;
        const g = c.createGain();
        g.gain.value = 0.03;
        src.connect(f).connect(hp).connect(g).connect(this.bus.amb);
        src.start(t);
        lfo.start(t);
    }

    /** 지금 상태에 맞는 음악 분위기 (매 프레임) */
    follow(state, now) {
        const mode = this.hooks.mode?.() ?? 'playing';
        const s = state || {};
        let mood = 'calm';
        if (mode === 'results' || s.status === 'won' || s.status === 'lost') mood = 'off';
        else if (mode === 'playing' || mode === 'paused') {
            const running = (s.spawners?.length || 0) + (s.enemies?.length || 0) > 0;
            if (running) mood = s.enemies?.some((e) => e.def?.boss) ? 'boss' : 'combat';
        }
        // 그룹 사이에 적이 잠깐 비어도 전투 음악이 끊기지 않게 1초 기다린다
        if (mood === 'calm' && (this.music.mood === 'combat' || this.music.mood === 'boss')) {
            if (!this.calmSince) this.calmSince = now;
            if (now - this.calmSince < 1) mood = this.music.mood;
        } else this.calmSince = 0;
        const danger = (mood === 'combat' || mood === 'boss') && s.maxLives > 0 && s.lives / s.maxLives <= 0.3;
        this.music.set(mood, danger, now);
        this.music.tick(now);
        const paused = mode === 'paused';
        if (paused !== this.paused) {
            this.paused = paused;
            this.musicTone.frequency.setTargetAtTime(paused ? 700 : 16000, now, 0.15);
        }
        // 웨이브가 저절로 시작되기 3초 전부터 매초 똑딱
        const w = mode === 'playing' ? s.nextWaveIn : null;
        if (w != null && this.waveIn != null && w > 0 && Math.ceil(w) < Math.ceil(this.waveIn) && Math.ceil(w) <= 3)
            this.play('tick');
        this.waveIn = w ?? null;
    }

    handle(events, state) {
        if (!this.ctx || !this._enabled) return;
        this.follow(state, this.ctx.currentTime);
        for (const ev of events) {
            switch (ev.type) {
                case 'fire':
                    if (ev.tower !== 'storm') {
                        const tw = state?.towers?.find((t) => t.id === ev.towerId);
                        this.play('fire_' + ev.tower, tw?.x, tw?.z);
                    }
                    break;
                case 'chain':
                    this.play(ev.branch === 'b' ? 'chain_big' : 'chain', ev.x, ev.z);
                    break;
                case 'hit':
                    this.play(ev.shattered ? 'shatter' : 'hit', ev.x, ev.z);
                    break;
                case 'frostHit':
                    this.play('frost_hit', ev.x, ev.z);
                    break;
                case 'explode':
                    this.play('explode', ev.x, ev.z);
                    break;
                case 'death':
                    this.play(ev.boss || ev.elite ? 'death_big' : 'death', ev.x, ev.z);
                    break;
                case 'build':
                    this.play('build', ev.x, ev.z);
                    break;
                case 'upgrade':
                    this.play(ev.branch ? 'branch' : 'upgrade');
                    break;
                case 'sell':
                    this.play('sell');
                    break;
                case 'income':
                    this.play('income');
                    break;
                case 'leak':
                    this.play('leak');
                    break;
                case 'waveStart':
                    this.play(ev.boss ? 'boss' : 'wave');
                    break;
                case 'meteorCast':
                    this.play('meteor_cast');
                    break;
                case 'meteorImpact':
                    this.play('meteor_impact', ev.x, ev.z);
                    break;
                case 'freeze':
                    this.play('freeze');
                    break;
                case 'heal':
                case 'pollen':
                    this.play('heal', ev.x, ev.z);
                    break;
                case 'unitHit':
                    this.play('clash', ev.x, ev.z);
                    break;
                case 'heroSlam':
                    this.play('slam', ev.x, ev.z);
                    break;
                case 'heroLevel':
                    this.play('level');
                    break;
                case 'enemyShot':
                    this.play('siege_hit', ev.x, ev.z);
                    break;
                case 'towerDestroyed':
                    this.play('collapse', ev.x, ev.z);
                    break;
                case 'repair':
                    this.play('repair');
                    break;
                case 'blink':
                    this.play('blink', ev.x, ev.z);
                    break;
                case 'pulse':
                case 'deathBlast':
                    this.play('stun', ev.x, ev.z);
                    break;
                case 'shield':
                case 'ward':
                    this.play('shield', ev.x, ev.z);
                    break;
                case 'shieldBreak':
                    this.play('shatter_big', ev.x, ev.z);
                    break;
                case 'immune':
                    this.play('immune', ev.x, ev.z);
                    break;
                case 'summon':
                case 'split':
                    this.play('heal', ev.x, ev.z);
                    break;
            }
        }
    }
}
