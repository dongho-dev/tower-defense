// 건설 메뉴: 빈 소켓 둘레에 타워 종류 버튼을 펼친다. 정보와 조작은 하단 패널(panel.js)이 맡는다.
import { ICONS, TOWER_TINT } from './icons.js';
import { TOWERS } from '../core/data/towers.js';
import { buildableTypes } from '../core/game.js';

const RADIUS = 84;

const polar = (deg, r = RADIUS) => {
    const a = (deg * Math.PI) / 180;
    return [Math.cos(a) * r, Math.sin(a) * r];
};

export class Radial {
    constructor(root, actions) {
        this.actions = actions;
        this.el = document.createElement('div');
        this.el.className = 'radial';
        root.appendChild(this.el);
        this.mode = null;
    }

    get open() {
        return this.mode != null;
    }

    close() {
        if (!this.mode) return;
        this.mode = null;
        this.target = null;
        this.el.classList.remove('open');
        this.el.innerHTML = '';
        this.actions.hover(null);
    }

    openBuild(socket, state) {
        this.close();
        this.mode = 'build';
        this.target = socket;
        this.el.innerHTML = '<div class="hub"></div>';
        // 살아남기: 광맥에는 광산만, 그 밖에는 광산을 뺀 나머지
        const types = buildableTypes(state, socket);
        const n = types.length;
        types.forEach((type, i) => {
            const def = TOWERS[type];
            const cost = def.tiers[0].cost;
            const [x, y] = polar(-90 + (360 / n) * i);
            const b = document.createElement('button');
            b.className = 'radial-btn';
            b.style.setProperty('--x', x + 'px');
            b.style.setProperty('--y', y + 'px');
            b.style.setProperty('--tint', TOWER_TINT[type]);
            b.setAttribute('aria-label', `${def.name} 건설 (${cost} 골드)`);
            b.innerHTML = `<i class="ico">${ICONS[type]}</i><span class="cost">${cost}</span><span class="hk">${def.hotkey}</span>`;
            b.addEventListener('click', (e) => {
                e.stopPropagation();
                if (state.gold >= cost) this.actions.build(socket.id, type);
                else this.actions.denied(def.name);
            });
            b.addEventListener('pointerenter', () => this.actions.hover(type));
            b.addEventListener('pointerleave', () => this.actions.hover(null));
            this.el.appendChild(b);
        });
        this.refreshAfford = () => {
            [...this.el.querySelectorAll('.radial-btn')].forEach((b, i) => {
                b.classList.toggle('disabled', state.gold < TOWERS[types[i]].tiers[0].cost);
            });
        };
        requestAnimationFrame(() => this.el.classList.add('open'));
    }

    update(screenPos) {
        if (!this.open) return;
        this.el.style.transform = `translate(${screenPos.x}px, ${screenPos.y}px)`;
        this.refreshAfford?.();
    }
}
