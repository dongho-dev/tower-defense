const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const { setupDom } = require('./helpers');

describe('Smoke tests', () => {
    let document;

    before(() => {
        ({ document } = setupDom());
    });

    it('should have 8 tower cards', () => {
        const towerCards = document.querySelectorAll('.tower-card');
        assert.ok(towerCards.length === 8, `Expected 8 tower cards, found ${towerCards.length}`);
    });

    it('should have 3 speed buttons with 1x active by default', () => {
        const speedButtons = Array.from(document.querySelectorAll('.speed-button'));
        assert.ok(speedButtons.length === 3, 'Speed buttons missing');
        const active = speedButtons.filter((btn) => btn.classList.contains('active'));
        assert.ok(active.length === 1, 'Exactly one speed button should be active');
        assert.ok(active[0].dataset.speed === '1', 'Default active speed is not 1x');
    });

    it('should have sound toggle with aria-pressed true', () => {
        const soundToggle = document.getElementById('sound-toggle');
        assert.ok(soundToggle, 'Sound toggle button not found');
        assert.ok(
            soundToggle.getAttribute('aria-pressed') === 'true',
            'Sound toggle default pressed state should be true'
        );
    });

    it('should have a valid canvas element', () => {
        const canvas = document.getElementById('game');
        assert.ok(canvas && typeof canvas.width === 'number', 'Canvas element missing or invalid');
    });

    it('should toggle selected class on tower card click', () => {
        const towerCards = document.querySelectorAll('.tower-card');
        towerCards[1].click();
        const selectedButtons = Array.from(document.querySelectorAll('.tower-card.selected'));
        assert.ok(selectedButtons.length === 1, 'Selecting a tower card should toggle selected class');
    });

    it('#50: setBuildPanelCollapsed should preserve child spans', () => {
        const buildToggle = document.getElementById('build-toggle');
        assert.ok(buildToggle, 'build-toggle 버튼이 존재');
        const arrowBefore = buildToggle.querySelector('.toggle-arrow');
        const indicatorBefore = document.getElementById('selected-tower-indicator');
        assert.ok(arrowBefore, 'toggle-arrow span이 초기 상태에서 존재');
        assert.ok(indicatorBefore, 'selected-tower-indicator span이 초기 상태에서 존재');

        // collapsed 토글 후에도 자식 span이 유지되는지 확인
        buildToggle.click(); // setBuildPanelCollapsed 호출됨
        const arrowAfter = buildToggle.querySelector('.toggle-arrow');
        const indicatorAfter = document.getElementById('selected-tower-indicator');
        assert.ok(arrowAfter, 'toggle-arrow span이 토글 후에도 유지');
        assert.ok(indicatorAfter, 'selected-tower-indicator span이 토글 후에도 유지');
    });
});
