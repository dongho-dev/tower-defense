// 방사형 메뉴(건설·업그레이드·판매)와 정보 카드.
import { ICONS, TOWER_TINT } from './icons.js';
import { TOWERS, TOWER_ORDER, MAX_TIER, baseStats } from '../core/data/towers.js';
import { towerStats, estimateDps, sellValue, TARGETING, resonanceDonors } from '../core/game.js';

const TARGET_LABEL = { first: '선두', strong: '최강', close: '근접' };
const RADIUS = 78;

const polar = (deg, r = RADIUS) => {
    const a = (deg * Math.PI) / 180;
    return [Math.cos(a) * r, Math.sin(a) * r];
};

function specialTags(s, def) {
    const tags = [];
    tags.push(
        def.dmgType === 'physical'
            ? `<span class="tag phys"><i>${ICONS.physical}</i>물리</span>`
            : `<span class="tag"><i>${ICONS.magic}</i>마법</span>`
    );
    if (s.splash) tags.push(`<span class="tag">광역 ${s.splash.toFixed(1)}</span>`);
    if (s.slow) tags.push(`<span class="tag">둔화 ${Math.round(s.slow * 100)}%</span>`);
    if (s.chain) tags.push(`<span class="tag">연쇄 ${s.chain}</span>`);
    if (s.multi > 1) tags.push(`<span class="tag">${s.multi}표적</span>`);
    if (s.pierce) tags.push(`<span class="tag">관통 ${Math.round(s.pierce * 100)}%</span>`);
    if (s.burn) tags.push(`<span class="tag">화염 지대</span>`);
    if (s.aura) tags.push(`<span class="tag">상시 오라</span>`);
    if (s.stun) tags.push(`<span class="tag">기절 ${s.stun}초</span>`);
    if (s.shatter > 1) tags.push(`<span class="tag">파쇄 ×${s.shatter}</span>`);
    return tags.join('');
}

function statBlock(dps, range, rate, prev) {
    const up = (a, b, better = 'up') => {
        if (b == null) return '';
        const d = a - b;
        if (Math.abs(d) < 0.01) return '';
        const good = better === 'up' ? d > 0 : d < 0;
        return ` <span class="up" style="color:${good ? 'var(--good)' : 'var(--danger)'}">${d > 0 ? '+' : ''}${fmt(d)}</span>`;
    };
    return `<div class="stats">
        <div class="stat"><b>${fmt(dps)}${up(dps, prev?.dps)}</b><span>초당 피해</span></div>
        <div class="stat"><b>${range.toFixed(1)}${up(range, prev?.range)}</b><span>사거리</span></div>
        <div class="stat"><b>${rate ? rate.toFixed(2) + 's' : '상시'}${rate ? up(rate, prev?.rate, 'down') : ''}</b><span>공격 간격</span></div>
    </div>`;
}

const fmt = (v) => (Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 10) / 10);

function starRow(tower) {
    const n = tower.branch ? 4 : tower.tier;
    return `<div class="stars">${[1, 2, 3, 4].map((i) => `<i class="${i <= n ? 'on' : ''}">${ICONS.star}</i>`).join('')}</div>`;
}

function dpsOf(stats) {
    if (stats.aura) return stats.aura.dps;
    return stats.rate ? ((stats.dmg || 0) * (stats.multi || 1)) / stats.rate : 0;
}

export class Radial {
    constructor(root, actions) {
        this.actions = actions;
        this.el = document.createElement('div');
        this.el.className = 'radial';
        root.appendChild(this.el);
        this.card = document.createElement('div');
        this.card.className = 'card panel ornate';
        root.appendChild(this.card);
        this.mode = null;
        this.anchor = null;
    }

    get open() {
        return this.mode != null;
    }

    close() {
        this.mode = null;
        this.target = null;
        this.el.classList.remove('open');
        this.el.innerHTML = '';
        this.hideCard();
        this.actions.preview(null);
    }

    button({ deg, r, icon, tint, cost, hk, cls = '', label, onClick, onHover, disabled }) {
        const b = document.createElement('button');
        const [x, y] = polar(deg, r);
        b.className = `radial-btn ${cls} ${disabled ? 'disabled' : ''}`;
        b.style.setProperty('--x', x + 'px');
        b.style.setProperty('--y', y + 'px');
        if (tint) b.style.setProperty('--tint', tint);
        b.setAttribute('aria-label', label);
        b.innerHTML = `<i class="ico">${icon}</i>${cost != null ? `<span class="cost">${cost}</span>` : ''}${hk ? `<span class="hk">${hk}</span>` : ''}`;
        b.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!disabled) onClick();
            else this.actions.denied(label);
        });
        b.addEventListener('pointerenter', () => onHover?.(true));
        b.addEventListener('pointerleave', () => onHover?.(false));
        this.el.appendChild(b);
        return b;
    }

    openBuild(socket, state) {
        this.close();
        this.mode = 'build';
        this.target = socket;
        this.el.innerHTML = '<div class="hub"></div>';
        const degs = [225, 315, 135, 45];
        TOWER_ORDER.forEach((type, i) => {
            const def = TOWERS[type];
            const cost = def.tiers[0].cost;
            this.button({
                deg: degs[i],
                icon: ICONS[type],
                tint: TOWER_TINT[type],
                cost,
                hk: def.hotkey,
                label: `${def.name} 건설 (${cost} 골드)`,
                disabled: state.gold < cost,
                onClick: () => this.actions.build(socket.id, type),
                onHover: (on) => {
                    if (on) {
                        this.showCard(this.typeCard(type, state));
                        this.actions.preview({
                            x: socket.x,
                            z: socket.z,
                            r: def.tiers[0].range,
                            color: TOWER_TINT[type]
                        });
                    } else {
                        this.hideCard();
                        this.actions.preview(null);
                    }
                }
            });
        });
        this.refreshAfford = () => {
            [...this.el.querySelectorAll('.radial-btn')].forEach((b, i) => {
                const cost = TOWERS[TOWER_ORDER[i]].tiers[0].cost;
                b.classList.toggle('disabled', state.gold < cost);
            });
        };
        requestAnimationFrame(() => this.el.classList.add('open'));
    }

    openTower(tower, state) {
        this.close();
        this.mode = 'tower';
        this.target = tower;
        this.buildTowerButtons(tower, state);
        this.showCard(this.towerCard(tower, state));
        this.actions.preview({
            x: tower.x,
            z: tower.z,
            r: towerStats(state, tower).range,
            color: TOWER_TINT[tower.type]
        });
        requestAnimationFrame(() => this.el.classList.add('open'));
    }

    buildTowerButtons(tower, state) {
        this.el.innerHTML = '<div class="hub"></div>';
        const def = TOWERS[tower.type];
        const tint = TOWER_TINT[tower.type];
        const costs = [];
        const back = () => {
            this.showCard(this.towerCard(tower, state));
            this.actions.preview({ x: tower.x, z: tower.z, r: towerStats(state, tower).range, color: tint });
        };
        if (!tower.branch && tower.tier < MAX_TIER) {
            const next = def.tiers[tower.tier];
            costs.push(next.cost);
            this.button({
                deg: 270,
                icon: ICONS.upgrade,
                tint: '#ffe3a3',
                cost: next.cost,
                hk: 'U',
                label: `레벨 ${tower.tier + 1} 업그레이드 (${next.cost} 골드)`,
                disabled: state.gold < next.cost,
                onClick: () => this.actions.upgrade(tower.id, null),
                onHover: (on) => {
                    if (on) {
                        this.showCard(this.towerCard(tower, state, { tier: tower.tier + 1 }));
                        this.actions.preview({
                            x: tower.x,
                            z: tower.z,
                            r: next.range * rangeMult(state, tower),
                            color: tint
                        });
                    } else back();
                }
            });
        } else if (!tower.branch) {
            [
                ['a', 235],
                ['b', 305]
            ].forEach(([k, deg]) => {
                const br = def.branches[k];
                costs.push(br.cost);
                this.button({
                    deg,
                    icon: ICONS[tower.type],
                    tint,
                    cost: br.cost,
                    hk: k.toUpperCase(),
                    label: `${br.name} 특화 (${br.cost} 골드)`,
                    disabled: state.gold < br.cost,
                    onClick: () => this.actions.upgrade(tower.id, k),
                    onHover: (on) => {
                        if (on) {
                            this.showCard(this.towerCard(tower, state, { branch: k }));
                            this.actions.preview({
                                x: tower.x,
                                z: tower.z,
                                r: br.range * rangeMult(state, tower),
                                color: tint
                            });
                        } else back();
                    }
                });
            });
        }
        this.button({
            deg: 90,
            icon: ICONS.sell,
            cls: 'sell small',
            cost: `+${sellValue(tower)}`,
            label: `판매 (+${sellValue(tower)} 골드)`,
            onClick: () => this.actions.sell(tower.id)
        });
        if (!def.branches.a.aura || tower.branch !== 'a') {
            const tb = this.button({
                deg: 180,
                r: 70,
                icon: ICONS.target,
                cls: 'small',
                cost: TARGET_LABEL[tower.targeting],
                label: `조준 우선순위: ${TARGET_LABEL[tower.targeting]}`,
                onClick: () => {
                    const i = TARGETING.indexOf(tower.targeting);
                    this.actions.target(tower.id, TARGETING[(i + 1) % TARGETING.length]);
                    tb.querySelector('.cost').textContent = TARGET_LABEL[tower.targeting];
                }
            });
        }
        this.refreshAfford = () => {
            const btns = [...this.el.querySelectorAll('.radial-btn:not(.small)')];
            btns.forEach((b, i) => b.classList.toggle('disabled', costs[i] != null && state.gold < costs[i]));
        };
    }

    typeCard(type, state) {
        const def = TOWERS[type];
        const s = { ...def.tiers[0], multi: 1, shatter: 1 };
        void state;
        return `<div class="head" style="--tint:${TOWER_TINT[type]}"><i class="ico">${ICONS[type]}</i><div><div class="name">${def.name}</div><div class="en">${def.en}</div></div></div>
            <div class="desc">${def.role}</div>
            ${statBlock(dpsOf(s), s.range, s.rate)}
            <div class="tag-row">${specialTags(s, def)}</div>
            <div class="foot"><span>공명 · <b>${def.resonance.name}</b></span><span>${def.resonance.desc.replace('연결된 타워 ', '')}</span></div>`;
    }

    towerCard(tower, state, preview = null) {
        const def = TOWERS[tower.type];
        const cur = towerStats(state, tower);
        const curDps = estimateDps(state, tower);
        let title = def.name;
        let desc = def.role;
        let body;
        if (preview) {
            const fake = { ...tower, tier: preview.tier ?? tower.tier, branch: preview.branch ?? tower.branch };
            const b = baseStats(fake);
            const mult = rangeMult(state, tower);
            const dmgM = cur.dmgMult;
            const rate = b.rate ? b.rate * (cur.rate / (baseStats(tower).rate || 1) || 1) : 0;
            const dps = b.aura ? b.aura.dps * dmgM : rate ? ((b.dmg || 0) * dmgM * (b.multi || 1)) / rate : 0;
            if (preview.branch) {
                title = `${def.name} → ${b.name}`;
                desc = b.desc;
            } else desc = `레벨 ${preview.tier}로 강화`;
            body = statBlock(dps, b.range * mult, rate, { dps: curDps, range: cur.range, rate: cur.rate });
            body += `<div class="tag-row">${specialTags({ ...b, multi: b.multi || 1, shatter: b.shatter || 1 }, def)}</div>`;
        } else {
            if (tower.branch) {
                title = `${def.name} · ${def.branches[tower.branch].name}`;
                desc = def.branches[tower.branch].desc;
            }
            body = statBlock(curDps, cur.range, cur.rate) + `<div class="tag-row">${specialTags(cur, def)}</div>`;
        }
        const donors = resonanceDonors(state, tower);
        const reso = donors.length
            ? donors
                  .map(
                      (d) =>
                          `<span class="tag" style="border-color:${TOWER_TINT[d]}55"><i style="color:${TOWER_TINT[d]}">${ICONS[d]}</i>${TOWERS[d].resonance.name}</span>`
                  )
                  .join('')
            : '<span style="color:var(--faint)">연결된 다른 종류 타워 없음</span>';
        return `<div class="head" style="--tint:${TOWER_TINT[tower.type]}"><i class="ico">${ICONS[tower.type]}</i><div><div class="name">${title}</div><div class="en">${def.en}</div></div>${starRow(tower)}</div>
            <div class="desc">${desc}</div>
            ${body}
            <div class="foot" style="flex-direction:column;gap:6px"><div>받는 공명 · ${reso}</div><div>처치 <b>${tower.kills}</b> · 누적 피해 <b>${Math.round(tower.damage)}</b></div></div>`;
    }

    enemyCard(e) {
        const d = e.def;
        const tags = [];
        if (d.armor) tags.push(`<span class="tag phys">방어 ${Math.round(d.armor * 100)}%</span>`);
        if (d.resist) tags.push(`<span class="tag">저항 ${Math.round(d.resist * 100)}%</span>`);
        if (e.elite) tags.push(`<span class="tag warn">정예</span>`);
        if (d.flying) tags.push(`<span class="tag">부유</span>`);
        if (d.heal) tags.push(`<span class="tag warn">치유</span>`);
        return `<div class="head" style="--tint:#d8c9ff"><i class="ico">${ICONS[e.type]}</i><div><div class="name">${d.name}${e.elite ? ' (정예)' : ''}</div><div class="en">체력 ${Math.ceil(e.hp)} / ${Math.ceil(e.maxHp)}</div></div></div>
            <div class="desc">${d.desc}</div>
            <div class="tag-row">${tags.join('') || '<span style="color:var(--faint)">특성 없음</span>'}</div>
            <div class="foot"><span>처치 보상 <b>${e.bounty}</b></span><span>돌파 시 생명 <b>-${e.lives}</b></span></div>`;
    }

    showCard(html) {
        this.card.innerHTML = html;
        this.card.classList.add('show');
        this.cardShown = true;
        this.placeCard();
    }

    hideCard() {
        this.card.classList.remove('show');
        this.cardShown = false;
    }

    /** 앵커(화면 좌표) 옆에 카드를 둔다. 화면 가장자리면 반대편으로 */
    placeCard() {
        if (!this.anchor) return;
        const W = window.innerWidth;
        const H = window.innerHeight;
        const cw = 300;
        const ch = this.card.offsetHeight || 200;
        let x = this.anchor.x + 120;
        if (x + cw > W - 16) x = this.anchor.x - 120 - cw;
        let y = this.anchor.y - ch / 2;
        y = Math.max(80, Math.min(H - ch - 110, y));
        this.card.style.left = x + 'px';
        this.card.style.top = y + 'px';
    }

    update(screenPos, state) {
        if (!this.open) return;
        this.anchor = screenPos;
        this.el.style.transform = `translate(${screenPos.x}px, ${screenPos.y}px)`;
        if (this.cardShown) this.placeCard();
        this.refreshAfford?.();
        if (this.mode === 'tower' && !state.towers.includes(this.target)) this.close();
    }
}

function rangeMult(state, tower) {
    const s = towerStats(state, tower);
    const b = baseStats(tower);
    return s.range / b.range;
}
