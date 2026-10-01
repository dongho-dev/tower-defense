// 살아남기 화면 조작: RTS 카메라(화면 가장자리·WASD·드래그·휠·미니맵), 명당 고르기, 자유 배치 건설.
// 앱(app.js)은 이 모드일 때 클릭·키·우클릭을 먼저 여기로 넘긴다. 처리했으면 true를 돌려준다.
import * as THREE from 'three';
import { TOWERS } from '../../core/data/towers.js';
import { placeBuilding, placeBase, checkPlacement } from '../../core/game.js';
import { snapFootprint, sizeOf, formatClock } from '../../core/survival.js';
import { ICONS, TOWER_TINT } from '../icons.js';
import { Minimap } from './minimap.js';
import './survival.css';

/** 건설 막대 순서 (숫자 키 1~7) */
export const BUILD_ORDER = ['wall', 'ranger', 'ember', 'frost', 'storm', 'arcane', 'mine'];
const EDGE = 10;
const MIN_DIST = 14;
const MAX_DIST = 52;
/** 터를 고를 때만 쓰는 전체 보기 거리 */
const OVERVIEW = 165;

export class SurvivalUI {
    constructor(app) {
        this.app = app;
        this.state = app.state;
        const sv = this.state.survival;
        this.f = sv.field;
        this.placing = null;
        this.drag = null;
        this.hoverCell = null;
        this.mouse = { x: 0, y: 0, seen: false, inWindow: false };
        this.hoverSite = null;
        this.bossWarned = -1;

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
        this.sitePanel();
        this.warn = document.createElement('div');
        this.warn.className = 'sv-warn';
        root.appendChild(this.warn);
        this.labels = document.createElement('div');
        this.labels.className = 'sv-labels';
        root.appendChild(this.labels);
        this.siteEls = this.f.sites.map((s) => {
            const el = document.createElement('button');
            el.className = 'sv-site-tag';
            el.innerHTML = `<b>${s.name}</b><span>${s.risk}</span>`;
            el.addEventListener('click', () => this.chooseSite(s));
            el.addEventListener('pointerenter', () => (this.hoverSite = s.id));
            el.addEventListener('pointerleave', () => (this.hoverSite = null));
            this.labels.appendChild(el);
            return el;
        });
        document.body.classList.add('sv-mode');

        // 카메라: 맵 전체를 자유롭게, 줌 범위를 넓게
        const rig = app.rig;
        const h = this.f.half;
        rig.rect = { x0: -h + 10, x1: h - 10, z0: -h + 6, z1: h - 2 };
        rig.minDistance = MIN_DIST;
        rig.maxDistance = MAX_DIST;

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
        if (!sv.base) this.enterChoose();
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
        // 이 모드의 조작 안내가 다음 판까지 남지 않게
        const hud = this.app.hud;
        clearTimeout(hud.hintT);
        hud.$.hint.classList.remove('show');
    }

    // ---------- 화면 구성 ----------
    buildBar() {
        const el = (this.bar = document.createElement('div'));
        el.className = 'sv-build panel';
        el.innerHTML =
            `<div class="sv-build-title">건설 <small>빈 땅 어디든</small></div>` +
            BUILD_ORDER.map((type, n) => {
                const def = TOWERS[type];
                const size = sizeOf(type);
                return `<button class="sv-bt" data-type="${type}" style="--tint:${TOWER_TINT[type]}" title="${def.name} · ${def.role}">
                    <span class="hk">${n + 1}</span><i class="ico">${ICONS[type]}</i>
                    <span class="nm">${def.name}<em>${size}×${size}${type === 'mine' ? ' · 광맥' : ''}</em></span>
                    <span class="c">${ICONS.gold}${def.tiers[0].cost}</span></button>`;
            }).join('') +
            `<div class="sv-build-tip">우클릭·Esc 취소 · 방벽은 끌어서 줄로</div>`;
        this.root.appendChild(el);
        this.btns = [...el.querySelectorAll('[data-type]')];
        for (const b of this.btns)
            b.addEventListener('click', () => this.arm(this.placing === b.dataset.type ? null : b.dataset.type));
    }

    sitePanel() {
        const el = (this.sites = document.createElement('div'));
        el.className = 'sv-sites panel ornate';
        el.innerHTML = `<div class="sv-sites-title">본진을 세울 터를 고르세요</div>
            <div class="sv-sites-sub">절벽에 둘러싸인 고원 '명당' 일곱 곳. 입구(비탈)가 적을수록 막기 쉽고, 광맥이 많을수록 풍요롭다. 둥지는 맵 한가운데.</div>
            <div class="sv-sites-list">${this.f.sites
                .map(
                    (s, n) =>
                        `<button class="sv-site" data-site="${n}"><b>${s.name}</b><span>입구 ${s.rampCount} · 광맥 ${s.veinCount}</span><small>${s.risk}</small></button>`
                )
                .join('')}</div>
            <div class="sv-sites-foot">목록에 올리면 그곳을 보여 줍니다 · 누르면 본진을 세웁니다<br>또는 밝혀진 땅을 직접 눌러 원하는 자리에 세우세요</div>`;
        this.root.appendChild(el);
        for (const b of el.querySelectorAll('[data-site]')) {
            const s = this.f.sites[Number(b.dataset.site)];
            b.addEventListener('pointerenter', () => (this.hoverSite = s.id));
            b.addEventListener('pointerleave', () => (this.hoverSite = null));
            b.addEventListener('click', () => this.chooseSite(s));
        }
    }

    enterChoose() {
        this.placing = 'base';
        this.sites.classList.add('show');
        this.bar.classList.add('off');
        this.app.rig.dragLock = false;
        // 터를 고르는 동안만 맵 전체가 한눈에 들어오게 크게 물러선다
        const rig = this.app.rig;
        rig.maxDistance = OVERVIEW;
        // 지도처럼 조금 더 내려다보고, 오른쪽 목록에 가리지 않게 그림을 왼쪽으로 민다
        rig.setPitch(64, true);
        rig.shift = window.innerWidth > 900 ? -0.09 : 0;
        rig.shiftCur = rig.shift;
        this.lookAt(0, -2, OVERVIEW);
    }

    chooseSite(s) {
        if (this.state.survival.base) return;
        const r = placeBase(this.state, s.base[0], s.base[1]);
        if (!r.ok) return this.app.hud.toast(r.reason, true);
        this.afterBase();
    }

    afterBase() {
        const b = this.state.survival.base;
        this.placing = null;
        this.sites.classList.remove('show');
        this.bar.classList.remove('off');
        this.labels.classList.add('off');
        const rig = this.app.rig;
        rig.maxDistance = MAX_DIST;
        rig.setPitch(52);
        rig.shift = 0;
        this.app.world.buildings.setGhost(null);
        this.lookAt(b.x, b.z, 30);
        const first = this.state.waves[0];
        this.app.hud.showBanner(
            '본진을 세웠다',
            `${formatClock(first.at)} 뒤 둥지가 깨어난다 · 비탈(입구)을 방벽으로 막아라`
        );
        this.app.hud.showHint(
            '<b>1</b> 방벽(끌어서 줄로) · <b>2~6</b> 타워 · <b>7</b> 광산(금빛 광맥 위). 적은 가장 가까운 건물을 노리고, 길이 막혀 있거나 너무 돌아가야 하면 <b>방벽부터 부숩니다</b>. 화면 가장자리·<b>WASD</b>·드래그로 이동, 휠로 확대, <b>Space</b>로 본진. 동이 틀 때까지 본진을 지키면 승리.',
            12000
        );
    }

    lookAt(x, z, dist = null) {
        const rig = this.app.rig;
        rig.goal.x = x;
        rig.goal.z = z + 1;
        if (dist) rig.goalDistance = dist;
        rig.clampGoal();
        rig.intro = null;
    }

    arm(type) {
        if (!this.state.survival.base) return;
        this.placing = type;
        this.drag = null;
        this.app.closeMenus();
        this.app.rig.dragLock = !!type;
        this.refreshBar();
        if (!type) this.app.world.buildings.setGhost(null);
        else this.updateGhost();
    }

    refreshBar() {
        for (const b of this.btns) {
            const type = b.dataset.type;
            b.classList.toggle('on', this.placing === type);
            b.classList.toggle('poor', this.state.gold < TOWERS[type].tiers[0].cost);
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
        return cells.map((c) => ({ ...c, chk: checkPlacement(this.state, type, c.i, c.j), size, type }));
    }

    updateGhost() {
        if (!this.placing || !this.mouse.overCanvas) {
            this.app.world.buildings.setGhost(null);
            return;
        }
        const plan = this.plan();
        this.app.world.buildings.setGhost(plan.map((p) => ({ cells: p.chk.cells, size: p.size, type: p.type })));
        // 타워는 사거리도 보여 준다
        const p = plan[0];
        if (p && TOWERS[p.type] && TOWERS[p.type].tiers[0].range) {
            const c = {
                x: -this.f.half + (p.i + p.size / 2) * this.f.T,
                z: -this.f.half + (p.j + p.size / 2) * this.f.T
            };
            const r = TOWERS[p.type].tiers[0].range * (this.state.survival.cfg.rangeMul ?? 1);
            this.app.world.showRange({ x: c.x, z: c.z, r, color: TOWER_TINT[p.type] });
        } else if (!this.app.selected) this.app.world.showRange(null);
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

    /** 고스트대로 짓는다 */
    commit() {
        const plan = this.plan();
        let built = 0;
        let reason = null;
        for (const p of plan) {
            if (this.placing === 'base') {
                const r = placeBase(this.state, p.i, p.j);
                if (r.ok) this.afterBase();
                else this.app.hud.toast(r.reason, true);
                return 0;
            }
            const r = placeBuilding(this.state, this.placing, p.i, p.j);
            if (r.ok) built++;
            else reason ??= r.reason;
            if (!r.ok && r.reason === '골드가 부족합니다.') break;
        }
        if (reason && (!built || reason === '골드가 부족합니다.')) this.app.hud.toast(reason, true);
        return built;
    }

    /** 앱의 클릭을 먼저 받는다 */
    onClick(e) {
        if (this.swallowClick) {
            this.swallowClick = false;
            return true;
        }
        if (this.placing) {
            const built = this.commit();
            // 타워·광산은 한 번 지으면 끝 (Shift를 누르고 있으면 계속)
            if (built && this.placing !== 'wall' && !e.shiftKey) this.arm(null);
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

    /** 우클릭: 건설 취소 */
    cancel() {
        if (this.placing && this.placing !== 'base') {
            this.arm(null);
            return true;
        }
        return false;
    }

    onKey(e) {
        const k = e.key;
        if (k === 'Escape' && this.placing && this.placing !== 'base') {
            this.arm(null);
            return true;
        }
        if (/^[1-7]$/.test(k)) {
            const type = BUILD_ORDER[Number(k) - 1];
            this.arm(this.placing === type ? null : type);
            return true;
        }
        const low = k.toLowerCase();
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
            return true;
        }
        return false;
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
        const soon = sv.started && bossNext && state0(this.state) && next.at - sv.clock <= 30 && next.at - sv.clock > 0;
        if (soon && this.bossWarned !== this.state.waveIndex) {
            this.bossWarned = this.state.waveIndex;
            app.hud.toast('30초 뒤 둥지에서 빙하 거신이 깨어납니다!', true);
        }
        const warnTxt = soon ? `보스 접근 · ${Math.ceil(next.at - sv.clock)}초` : '';
        if (this.warn.textContent !== warnTxt) {
            this.warn.textContent = warnTxt;
            this.warn.classList.toggle('show', !!warnTxt);
        }
        this.minimap.update(dt, { sites: this.f.sites, hoverSite: this.hoverSite, bossSoon: soon });
        // 명당 이름표 (본진을 세우기 전)
        if (!sv.base) {
            const v = new THREE.Vector3();
            this.f.sites.forEach((s, n) => {
                const el = this.siteEls[n];
                v.set(s.x, app.world.heightAt(s.x, s.z) + 2.5, s.z);
                const p = app.overlay.project(v);
                const show = !p.behind && p.x > -100 && p.x < window.innerWidth + 100;
                el.style.display = show ? '' : 'none';
                if (show)
                    el.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px) translate(-50%, -100%)`;
                el.classList.toggle('hot', this.hoverSite === s.id);
            });
        }
    }

    refreshBarThrottled(dt) {
        this.barT = (this.barT || 0) - dt;
        if (this.barT > 0) return;
        this.barT = 0.2;
        this.refreshBar();
    }
}

function state0(state) {
    return state.status === 'playing';
}
