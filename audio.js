let audioContext = null;
let masterGain = null;
let soundMuted = false;
let audioContextCreating = false;

function ensureAudioContext() {
    if (audioContextCreating) return null;
    if (audioContext) {
        if (audioContext.state === 'closed') {
            audioContext = null;
            masterGain = null;
            cachedNoiseBuffer = null;
            cachedNoiseDuration = 0;
            // fall through to create new context
        } else {
            if (audioContext.state === 'suspended') {
                audioContext.resume().catch((err) => {
                    console.warn('AudioContext resume failed:', err);
                });
            }
            return audioContext;
        }
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
        console.warn('Web Audio API is not supported in this browser.');
        soundMuted = true;
        if (SOUND_TOGGLE) {
            SOUND_TOGGLE.disabled = true;
            SOUND_TOGGLE.textContent = '🔇';
            SOUND_TOGGLE.title = '사운드를 사용할 수 없습니다';
        }
        if (typeof updateSoundToggle === 'function') updateSoundToggle();
        return null;
    }
    audioContextCreating = true;
    try {
        audioContext = new AudioCtx();
        masterGain = audioContext.createGain();
        masterGain.gain.value = masterVolume;
        masterGain.connect(audioContext.destination);
        return audioContext;
    } catch (e) {
        console.warn('AudioContext 생성 실패:', e.message);
        if (audioContext) {
            try {
                audioContext.close();
            } catch (_) {
                /* ignore */
            }
        }
        audioContext = null;
        masterGain = null;
        return null;
    } finally {
        audioContextCreating = false;
    }
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
        osc.onended = function () {
            osc.disconnect();
            gain.disconnect();
        };
        current += duration;
    }
}

let cachedNoiseBuffer = null;
let cachedNoiseDuration = 0;

function resetAudioCache() {
    cachedNoiseBuffer = null;
    cachedNoiseDuration = 0;
}

function playNoise(duration = 0.25, volume = 0.24) {
    if (soundMuted) return;
    const ctx = ensureAudioContext();
    if (!ctx || !masterGain) return;

    const size = Math.max(1, Math.floor(ctx.sampleRate * duration));
    if (!cachedNoiseBuffer || cachedNoiseDuration !== duration) {
        cachedNoiseBuffer = ctx.createBuffer(1, size, ctx.sampleRate);
        const data = cachedNoiseBuffer.getChannelData(0);
        for (let i = 0; i < size; i++) {
            data[i] = (Math.random() * 2 - 1) * 0.7;
        }
        cachedNoiseDuration = duration;
    }

    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.buffer = cachedNoiseBuffer;
    source.connect(gain);
    gain.connect(masterGain);
    source.start(now);
    source.stop(now + duration + 0.06);
    source.onended = function () {
        source.disconnect();
        gain.disconnect();
    };
}

const SOUND_LIBRARY = {
    select: () => playToneSequence([{ freq: 540, duration: 0.08, volume: 0.18 }]),
    build: () =>
        playToneSequence([
            { freq: 360, duration: 0.08, volume: 0.22 },
            { freq: 520, duration: 0.09, volume: 0.24, delay: 0.01 }
        ]),
    upgrade: () =>
        playToneSequence([
            { freq: 520, duration: 0.09, volume: 0.24 },
            { freq: 680, duration: 0.12, volume: 0.22, type: 'triangle', delay: 0.02 }
        ]),
    kill: () =>
        playToneSequence([
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

function updateSoundToggle() {
    if (!SOUND_TOGGLE) {
        return;
    }
    SOUND_TOGGLE.textContent = soundMuted ? '🔇' : '🔊';
    SOUND_TOGGLE.setAttribute('aria-pressed', String(!soundMuted));
    const soundLabel = soundMuted ? '사운드 켜기' : '사운드 끄기';
    SOUND_TOGGLE.title = soundLabel;
    SOUND_TOGGLE.setAttribute('aria-label', soundLabel);
}

let masterVolume = 0.8;

function setVolume(value) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return;
    masterVolume = Math.max(0, Math.min(1, value));
    if (audioContext && masterGain && !soundMuted) {
        const now = audioContext.currentTime;
        masterGain.gain.cancelScheduledValues(now);
        masterGain.gain.setTargetAtTime(masterVolume, now + 0.01, 0.05);
    }
    try {
        localStorage.setItem('td_volume', String(masterVolume));
    } catch (_) {
        /* storage unavailable */
    }
}

function getVolume() {
    return masterVolume;
}

function setSoundMuted(state) {
    soundMuted = state;
    if (audioContext && masterGain) {
        const now = audioContext.currentTime;
        const target = soundMuted ? 0.0001 : masterVolume;
        masterGain.gain.cancelScheduledValues(now);
        masterGain.gain.setTargetAtTime(target, now + 0.01, 0.05);
    }
    updateSoundToggle();
}

function playSound(name) {
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
        console.warn('사운드 재생 실패:', error.message);
    }
}

updateSoundToggle();
