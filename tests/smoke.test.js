import { JSDOM } from "jsdom";
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function noop() {}

class FakeGainNode {
    constructor() {
        this.gain = {
            value: 0,
            setValueAtTime: noop,
            setTargetAtTime: noop,
            exponentialRampToValueAtTime: noop,
            cancelScheduledValues: noop
        };
    }
    connect() {}
}

class FakeOscillator {
    constructor() {
        this.frequency = { setValueAtTime: noop };
        this.type = "sine";
    }
    connect() {}
    start() {}
    stop() {}
}

class FakeBufferSource {
    connect() {}
    start() {}
    stop() {}
    set buffer(_) {}
}

class FakeAudioContext {
    constructor() {
        this.destination = {};
        this.currentTime = 0;
        this.sampleRate = 44100;
    }
    createGain() { return new FakeGainNode(); }
    createOscillator() { return new FakeOscillator(); }
    createBuffer(channels, length) {
        return {
            getChannelData: () => new Float32Array(length * channels)
        };
    }
    createBufferSource() { return new FakeBufferSource(); }
}

async function setupDom() {
    const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf-8");
    const dom = new JSDOM(html, { pretendToBeVisual: true });
    const { window } = dom;
    const { document } = window;

    const fakePerformance = { now: () => 0 };
    global.window = window;
    global.document = document;
    global.navigator = window.navigator;
    global.performance = fakePerformance;
    try { window.performance = fakePerformance; } catch (_) {}

    global.requestAnimationFrame = noop;
    global.cancelAnimationFrame = noop;
    window.requestAnimationFrame = noop;
    window.cancelAnimationFrame = noop;

    window.AudioContext = FakeAudioContext;
    window.webkitAudioContext = FakeAudioContext;
    global.AudioContext = FakeAudioContext;

    window.HTMLCanvasElement.prototype.getContext = () => ({
        fillStyle: "#000", strokeStyle: "#000", lineWidth: 1,
        beginPath: noop, moveTo: noop, lineTo: noop, stroke: noop,
        arc: noop, fillRect: noop, clearRect: noop, fill: noop,
        save: noop, restore: noop, font: "", textAlign: "", textBaseline: "",
        fillText: noop,
        createRadialGradient: () => ({ addColorStop: noop }),
        createLinearGradient: () => ({ addColorStop: noop })
    });

    await import("../src/main.js");

    return { window, document };
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

export async function run() {
    const { document } = await setupDom();

    const towerCards = document.querySelectorAll('.tower-card');
    assert(towerCards.length === 8, `Expected 8 tower cards, found ${towerCards.length}`);

    const speedButtons = Array.from(document.querySelectorAll('.speed-button'));
    assert(speedButtons.length === 3, 'Speed buttons missing');
    const active = speedButtons.filter(btn => btn.classList.contains('active'));
    assert(active.length === 1, 'Exactly one speed button should be active');
    assert(active[0].dataset.speed === '1', 'Default active speed is not 1x');

    const soundToggle = document.getElementById('sound-toggle');
    assert(soundToggle, 'Sound toggle button not found');
    assert(soundToggle.getAttribute('aria-pressed') === 'true', 'Sound toggle default pressed state should be true');

    const canvas = document.getElementById('game');
    assert(canvas && typeof canvas.width === 'number', 'Canvas element missing or invalid');

    towerCards[1].click();
    const selectedButtons = Array.from(document.querySelectorAll('.tower-card.selected'));
    assert(selectedButtons.length === 1, 'Selecting a tower card should toggle selected class');

    console.log('Smoke test passed');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    await run();
}

