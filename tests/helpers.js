const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

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
    disconnect() {}
}

class FakeOscillator {
    constructor() {
        this.frequency = { setValueAtTime: noop };
        this.type = 'sine';
    }
    connect() {}
    disconnect() {}
    start() {}
    stop() {}
}

class FakeBufferSource {
    connect() {}
    disconnect() {}
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
    close() {
        this.state = 'closed';
    }
    resume() {
        this.state = 'running';
        return Promise.resolve();
    }
    createGain() {
        return new FakeGainNode();
    }
    createOscillator() {
        return new FakeOscillator();
    }
    createBuffer(channels, length) {
        return { getChannelData: () => new Float32Array(length * channels) };
    }
    createBufferSource() {
        return new FakeBufferSource();
    }
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
        fillStyle: '#000',
        strokeStyle: '#000',
        lineWidth: 1,
        beginPath: noop,
        moveTo: noop,
        lineTo: noop,
        stroke: noop,
        arc: noop,
        fillRect: noop,
        clearRect: noop,
        fill: noop,
        save: noop,
        restore: noop,
        font: '',
        textAlign: '',
        textBaseline: '',
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

    // Make module available globally so main.js can set module.exports
    const gameModule = { exports: {} };
    global.module = gameModule;

    const scriptFiles = [
        'constants.js',
        'towers.js',
        'utils.js',
        'map.js',
        'ui.js',
        'audio.js',
        'combat.js',
        'overlay.js',
        'game.js',
        'renderer.js',
        'main.js'
    ];
    for (const file of scriptFiles) {
        const filePath = path.join(__dirname, '..', file);
        const code = fs.readFileSync(filePath, 'utf-8');
        vm.runInThisContext(code, { filename: filePath });
    }

    // main.js sets module.exports via its `if (typeof module !== 'undefined')` block
    const game = gameModule.exports;

    // Remove the global module override
    delete global.module;

    return { window, document, game };
}

module.exports = {
    noop,
    FakeGainNode,
    FakeOscillator,
    FakeBufferSource,
    FakeAudioContext,
    setupDom
};
