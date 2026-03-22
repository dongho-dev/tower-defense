let audioContext = null;
let masterGain = null;
let soundMuted = false;

const SOUND_TOGGLE = document.getElementById('sound-toggle');

export function ensureAudioContext() {
    if (audioContext) {
        return audioContext;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
        console.warn('Web Audio API is not supported in this browser.');
        soundMuted = true;
        if (SOUND_TOGGLE) {
            SOUND_TOGGLE.disabled = true;
            SOUND_TOGGLE.textContent = "🔇";
            SOUND_TOGGLE.title = "사운드를 사용할 수 없습니다";
        }
        return null;
    }
    audioContext = new AudioCtx();
    masterGain = audioContext.createGain();
    masterGain.gain.value = 0.8;
    masterGain.connect(audioContext.destination);
    return audioContext;
}

function playToneSequence(steps) {
    if (soundMuted) {
        return;
    }
    const ctx = ensureAudioContext();
    if (!ctx || !masterGain) {
        return;
    }
    let current = ctx.currentTime;
    for (const step of steps) {
        const duration = typeof step.duration === 'number' ? step.duration : 0.15;
        const delay = typeof step.delay === 'number' ? step.delay : 0;
        current += delay;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const freq = typeof step.freq === 'number' ? step.freq : 440;
        const volume = typeof step.volume === 'number' ? step.volume : 0.22;
        const type = step.type || 'sine';
        osc.type = type;
        osc.frequency.setValueAtTime(freq, current);
        gain.gain.setValueAtTime(0.0001, current);
        gain.gain.exponentialRampToValueAtTime(volume, current + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, current + duration);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(current);
        osc.stop(current + duration + 0.06);
        current += duration;
    }
}

function playNoise(duration = 0.25, volume = 0.24) {
    if (soundMuted) {
        return;
    }
    const ctx = ensureAudioContext();
    if (!ctx || !masterGain) {
        return;
    }
    const size = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < size; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.7;
    }
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.buffer = buffer;
    source.connect(gain);
    gain.connect(masterGain);
    source.start(now);
    source.stop(now + duration + 0.06);
}

const SOUND_LIBRARY = {
    select: () => playToneSequence([{ freq: 540, duration: 0.08, volume: 0.18 }]),
    build: () => playToneSequence([
        { freq: 360, duration: 0.08, volume: 0.22 },
        { freq: 520, duration: 0.09, volume: 0.24, delay: 0.01 }
    ]),
    upgrade: () => playToneSequence([
        { freq: 520, duration: 0.09, volume: 0.24 },
        { freq: 680, duration: 0.12, volume: 0.22, type: 'triangle', delay: 0.02 }
    ]),
    kill: () => playToneSequence([
        { freq: 420, duration: 0.08, volume: 0.18, type: 'square' },
        { freq: 260, duration: 0.12, volume: 0.16, delay: 0.02 }
    ]),
    explosion: () => {
        playNoise(0.22, 0.32);
        playToneSequence([{ freq: 180, duration: 0.12, volume: 0.2, type: 'sawtooth' }]);
    },
    laser: () => playToneSequence([{ freq: 760, duration: 0.06, volume: 0.18 }]),
    toggle: () => playToneSequence([{ freq: 420, duration: 0.07, volume: 0.18 }])
};

export function updateSoundToggle() {
    if (!SOUND_TOGGLE) {
        return;
    }
    SOUND_TOGGLE.textContent = soundMuted ? '🔇' : '🔊';
    SOUND_TOGGLE.setAttribute('aria-pressed', String(!soundMuted));
    SOUND_TOGGLE.title = soundMuted ? '사운드 켜기' : '사운드 끄기';
}

export function setSoundMuted(muted) {
    soundMuted = muted;
    if (audioContext && masterGain) {
        const now = audioContext.currentTime;
        const target = soundMuted ? 0.0001 : 0.8;
        masterGain.gain.cancelScheduledValues(now);
        masterGain.gain.setTargetAtTime(target, now + 0.01, 0.05);
    }
    updateSoundToggle();
}

export function isSoundMuted() {
    return soundMuted;
}

export function playSound(name) {
    if (soundMuted) {
        return;
    }
    const player = SOUND_LIBRARY[name];
    if (!player) {
        return;
    }
    if (!ensureAudioContext() || !masterGain) {
        return;
    }
    try {
        player();
    } catch (error) {
        console.warn('사운드 재생 실패:', error);
    }
}

updateSoundToggle();
