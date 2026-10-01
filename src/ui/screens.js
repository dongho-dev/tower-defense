// 전체 화면 UI: 타이틀, 맵 선택, 일시정지, 설정, 결과, 튜토리얼 안내.
import { ICONS } from './icons.js';
import { MAPS } from '../core/data/maps.js';
import { ENEMIES, enemyTraits } from '../core/data/enemies.js';
import { DIFFICULTY, DIFFICULTY_ORDER } from '../core/data/difficulty.js';
import { formatClock } from '../core/survival.js';

/** 저장 데이터에서 맵·난이도 기록 */
/** 기록 키: 공성전은 난이도별로 따로 */
export function recordKey(diff, mode) {
    return mode === 'siege' ? 'siege-' + diff : diff;
}

export function recordOf(save, mapId, diff, mode = 'campaign') {
    return save.records?.[mapId]?.[recordKey(diff, mode)] || { stars: 0, best: 0 };
}

const MODES = {
    campaign: { label: '전투 · 20 웨이브', desc: '' },
    endless: { label: '끝없는 밤', desc: '<b>끝없는 밤</b> · 웨이브가 끝없이 이어지고, 버틴 웨이브 수가 기록됩니다' },
    siege: {
        label: '공성전',
        desc: '<b>공성전</b> · 전용 전장에서 싸웁니다. 적은 지나가며 타워를 공격하니, 무너지기 전에 수리하세요.<br><b>디펜스</b> · 성문 앞에서 멈춘 적을 막고, 영웅을 움직여 위급한 문을 지킵니다 · <b>살아남기</b> · 길 없이 사방에서 몰려오는 적을 동이 틀 때까지 타워만으로 버팁니다<br><b>랜덤 디펜스</b> · 골드로 무작위 타워를 소환하고 같은 타워 셋을 합성해 등급을 올립니다. 필드에 적이 100마리를 넘으면 패배'
    }
};

/** 공성전 전용 맵의 장르 (스타 유즈맵처럼) */
export const GENRES = {
    defense: { label: '디펜스', icon: 'shield' },
    survival: { label: '살아남기', icon: 'moon' }
};

const genreBadge = (m) =>
    m.genre && GENRES[m.genre]
        ? `<span class="genre g-${m.genre}">${ICONS[GENRES[m.genre].icon]}${GENRES[m.genre].label}</span>`
        : '';

/** 맵 카드 아래 한 줄: 길 갈래·성문·사방 습격 */
function mapMeta(m) {
    if (m.rtd) return '랜덤 소환·합성 · ';
    if (m.survival) return '사방 습격 · ';
    if (m.gates) return `성문 ${m.gates.length}곳 · `;
    return m.paths.length > 1 ? `균열 ${m.paths.length}곳 · ` : '';
}

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
    nightfall: 'linear-gradient(160deg,#c8706a 0%,#2e2c62 50%,#03040e 100%)',
    fate: 'linear-gradient(160deg,#ffd2a0 0%,#5c7ec0 45%,#2f5a2a 100%)'
};

/** 공성전 모드에는 공성전 전용 맵만, 다른 모드에는 일반 맵만 보인다 */
export function mapsForMode(mode) {
    return Object.values(MAPS).filter((m) => !!m.siegeOnly === (mode === 'siege'));
}

export class Screens {
    constructor(root, actions) {
        this.root = root;
        this.actions = actions;
        this.current = null;
    }

    clear() {
        if (this.current) {
            const el = this.current;
            el.classList.remove('show');
            setTimeout(() => el.remove(), 450);
            this.current = null;
        }
    }

    mount(el) {
        this.clear();
        this.root.appendChild(el);
        this.current = el;
        requestAnimationFrame(() => el.classList.add('show'));
        el.querySelector('button')?.focus({ preventScroll: true });
        return el;
    }

    /** summary: { stars, maxStars, heroCleared, bestWave, hasProgress } */
    title(summary) {
        const items = [
            ['select', '전투 개시', summary.hasProgress ? '이어서 도전하기' : '마지막 빛을 지켜라'],
            [
                'endless',
                '끝없는 밤',
                summary.bestWave ? `최고 기록 ${summary.bestWave} 웨이브` : '빛이 꺼질 때까지 버텨라'
            ],
            ['settings', '설정', '그래픽 · 소리 · 화면 흔들림']
        ];
        const roman = ['I', 'II', 'III'];
        const el = h(`<div class="screen title">
            <div class="title-shade"></div>
            <div class="title-left">
                <div class="kicker"><span>에테르 보루</span><i></i><span>AETHER BASTION</span></div>
                <h1 class="logo" aria-label="LAST LIGHT"><span class="w1">LAST</span><span class="w2">L<span class="lit">I<b></b></span>GHT</span></h1>
                <p class="tagline">하늘에 떠 있는 마지막 보루. 균열이 열리면 밤이 온다.</p>
                <nav class="tmenu">${items
                    .map(
                        ([go, label, sub], i) =>
                            `<button class="titem" data-go="${go}"><span class="no">${roman[i]}</span><span class="lbl">${label}<small>${sub}</small></span></button>`
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
        const go = (where) =>
            where === 'select'
                ? this.actions.toSelect()
                : where === 'endless'
                  ? this.actions.toSelect({ endless: true })
                  : this.actions.openSettings();
        const btns = [...el.querySelectorAll('.titem')];
        btns.forEach((btn) => {
            btn.onclick = () => go(btn.dataset.go);
            btn.onmouseenter = () => btn.focus({ preventScroll: true });
        });
        el.addEventListener('keydown', (e) => {
            const i = btns.indexOf(document.activeElement);
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                const n = (i + (e.key === 'ArrowDown' ? 1 : btns.length - 1)) % btns.length;
                btns[n].focus({ preventScroll: true });
            }
        });
        return this.mount(el);
    }

    select(save, thumbs) {
        let diff = DIFFICULTY[save.lastDifficulty] ? save.lastDifficulty : 'normal';
        let mode = MODES[save.lastMode] ? save.lastMode : save.lastEndless ? 'endless' : 'campaign';
        const cards = Object.values(MAPS)
            .map((m) => {
                const bg = thumbs[m.id] ? `url(${thumbs[m.id]})` : THUMB_FALLBACK[m.theme || 'dusk'];
                return `<button class="map-card panel ornate" data-map="${m.id}">
                    <div class="thumb" data-thumb="${m.id}" style="background-image:${bg}"><span class="crown" title="영웅 난이도 정복">${ICONS.crown}</span>${genreBadge(m)}</div>
                    <div class="body"><div class="name">${m.name}</div><div class="en">${m.en}</div>
                    <div class="desc">${m.desc}</div>
                    <div class="meta"><span>${mapMeta(m)}<span data-len></span> · 난이도 ${'◆'.repeat(m.difficulty)}${'◇'.repeat(3 - m.difficulty)}</span><span class="rec" data-rec></span></div></div>
                </button>`;
            })
            .join('');
        const el = h(`<div class="screen dim"><div class="select-wrap">
            <h2>전장 선택</h2>
            <div class="select-opts">
                <div class="opt-group"><div class="opt-lbl">난이도</div><div class="seg big" data-diff>${DIFFICULTY_ORDER.map((d) => `<button data-v="${d}" class="d-${d}">${d === 'hero' ? ICONS.crown : ''}${DIFFICULTY[d].name}</button>`).join('')}</div></div>
                <div class="opt-group"><div class="opt-lbl">모드</div><div class="seg big" data-mode><button data-v="campaign">${MODES.campaign.label}</button><button data-v="endless" class="m-endless">${ICONS.moon}${MODES.endless.label}</button><button data-v="siege" class="m-siege">${ICONS.shield}${MODES.siege.label}</button></div></div>
            </div>
            <div class="opt-desc" data-opt-desc></div>
            <div class="maps">${cards}</div>
            <div class="back-row"><button class="menu-btn ghost" data-back>돌아가기</button></div>
        </div></div>`);
        const refresh = () => {
            el.querySelectorAll('[data-diff] button').forEach((b) => b.classList.toggle('on', b.dataset.v === diff));
            el.querySelectorAll('[data-mode] button').forEach((b) => b.classList.toggle('on', b.dataset.v === mode));
            const endless = mode === 'endless';
            el.querySelector('[data-opt-desc]').innerHTML =
                `<b>${DIFFICULTY[diff].name}</b> · ${DIFFICULTY[diff].desc}` +
                (MODES[mode].desc ? '<br>' + MODES[mode].desc : '');
            const shown = new Set(mapsForMode(mode).map((m) => m.id));
            for (const card of el.querySelectorAll('[data-map]')) {
                const id = card.dataset.map;
                card.hidden = !shown.has(id);
                const rec = recordOf(save, id, diff, mode);
                const sv = MAPS[id].survival;
                card.querySelector('[data-len]').textContent = endless
                    ? '∞ 웨이브'
                    : sv
                      ? `동틀 때까지 ${Math.round((sv.dawn || 600) / 60)}분`
                      : MAPS[id].rtd
                        ? '40 웨이브'
                        : '20 웨이브';
                card.querySelector('[data-rec]').innerHTML = endless
                    ? `<span class="best">${ICONS.moon}<b>${rec.best || '—'}</b>${rec.best ? ' 웨이브' : ''}</span>`
                    : `<span class="stars">${starRow(rec.stars)}</span>`;
                card.classList.toggle(
                    'hero-cleared',
                    recordOf(save, id, 'hero', mode === 'siege' ? mode : 'campaign').stars > 0
                );
                card.classList.toggle('endless', endless);
                card.classList.toggle('siege', mode === 'siege');
            }
        };
        el.querySelectorAll('[data-diff] button').forEach(
            (b) =>
                (b.onclick = () => {
                    diff = b.dataset.v;
                    this.actions.setPref('lastDifficulty', diff);
                    refresh();
                })
        );
        el.querySelectorAll('[data-mode] button').forEach(
            (b) =>
                (b.onclick = () => {
                    mode = b.dataset.v;
                    this.actions.setPref('lastMode', mode);
                    this.actions.setPref('lastEndless', mode === 'endless');
                    refresh();
                })
        );
        refresh();
        el.querySelectorAll('[data-map]').forEach(
            (b) =>
                (b.onclick = () =>
                    this.actions.startMap(b.dataset.map, {
                        difficulty: diff,
                        endless: mode === 'endless',
                        siege: mode === 'siege'
                    }))
        );
        el.querySelector('[data-back]').onclick = () => this.actions.toTitle();
        this.mount(el);
        el.querySelector('[data-map]:not([hidden])')?.focus({ preventScroll: true });
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
        el.querySelector('[data-a=quit]').onclick = () => this.actions.toSelect();
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
                    ? '기나긴 밤을 타워만으로 버텨 냈다'
                    : `동트기 ${formatClock(sv.dawn - sv.clock)} 전, 마지막 빛이 꺼졌다`
                : won
                  ? '마지막 빛이 지켜졌다'
                  : `웨이브 ${state.waveIndex}에서 마지막 빛이 꺼졌다`;
        // 살아남기는 동이 트면 끝난다 (끝없는 밤으로 잇지 않는다)
        const offerEndless = won && !endless && !sv && !R;
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
                        : `<div class="stat"><b>${state.lives}/${state.maxLives}</b><span>남은 생명</span></div>`
                }
                <div class="stat"><b>${state.stats.goldEarned + state.stats.earlyBonus}</b><span>획득 골드</span></div>
                <div class="stat"><b>${time}</b><span>전투 시간</span></div>
                ${
                    R
                        ? `<div class="stat"><b>${R.summons}</b><span>소환</span></div><div class="stat"><b>${R.merges}</b><span>합성</span></div><div class="stat"><b>${R.myths}</b><span>신화</span></div>`
                        : state.siege
                          ? `<div class="stat"><b>${state.stats.lost || 0}</b><span>무너진 타워</span></div>${state.hero ? `<div class="stat"><b>Lv ${state.hero.level}</b><span>영웅 레벨</span></div>` : ''}${sv ? `<div class="stat"><b>${formatClock(sv.clock)}</b><span>버틴 밤</span></div>` : ''}${state.gates.length ? `<div class="stat"><b>${state.stats.gatesLost || 0}</b><span>무너진 성문</span></div>` : ''}`
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
        el.querySelector('[data-a=select]').onclick = () => this.actions.toSelect();
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
