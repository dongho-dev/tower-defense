// 인게임 HUD: 자원, 속도·일시정지, 스킬, 웨이브 호출, 배너, 토스트, 힌트, 보스 체력, 포털 마커.
import { ICONS } from './icons.js';
import { SKILLS, canCallWave, EARLY_BONUS_PER_SEC, WAVE_GAP, HERO } from '../core/game.js';
import { ENEMIES, ELITE, hpScale, enemyTraits } from '../core/data/enemies.js';
import { waveSummary } from '../core/data/waves.js';
import { DIFFICULTY } from '../core/data/difficulty.js';

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
            <div class="res wave panel" title="웨이브"><i class="ico">${ICONS.wave}</i><div><div class="val num" data-wave>0/20</div><div class="lbl" data-wave-lbl>웨이브</div></div><div class="wave-prog"><i data-wave-prog></i></div></div>
            <div class="mode-tag" data-mode-tag></div>
        </div>
        <div class="controls panel">
            <button class="icon-btn" data-speed title="배속 (F)" aria-label="배속 전환">${ICONS.play}</button>
            <button class="icon-btn" data-pause title="일시정지 (Esc)" aria-label="일시정지">${ICONS.pause}</button>
            <button class="icon-btn" data-sound title="소리" aria-label="소리 켜기/끄기">${ICONS.sound}</button>
            <button class="icon-btn" data-book title="적 도감" aria-label="적 도감">${ICONS.book}</button>
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
        <div class="hero-card panel ornate" data-hero>
            <button class="portrait" data-hero-sel title="영웅 선택 (H)" aria-label="영웅 선택"><i class="ico">${ICONS.hero}</i><span class="lv" data-hero-lv>1</span><span class="dead" data-hero-dead></span></button>
            <div class="hbody">
                <div class="hname">${HERO.name}<small>H 선택 · 땅 클릭 이동</small></div>
                <div class="hbar hp"><i data-hero-hp></i></div>
                <div class="hbar xp"><i data-hero-xp></i></div>
            </div>
            <button class="hskill" data-hero-skill title="${HERO.skill.name} (E) · ${HERO.skill.desc}" aria-label="${HERO.skill.name}"><i class="ico">${ICONS.sword}</i><span class="sweep"></span><span class="cdtext"></span><span class="key">E</span></button>
        </div>
        <div class="wave-intel panel ornate" data-intel></div>
        <div class="enemy-intro panel ornate" data-intro></div>
        <div class="banner" data-banner><div class="big" data-banner-big></div><div class="rule"></div><div class="sub" data-banner-sub></div></div>
        <div class="toasts" data-toasts></div>
        <div class="hint-box panel" data-hint></div>
        <div class="boss-bar" data-boss><div class="label"><span data-boss-name>공허의 거상</span><span class="hp num" data-boss-hp></span></div><div class="track"><div class="lag" data-boss-lag></div><div class="fill" data-boss-fill></div><div class="ticks"></div></div></div>
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
            waveLbl: q('[data-wave-lbl]'),
            waveProg: q('[data-wave-prog]'),
            modeTag: q('[data-mode-tag]'),
            bossName: q('[data-boss-name]'),
            bossHp: q('[data-boss-hp]'),
            bossLag: q('[data-boss-lag]'),
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
            vig: q('[data-vig]'),
            intel: q('[data-intel]'),
            intro: q('[data-intro]'),
            hero: q('[data-hero]'),
            heroLv: q('[data-hero-lv]'),
            heroHp: q('[data-hero-hp]'),
            heroXp: q('[data-hero-xp]'),
            heroDead: q('[data-hero-dead]'),
            heroSkill: q('[data-hero-skill]')
        };
        this.$.hero.querySelector('[data-hero-sel]').addEventListener('click', () => actions.selectHero());
        this.$.heroSkill.addEventListener('click', () => actions.heroSkill());
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
        this.el.querySelector('[data-book]').addEventListener('click', () => actions.openBestiary());
        // 웨이브 호출 버튼에 마우스를 올리면 다음 웨이브 상세
        for (const el of [this.$.waveCall, this.$.marker]) {
            el.addEventListener('pointerenter', () => (this.intelHover = true));
            el.addEventListener('pointerleave', () => (this.intelHover = false));
        }
        this.last = {};
        this.previewWave = -1;
        this.goldShown = 0;
        this.bossLag = 1;
    }

    /** 새 판을 시작할 때: 캐시를 비우고 난이도·모드 표시를 맞춘다 */
    reset(state) {
        this.last = {};
        this.previewWave = -1;
        this.intelKey = null;
        this.goldShown = state.gold;
        this.bossLag = 1;
        this.waveTotal = 0;
        this.applyMode(state);
    }

    applyMode(state) {
        const d = DIFFICULTY[state.difficulty] || DIFFICULTY.normal;
        const tags = [];
        if (d.id !== 'normal')
            tags.push(`<span class="t d-${d.id}">${d.id === 'hero' ? ICONS.crown : ''}${d.name}</span>`);
        if (state.endless) tags.push(`<span class="t endless">${ICONS.moon}끝없는 밤</span>`);
        if (state.siege) tags.push(`<span class="t siege">${ICONS.shield}공성전</span>`);
        this.$.modeTag.innerHTML = tags.join('');
        this.$.hero.style.display = state.hero ? '' : 'none';
        this.el.classList.toggle('siege', !!state.siege);
        this.$.lifeBox.classList.toggle('hero', d.id === 'hero');
        this.el.classList.toggle('endless', !!state.endless);
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
            if (prevGold != null && v - prevGold >= 40) this.pop(this.$.goldDelta, '+' + (v - prevGold), '#ffd66e');
            if (prevGold == null || v < prevGold) {
                // 첫 표시와 지출은 즉시
                this.goldShown = v;
                this.$.gold.textContent = v;
            }
        });
        // 골드 수입은 숫자가 굴러 올라가게
        if (this.goldShown !== state.gold) {
            const diff = state.gold - this.goldShown;
            this.goldShown += Math.sign(diff) * Math.max(1, Math.ceil(Math.abs(diff) * 0.18));
            if (Math.abs(state.gold - this.goldShown) < 1) this.goldShown = state.gold;
            this.$.gold.textContent = this.goldShown;
        }
        this.set('life', state.lives, (v) => {
            this.$.life.textContent = v;
            this.$.lifeBox.classList.toggle('low', v <= 5);
        });
        this.set('wave', state.waveIndex + (state.endless ? 'e' : ''), () => {
            const v = state.waveIndex;
            this.$.wave.textContent = state.endless ? String(v) : `${v}/${state.waves.length}`;
            this.$.waveLbl.textContent = state.endless ? '끝없는 밤' : '웨이브';
            if (state.endless !== this.endlessShown) {
                this.endlessShown = state.endless;
                this.applyMode(state);
            }
        });
        // 이번 웨이브 진행도: 남은 적(스폰 대기 포함) 비율
        const pending = state.spawners.reduce((n, sp) => n + sp.group.count - sp.spawned, 0);
        const remain = pending + state.enemies.length;
        if (remain > (this.waveTotal || 0) || state.waveIndex !== this.waveTotalFor) {
            this.waveTotal = Math.max(remain, state.waveIndex !== this.waveTotalFor ? 0 : this.waveTotal);
            this.waveTotalFor = state.waveIndex;
        }
        const prog = this.waveTotal ? 1 - remain / this.waveTotal : 1;
        this.set('wprog', Math.round(prog * 100), (v) => (this.$.waveProg.style.width = v + '%'));
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
            if (ready && this.last['ready' + id] === false) {
                s.btn.classList.remove('flash');
                void s.btn.offsetWidth;
                s.btn.classList.add('flash');
            }
            this.last['ready' + id] = ready;
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
        } else if (!next && !state.endless) {
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

        this.updateIntel(state);

        // 보스 체력
        const bosses = state.enemies.filter((e) => e.def.boss);
        this.$.boss.classList.toggle('show', bosses.length > 0);
        if (bosses.length) {
            const hp = bosses.reduce((n, b) => n + Math.max(0, b.hp), 0);
            const max = bosses.reduce((n, b) => n + b.maxHp, 0);
            const r = hp / max;
            // 깎인 만큼 하얀 잔상이 천천히 따라온다
            this.bossLag = r > this.bossLag ? r : this.bossLag + (r - this.bossLag) * 0.04;
            this.$.bossFill.style.width = `${r * 100}%`;
            this.$.bossLag.style.width = `${this.bossLag * 100}%`;
            const names = [...new Set(bosses.map((b) => b.def.name))];
            this.set('bossName', names.join('|') + bosses.length, () => {
                this.$.bossName.textContent =
                    names.length > 1
                        ? names.join(' · ')
                        : bosses.length > 1
                          ? `${names[0]} ×${bosses.length}`
                          : names[0];
            });
            const shield = bosses.some((b) => b.shield > 0);
            const ward = bosses.some((b) => b.wardT > 0);
            this.set('bossFx', shield + '|' + ward, () => {
                this.$.boss.classList.toggle('shielded', shield);
                this.$.boss.classList.toggle('warded', ward);
            });
            this.set('bossHp', Math.ceil(hp), (v) => (this.$.bossHp.textContent = v.toLocaleString()));
        } else this.bossLag = 1;

        this.updateHero(state);
    }

    /** 영웅 카드: 체력·경험치·기술 쿨다운·부활 */
    updateHero(state) {
        const u = state.hero;
        if (!u) return;
        this.set('heroLv', u.level, (v) => {
            this.$.heroLv.textContent = v;
            if (this.last.heroLvSeen && v > this.last.heroLvSeen) {
                this.$.hero.classList.remove('lvup');
                void this.$.hero.offsetWidth;
                this.$.hero.classList.add('lvup');
            }
            this.last.heroLvSeen = v;
        });
        this.set('heroHp', Math.round((u.hp / u.maxHp) * 100), (v) => (this.$.heroHp.style.width = v + '%'));
        const maxed = u.level >= HERO.maxLevel;
        const xpK = maxed ? 1 : (u.xp % HERO.xpPerLevel) / HERO.xpPerLevel;
        this.set('heroXp', Math.round(xpK * 100), (v) => (this.$.heroXp.style.width = v + '%'));
        this.set('heroDead', u.dead ? Math.ceil(u.respawnT) : 0, (v) => {
            this.$.heroDead.textContent = v ? v : '';
            this.$.hero.classList.toggle('down', !!v);
        });
        const cd = u.skillCd;
        const ready = cd <= 0 && !u.dead;
        this.$.heroSkill.querySelector('.sweep').style.setProperty('--cd', u.dead ? 1 : cd / HERO.skill.cooldown);
        this.set('heroSkillT', u.dead ? '—' : cd > 0 ? Math.ceil(cd) : '', (v) => {
            this.$.heroSkill.querySelector('.cdtext').textContent = v;
        });
        this.$.heroSkill.classList.toggle('ready', ready);
        this.$.hero.classList.toggle('selected', !!this.heroSelected);
    }

    handle(events, state) {
        for (const ev of events) {
            if (ev.type === 'waveStart') {
                this.showBanner(
                    ev.boss ? ev.bossName || '공허의 거상' : `WAVE ${ev.wave}`,
                    ev.boss
                        ? '전장의 주인이 깨어났다'
                        : ev.wave === state.waves.length && !state.endless
                          ? '최후의 웨이브'
                          : waveLine(state.waves[ev.wave - 1]),
                    ev.boss
                );
                if (ev.hint) this.showHint(ev.hint);
            } else if (ev.type === 'towerDestroyed') {
                this.toast('타워가 무너졌습니다!', true);
            } else if (ev.type === 'heroLevel') {
                this.toast(`${HERO.name} 레벨 ${ev.level}!`);
            } else if (ev.type === 'unitDeath' && ev.kind === 'hero') {
                this.toast(`${HERO.name}가 쓰러졌습니다 · ${HERO.respawn}초 뒤 부활`, true);
            } else if (ev.type === 'leak') {
                this.pop(this.$.lifeDelta, '-' + ev.lives, '#ff6a6a');
                this.$.lifeBox.classList.remove('hit');
                void this.$.lifeBox.offsetWidth;
                this.$.lifeBox.classList.add('hit');
                this.$.vig.classList.add('on');
                clearTimeout(this.vigT);
                this.vigT = setTimeout(() => this.$.vig.classList.remove('on'), 160);
            }
        }
    }

    /** 다음(또는 진행 중) 웨이브의 적 구성: 이번 웨이브 기준 체력까지 계산해 보여 준다 */
    updateIntel(state) {
        const show = this.intelHover;
        this.$.intel.classList.toggle('show', !!show);
        if (!show) return;
        const idx = state.nextWaveIn != null || state.waveIndex === 0 ? state.waveIndex : state.waveIndex - 1;
        const wave = state.waves[idx];
        const key = idx + '|' + state.difficulty;
        if (!wave || this.intelKey === key) return;
        this.intelKey = key;
        const waveNo = idx + 1;
        const rows = waveSummary(wave)
            .map((c) => {
                const d = ENEMIES[c.enemy];
                const hp = Math.round(d.hp * hpScale(waveNo) * state.hpMul * (c.elite ? ELITE.hp : 1));
                const traits = enemyTraits(d)
                    .slice(0, 4)
                    .map(
                        (t) => `<span class="t ${t.kind === 'magic' ? '' : t.kind}" title="${t.long}">${t.short}</span>`
                    );
                return `<div class="irow ${c.elite ? 'elite' : ''} ${d.boss ? 'boss' : ''}">
                    <i class="ico">${ICONS[c.enemy]}</i>
                    <div class="nm"><b>${d.name}${c.elite ? ' · 정예' : ''}</b><span>${traits.join('')}</span></div>
                    <div class="n">×${c.count}</div>
                    <div class="hp"><b>${hp.toLocaleString()}</b><span>체력</span></div>
                </div>`;
            })
            .join('');
        const tips = [...new Set(waveSummary(wave).map((c) => c.enemy))]
            .filter((id) => ENEMIES[id].tip)
            .slice(0, 2)
            .map((id) => `<li><b>${ENEMIES[id].name}</b> · ${ENEMIES[id].tip}</li>`)
            .join('');
        this.$.intel.innerHTML = `<div class="ihead"><span>웨이브 ${waveNo}${state.endless && waveNo > 20 ? ' · 끝없는 밤' : ''}</span><small>총 ${waveSummary(wave).reduce((n, c) => n + c.count, 0)}마리</small></div>
            ${rows}
            ${tips ? `<ul class="itips">${tips}</ul>` : ''}`;
    }

    /** 처음 보는 적이 나오면 왼쪽에 소개 카드 */
    introEnemy(type) {
        const d = ENEMIES[type];
        const traits = enemyTraits(d)
            .filter((t) => t.kind !== 'info' || d.flying)
            .map((t) => t.long);
        this.$.intro.innerHTML = `<div class="ktag">${d.boss ? '보스 출현' : '새로운 적'}</div>
            <div class="ibody"><i class="ico">${ICONS[type]}</i><div><div class="nm">${d.name}</div><div class="tr">${traits.join(' · ') || '특별한 내성 없음'}</div></div></div>
            <p>${d.desc}</p>
            <div class="tip"><b>공략</b> ${d.tip || ''}</div>`;
        this.$.intro.classList.remove('show');
        void this.$.intro.offsetWidth;
        this.$.intro.classList.add('show');
        clearTimeout(this.introT);
        this.introT = setTimeout(() => this.$.intro.classList.remove('show'), 8000);
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
        if (bad) this.actions.deny?.();
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
