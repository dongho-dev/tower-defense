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
    towerStats,
    upgradeOptions,
    resonanceInfo,
    resonancePreview,
    starsFor,
    continueEndless,
    wavesSurvived,
    repairTower,
    repairGate,
    repairBase,
    upgradeMining,
    reinforceGate,
    setRally,
    commandHero,
    heroSkill,
    TICK,
    SKILLS
} from './core/game.js';
import { TOWER_ORDER, TOWERS } from './core/data/towers.js';
import { MAPS } from './core/data/maps.js';
import { TOWER_TINT } from './ui/icons.js';
import { Renderer, QUALITY } from './render/Renderer.js';
import { CameraRig } from './render/CameraRig.js';
import { World } from './render/World.js';
import { disposeScene } from './render/dispose.js';
import { precompile } from './render/warmup.js';
import { frameDt, planSteps, ErrorGate } from './core/loop.js';
import { DiagLog, errorInfo, gpuInfo, mountDiagPanel } from './diag.js';

/** 이보다 긴 프레임 정지는 진단 기록에 남긴다 (ms) */
const STALL_MS = 1000;
/** 정지 직전 이만큼 안에 처음 나온 적·타워를 함께 적는다 (ms) */
const RECENT_FIRST_MS = 5000;
/** 컨텍스트를 잃고 이만큼 안에 돌아오지 않으면 새로고침한다 (ms) */
const CONTEXT_RELOAD_MS = 3000;
import { EntityView } from './render/EntityView.js';
import { Effects } from './render/fx/Effects.js';
import { Overlay } from './ui/overlay.js';
import { Hud } from './ui/hud.js';
import { Radial } from './ui/radial.js';
import { Inspector } from './ui/panel.js';
import { keyOf } from './ui/keys.js';
import { Screens, Coach, recordOf, recordKey } from './ui/screens.js';
import { Audio } from './audio/audio.js';
import { SurvivalUI } from './ui/survival/controller.js';
import { loadSave, SAVE_KEY } from './save.js';
import { summon, upgradeOdds, luckySummon, mergeTower, craftMythic, rtdSell, moveTower } from './core/randomtd.js';
import { RtdUi } from './ui/rtd.js';
import { RtdView } from './render/rtdView.js';

export class App {
    constructor() {
        this.save = loadSave();
        // 진단 기록 (localStorage 'll_diag', ?diag면 화면 구석에 표시)
        this.diag = new DiagLog();
        // 루프 안 예외 기록 (같은 오류는 한 번만 경고, 처음 본 오류는 진단 기록에도)
        this.errors = new ErrorGate(console, 50, (where, err) => this.diag.add('error', { where, ...errorInfo(err) }));
        this.firstSeen = new Set();
        this.recentFirsts = [];
        const params = new URLSearchParams(location.search);
        if (params.has('diag')) mountDiagPanel(this.diag);
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
        this.audio = new Audio({ mode: () => this.mode, camera: () => this.rig.camera });
        this.audio.enabled = this.save.settings.sound;
        this.rig.shakeEnabled = this.save.settings.shake;

        this.loop = { speed: 1, paused: false };
        this.mode = 'title';
        this.pointer = { x: 0, y: 0, inside: false, dirty: true };
        this.hover = { socket: null, tower: null, enemy: null };
        this.targeting = null;
        this.pending = [];
        this.raycaster = new THREE.Raycaster();
        this.thumbs = {};

        this.hud = new Hud(this.uiRoot, {
            callWave: () => this.callWave(),
            castSkill: (id) => this.useSkill(id),
            toggleSpeed: () => this.toggleSpeed(),
            pause: () => this.pause(),
            toggleSound: () => this.setSetting('sound', !this.save.settings.sound),
            openSettings: () => this.openSettings(true),
            openBestiary: () => this.openBestiary(false),
            selectHero: () => this.selectHero(),
            heroSkill: () => this.useHeroSkill(),
            selectGate: (id) => this.selectGate(this.state.gates[id]),
            deny: () => this.audio.play('deny')
        });
        this.hud.setVisible(false);
        this.radial = new Radial(this.uiRoot, {
            build: (sid, type) => this.build(sid, type),
            denied: (label) => this.hud.toast(`골드가 부족합니다 · ${label}`, true),
            hover: (type) => this.hoverBuild(type)
        });
        this.inspector = new Inspector(this.uiRoot, {
            upgrade: (id, br) => this.upgrade(id, br),
            sell: (id) => this.sell(id),
            target: (id, mode) => setTargeting(this.state, id, mode),
            preview: (opt) => this.world.showRange(opt),
            closed: () => this.closeMenus(),
            repair: (id) => this.repair(id),
            rally: (id) => this.armRally(id),
            heroSkill: () => this.useHeroSkill(),
            gateRepair: (id) => this.gateCommand(repairGate, id),
            gateReinforce: (id) => this.gateCommand(reinforceGate, id),
            baseRepair: () => this.repairBase(),
            mineTech: () => this.upgradeMining(),
            merge: (id) => this.rtdCommand(mergeTower, id),
            move: (id) => this.armMove(id)
        });
        // 랜덤 디펜스: 필드 몹 수·소환 도크·신화 레시피
        this.rtdUi = new RtdUi(this.uiRoot, {
            summon: () => this.rtdCommand(summon),
            upgradeOdds: () => this.rtdCommand(upgradeOdds),
            luck: () => this.rtdCommand(luckySummon),
            craft: (id) => this.rtdCommand(craftMythic, id)
        });
        this.screens = new Screens(this.uiRoot, {
            toSelect: (opts) => this.toSelect(opts),
            toTitle: () => this.toTitle(),
            startMap: (id, opts) => this.startMap(id, opts),
            resume: () => this.resume(),
            restart: () => this.startMap(this.state.mapId, this.runOpts),
            continueEndless: () => this.continueEndless(),
            setPref: (k, v) => {
                this.save[k] = v;
                this.persist();
            },
            openSettings: (fromPause) => this.openSettings(fromPause),
            closeSettings: (fromPause) =>
                fromPause && this.mode === 'paused'
                    ? this.screens.pause()
                    : this.mode === 'title'
                      ? this.toTitle()
                      : this.resume(),
            setSetting: (k, v) => this.setSetting(k, v),
            openBestiary: (fromPause) => this.openBestiary(fromPause),
            closeBestiary: (fromPause) => (fromPause && this.mode === 'paused' ? this.screens.pause() : this.resume())
        });

        this.bindInput();
        window.addEventListener('resize', () => this.onResize());
        // 그래픽 드라이버가 재설정되면 컨텍스트를 잃는다: 멈춘 채 두지 말고 일시정지 후 장면을 다시 짓는다
        const canvas = this.renderer.renderer.domElement;
        canvas.addEventListener('webglcontextlost', (e) => {
            e.preventDefault(); // 복구(restored)를 받으려면 기본 동작을 막아야 한다
            this.onContextLost();
        });
        // 탭을 숨겼다 돌아온 첫 프레임의 긴 간격은 정지가 아니다
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) this.wasHidden = true;
        });
        canvas.addEventListener('webglcontextrestored', () => this.onContextRestored());
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
        // 이전 맵의 geometry·재질·텍스처·그림자 맵을 모두 해제
        if (this.world) disposeScene(this.world.scene);
        this.world = new World(this.renderer.renderer, this.state, this.renderer.quality);
        if (!this.rig) {
            this.rig = new CameraRig(this.state.map.island);
            this.rig.attach(this.renderer.renderer.domElement);
        }
        this.rig.bounds = this.state.map.island;
        // 살아남기 월드는 그림자를 카메라가 보는 곳에 맞춘다
        this.world.rig = this.rig;
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
        this.rtdView = new RtdView(this.world.scene, this.world, this.effects, this.entities);
        this.worldMap = this.state.mapId;
        this.worldQuality = this.renderer.qualityName;
        if (this.overlay && this.effects && this.hud) this.onResize();
    }

    /**
     * 지금 장면과 나올 수 있는 모델의 셰이더를 병렬로 굽는다. 그동안 frame()은 WebGL 렌더를 건너뛴다
     * (렌더하면 그 자리에서 컴파일을 기다리느라 몇 초씩 멈춘다).
     */
    warmWorld() {
        const token = (this.warmToken = (this.warmToken || 0) + 1);
        this.warming = true;
        const t0 = performance.now();
        const p0 = this.programCount();
        this.warmPromise = precompile(
            this.renderer.renderer,
            this.world.scene,
            this.rig.camera,
            this.renderer.composer.readBuffer
        )
            .then((r) => this.guard('진단', () => this.noteWarm(r, performance.now() - t0, this.programCount() - p0)))
            .catch((e) => this.errors.report('셰이더 미리 굽기', e))
            .finally(() => {
                if (this.warmToken === token) this.warming = false;
            });
        return this.warmPromise;
    }

    onContextLost() {
        if (this.glLost) return;
        this.glLost = true;
        console.warn('[렌더] WebGL 컨텍스트를 잃었습니다. 복구를 기다립니다.');
        this.diag.add('contextlost', { map: this.state.map?.name, mode: this.mode, wave: this.state.waveIndex });
        if (this.mode === 'playing') this.pause();
        this.showNotice('화면 복구 중…');
        clearTimeout(this.reloadTimer);
        this.reloadTimer = setTimeout(() => this.reloadAfterLoss(), CONTEXT_RELOAD_MS);
    }

    /** 컨텍스트가 돌아오지 않으면 기록을 저장한 채 새로고침 (연달아 반복되면 멈추고 안내만) */
    reloadAfterLoss() {
        if (!this.glLost) return;
        this.persist();
        let last = 0;
        try {
            last = Number(sessionStorage.getItem('ll_reload_at')) || 0;
        } catch {
            /* 무시 */
        }
        if (Date.now() - last < 30000) {
            this.showNotice('그래픽 장치를 복구하지 못했습니다. 페이지를 새로고침해 주세요.');
            return;
        }
        this.diag.add('reload');
        try {
            sessionStorage.setItem('ll_reload_at', String(Date.now()));
        } catch {
            /* 무시 */
        }
        location.reload();
    }

    showNotice(text) {
        if (!this.noticeEl) {
            this.noticeEl = document.createElement('div');
            this.noticeEl.className = 'gl-notice';
            this.noticeEl.style.cssText =
                'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:9000;' +
                'background:rgba(6,4,12,.72);color:#f3ead8;font:600 18px/1.5 system-ui,sans-serif;text-align:center;padding:16px';
            document.body.appendChild(this.noticeEl);
        }
        this.noticeEl.textContent = text;
        this.noticeEl.hidden = false;
    }

    hideNotice() {
        if (this.noticeEl) this.noticeEl.hidden = true;
    }

    onContextRestored() {
        clearTimeout(this.reloadTimer);
        this.hideNotice();
        this.diag.add('contextrestored');
        // 환경맵 같은 렌더 타깃 내용은 사라졌으므로 장면을 새로 짓는다. 타워·적은 게임 상태에서 다시 만들어진다.
        try {
            this.worldMap = null;
            this.buildWorld();
            this.warmWorld();
        } catch (e) {
            this.errors.report('컨텍스트 복구', e);
        }
        this.glLost = false;
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
        this.startMapToken = (this.startMapToken || 0) + 1;
        this.fade?.classList.remove('on');
        this.endSurvivalUI();
        this.mode = 'title';
        this.hud.setVisible(false);
        this.rtdUi.setVisible(false);
        this.closeMenus();
        this.coach?.destroy();
        this.rig.orbit = true;
        this.rig.goal.set(0, -2.5, 0);
        this.rig.goalDistance = 52;
        this.rig.setPitch(18);
        this.rig.shift = window.innerWidth > 900 ? 0.2 : 0;
        this.screens.title(this.progressSummary());
    }

    progressSummary() {
        const recs = Object.values(this.save.records);
        let stars = 0;
        let heroCleared = 0;
        let bestWave = 0;
        for (const r of recs) {
            stars += Math.max(0, ...Object.values(r).map((d) => d.stars || 0));
            if (r.hero?.stars || r['siege-hero']?.stars) heroCleared++;
            bestWave = Math.max(bestWave, ...Object.values(r).map((d) => d.best || 0));
        }
        return { stars, maxStars: Object.keys(MAPS).length * 3, heroCleared, bestWave, hasProgress: recs.length > 0 };
    }

    toSelect(opts = {}) {
        this.startMapToken = (this.startMapToken || 0) + 1;
        this.fade?.classList.remove('on');
        if (opts.endless) {
            this.save.lastEndless = true;
            this.persist();
        }
        this.rig.shift = 0;
        this.endSurvivalUI();
        this.mode = 'select';
        this.hud.setVisible(false);
        this.rtdUi.setVisible(false);
        this.closeMenus();
        this.coach?.destroy();
        this.rig.orbit = true;
        this.rig.setPitch(16);
        this.wantThumb = true;
        this.screens.select(this.save, this.thumbs);
    }

    startMap(mapId, opts = {}) {
        // 공성전 전용 맵은 언제나 공성전
        const siege = !!opts.siege || !!MAPS[mapId]?.siegeOnly;
        const runOpts = { difficulty: opts.difficulty || 'normal', endless: !!opts.endless, siege };
        this.runOpts = runOpts;
        const token = (this.startMapToken = (this.startMapToken || 0) + 1);
        this.fade.classList.add('on');
        setTimeout(() => {
            // 페이드 중에 다른 맵을 또 누르거나 나가면 마지막 요청만 연다
            if (token !== this.startMapToken) return;
            this.endSurvivalUI();
            this.state = createGame(mapId, runOpts);
            // 살아남기 월드는 판의 상태(안개·건물)를 붙잡고 있으므로 판마다 새로 짓는다
            const rebuilt =
                this.worldMap !== mapId || !!this.state.survival || this.worldQuality !== this.renderer.qualityName;
            const b0 = performance.now();
            if (rebuilt) this.buildWorld();
            this.buildMs = performance.now() - b0;
            if (!rebuilt) {
                this.world.state = this.state;
                this.entities.reset();
                this.effects.reset();
                this.rtdView.reset();
            }
            // 새 장면이거나 아직 한 번도 안 구웠으면 검은 화면 뒤에서 셰이더를 굽는다
            // (안 구우면 첫 적·첫 타워가 나올 때마다 플레이 중에 0.4~1.2초씩 멈춘다)
            if (rebuilt || !this.warmedOnce) {
                this.warmedOnce = true;
                this.warmWorld();
            }
            this.mode = 'loading';
            // 셰이더를 다 구울 때까지 검은 화면 (굽는 중이 아니면 바로)
            Promise.resolve(this.warming ? this.warmPromise : null)
                .then(() => token === this.startMapToken && this.enterMap(token))
                .catch((e) => this.errors.report('맵 시작', e));
        }, 450);
    }

    /** 맵 준비가 끝난 뒤: 카메라 연출, HUD, 안내 */
    enterMap(token) {
        this.mode = 'playing';
        this.loop.paused = false;
        this.loop.speed = 1;
        this.closeMenus();
        this.screens.clear();
        this.hud.setVisible(true);
        this.rig.orbit = false;
        this.rig.shift = 0;
        this.rig.shiftCur = 0;
        this.rig.goalYaw = 0;
        this.rig.yaw = 0;
        this.rig.goalDistance = this.state.map.view?.distance ?? 34;
        this.rig.setPitch(52);
        // 맵이 시작 시점을 정해 두었으면 그곳 (산처럼 높은 맵은 눈높이를 올린다)
        const tg = this.state.map.view?.target;
        const to = tg ? new THREE.Vector3(...tg) : new THREE.Vector3(0.5, 0, 0.6);
        this.rig.goal.y = to.y;
        const s = this.state.paths[0];
        const from = new THREE.Vector3(s.xs[0] + 3, to.y, s.zs[0]);
        if (this.state.survival) {
            // 살아남기: 넓은 맵을 RTS처럼 (둥지 곁 생존자 한 명에서 시작)
            this.rig.skipIntro();
            this.surv = new SurvivalUI(this);
        } else this.rig.playIntro(from, to, 3.2);
        this.fade.classList.remove('on');
        this.hud.reset(this.state);
        this.rtdUi.reset(this.state, this.hud);
        this.hud.showBanner(
            this.state.map.name,
            this.state.endless
                ? '끝없는 밤 · 얼마나 버틸 수 있는가'
                : this.state.rtd
                  ? '랜덤 디펜스 · 소환하고 합성해 필드가 넘치지 않게'
                  : this.state.survival
                    ? '살아남기 · 생존자로 고원을 찾아 본진을 짓고 동이 틀 때까지 버텨라'
                    : this.state.gates.length
                      ? '공성전 · 성문이 무너지면 길이 열린다'
                      : this.state.siege
                        ? '공성전 · 영웅을 움직이고 무너지는 성벽을 지켜라'
                        : this.state.difficulty === 'hero'
                          ? '영웅 · 단 한 번의 실수도 허락되지 않는다'
                          : '마지막 빛을 지켜라'
        );
        this.coach?.destroy();
        // 첫 판 안내(소켓 누르기)는 소켓에 직접 짓는 맵에서만
        this.coach =
            this.save.tutorialDone || this.state.survival || this.state.rtd
                ? null
                : new Coach(this.uiRoot, () => {
                      this.save.tutorialDone = true;
                      this.persist();
                      this.coach = null;
                  });
        this.resultT = null;
        if (this.state.siege && !this.state.survival) {
            const gates = this.state.gates.length > 0;
            setTimeout(
                () =>
                    token === this.startMapToken &&
                    this.mode === 'playing' &&
                    this.hud.showHint(
                        this.state.rtd
                            ? '<b>소환(Q)</b>하면 무작위 타워가 칸에 섭니다. 같은 타워는 한 칸에 셋까지 쌓이고, 셋이 모이면 <b>합성(E)</b>해 한 등급 위로. 적은 고리 길을 끝없이 돌고, 필드에 <b>100마리</b>가 넘으면 집니다. 10웨이브마다 보스는 <b>30초</b> 안에.'
                            : this.state.survival
                              ? '정해진 길이 없습니다. 적은 산기슭 <b>동굴</b>(보랏빛으로 타오르는 곳)에서 나와 <b>가장 가까운 건물</b>부터 부숩니다. 금빛 <b>광맥</b>에 광산을 지으면 15초마다 골드를 캡니다 · 위험한 터일수록 많이. 부서진 건물은 <b>G</b>, 본진(수정)은 눌러서 수리하세요. <b>본진</b>이 무너지면 패배, <b>동이 틀 때까지</b> 버티면 승리.'
                              : gates
                                ? '적은 <b>성문</b> 앞에서 멈춰 문을 부숩니다. 성문을 눌러 <b>수리(G)</b>·<b>보강(U)</b>하세요. 문이 무너지면 적이 곧장 수정으로 달려옵니다. <b>H</b>로 영웅을 골라 위급한 문으로 보내세요.'
                                : '적이 길가의 타워를 공격합니다. <b>H</b>로 영웅을 고르고 땅을 눌러 길목으로 보내세요. <b>병영(7)</b>은 적을 붙잡고, 다친 타워는 <b>G</b>로 수리합니다.',
                        12000
                    ),
                3800
            );
        }
    }

    /** 살아남기 화면 조작을 걷는다 (다른 맵으로 가거나 타이틀로) */
    endSurvivalUI() {
        this.surv?.destroy();
        this.surv = null;
        // 타이틀·전장 선택 배경으로 남는 설원은 안개를 걷어 전체를 보여 준다
        if (this.world?.fogLayer) this.world.fogLayer.uniforms.uFogOn.value = 0;
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

    openBestiary(fromPause) {
        if (this.mode === 'playing') this.mode = 'paused';
        this.closeMenus();
        this.screens.bestiary(this.save.seen, fromPause);
    }

    /** 처음 보는 적: 도감에 기록하고 소개 카드 */
    noteSpawns(events) {
        for (const ev of events) {
            if (ev.type !== 'spawn' || this.save.seen.includes(ev.enemy)) continue;
            this.save.seen.push(ev.enemy);
            this.persist();
            this.hud.introEnemy(ev.enemy);
        }
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
        const st = this.state;
        const won = st.status === 'won';
        const stars = won ? starsFor(st) : 0;
        const survived = wavesSurvived(st);
        const mode = st.siege ? 'siege' : 'campaign';
        const rec = { ...recordOf(this.save, st.mapId, st.difficulty, mode) };
        // 캠페인을 이기고 이어 간 끝없는 밤은 이미 별을 받았으므로 웨이브 기록만 갱신한다
        if (won) rec.stars = Math.max(rec.stars, stars);
        const newBest = st.endless && survived > (rec.best || 0);
        if (st.endless) rec.best = Math.max(rec.best || 0, survived);
        if (won || st.endless) {
            (this.save.records[st.mapId] ??= {})[recordKey(st.difficulty, mode)] = rec;
            this.persist();
        }
        this.mode = 'results';
        this.closeMenus();
        this.coach?.destroy();
        this.screens.results({ won, stars, state: st, record: rec, newBest, survived });
        this.audio.play(won || newBest ? 'victory' : 'defeat');
    }

    continueEndless() {
        if (!continueEndless(this.state).ok) return;
        this.runOpts = { ...this.runOpts, endless: true };
        this.mode = 'playing';
        this.resultT = null;
        this.screens.clear();
        this.hud.showBanner('끝없는 밤', '빛이 꺼질 때까지 싸운다', true);
    }

    // ---------- 명령 ----------
    build(socketId, type) {
        const r = buildTower(this.state, socketId, type);
        if (!r.ok) return this.hud.toast(r.reason, true);
        this.radial.close();
        this.selectTower(r.tower);
    }

    upgrade(id, branch) {
        if (this.mode !== 'playing') return;
        const r = upgradeTower(this.state, id, branch);
        if (!r.ok) return this.hud.toast(r.reason, true);
        const t = findTower(this.state, id);
        if (t) this.selectTower(t);
    }

    sell(id) {
        if (this.state.rtd) {
            // 쌓인 타워는 하나씩 팔린다 (남아 있으면 선택 유지)
            const r = rtdSell(this.state, id);
            if (r.ok && !r.left) this.closeMenus();
            return;
        }
        const r = sellTower(this.state, id);
        if (r.ok) this.closeMenus();
    }

    /** 랜덤 디펜스 명령: 소환·확률 강화·행운 소환·합성·신화 */
    rtdCommand(fn, ...args) {
        if (this.mode !== 'playing' || !this.state.rtd) return;
        this.audio.unlock();
        const r = fn(this.state, ...args);
        if (!r.ok) return this.hud.toast(r.reason, true);
        if (fn === mergeTower || fn === craftMythic) this.selectTower(r.tower);
    }

    /** 옮기기 모드: 다음 칸 클릭으로 옮기거나 자리를 바꾼다 */
    armMove(id) {
        this.moveFor = this.moveFor === id ? null : id;
        this.inspector.moveArmed = !!this.moveFor;
        this.inspector.render(this.state, true);
        if (this.moveFor) this.hud.toast('옮길 칸을 누르세요 · 우클릭 취소');
    }

    repair(id) {
        if (this.mode !== 'playing') return;
        // 살아남기: 생존자가 가서 고친다
        if (this.surv) return this.surv.repair(findTower(this.state, id));
        const r = repairTower(this.state, id);
        if (!r.ok) this.hud.toast(r.reason, true);
    }

    /** 살아남기: 본진에서 채굴 기술을 올린다 */
    upgradeMining() {
        if (this.mode !== 'playing') return;
        const r = upgradeMining(this.state);
        if (!r.ok) this.hud.toast(r.reason, true);
        else if (this.selectedBase) this.inspector.render(this.state, true);
    }

    /** 성문 수리·보강 */
    gateCommand(fn, id) {
        if (this.mode !== 'playing') return;
        const r = fn(this.state, id);
        if (!r.ok) this.hud.toast(r.reason, true);
        else if (this.selectedGate) this.inspector.render(this.state, true);
    }

    /** 살아남기: 본진(수정) 선택과 수리 */
    selectBase() {
        if (!this.state.survival || this.mode !== 'playing') return;
        this.closeMenus();
        this.selectedBase = true;
        this.inspector.showBase(this.state);
    }

    repairBase() {
        if (this.mode !== 'playing') return;
        if (this.surv && this.state.survival.base) return this.surv.repair(this.state.survival.base);
        const r = repairBase(this.state);
        if (!r.ok) this.hud.toast(r.reason, true);
        else if (this.selectedBase) this.inspector.render(this.state, true);
    }

    selectGate(gate) {
        if (!gate || this.mode !== 'playing') return;
        this.closeMenus();
        this.selectedGate = gate;
        this.inspector.showGate(gate, this.state);
    }

    /** 집결지 지정 모드: 다음 땅 클릭이 집결지가 된다 */
    armRally(id) {
        this.rallyFor = this.rallyFor === id ? null : id;
        this.inspector.rallyArmed = !!this.rallyFor;
        this.inspector.render(this.state, true);
        if (this.rallyFor) this.hud.toast('병영 사거리 안의 길을 누르세요 · 우클릭 취소');
    }

    selectHero() {
        const h = this.state.hero;
        if (!h || this.mode !== 'playing') return;
        this.radial.close();
        this.selected = null;
        this.selectedEnemy = null;
        this.rallyFor = null;
        this.heroSelected = true;
        this.hud.heroSelected = true;
        this.world.showRange(null);
        this.inspector.showHero(h, this.state);
    }

    useHeroSkill() {
        if (this.mode !== 'playing' || !this.state.hero) return;
        const r = heroSkill(this.state);
        if (!r.ok) this.hud.toast(r.reason, true);
    }

    moveHero(x, y) {
        const p = this.groundPoint(x, y);
        if (!p) return;
        const r = commandHero(this.state, p.x, p.z);
        if (!r.ok) this.hud.toast(r.reason, true);
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
        this.radial.close();
        if (this.selected !== tower) {
            this.rallyFor = null;
            this.inspector.rallyArmed = false;
        }
        this.selected = tower;
        this.selectedEnemy = null;
        this.heroSelected = false;
        this.hud.heroSelected = false;
        this.inspector.showTower(tower, this.state);
        this.world.showRange({
            x: tower.x,
            z: tower.z,
            r: towerStats(this.state, tower).range,
            color: TOWER_TINT[tower.type]
        });
    }

    selectEnemy(e) {
        this.radial.close();
        this.heroSelected = false;
        this.hud.heroSelected = false;
        this.selected = null;
        this.selectedEnemy = e;
        this.world.showRange(null);
        this.inspector.showEnemy(e, this.state);
    }

    /** 건설 메뉴에서 종류에 마우스를 올리면: 하단 패널 미리보기 + 사거리 */
    hoverBuild(type) {
        const socket = this.radial.target;
        this.buildHover = type;
        if (!type || !socket) {
            if (this.radial.open) this.inspector.hide();
            this.world.showRange(null);
            return;
        }
        this.inspector.showBuild(socket, type, this.state);
        this.world.showRange({ x: socket.x, z: socket.z, r: TOWERS[type].tiers[0].range, color: TOWER_TINT[type] });
    }

    /** 오버레이에 그릴 공명 연결선: 선택한 타워나 건설 미리보기 기준 */
    resonanceLinks() {
        let socketId;
        let type;
        let info;
        if (this.selected) {
            socketId = this.selected.socketId;
            type = this.selected.type;
            info = resonanceInfo(this.state, this.selected);
        } else if (this.radial.open && this.buildHover) {
            socketId = this.radial.target.id;
            type = this.buildHover;
            info = resonancePreview(this.state, socketId, type);
        } else return null;
        const s0 = this.state.sockets[socketId];
        const links = [];
        for (const id of info.links) {
            const s1 = this.state.sockets[id];
            const recv = info.received.find((r) => r.from.some((tid) => findTower(this.state, tid)?.socketId === id));
            const give = info.given.find((g) => g.socketId === id);
            const other = s1.towerId != null ? findTower(this.state, s1.towerId) : null;
            links.push({
                a: { x: s0.x, z: s0.z },
                b: { x: s1.x, z: s1.z },
                recv: recv ? { color: TOWER_TINT[recv.type], label: recv.label } : null,
                give: give ? { color: TOWER_TINT[type], label: give.label } : null,
                same: other && other.type === type,
                empty: !other
            });
        }
        return links;
    }

    closeMenus() {
        this.radial.close();
        this.inspector.hide();
        this.selected = null;
        this.selectedEnemy = null;
        this.selectedGate = null;
        this.selectedBase = false;
        this.buildHover = null;
        this.targeting = null;
        this.hud.armed = null;
        this.heroSelected = false;
        this.hud.heroSelected = false;
        this.rallyFor = null;
        this.inspector.rallyArmed = false;
        this.moveFor = null;
        this.inspector.moveArmed = false;
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
        dom.addEventListener('contextmenu', (e) => {
            if (this.mode !== 'playing') return;
            e.preventDefault();
            // 영웅을 고른 상태면 우클릭으로 이동 (RTS 방식)
            if (this.heroSelected && !this.rig.dragging) return this.moveHero(e.clientX, e.clientY);
            if (this.rallyFor || this.moveFor) {
                this.rallyFor = null;
                this.inspector.rallyArmed = false;
                this.moveFor = null;
                this.inspector.moveArmed = false;
                return this.inspector.render(this.state, true);
            }
            if (this.surv?.cancel(e)) return;
            this.closeMenus();
        });
        window.addEventListener('keydown', (e) => this.onKey(e));
    }

    ndc(x, y) {
        const r = this.renderer.renderer.domElement.getBoundingClientRect();
        return new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    }

    pick(x, y) {
        this.raycaster.setFromCamera(this.ndc(x, y), this.rig.camera);
        const targets = [
            ...this.world.sockets.pickables,
            ...this.world.fortress.pickables,
            ...this.world.core.pickables
        ];
        for (const v of this.entities.towers.values()) targets.push(v.root);
        const hits = this.raycaster.intersectObjects(targets, true);
        for (const hit of hits) {
            let o = hit.object;
            while (o) {
                if (o.userData.towerId != null) return { tower: findTower(this.state, o.userData.towerId) };
                if (o.userData.gateId != null) return { gate: this.state.gates[o.userData.gateId] };
                if (o.userData.base) return { base: true };
                if (o.userData.socketId != null) {
                    const s = this.state.sockets[o.userData.socketId];
                    if (s.towerId != null) return { tower: findTower(this.state, s.towerId) };
                    return { socket: s };
                }
                o = o.parent;
            }
        }
        // 영웅·병사: 화면 거리 기준 (영웅 우선)
        for (const u of this.state.units) {
            if (u.dead) continue;
            const top = this.entities.unitTop(u);
            if (!top) continue;
            const p = this.overlay.project(top.setY(top.y - (u.kind === 'hero' ? 0.8 : 0.55)));
            if (Math.hypot(p.x - x, p.y - y) < (u.kind === 'hero' ? 34 : 18)) return { unit: u };
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
        if (this.rallyFor) {
            const p = this.groundPoint(e.clientX, e.clientY);
            const id = this.rallyFor;
            this.rallyFor = null;
            this.inspector.rallyArmed = false;
            if (p) {
                const r = setRally(this.state, id, p.x, p.z);
                if (!r.ok) this.hud.toast(r.reason, true);
            }
            const t = findTower(this.state, id);
            if (t) this.selectTower(t);
            return;
        }
        // 살아남기: 건설·건물 고르기를 먼저
        if (this.surv?.onClick(e)) return;
        const hit = this.pick(e.clientX, e.clientY);
        // 랜덤 디펜스: 옮기기 모드면 누른 칸으로 옮긴다
        if (this.moveFor && (hit.socket || hit.tower)) {
            const r = moveTower(this.state, this.moveFor, hit.socket ? hit.socket.id : hit.tower.socketId);
            this.moveFor = null;
            this.inspector.moveArmed = false;
            if (!r.ok) this.hud.toast(r.reason, true);
            else return this.selectTower(r.tower);
        }
        if (hit.unit) {
            if (hit.unit.kind === 'hero') return this.heroSelected ? this.closeMenus() : this.selectHero();
            const owner = findTower(this.state, hit.unit.ownerId);
            if (owner) return this.selectTower(owner);
        }
        // 영웅을 고른 상태에서 땅(빈 곳·적 근처)을 누르면 이동
        if (this.heroSelected && !hit.tower && !hit.socket) return this.moveHero(e.clientX, e.clientY);
        if (hit.gate) {
            if (this.selectedGate === hit.gate) this.closeMenus();
            else this.selectGate(hit.gate);
        } else if (hit.base) {
            if (this.selectedBase) this.closeMenus();
            else this.selectBase();
        } else if (hit.tower) {
            if (this.selected === hit.tower) this.closeMenus();
            else this.selectTower(hit.tower);
        } else if (hit.enemy) {
            this.selectEnemy(hit.enemy);
        } else if (hit.socket) {
            this.closeMenus();
            // 랜덤 디펜스는 칸에 직접 짓지 않는다 (소환하면 빈 칸에 선다)
            if (!this.state.rtd) this.radial.openBuild(hit.socket, this.state);
        } else {
            this.closeMenus();
        }
    }

    onKey(e) {
        if (e.repeat) return;
        const k = keyOf(e);
        if (k === 'Escape') {
            if (this.mode === 'paused') return this.resume();
            if (this.mode !== 'playing') return;
            if (this.surv?.onKey(e)) return;
            if (this.targeting || this.radial.open || this.inspector.open) return this.closeMenus();
            return this.pause();
        }
        if (this.mode !== 'playing') return;
        this.audio.unlock();
        if (this.surv?.onKey(e)) return;
        if (this.state.rtd) return this.rtdKey(k, e);
        if (k === ' ') {
            e.preventDefault();
            this.callWave();
        } else if (k === 'q' || k === 'Q') this.useSkill('meteor');
        else if (k === 'w' || k === 'W') this.useSkill('freeze');
        else if (k === 'f' || k === 'F') this.toggleSpeed();
        else if ((k === 'h' || k === 'H') && this.state.hero) {
            if (this.heroSelected) this.closeMenus();
            else this.selectHero();
        } else if ((k === 'e' || k === 'E') && this.state.hero) this.useHeroSkill();
        else if ((k === 'r' || k === 'R') && this.selected?.type === 'barracks') this.armRally(this.selected.id);
        else if ((k === 'g' || k === 'G') && this.selectedGate) this.gateCommand(repairGate, this.selectedGate.id);
        else if ((k === 'g' || k === 'G') && this.selectedBase) this.repairBase();
        else if ((k === 'u' || k === 'U') && this.selectedGate) this.gateCommand(reinforceGate, this.selectedGate.id);
        else if ((k === 'u' || k === 'U') && this.selectedBase) this.upgradeMining();
        else if ((k === 'g' || k === 'G') && this.selected && this.selected.hp != null) this.repair(this.selected.id);
        else if (/^[1-7]$/.test(k)) {
            const type = TOWER_ORDER[Number(k) - 1];
            const socket = this.radial.mode === 'build' ? this.radial.target : this.hover.socket;
            if (type && socket && socket.towerId == null) this.build(socket.id, type);
        } else if (k === 'u' || k === 'a' || k === 'b') {
            // 패널을 열지 않았어도 커서 아래 타워를 강화한다
            const t = this.selected || this.hover.tower;
            if (!t) return;
            const opts = upgradeOptions(t);
            const branch = opts.some((o) => o.kind === 'branch');
            if (!opts.length) this.hud.toast('더 강화할 수 없습니다', true);
            else if (k === 'u' && branch) this.hud.toast('갈래를 고르세요: A 또는 B', true);
            else if (k !== 'u' && !branch) this.hud.toast('U로 강화하세요', true);
            else this.upgrade(t.id, k === 'u' ? null : k);
        } else if ((k === 'Delete' || k === 'Backspace') && this.selected) {
            this.inspector.trySell(this.selected, this.state);
        }
    }

    /** 랜덤 디펜스 단축키: Q 소환, W 행운 소환, E 합성, R 옮기기, T 신화 레시피, Space 첫 웨이브, F 배속 */
    rtdKey(k, e) {
        const key = k.toLowerCase();
        const sel = this.selected;
        if (key === 'q') this.rtdCommand(summon);
        else if (key === 'w') this.rtdCommand(luckySummon);
        else if (key === 'e' && sel) this.rtdCommand(mergeTower, sel.id);
        else if (key === 'r' && sel) this.armMove(sel.id);
        else if (key === 't') this.rtdUi.toggleRecipes();
        else if (key === 'f') this.toggleSpeed();
        else if (k === ' ') {
            e.preventDefault();
            this.callWave();
        } else if ((k === 'Delete' || k === 'Backspace') && sel) this.inspector.trySell(sel, this.state);
    }

    updateHover() {
        if (!this.pointer.dirty || this.mode !== 'playing') return;
        this.pointer.dirty = false;
        const hit = this.pointer.inside ? this.pick(this.pointer.x, this.pointer.y) : {};
        this.hover.socket = hit.socket || null;
        this.hover.tower = hit.tower || null;
        this.hover.enemy = hit.enemy || null;
        this.world.hoverSocket = hit.socket ? hit.socket.id : hit.tower ? hit.tower.socketId : null;
        this.renderer.renderer.domElement.style.cursor =
            this.targeting || this.rallyFor || this.moveFor
                ? 'crosshair'
                : hit.socket || hit.tower || hit.unit || hit.gate || hit.base
                  ? 'pointer'
                  : this.heroSelected
                    ? 'crosshair'
                    : 'default';
    }

    // ---------- 루프 ----------
    onResize() {
        this.renderer.resize();
        this.effects.resize(this.renderer.renderer.domElement.height);
        this.overlay.resize();
    }

    frame(now) {
        // 다음 프레임을 먼저 예약한다: 아래에서 예외가 나도 루프는 끊기지 않는다
        requestAnimationFrame((n) => this.frame(n));
        // 1초 넘게 다음 프레임이 오지 않았으면 (탭 숨김 제외) 정지로 기록
        if (now - this.last > STALL_MS && !this.wasHidden)
            this.guard('진단', () => this.noteStall(now - this.last, now));
        this.wasHidden = false;
        // 탭 복귀처럼 rAF가 오래 멈췄다 돌아와도 한 프레임은 최대 0.05초만 진행한다
        const dt = frameDt(now, this.last);
        this.last = now;
        this.t += dt;
        // 구간별 시간: 다음 프레임이 정지로 기록되면 우리 코드 탓인지 함께 남긴다
        const t0 = performance.now();
        const events = this.guard('시뮬레이션', () => this.simulate(dt)) || [];
        const t1 = performance.now();
        this.guard('진단', () => this.noteFirsts(events, now));
        this.guard('장면 갱신', () => this.updateView(events, dt));
        const t2 = performance.now();
        if (this.mode === 'playing' || this.mode === 'paused') this.guard('HUD', () => this.updateHud(events));
        this.guard('오버레이', () => this.updateOverlay(dt));
        const t3 = performance.now();
        const p0 = this.programCount();
        // 셰이더를 굽는 중이거나 컨텍스트를 잃었으면 WebGL 렌더를 건너뛴다
        if (!this.warming && !this.glLost) this.guard('렌더', () => this.draw());
        const t4 = performance.now();
        this.lastWork = {
            sim: Math.round(t1 - t0),
            view: Math.round(t2 - t1),
            ui: Math.round(t3 - t2),
            draw: Math.round(t4 - t3),
            progs: this.programCount() - p0
        };
    }

    /** 지금까지 만든 셰이더 프로그램 수 */
    programCount() {
        return this.renderer?.renderer?.info?.programs?.length ?? 0;
    }

    /** 맵 준비 기록: 맵 짓기·셰이더 굽기 시간과 (세션 처음 한 번) GPU 정보 */
    noteWarm(r, ms, progs) {
        const st = this.state;
        this.diag.add('warm', {
            map: st.map?.name ?? st.mapId,
            build: Math.round(this.buildMs || 0),
            ms: Math.round(ms),
            sync: Math.round(r?.syncMs || 0),
            progs,
            timedOut: !!r?.timedOut,
            ...(this.gpuNoted ? {} : gpuInfo(this.renderer.renderer))
        });
        this.gpuNoted = true;
        this.buildMs = 0;
    }

    /** 이번 세션에서 처음 나온 적·타워 종류 (정지 원인을 좁히는 단서) */
    noteFirsts(events, now) {
        for (const ev of events) {
            let key = null;
            if (ev.type === 'spawn') key = `적:${ev.enemy}`;
            else if (ev.type === 'build' || ev.type === 'upgrade') {
                const t = findTower(this.state, ev.towerId);
                if (t) key = `타워:${t.type}${t.tier}${t.branch || ''}`;
            }
            if (!key || this.firstSeen.has(key)) continue;
            this.firstSeen.add(key);
            this.recentFirsts.push({ key, at: now });
        }
        while (this.recentFirsts.length && now - this.recentFirsts[0].at > RECENT_FIRST_MS) this.recentFirsts.shift();
    }

    noteStall(ms, now) {
        const st = this.state;
        this.diag.add('stall', {
            ms: Math.round(ms),
            map: st.map?.name ?? st.mapId,
            mode: this.mode,
            wave: st.waveIndex,
            enemies: st.enemies.length,
            recent: this.recentFirsts.filter((r) => now - r.at <= RECENT_FIRST_MS + ms).map((r) => r.key),
            work: this.lastWork
        });
    }

    /** 예외를 기록하고 삼킨다 (같은 오류는 한 번만 경고) */
    guard(where, fn) {
        try {
            return fn();
        } catch (e) {
            this.errors.report(where, e);
            return undefined;
        }
    }

    /** 고정 스텝 시뮬레이션. 한 프레임 스텝 수에 상한을 두고, 넘친 시간은 버린다. */
    simulate(dt) {
        const playing = this.mode === 'playing' && !this.loop.paused && !this.glLost;
        this.simDt = playing ? dt * this.loop.speed : 0;
        if (playing) {
            const plan = planSteps(this.acc, this.simDt, TICK);
            this.acc = plan.acc;
            for (let i = 0; i < plan.steps; i++) step(this.state, TICK);
        }
        const events = this.pending.concat(drainEvents(this.state));
        this.pending = [];
        return events;
    }

    updateView(events, dt) {
        const simDt = this.simDt;
        this.updateHover();
        this.entities.update(this.state, events, this.t, simDt || (this.mode === 'playing' ? 0 : dt * 0.3));
        this.effects.handle(events, this.state);
        this.rtdView.handle(events);
        this.effects.update(simDt || dt * 0.4, this.t, this.state);
        this.audio.handle(events, this.state);
        this.surv?.update(dt);
        this.rig.update(dt);
        this.world.update(this.t, dt);
        this.rtdView.update(this.t, this.state);
    }

    updateHud(events) {
        this.hud.handle(events, this.state);
        this.surv?.handle(events);
        this.rtdUi.handle(events, this.state, this.hud, this.overlay, this.audio.enabled ? this.audio : null);
        this.rtdUi.update(this.state);
        this.noteSpawns(events);
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

    updateOverlay(dt) {
        this.overlay.draw(
            this.mode === 'title' || this.mode === 'select' || this.mode === 'loading' ? { enemies: [] } : this.state,
            dt,
            this.hover.enemy?.id,
            this.selectedEnemy?.id
        );
        if (this.mode === 'playing' || this.mode === 'paused')
            this.rtdUi.drawOverlay(this.overlay, this.state, this.entities);
        // 메뉴 앵커
        if (this.radial.open) {
            const target = this.radial.target;
            const p = this.overlay.project(
                new THREE.Vector3(target.x, this.world.heightAt(target.x, target.z) + 0.9, target.z)
            );
            this.radial.update(p);
        }
        this.inspector.update(this.state);
        this.overlay.links = this.mode === 'playing' ? this.resonanceLinks() : null;
        this.overlay.ui = {
            heroSelected: this.heroSelected,
            rally: this.selected?.type === 'barracks' && this.selected.rally ? this.selected.rally : null
        };
        if (this.state.status !== 'playing' && this.mode === 'playing') {
            this.resultT = (this.resultT ?? 0) + dt;
            if (this.resultT > 1.8) this.showResults();
        }
    }

    draw() {
        this.renderer.render(this.t);
        if (this.wantThumb) {
            this.wantThumb = false;
            try {
                const url = this.renderer.renderer.domElement.toDataURL('image/jpeg', 0.7);
                this.thumbs[this.worldMap] = url;
                const el = this.uiRoot.querySelector(`[data-thumb="${this.worldMap}"]`);
                if (el) el.style.backgroundImage = `url(${url})`;
            } catch {
                /* 캡처 불가 시 무시 */
            }
        }
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
