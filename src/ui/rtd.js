// 랜덤 타워 디펜스 UI: 위 가운데 필드 몹 수(한도·경고)와 웨이브/보스 시계, 오른쪽 아래 소환 도크
// (소환 비용·공개 확률·천장·확률 강화·행운 소환·룬 파편·신화 레시피), 칸 위 쌓인 수 배지, 정보 패널의 타워 화면.
import * as THREE from 'three';
import './rtd.css';
import { ICONS, TOWER_TINT } from './icons.js';
import { TOWERS, resonanceLabel } from '../core/data/towers.js';
import { towerStats, estimateDps, resonanceInfo, TARGETING } from '../core/game.js';
import {
    RTD,
    GRADES,
    MYTHS,
    MYTH_ORDER,
    STACK,
    summonCost,
    canSummon,
    currentOdds,
    pityLeft,
    oddsUpgradeCost,
    luckChance,
    recipeStatus,
    canMerge,
    countSame,
    rtdSellValue,
    towerName,
    fieldCount,
    bossTimer
} from '../core/randomtd.js';

const h = (html) => {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
};
const fmt = (v) => (v >= 10000 ? (v / 1000).toFixed(1) + 'k' : v >= 100 ? Math.round(v) : Math.round(v * 10) / 10);
const _v = new THREE.Vector3();
const TARGET_LABEL = { first: '선두', strong: '최강', close: '근접' };

/** 등급 배지 */
export const gradeBadge = (g) => `<span class="rtd-grade" style="--g:${GRADES[g].color}">${GRADES[g].name}</span>`;

export class RtdUi {
    constructor(root, actions) {
        this.actions = actions;
        this.el = h(`<div class="rtd-ui">
            <div class="rtd-field panel ornate" data-field>
                <div class="rf-top"><span class="rf-lbl">필드</span><span class="rf-num num"><b data-count>0</b><small>/<span data-limit>100</span></small></span></div>
                <div class="rf-bar"><i data-fill></i><span class="mk" data-mk1></span><span class="mk" data-mk2></span></div>
                <div class="rf-sub" data-sub></div>
            </div>
            <div class="rtd-dock panel ornate" data-dock>
                <div class="rd-odds" data-odds title="소환 확률 (전설·신화는 소환으로 나오지 않습니다)"></div>
                <div class="rd-pity" data-pity></div>
                <button class="rd-summon" data-summon aria-label="소환"><span class="k">Q</span><span class="t">소환</span><span class="c"><i>${ICONS.gold}</i><b data-cost>20</b></span></button>
                <div class="rd-row">
                    <button class="rd-btn" data-odds-up title="확률 강화: 흔함이 줄고 희귀·영웅이 늘어난다"><span class="t">확률 강화</span><span class="c" data-odds-cost></span></button>
                    <button class="rd-btn luck" data-luck title="행운 소환: 룬 파편으로 영웅 등급을 노린다. 실패할 때마다 다음 확률이 오른다 (W)"><span class="t">행운 소환 <small>W</small></span><span class="c" data-luck-c></span></button>
                </div>
                <div class="rd-row">
                    <div class="rd-runes" title="룬 파편: 타워를 팔거나 보스를 잡으면 얻는다. 행운 소환·신화 레시피에 쓴다"><i class="rune"></i><b data-runes>0</b><span>룬 파편</span></div>
                    <button class="rd-btn myth" data-myth-btn title="신화 레시피 (T)"><span class="t">신화 레시피 <small>T</small></span><span class="c" data-myth-n></span></button>
                </div>
            </div>
            <div class="rtd-recipes panel ornate" data-recipes></div>
        </div>`);
        root.appendChild(this.el);
        const q = (s) => this.el.querySelector(s);
        this.$ = {
            field: q('[data-field]'),
            count: q('[data-count]'),
            limit: q('[data-limit]'),
            fill: q('[data-fill]'),
            mk1: q('[data-mk1]'),
            mk2: q('[data-mk2]'),
            sub: q('[data-sub]'),
            odds: q('[data-odds]'),
            pity: q('[data-pity]'),
            summon: q('[data-summon]'),
            cost: q('[data-cost]'),
            oddsUp: q('[data-odds-up]'),
            oddsCost: q('[data-odds-cost]'),
            luck: q('[data-luck]'),
            luckC: q('[data-luck-c]'),
            runes: q('[data-runes]'),
            mythBtn: q('[data-myth-btn]'),
            mythN: q('[data-myth-n]'),
            recipes: q('[data-recipes]')
        };
        this.$.summon.onclick = () => actions.summon();
        this.$.oddsUp.onclick = () => actions.upgradeOdds();
        this.$.luck.onclick = () => actions.luck();
        this.$.mythBtn.onclick = () => this.toggleRecipes();
        this.last = {};
        this.recipesOpen = false;
        this.setVisible(false);
    }

    setVisible(v) {
        this.el.style.display = v ? '' : 'none';
    }

    /** 새 판: 이 전장이 랜덤 디펜스일 때만 보인다. HUD의 생명·스킬·웨이브 호출은 숨긴다 */
    reset(state, hud) {
        const on = !!state.rtd;
        this.setVisible(on);
        hud.el.classList.toggle('rtd', on);
        this.last = {};
        this.recipesOpen = false;
        this.$.recipes.classList.remove('show');
        if (!on) return;
        const R = state.rtd;
        this.$.limit.textContent = R.limit;
        this.$.mk1.style.left = (R.warnAt[0] / R.limit) * 100 + '%';
        this.$.mk2.style.left = (R.warnAt[1] / R.limit) * 100 + '%';
    }

    set(key, value, apply) {
        if (this.last[key] === value) return;
        this.last[key] = value;
        apply(value);
    }

    toggleRecipes(force) {
        this.recipesOpen = force ?? !this.recipesOpen;
        this.$.recipes.classList.toggle('show', this.recipesOpen);
        this.last.recipes = null;
    }

    update(state) {
        if (!state.rtd) return;
        const R = state.rtd;
        // 필드 몹 수
        const n = fieldCount(state);
        this.set('count', n, (v) => {
            this.$.count.textContent = v;
            this.$.fill.style.width = Math.min(100, (v / R.limit) * 100) + '%';
            const lv = v >= R.warnAt[1] ? 2 : v >= R.warnAt[0] ? 1 : 0;
            this.$.field.classList.toggle('warn', lv === 1);
            this.$.field.classList.toggle('danger', lv === 2);
        });
        // 웨이브 시계 / 보스 제한 시간
        const bt = bossTimer(state);
        const sub = bt
            ? `boss|${Math.ceil(bt.left * 10)}`
            : state.waveIndex === 0
              ? `prep|${Math.ceil(state.nextWaveIn ?? 0)}`
              : state.nextWaveIn != null
                ? `next|${state.waveIndex}|${Math.ceil(state.nextWaveIn)}`
                : `w|${state.waveIndex}`;
        this.set('sub', sub, () => {
            this.$.field.classList.toggle('boss', !!bt);
            if (bt) {
                this.$.sub.innerHTML = `<span class="boss-t">보스 제한 시간 <b class="num">${bt.left.toFixed(1)}</b>초</span>`;
                this.$.field.style.setProperty('--bt', bt.left / bt.max);
            } else if (state.waveIndex === 0)
                this.$.sub.innerHTML = `첫 웨이브까지 <b>${Math.ceil(state.nextWaveIn ?? 0)}</b>초 · <b>Space</b> 바로 시작`;
            else if (state.nextWaveIn != null) {
                const nx = state.waveIndex + 1;
                const boss = state.waves[nx - 1]?.boss;
                this.$.sub.innerHTML = `웨이브 ${state.waveIndex}/${state.waves.length} · ${boss ? '<b class="bossn">보스</b>' : `다음 웨이브`}까지 <b>${Math.ceil(state.nextWaveIn)}</b>초`;
            } else this.$.sub.textContent = `웨이브 ${state.waveIndex}/${state.waves.length}`;
        });

        // 소환 도크
        const cost = summonCost(state);
        const can = canSummon(state);
        this.set('cost', cost + '|' + (state.gold >= cost) + '|' + can, () => {
            this.$.cost.textContent = cost;
            this.$.summon.classList.toggle('poor', state.gold < cost);
            this.$.summon.classList.toggle('full', !can);
            this.$.summon.title = can
                ? `소환 ${cost}골드 · 다음 소환마다 +${RTD.summonStep}`
                : '빈 칸이 없습니다 · 합성하거나 판매하세요';
        });
        const odds = currentOdds(state);
        this.set('odds', odds.join(','), () => {
            this.$.odds.innerHTML = odds
                .map((p, g) => `<span class="od" style="--g:${GRADES[g].color}"><b>${p}%</b>${GRADES[g].name}</span>`)
                .join('');
        });
        const pl = pityLeft(state);
        this.set('pity', pl, (v) => {
            this.$.pity.innerHTML =
                v <= 1
                    ? '<b class="hot">이번 소환은 희귀 이상 확정</b>'
                    : `천장: 흔함만 ${v - 1}번 더 나오면 다음은 희귀 이상 확정`;
        });
        const oc = oddsUpgradeCost(state);
        this.set('oddsUp', R.oddsLevel + '|' + (oc != null && state.gold >= oc), () => {
            this.$.oddsCost.innerHTML =
                oc == null
                    ? '<b>최대</b>'
                    : `<span class="lv">Lv${R.oddsLevel}→${R.oddsLevel + 1}</span><i>${ICONS.gold}</i>${oc}`;
            this.$.oddsUp.classList.toggle('poor', oc != null && state.gold < oc);
            this.$.oddsUp.classList.toggle('done', oc == null);
        });
        const lc = luckChance(state);
        this.set('luck', R.runes + '|' + lc, () => {
            this.$.luckC.innerHTML = `<i class="rune"></i>${RTD.luckCost} · 영웅 ${Math.round(lc * 100)}%`;
            this.$.luck.classList.toggle('poor', R.runes < RTD.luckCost);
        });
        this.set('runes', R.runes, (v) => (this.$.runes.textContent = v));
        // 신화 레시피: 준비된 것이 있으면 버튼이 빛난다
        const st = MYTH_ORDER.map((id) => recipeStatus(state, id));
        const ready = st.filter((s) => s.ready).length;
        this.set('mythN', ready, (v) => {
            this.$.mythN.textContent = v ? `${v}개 가능` : '';
            this.$.mythBtn.classList.toggle('ready', v > 0);
        });
        if (this.recipesOpen) this.renderRecipes(state, st);
    }

    renderRecipes(state, st) {
        const key = st.map((s) => [s.legend?.id, ...s.parts.map((p) => p?.id), s.runes].join(',')).join('|');
        if (this.last.recipes === key) return;
        this.last.recipes = key;
        const chip = (ok, type, grade, label) =>
            `<span class="rr-part ${ok ? 'ok' : ''}" style="--g:${GRADES[grade].color};--t:${TOWER_TINT[type]}"><i>${ICONS[type]}</i>${label}</span>`;
        this.$.recipes.innerHTML =
            `<div class="rr-head"><b>신화 레시피</b><span>전설 1 + 영웅 2 + 룬 파편 → 신화 (소환으로는 나오지 않음)</span></div>` +
            MYTH_ORDER.map((id, i) => {
                const r = MYTHS[id];
                const s = st[i];
                return `<div class="rr ${s.ready ? 'ready' : ''}">
                    <div class="rr-name" style="--t:${TOWER_TINT[id]}"><i>${ICONS[id]}</i><div><b>${r.name}</b><small>신화 · ${TOWERS[id].name}</small></div></div>
                    <div class="rr-parts">${chip(!!s.legend, id, 3, '전설 ' + TOWERS[id].name)}${r.parts
                        .map((p, k) => chip(!!s.parts[k], p, 2, '영웅 ' + TOWERS[p].name))
                        .join(
                            ''
                        )}<span class="rr-part rune ${s.runes ? 'ok' : ''}"><i class="rune"></i>${r.runes}</span></div>
                    <button class="rd-btn ${s.ready ? '' : 'poor'}" data-craft="${id}">제작</button>
                </div>`;
            }).join('');
        for (const b of this.$.recipes.querySelectorAll('[data-craft]'))
            b.onclick = () => this.actions.craft(b.dataset.craft);
    }

    /** 이벤트: 소환 결과 글자, 경고, 보스, 이자 */
    handle(events, state, hud, overlay, audio) {
        if (!state.rtd) return;
        for (const ev of events) {
            if (ev.type === 'rtdSummon') {
                const g = ev.grade;
                overlay.float(
                    `${GRADES[g].name} ${TOWERS[ev.tower].name}${ev.stacked ? ` ×${ev.count}` : ''}`,
                    new THREE.Vector3(ev.x, 2.1, ev.z),
                    GRADES[g].color,
                    g >= 2 ? 22 : 16
                );
                if (ev.forced) hud.toast('천장! 희귀 이상 확정');
                if (g >= 2)
                    hud.toast(`${ev.lucky ? '행운 소환 성공! ' : ''}${GRADES[g].name} ${TOWERS[ev.tower].name}!`);
                audio?.play(g >= 2 ? 'branch' : 'build');
            } else if (ev.type === 'rtdMerge') {
                const g = ev.grade;
                const name = ev.myth ? ev.name : `${GRADES[g].name} ${TOWERS[ev.tower].name}`;
                overlay.float(name, new THREE.Vector3(ev.x, 2.4, ev.z), GRADES[g].color, g >= 3 ? 26 : 20);
                if (ev.myth) hud.showBanner(ev.name, '신화가 깨어났다');
                else if (g >= 3) hud.toast(`전설 탄생! ${TOWERS[ev.tower].name}`);
                else if (!ev.inherited) hud.toast(`합성 → ${name} (공명 속성이 바뀌었다)`);
                audio?.play(ev.myth || g >= 3 ? 'level' : 'upgrade');
            } else if (ev.type === 'rtdLuck' && !ev.ok) {
                hud.toast(`행운 소환 실패 · 다음 확률 ${Math.round(ev.chance * 100)}%`, true);
                audio?.play('deny');
            } else if (ev.type === 'rtdWarn') {
                hud.toast(ev.level === 2 ? `필드 ${ev.count}마리! 곧 넘친다` : `필드 ${ev.count}마리 · 경고`, true);
                audio?.play('boss');
            } else if (ev.type === 'rtdBossDown') {
                hud.showBanner('보스 처치', `${Math.round(RTD.bossTime - ev.left)}초 · 룬 파편 +${ev.runes}`);
            } else if (ev.type === 'rtdIncome' && ev.interest > 0) {
                hud.pop(hud.$.goldDelta, `이자 +${ev.interest}`, '#ffd66e');
            } else if (ev.type === 'waveStart' && state.waves[ev.wave - 1]?.boss) {
                hud.showBanner(ev.bossName || '보스', `${RTD.bossTime}초 안에 쓰러뜨려라`, true);
            } else if (ev.type === 'rtdMove') {
                audio?.play('ui');
            }
        }
    }

    /** 칸 위 배지: 쌓인 수(×2·×3), 합성 가능, 전설·신화 등급 */
    drawOverlay(overlay, state, entities) {
        if (!state.rtd) return;
        const g = overlay.ctx;
        g.save();
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        for (const t of state.towers) {
            const ready = canMerge(state, t) && t.count >= 2;
            if (t.count < 2 && t.grade < 3 && !ready) continue;
            const top = entities.towerTop(t.id, _v);
            if (!top) continue;
            const p = overlay.project(top.setY(top.y + 0.25));
            if (p.behind) continue;
            const col = GRADES[t.grade].color;
            const text = t.grade >= 3 ? GRADES[t.grade].name : `×${t.count}`;
            g.font = '800 13px "Noto Sans KR", sans-serif';
            const w = g.measureText(text).width + 14;
            g.fillStyle = 'rgba(14,9,22,0.88)';
            g.strokeStyle = col;
            g.lineWidth = ready ? 2 : 1.2;
            if (ready) {
                g.shadowColor = '#ffe39a';
                g.shadowBlur = 10 + 4 * Math.sin(performance.now() / 160);
            }
            g.beginPath();
            g.roundRect(p.x - w / 2, p.y - 10, w, 20, 10);
            g.fill();
            g.stroke();
            g.shadowBlur = 0;
            g.fillStyle = ready ? '#ffe39a' : col;
            g.fillText(text, p.x, p.y + 0.5);
            if (ready) {
                g.font = '700 11px "Noto Sans KR", sans-serif';
                g.fillStyle = '#ffe39a';
                g.fillText('합성 E', p.x, p.y - 18);
            }
        }
        g.restore();
    }
}

// ---------- 정보 패널 (panel.js Inspector가 랜덤 디펜스 타워에 쓴다) ----------

export function rtdTowerHtml(insp, tower, state) {
    const def = TOWERS[tower.type];
    const tint = TOWER_TINT[tower.type];
    const s = towerStats(state, tower);
    const dps = estimateDps(state, tower);
    const gd = GRADES[tower.grade];
    const same = countSame(state, tower);
    const merge = canMerge(state, tower);
    const v = rtdSellValue(tower);
    const info = resonanceInfo(state, tower);
    const mine = def.resonance;
    const branch = tower.branch ? def.branches[tower.branch] : null;
    const desc =
        tower.grade === 4 ? `${MYTHS[tower.type]?.name || ''} · ${branch.desc}` : branch ? branch.desc : def.role;
    const recv = info.received.length
        ? info.received
              .map(
                  (r) =>
                      `<span class="rchip" style="--c:${TOWER_TINT[r.type]}"><i>${ICONS[r.type]}</i>${r.label}</span>`
              )
              .join('')
        : '<span class="none">없음</span>';
    const mergeHint =
        tower.grade >= 3
            ? tower.grade === 3
                ? '전설은 합성하지 않습니다 · 신화 레시피 재료 (T)'
                : '최고 등급'
            : merge
              ? `같은 타워 ${STACK}개 → ${GRADES[tower.grade + 1].name} 무작위 1 (종류 유지 ${Math.round(RTD.inherit * 100)}%)`
              : `같은 타워 ${same}/${STACK} · ${STACK - same}개 더 모으면 합성`;
    return `<div class="ip-head" style="--tint:${tint}">
            <i class="ico">${ICONS[tower.type]}</i>
            <div><div class="name">${towerName(tower)} ${tower.count > 1 ? `<span class="rtd-cnt">×${tower.count}</span>` : ''}</div><div class="sub">${gradeBadge(tower.grade)} ${def.name} · ${def.en}</div></div>
        </div>
        <div class="ip-main">
            <div class="ip-desc">${desc}</div>
            <div class="ip-stats">
                <div><b>${fmt(dps)}</b><span>${tower.count > 1 ? `초당 피해 (×${tower.count})` : '초당 피해'}</span></div>
                <div><b>${s.range.toFixed(1)}</b><span>사거리</span></div>
                <div><b>×${RTD.gradeMul[tower.grade]}</b><span>${gd.name} 배율</span></div>
            </div>
            <div class="ip-reso">
                <div class="rrow"><span class="k">받는 공명</span>${recv}</div>
                <div class="rrow"><span class="k">주는 공명</span><span class="what" style="--c:${tint}">${mine.name} · ${resonanceLabel(mine.stat, mine.value)}</span></div>
                <div class="rhint">${ICONS.link}상하좌우 이웃 칸의 다른 종류끼리 공명 · 옮기기(R)로 자리를 바꿀 수 있다</div>
            </div>
        </div>
        <div class="ip-actions">
            <button class="ip-btn up ${merge ? '' : 'poor'}" data-merge><span class="hk">E</span><span class="l">합성</span><span class="c">${tower.grade >= 3 ? '—' : merge ? '가능' : `${same}/${STACK}`}</span></button>
            <div class="rtd-merge-hint">${mergeHint}</div>
            <div class="ip-row">
                <button class="ip-btn small" data-target title="조준 우선순위 (보스는 언제나 먼저)">${ICONS.target}<span>${TARGET_LABEL[tower.targeting]}</span></button>
                <button class="ip-btn small ${insp.moveArmed ? 'armed' : ''}" data-move title="옮기기 (R) · 다른 칸을 누르면 옮기거나 자리를 바꾼다">${ICONS.rally}<span>옮기기</span></button>
                <button class="ip-btn small sell ${insp.sellArm ? 'armed' : ''}" data-sell>${ICONS.sell}<span>${insp.sellArm ? '확인' : '판매'} +${v.gold}${v.runes ? ` · 룬 ${v.runes}` : ''}</span></button>
            </div>
            <div class="ip-foot">처치 ${tower.kills} · 누적 피해 ${Math.round(tower.damage)}</div>
        </div>`;
}

export function bindRtdTower(insp, tower, state) {
    insp.el.querySelector('[data-merge]').onclick = () => insp.actions.merge(tower.id);
    insp.el.querySelector('[data-move]').onclick = () => insp.actions.move(tower.id);
    insp.el.querySelector('[data-sell]').onclick = () => insp.trySell(tower, state);
    insp.el.querySelector('[data-target]').onclick = () => {
        const i = TARGETING.indexOf(tower.targeting);
        insp.actions.target(tower.id, TARGETING[(i + 1) % TARGETING.length]);
        insp.render(state, true);
    };
}
