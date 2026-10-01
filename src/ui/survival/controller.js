// 살아남기 화면 조작 (스타1 유즈맵처럼 RTS식):
// - 카메라: 화면 가장자리·WASD·드래그·휠·미니맵. Space = 본진(없으면 생존자), C = 생존자.
// - 생존자(일꾼) 한 명: 우클릭 = 그곳으로 이동(절벽을 돌아가는 길을 찾는다), 다친·짓다 만 건물을 우클릭 = 수리·마저 짓기.
//   Shift+우클릭은 줄에 넣는다.
// - 건설: B(본진, 맨 처음) · 1~7 또는 건설 막대 → 고스트 → 클릭. 생존자가 그 자리로 걸어가 짓는다.
//   방벽은 끌어서 줄로 예약하면 차례로 짓는다. 건설 모드에서는 커서 둘레에 격자(지을 곳·절벽·비탈)가 깔린다.
// 앱(app.js)은 이 모드일 때 클릭·키·우클릭을 먼저 여기로 넘긴다. 처리했으면 true를 돌려준다.
import * as THREE from 'three';
import { TOWERS } from '../../core/data/towers.js';
import { checkPlacement, orderBuild, orderMove, orderRepair, rampStates, workerOrders } from '../../core/game.js';
import { snapFootprint, sizeOf, formatClock, WORKER } from '../../core/survival.js';
import { RAMP_LEN } from '../../core/snowfield.js';
import { ICONS, TOWER_TINT } from '../icons.js';
import { Minimap } from './minimap.js';
import './survival.css';

/** 건설 막대 순서 (숫자 키 1~7) */
export const BUILD_ORDER = ['wall', 'ranger', 'ember', 'frost', 'storm', 'arcane', 'mine'];
const EDGE = 10;
const MIN_DIST = 14;
const MAX_DIST = 52;
const TASK = { idle: '쉬는 중', move: '이동 중', build: '짓는 중', repair: '수리 중', wait: '적이 비키길 기다리는 중' };

export class SurvivalUI {
    constructor(app) {
        this.app = app;
        this.state = app.state;
        const sv = this.state.survival;
        this.f = sv.field;
        this.placing = null;
        this.drag = null;
        this.mouse = { x: 0, y: 0, seen: false, inWindow: false };
        this.bossWarned = -1;
        this.v = new THREE.Vector3();

        const root = (this.root = document.createElement('div'));
        root.className = 'sv-ui';
        app.uiRoot.appendChild(root);
        this.minimap = new Minimap(root, {
            state: this.state,
            world: app.world,
            rig: app.rig,
            onJump: (x, z) => this.lookAt(x, z)
        });
        this.buildBar();
        this.workerCard();
        this.warn = document.createElement('div');
        this.warn.className = 'sv-warn';
        root.appendChild(this.warn);
        this.labels = document.createElement('div');
        this.labels.className = 'sv-labels';
        root.appendChild(this.labels);
        // 생존자 머리 위 체력·하는 일
        this.wTag = document.createElement('div');
        this.wTag.className = 'sv-wtag';
        this.wTag.innerHTML = '<i class="bar"><b></b></i><span></span>';
        this.labels.appendChild(this.wTag);
        // 비탈 봉쇄 표시 (고원 비탈만)
        this.rampTags = this.f.ramps
            .filter((r) => r.owner !== 'basin')
            .map((r) => {
                const el = document.createElement('div');
                el.className = 'sv-ramp';
                this.labels.appendChild(el);
                const mid = r.rows[Math.floor(RAMP_LEN / 2)];
                const k = mid[Math.floor(mid.length / 2)];
                const p = this.f.toWorld(k % this.f.N, Math.floor(k / this.f.N));
                return { r, el, x: p.x, z: p.z, top: r.rows[0][0], state: '' };
            });
        document.body.classList.add('sv-mode');

        // 클릭한 곳 표시 (우클릭 이동)
        const ring = new THREE.Mesh(
            new THREE.RingGeometry(0.35, 0.5, 24),
            new THREE.MeshBasicMaterial({ color: 0x7fe0ff, transparent: true, opacity: 0, depthWrite: false })
        );
        ring.rotation.x = -Math.PI / 2;
        ring.renderOrder = 7;
        app.world.scene.add(ring);
        this.marker = { mesh: ring, t: 9 };

        // 카메라: 맵 전체를 자유롭게, 생존자에게서 시작
        const rig = app.rig;
        const h = this.f.half;
        rig.rect = { x0: -h + 10, x1: h - 10, z0: -h + 6, z1: h - 2 };
        rig.minDistance = MIN_DIST;
        rig.maxDistance = MAX_DIST;
        rig.setPitch(52);
        const w = sv.worker;
        this.lookAt(w.x, w.z, 28);

        // 입력
        const dom = app.renderer.renderer.domElement;
        this.dom = dom;
        this.on = [];
        const listen = (target, type, fn, opt) => {
            target.addEventListener(type, fn, opt);
            this.on.push([target, type, fn, opt]);
        };
        listen(window, 'pointermove', (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
            this.mouse.seen = true;
            this.mouse.inWindow = true;
            this.mouse.overCanvas = e.target === dom;
        });
        listen(document, 'pointerleave', () => (this.mouse.inWindow = false));
        listen(window, 'blur', () => (this.mouse.inWindow = false));
        listen(dom, 'pointerdown', (e) => this.onDown(e));
        listen(window, 'pointerup', (e) => this.onUp(e));
        this.refreshBar();
        app.hud.showHint(
            '맵 한가운데 둥지 곁에서 <b>생존자</b> 한 명으로 시작합니다. <b>우클릭</b>으로 움직여 안개를 걷고, 절벽에 둘러싸인 <b>고원</b>을 찾아 <b>B</b>로 본진을 지으세요. 고원으로 오르는 길은 <b>비탈</b>(다져진 흙길)뿐입니다. 둥지는 ' +
                formatClock(this.state.waves[0].at) +
                ' 뒤에 깨어납니다.',
            14000
        );
    }

    destroy() {
        for (const [t, type, fn, opt] of this.on) t.removeEventListener(type, fn, opt);
        this.root.remove();
        document.body.classList.remove('sv-mode');
        const rig = this.app.rig;
        rig.rect = null;
        rig.minDistance = 13;
        rig.maxDistance = 40;
        rig.dragLock = false;
        rig.shift = 0;
        this.app.world.buildings?.setGhost(null);
        this.app.world.buildGrid?.update(null);
        this.marker.mesh.removeFromParent();
        this.marker.mesh.geometry.dispose();
        this.marker.mesh.material.dispose();
        // 이 모드의 조작 안내가 다음 판까지 남지 않게
        const hud = this.app.hud;
        clearTimeout(hud.hintT);
        hud.$.hint.classList.remove('show');
    }

    // ---------- 화면 구성 ----------
    buildBar() {
        const el = (this.bar = document.createElement('div'));
        el.className = 'sv-build panel';
        const btn = (type, key, name, sub, cost) =>
            `<button class="sv-bt" data-type="${type}" style="--tint:${TOWER_TINT[type] || '#ffd27a'}" title="${name}">
                <span class="hk">${key}</span><i class="ico">${type === 'base' ? ICONS.shield : ICONS[type]}</i>
                <span class="nm">${name}<em>${sub}</em></span>
                <span class="c">${cost == null ? '무료' : ICONS.gold + cost}</span></button>`;
        el.innerHTML =
            `<div class="sv-build-title">건설 <small>생존자가 가서 짓는다</small></div>` +
            btn('base', 'B', '본진', '4×4 · 맨 처음', null) +
            BUILD_ORDER.map((type, n) => {
                const def = TOWERS[type];
                const size = sizeOf(type);
                return btn(
                    type,
                    n + 1,
                    def.name,
                    `${size}×${size}${type === 'mine' ? ' · 광맥' : ''}`,
                    def.tiers[0].cost
                );
            }).join('') +
            `<div class="sv-build-tip">우클릭·Esc 취소 · 방벽은 끌어서 줄로 · Shift 연속</div>`;
        this.root.appendChild(el);
        this.btns = [...el.querySelectorAll('[data-type]')];
        for (const b of this.btns)
            b.addEventListener('click', () => this.arm(this.placing === b.dataset.type ? null : b.dataset.type));
    }

    workerCard() {
        const el = (this.card = document.createElement('button'));
        el.className = 'sv-worker panel';
        el.title = '생존자 (C) · 누르면 카메라가 따라갑니다';
        el.innerHTML = `<span class="hk">C</span><i class="face"></i>
            <span class="txt"><b>생존자</b><small data-w-task></small><i class="bar"><b data-w-hp></b></i></span>
            <span class="q" data-w-q></span>`;
        this.root.appendChild(el);
        this.cardTask = el.querySelector('[data-w-task]');
        this.cardHp = el.querySelector('[data-w-hp]');
        this.cardQ = el.querySelector('[data-w-q]');
        el.addEventListener('click', () => this.focusWorker());
    }

    focusWorker() {
        const w = this.state.survival.worker;
        if (w.alive) this.lookAt(w.x, w.z);
        else if (this.state.survival.base) this.lookAt(this.state.survival.base.x, this.state.survival.base.z);
    }

    lookAt(x, z, dist = null) {
        const rig = this.app.rig;
        rig.goal.x = x;
        rig.goal.z = z + 1;
        if (dist) rig.goalDistance = dist;
        rig.clampGoal();
        rig.intro = null;
    }

    hasBase() {
        const sv = this.state.survival;
        return !!sv.base || workerOrders(sv).some((o) => o.type === 'build' && o.btype === 'base');
    }

    arm(type) {
        if (type && type !== 'base' && !this.hasBase()) {
            this.app.hud.toast('먼저 고원을 찾아 본진(B)을 지으세요.', true);
            type = 'base';
        }
        if (type === 'base' && this.hasBase()) {
            this.app.hud.toast('본진은 하나만 세울 수 있습니다.', true);
            type = null;
        }
        this.placing = type;
        this.drag = null;
        this.app.closeMenus();
        this.app.rig.dragLock = !!type;
        this.refreshBar();
        if (!type) {
            this.app.world.buildings.setGhost(null);
            this.app.world.buildGrid.update(null);
        } else this.updateGhost();
    }

    refreshBar() {
        const base = this.hasBase();
        this.bar.classList.toggle('nobase', !base);
        for (const b of this.btns) {
            const type = b.dataset.type;
            b.classList.toggle('on', this.placing === type);
            if (type === 'base') {
                b.classList.toggle('hide', base);
                continue;
            }
            b.classList.toggle('poor', this.state.gold < TOWERS[type].tiers[0].cost || !base);
        }
    }

    // ---------- 입력 ----------
    cellUnderMouse(size) {
        const p = this.app.groundPoint(this.mouse.x, this.mouse.y);
        if (!p) return null;
        return snapFootprint(this.f, p.x, p.z, size);
    }

    /** 벽 줄: 두 칸 사이를 잇는 칸들 (브레젠험) */
    line(a, b) {
        const out = [];
        let x0 = a.i;
        let y0 = a.j;
        const dx = Math.abs(b.i - x0);
        const dy = -Math.abs(b.j - y0);
        const sx = x0 < b.i ? 1 : -1;
        const sy = y0 < b.j ? 1 : -1;
        let err = dx + dy;
        for (let n = 0; n < 64; n++) {
            out.push({ i: x0, j: y0 });
            if (x0 === b.i && y0 === b.j) break;
            const e2 = 2 * err;
            if (e2 >= dy) {
                err += dy;
                x0 += sx;
            }
            if (e2 <= dx) {
                err += dx;
                y0 += sy;
            }
        }
        return out;
    }

    plan() {
        const type = this.placing;
        if (!type) return [];
        const size = type === 'base' ? this.state.survival.cfg.baseSize : sizeOf(type);
        const cur = this.cellUnderMouse(size);
        if (!cur) return [];
        const cells = this.drag && type === 'wall' ? this.line(this.drag.start, cur) : [cur];
        return cells.map((c) => ({
            ...c,
            chk: checkPlacement(this.state, type, c.i, c.j, { plan: true }),
            size,
            type
        }));
    }

    updateGhost() {
        const world = this.app.world;
        if (!this.placing || !this.mouse.overCanvas) {
            world.buildings.setGhost(null);
            world.buildGrid.update(null);
            return;
        }
        const plan = this.plan();
        world.buildings.setGhost(plan.map((p) => ({ cells: p.chk.cells, size: p.size, type: p.type })));
        const c = this.cellUnderMouse(1);
        world.buildGrid.update(c ? c.i : null, c ? c.j : null);
        // 타워는 사거리도 보여 준다
        const p = plan[0];
        if (p && TOWERS[p.type] && TOWERS[p.type].tiers[0].range) {
            const at = {
                x: -this.f.half + (p.i + p.size / 2) * this.f.T,
                z: -this.f.half + (p.j + p.size / 2) * this.f.T
            };
            const r = TOWERS[p.type].tiers[0].range * (this.state.survival.cfg.rangeMul ?? 1);
            world.showRange({ x: at.x, z: at.z, r, color: TOWER_TINT[p.type] });
        } else if (!this.app.selected) world.showRange(null);
    }

    onDown(e) {
        if (e.button !== 0 || this.app.mode !== 'playing') return;
        if (this.placing === 'wall') {
            const c = this.cellUnderMouse(1);
            if (c) this.drag = { start: c };
        }
    }

    onUp(e) {
        if (e.button !== 0 || !this.drag) return;
        this.commit();
        this.drag = null;
        this.swallowClick = true;
    }

    /** 고스트대로 생존자에게 건설 주문을 넣는다 (줄 끝에 차례로) */
    commit() {
        const plan = this.plan();
        let ordered = 0;
        let reason = null;
        for (const p of plan) {
            if (!p.chk.ok) {
                reason ??= p.chk.reason;
                continue;
            }
            const r = orderBuild(this.state, this.placing, p.i, p.j, true);
            if (r.ok) ordered++;
            else reason ??= r.reason;
            if (!r.ok && r.reason === '골드가 부족합니다.') break;
        }
        if (reason && (!ordered || reason === '골드가 부족합니다.')) this.app.hud.toast(reason, true);
        return ordered;
    }

    /** 앱의 클릭을 먼저 받는다 */
    onClick(e) {
        if (this.swallowClick) {
            this.swallowClick = false;
            return true;
        }
        if (this.placing) {
            const n = this.commit();
            // 본진·타워·광산은 한 번 주문하면 끝 (Shift를 누르고 있으면 계속)
            if (n && (this.placing === 'base' || (this.placing !== 'wall' && !e.shiftKey))) this.arm(null);
            this.refreshBar();
            return true;
        }
        // 건물 고르기 (방벽은 인스턴스라 칸으로 찾는다)
        const p = this.app.groundPoint(e.clientX, e.clientY);
        if (!p) return false;
        const k = this.f.cellAt(p.x, p.z);
        if (k < 0) return false;
        const id = this.state.survival.occ[k];
        if (id === -1) {
            if (this.app.selectedBase) this.app.closeMenus();
            else this.app.selectBase();
            return true;
        }
        if (id > 0) {
            const t = this.state.towers.find((x) => x.id === id);
            if (t) {
                if (this.app.selected === t) this.app.closeMenus();
                else this.app.selectTower(t);
                return true;
            }
        }
        return false;
    }

    /** 우클릭: 건설 중이면 취소, 아니면 생존자 명령 (땅 = 이동, 다친·짓다 만 건물 = 수리·마저 짓기) */
    cancel(e) {
        if (this.placing) {
            this.arm(null);
            return true;
        }
        if (!e || this.app.rig.dragging) return true;
        const p = this.app.groundPoint(e.clientX, e.clientY);
        if (!p) return true;
        const sv = this.state.survival;
        const k = this.f.cellAt(p.x, p.z);
        if (k < 0) return true;
        const id = sv.occ[k];
        const b = id === -1 ? sv.base : id > 0 ? this.state.towers.find((t) => t.id === id) : null;
        let r;
        if (b) {
            const hurt = b === sv.base ? this.state.lives < this.state.maxLives : b.hp < b.maxHp;
            r = b.build || hurt ? orderRepair(this.state, b, e.shiftKey) : orderMove(this.state, p.x, p.z, e.shiftKey);
            if (r.ok && (b.build || hurt))
                this.app.hud.toast(b.build ? '생존자가 마저 지으러 갑니다' : '생존자가 수리하러 갑니다');
        } else r = orderMove(this.state, p.x, p.z, e.shiftKey);
        if (!r.ok) this.app.hud.toast(r.reason, true);
        else this.mark(p.x, p.z);
        return true;
    }

    /** 우클릭한 곳에 잠깐 고리 */
    mark(x, z) {
        const m = this.marker;
        m.t = 0;
        m.mesh.position.set(x, this.app.world.heightAt(x, z) + 0.08, z);
    }

    /** 수리 명령 (정보 창의 수리 단추·G 키): 예약한 건설은 그대로 두고 지금 하던 일 바로 다음에 */
    repair(target) {
        const r = orderRepair(this.state, target, 'front');
        if (!r.ok) this.app.hud.toast(r.reason, true);
        else this.app.hud.toast(target.build ? '생존자가 마저 지으러 갑니다' : '생존자가 수리하러 갑니다');
    }

    onKey(e) {
        const k = e.key;
        if (k === 'Escape' && this.placing) {
            this.arm(null);
            return true;
        }
        if (/^[1-7]$/.test(k)) {
            const type = BUILD_ORDER[Number(k) - 1];
            this.arm(this.placing === type ? null : type);
            return true;
        }
        const low = k.toLowerCase();
        if (low === 'b') {
            this.arm(this.placing === 'base' ? null : 'base');
            return true;
        }
        if (low === 'c') {
            this.focusWorker();
            return true;
        }
        // WASD는 카메라 (CameraRig가 누른 키를 기억한다)
        if (['w', 'a', 's', 'd'].includes(low)) return true;
        if (low === 'e') {
            this.app.useSkill('freeze');
            return true;
        }
        if (k === ' ') {
            e.preventDefault();
            const b = this.state.survival.base;
            if (b) this.lookAt(b.x, b.z);
            else this.focusWorker();
            return true;
        }
        return false;
    }

    /** 이번 프레임의 게임 이벤트 (생존자·본진 알림) */
    handle(events) {
        const hud = this.app.hud;
        for (const ev of events) {
            if (ev.type === 'workerFail') hud.toast(ev.reason, true);
            else if (ev.type === 'workerDied')
                hud.toast(
                    ev.respawn
                        ? `생존자가 쓰러졌다! ${WORKER.respawn}초 뒤 본진에서 다시 일어납니다`
                        : '생존자가 쓰러졌다',
                    true
                );
            else if (ev.type === 'workerRespawn') hud.toast('생존자가 본진에서 다시 일어났다');
            else if (ev.type === 'baseStarted') hud.toast('본진을 짓기 시작했다');
            else if (ev.type === 'baseBuilt') {
                hud.toast('본진을 다 지었다 · 비탈을 방벽으로 막아라');
                hud.showHint(
                    '<b>1</b> 방벽(끌어서 줄로 예약) · <b>2~6</b> 타워 · <b>7</b> 광산(금빛 광맥 위). 고원으로 오르는 <b>비탈</b>을 가로질러 방벽 한 줄을 세우면 막힙니다(<b>봉쇄됨</b> 표시). 적은 가장 가까운 건물을 노리고, 길이 막혀 있으면 <b>방벽부터 부숩니다</b>. 다친 건물은 <b>우클릭</b>으로 생존자가 고칩니다. 본진을 눌러 <b>채굴 기술</b>을 올리세요.',
                    14000
                );
                this.refreshBar();
            } else if (ev.type === 'mineTech') hud.toast(`채굴 기술 ${ev.level}단계 · 광산 수입이 늘었다`);
        }
    }

    // ---------- 매 프레임 ----------
    update(dt) {
        const app = this.app;
        const rig = app.rig;
        const sv = this.state.survival;
        if (app.mode === 'playing') {
            // WASD·화면 가장자리로 이동 (실제 마우스가 들어온 뒤에만)
            const pan = 26 * dt * (rig.distance / 30);
            const keys = rig.keys;
            let mx = 0;
            let mz = 0;
            if (keys.has('a')) mx -= 1;
            if (keys.has('d')) mx += 1;
            if (keys.has('w')) mz -= 1;
            if (keys.has('s')) mz += 1;
            const m = this.mouse;
            if (m.seen && m.inWindow && !this.drag) {
                const W = window.innerWidth;
                const H = window.innerHeight;
                if (m.x <= EDGE) mx -= 1;
                if (m.x >= W - EDGE) mx += 1;
                if (m.y <= EDGE) mz -= 1;
                if (m.y >= H - EDGE) mz += 1;
            }
            if (mx || mz) {
                rig.goal.x += mx * pan;
                rig.goal.z += mz * pan;
                rig.clampGoal();
            }
        }
        // 카메라 눈높이를 땅 높이에 맞춘다 (고원을 볼 때 화면이 위로 쏠리지 않게)
        let hy = 0;
        for (const [ox, oz] of [
            [0, 0],
            [5, 0],
            [-5, 0],
            [0, 5],
            [0, -5]
        ])
            hy += app.world.heightAt(rig.goal.x + ox, rig.goal.z + oz);
        rig.goal.y += (hy / 5 - rig.goal.y) * Math.min(1, dt * 3);
        this.updateGhost();
        this.refreshBarThrottled(dt);
        // 보스 30초 전 경고
        const next = this.state.waves[this.state.waveIndex];
        const bossNext = next && next.groups.some((g) => g.enemy === 'glacier');
        const playing = this.state.status === 'playing';
        const soon = playing && bossNext && next.at - sv.clock <= 30 && next.at - sv.clock > 0;
        if (soon && this.bossWarned !== this.state.waveIndex) {
            this.bossWarned = this.state.waveIndex;
            app.hud.toast('30초 뒤 둥지에서 빙하 거신이 깨어납니다!', true);
        }
        const warnTxt = soon ? `보스 접근 · ${Math.ceil(next.at - sv.clock)}초` : '';
        if (this.warn.textContent !== warnTxt) {
            this.warn.textContent = warnTxt;
            this.warn.classList.toggle('show', !!warnTxt);
        }
        this.minimap.update(dt, { bossSoon: soon, plans: workerOrders(sv) });
        this.updateWorkerUi();
        this.updateRampTags();
        // 우클릭 고리
        const mk = this.marker;
        mk.t += dt;
        mk.mesh.material.opacity = Math.max(0, 0.9 - mk.t * 1.6);
        mk.mesh.scale.setScalar(1 + mk.t * 0.8);
    }

    /** 화면 좌표로 (가려지면 null) */
    screenOf(x, y, z) {
        const p = this.app.overlay.project(this.v.set(x, y, z));
        if (p.behind || p.x < -60 || p.y < -60 || p.x > window.innerWidth + 60 || p.y > window.innerHeight + 60)
            return null;
        return p;
    }

    updateWorkerUi() {
        const sv = this.state.survival;
        const w = sv.worker;
        const o = w.order;
        const building = o && o.type === 'build' && o.started && o.target?.build;
        const pct = building ? Math.round((o.target.build.t / o.target.build.T) * 100) : null;
        let task = w.alive ? TASK[w.task] || '' : `쓰러짐 · ${Math.ceil(w.respawnT)}초 뒤 부활`;
        if (w.alive && building) task = `짓는 중 ${pct}%`;
        if (!w.alive && !sv.base) task = '쓰러짐';
        const q = workerOrders(sv).filter((x) => x.type === 'build' && !x.started).length;
        const key = `${task}|${Math.ceil(w.hp)}|${q}`;
        if (key !== this.cardKey) {
            this.cardKey = key;
            this.cardTask.textContent = task;
            this.cardHp.style.width = `${Math.max(0, (w.hp / w.maxHp) * 100)}%`;
            this.cardQ.textContent = q ? `예약 ${q}` : '';
            this.card.classList.toggle('dead', !w.alive);
            this.card.classList.toggle('hurt', w.alive && w.hp < w.maxHp * 0.4);
        }
        // 머리 위 표시
        const tag = this.wTag;
        const p = w.alive ? this.screenOf(w.x, this.app.world.heightAt(w.x, w.z) + 1.3, w.z) : null;
        tag.style.display = p ? '' : 'none';
        if (!p) return;
        tag.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px) translate(-50%, -100%)`;
        const txt = building ? `${pct}%` : w.task === 'repair' ? '수리' : '';
        if (tag.dataset.k !== `${Math.ceil(w.hp)}|${txt}`) {
            tag.dataset.k = `${Math.ceil(w.hp)}|${txt}`;
            tag.querySelector('b').style.width = `${(w.hp / w.maxHp) * 100}%`;
            tag.querySelector('span').textContent = txt;
            tag.classList.toggle('hurt', w.hp < w.maxHp * 0.4);
        }
    }

    /** 비탈 봉쇄 표시: 막힌 비탈은 '봉쇄됨', 건설 모드에서는 아직 열린 비탈에 '열림' */
    updateRampTags() {
        const sv = this.state.survival;
        const sealed = rampStates(sv);
        for (const t of this.rampTags) {
            const seen = sv.fog.explored[t.top];
            const s = sealed[t.r.n];
            const want = !seen ? '' : s ? 'sealed' : this.placing ? 'open' : '';
            const p = want ? this.screenOf(t.x, this.f.heightAt(t.x, t.z) + 1.1, t.z) : null;
            t.el.style.display = p ? '' : 'none';
            if (!p) continue;
            t.el.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px) translate(-50%, -100%)`;
            if (t.state !== want) {
                t.state = want;
                t.el.className = `sv-ramp ${want}`;
                t.el.textContent = want === 'sealed' ? '봉쇄됨' : '열림';
            }
        }
    }

    refreshBarThrottled(dt) {
        this.barT = (this.barT || 0) - dt;
        if (this.barT > 0) return;
        this.barT = 0.2;
        this.refreshBar();
    }
}
