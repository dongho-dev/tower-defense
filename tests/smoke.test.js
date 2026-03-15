const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

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
        this.type = 'sine';
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
        this.state = 'running';
    }
    close() { this.state = 'closed'; }
    resume() { this.state = 'running'; return Promise.resolve(); }
    createGain() { return new FakeGainNode(); }
    createOscillator() { return new FakeOscillator(); }
    createBuffer(channels, length) {
        return {
            getChannelData: () => new Float32Array(length * channels)
        };
    }
    createBufferSource() { return new FakeBufferSource(); }
}

function setupDom() {
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf-8');
    const dom = new JSDOM(html, { pretendToBeVisual: true });
    const { window } = dom;
    const { document } = window;

    const fakePerformance = { now: () => 0 };
    global.window = window;
    global.document = document;
    global.navigator = window.navigator;
    global.performance = fakePerformance;
    window.performance = fakePerformance;

    global.requestAnimationFrame = noop;
    global.cancelAnimationFrame = noop;
    window.requestAnimationFrame = noop;
    window.cancelAnimationFrame = noop;

    window.AudioContext = FakeAudioContext;
    window.webkitAudioContext = FakeAudioContext;
    global.AudioContext = FakeAudioContext;

    window.HTMLCanvasElement.prototype.getContext = () => ({
        fillStyle: '#000', strokeStyle: '#000', lineWidth: 1,
        beginPath: noop, moveTo: noop, lineTo: noop, stroke: noop,
        arc: noop, fillRect: noop, clearRect: noop, fill: noop,
        save: noop, restore: noop, font: '', textAlign: '', textBaseline: '',
        fillText: noop,
        createRadialGradient: () => ({ addColorStop: noop }),
        createLinearGradient: () => ({ addColorStop: noop }),
        setLineDash: noop,
        ellipse: noop,
        resetTransform: noop,
        globalCompositeOperation: 'source-over',
        shadowColor: '',
        shadowBlur: 0,
        globalAlpha: 1,
        lineCap: 'butt',
        lineJoin: 'miter',
        rotate: noop,
        translate: noop,
        closePath: noop,
        setTransform: noop,
        measureText: () => ({ width: 0 }),
        drawImage: noop
    });

    delete require.cache[require.resolve('../main.js')];
    require('../main.js');

    return { window, document };
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function run() {
    const { document } = setupDom();

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

    // #50: setBuildPanelCollapsed가 자식 span을 파괴하지 않는지 검증
    const buildToggle = document.getElementById('build-toggle');
    assert(buildToggle, 'build-toggle 버튼이 존재');
    const arrowBefore = buildToggle.querySelector('.toggle-arrow');
    const indicatorBefore = document.getElementById('selected-tower-indicator');
    assert(arrowBefore, 'toggle-arrow span이 초기 상태에서 존재');
    assert(indicatorBefore, 'selected-tower-indicator span이 초기 상태에서 존재');

    // collapsed 토글 후에도 자식 span이 유지되는지 확인
    buildToggle.click(); // setBuildPanelCollapsed 호출됨
    const arrowAfter = buildToggle.querySelector('.toggle-arrow');
    const indicatorAfter = document.getElementById('selected-tower-indicator');
    assert(arrowAfter, 'toggle-arrow span이 토글 후에도 유지');
    assert(indicatorAfter, 'selected-tower-indicator span이 토글 후에도 유지');

    console.log('Smoke test passed');
}

if (require.main === module) {
    run();
}

module.exports = { run };
