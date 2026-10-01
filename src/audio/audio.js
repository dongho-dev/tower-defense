// WebAudio 합성 효과음 + 은은한 배경 드론. 외부 음원 없음.

const THROTTLE = {
    fire_ranger: 0.05,
    fire_ember: 0.08,
    fire_frost: 0.06,
    fire_arcane: 0.12,
    income: 0.08,
    chain: 0.06,
    hit: 0.04,
    death: 0.05,
    explode: 0.06,
    clash: 0.07,
    siege_hit: 0.1,
    blink: 0.1,
    immune: 0.3,
    stun: 0.2
};

export class Audio {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.lastPlay = {};
        this.volume = 0.8;
    }

    unlock() {
        if (!this.enabled) return;
        if (!this.ctx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return;
            this.ctx = new AC();
            const comp = this.ctx.createDynamicsCompressor();
            comp.threshold.value = -16;
            comp.ratio.value = 5;
            this.master = this.ctx.createGain();
            this.master.gain.value = this.volume;
            this.master.connect(comp).connect(this.ctx.destination);
            this.noiseBuf = this.makeNoise();
            this.startAmbience();
        }
        if (this.ctx.state === 'suspended') this.ctx.resume();
    }

    set enabled(v) {
        this._enabled = v;
        if (this.master) this.master.gain.setTargetAtTime(v ? this.volume : 0, this.ctx.currentTime, 0.05);
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

    // ---------- 합성 부품 ----------
    env(node, t, a, peak, d, sustain = 0.0001) {
        const g = node.gain;
        g.setValueAtTime(0.0001, t);
        g.exponentialRampToValueAtTime(peak, t + a);
        g.exponentialRampToValueAtTime(Math.max(0.0001, sustain), t + a + d);
    }

    tone(type, f0, f1, dur, peak, t = this.ctx.currentTime, dest = this.master, attack = 0.005) {
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(f0, t);
        if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
        this.env(g, t, attack, peak, dur);
        o.connect(g).connect(dest);
        o.start(t);
        o.stop(t + attack + dur + 0.05);
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
        src.connect(f).connect(g).connect(this.master);
        src.start(t, Math.random() * 0.5);
        src.stop(t + attack + dur + 0.05);
    }

    // ---------- 효과음 ----------
    play(name) {
        if (!this.ctx || !this.enabled) return;
        const now = this.ctx.currentTime;
        const th = THROTTLE[name];
        if (th && now - (this.lastPlay[name] || 0) < th) return;
        this.lastPlay[name] = now;
        const t = now;
        const r = () => 0.92 + Math.random() * 0.16;
        switch (name) {
            case 'fire_ranger':
                this.noise('bandpass', 2600 * r(), 900, 3, 0.09, 0.18, t);
                this.tone('triangle', 520 * r(), 180, 0.1, 0.08, t);
                break;
            case 'fire_ember':
                this.tone('sine', 110 * r(), 42, 0.35, 0.55, t);
                this.noise('lowpass', 1400, 200, 0.7, 0.4, 0.35, t);
                break;
            case 'fire_frost':
                this.tone('sine', 1800 * r(), 2400, 0.12, 0.08, t);
                this.tone('triangle', 2600 * r(), 1900, 0.18, 0.05, t + 0.02);
                break;
            case 'fire_arcane':
                this.tone('sine', 880 * r(), 1320, 0.25, 0.06, t);
                this.tone('triangle', 1320 * r(), 1760, 0.3, 0.04, t + 0.03);
                break;
            case 'income':
                for (let i = 0; i < 3; i++)
                    this.tone('triangle', 1400 + i * 350, 1500 + i * 350, 0.12, 0.06, t + i * 0.06);
                break;
            case 'chain':
                for (let i = 0; i < 4; i++)
                    this.noise('bandpass', 3000 + Math.random() * 3000, 1200, 6, 0.05, 0.16, t + i * 0.03);
                this.tone('sawtooth', 90, 60, 0.18, 0.08, t);
                break;
            case 'chain_big':
                for (let i = 0; i < 6; i++)
                    this.noise('bandpass', 2400 + Math.random() * 4000, 900, 5, 0.07, 0.22, t + i * 0.035);
                this.tone('sawtooth', 70, 40, 0.35, 0.18, t);
                break;
            case 'hit':
                this.noise('highpass', 3000, 2000, 1, 0.04, 0.08, t);
                break;
            case 'shatter':
                for (let i = 0; i < 5; i++)
                    this.tone('sine', 2200 + Math.random() * 2600, 1500, 0.2, 0.05, t + i * 0.02);
                this.noise('highpass', 5000, 3000, 1, 0.25, 0.15, t);
                break;
            case 'explode':
                this.tone('sine', 90 * r(), 30, 0.55, 0.7, t);
                this.noise('lowpass', 2200, 120, 0.8, 0.7, 0.55, t);
                break;
            case 'frost_hit':
                this.noise('highpass', 6000, 4000, 0.7, 0.18, 0.1, t);
                this.tone('sine', 3100 * r(), 2600, 0.15, 0.04, t);
                break;
            case 'death':
                this.noise('bandpass', 700 * r(), 200, 1.2, 0.25, 0.12, t);
                this.tone('sine', 300 * r(), 120, 0.2, 0.05, t);
                break;
            case 'death_big':
                this.tone('sawtooth', 160, 30, 1.4, 0.35, t);
                this.noise('lowpass', 1800, 80, 0.6, 1.6, 0.6, t);
                this.tone('sine', 55, 25, 1.8, 0.7, t);
                break;
            case 'build':
                this.noise('lowpass', 600, 120, 0.8, 0.25, 0.4, t);
                this.tone('triangle', 660, 660, 0.25, 0.1, t + 0.08);
                this.tone('triangle', 990, 990, 0.35, 0.08, t + 0.16);
                break;
            case 'upgrade':
                [523, 659, 784, 1047].forEach((f, i) => this.tone('triangle', f, f, 0.3, 0.1, t + i * 0.07));
                this.noise('highpass', 5000, 8000, 0.5, 0.5, 0.05, t + 0.1);
                break;
            case 'branch':
                [392, 523, 659, 784, 1047, 1319].forEach((f, i) =>
                    this.tone('triangle', f, f, 0.45, 0.1, t + i * 0.06)
                );
                this.tone('sine', 98, 98, 0.9, 0.25, t);
                break;
            case 'sell':
                [1318, 1568, 2093].forEach((f, i) => this.tone('square', f, f, 0.08, 0.035, t + i * 0.05));
                break;
            case 'leak':
                this.tone('sawtooth', 220, 110, 0.5, 0.2, t);
                this.tone('sawtooth', 233, 116, 0.5, 0.15, t);
                this.tone('sine', 60, 40, 0.6, 0.5, t);
                break;
            case 'wave':
                this.horn(t, [146.8, 196, 220], 1.3, 0.16);
                break;
            case 'boss':
                this.horn(t, [73.4, 87.3, 110], 2.6, 0.28);
                for (let i = 0; i < 4; i++) this.tone('sine', 70, 35, 0.4, 0.6, t + 0.5 + i * 0.5);
                break;
            case 'meteor_cast':
                this.noise('bandpass', 300, 2400, 2, 0.9, 0.35, t, 0.4);
                break;
            case 'meteor_impact':
                this.tone('sine', 70, 22, 1.4, 1, t);
                this.noise('lowpass', 3000, 60, 0.7, 1.6, 0.9, t);
                this.noise('bandpass', 900, 200, 1, 0.8, 0.4, t + 0.05);
                break;
            case 'freeze':
                for (let i = 0; i < 10; i++)
                    this.tone('sine', 1500 + Math.random() * 3500, 2000, 0.6, 0.04, t + i * 0.04);
                this.noise('highpass', 7000, 3000, 0.5, 1.2, 0.15, t, 0.05);
                this.tone('sine', 110, 55, 1.2, 0.25, t);
                break;
            case 'heal':
                this.tone('sine', 880, 1320, 0.3, 0.04, t);
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
                ].forEach(([f, d]) => this.tone('sawtooth', f, f * 0.98, 1.1, 0.08, t + d, this.master, 0.08));
                this.tone('sine', 55, 40, 3, 0.4, t);
                break;
            case 'ui':
                this.tone('triangle', 880, 880, 0.06, 0.05, t);
                break;
            case 'clash':
                this.noise('bandpass', 3800 * r(), 2600, 8, 0.06, 0.12, t);
                this.tone('square', 1200 * r(), 900, 0.05, 0.03, t);
                break;
            case 'slam':
                this.tone('sine', 90, 40, 0.6, 0.6, t);
                this.noise('lowpass', 2400, 200, 0.8, 0.5, 0.4, t);
                [523, 659, 784].forEach((f, i) => this.tone('triangle', f, f, 0.5, 0.06, t + i * 0.04));
                break;
            case 'level':
                [659, 784, 988, 1319].forEach((f, i) => this.tone('triangle', f, f, 0.35, 0.09, t + i * 0.08));
                break;
            case 'siege_hit':
                this.noise('lowpass', 900, 200, 1, 0.18, 0.2, t);
                this.tone('sine', 140 * r(), 70, 0.15, 0.12, t);
                break;
            case 'collapse':
                this.noise('lowpass', 1600, 120, 0.7, 1.4, 0.6, t);
                this.tone('sine', 60, 30, 1.4, 0.5, t);
                break;
            case 'repair':
                [880, 1175].forEach((f, i) => this.tone('triangle', f, f * 1.02, 0.12, 0.06, t + i * 0.09));
                this.noise('bandpass', 4200, 3000, 6, 0.05, 0.1, t);
                break;
            case 'blink':
                this.tone('sine', 300, 1400, 0.18, 0.08, t);
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
                this.tone('triangle', 400, 380, 0.08, 0.04, t);
                break;

            case 'deny':
                this.tone('square', 180, 150, 0.12, 0.05, t);
                break;
        }
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
            filt.frequency.linearRampToValueAtTime(1400, t + 0.35);
            filt.frequency.linearRampToValueAtTime(500, t + dur);
            const g = this.ctx.createGain();
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(peak / freqs.length, t + 0.2);
            g.gain.setValueAtTime(peak / freqs.length, t + dur * 0.6);
            g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
            o.connect(filt).connect(g).connect(this.master);
            o.start(t);
            o.stop(t + dur + 0.05);
        }
    }

    startAmbience() {
        const t = this.ctx.currentTime;
        // 바람
        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuf;
        src.loop = true;
        const f = this.ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = 500;
        f.Q.value = 0.6;
        const lfo = this.ctx.createOscillator();
        lfo.frequency.value = 0.07;
        const lfoGain = this.ctx.createGain();
        lfoGain.gain.value = 260;
        lfo.connect(lfoGain).connect(f.frequency);
        const g = this.ctx.createGain();
        g.gain.value = 0.035;
        src.connect(f).connect(g).connect(this.master);
        src.start(t);
        lfo.start(t);
        // 노을빛 드론
        const pad = this.ctx.createGain();
        pad.gain.value = 0.02;
        const lp = this.ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 700;
        pad.connect(lp).connect(this.master);
        for (const [freq, det] of [
            [110, -4],
            [164.8, 3],
            [220, 5],
            [277.2, -3]
        ]) {
            const o = this.ctx.createOscillator();
            o.type = 'triangle';
            o.frequency.value = freq;
            o.detune.value = det;
            o.connect(pad);
            o.start(t);
        }
    }

    handle(events, state) {
        if (!this.ctx || !this.enabled) return;
        for (const ev of events) {
            switch (ev.type) {
                case 'fire':
                    if (ev.tower !== 'storm') this.play('fire_' + ev.tower);
                    break;
                case 'chain':
                    this.play(ev.branch === 'b' ? 'chain_big' : 'chain');
                    break;
                case 'hit':
                    this.play(ev.shattered ? 'shatter' : 'hit');
                    break;
                case 'frostHit':
                    this.play('frost_hit');
                    break;
                case 'explode':
                    this.play('explode');
                    break;
                case 'death':
                    this.play(ev.boss || ev.elite ? 'death_big' : 'death');
                    break;
                case 'build':
                    this.play('build');
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
                    this.play('meteor_impact');
                    break;
                case 'freeze':
                    this.play('freeze');
                    break;
                case 'heal':
                case 'pollen':
                    this.play('heal');
                    break;
                case 'unitHit':
                    this.play('clash');
                    break;
                case 'heroSlam':
                    this.play('slam');
                    break;
                case 'heroLevel':
                    this.play('level');
                    break;
                case 'enemyShot':
                    this.play('siege_hit');
                    break;
                case 'towerDestroyed':
                case 'gateBroken':
                    this.play('collapse');
                    break;
                case 'repair':
                    this.play('repair');
                    break;
                case 'blink':
                    this.play('blink');
                    break;
                case 'pulse':
                case 'deathBlast':
                    this.play('stun');
                    break;
                case 'shield':
                case 'ward':
                    this.play('shield');
                    break;
                case 'shieldBreak':
                    this.play('shatter_big');
                    break;
                case 'immune':
                    this.play('immune');
                    break;
                case 'summon':
                case 'split':
                    this.play('heal');
                    break;
            }
        }
        void state;
    }
}
