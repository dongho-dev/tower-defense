import { step, drainEvents } from './sim.js';

// 고정 간격 시뮬레이션 + 렌더 루프. render(events, dt) 는 매 프레임 호출된다.
export function runLoop(sim, render, opts = {}) {
  const state = { speed: 1, paused: false, fps: 0 };
  let last = performance.now(), acc = 0, frames = 0, fpsT = 0;
  const fpsEl = opts.fpsEl;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!state.paused) {
      acc += dt * state.speed;
      let n = 0;
      while (acc >= 1 / 60 && n++ < 8) { step(sim, 1 / 60); acc -= 1 / 60; }
    }
    render(drainEvents(sim), state.paused ? 0 : dt * state.speed);
    frames++; fpsT += dt;
    if (fpsT >= 0.5) { state.fps = Math.round(frames / fpsT); frames = 0; fpsT = 0; if (fpsEl) fpsEl.textContent = state.fps + ' fps'; }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  // 검수용: window.__demo.advance(초) 로 시뮬레이션을 빨리 감는다
  window.__demo = {
    sim,
    state,
    advance(sec) {
      const pending = [];
      for (let t = 0; t < sec; t += 1 / 60) { step(sim, 1 / 60); pending.push(...drainEvents(sim)); }
      render(pending.slice(-12), 1 / 60);
      for (let i = 0; i < 10; i++) { step(sim, 1 / 60); render(drainEvents(sim), 1 / 60); }
    }
  };
  return state;
}

export function speedButtons(container, state) {
  container.innerHTML = '';
  for (const s of [0, 1, 2, 3]) {
    const b = document.createElement('button');
    b.textContent = s === 0 ? '일시정지' : s + 'x';
    b.onclick = () => {
      state.paused = s === 0;
      if (s) state.speed = s;
      [...container.children].forEach((c) => c.classList.toggle('on', c === b));
    };
    if (s === 1) b.classList.add('on');
    container.appendChild(b);
  }
}
