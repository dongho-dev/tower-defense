// 전체 화면 UI: 타이틀, 로비(놀이 방식 → 전장·난이도), 일시정지, 설정, 결과, 튜토리얼 안내.
import { ICONS } from './icons.js';
import { MAPS } from '../core/data/maps.js';
import { ENEMIES, enemyTraits } from '../core/data/enemies.js';
import { DIFFICULTY, DIFFICULTY_ORDER } from '../core/data/difficulty.js';
import { RTD } from '../core/data/randomtd.js';
import { formatClock } from '../core/survival.js';

/** 기록 키: 공성전은 난이도별로 따로 */
export function recordKey(diff, mode) {
    return mode === 'siege' ? 'siege-' + diff : diff;
}

/** 저장 데이터에서 맵·난이도 기록 */
export function recordOf(save, mapId, diff, mode = 'campaign') {
    return save.records?.[mapId]?.[recordKey(diff, mode)] || { stars: 0, best: 0 };
}

/** 기본 모드(전투) 말고는 아직 다듬는 중이라 베타로 표시한다 */
export const BETA = '<span class="beta">베타</span>';

/** 공성전 전용 맵의 장르 (스타 유즈맵처럼) */
export const GENRES = {
    defense: { label: '디펜스', icon: 'shield' },
    survival: { label: '살아남기', icon: 'moon' }
};

/**
 * 로비의 놀이 방식 다섯 가지. map이 있으면 전장이 하나뿐이라 난이도만 고르고 바로 시작한다.
 * thumb: 카드 그림으로 쓸 맵 (public/thumbs/{id}.jpg)
 * soon: 아직 막아 둔 놀이 방식 (기본 전투를 먼저 다듬는 동안 '준비 중'으로 보인다)
 */
export const LOBBY_MODES = [
    { id: 'campaign', name: '전투', rule: '20 웨이브를 막아 내고 별을 모읍니다', thumb: 'dusk', run: {} },
    {
        id: 'endless',
        name: '끝없는 밤',
        soon: true,
        rule: '끝없이 몰려오는 적을 몇 웨이브까지 버틸까요',
        thumb: 'voidspire',
        run: { endless: true }
    },
    {
        id: 'fortress',
        name: '성채 방어',
        soon: true,
        map: 'fortress',
        rule: '적이 성문을 부숩니다. 무너지기 전에 고치세요',
        run: { siege: true }
    },
    {
        id: 'survival',
        name: '살아남기',
        soon: true,
        map: 'mountain',
        rule: '본진을 짓고 동이 틀 때까지 버팁니다',
        run: { siege: true }
    },
    {
        id: 'rtd',
        name: '랜덤 디펜스',
        soon: true,
        map: 'randomtd',
        rule: '무작위 타워를 소환하고, 셋을 합쳐 키웁니다',
        run: { siege: true }
    }
].filter((m) => !m.map || MAPS[m.map]);

const LOBBY = Object.fromEntries(LOBBY_MODES.map((m) => [m.id, m]));

/** 전투·끝없는 밤에서 고르는 전장 (공성전 전용 맵 제외) */
export const FIELD_MAPS = Object.values(MAPS).filter((m) => !m.siegeOnly);

/** 지금 판이 어느 놀이 방식인지 (선택 화면으로 돌아갈 때 그 자리로) */
export function lobbyModeOf(state) {
    if (!state) return null;
    if (state.endless) return 'endless';
    return LOBBY_MODES.find((m) => m.map && m.map === state.mapId)?.id || 'campaign';
}

/** 저장된 마지막 놀이 방식 (예전 저장의 'siege'는 성채 방어로) */
export function lastLobbyMode(save) {
    const last = save.lastMode === 'siege' ? 'fortress' : save.lastMode;
    const id = LOBBY[last] ? last : save.lastEndless ? 'endless' : 'campaign';
    return LOBBY[id]?.soon ? 'campaign' : id;
}

/** 로비 글자·카드 배율: 1080p에서 1.25배, 그보다 작은 창은 1배 */
export function lobbyScale(w, h) {
    return Math.max(1, Math.min(h / 864, w / 1536));
}

/** 놀이 방식에 맞춘 난이도 설명 (살아남기는 본진 체력, 랜덤 디펜스는 필드 한도) */
export function diffDesc(diffId, modeId) {
    const d = DIFFICULTY[diffId];
    const parts = [];
    if (d.hpMul !== 1) parts.push(`적 체력 ${Math.round(d.hpMul * 100)}%`);
    if (d.goldMul !== 1) parts.push(`시작 골드 +${Math.round((d.goldMul - 1) * 100)}%`);
    if (modeId === 'survival') {
        if ((d.baseMul ?? 1) !== 1) parts.push(`본진 체력 ${Math.round(d.baseMul * 100)}%`);
    } else if (modeId === 'rtd') {
        parts.push(`필드 한도 ${Math.round(RTD.mobLimit * (diffId === 'hero' ? RTD.heroLimit : 1))}마리`);
    } else parts.push(d.lives === 1 ? '생명 1 · 한 마리도 놓치면 끝' : `생명 ${d.lives ?? 20}`);
    if (diffId === 'normal') parts.unshift('기본 밸런스');
    return parts.join(' · ');
}

/** 판 길이: 20 웨이브 · 끝없이 · 동틀 때까지 10분 · 40 웨이브 */
function lengthOf(m, endless) {
    if (endless) return '끝없이';
    if (m.survival) return `동틀 때까지 ${Math.round((m.survival.dawn || 600) / 60)}분`;
    return m.rtd ? '40 웨이브' : '20 웨이브';
}

/** 맵 카드 아래 한 줄: 길 갈래·성문 (살아남기·랜덤 디펜스는 없음) */
function mapMeta(m) {
    if (m.survival || m.rtd) return '';
    if (m.gates) return `성문 ${m.gates.length}곳`;
    return m.paths?.length > 1 ? `균열 ${m.paths.length}곳` : '균열 1곳';
}

/** 비어 있지 않은 것만 ' · '로 잇기 */
const dots = (...parts) => parts.filter(Boolean).join(' · ');

const starRow = (n) => [1, 2, 3].map((i) => `<i class="${i <= n ? 'on' : ''}">${ICONS.star}</i>`).join('');

const h = (html) => {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
};

const THUMB_FALLBACK = {
    dusk: 'linear-gradient(160deg,#f08a64 0%,#4b2c72 55%,#161236 100%)',
    frost: 'linear-gradient(160deg,#f2a0a4 0%,#34407e 55%,#0e1430 100%)',
    void: 'linear-gradient(160deg,#b0306a 0%,#2a0b3a 55%,#07030f 100%)',
    ember: 'linear-gradient(160deg,#ff7a3a 0%,#5a1a12 55%,#1a0a0a 100%)',
    dawn: 'linear-gradient(160deg,#ffc8b0 0%,#6a8ad0 55%,#2a3a7a 100%)',
    storm: 'linear-gradient(160deg,#5aa0b0 0%,#1a3048 55%,#060c18 100%)',
    citadel: 'linear-gradient(160deg,#f4ae6a 0%,#57406e 55%,#1c1838 100%)',
    alpine: 'linear-gradient(160deg,#e9967a 0%,#36457e 50%,#121a3a 100%)',
    fate: 'linear-gradient(160deg,#ffd2a0 0%,#5c7ec0 45%,#2f5a2a 100%)'
};

/** 맵 그림: 미리 찍어 둔 썸네일, 없으면 테마 색 */
const thumbBg = (id) => `url(thumbs/${id}.jpg), ${THUMB_FALLBACK[MAPS[id]?.theme || 'dusk']}`;

/** 놀이 방식별 내 기록 (기록 형식은 예전 그대로: 맵 → 난이도 키 → { stars, best }) */
function modeRecord(save, mode) {
    if (mode.map) {
        const stars = Math.max(...DIFFICULTY_ORDER.map((d) => recordOf(save, mode.map, d, 'siege').stars || 0));
        return { stars, max: 3 };
    }
    let stars = 0;
    let best = 0;
    for (const m of FIELD_MAPS) {
        const recs = DIFFICULTY_ORDER.map((d) => recordOf(save, m.id, d));
        stars += Math.max(...recs.map((r) => r.stars || 0));
        best = Math.max(best, ...recs.map((r) => r.best || 0));
    }
    return { stars, max: FIELD_MAPS.length * 3, best };
}

function recordHtml(mode, rec) {
    if (mode.id === 'endless')
        return rec.best
            ? `<span class="lb-best">${ICONS.moon}<b>${rec.best}</b> 웨이브</span>`
            : '<span class="lb-none">아직 없음</span>';
    if (mode.map)
        return rec.stars
            ? `<span class="lb-stars">${starRow(rec.stars)}</span>`
            : '<span class="lb-none">아직 없음</span>';
    return `<span class="lb-total">${ICONS.star}<b>${rec.stars}</b><span>/ ${rec.max}</span></span>`;
}

const keyHints = (pairs) =>
    `<footer class="lb-keys">${pairs.map(([k, v]) => `<span>${k.map((x) => `<kbd>${x}</kbd>`).join('')}${v}</span>`).join('')}</footer>`;

const diffSeg = () =>
    `<div class="lb-diff" role="radiogroup" aria-label="난이도">${DIFFICULTY_ORDER.map(
        (d) =>
            `<button role="radio" data-v="${d}" class="d-${d}">${d === 'hero' ? ICONS.crown : ''}${DIFFICULTY[d].name}</button>`
    ).join('')}</div>`;

/**
 * 마우스를 실제로 움직였을 때만 가리킨 카드로 초점을 옮긴다
 * (화면이 바뀌며 멈춰 있던 포인터 아래 카드가 키보드 초점을 빼앗지 않게)
 */
function hoverFocus(btn, allowed = () => true) {
    btn.addEventListener('mousemove', (e) => {
        if ((e.movementX || e.movementY) && allowed() && document.activeElement !== btn)
            btn.focus({ preventScroll: true });
    });
}

/** 방향키로 버튼 목록 안에서 초점 옮기기 */
function moveFocus(list, from, step) {
    const i = list.indexOf(from);
    const n = i < 0 ? 0 : Math.max(0, Math.min(list.length - 1, i + step));
    list[n]?.focus({ preventScroll: true });
    return list[n];
}

export class Screens {
    constructor(root, actions) {
        this.root = root;
        this.actions = actions;
        this.current = null;
        this.onKey = null;
        const fit = () => root.style.setProperty('--lk', lobbyScale(window.innerWidth, window.innerHeight).toFixed(3));
        fit();
        window.addEventListener('resize', fit);
        // 로비 화면의 방향키·Esc. 여기서 쓴 키는 카메라 이동으로 넘기지 않는다.
        document.addEventListener('keydown', (e) => {
            if (this.onKey && this.current && !e.repeat && this.onKey(e) !== false) {
                e.preventDefault();
                e.stopPropagation();
            }
        });
    }

    clear() {
        this.onKey = null;
        if (this.current) {
            const el = this.current;
            el.classList.remove('show');
            setTimeout(() => el.remove(), 450);
            this.current = null;
        }
    }

    mount(el, onKey = null) {
        this.clear();
        this.root.appendChild(el);
        this.current = el;
        this.onKey = onKey;
        requestAnimationFrame(() => el.classList.add('show'));
        el.querySelector('button')?.focus({ preventScroll: true });
        return el;
    }

    /** summary: { stars, maxStars, heroCleared, bestWave, hasProgress } */
    title(summary) {
        const items = [
            ['select', '전투 개시', summary.hasProgress ? '이어서 도전하기' : '마지막 빛을 지켜라'],
            ['settings', '설정', '그래픽 · 소리 · 화면 흔들림']
        ];
        const el = h(`<div class="screen title lobby">
            <div class="title-shade"></div>
            <div class="title-left">
                <div class="kicker"><span>에테르 보루</span><i></i><span>AETHER BASTION</span></div>
                <h1 class="logo" aria-label="LAST LIGHT"><span class="w1">LAST</span><span class="w2">L<span class="lit">I</span>GHT</span></h1>
                <p class="tagline">하늘에 떠 있는 마지막 보루. 균열이 열리면 밤이 온다.</p>
                <nav class="tmenu">${items
                    .map(
                        ([go, label, sub]) =>
                            `<button class="titem" data-go="${go}"><span class="lbl">${label}<small>${sub}</small></span></button>`
                    )
                    .join('')}</nav>
            </div>
            ${
                summary.hasProgress
                    ? `<div class="title-record">
                <div class="rec-row"><span class="k">별</span><span class="v">${summary.stars}<em>/${summary.maxStars}</em></span></div>
                <div class="rec-row"><span class="k">영웅 정복</span><span class="v">${summary.heroCleared}<em>/${summary.maxStars / 3}</em></span></div>
                <div class="rec-row"><span class="k">끝없는 밤</span><span class="v">${summary.bestWave || '—'}<em>${summary.bestWave ? ' 웨이브' : ''}</em></span></div>
            </div>`
                    : ''
            }
            <div class="title-foot"><span>소켓 클릭 · 건설</span><span>드래그 · 시점</span><span>Space · 웨이브</span><span>Q W · 스킬</span><span class="ver">v2.1</span></div>
        </div>`);
        const btns = [...el.querySelectorAll('.titem')];
        btns.forEach((btn) => {
            btn.onclick = () => (btn.dataset.go === 'select' ? this.actions.toSelect() : this.actions.openSettings());
            btn.onmouseenter = () => btn.focus({ preventScroll: true });
        });
        return this.mount(el, (e) => {
            if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return false;
            const i = btns.indexOf(document.activeElement);
            btns[(i + (e.key === 'ArrowDown' ? 1 : btns.length - 1)) % btns.length].focus({ preventScroll: true });
        });
    }

    /** 선택 화면 진입: 전투·끝없는 밤은 전장 목록으로, 그 밖에는 놀이 방식 화면 (그 카드에 초점) */
    select(save, modeId = null, mapId = null) {
        if (LOBBY[modeId]?.soon) modeId = null;
        return modeId === 'campaign' || modeId === 'endless'
            ? this.fields(save, modeId, mapId)
            : this.modes(save, modeId);
    }

    /** 1단계: 놀이 방식 다섯 장 */
    modes(save, focusId = null) {
        const cards = LOBBY_MODES.map((m) => {
            const map = m.map && MAPS[m.map];
            const meta = map
                ? dots(map.name === m.name ? mapMeta(map) : map.name, lengthOf(map))
                : `전장 ${FIELD_MAPS.length}곳 · ${lengthOf(FIELD_MAPS[0], m.id === 'endless')}`;
            return `<button class="mode-card${m.soon ? ' is-soon' : ''}" data-mode="${m.id}"${m.soon ? ' disabled' : ''}>
                <span class="mc-img" style="background-image:${thumbBg(m.map || m.thumb)}"></span>
                ${m.soon ? '<span class="lb-beta lb-soon">준비 중</span>' : m.beta ? '<span class="lb-beta">베타</span>' : ''}
                <span class="mc-body">
                    <span class="mc-name">${m.name}</span>
                    <span class="mc-rule">${m.rule}</span>
                    <span class="mc-meta">${meta}</span>
                    ${m.soon ? '' : `<span class="mc-rec"><span class="k">내 기록</span>${recordHtml(m, modeRecord(save, m))}</span>`}
                </span>
            </button>`;
        }).join('');
        const el = h(`<div class="screen lobby lb-screen">
            <div class="lb-wrap">
                <header class="lb-head">
                    <button class="lb-back" data-back>${ICONS.back}타이틀</button>
                    <h2>놀이 방식</h2>
                </header>
                <div class="modes">${cards}</div>
                ${keyHints([
                    [['←', '→'], '고르기'],
                    [['Enter'], '선택'],
                    [['Esc'], '뒤로']
                ])}
            </div>
        </div>`);
        const list = [...el.querySelectorAll('.mode-card:not(:disabled)')];
        let sheet = null;
        const choose = (id) => {
            const m = LOBBY[id];
            this.actions.setPref('lastMode', id);
            this.actions.setPref('lastEndless', id === 'endless');
            if (m.map) sheet = this.sheet(el, save, m, () => (sheet = null));
            else this.fields(save, id);
        };
        list.forEach((b) => {
            b.onclick = () => choose(b.dataset.mode);
            hoverFocus(b, () => !sheet);
        });
        el.querySelector('[data-back]').onclick = () => this.actions.toTitle();
        this.mount(el, (e) => {
            if (sheet) return sheet.onKey(e);
            if (e.key === 'Escape') return this.actions.toTitle();
            if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') return void moveFocus(list, document.activeElement, -1);
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') return void moveFocus(list, document.activeElement, 1);
            return false;
        });
        const want = focusId || lastLobbyMode(save);
        (list.find((b) => b.dataset.mode === want) || list[0]).focus({ preventScroll: true });
        return el;
    }

    /** 전장이 하나인 놀이 방식: 카드 위에 난이도만 고르는 작은 패널 */
    sheet(host, save, mode, onClose) {
        const map = MAPS[mode.map];
        let diff = DIFFICULTY[save.lastDifficulty] ? save.lastDifficulty : 'normal';
        const wrap = h(`<div class="lb-sheet-wrap">
            <div class="lb-sheet" role="dialog" aria-label="${mode.name}">
                <span class="sh-img" style="background-image:${thumbBg(map.id)}"></span>
                <div class="sh-body">
                    <h3>${mode.name}${mode.beta ? '<span class="lb-beta">베타</span>' : ''}</h3>
                    <div class="sh-meta">${dots(map.name !== mode.name && map.name, mapMeta(map), lengthOf(map))}</div>
                    <p class="sh-desc">${map.desc}</p>
                    <div class="sh-lbl">난이도</div>
                    ${diffSeg()}
                    <p class="sh-diff" data-desc></p>
                    <div class="sh-rec"><span class="k">이 난이도 기록</span><span data-rec></span></div>
                    <div class="sh-actions">
                        <button class="lb-start" data-start>${ICONS.play}시작</button>
                        <button class="lb-ghost" data-close>닫기</button>
                    </div>
                </div>
            </div>
        </div>`);
        const diffBtns = [...wrap.querySelectorAll('.lb-diff button')];
        const refresh = () => {
            diffBtns.forEach((b) => {
                b.classList.toggle('on', b.dataset.v === diff);
                b.setAttribute('aria-checked', String(b.dataset.v === diff));
            });
            wrap.querySelector('[data-desc]').textContent = diffDesc(diff, mode.id);
            const rec = recordOf(save, map.id, diff, 'siege');
            wrap.querySelector('[data-rec]').innerHTML = rec.stars
                ? `<span class="lb-stars">${starRow(rec.stars)}</span>`
                : '<span class="lb-none">아직 없음</span>';
        };
        const setDiff = (d) => {
            diff = d;
            this.actions.setPref('lastDifficulty', d);
            refresh();
        };
        const close = () => {
            wrap.classList.remove('show');
            setTimeout(() => wrap.remove(), 200);
            onClose();
            host.querySelector(`[data-mode="${mode.id}"]`)?.focus({ preventScroll: true });
        };
        const start = () => this.actions.startMap(map.id, { difficulty: diff, ...mode.run });
        diffBtns.forEach((b) => (b.onclick = () => setDiff(b.dataset.v)));
        wrap.querySelector('[data-start]').onclick = start;
        wrap.querySelector('[data-close]').onclick = close;
        // 패널 밖(어두운 곳)을 누르면 닫는다
        wrap.addEventListener('click', (e) => e.target === wrap && close());
        refresh();
        host.appendChild(wrap);
        requestAnimationFrame(() => wrap.classList.add('show'));
        wrap.querySelector('[data-start]').focus({ preventScroll: true });
        return {
            onKey: (e) => {
                if (e.key === 'Escape') return close();
                if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                    const i = DIFFICULTY_ORDER.indexOf(diff) + (e.key === 'ArrowLeft' ? -1 : 1);
                    if (DIFFICULTY_ORDER[i]) setDiff(DIFFICULTY_ORDER[i]);
                    return;
                }
                return false;
            }
        };
    }

    /** 2단계: 전투·끝없는 밤의 전장 여섯 곳과 난이도 */
    fields(save, modeId, focusMap = null) {
        const mode = LOBBY[modeId];
        const endless = modeId === 'endless';
        let diff = DIFFICULTY[save.lastDifficulty] ? save.lastDifficulty : 'normal';
        const cards = FIELD_MAPS.map(
            (m) => `<button class="field-card" data-map="${m.id}">
                <span class="fc-img" style="background-image:${thumbBg(m.id)}"><span class="crown" title="영웅 난이도 정복">${ICONS.crown}</span></span>
                <span class="fc-body">
                    <span class="fc-top"><span class="fc-name">${m.name}</span><span class="fc-pips" title="전장 난이도">${'<i class="on"></i>'.repeat(m.difficulty)}${'<i></i>'.repeat(3 - m.difficulty)}</span></span>
                    <span class="fc-desc">${m.desc}</span>
                    <span class="fc-meta"><span>${mapMeta(m)} · ${lengthOf(m, endless)}</span><span data-rec></span></span>
                </span>
            </button>`
        ).join('');
        const el = h(`<div class="screen lobby lb-screen${endless ? ' is-endless' : ''}">
            <div class="lb-wrap">
                <header class="lb-head">
                    <button class="lb-back" data-back>${ICONS.back}놀이 방식</button>
                    <h2>${mode.name}${mode.beta ? '<span class="lb-beta">베타</span>' : ''}<small>전장 선택</small></h2>
                </header>
                <div class="lb-diffrow"><span class="lb-lbl">난이도</span>${diffSeg()}<span class="lb-diffdesc" data-desc></span></div>
                <div class="fields">${cards}</div>
                ${keyHints([
                    [['←', '→', '↑', '↓'], '고르기'],
                    [['Enter'], '시작'],
                    [['Esc'], '뒤로']
                ])}
            </div>
        </div>`);
        const diffBtns = [...el.querySelectorAll('.lb-diff button')];
        const list = [...el.querySelectorAll('.field-card')];
        const refresh = () => {
            diffBtns.forEach((b) => {
                b.classList.toggle('on', b.dataset.v === diff);
                b.setAttribute('aria-checked', String(b.dataset.v === diff));
            });
            el.querySelector('[data-desc]').textContent = diffDesc(diff, modeId);
            for (const card of list) {
                const id = card.dataset.map;
                const rec = recordOf(save, id, diff);
                card.querySelector('[data-rec]').innerHTML = endless
                    ? `<span class="lb-best">${ICONS.moon}<b>${rec.best || '—'}</b>${rec.best ? ' 웨이브' : ''}</span>`
                    : `<span class="lb-stars">${starRow(rec.stars)}</span>`;
                card.classList.toggle('hero-cleared', recordOf(save, id, 'hero').stars > 0);
            }
        };
        const setDiff = (d) => {
            diff = d;
            this.actions.setPref('lastDifficulty', d);
            refresh();
        };
        diffBtns.forEach((b) => (b.onclick = () => setDiff(b.dataset.v)));
        list.forEach((b) => {
            b.onclick = () => this.actions.startMap(b.dataset.map, { difficulty: diff, ...mode.run });
            hoverFocus(b);
        });
        const back = () => this.modes(save, modeId);
        el.querySelector('[data-back]').onclick = back;
        refresh();
        // 한 줄에 놓인 카드 수 (창 폭에 따라 3장 또는 1장)
        const cols = () => list.filter((c) => c.offsetTop === list[0].offsetTop).length || 1;
        let lastCard = list[0];
        this.mount(el, (e) => {
            const at = document.activeElement;
            if (e.key === 'Escape') return back();
            const inDiff = diffBtns.includes(at);
            if (inDiff) {
                if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                    const b = moveFocus(diffBtns, at, e.key === 'ArrowLeft' ? -1 : 1);
                    return setDiff(b.dataset.v);
                }
                if (e.key === 'ArrowDown') return void lastCard.focus({ preventScroll: true });
                return false;
            }
            const i = list.indexOf(at);
            if (i < 0) return e.key.startsWith('Arrow') ? void lastCard.focus({ preventScroll: true }) : false;
            lastCard = at;
            const c = cols();
            if (e.key === 'ArrowLeft') return void (lastCard = moveFocus(list, at, -1));
            if (e.key === 'ArrowRight') return void (lastCard = moveFocus(list, at, 1));
            if (e.key === 'ArrowDown') return void (i + c < list.length && (lastCard = moveFocus(list, at, c)));
            if (e.key === 'ArrowUp') {
                if (i - c >= 0) return void (lastCard = moveFocus(list, at, -c));
                return void el.querySelector('.lb-diff button.on').focus({ preventScroll: true });
            }
            return false;
        });
        lastCard = list.find((c) => c.dataset.map === focusMap) || list[0];
        lastCard.focus({ preventScroll: true });
        return el;
    }

    pause() {
        const el = h(`<div class="screen dim"><div class="modal panel ornate">
            <h2>일시정지</h2>
            <div class="menu">
                <button class="menu-btn primary" data-a="resume">계속하기</button>
                <button class="menu-btn" data-a="restart">처음부터 다시</button>
                <button class="menu-btn" data-a="book">적 도감</button>
                <button class="menu-btn" data-a="settings">설정</button>
                <button class="menu-btn ghost" data-a="quit">전장 선택으로</button>
            </div></div></div>`);
        el.querySelector('[data-a=book]').onclick = () => this.actions.openBestiary(true);
        el.querySelector('[data-a=resume]').onclick = () => this.actions.resume();
        el.querySelector('[data-a=restart]').onclick = () => this.actions.restart();
        el.querySelector('[data-a=settings]').onclick = () => this.actions.openSettings(true);
        el.querySelector('[data-a=quit]').onclick = () => this.actions.toSelect({ back: true });
        return this.mount(el);
    }

    /** 적 도감: 만난 적만 자세히, 아직 못 만난 적은 실루엣 */
    bestiary(seen, fromPause) {
        const card = (d) => {
            const known = seen.includes(d.id);
            if (!known)
                return `<div class="beast unknown"><i class="ico">${ICONS[d.id]}</i><div class="nm">???</div><p>아직 마주치지 않은 적</p></div>`;
            const row = (k, v) => `<div><span>${k}</span><b>${v}</b></div>`;
            return `<div class="beast ${d.boss ? 'boss' : ''}">
                    <i class="ico">${ICONS[d.id]}</i>
                    <div class="nm">${d.name}</div>
                    <p>${d.desc}</p>
                    <div class="btraits">${enemyTraits(d)
                        .map((t) => `<span class="t ${t.kind}" title="${t.long}">${t.short}</span>`)
                        .join('')}</div>
                    <div class="bstats">
                        ${row('기본 체력', d.hp)}${row('속도', d.speed)}${row('물리 방어', Math.round(d.armor * 100) + '%')}
                        ${row('마법 저항', Math.round(d.resist * 100) + '%')}${row('처치 골드', d.bounty)}${row('돌파 시 생명', '-' + d.lives)}
                    </div>
                    <div class="btip"><b>공략</b> ${d.tip || ''}</div>
                </div>`;
        };
        const groups = [{ id: null, name: '그림자 군세', en: '모든 전장' }, ...Object.values(MAPS)].map((m) => {
            const list = Object.values(ENEMIES).filter((d) => (d.home || null) === m.id);
            if (!list.length) return '';
            const found = list.filter((d) => seen.includes(d.id)).length;
            return `<div class="bgroup"><div class="bhead"><b>${m.name}</b><span>${m.id ? '전용 군세' : m.en}</span><em>${found} / ${list.length}</em></div>
                <div class="beasts">${list.map(card).join('')}</div></div>`;
        });
        const cards = groups.join('');
        const el = h(`<div class="screen dim"><div class="bestiary-wrap">
            <h2>적 도감</h2>
            <div class="sub">${seen.length} / ${Object.keys(ENEMIES).length} 발견 · 체력은 웨이브마다 10.5%씩 늘어납니다 · 정예는 체력 3배</div>
            ${cards}
            <div class="back-row"><button class="menu-btn ghost" data-back>돌아가기</button></div>
        </div></div>`);
        el.querySelector('[data-back]').onclick = () => this.actions.closeBestiary(fromPause);
        return this.mount(el);
    }

    settings(settings, fromPause) {
        const seg = (key, opts) =>
            `<div class="seg" data-seg="${key}">${opts.map(([v, l]) => `<button data-v="${v}" class="${settings[key] === v ? 'on' : ''}">${l}</button>`).join('')}</div>`;
        const el = h(`<div class="screen dim"><div class="modal panel ornate" style="min-width:440px">
            <h2>설정</h2>
            <div class="settings-row"><span>그래픽 품질</span>${seg('quality', [
                ['high', '높음'],
                ['medium', '보통'],
                ['low', '낮음']
            ])}</div>
            <div class="settings-row"><span>소리</span>${seg('sound', [
                [true, '켜기'],
                [false, '끄기']
            ])}</div>
            <div class="settings-row"><span>화면 흔들림</span>${seg('shake', [
                [true, '켜기'],
                [false, '끄기']
            ])}</div>
            <p style="font-size:12px;color:var(--muted);margin:12px 0 0">그래픽 품질은 그림자·파티클 수까지 바꾸려면 다음 전투부터 완전히 적용됩니다.</p>
            <div class="menu"><button class="menu-btn primary" data-close>확인</button></div>
        </div></div>`);
        el.querySelectorAll('[data-seg]').forEach((segEl) => {
            segEl.querySelectorAll('button').forEach((b) => {
                b.onclick = () => {
                    const key = segEl.dataset.seg;
                    const raw = b.dataset.v;
                    const v = raw === 'true' ? true : raw === 'false' ? false : raw;
                    segEl.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
                    this.actions.setSetting(key, v);
                };
            });
        });
        el.querySelector('[data-close]').onclick = () => this.actions.closeSettings(fromPause);
        return this.mount(el);
    }

    results({ won, stars, state, record, newBest, survived }) {
        const secs = Math.round(state.time);
        const time = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
        const diff = DIFFICULTY[state.difficulty];
        const endless = state.endless;
        const sv = state.survival;
        const title = endless ? '밤이 끝났다' : won ? (sv ? '동이 텄다' : '승리') : '패배';
        const R = state.rtd;
        const sub = endless
            ? `끝없는 밤에서 ${survived} 웨이브를 버텨 냈다`
            : R
              ? won
                  ? `마지막 보스를 쓰러뜨렸다 · 필드 최대 ${R.peak}마리`
                  : R.lostBy === 'boss'
                    ? `웨이브 ${state.waveIndex} 보스를 제한 시간 안에 잡지 못했다`
                    : `웨이브 ${state.waveIndex}에서 필드가 ${R.limit}마리를 넘었다`
              : sv
                ? won
                    ? '기나긴 밤을 짓고, 캐고, 고치며 버텨 냈다'
                    : `동트기 ${formatClock(sv.dawn - sv.clock)} 전, 본진이 무너졌다`
                : won
                  ? '마지막 빛이 지켜졌다'
                  : `웨이브 ${state.waveIndex}에서 마지막 빛이 꺼졌다`;
        // 살아남기는 동이 트면 끝난다 (끝없는 밤으로 잇지 않는다)
        const offerEndless = won && !endless && !sv && !R && !LOBBY.endless?.soon;
        const el = h(`<div class="screen dim"><div class="modal panel ornate results" style="min-width:520px">
            <div class="diff-badge d-${diff.id}">${diff.id === 'hero' ? ICONS.crown : ''}${diff.name}${endless ? ' · 끝없는 밤' : ''}${state.siege ? ' · 공성전' : ''}${state.map.genre ? ' · ' + GENRES[state.map.genre].label : ''}</div>
            <h2 style="margin-bottom:6px;${won || endless ? '' : 'color:#ffb0b0'}">${title}</h2>
            <div style="color:var(--muted);font-size:14px">${sub}</div>
            ${
                endless
                    ? `<div class="result-best ${newBest ? 'new' : ''}"><b>${survived}</b><span>${newBest ? '새 최고 기록!' : `최고 기록 ${record.best} 웨이브`}</span></div>`
                    : won
                      ? `<div class="result-stars">${starRow(stars)}</div>`
                      : '<div style="height:20px"></div>'
            }
            <div class="result-grid">
                <div class="stat"><b>${state.stats.kills}</b><span>처치</span></div>
                ${
                    R
                        ? `<div class="stat"><b>${R.peak}/${R.limit}</b><span>필드 최대</span></div>`
                        : `<div class="stat"><b>${Math.ceil(state.lives)}/${state.maxLives}</b><span>${sv ? '본진 체력' : '남은 생명'}</span></div>`
                }
                <div class="stat"><b>${state.stats.goldEarned + state.stats.earlyBonus}</b><span>획득 골드</span></div>
                ${sv ? '' : `<div class="stat"><b>${time}</b><span>전투 시간</span></div>`}
                ${
                    R
                        ? `<div class="stat"><b>${R.summons}</b><span>소환</span></div><div class="stat"><b>${R.merges}</b><span>합성</span></div><div class="stat"><b>${R.myths}</b><span>신화</span></div>`
                        : state.siege
                          ? `<div class="stat"><b>${state.stats.lost || 0}</b><span>${sv ? '무너진 건물' : '무너진 타워'}</span></div>${state.hero ? `<div class="stat"><b>Lv ${state.hero.level}</b><span>영웅 레벨</span></div>` : ''}${sv ? `<div class="stat"><b>${formatClock(sv.clock)}</b><span>버틴 시간</span></div><div class="stat"><b>${state.stats.mined || 0}</b><span>캔 골드</span></div>` : ''}${state.gates.length ? `<div class="stat"><b>${state.stats.gatesLost || 0}</b><span>무너진 성문</span></div>` : ''}`
                          : ''
                }
            </div>
            ${offerEndless ? `<div style="margin-top:12px;font-size:12px;color:var(--muted)">${diff.name} 최고 기록 · 별 ${record.stars}개</div>` : ''}
            <div class="menu">
                ${offerEndless ? `<button class="menu-btn primary endless-go" data-a="endless">끝없는 밤으로 계속<small>21 웨이브부터 끝없이 · 최고 기록 도전</small></button>` : ''}
                <button class="menu-btn ${offerEndless ? '' : 'primary'}" data-a="restart">${won ? '다시 도전' : '다시 싸운다'}</button>
                <button class="menu-btn ghost" data-a="select">전장 선택</button>
            </div></div></div>`);
        el.querySelector('[data-a=endless]')?.addEventListener('click', () => this.actions.continueEndless());
        el.querySelector('[data-a=restart]').onclick = () => this.actions.restart();
        el.querySelector('[data-a=select]').onclick = () => this.actions.toSelect({ back: true });
        this.mount(el);
        el.querySelectorAll('.result-stars i').forEach((s, i) =>
            setTimeout(() => s.classList.add('pop'), 400 + i * 280)
        );
        return el;
    }
}

const COACH = [
    {
        text: '빛나는 룬이 새겨진 <b>빈 소켓</b>을 눌러 첫 타워를 세우세요. 숫자키 1~7로도 고를 수 있어요.',
        until: (s) => s.towers.length > 0
    },
    {
        text: '준비가 되면 오른쪽 아래 <b>전투 개시</b> 또는 포털 위 해골을 눌러 첫 웨이브를 부르세요. (Space)',
        until: (s) => s.waveIndex > 0
    },
    {
        text: '보라색 <b>레이 라인</b>으로 이어진 소켓에 <b>서로 다른 타워</b>를 세우면 공명 버프가 생깁니다. 타워를 누르면 아래 패널과 화살표로 받는·주는 효과가 보여요.',
        until: (s) => s.towers.some((t) => t.tier > 1) || s.waveIndex >= 3
    },
    {
        text: '위기엔 왼쪽 아래 <b>스킬</b>을 쓰세요. Q는 유성 낙하, W는 빙결 파동입니다.',
        until: (s) => s.skills.meteor.cd > 0 || s.skills.freeze.cd > 0 || s.waveIndex >= 5
    }
];

export class Coach {
    constructor(root, onDone) {
        this.onDone = onDone;
        this.i = 0;
        this.el = h(
            `<div class="coach panel ornate interactive"><span class="step"></span><span class="text"></span><button class="skip">안내 끄기</button></div>`
        );
        root.appendChild(this.el);
        this.el.querySelector('.skip').onclick = () => this.finish();
        this.render();
    }

    render() {
        const step = COACH[this.i];
        this.el.querySelector('.step').textContent = String(this.i + 1);
        this.el.querySelector('.text').innerHTML = step.text;
    }

    update(state) {
        if (!this.el) return;
        if (COACH[this.i].until(state)) {
            this.i++;
            if (this.i >= COACH.length) this.finish();
            else this.render();
        }
    }

    finish() {
        this.el?.remove();
        this.el = null;
        this.onDone();
    }

    destroy() {
        this.el?.remove();
        this.el = null;
    }
}
