// 앱 오케스트레이터: 화면 전환, 게임 루프, 입력, 저장, 설정.
import * as THREE from 'three';
import {
    createGame,
    step,
    drainEvents,
    buildTower,
    upgradeTower,
    sellTower,
    setTargeting,
    callWave,
    castSkill,
    findTower,
    starsFor,
    TICK,
    SKILLS
} from './core/game.js';
import { TOWER_ORDER, MAX_TIER } from './core/data/towers.js';
import { Renderer, QUALITY } from './render/Renderer.js';
import { CameraRig } from './render/CameraRig.js';
import { World } from './render/World.js';
import { EntityView } from './render/EntityView.js';
import { Effects } from './render/fx/Effects.js';
import { Overlay } from './ui/overlay.js';
import { Hud } from './ui/hud.js';
import { Radial } from './ui/radial.js';
import { Screens, Coach } from './ui/screens.js';
import { Audio } from './audio/audio.js';

const SAVE_KEY = 'lastlight.v2';

function loadSave() {
    const base = { stars: {}, settings: { quality: 'high', sound: true, shake: true }, tutorialDone: false };
    try {
        const raw = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
        if (raw) return { ...base, ...raw, settings: { ...base.settings, ...raw.settings } };
    } catch {
        /* 저장소를 못 쓰면 기본값 */
    }
    return base;
}

export class App {
    constructor() {
        this.save = loadSave();
        const params = new URLSearchParams(location.search);
        const q = params.get('q') || this.save.settings.quality;
        this.stageEl = document.getElementById('stage');
        this.uiRoot = document.getElementById('ui');
        this.renderer = new Renderer(this.stageEl, QUALITY[q] ? q : 'high');
        this.overlayCanvas = document.createElement('canvas');
        this.overlayCanvas.id = 'overlay';
        document.body.insertBefore(this.overlayCanvas, this.uiRoot);
        this.fade = document.createElement('div');
        this.fade.className = 'fade-black on';
        document.body.appendChild(this.fade);

        this.state = createGame(params.get('map') || 'dusk');
        this.buildWorld();
        this.audio = new Audio();
        this.audio.enabled = this.save.settings.sound;
        this.rig.shakeEnabled = this.save.settings.shake;

        this.loop = { speed: 1, paused: false };
        this.mode = 'title';
        this.pointer = { x: 0, y: 0, inside: false, dirty: true };
        this.hover = { socket: null, tower: null, enemy: null };
        this.targeting = null;
        this.pending = [];
        this.raycaster = new THREE.Raycaster();

        this.hud = new Hud(this.uiRoot, {
            callWave: () => this.callWave(),
            castSkill: (id) => this.useSkill(id),
            toggleSpeed: () => this.toggleSpeed(),
            pause: () => this.pause(),
            toggleSound: () => this.setSetting('sound', !this.save.settings.sound),
            openSettings: () => this.openSettings(true)
        });
        this.hud.setVisible(false);
        this.radial = new Radial(this.uiRoot, {
            build: (sid, type) => this.build(sid, type),
            upgrade: (id, br) => this.upgrade(id, br),
            sell: (id) => this.sell(id),
            target: (id, mode) => setTargeting(this.state, id, mode),
            preview: (opt) => this.world.showRange(opt),
            denied: (label) => this.hud.toast(`골드가 부족합니다 · ${label}`, true)
        });
        this.enemyCard = document.createElement('div');
        this.enemyCard.className = 'card panel';
        this.uiRoot.appendChild(this.enemyCard);
        this.screens = new Screens(this.uiRoot, {
            toSelect: () => this.toSelect(),
            toTitle: () => this.toTitle(),
            startMap: (id) => this.startMap(id),
            resume: () => this.resume(),
            restart: () => this.startMap(this.state.mapId),
            openSettings: (fromPause) => this.openSettings(fromPause),
            closeSettings: (fromPause) =>
                fromPause && this.mode === 'paused'
                    ? this.screens.pause()
                    : this.mode === 'title'
                      ? this.toTitle()
                      : this.resume(),
            setSetting: (k, v) => this.setSetting(k, v)
        });

        this.bindInput();
        window.addEventListener('resize', () => this.onResize());
        this.onResize();
        this.last = performance.now();
        this.t = 0;
        this.acc = 0;
        requestAnimationFrame((now) => this.frame(now));
        setTimeout(() => this.fade.classList.remove('on'), 150);

        if (params.has('demo')) this.devDemo(params);
        else if (params.has('play')) {
            this.startMap(params.get('map') || 'dusk');
            setTimeout(() => this.rig.skipIntro(), 500);
        } else this.toTitle();
        window.__game = this;
    }

    buildWorld() {
        if (this.world) {
            this.world.scene.traverse((o) => {
                o.geometry?.dispose?.();
            });
        }
        this.world = new World(this.renderer.renderer, this.state, this.renderer.quality);
        if (!this.rig) {
            this.rig = new CameraRig(this.state.map.island);
            this.rig.attach(this.renderer.renderer.domElement);
        }
        this.rig.bounds = this.state.map.island;
        this.renderer.buildComposer(this.world.scene, this.rig.camera);
        this.entities = new EntityView(this.world.scene, this.world);
        this.effects = new Effects(
            this.world.scene,
            this.rig.camera,
            this.rig,
            this.entities,
            this.world,
            this.renderer.quality
        );
        this.overlay = new Overlay(this.overlayCanvas, this.rig.camera, this.entities);
        this.worldMap = this.state.mapId;
    }

    persist() {
        try {
            localStorage.setItem(SAVE_KEY, JSON.stringify(this.save));
        } catch {
            /* 저장 불가 환경은 무시 */
        }
    }

    // ---------- 화면 흐름 ----------
    toTitle() {
        this.mode = 'title';
        this.hud.setVisible(false);
        this.closeMenus();
        this.coach?.destroy();
        this.rig.orbit = true;
        this.rig.goal.set(0, -2.5, 0);
        this.rig.goalDistance = 44;
        this.rig.setPitch(16);
        this.screens.title(Object.keys(this.save.stars).length > 0);
    }

    toSelect() {
        this.mode = 'select';
        this.hud.setVisible(false);
        this.closeMenus();
        this.coach?.destroy();
        this.rig.orbit = true;
        this.rig.setPitch(16);
        this.wantThumb = true;
        this.screens.select(this.save, this.thumb);
    }

    startMap(mapId) {
        this.fade.classList.add('on');
        setTimeout(() => {
            this.state = createGame(mapId);
            if (this.worldMap !== mapId) this.buildWorld();
            else {
                this.world.state = this.state;
                this.entities.reset();
                this.effects.reset();
            }
            this.mode = 'playing';
            this.loop.paused = false;
            this.loop.speed = 1;
            this.closeMenus();
            this.screens.clear();
            this.hud.setVisible(true);
            this.rig.orbit = false;
            this.rig.goalYaw = 0;
            this.rig.yaw = 0;
            this.rig.goalDistance = 34;
            this.rig.setPitch(52);
            this.rig.goal.y = 0;
            const s = this.state.paths[0];
            const from = new THREE.Vector3(s.xs[0] + 3, 0, s.zs[0]);
            this.rig.playIntro(from, new THREE.Vector3(0.5, 0, 0.6), 3.2);
            this.fade.classList.remove('on');
            this.hud.showBanner(this.state.map.name, '마지막 빛을 지켜라');
            this.coach?.destroy();
            this.coach = this.save.tutorialDone
                ? null
                : new Coach(this.uiRoot, () => {
                      this.save.tutorialDone = true;
                      this.persist();
                      this.coach = null;
                  });
            this.resultT = null;
        }, 450);
    }

    pause() {
        if (this.mode !== 'playing') return;
        this.mode = 'paused';
        this.closeMenus();
        this.screens.pause();
    }

    resume() {
        this.mode = 'playing';
        this.screens.clear();
    }

    openSettings(fromPause) {
        if (this.mode === 'playing') this.mode = 'paused';
        this.screens.settings(this.save.settings, fromPause);
    }

    setSetting(key, value) {
        this.save.settings[key] = value;
        this.persist();
        if (key === 'sound') this.audio.enabled = value;
        if (key === 'shake') this.rig.shakeEnabled = value;
        if (key === 'quality') {
            this.renderer.setQuality(value);
            this.effects.q = QUALITY[value].particles;
            this.onResize();
        }
    }

    showResults() {
        const won = this.state.status === 'won';
        const stars = won ? starsFor(this.state) : 0;
        if (won) {
            const prev = this.save.stars[this.state.mapId] || 0;
            this.save.stars[this.state.mapId] = Math.max(prev, stars);
            this.persist();
        }
        this.mode = 'results';
        this.closeMenus();
        this.coach?.destroy();
        this.screens.results({ won, stars, state: this.state, best: this.save.stars[this.state.mapId] });
        this.audio.play(won ? 'victory' : 'defeat');
    }

    // ---------- 명령 ----------
    build(socketId, type) {
        const r = buildTower(this.state, socketId, type);
        if (!r.ok) return this.hud.toast(r.reason, true);
        this.radial.close();
        this.selectTower(r.tower);
    }

    upgrade(id, branch) {
        const r = upgradeTower(this.state, id, branch);
        if (!r.ok) return this.hud.toast(r.reason, true);
        const t = findTower(this.state, id);
        if (t) this.selectTower(t);
    }

    sell(id) {
        const r = sellTower(this.state, id);
        if (r.ok) this.closeMenus();
    }

    callWave() {
        if (this.mode !== 'playing') return;
        const r = callWave(this.state);
        if (!r.ok) this.hud.toast(r.reason, true);
    }

    useSkill(id) {
        if (this.mode !== 'playing') return;
        const st = this.state.skills[id];
        if (this.state.waveIndex === 0) return this.hud.toast('첫 웨이브 이후에 쓸 수 있습니다.', true);
        if (st.cd > 0) return this.hud.toast(`${SKILLS[id].name} 재사용 대기 ${Math.ceil(st.cd)}초`, true);
        if (SKILLS[id].targeted) {
            this.closeMenus();
            this.targeting = id;
            this.hud.armed = id;
            this.hud.toast('유성을 떨어뜨릴 지점을 누르세요 · 우클릭 취소');
            return;
        }
        castSkill(this.state, id);
    }

    toggleSpeed() {
        this.loop.speed = this.loop.speed === 1 ? 2 : 1;
    }

    selectTower(tower) {
        this.selected = tower;
        this.radial.openTower(tower, this.state);
    }

    closeMenus() {
        this.radial.close();
        this.selected = null;
        this.targeting = null;
        this.hud.armed = null;
        this.world.showRange(null);
    }

    // ---------- 입력 ----------
    bindInput() {
        const dom = this.renderer.renderer.domElement;
        dom.addEventListener('pointermove', (e) => {
            this.pointer.x = e.clientX;
            this.pointer.y = e.clientY;
            this.pointer.inside = true;
            this.pointer.dirty = true;
        });
        dom.addEventListener('pointerleave', () => (this.pointer.inside = false));
        dom.addEventListener('click', (e) => this.onClick(e));
        dom.addEventListener('contextmenu', () => {
            if (this.mode === 'playing') this.closeMenus();
        });
        window.addEventListener('keydown', (e) => this.onKey(e));
    }

    ndc(x, y) {
        const r = this.renderer.renderer.domElement.getBoundingClientRect();
        return new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    }

    pick(x, y) {
        this.raycaster.setFromCamera(this.ndc(x, y), this.rig.camera);
        const targets = [...this.world.sockets.pickables];
        for (const v of this.entities.towers.values()) targets.push(v.root);
        const hits = this.raycaster.intersectObjects(targets, true);
        for (const hit of hits) {
            let o = hit.object;
            while (o) {
                if (o.userData.towerId != null) return { tower: findTower(this.state, o.userData.towerId) };
                if (o.userData.socketId != null) {
                    const s = this.state.sockets[o.userData.socketId];
                    if (s.towerId != null) return { tower: findTower(this.state, s.towerId) };
                    return { socket: s };
                }
                o = o.parent;
            }
        }
        // 적: 화면 거리 기준
        let best = null;
        let bestD = 30;
        for (const e of this.state.enemies) {
            const p = this.overlay.project(this.entities.enemyCenter(e));
            const d = Math.hypot(p.x - x, p.y - y);
            if (d < bestD) {
                bestD = d;
                best = e;
            }
        }
        if (best) return { enemy: best };
        return {};
    }

    groundPoint(x, y) {
        this.raycaster.setFromCamera(this.ndc(x, y), this.rig.camera);
        const hit = this.raycaster.intersectObjects(this.world.terrain.group.children, false)[0];
        return hit ? hit.point : null;
    }

    onClick(e) {
        if (this.rig.dragging || this.mode !== 'playing') return;
        this.audio.unlock();
        if (this.targeting) {
            const p = this.groundPoint(e.clientX, e.clientY);
            if (p) {
                const r = castSkill(this.state, this.targeting, p.x, p.z);
                if (!r.ok) this.hud.toast(r.reason, true);
            }
            this.targeting = null;
            this.hud.armed = null;
            return;
        }
        const hit = this.pick(e.clientX, e.clientY);
        if (hit.tower) {
            if (this.selected === hit.tower) this.closeMenus();
            else this.selectTower(hit.tower);
        } else if (hit.socket) {
            this.closeMenus();
            this.radial.openBuild(hit.socket, this.state);
        } else {
            this.closeMenus();
        }
    }

    onKey(e) {
        if (e.repeat) return;
        const k = e.key;
        if (k === 'Escape') {
            if (this.mode === 'paused') return this.resume();
            if (this.mode !== 'playing') return;
            if (this.targeting || this.radial.open) return this.closeMenus();
            return this.pause();
        }
        if (this.mode !== 'playing') return;
        this.audio.unlock();
        if (k === ' ') {
            e.preventDefault();
            this.callWave();
        } else if (k === 'q' || k === 'Q') this.useSkill('meteor');
        else if (k === 'w' || k === 'W') this.useSkill('freeze');
        else if (k === 'f' || k === 'F') this.toggleSpeed();
        else if (/^[1-4]$/.test(k)) {
            const type = TOWER_ORDER[Number(k) - 1];
            const socket = this.radial.mode === 'build' ? this.radial.target : this.hover.socket;
            if (socket && socket.towerId == null) this.build(socket.id, type);
        } else if (
            (k === 'u' || k === 'U') &&
            this.selected &&
            this.selected.tier < MAX_TIER &&
            !this.selected.branch
        ) {
            this.upgrade(this.selected.id, null);
        } else if (
            (k === 'a' || k === 'b' || k === 'A' || k === 'B') &&
            this.selected &&
            this.selected.tier === MAX_TIER &&
            !this.selected.branch
        ) {
            this.upgrade(this.selected.id, k.toLowerCase());
        } else if ((k === 'Delete' || k === 'Backspace') && this.selected) {
            this.sell(this.selected.id);
        }
    }

    updateHover() {
        if (!this.pointer.dirty || this.mode !== 'playing') return;
        this.pointer.dirty = false;
        const hit = this.pointer.inside ? this.pick(this.pointer.x, this.pointer.y) : {};
        this.hover.socket = hit.socket || null;
        this.hover.tower = hit.tower || null;
        this.hover.enemy = hit.enemy || null;
        this.world.hoverSocket = hit.socket ? hit.socket.id : hit.tower ? hit.tower.socketId : null;
        this.renderer.renderer.domElement.style.cursor = this.targeting
            ? 'crosshair'
            : hit.socket || hit.tower
              ? 'pointer'
              : 'default';
    }

    // ---------- 루프 ----------
    onResize() {
        this.renderer.resize();
        this.effects.resize(this.renderer.renderer.domElement.height);
        this.overlay.resize();
    }

    frame(now) {
        const dt = Math.min(0.05, (now - this.last) / 1000);
        this.last = now;
        this.t += dt;
        const playing = this.mode === 'playing' && !this.loop.paused;
        const simDt = playing ? dt * this.loop.speed : 0;
        if (playing) {
            this.acc += simDt;
            let n = 0;
            while (this.acc >= TICK && n++ < 12) {
                step(this.state, TICK);
                this.acc -= TICK;
            }
        }
        const events = this.pending.concat(drainEvents(this.state));
        this.pending = [];
        this.updateHover();
        this.entities.update(this.state, events, this.t, simDt || (this.mode === 'playing' ? 0 : dt * 0.3));
        this.effects.handle(events, this.state);
        this.effects.update(simDt || dt * 0.4, this.t, this.state);
        this.audio.handle(events, this.state);
        this.rig.update(dt);
        this.world.update(this.t, dt);
        if (this.mode === 'playing' || this.mode === 'paused') {
            this.hud.handle(events, this.state);
            this.hud.update(
                this.state,
                this.loop,
                {
                    portal: () =>
                        this.overlay.project(this.world.portal.group.position.clone().add(new THREE.Vector3(0, 3.4, 0)))
                },
                this.audio.enabled
            );
            this.overlay.handle(events, this.state);
            this.coach?.update(this.state);
        }
        this.overlay.draw(
            this.mode === 'title' || this.mode === 'select' ? { enemies: [] } : this.state,
            dt,
            this.hover.enemy?.id
        );
        // 메뉴 앵커
        if (this.radial.open) {
            const target = this.radial.target;
            const p = this.overlay.project(
                new THREE.Vector3(target.x, this.world.heightAt(target.x, target.z) + 0.9, target.z)
            );
            this.radial.update(p, this.state);
        }
        this.updateEnemyCard();
        if (this.state.status !== 'playing' && this.mode === 'playing') {
            this.resultT = (this.resultT ?? 0) + dt;
            if (this.resultT > 1.8) this.showResults();
        }
        this.renderer.render(this.t);
        if (this.wantThumb) {
            this.wantThumb = false;
            try {
                this.thumb = this.renderer.renderer.domElement.toDataURL('image/jpeg', 0.7);
                this.uiRoot
                    .querySelectorAll('.map-card .thumb')
                    .forEach((el, i) => i === 0 && (el.style.backgroundImage = `url(${this.thumb})`));
            } catch {
                /* 캡처 불가 시 무시 */
            }
        }
        requestAnimationFrame((n) => this.frame(n));
    }

    updateEnemyCard() {
        const e = this.hover.enemy;
        const show = e && e.alive && !this.radial.open && this.mode === 'playing';
        this.enemyCard.classList.toggle('show', !!show);
        if (!show) return;
        const key = e.id + ':' + Math.ceil(e.hp);
        if (this.enemyCardKey !== key) {
            this.enemyCardKey = key;
            this.enemyCard.innerHTML = this.radial.enemyCard(e);
        }
        this.enemyCard.style.left = Math.min(window.innerWidth - 316, this.pointer.x + 18) + 'px';
        this.enemyCard.style.top = Math.max(80, this.pointer.y - 60) + 'px';
    }

    // ---------- 개발용 ----------
    devDemo(params) {
        this.startMap(params.get('map') || 'dusk');
        setTimeout(() => {
            const s = this.state;
            s.gold = 99999;
            const plan = [
                [4, 'ranger', 'b'],
                [6, 'frost', 'a'],
                [5, 'ember', 'a'],
                [7, 'storm', 'a'],
                [8, 'ranger', 'a'],
                [11, 'storm', 'b'],
                [9, 'frost', 'b'],
                [10, 'ember', 'b'],
                [2, 'ember', null],
                [12, 'ranger', null],
                [13, 'storm', null]
            ];
            plan.forEach(([sid, type, br], i) => {
                const tw = buildTower(s, sid, type).tower;
                const tiers = br ? 2 : i % 3;
                for (let k = 0; k < tiers; k++) upgradeTower(s, tw.id);
                if (br) upgradeTower(s, tw.id, br);
            });
            s.waveIndex = Number(params.get('wave') || 6) - 1;
            if (s.waveIndex > 0) s.nextWaveIn = 0.01;
            callWave(s);
            this.save.tutorialDone = true;
            this.coach?.destroy();
            this.rig.skipIntro();
        }, 600);
    }

    advance(sec) {
        for (let s = 0; s < sec; s += TICK) {
            step(this.state, TICK);
            this.pending.push(...drainEvents(this.state));
        }
        this.pending = this.pending.slice(-60);
    }
}
