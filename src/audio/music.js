// 상태별 음악. 외부 음원 없이 마디 단위로 조금씩 미리 예약한다(lookahead).
// 준비: 느린 패드 화음 + 드문 종소리 / 전투: 패드 + 북 + 8분 오스티나토 / 보스: + 금관 / 위기: + 맥박
// 모든 성부를 130Hz 위에 두어 노트북 스피커에서도 들리고, 효과음이 쓸 저역을 비워 둔다.

const mtof = (m) => 440 * 2 ** ((m - 69) / 12);

// 화음: r = 근음(오스티나토·금관이 쓴다), n = 패드 성부 (D 도리안 / 자연단음계)
const CH = {
    Dm9: { r: 50, n: [50, 57, 60, 64, 65] },
    Dm: { r: 50, n: [50, 57, 62, 65, 69] },
    Gm7: { r: 55, n: [55, 58, 62, 65, 69] },
    Gm: { r: 55, n: [55, 58, 62, 67, 70] },
    Bb: { r: 58, n: [53, 58, 62, 65, 69] },
    F: { r: 53, n: [53, 60, 65, 67, 69] },
    C: { r: 48, n: [48, 55, 62, 64, 67] },
    Asus: { r: 57, n: [52, 57, 62, 64, 69] },
    A: { r: 57, n: [52, 57, 61, 64, 69] },
    Eb: { r: 51, n: [51, 58, 63, 67, 70] }
};

// 분위기: 빠르기, 화음 하나가 이어지는 마디 수, 진행 후보(한 바퀴 돌 때마다 다른 것을 고른다)
const MOOD = {
    calm: {
        bpm: 70,
        per: 2,
        progs: [
            ['Dm9', 'Bb', 'F', 'C'],
            ['Dm9', 'Gm7', 'Bb', 'Asus'],
            ['Bb', 'F', 'Gm7', 'Dm9']
        ]
    },
    combat: {
        bpm: 104,
        per: 1,
        progs: [
            ['Dm', 'Dm', 'Bb', 'C'],
            ['Dm', 'C', 'Bb', 'A'],
            ['Dm', 'Bb', 'Gm', 'A']
        ]
    },
    boss: {
        bpm: 112,
        per: 1,
        progs: [
            ['Dm', 'Eb', 'Dm', 'A'],
            ['Dm', 'Bb', 'Eb', 'A']
        ]
    }
};

// 분위기별 층 음량 (0~1, 층 기본 음량에 곱한다)
const MIX = {
    off: { pad: 0, bell: 0, drum: 0, osti: 0, brass: 0 },
    calm: { pad: 1, bell: 1, drum: 0, osti: 0, brass: 0 },
    combat: { pad: 0.55, bell: 0, drum: 1, osti: 1, brass: 0 },
    boss: { pad: 0.45, bell: 0, drum: 1.15, osti: 0.9, brass: 1 }
};
// 층 기본 음량: 소리 하나하나는 크게 만들고 여기서 맞춘다
const LEVEL = { pad: 0.019, bell: 0.14, drum: 0.4, osti: 0.1, brass: 0.04, pulse: 0.35 };

// 16분 음표 16칸: x 센 타, o 여린 타
const DRUMS = {
    combat: [
        { kick: 'x.....x...x.....', tom: '....o.......x...', shk: '..o...o...o...o.' },
        { kick: 'x.....x.x.....x.', tom: '....x.......o.o.', shk: '..o...o...o.o.o.' }
    ],
    boss: [
        { kick: 'x..x..x.x..x..x.', tom: '....x.......x...', shk: 'xoxoxoxoxoxoxoxo' },
        { kick: 'x..x..x.x..x.x..', tom: '....x...o...x.x.', shk: 'xoxoxoxoxoxoxoxo' }
    ],
    fill: { kick: 'x.......x.......', tom: '....x...x.x.xxx.', shk: '..o...o...o...o.' }
};
// 오스티나토: 8분 음표마다 근음에서 올라가는 반음 수
const OSTI = {
    combat: [0, 0, 12, 0, 7, 0, 12, 7],
    boss: [0, 12, 0, 7, 0, 12, 10, 7]
};

const pick = (arr, not) => {
    const c = arr.length > 1 ? arr.filter((x) => x !== not) : arr;
    return c[(Math.random() * c.length) | 0];
};

export class Music {
    /** @param {BaseAudioContext} ctx @param {AudioNode} out 음악 버스 @param {AudioBuffer} noiseBuf */
    constructor(ctx, out, noiseBuf) {
        this.ctx = ctx;
        this.out = out;
        this.noiseBuf = noiseBuf;
        this.mood = 'off';
        this.danger = false;
        this.next = 0;
        this.barLen = 3;
        this.prog = null;
        this.idx = 0;
        this.barInChord = 0;
        this.chord = CH.Dm9;
        this.pad = null;
        this.bellNote = 74;
        this.layers = {};
        // 종소리·패드는 메아리를 조금 섞어 공간감을 준다 (노드는 한 번만 만든다)
        this.send = ctx.createGain();
        this.send.gain.value = 0.35;
        const echo = ctx.createDelay(1);
        echo.delayTime.value = 0.37;
        const tone = ctx.createBiquadFilter();
        tone.type = 'lowpass';
        tone.frequency.value = 2400;
        const fb = ctx.createGain();
        fb.gain.value = 0.36;
        this.send.connect(echo).connect(tone).connect(fb).connect(echo);
        tone.connect(out);
        for (const k of ['pad', 'bell', 'drum', 'osti', 'brass', 'pulse']) {
            const g = ctx.createGain();
            g.gain.value = 0;
            g.connect(out);
            if (k === 'pad' || k === 'bell') g.connect(this.send);
            this.layers[k] = g;
        }
    }

    /** 매 프레임: 지금 어울리는 분위기와 위기 여부를 알려 준다 */
    set(mood, danger, now) {
        if (danger !== this.danger) {
            this.danger = danger;
            this.layers.pulse.gain.setTargetAtTime(danger ? LEVEL.pulse : 0, now, 0.5);
        }
        if (mood === this.mood) return;
        const prev = this.mood;
        this.mood = mood;
        const mix = MIX[mood];
        for (const k in mix) this.layers[k].gain.setTargetAtTime(mix[k] * LEVEL[k], now, mood === 'off' ? 0.6 : 0.35);
        this.releasePad(now, mood === 'off' ? 1.2 : 0.5);
        if (mood === 'off') return;
        const m = MOOD[mood];
        this.prog = pick(m.progs);
        this.idx = 0;
        this.barInChord = 0;
        // 전투로 넘어갈 때는 바로, 웨이브를 막고 쉬어 갈 때는 해소 화음을 들려준 뒤 시작한다
        if (mood === 'calm' && (prev === 'combat' || prev === 'boss')) {
            this.resolve(now);
            this.next = now + 2.6;
        } else this.next = now + 0.06;
    }

    tick(now) {
        if (this.mood === 'off') return;
        // 탭이 숨었다가 돌아오면 밀린 마디를 몰아서 치지 않고 지금부터 다시 센다
        if (this.next < now - 0.4) this.next = now + 0.06;
        while (this.next < now + 0.3) {
            this.bar(this.next);
            this.next += this.barLen;
        }
    }

    bar(T) {
        const m = MOOD[this.mood];
        const L = 240 / m.bpm;
        this.barLen = L;
        const step = L / 16;
        if (this.barInChord === 0) {
            this.chord = CH[this.prog[this.idx]];
            this.padChord(this.chord, T, L * m.per);
        }
        const last = this.idx === this.prog.length - 1 && this.barInChord === m.per - 1;
        if (this.mood === 'calm') this.bells(T, step);
        else {
            const pat = last ? DRUMS.fill : pick(DRUMS[this.mood]);
            this.drums(pat, T, step);
            this.ostinato(OSTI[this.mood], T, step);
            if (this.mood === 'boss') this.brass(T, L);
        }
        if (this.danger) this.pulse(T, step);
        if (++this.barInChord >= m.per) {
            this.barInChord = 0;
            if (++this.idx >= this.prog.length) {
                this.idx = 0;
                this.prog = pick(m.progs, this.prog);
            }
        }
    }

    // ---------- 층 ----------
    padChord(chord, T, dur) {
        const c = this.ctx;
        const g = c.createGain();
        const lp = c.createBiquadFilter();
        lp.type = 'lowpass';
        lp.Q.value = 0.5;
        const open = this.mood === 'calm' ? 1500 : 1000;
        lp.frequency.setValueAtTime(420, T);
        lp.frequency.linearRampToValueAtTime(open, T + dur * 0.45);
        lp.frequency.linearRampToValueAtTime(open * 0.6, T + dur + 1.5);
        const atk = Math.min(1.4, dur * 0.4);
        g.gain.setValueAtTime(0.0001, T);
        g.gain.exponentialRampToValueAtTime(1, T + atk);
        g.gain.setValueAtTime(1, T + dur);
        g.gain.exponentialRampToValueAtTime(0.0001, T + dur + 1.8);
        lp.connect(g).connect(this.layers.pad);
        const end = T + dur + 1.9;
        const oscs = [];
        for (const n of chord.n)
            for (const det of [-8, 7]) {
                const o = c.createOscillator();
                o.type = 'sawtooth';
                o.frequency.value = mtof(n);
                o.detune.value = det + Math.random() * 4 - 2;
                o.connect(lp);
                o.start(T);
                o.stop(end);
                oscs.push(o);
            }
        this.pad = { g, oscs, end };
    }

    releasePad(now, tau) {
        const p = this.pad;
        if (!p || p.end <= now) return;
        const g = p.g.gain;
        if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(now);
        else {
            g.cancelScheduledValues(now);
            g.setValueAtTime(g.value, now);
        }
        g.setTargetAtTime(0.0001, now, tau / 3);
        for (const o of p.oscs) o.stop(now + tau * 2);
        this.pad = null;
    }

    bells(T, step) {
        if (Math.random() < 0.3) return;
        // 화음 구성음을 A4~D6 사이로 옮겨, 앞 음에서 가까운 음으로 이어 간다
        const pool = [];
        for (const n of this.chord.n)
            for (let o = 12; o <= 36; o += 12) if (n + o >= 69 && n + o <= 86) pool.push(n + o);
        const count = 1 + ((Math.random() * 3) | 0);
        const slots = [0, 4, 6, 8, 10, 12, 14]
            .sort(() => Math.random() - 0.5)
            .slice(0, count)
            .sort((a, b) => a - b);
        for (const s of slots) {
            const near = pool.filter((n) => Math.abs(n - this.bellNote) <= 5 && n !== this.bellNote);
            this.bellNote = pick(near.length ? near : pool);
            this.bell(mtof(this.bellNote), T + s * step, 0.6 + Math.random() * 0.4, this.layers.bell);
        }
    }

    bell(f, t, vel, dest) {
        const c = this.ctx;
        const g = c.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vel, t + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
        g.connect(dest);
        for (const [mul, amp] of [
            [1, 1],
            [2.76, 0.25],
            [5.4, 0.08]
        ]) {
            const o = c.createOscillator();
            o.frequency.value = f * mul;
            const og = c.createGain();
            og.gain.value = amp;
            o.connect(og).connect(g);
            o.start(t);
            o.stop(t + 1.85);
        }
    }

    drums(pat, T, step) {
        for (let i = 0; i < 16; i++) {
            const t = T + i * step;
            const k = pat.kick[i],
                tm = pat.tom[i],
                s = pat.shk[i];
            if (k !== '.') this.kick(t, k === 'x' ? 1 : 0.6);
            if (tm !== '.') this.tom(t, tm === 'x' ? 0.8 : 0.5, i >= 12 ? 300 : 240);
            if (s !== '.') this.shaker(t, s === 'x' ? 0.5 : 0.3);
        }
    }

    kick(t, v) {
        // 몸통을 90~190Hz에 두어 작은 스피커에서도 '둥'이 들린다
        const c = this.ctx;
        const o = c.createOscillator();
        o.frequency.setValueAtTime(190, t);
        o.frequency.exponentialRampToValueAtTime(88, t + 0.12);
        const g = c.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(v, t + 0.003);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
        o.connect(g).connect(this.layers.drum);
        o.start(t);
        o.stop(t + 0.28);
        this.hiss('bandpass', 1300, 0.9, t, 0.018, v * 0.35, this.layers.drum);
    }

    tom(t, v, f) {
        const c = this.ctx;
        const o = c.createOscillator();
        o.frequency.setValueAtTime(f, t);
        o.frequency.exponentialRampToValueAtTime(f * 0.62, t + 0.16);
        const g = c.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(v * 0.7, t + 0.003);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
        o.connect(g).connect(this.layers.drum);
        o.start(t);
        o.stop(t + 0.22);
        this.hiss('bandpass', 1000, 1.2, t, 0.05, v * 0.3, this.layers.drum);
    }

    shaker(t, v) {
        this.hiss('bandpass', 7200, 0.9, t, 0.045, v * 0.4, this.layers.drum, 0.006);
    }

    hiss(type, f, q, t, dur, peak, dest, attack = 0.001) {
        const c = this.ctx;
        const src = c.createBufferSource();
        src.buffer = this.noiseBuf;
        const flt = c.createBiquadFilter();
        flt.type = type;
        flt.frequency.value = f;
        flt.Q.value = q;
        const g = c.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(peak, t + attack);
        g.gain.exponentialRampToValueAtTime(0.0001, t + attack + dur);
        src.connect(flt).connect(g).connect(dest);
        src.start(t, Math.random());
        src.stop(t + attack + dur + 0.02);
    }

    ostinato(pattern, T, step) {
        // 근음을 D3~C#4(147~277Hz) 사이로 옮겨 뜯는다
        const root = 50 + ((((this.chord.r - 50) % 12) + 12) % 12);
        pattern.forEach((iv, i) => this.pluck(mtof(root + iv), T + i * 2 * step, i % 4 === 0 ? 1 : 0.7));
    }

    pluck(f, t, v) {
        const c = this.ctx;
        const o = c.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = f;
        const lp = c.createBiquadFilter();
        lp.type = 'lowpass';
        lp.Q.value = 2;
        lp.frequency.setValueAtTime(2600, t);
        lp.frequency.exponentialRampToValueAtTime(420, t + 0.16);
        const g = c.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(v, t + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
        o.connect(lp).connect(g).connect(this.layers.osti);
        o.start(t);
        o.stop(t + 0.24);
    }

    brass(T, L) {
        // 마디 첫 박에 센 화음, 셋째 박에 여린 화음
        const root = 50 + ((((this.chord.r - 50) % 12) + 12) % 12);
        const third = this.chord.n.some((n) => (n - this.chord.r) % 12 === 4) ? 4 : 3;
        for (const [at, v, len] of [
            [0, 1, 0.45],
            [0.5, 0.6, 0.35]
        ]) {
            const t = T + at * L;
            const c = this.ctx;
            const lp = c.createBiquadFilter();
            lp.type = 'lowpass';
            lp.frequency.setValueAtTime(350, t);
            lp.frequency.linearRampToValueAtTime(1900, t + 0.09);
            lp.frequency.exponentialRampToValueAtTime(600, t + len * L);
            const g = c.createGain();
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(v, t + 0.06);
            g.gain.setValueAtTime(v, t + len * L * 0.6);
            g.gain.exponentialRampToValueAtTime(0.0001, t + len * L);
            lp.connect(g).connect(this.layers.brass);
            for (const iv of [0, third, 7, 12])
                for (const det of [-6, 6]) {
                    const o = c.createOscillator();
                    o.type = 'sawtooth';
                    o.frequency.value = mtof(root + iv);
                    o.detune.value = det;
                    o.connect(lp);
                    o.start(t);
                    o.stop(t + len * L + 0.05);
                }
        }
    }

    pulse(T, step) {
        // 위기: 반 마디마다 심장 박동 두 번
        for (const s of [0, 3, 8, 11]) {
            const t = T + s * step;
            const c = this.ctx;
            const o = c.createOscillator();
            o.type = 'triangle';
            o.frequency.setValueAtTime(170, t);
            o.frequency.exponentialRampToValueAtTime(95, t + 0.1);
            const g = c.createGain();
            const v = s % 8 === 0 ? 1 : 0.7;
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(v, t + 0.005);
            g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
            o.connect(g).connect(this.layers.pulse);
            o.start(t);
            o.stop(t + 0.18);
        }
    }

    /** 웨이브를 막아 냈을 때: 밝은 화음이 피어오른다 */
    resolve(now) {
        const g = this.ctx.createGain();
        g.gain.value = LEVEL.bell * 0.9;
        g.connect(this.out);
        g.connect(this.send);
        [65, 69, 72, 76, 81].forEach((n, i) => this.bell(mtof(n), now + 0.05 + i * 0.11, 0.8 - i * 0.08, g));
        // F장조 패드를 잠깐 깐다 (분위기 층과 따로, 끝나면 저절로 사라진다)
        const pg = this.ctx.createGain();
        pg.gain.value = LEVEL.pad * 1.3;
        pg.connect(this.out);
        const keep = this.layers.pad;
        this.layers.pad = pg;
        this.padChord({ r: 53, n: [53, 60, 64, 67, 69] }, now, 1.2);
        this.layers.pad = keep;
        this.pad = null;
    }
}
