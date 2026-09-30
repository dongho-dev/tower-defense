// 전체 화면 UI: 타이틀, 맵 선택, 일시정지, 설정, 결과, 튜토리얼 안내.
import { ICONS } from './icons.js';
import { MAPS } from '../core/data/maps.js';

const h = (html) => {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
};

const UPCOMING = [
    {
        id: 'frostvale',
        name: '서리 협곡',
        en: 'Frostvale Gorge',
        desc: '두 갈래 길이 협곡 한가운데서 합류한다. 갈림목을 지키는 자가 이긴다.'
    },
    {
        id: 'voidspire',
        name: '공허의 첨탑',
        en: 'Voidspire',
        desc: '균열이 세 곳에서 열린다. 모든 방향을 동시에 지켜야 하는 최종 결전.'
    }
];

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

    title(hasProgress) {
        const el = h(`<div class="screen title">
            <div class="title-wrap">
                <h1 class="logo">LAST LIGHT</h1>
                <div class="logo-sub">에테르 보루</div>
                <div class="logo-rule"></div>
                <div class="menu">
                    <button class="menu-btn primary" data-go="select">전투 개시<small>${hasProgress ? '이어서 도전하기' : '마지막 빛을 지켜라'}</small></button>
                    <button class="menu-btn" data-go="settings">설정</button>
                </div>
            </div>
            <div class="foot-note">빈 소켓을 눌러 타워 건설 · 드래그/방향키 시점 이동 · 휠 확대 · Space 웨이브 호출 · Q/W 스킬</div>
        </div>`);
        el.querySelector('[data-go=select]').onclick = () => this.actions.toSelect();
        el.querySelector('[data-go=settings]').onclick = () => this.actions.openSettings();
        return this.mount(el);
    }

    select(save, thumb) {
        const cards = Object.values(MAPS)
            .map((m) => {
                const stars = save.stars[m.id] || 0;
                return `<button class="map-card panel ornate" data-map="${m.id}">
                    <div class="thumb" style="background-image:url(${thumb || ''})"></div>
                    <div class="body"><div class="name">${m.name}</div><div class="en">${m.en}</div>
                    <div class="desc">${m.desc}</div>
                    <div class="meta"><span>20 웨이브 · 난이도 ${'◆'.repeat(m.difficulty)}</span><span class="stars">${[1, 2, 3].map((i) => `<i class="${i <= stars ? 'on' : ''}">${ICONS.star}</i>`).join('')}</span></div></div>
                </button>`;
            })
            .join('');
        const locked = UPCOMING.map(
            (m) => `<div class="map-card panel locked" aria-disabled="true">
                <div class="thumb" style="background:linear-gradient(135deg,#2a2040,#120d1c)"></div>
                <div class="body"><div class="name">${m.name}</div><div class="en">${m.en}</div>
                <div class="desc">${m.desc}</div>
                <div class="meta"><span>준비 중</span><span class="stars"></span></div></div>
            </div>`
        ).join('');
        const el = h(`<div class="screen dim"><div class="select-wrap">
            <h2>전장 선택</h2>
            <div class="maps">${cards}${locked}</div>
            <div class="back-row"><button class="menu-btn ghost" data-back>돌아가기</button></div>
        </div></div>`);
        el.querySelectorAll('[data-map]').forEach((b) => (b.onclick = () => this.actions.startMap(b.dataset.map)));
        el.querySelector('[data-back]').onclick = () => this.actions.toTitle();
        return this.mount(el);
    }

    pause() {
        const el = h(`<div class="screen dim"><div class="modal panel ornate">
            <h2>일시정지</h2>
            <div class="menu">
                <button class="menu-btn primary" data-a="resume">계속하기</button>
                <button class="menu-btn" data-a="restart">처음부터 다시</button>
                <button class="menu-btn" data-a="settings">설정</button>
                <button class="menu-btn ghost" data-a="quit">전장 선택으로</button>
            </div></div></div>`);
        el.querySelector('[data-a=resume]').onclick = () => this.actions.resume();
        el.querySelector('[data-a=restart]').onclick = () => this.actions.restart();
        el.querySelector('[data-a=settings]').onclick = () => this.actions.openSettings(true);
        el.querySelector('[data-a=quit]').onclick = () => this.actions.toSelect();
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

    results({ won, stars, state, best }) {
        const secs = Math.round(state.time);
        const time = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
        const el = h(`<div class="screen dim"><div class="modal panel ornate" style="min-width:520px">
            <h2 style="margin-bottom:6px;${won ? '' : 'color:#ffb0b0'}">${won ? '승리' : '패배'}</h2>
            <div style="color:var(--muted);font-size:14px">${won ? '마지막 빛이 지켜졌다' : `웨이브 ${state.waveIndex}에서 마지막 빛이 꺼졌다`}</div>
            ${won ? `<div class="result-stars">${[1, 2, 3].map((i) => `<i class="${i <= stars ? 'on' : ''}">${ICONS.star}</i>`).join('')}</div>` : '<div style="height:20px"></div>'}
            <div class="result-grid">
                <div class="stat"><b>${state.stats.kills}</b><span>처치</span></div>
                <div class="stat"><b>${state.lives}/${state.maxLives}</b><span>남은 생명</span></div>
                <div class="stat"><b>${state.stats.goldEarned + state.stats.earlyBonus}</b><span>획득 골드</span></div>
                <div class="stat"><b>${time}</b><span>전투 시간</span></div>
            </div>
            ${won && best != null ? `<div style="margin-top:12px;font-size:12px;color:var(--muted)">최고 기록 · 별 ${best}개</div>` : ''}
            <div class="menu">
                <button class="menu-btn primary" data-a="restart">${won ? '다시 도전' : '다시 싸운다'}</button>
                <button class="menu-btn ghost" data-a="select">전장 선택</button>
            </div></div></div>`);
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
        text: '빛나는 룬이 새겨진 <b>빈 소켓</b>을 눌러 첫 타워를 세우세요. 숫자키 1~4로도 고를 수 있어요.',
        until: (s) => s.towers.length > 0
    },
    {
        text: '준비가 되면 오른쪽 아래 <b>전투 개시</b> 또는 포털 위 해골을 눌러 첫 웨이브를 부르세요. (Space)',
        until: (s) => s.waveIndex > 0
    },
    {
        text: '보라색 <b>레이 라인</b>으로 이어진 소켓에 <b>서로 다른 타워</b>를 세우면 공명 버프가 생깁니다. 타워를 눌러 업그레이드하세요.',
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
