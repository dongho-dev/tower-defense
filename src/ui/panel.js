// 하단 정보 패널(인스펙터): 선택한 타워·적, 건설 미리보기를 화면 아래에 고정해서 보여 준다.
// 타워 조작(업그레이드·분기·각성·조준·판매)도 여기서 한다. 판매는 두 번 눌러야 한다.
import { ICONS, TOWER_TINT } from './icons.js';
import { TOWERS, MAX_MASTERY, resonanceLabel } from '../core/data/towers.js';
import {
    towerStats,
    estimateDps,
    sellValue,
    TARGETING,
    resonanceInfo,
    resonancePreview,
    upgradeOptions,
    previewStats,
    repairCost,
    gateRepairCost,
    gateReinforceOption,
    HERO
} from '../core/game.js';
import { enemyTraits } from '../core/data/enemies.js';
import { rtdTowerHtml, bindRtdTower } from './rtd.js';

const TARGET_LABEL = { first: '선두', strong: '최강', close: '근접' };

const fmt = (v) => (Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 10) / 10);

function diff(a, b, better = 'up') {
    if (b == null) return '';
    const d = a - b;
    if (Math.abs(d) < 0.01) return '';
    const good = better === 'up' ? d > 0 : d < 0;
    return `<em class="${good ? 'good' : 'bad'}">${d > 0 ? '+' : ''}${fmt(d)}</em>`;
}

function statsRow(s, dps, prev) {
    const def = s.__def;
    if (def.attack === 'barracks') {
        return `<div class="ip-stats">
            <div><b>${s.soldiers}${diff(s.soldiers, prev?.soldiers)}</b><span>병사</span></div>
            <div><b>${Math.round(s.unitHp)}${diff(s.unitHp, prev?.unitHp)}</b><span>병사 체력</span></div>
            <div><b>${fmt(dps)}${diff(dps, prev?.dps)}</b><span>합계 초당 피해</span></div>
        </div>`;
    }
    if (def.attack === 'none') {
        return `<div class="ip-stats">
            <div><b>${s.income}${diff(s.income, prev?.income)}</b><span>웨이브당 골드</span></div>
            <div><b>+${Math.round((s.__resValue || def.resonance.value) * 100)}%</b><span>풍요 공명</span></div>
        </div>`;
    }
    return `<div class="ip-stats">
        <div><b>${fmt(dps)}${diff(dps, prev?.dps)}</b><span>${s.ramp ? '평균 초당 피해' : '초당 피해'}</span></div>
        <div><b>${s.range.toFixed(1)}${diff(s.range, prev?.range)}</b><span>사거리</span></div>
        <div><b>${s.aura ? '상시' : s.ramp ? '지속' : s.rate.toFixed(2) + 's'}${s.rate && !s.ramp ? diff(s.rate, prev?.rate, 'down') : ''}</b><span>공격 간격</span></div>
    </div>`;
}

function tags(s, def) {
    const t = [];
    if (def.dmgType === 'physical') t.push(`<span class="tag phys"><i>${ICONS.physical}</i>물리</span>`);
    else if (def.dmgType === 'magic') t.push(`<span class="tag"><i>${ICONS.magic}</i>마법</span>`);
    if (s.splash) t.push(`<span class="tag">광역 ${s.splash.toFixed(1)}</span>`);
    if (s.slow) t.push(`<span class="tag">둔화 ${Math.round(s.slow * 100)}%</span>`);
    if (s.chain) t.push(`<span class="tag">연쇄 ${s.chain}</span>`);
    if (s.multi > 1) t.push(`<span class="tag">${s.multi}표적</span>`);
    if (s.pierce) t.push(`<span class="tag">관통 ${Math.round(s.pierce * 100)}%</span>`);
    if (s.burn) t.push(`<span class="tag">화염 지대</span>`);
    if (s.aura) t.push(`<span class="tag">상시 오라</span>`);
    if (s.stun) t.push(`<span class="tag">기절 ${s.stun}초</span>`);
    if (s.shatter > 1) t.push(`<span class="tag">파쇄 ×${s.shatter}</span>`);
    if (s.ramp) t.push(`<span class="tag">최대 ×${s.ramp.max}까지 증폭</span>`);
    if (s.soldiers) {
        t.push(`<span class="tag">적을 붙잡음</span>`);
        if (s.unitArmor) t.push(`<span class="tag">받는 피해 -${Math.round(s.unitArmor * 100)}%</span>`);
        if (s.regen) t.push(`<span class="tag">전투 중 회복</span>`);
        if (s.cleave) t.push(`<span class="tag">휩쓸기 ${Math.round(s.cleave * 100)}%</span>`);
        t.push(`<span class="tag">부활 ${s.respawn}초</span>`);
        t.push('<span class="tag warn">비행 적은 못 막음</span>');
    }
    return t.join('');
}

/** 공명: 받는 효과 / 주는 효과를 색 칩으로 */
function resonanceBlock(info, type) {
    const chip = (t, label, dir) =>
        `<span class="rchip" style="--c:${TOWER_TINT[t]}"><i>${ICONS[t]}</i>${dir === 'in' ? '' : '→ '}${label}</span>`;
    const recv = info.received.length
        ? info.received.map((r) => chip(r.type, r.label, 'in')).join('')
        : '<span class="none">없음</span>';
    const byType = new Map();
    for (const g of info.given) {
        const cur = byType.get(g.type) || { ...g, n: 0 };
        cur.n++;
        byType.set(g.type, cur);
    }
    const give = byType.size
        ? [...byType.values()]
              .map((g) => chip(g.type, `${TOWERS[g.type].name}${g.n > 1 ? ` ${g.n}곳` : ''}`, 'out'))
              .join('')
        : '<span class="none">없음</span>';
    const mine = TOWERS[type].resonance;
    return `<div class="ip-reso">
        <div class="rrow"><span class="k">받는 공명</span>${recv}</div>
        <div class="rrow"><span class="k">주는 공명</span><span class="what" style="--c:${TOWER_TINT[type]}">${mine.name} · ${resonanceLabel(mine.stat, info.value ?? mine.value)}</span>${give}</div>
        <div class="rhint">${ICONS.link}레이 라인으로 연결된 소켓 ${info.links.length}곳${info.openLinks ? ` · 빈 자리 ${info.openLinks}곳` : ''} · 다른 종류끼리만 공명</div>
    </div>`;
}

function pips(tower) {
    const lv = [1, 2, 3]
        .map((i) => `<i class="${i <= tower.tier ? 'on' : ''}" style="--c:${TOWER_TINT[tower.type]}"></i>`)
        .join('');
    const ms = tower.branch
        ? [1, 2]
              .slice(0, MAX_MASTERY)
              .map((i) => `<i class="m ${i <= tower.mastery ? 'on' : ''}"></i>`)
              .join('')
        : '';
    return `<span class="pips">${lv}${tower.branch ? '<b>◆</b>' : ''}${ms}</span>`;
}

export class Inspector {
    constructor(root, actions) {
        this.actions = actions;
        this.el = document.createElement('div');
        this.el.className = 'inspector panel ornate';
        root.appendChild(this.el);
        this.mode = null;
        this.key = '';
        this.sellArm = 0;
        this.hoverOpt = null;
    }

    get open() {
        return this.mode != null;
    }

    hide() {
        this.mode = null;
        this.target = null;
        this.el.classList.remove('show');
        this.key = '';
        this.sellArm = 0;
        this.hoverOpt = null;
    }

    show() {
        this.el.classList.add('show');
    }

    // ---------- 타워 ----------
    showTower(tower, state) {
        if (this.target !== tower) {
            this.sellArm = 0;
            this.hoverOpt = null;
        }
        this.mode = 'tower';
        this.target = tower;
        this.key = '';
        this.render(state);
        this.show();
    }

    towerHtml(tower, state) {
        const def = TOWERS[tower.type];
        const tint = TOWER_TINT[tower.type];
        const cur = towerStats(state, tower);
        cur.__def = def;
        cur.__resValue = tower.branch ? def.branches[tower.branch].resonanceValue : null;
        const curDps = estimateDps(state, tower);
        let shown = cur;
        let shownDps = curDps;
        let prev = null;
        let desc = tower.branch ? def.branches[tower.branch].desc : def.role;
        const h = this.hoverOpt;
        if (h) {
            const change =
                h.kind === 'tier'
                    ? { tier: tower.tier + 1 }
                    : h.kind === 'branch'
                      ? { branch: h.key }
                      : { mastery: tower.mastery + 1 };
            const p = previewStats(state, tower, change);
            shown = p.stats;
            shown.__def = def;
            shown.__resValue = h.kind === 'branch' ? def.branches[h.key].resonanceValue : cur.__resValue;
            shownDps = p.dps;
            prev = {
                dps: curDps,
                range: cur.range,
                rate: cur.rate,
                income: cur.income,
                soldiers: cur.soldiers,
                unitHp: cur.unitHp
            };
            desc =
                h.kind === 'branch'
                    ? `<b>${def.branches[h.key].name}</b> · ${def.branches[h.key].desc}`
                    : h.kind === 'tier'
                      ? `레벨 ${tower.tier + 1}로 강화`
                      : `각성 ${tower.mastery + 1}단계 · 피해 +25%, 사거리 +5%${def.attack === 'none' ? ', 수입 +30%' : ''}`;
        }
        const title = tower.branch ? `${def.name} · ${def.branches[tower.branch].name}` : def.name;
        const opts = upgradeOptions(tower);
        const optBtn = (o) => {
            const label =
                o.kind === 'branch'
                    ? `${o.label}`
                    : o.kind === 'tier'
                      ? `레벨 ${tower.tier + 1}`
                      : `각성 ${tower.mastery + 1}`;
            const hk = o.kind === 'branch' ? o.key.toUpperCase() : 'U';
            const poor = state.gold < o.cost;
            return `<button class="ip-btn up ${poor ? 'poor' : ''}" data-opt="${o.kind}:${o.key || ''}"><span class="hk">${hk}</span><span class="l">${label}</span><span class="c">${ICONS.gold}${o.cost}</span></button>`;
        };
        const maxed = !opts.length;
        const info = resonanceInfo(state, tower);
        info.value = cur.__resValue || def.resonance.value;
        const canTarget = def.attack !== 'none' && def.attack !== 'barracks' && !cur.aura;
        const rc = repairCost(tower);
        const hpBlock =
            tower.hp != null
                ? `<div class="ip-thp ${tower.hp < tower.maxHp * 0.35 ? 'low' : ''}"><div class="bar"><i style="width:${(tower.hp / tower.maxHp) * 100}%"></i></div><b>${Math.ceil(tower.hp)} / ${tower.maxHp}</b></div>`
                : '';
        const stun = tower.stunT > 0 ? '<span class="tag warn">기절</span>' : '';
        return `<div class="ip-head" style="--tint:${tint}">
                <i class="ico">${ICONS[tower.type]}</i>
                <div><div class="name">${title}</div><div class="sub">${def.en} ${pips(tower)}</div></div>
            </div>
            <div class="ip-main">
                <div class="ip-desc">${desc}</div>
                ${statsRow(shown, shownDps, prev)}
                ${hpBlock}
                <div class="tag-row">${stun}${tags(shown, def)}</div>
            </div>
            ${resonanceBlock(info, tower.type)}
            <div class="ip-actions">
                ${maxed ? '<div class="maxed">최종 단계</div>' : opts.map(optBtn).join('')}
                <div class="ip-row">
                    ${canTarget ? `<button class="ip-btn small" data-target title="조준 우선순위">${ICONS.target}<span>${TARGET_LABEL[tower.targeting]}</span></button>` : ''}
                    ${def.attack === 'barracks' ? `<button class="ip-btn small ${this.rallyArmed ? 'armed' : ''}" data-rally title="집결지 옮기기 (R) · 사거리 안 길 위를 누르세요">${ICONS.rally}<span>집결지</span></button>` : ''}
                    ${tower.hp != null ? `<button class="ip-btn small repair ${!rc ? 'off' : state.gold < rc ? 'poor' : ''}" data-repair title="수리 (G)">${ICONS.repair}<span>${rc ? `수리 ${rc}` : '온전함'}</span></button>` : ''}
                    <button class="ip-btn small sell ${this.sellArm ? 'armed' : ''}" data-sell>${ICONS.sell}<span>${this.sellArm ? `확인 · +${sellValue(tower)}` : `판매 +${sellValue(tower)}`}</span></button>
                </div>
                <div class="ip-foot">처치 ${tower.kills} · 누적 피해 ${Math.round(tower.damage)}</div>
            </div>`;
    }

    bindTower(tower, state) {
        for (const b of this.el.querySelectorAll('[data-opt]')) {
            const [kind, key] = b.dataset.opt.split(':');
            b.onclick = () => this.actions.upgrade(tower.id, kind === 'branch' ? key : null);
            b.onpointerenter = () => {
                this.hoverOpt = { kind, key };
                const p = previewStats(
                    state,
                    tower,
                    kind === 'tier'
                        ? { tier: tower.tier + 1 }
                        : kind === 'branch'
                          ? { branch: key }
                          : { mastery: tower.mastery + 1 }
                );
                this.actions.preview({ x: tower.x, z: tower.z, r: p.stats.range, color: TOWER_TINT[tower.type] });
                this.render(state, true);
            };
            b.onpointerleave = () => {
                this.hoverOpt = null;
                this.actions.preview({
                    x: tower.x,
                    z: tower.z,
                    r: towerStats(state, tower).range,
                    color: TOWER_TINT[tower.type]
                });
                this.render(state, true);
            };
        }
        const tb = this.el.querySelector('[data-target]');
        if (tb)
            tb.onclick = () => {
                const i = TARGETING.indexOf(tower.targeting);
                this.actions.target(tower.id, TARGETING[(i + 1) % TARGETING.length]);
                this.render(state, true);
            };
        this.el.querySelector('[data-sell]').onclick = () => this.trySell(tower, state);
        const rb = this.el.querySelector('[data-rally]');
        if (rb) rb.onclick = () => this.actions.rally(tower.id);
        const rp = this.el.querySelector('[data-repair]');
        if (rp) rp.onclick = () => this.actions.repair(tower.id);
    }

    /** 판매는 두 번: 첫 클릭은 확인 대기(2.5초) */
    trySell(tower, state) {
        if (this.sellArm && performance.now() - this.sellArm < 2500) {
            this.sellArm = 0;
            this.actions.sell(tower.id);
            return;
        }
        this.sellArm = performance.now();
        this.render(state, true);
        clearTimeout(this.sellT);
        this.sellT = setTimeout(() => {
            if (this.sellArm && this.mode === 'tower') {
                this.sellArm = 0;
                this.render(state, true);
            }
        }, 2600);
    }

    // ---------- 건설 미리보기 ----------
    showBuild(socket, type, state) {
        this.mode = 'build';
        this.target = { socket, type };
        this.key = '';
        this.render(state);
        this.show();
    }

    buildHtml(socket, type, state) {
        const def = TOWERS[type];
        const p = previewStats(state, { type, tier: 1, branch: null, mastery: 0, socketId: socket.id }, {});
        const s = { ...p.stats, __def: def };
        const dps = p.dps;
        const info = resonancePreview(state, socket.id, type);
        const cost = def.tiers[0].cost;
        return `<div class="ip-head" style="--tint:${TOWER_TINT[type]}">
                <i class="ico">${ICONS[type]}</i>
                <div><div class="name">${def.name}</div><div class="sub">${def.en}</div></div>
            </div>
            <div class="ip-main">
                <div class="ip-desc">${def.role}</div>
                ${statsRow(s, dps)}
                <div class="tag-row">${tags(s, def)}</div>
            </div>
            ${resonanceBlock(info, type)}
            <div class="ip-actions">
                <div class="build-cost ${state.gold < cost ? 'poor' : ''}">${ICONS.gold}${cost}<small>${state.gold < cost ? '골드 부족' : `단축키 ${def.hotkey}`}</small></div>
                <div class="ip-foot">이 자리에 지으면 받는·주는 공명이 왼쪽에 보입니다</div>
            </div>`;
    }

    // ---------- 적 ----------
    showEnemy(e, state) {
        this.mode = 'enemy';
        this.target = e;
        this.key = '';
        this.render(state);
        this.show();
    }

    enemyHtml(e) {
        const d = e.def;
        const t = enemyTraits(d).map(
            (x) => `<span class="tag ${x.kind === 'magic' ? '' : x.kind}" title="${x.long}">${x.long}</span>`
        );
        if (e.elite) t.unshift(`<span class="tag warn">정예 · 체력 ×3</span>`);
        if (e.shield > 0) t.push(`<span class="tag ice">보호막 ${Math.ceil(e.shield)}</span>`);
        if (e.wardT > 0) t.push('<span class="tag ice">바람 장막</span>');
        if (e.burrowT > 0) t.push('<span class="tag ice">땅속</span>');
        if (e.enraged) t.push('<span class="tag warn">분노!</span>');
        if (e.blockedBy != null) t.push('<span class="tag good">붙잡힘</span>');
        if (e.slowT > 0) t.push(`<span class="tag ice">둔화 ${Math.round(e.slow * 100)}%</span>`);
        if (e.stunT > 0) t.push('<span class="tag ice">기절/빙결</span>');
        const r = Math.max(0, e.hp / e.maxHp);
        return `<div class="ip-head" style="--tint:#d8c9ff">
                <i class="ico">${ICONS[e.type]}</i>
                <div><div class="name">${d.name}${e.elite ? ' <span class="elite">정예</span>' : ''}</div><div class="sub">웨이브 ${e.waveNo}</div></div>
            </div>
            <div class="ip-main">
                <div class="ip-hp"><div class="bar"><i style="width:${r * 100}%"></i></div><b>${Math.ceil(e.hp)} / ${Math.ceil(e.maxHp)}</b></div>
                <div class="ip-stats">
                    <div><b>${(e.speed * (1 - e.slow)).toFixed(1)}</b><span>이동 속도</span></div>
                    <div><b>${e.bounty}</b><span>처치 골드</span></div>
                    <div><b>-${e.lives}</b><span>돌파 시 생명</span></div>
                </div>
                <div class="tag-row">${t.join('') || '<span class="none">특성 없음</span>'}</div>
            </div>
            <div class="ip-tip"><b>공략</b>${d.tip || d.desc}</div>`;
    }

    // ---------- 성문 ----------
    showGate(gate, state) {
        this.mode = 'gate';
        this.target = gate;
        this.key = '';
        this.render(state);
        this.show();
    }

    gateHtml(g, state) {
        const r = Math.max(0, g.hp / g.maxHp);
        const rc = gateRepairCost(g);
        const opt = gateReinforceOption(g);
        const at = state.enemies.filter((e) => e.gateId === g.id).length;
        const tags = [];
        if (g.broken) tags.push('<span class="tag warn">무너짐 · 길이 열렸다</span>');
        else if (at) tags.push(`<span class="tag warn">공격받는 중 · 적 ${at}</span>`);
        if (g.level) tags.push(`<span class="tag good">보강 ${g.level}단계</span>`);
        tags.push('<span class="tag">지상 적을 막음</span>', '<span class="tag warn">비행 적은 넘어감</span>');
        const repairLabel = g.broken ? `재건 ${rc}` : rc ? `수리 ${rc}` : '온전함';
        return `<div class="ip-head" style="--tint:#e6c58c">
                <i class="ico">${ICONS.shield}</i>
                <div><div class="name">${g.name}</div><div class="sub">성문 · 보강 ${g.level}/2</div></div>
            </div>
            <div class="ip-main">
                <div class="ip-desc">${g.broken ? '문이 부서져 적이 그대로 지나간다. 문 자리가 비면 다시 세울 수 있다.' : '지상 적은 이 문 앞에서 멈춰 문을 부순다. 웨이브가 시작될 때마다 조금씩 저절로 고쳐진다.'}</div>
                <div class="ip-thp ${g.broken || r < 0.35 ? 'low' : ''}"><div class="bar"><i style="width:${r * 100}%"></i></div><b>${g.broken ? '무너짐' : `${Math.ceil(g.hp)} / ${g.maxHp}`}</b></div>
                <div class="tag-row">${tags.join('')}</div>
            </div>
            <div class="ip-actions">
                ${opt ? `<button class="ip-btn up ${state.gold < opt.cost || g.broken ? 'poor' : ''}" data-reinforce><span class="hk">U</span><span class="l">보강 ${g.level + 1}단계 · 체력 +${Math.round(g.baseHp * opt.hp)}</span><span class="c">${ICONS.gold}${opt.cost}</span></button>` : '<div class="maxed">최대 보강</div>'}
                <div class="ip-row">
                    <button class="ip-btn small repair ${!rc ? 'off' : state.gold < rc ? 'poor' : ''}" data-repair title="${g.broken ? '재건' : '수리'} (G)">${ICONS.repair}<span>${repairLabel}</span></button>
                </div>
                <div class="ip-foot">${g.broken ? `재건하면 체력 절반으로 다시 선다` : '수리비는 잃은 체력에 비례'}</div>
            </div>`;
    }

    // ---------- 영웅 ----------
    showHero(u, state) {
        this.mode = 'hero';
        this.target = u;
        this.key = '';
        this.render(state);
        this.show();
    }

    heroHtml(u) {
        const r = Math.max(0, u.hp / u.maxHp);
        const maxed = u.level >= HERO.maxLevel;
        const into = u.xp - (u.level - 1) * HERO.xpPerLevel;
        const sk = HERO.skill;
        return `<div class="ip-head" style="--tint:#ffd98a">
                <i class="ico">${ICONS.hero}</i>
                <div><div class="name">${HERO.name}</div><div class="sub">레벨 ${u.level}${maxed ? ' · 최고' : ` · 다음 레벨까지 ${Math.ceil(HERO.xpPerLevel - into)}`}</div></div>
            </div>
            <div class="ip-main">
                <div class="ip-hp"><div class="bar"><i style="width:${r * 100}%"></i></div><b>${u.dead ? `부활까지 ${Math.ceil(u.respawnT)}초` : `${Math.ceil(u.hp)} / ${u.maxHp}`}</b></div>
                <div class="ip-stats">
                    <div><b>${HERO.dmg(u.level)}</b><span>공격력</span></div>
                    <div><b>${fmt(HERO.dmg(u.level) / HERO.rate)}</b><span>초당 피해</span></div>
                    <div><b>-${Math.round(HERO.armor * 100)}%</b><span>받는 피해</span></div>
                </div>
                <div class="tag-row"><span class="tag">적을 붙잡음</span><span class="tag">휩쓸기 35%</span><span class="tag">처치할수록 성장</span><span class="tag warn">비행 적은 못 막음</span></div>
            </div>
            <div class="ip-tip"><b>조작</b>영웅을 고른 상태에서 <b>땅을 누르면</b> 그곳으로 달려가 지킵니다. 오른쪽 클릭으로도 이동. 근처에서 적이 쓰러지면 경험치를 얻어요.</div>
            <div class="ip-actions">
                <button class="ip-btn up ${u.skillCd > 0 || u.dead ? 'poor' : ''}" data-hskill><span class="hk">E</span><span class="l">${sk.name}</span><span class="c">${u.skillCd > 0 ? Math.ceil(u.skillCd) + '초' : '준비'}</span></button>
                <div class="ip-foot">${sk.desc} · 반경 ${sk.radius} · 피해 ${sk.dmg(u.level)} · 기절 ${sk.stun}초</div>
            </div>`;
    }

    // ---------- 공통 ----------
    render(state, force = false) {
        if (!this.mode) return;
        let key;
        if (this.mode === 'tower') {
            const t = this.target;
            key = [
                t.tier,
                t.branch,
                t.mastery,
                t.targeting,
                t.kills,
                Math.round(t.damage / 50),
                state.statsVersion,
                this.sellArm,
                Math.floor(state.gold / 5),
                JSON.stringify(this.hoverOpt),
                t.hp != null && Math.ceil(t.hp / 5),
                t.stunT > 0,
                this.rallyArmed,
                // 랜덤 디펜스: 쌓인 수·등급·옮기기
                t.count,
                t.grade,
                this.moveArmed
            ].join('|');
        } else if (this.mode === 'enemy') {
            const e = this.target;
            key = [
                e.id,
                Math.ceil(e.hp),
                e.slowT > 0,
                e.stunT > 0,
                Math.ceil(e.shield || 0),
                e.wardT > 0,
                e.burrowT > 0,
                e.enraged,
                e.blockedBy
            ].join('|');
        } else if (this.mode === 'gate') {
            const g = this.target;
            key = [
                g.id,
                g.broken,
                g.level,
                Math.ceil(g.hp / 10),
                Math.floor(state.gold / 5),
                state.enemies.filter((e) => e.gateId === g.id).length
            ].join('|');
        } else if (this.mode === 'hero') {
            const u = this.target;
            key = [
                u.level,
                Math.ceil(u.hp),
                u.dead && Math.ceil(u.respawnT),
                Math.ceil(u.skillCd),
                Math.floor(u.xp)
            ].join('|');
        } else {
            key = [
                this.target.socket.id,
                this.target.type,
                state.statsVersion,
                state.gold >= TOWERS[this.target.type].tiers[0].cost
            ].join('|');
        }
        if (!force && key === this.key) return;
        this.key = key;
        this.el.dataset.mode = this.mode;
        if (this.mode === 'tower' && state.rtd) {
            this.el.innerHTML = rtdTowerHtml(this, this.target, state);
            bindRtdTower(this, this.target, state);
        } else if (this.mode === 'tower') {
            this.el.innerHTML = this.towerHtml(this.target, state);
            this.bindTower(this.target, state);
        } else if (this.mode === 'gate') {
            const g = this.target;
            this.el.innerHTML = this.gateHtml(g, state);
            const rp = this.el.querySelector('[data-repair]');
            if (rp) rp.onclick = () => this.actions.gateRepair(g.id);
            const rf = this.el.querySelector('[data-reinforce]');
            if (rf) rf.onclick = () => this.actions.gateReinforce(g.id);
        } else if (this.mode === 'enemy') this.el.innerHTML = this.enemyHtml(this.target);
        else if (this.mode === 'hero') {
            this.el.innerHTML = this.heroHtml(this.target);
            const b = this.el.querySelector('[data-hskill]');
            if (b) b.onclick = () => this.actions.heroSkill();
        } else this.el.innerHTML = this.buildHtml(this.target.socket, this.target.type, state);
    }

    update(state) {
        if (!this.mode) return;
        if (this.mode === 'tower' && !state.towers.includes(this.target)) return this.actions.closed();
        if (this.mode === 'enemy' && !this.target.alive) return this.actions.closed();
        if (this.mode === 'hero' && state.hero !== this.target) return this.actions.closed();
        if (this.mode === 'gate' && !state.gates.includes(this.target)) return this.actions.closed();
        this.render(state);
    }
}
