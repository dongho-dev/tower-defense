// 살아남기 화면 조작 (스타1 유즈맵처럼 RTS식):
// - 카메라: 화면 가장자리(창 크기에 맞춘 띠, 끝에 가까울수록 빠르게) · WASD · 오른쪽/가운데 끌기 · 휠 · 미니맵 클릭·끌기.
//   Space = 본진(없으면 생존자), C = 생존자 모두 고르고 따라가기.
// - 고르기: 왼쪽 클릭 = 생존자 한 명(Shift는 더하기·빼기), 왼쪽 끌기 = 사각형 안의 생존자 모두. 빈 땅 클릭·Esc = 해제.
// - 명령: 우클릭 = 고른 생존자들이 그곳으로 (조금씩 흩어져 선다), 다친·짓다 만 건물을 우클릭 = 수리·마저 짓기.
//   Shift+우클릭은 줄에 넣는다. 끌었다 놓은 오른쪽 버튼은 카메라 이동이라 명령을 내리지 않는다.
//   아무도 고르지 않았고 생존자가 한 명뿐이면 그 생존자에게 명령한다.
// - 건설: B(본진, 맨 처음) · 1~7 또는 건설 막대 → 고스트 → 클릭. 고른 생존자 가운데 가장 가까운 이가 가서 짓는다.
//   방벽(1)은 비탈 어귀에 대면 그 입구 전체를 덮는 큰 벽 하나로 맞춰진다. 건설 중 왼쪽 동작은 배치가 먼저다.
// 앱(app.js)은 이 모드일 때 클릭·키·우클릭을 먼저 여기로 넘긴다. 처리했으면 true를 돌려준다.
import * as THREE from 'three';
import { TOWERS } from '../../core/data/towers.js';
import { checkPlacement, orderBuild, orderMove, orderRepair, rampStates, workerOrders } from '../../core/game.js';
import { snapFootprint, sizeOf, formatClock, WORKER } from '../../core/survival.js';
import { RAMP_LEN } from '../../core/snowfield.js';
import { ICONS, TOWER_TINT } from '../icons.js';
import { Minimap } from './minimap.js';
import { keyOf } from '../keys.js';
import './survival.css';

/** 건설 막대 순서 (숫자 키 1~7) */
export const BUILD_ORDER = ['wall', 'ranger', 'ember', 'frost', 'storm', 'arcane', 'mine'];
const MIN_DIST = 14;
const MAX_DIST = 52;
/** 이만큼(px) 움직이면 클릭이 아니라 끌기 */
const DRAG_PX = 6;
const TASK = { idle: '쉬는 중', move: '이동 중', build: '짓는 중', repair: '수리 중', wait: '적이 비키길 기다리는 중' };

/** 화면 가장자리 이동 띠의 폭(px): 창이 작아도 커서를 쉽게 댈 수 있게 짧은 변의 3% (18~32px) */
export function edgeWidth(w, h) {
    return Math.round(Math.min(32, Math.max(18, Math.min(w, h) * 0.03)));
}

/** 여럿에게 이동 명령을 줄 때 흩어 설 자리 (가운데 한 명, 둘레에 고리로) */
function spreadOffsets(n, gap) {
    const out = [[0, 0]];
    for (let ring = 1; out.length < n; ring++) {
        const m = ring * 6;
        for (let k = 0; k < m && out.length < n; k++) {
            const a = (k / m) * Math.PI * 2 + ring * 0.4;
            out.push([Math.cos(a) * ring * gap, Math.sin(a) * ring * gap]);
        }
    }
    return out;
}

export class SurvivalUI {
    constructor(app) {
        this.app = app;
        this.state = app.state;
        const sv = this.state.survival;
        this.f = sv.field;
        this.placing = null;
        this.box = null;
        this.mouse = { x: 0, y: 0, seen: false, inWindow: false };
        this.bossWarned = -1;
        this.v = new THREE.Vector3();
        // 고른 생존자 id (렌더러의 발밑 고리와 같은 모음을 쓴다)
        this.sel = app.world.worker.selected;
        this.sel.clear();
        this.sel.add(sv.worker.id);

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
        // 생존자 머리 위 체력·하는 일 (생존자마다)
        this.wTags = new Map();
        // 범위 선택 사각형
        this.boxEl = document.createElement('div');
        this.boxEl.className = 'sv-box';
        root.appendChild(this.boxEl);
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

        // 카메라: 맵 전체를 자유롭게, 생존자에게서 시작. 왼쪽 끌기는 범위 선택이라 카메라는 오른쪽·가운데 끌기로
        const rig = app.rig;
        const h = this.f.half;
        rig.rect = { x0: -h + 10, x1: h - 10, z0: -h + 6, z1: h - 2 };
        rig.minDistance = MIN_DIST;
        rig.maxDistance = MAX_DIST;
        rig.leftPan = false;
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
            if (this.box) this.dragBox(e);
        });
        // 커서가 창 밖으로 나가면 가장자리 이동을 멈춘다 (마지막 자리가 가장자리여도)
        listen(document, 'pointerleave', () => (this.mouse.inWindow = false));
        listen(document.documentElement, 'mouseleave', () => (this.mouse.inWindow = false));
        listen(window, 'blur', () => {
            this.mouse.inWindow = false;
            this.endBox(null);
        });
        listen(dom, 'pointerdown', (e) => this.onDown(e));
        listen(window, 'pointerup', (e) => this.onUp(e));
        this.refreshBar();
        app.hud.showHint(
            '맵 한가운데 둥지 곁에서 <b>생존자</b> 한 명으로 시작합니다. <b>우클릭</b>으로 움직여 안개를 걷고, 절벽에 둘러싸인 <b>고원</b>을 찾아 <b>B</b>로 본진을 지으세요. 고원으로 오르는 길은 <b>비탈</b>(다져진 흙길)뿐입니다. 화면은 <b>가장자리</b>·<b>WASD</b>·<b>오른쪽 끌기</b>로, 생존자는 <b>왼쪽 끌기</b>로 고릅니다. 둥지는 ' +
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
        rig.leftPan = true;
        rig.shift = 0;
        this.sel.clear();
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
                const sub = type === 'wall' ? '비탈 입구 하나' : `${size}×${size}${type === 'mine' ? ' · 광맥' : ''}`;
                return btn(type, n + 1, def.name, sub, def.tiers[0].cost);
            }).join('') +
            `<div class="sv-build-tip">우클릭·Esc 취소 · 방벽은 비탈 어귀에 · Shift 연속</div>`;
        this.root.appendChild(el);
        this.btns = [...el.querySelectorAll('[data-type]')];
        for (const b of this.btns)
            b.addEventListener('click', () => this.arm(this.placing === b.dataset.type ? null : b.dataset.type));
    }

    workerCard() {
        const el = (this.card = document.createElement('button'));
        el.className = 'sv-worker panel';
        el.title = '생존자 (C) · 누르면 생존자를 모두 고르고 카메라가 따라갑니다';
        el.innerHTML = `<span class="hk">C</span><i class="face"></i>
            <span class="txt"><b data-w-name>생존자</b><small data-w-task></small><i class="bar"><b data-w-hp></b></i></span>
            <span class="q" data-w-q></span>`;
        this.root.appendChild(el);
        this.cardName = el.querySelector('[data-w-name]');
        this.cardTask = el.querySelector('[data-w-task]');
        this.cardHp = el.querySelector('[data-w-hp]');
        this.cardQ = el.querySelector('[data-w-q]');
        el.addEventListener('click', () => this.focusWorker());
    }

    /** 생존자를 모두 고르고 (첫 생존자에게) 카메라를 옮긴다 */
    focusWorker() {
        const sv = this.state.survival;
        const alive = sv.workers.filter((w) => w.alive);
        if (alive.length) {
            this.sel.clear();
            for (const w of alive) this.sel.add(w.id);
            const lead = this.lead();
            this.lookAt(lead.x, lead.z);
        } else if (sv.base) this.lookAt(sv.base.x, sv.base.z);
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
        this.endBox(null);
        this.app.closeMenus();
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

    // ---------- 고르기 ----------
    /** 고른 생존자들 (산 사람만). 아무도 없고 생존자가 한 명뿐이면 그 한 명 */
    selected() {
        const sv = this.state.survival;
        const out = sv.workers.filter((w) => w.alive && this.sel.has(w.id));
        if (!out.length && !this.sel.size) {
            const alive = sv.workers.filter((w) => w.alive);
            if (alive.length === 1) return alive;
        }
        return out;
    }

    /** 카드·명령의 대표 생존자: 고른 생존자 중 처음, 없으면 처음 생존자 */
    lead() {
        const sv = this.state.survival;
        return sv.workers.find((w) => this.sel.has(w.id) && w.alive) ?? sv.worker;
    }

    /** 화면 좌표의 생존자 (몸 가운데에서 24px 안, 가장 가까운) */
    workerAt(x, y) {
        let best = null;
        let bd = 24;
        for (const w of this.state.survival.workers) {
            if (!w.alive) continue;
            const p = this.app.overlay.project(this.v.set(w.x, this.app.world.heightAt(w.x, w.z) + 0.5, w.z));
            if (p.behind) continue;
            const d = Math.hypot(p.x - x, p.y - y);
            if (d < bd) {
                bd = d;
                best = w;
            }
        }
        return best;
    }

    dragBox(e) {
        const b = this.box;
        b.x1 = e.clientX;
        b.y1 = e.clientY;
        if (!b.active && Math.hypot(b.x1 - b.x0, b.y1 - b.y0) < DRAG_PX) return;
        b.active = true;
        const el = this.boxEl;
        el.style.display = 'block';
        el.style.transform = `translate(${Math.min(b.x0, b.x1)}px, ${Math.min(b.y0, b.y1)}px)`;
        el.style.width = `${Math.abs(b.x1 - b.x0)}px`;
        el.style.height = `${Math.abs(b.y1 - b.y0)}px`;
    }

    /** 범위 선택을 끝낸다. e가 있으면 사각형 안의 생존자를 고른다 */
    endBox(e) {
        const b = this.box;
        this.box = null;
        this.boxEl.style.display = 'none';
        if (!b || !b.active || !e) return false;
        const x0 = Math.min(b.x0, b.x1) - 6;
        const x1 = Math.max(b.x0, b.x1) + 6;
        const y0 = Math.min(b.y0, b.y1) - 6;
        const y1 = Math.max(b.y0, b.y1) + 6;
        const hit = [];
        for (const w of this.state.survival.workers) {
            if (!w.alive) continue;
            const p = this.app.overlay.project(this.v.set(w.x, this.app.world.heightAt(w.x, w.z) + 0.5, w.z));
            if (!p.behind && p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1) hit.push(w);
        }
        if (!e.shiftKey) this.sel.clear();
        for (const w of hit) this.sel.add(w.id);
        if (hit.length) this.app.closeMenus();
        return true;
    }

    // ---------- 입력 ----------
    cellUnderMouse(size) {
        const p = this.app.groundPoint(this.mouse.x, this.mouse.y);
        if (!p) return null;
        return snapFootprint(this.f, p.x, p.z, size);
    }

    plan() {
        const type = this.placing;
        if (!type) return null;
        const size = type === 'base' ? this.state.survival.cfg.baseSize : sizeOf(type);
        const cur = this.cellUnderMouse(size);
        if (!cur) return null;
        // 방벽은 누른 칸이 속한 비탈의 입구 전체로 맞춰진다 (checkPlacement가 자리를 돌려준다)
        const chk = checkPlacement(this.state, type, cur.i, cur.j, { plan: true });
        return { i: chk.i ?? cur.i, j: chk.j ?? cur.j, cw: chk.cw ?? size, ch: chk.ch ?? size, chk, size, type };
    }

    updateGhost() {
        const world = this.app.world;
        if (!this.placing || !this.mouse.overCanvas) {
            world.buildings.setGhost(null);
            world.buildGrid.update(null);
            return;
        }
        const p = this.plan();
        world.buildings.setGhost(p ? [{ cells: p.chk.cells, i: p.i, j: p.j, cw: p.cw, ch: p.ch, type: p.type }] : null);
        const c = this.cellUnderMouse(1);
        world.buildGrid.update(c ? c.i : null, c ? c.j : null);
        // 타워는 사거리도 보여 준다
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
        // 건설 중에는 왼쪽 동작이 배치다 (클릭으로 놓는다)
        if (this.placing) return;
        this.box = { x0: e.clientX, y0: e.clientY, x1: e.clientX, y1: e.clientY, active: false };
    }

    onUp(e) {
        if (e.button !== 0 || !this.box) return;
        if (this.endBox(e)) this.swallowClick = true;
    }

    /** 이 건설을 맡을 생존자: 고른 생존자 가운데 그 자리에서 가장 가까운 이 */
    builderFor(i, j) {
        const list = this.selected();
        if (!list.length) return null;
        const x = -this.f.half + (i + 0.5) * this.f.T;
        const z = -this.f.half + (j + 0.5) * this.f.T;
        return list.reduce((a, b) => (Math.hypot(a.x - x, a.z - z) <= Math.hypot(b.x - x, b.z - z) ? a : b));
    }

    /** 고스트대로 생존자에게 건설 주문을 넣는다 (그 생존자의 줄 끝에) */
    commit() {
        const p = this.plan();
        if (!p) return 0;
        if (!p.chk.ok) {
            this.app.hud.toast(p.chk.reason, true);
            return 0;
        }
        const w = this.builderFor(p.i, p.j);
        if (!w) {
            this.app.hud.toast('지을 생존자를 고르세요 (왼쪽 클릭·끌기, C)', true);
            return 0;
        }
        const r = orderBuild(this.state, this.placing, p.i, p.j, true, w);
        if (!r.ok) {
            this.app.hud.toast(r.reason, true);
            return 0;
        }
        return 1;
    }

    /** 앱의 클릭을 먼저 받는다 */
    onClick(e) {
        if (this.swallowClick) {
            this.swallowClick = false;
            return true;
        }
        if (this.placing) {
            const n = this.commit();
            // 한 번 주문하면 끝 (Shift를 누르고 있으면 계속, 본진은 언제나 하나)
            if (n && (this.placing === 'base' || !e.shiftKey)) this.arm(null);
            this.refreshBar();
            return true;
        }
        // 생존자 고르기 (Shift = 더하기·빼기)
        const w = this.workerAt(e.clientX, e.clientY);
        if (w) {
            if (e.shiftKey) {
                if (this.sel.has(w.id)) this.sel.delete(w.id);
                else this.sel.add(w.id);
            } else {
                this.sel.clear();
                this.sel.add(w.id);
            }
            this.app.closeMenus();
            return true;
        }
        // 건물 고르기: 방벽은 모델을, 나머지는 칸으로 찾는다
        const b = this.buildingAt(e.clientX, e.clientY);
        if (b === -1) {
            if (!e.shiftKey) this.sel.clear();
            if (this.app.selectedBase) this.app.closeMenus();
            else this.app.selectBase();
            return true;
        }
        if (b) {
            if (!e.shiftKey) this.sel.clear();
            if (this.app.selected === b) this.app.closeMenus();
            else this.app.selectTower(b);
            return true;
        }
        // 빈 땅: 고른 생존자를 놓는다 (적 고르기·메뉴 닫기는 앱이 이어서)
        if (!e.shiftKey) this.sel.clear();
        return false;
    }

    /** 화면 좌표의 건물: 본진이면 -1, 타워·광산·방벽이면 그 객체, 없으면 null */
    buildingAt(x, y) {
        const app = this.app;
        const walls = app.world.buildings.wallGroup;
        if (walls?.children.length) {
            app.raycaster.setFromCamera(app.ndc(x, y), app.rig.camera);
            const hit = app.raycaster.intersectObjects(walls.children, false)[0];
            const id = hit?.object.userData.towerId;
            const t = id != null && this.state.towers.find((q) => q.id === id);
            if (t) return t;
        }
        const p = app.groundPoint(x, y);
        if (!p) return null;
        const k = this.f.cellAt(p.x, p.z);
        if (k < 0) return null;
        const id = this.state.survival.occ[k];
        if (id === -1) return -1;
        if (id > 0) return this.state.towers.find((t) => t.id === id) ?? null;
        return null;
    }

    /** 우클릭: 끌기(카메라 이동)였으면 무시, 건설 중이면 취소, 아니면 고른 생존자들에게 명령 */
    cancel(e) {
        if (this.app.rig.dragging) return true;
        if (this.placing) {
            this.arm(null);
            return true;
        }
        if (!e) return true;
        const list = this.selected();
        if (!list.length) return true;
        const p = this.app.groundPoint(e.clientX, e.clientY);
        if (!p) return true;
        const sv = this.state.survival;
        const k = this.f.cellAt(p.x, p.z);
        if (k < 0) return true;
        const hit = this.buildingAt(e.clientX, e.clientY);
        const b = hit === -1 ? sv.base : hit;
        const hurt = b && (b === sv.base ? this.state.lives < this.state.maxLives : b.hp < b.maxHp);
        let reason = null;
        let ok = 0;
        if (b && (b.build || hurt)) {
            for (const w of list) {
                const r = orderRepair(this.state, b, e.shiftKey, w);
                if (r.ok) ok++;
                else reason ??= r.reason;
            }
            if (ok) this.app.hud.toast(b.build ? '생존자가 마저 지으러 갑니다' : '생존자가 수리하러 갑니다');
        } else {
            // 여럿이면 겹치지 않게 조금씩 흩어져 선다 (가까운 생존자가 가운데로)
            const offs = spreadOffsets(list.length, this.f.T * 0.85);
            const order = list
                .slice()
                .sort((a, c) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(c.x - p.x, c.z - p.z));
            order.forEach((w, n) => {
                const r = orderMove(this.state, p.x + offs[n][0], p.z + offs[n][1], e.shiftKey, w);
                if (r.ok) ok++;
                else reason ??= r.reason;
            });
        }
        if (!ok && reason) this.app.hud.toast(reason, true);
        else if (ok) this.mark(p.x, p.z);
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
        const list = this.selected();
        const workers = list.length ? list : [this.state.survival.worker];
        let res = null;
        for (const w of workers) {
            const r = orderRepair(this.state, target, 'front', w);
            if (r.ok || !res) res = r;
        }
        if (!res.ok) this.app.hud.toast(res.reason, true);
        else this.app.hud.toast(target.build ? '생존자가 마저 지으러 갑니다' : '생존자가 수리하러 갑니다');
    }

    onKey(e) {
        const k = keyOf(e);
        if (k === 'Escape') {
            if (this.placing) {
                this.arm(null);
                return true;
            }
            if (this.box) {
                this.endBox(null);
                return true;
            }
            if (this.sel.size) {
                this.sel.clear();
                return true;
            }
            return false;
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
                    '<b>1</b> 방벽 · <b>2~6</b> 타워 · <b>7</b> 광산(금빛 광맥 위). 방벽은 고원으로 오르는 <b>비탈</b> 어귀에 대면 그 입구 전체를 막는 벽 하나가 됩니다(<b>봉쇄됨</b> 표시). 생존자는 자기 방벽을 지나다니고, 적은 막히면 <b>방벽부터 부숩니다</b>. 방벽을 눌러 <b>나무 → 돌 → 강화</b>로 올리세요. 다친 건물은 <b>우클릭</b>으로 고칩니다.',
                    14000
                );
                this.refreshBar();
            } else if (ev.type === 'mineTech') hud.toast(`채굴 기술 ${ev.level}단계 · 광산 수입이 늘었다`);
        }
    }

    // ---------- 매 프레임 ----------
    /** 화면 가장자리 이동: 띠 안에 있으면 끝에 가까울수록 빠르게 (-1~1) */
    edgePan() {
        const m = this.mouse;
        if (!m.seen || !m.inWindow || this.box?.active || this.minimap.dragging) return [0, 0];
        const W = window.innerWidth;
        const H = window.innerHeight;
        const E = edgeWidth(W, H);
        const k = (d) => (d >= E ? 0 : 0.55 + 0.45 * (1 - Math.max(0, d) / E));
        return [k(W - 1 - m.x) - k(m.x), k(H - 1 - m.y) - k(m.y)];
    }

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
            const [ex, ez] = this.edgePan();
            mx = Math.max(-1, Math.min(1, mx + ex));
            mz = Math.max(-1, Math.min(1, mz + ez));
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
        this.minimap.update(dt, { bossSoon: soon, plans: workerOrders(sv), selected: this.sel });
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

    /** 생존자가 하는 일 (카드·머리 위) */
    taskOf(w) {
        const sv = this.state.survival;
        const o = w.order;
        const building = o && o.type === 'build' && o.started && o.target?.build;
        const pct = building ? Math.round((o.target.build.t / o.target.build.T) * 100) : null;
        let task = w.alive ? TASK[w.task] || '' : `쓰러짐 · ${Math.ceil(w.respawnT)}초 뒤 부활`;
        if (w.alive && building) task = `짓는 중 ${pct}%`;
        if (!w.alive && !sv.base) task = '쓰러짐';
        return { task, building, pct };
    }

    updateWorkerUi() {
        const sv = this.state.survival;
        const w = this.lead();
        const { task } = this.taskOf(w);
        const nSel = sv.workers.filter((c) => c.alive && this.sel.has(c.id)).length;
        const name = sv.workers.length > 1 ? (nSel > 1 ? `생존자 ${nSel}명` : `생존자 ${w.id}`) : '생존자';
        const q = workerOrders(sv, w).filter((x) => x.type === 'build' && !x.started).length;
        const key = `${name}|${task}|${Math.ceil(w.hp)}|${q}`;
        if (key !== this.cardKey) {
            this.cardKey = key;
            this.cardName.textContent = name;
            this.cardTask.textContent = task;
            this.cardHp.style.width = `${Math.max(0, (w.hp / w.maxHp) * 100)}%`;
            this.cardQ.textContent = q ? `예약 ${q}` : '';
            this.card.classList.toggle('dead', !w.alive);
            this.card.classList.toggle('hurt', w.alive && w.hp < w.maxHp * 0.4);
        }
        // 머리 위 표시 (생존자마다)
        for (const c of sv.workers) {
            let tag = this.wTags.get(c.id);
            if (!tag) {
                tag = document.createElement('div');
                tag.className = 'sv-wtag';
                tag.innerHTML = '<i class="bar"><b></b></i><span></span>';
                this.labels.appendChild(tag);
                this.wTags.set(c.id, tag);
            }
            const p = c.alive ? this.screenOf(c.x, this.app.world.heightAt(c.x, c.z) + 1.3, c.z) : null;
            tag.style.display = p ? '' : 'none';
            if (!p) continue;
            tag.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px) translate(-50%, -100%)`;
            const t = this.taskOf(c);
            const txt = t.building ? `${t.pct}%` : c.task === 'repair' ? '수리' : '';
            const sel = this.sel.has(c.id);
            const k = `${Math.ceil(c.hp)}|${txt}|${sel}`;
            if (tag.dataset.k !== k) {
                tag.dataset.k = k;
                tag.querySelector('b').style.width = `${(c.hp / c.maxHp) * 100}%`;
                tag.querySelector('span').textContent = txt;
                tag.classList.toggle('hurt', c.hp < c.maxHp * 0.4);
                tag.classList.toggle('sel', sel);
            }
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
