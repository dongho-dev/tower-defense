// 인게임 HUD: 자원, 속도·일시정지, 스킬, 웨이브 호출, 배너, 토스트, 힌트, 보스 체력, 포털 마커.
import { ICONS } from './icons.js';
import { SKILLS, canCallWave, EARLY_BONUS_PER_SEC, WAVE_GAP } from '../core/game.js';
import { ENEMIES } from '../core/data/enemies.js';
import { waveSummary } from '../core/data/waves.js';

const h = (html) => {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
};

export class Hud {
    constructor(root, actions) {
        this.actions = actions;
        this.el = h(`<div class="hud"></div>`);
        root.appendChild(this.el);
        this.el.innerHTML = `
        <div class="resources">
            <div class="res life panel ornate" title="마지막 빛의 내구도"><i class="ico">${ICONS.life}</i><div><div class="val num" data-life>20</div><div class="lbl">생명</div></div><span class="delta" data-life-delta></span></div>
            <div class="res gold panel" title="골드"><i class="ico">${ICONS.gold}</i><div><div class="val num" data-gold>0</div><div class="lbl">골드</div></div><span class="delta" data-gold-delta></span></div>
            <div class="res wave panel" title="웨이브"><i class="ico">${ICONS.wave}</i><div><div class="val num" data-wave>0/20</div><div class="lbl">웨이브</div></div></div>
        </div>
        <div class="controls panel">
            <button class="icon-btn" data-speed title="배속 (F)" aria-label="배속 전환">${ICONS.play}</button>
            <button class="icon-btn" data-pause title="일시정지 (Esc)" aria-label="일시정지">${ICONS.pause}</button>
            <button class="icon-btn" data-sound title="소리" aria-label="소리 켜기/끄기">${ICONS.sound}</button>
            <button class="icon-btn" data-settings title="설정" aria-label="설정">${ICONS.gear}</button>
        </div>
        <div class="skills">
            ${Object.values(SKILLS)
                .map(
                    (s) => `<button class="skill ${s.id}" data-skill="${s.id}" aria-label="${s.name}">
                    <i class="ico">${ICONS[s.id]}</i><span class="sweep"></span><span class="cdtext"></span><span class="key">${s.hotkey}</span><span class="name">${s.name}</span></button>`
                )
                .join('')}
        </div>
        <button class="wave-call panel ornate" data-wave-call aria-label="다음 웨이브 호출">
            <div class="ring"><div class="core">${ICONS.skull}</div></div>
            <div><div class="title" data-wc-title>첫 웨이브</div><div class="sub" data-wc-sub>준비되면 호출하세요 · Space</div><div class="preview" data-wc-preview></div></div>
        </button>
        <div class="banner" data-banner><div class="big" data-banner-big></div><div class="rule"></div><div class="sub" data-banner-sub></div></div>
        <div class="toasts" data-toasts></div>
        <div class="hint-box panel" data-hint></div>
        <div class="boss-bar" data-boss><div class="label">공허의 거상</div><div class="track"><div class="fill" data-boss-fill></div></div></div>
        <div class="portal-marker" data-marker><button title="웨이브 호출 (Space)" aria-label="포털에서 웨이브 호출">${ICONS.skull}</button><div class="bonus" data-marker-bonus></div></div>
        <div class="vignette-hit" data-vig></div>`;
        const q = (s) => this.el.querySelector(s);
        this.$ = {
            life: q('[data-life]'),
            lifeBox: q('.res.life'),
            lifeDelta: q('[data-life-delta]'),
            gold: q('[data-gold]'),
            goldDelta: q('[data-gold-delta]'),
            wave: q('[data-wave]'),
            speed: q('[data-speed]'),
            pause: q('[data-pause]'),
            sound: q('[data-sound]'),
            settings: q('[data-settings]'),
            waveCall: q('[data-wave-call]'),
            wcTitle: q('[data-wc-title]'),
            wcSub: q('[data-wc-sub]'),
            wcPreview: q('[data-wc-preview]'),
            banner: q('[data-banner]'),
            bannerBig: q('[data-banner-big]'),
            bannerSub: q('[data-banner-sub]'),
            toasts: q('[data-toasts]'),
            hint: q('[data-hint]'),
            boss: q('[data-boss]'),
            bossFill: q('[data-boss-fill]'),
            marker: q('[data-marker]'),
            markerBonus: q('[data-marker-bonus]'),
            vig: q('[data-vig]')
        };
        this.skills = {};
        for (const btn of this.el.querySelectorAll('[data-skill]')) {
            this.skills[btn.dataset.skill] = {
                btn,
                sweep: btn.querySelector('.sweep'),
                text: btn.querySelector('.cdtext')
            };
            btn.addEventListener('click', () => actions.castSkill(btn.dataset.skill));
        }
        this.$.waveCall.addEventListener('click', () => actions.callWave());
        this.$.marker.querySelector('button').addEventListener('click', () => actions.callWave());
        this.$.speed.addEventListener('click', () => actions.toggleSpeed());
        this.$.pause.addEventListener('click', () => actions.pause());
        this.$.sound.addEventListener('click', () => actions.toggleSound());
        this.$.settings.addEventListener('click', () => actions.openSettings());
        this.last = {};
        this.previewWave = -1;
    }

    setVisible(v) {
        this.el.style.display = v ? '' : 'none';
    }

    set(key, value, apply) {
        if (this.last[key] === value) return;
        this.last[key] = value;
        apply(value);
    }

    pop(el, text, color) {
        el.textContent = text;
        el.style.color = color;
        el.classList.remove('show');
        void el.offsetWidth;
        el.classList.add('show');
    }

    update(state, loop, project, sound) {
        const prevGold = this.last.gold;
        this.set('gold', state.gold, (v) => {
            this.$.gold.textContent = v;
            if (prevGold != null && v - prevGold >= 40) this.pop(this.$.goldDelta, '+' + (v - prevGold), '#ffd66e');
        });
        this.set('life', state.lives, (v) => {
            this.$.life.textContent = v;
            this.$.lifeBox.classList.toggle('low', v <= 5);
        });
        this.set('wave', state.waveIndex, (v) => (this.$.wave.textContent = `${v}/${state.waves.length}`));
        this.set('speed', loop.speed, (v) => {
            this.$.speed.innerHTML = v > 1 ? ICONS.fast : ICONS.play;
            this.$.speed.classList.toggle('on', v > 1);
        });
        this.set('sound', sound, (v) => (this.$.sound.innerHTML = v ? ICONS.sound : ICONS.mute));

        // 스킬
        for (const [id, s] of Object.entries(this.skills)) {
            const cd = state.skills[id].cd;
            const max = SKILLS[id].cooldown;
            const locked = state.waveIndex === 0;
            const ready = cd <= 0 && !locked;
            s.sweep.style.setProperty('--cd', locked ? 1 : cd / max);
            this.set('skilltext' + id, locked ? '—' : cd > 0 ? Math.ceil(cd) : '', (v) => (s.text.textContent = v));
            s.btn.classList.toggle('ready', ready && this.armed !== id);
            s.btn.classList.toggle('cooling', !ready);
            s.btn.classList.toggle('armed', this.armed === id);
        }

        // 웨이브 호출
        const can = canCallWave(state);
        const next = state.waves[state.waveIndex];
        const wc = this.$.waveCall;
        wc.disabled = !can;
        let p = 1;
        if (state.waveIndex === 0) {
            this.set('wcTitle', 'first', () => (this.$.wcTitle.textContent = '전투 개시'));
            this.set('wcSub', 'first', () => (this.$.wcSub.innerHTML = '첫 웨이브를 부릅니다 · <b>Space</b>'));
        } else if (!next) {
            this.set('wcTitle', 'last', () => (this.$.wcTitle.textContent = '최후의 웨이브'));
            this.set('wcSub', 'last', () => (this.$.wcSub.textContent = '남은 적을 모두 막아내세요'));
        } else if (state.nextWaveIn != null) {
            p = 1 - state.nextWaveIn / WAVE_GAP;
            const bonus = Math.floor(state.nextWaveIn * EARLY_BONUS_PER_SEC);
            this.set(
                'wcTitle',
                'next' + state.waveIndex,
                () => (this.$.wcTitle.textContent = `웨이브 ${state.waveIndex + 1}`)
            );
            this.set('wcSub', 'cd' + Math.ceil(state.nextWaveIn) + '|' + bonus, () => {
                this.$.wcSub.innerHTML = `${Math.ceil(state.nextWaveIn)}초 후 · 지금 부르면 <span class="bonus">+${bonus}</span>`;
            });
        } else {
            this.set(
                'wcTitle',
                'busy' + state.waveIndex,
                () => (this.$.wcTitle.textContent = `웨이브 ${state.waveIndex}`)
            );
            this.set('wcSub', 'busy', () => (this.$.wcSub.textContent = '적 병력이 몰려오는 중'));
        }
        wc.style.setProperty('--p', p);
        wc.classList.toggle('urgent', state.nextWaveIn != null && state.nextWaveIn < 5);
        const previewIndex = next ? state.waveIndex : -1;
        if (previewIndex !== this.previewWave) {
            this.previewWave = previewIndex;
            this.$.wcPreview.innerHTML = next
                ? waveSummary(next)
                      .map(
                          (c) =>
                              `<span class="chip ${c.elite ? 'elite' : ''} ${ENEMIES[c.enemy].boss ? 'boss' : ''}" title="${ENEMIES[c.enemy].name}${c.elite ? ' (정예)' : ''}"><i>${ICONS[c.enemy]}</i>${c.count}</span>`
                      )
                      .join('')
                : '';
        }

        // 포털 마커
        const pg = project.portal();
        const showMarker = can && next && !pg.behind;
        this.$.marker.style.display = showMarker ? '' : 'none';
        if (showMarker) {
            this.$.marker.style.transform = `translate(${pg.x}px, ${pg.y}px)`;
            const bonus = state.nextWaveIn != null ? Math.floor(state.nextWaveIn * EARLY_BONUS_PER_SEC) : 0;
            this.set('markerBonus', bonus, (v) => (this.$.markerBonus.textContent = v > 0 ? `+${v}` : ''));
        }

        // 보스 체력
        const boss = state.enemies.find((e) => e.def.boss);
        this.$.boss.classList.toggle('show', !!boss);
        if (boss) this.$.bossFill.style.width = `${Math.max(0, (boss.hp / boss.maxHp) * 100)}%`;
    }

    handle(events, state) {
        for (const ev of events) {
            if (ev.type === 'waveStart') {
                this.showBanner(
                    ev.boss ? '공허의 거상' : `WAVE ${ev.wave}`,
                    ev.boss
                        ? '균열의 주인이 깨어났다'
                        : ev.wave === state.waves.length
                          ? '최후의 웨이브'
                          : waveLine(state.waves[ev.wave - 1]),
                    ev.boss
                );
                if (ev.hint) this.showHint(ev.hint);
            } else if (ev.type === 'leak') {
                this.pop(this.$.lifeDelta, '-' + ev.lives, '#ff6a6a');
                this.$.vig.classList.add('on');
                clearTimeout(this.vigT);
                this.vigT = setTimeout(() => this.$.vig.classList.remove('on'), 160);
            }
        }
    }

    showBanner(big, sub, boss = false) {
        const b = this.$.banner;
        this.$.bannerBig.textContent = big;
        this.$.bannerSub.textContent = sub;
        b.classList.toggle('boss', boss);
        b.classList.remove('show');
        void b.offsetWidth;
        b.classList.add('show');
    }

    showHint(text, ms = 7000) {
        this.$.hint.innerHTML = `<b>전술 조언</b> · ${text}`;
        this.$.hint.classList.add('show');
        clearTimeout(this.hintT);
        this.hintT = setTimeout(() => this.$.hint.classList.remove('show'), ms);
    }

    toast(msg, bad = false) {
        const t = h(`<div class="toast panel ${bad ? 'bad' : ''}"></div>`);
        t.textContent = msg;
        this.$.toasts.appendChild(t);
        setTimeout(() => t.remove(), 2700);
        while (this.$.toasts.children.length > 3) this.$.toasts.firstChild.remove();
    }
}

function waveLine(wave) {
    const parts = waveSummary(wave).map((c) => `${ENEMIES[c.enemy].name}${c.elite ? '(정예)' : ''} ${c.count}`);
    return parts.join(' · ');
}
