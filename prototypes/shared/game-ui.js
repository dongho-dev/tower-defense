// Q3 게임성 데모 공통 UI: 건설 버튼, 선택 타워 패널, 웨이브 제어, 입력 처리.
import { TOWERS, MAX_LEVEL, towerAt, buildTower, upgradeTower, sellTower, upgradeCost, towerStats, startWave } from './sim.js';
import { createFlatRenderer } from './flat.js';
import { runLoop } from './loop.js';

export function mountGame({ sim, rules, cell = 54 }) {
  const $ = (id) => document.getElementById(id);
  const canvas = $('c');
  const renderer = createFlatRenderer(canvas, sim, { cell, showSockets: rules.showSockets });
  const ui = { hover: null, placeType: null, selected: null, pointer: null, targeting: null };
  const types = rules.types || ['gun', 'cannon', 'frost', 'laser'];
  let toastT = 0;

  function toast(msg) {
    const el = $('toast');
    el.textContent = msg; el.style.opacity = 1; toastT = 1.8;
  }

  // 건설 버튼
  const buildEl = $('build');
  const buildBtns = {};
  for (const type of types) {
    const d = TOWERS[type];
    const b = document.createElement('button');
    b.innerHTML = `<span><i class="swatch" style="background:${d.color}"></i>${d.name} <small>[${d.key}]</small></span><small>${d.cost}G · ${d.desc}</small>`;
    b.onclick = () => selectPlace(type);
    buildEl.appendChild(b);
    buildBtns[type] = b;
  }
  function selectPlace(type) {
    ui.placeType = ui.placeType === type ? null : type;
    ui.selected = null;
    ui.targeting = null;
    refresh();
  }

  // 웨이브 제어
  const ctrl = $('controls');
  const waveBtn = document.createElement('button');
  waveBtn.className = 'primary';
  waveBtn.onclick = () => { if (startWave(sim)) refresh(); };
  const autoBtn = document.createElement('button');
  autoBtn.textContent = '자동 진행';
  autoBtn.onclick = () => { sim.autoNext = !sim.autoNext; sim.autoT = 1; refresh(); };
  const speedBtn = document.createElement('button');
  ctrl.append(waveBtn, autoBtn, speedBtn);

  const loop = runLoop(sim, (events, dt) => {
    for (const ev of events) {
      if (ev.type === 'waveEnd') toast(`웨이브 ${ev.wave} 클리어 · 보상 +${20 + ev.wave * 4}G`);
      if (ev.type === 'gameover') $('over').hidden = false;
    }
    if (rules.onEvents) rules.onEvents(events);
    toastT -= dt || 0.016;
    if (toastT <= 0) $('toast').style.opacity = 0;
    renderer.draw(ui, dt, events);
    refreshLive();
  }, { fpsEl: $('fps') });
  speedBtn.onclick = () => { loop.speed = loop.speed === 1 ? 2 : loop.speed === 2 ? 3 : 1; refresh(); };

  // 선택 타워 패널
  const selEl = $('selected');
  function renderSelected() {
    const t = ui.selected;
    if (!t || !sim.towers.includes(t)) { ui.selected = null; selEl.innerHTML = '<p class="hint">타워를 클릭하면 업그레이드·판매할 수 있어요.</p>'; return; }
    const d = TOWERS[t.type];
    const s = towerStats(sim, t);
    const lines = [];
    if (!d.wall) {
      lines.push(`<div class="hud"><div class="stat"><b>${d.beam ? Math.round(s.dps) + '/s' : Math.round(s.dmg)}</b><span>피해</span></div><div class="stat"><b>${s.range.toFixed(1)}</b><span>사거리</span></div><div class="stat"><b>${d.beam ? '지속' : (1 / s.rate).toFixed(1) + '/s'}</b><span>공속</span></div></div>`);
    }
    selEl.innerHTML = `<p style="margin-bottom:8px"><b style="color:${d.color}">${d.name}</b> · 레벨 ${t.level}${t.branch ? ' · ' + d.branches[t.branch].name : ''}${t.buff > 1 ? ` · <span style="color:#7dffb0">시너지 +${Math.round((t.buff - 1) * 100)}%</span>` : ''}</p>${lines.join('')}<div class="row" id="selActions" style="margin-top:8px"></div>`;
    const act = $('selActions');
    const cost = upgradeCost(t);
    if (!d.wall && t.level < MAX_LEVEL) {
      const b = document.createElement('button');
      b.textContent = `업그레이드 ${cost}G`;
      b.dataset.cost = cost;
      b.onclick = () => { upgradeTower(sim, t); refresh(); };
      act.appendChild(b);
    } else if (!d.wall && rules.branches && !t.branch) {
      for (const k of ['a', 'b']) {
        const br = d.branches[k];
        const b = document.createElement('button');
        b.style.flex = '1 1 100%'; b.style.textAlign = 'left';
        b.innerHTML = `<b>${k.toUpperCase()}. ${br.name}</b> · ${cost}G<br><small style="color:var(--muted)">${br.desc}</small>`;
        b.dataset.cost = cost;
        b.onclick = () => { upgradeTower(sim, t, k); refresh(); };
        act.appendChild(b);
      }
    }
    const sell = document.createElement('button');
    sell.textContent = `판매 +${Math.floor(t.spent * 0.7)}G`;
    sell.onclick = () => { sellTower(sim, t); ui.selected = null; refresh(); };
    act.appendChild(sell);
  }

  let lastSig = '', lastSel = null;
  function refreshLive() {
    const sig = [sim.gold, sim.lives, sim.wave, sim.waveActive, ui.selected && ui.selected.id, ui.selected && ui.selected.level, ui.selected && ui.selected.branch, sim.towers.length, sim.over].join('|');
    if (sig !== lastSig) { lastSig = sig; refresh(); }
    if (rules.onFrame) rules.onFrame(ui);
  }

  function refresh() {
    $('hud').innerHTML = `<div class="stat"><b style="color:var(--warn)">${sim.gold}</b><span>골드</span></div><div class="stat"><b style="color:var(--bad)">${sim.lives}</b><span>목숨</span></div><div class="stat"><b>${sim.wave}</b><span>웨이브</span></div>`;
    for (const [type, b] of Object.entries(buildBtns)) {
      b.classList.toggle('on', ui.placeType === type);
      b.disabled = sim.gold < TOWERS[type].cost;
    }
    waveBtn.textContent = sim.waveActive ? `웨이브 ${sim.wave} 진행 중` : `웨이브 ${sim.wave + 1} 시작 [Space]`;
    waveBtn.disabled = sim.waveActive || sim.over || !!rules.blockWave?.();
    autoBtn.classList.toggle('on', sim.autoNext);
    speedBtn.textContent = `속도 ${loop.speed}x`;
    const t = ui.selected;
    const selSig = t ? [t.id, t.level, t.branch, t.buff, sim.towers.includes(t)].join('|') : '';
    if (selSig !== lastSel) { lastSel = selSig; renderSelected(); }
    for (const b of selEl.querySelectorAll('[data-cost]')) b.disabled = sim.gold < Number(b.dataset.cost);
    if (rules.onRefresh) rules.onRefresh();
  }

  // 입력
  canvas.addEventListener('mousemove', (e) => {
    const p = renderer.cellAt(e.clientX, e.clientY);
    ui.pointer = p;
    if (ui.placeType) ui.hover = { cx: p.cx, cy: p.cy, valid: rules.canPlace(sim, p.cx, p.cy) };
    else ui.hover = null;
  });
  canvas.addEventListener('mouseleave', () => { ui.hover = null; ui.pointer = null; });
  canvas.addEventListener('click', (e) => {
    const p = renderer.cellAt(e.clientX, e.clientY);
    if (ui.targeting) { ui.targeting(p); ui.targeting = null; refresh(); return; }
    if (ui.placeType) {
      if (!rules.canPlace(sim, p.cx, p.cy)) { toast(rules.invalidMsg || '여기에는 지을 수 없어요'); return; }
      if (sim.gold < TOWERS[ui.placeType].cost) { toast('골드가 부족해요'); return; }
      buildTower(sim, ui.placeType, p.cx, p.cy);
      if (!e.shiftKey && sim.gold < TOWERS[ui.placeType].cost) ui.placeType = null;
      refresh();
      return;
    }
    ui.selected = towerAt(sim, p.cx, p.cy);
    refresh();
  });
  canvas.addEventListener('contextmenu', (e) => { e.preventDefault(); ui.placeType = null; ui.selected = null; ui.targeting = null; refresh(); });
  window.addEventListener('keydown', (e) => {
    const type = types.find((t) => TOWERS[t].key === e.key);
    if (type) selectPlace(type);
    if (e.key === ' ') { e.preventDefault(); startWave(sim); refresh(); }
    if (e.key === 'Escape') { ui.placeType = null; ui.selected = null; ui.targeting = null; refresh(); }
    if (rules.onKey) rules.onKey(e, ui);
  });

  refresh();
  return { ui, refresh, toast, renderer, loop };
}

export const GAME_SIDE_HTML = `
  <div class="card"><div class="hud" id="hud"></div></div>
  <div class="card"><h2>건설 (숫자키 · Shift+클릭 연속 건설 · 우클릭 취소)</h2><div class="build" id="build"></div></div>
  <div class="card"><h2>선택한 타워</h2><div id="selected"></div></div>
  <div class="card"><div class="row" id="controls"></div></div>`;
