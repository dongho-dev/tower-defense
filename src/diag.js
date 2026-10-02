// 사용자 브라우저에서 '화면이 멈춤' 원인을 잡기 위한 진단 기록.
// 루프 예외, WebGL 컨텍스트 손실·복구, 1초 넘는 프레임 정지를 localStorage에 최근 몇 건만 남긴다.
// 주소에 ?diag를 붙이면 화면 구석에 목록을 보여 준다.

export const DIAG_KEY = 'll_diag';
export const DIAG_MAX = 30;

function defaultStorage() {
    try {
        return globalThis.localStorage ?? null;
    } catch {
        return null;
    }
}

/** 최근 max건만 남기는 링버퍼. 저장소가 없거나 막혀 있어도 메모리에는 남는다. */
export class DiagLog {
    constructor(storage = defaultStorage(), max = DIAG_MAX) {
        this.storage = storage;
        this.max = max;
        this.listeners = new Set();
        this.items = this.load();
    }

    load() {
        try {
            const a = JSON.parse(this.storage?.getItem(DIAG_KEY) || '[]');
            return Array.isArray(a) ? a.slice(-this.max) : [];
        } catch {
            return [];
        }
    }

    add(kind, data = {}) {
        const entry = { at: new Date().toISOString(), kind, ...data };
        this.items.push(entry);
        if (this.items.length > this.max) this.items.splice(0, this.items.length - this.max);
        try {
            this.storage?.setItem(DIAG_KEY, JSON.stringify(this.items));
        } catch {
            /* 저장 불가 환경은 메모리에만 */
        }
        for (const f of this.listeners) f(this.items);
        return entry;
    }

    clear() {
        this.items = [];
        try {
            this.storage?.removeItem(DIAG_KEY);
        } catch {
            /* 무시 */
        }
        for (const f of this.listeners) f(this.items);
    }

    onChange(f) {
        this.listeners.add(f);
        return () => this.listeners.delete(f);
    }
}

/** 오류를 진단 기록용으로 줄인다: 메시지와 스택 앞부분 몇 줄 */
export function errorInfo(err, lines = 4) {
    const msg = err && err.message ? err.message : String(err);
    const stack = err && err.stack ? String(err.stack).split('\n').slice(0, lines).join('\n') : '';
    return { msg, stack };
}

/** GPU 이름과 병렬 셰이더 컴파일 지원 여부 (맵 진입이 PC마다 몇 배씩 다른 원인을 가리기 위해) */
export function gpuInfo(renderer) {
    try {
        const gl = renderer.getContext();
        const dbg = gl.getExtension('WEBGL_debug_renderer_info');
        const gpu = String(gl.getParameter(dbg ? dbg.UNMASKED_RENDERER_WEBGL : gl.RENDERER)).slice(0, 120);
        return { gpu, parallel: !!gl.getExtension('KHR_parallel_shader_compile') };
    } catch {
        return {};
    }
}

/** 정지 직전 프레임에서 우리 코드가 쓴 시간. 정지보다 훨씬 짧으면 브라우저·GPU 쪽에서 멈춘 것 */
function workText(w) {
    if (!w) return '';
    const total = w.sim + w.view + w.ui + w.draw;
    return ` · 직전 프레임 ${total}ms(시뮬 ${w.sim}, 장면 ${w.view}, UI ${w.ui}, 그리기 ${w.draw}, 새 셰이더 ${w.progs})`;
}

/** 한 줄 요약 (화면 목록용) */
export function describe(e) {
    const time = e.at ? e.at.slice(11, 19) : '';
    switch (e.kind) {
        case 'error':
            return `${time} 오류 [${e.where}] ${e.msg}`;
        case 'stall':
            return `${time} 정지 ${e.ms}ms · ${e.map ?? '-'} ${e.wave ?? '-'}웨이브${e.mode === 'loading' || e.warming ? '(맵 준비 중)' : ''} · 적 ${e.enemies ?? 0}${
                e.recent && e.recent.length ? ' · 직전 처음: ' + e.recent.join(', ') : ''
            }${workText(e.work)}`;
        case 'warm':
            return `${time} 맵 준비 ${e.map ?? '-'} · 짓기 ${e.build ?? 0}ms · 셰이더 ${e.ms}ms(막힘 ${e.sync ?? 0}ms, 새 ${e.progs ?? 0}개)${
                e.timedOut ? ' · 시간 초과' : ''
            }${e.gpu ? ` · GPU ${e.gpu}${e.parallel ? '' : ' · 병렬 컴파일 없음'}` : ''}`;
        case 'contextlost':
            return `${time} WebGL 컨텍스트 손실 · ${e.map ?? '-'} ${e.wave ?? '-'}웨이브`;
        case 'contextrestored':
            return `${time} WebGL 컨텍스트 복구`;
        case 'reload':
            return `${time} 컨텍스트가 돌아오지 않아 새로고침`;
        default:
            return `${time} ${e.kind}`;
    }
}

/** ?diag 일 때 화면 왼쪽 아래에 기록 목록을 띄운다 */
export function mountDiagPanel(log, root = document.body) {
    const el = document.createElement('div');
    el.className = 'diag-panel';
    el.style.cssText =
        'position:fixed;left:8px;bottom:8px;z-index:9999;max-width:min(560px,90vw);max-height:40vh;overflow:auto;' +
        'background:rgba(10,8,20,.86);color:#e8e2ff;font:11px/1.45 ui-monospace,Consolas,monospace;' +
        'padding:8px 10px;border:1px solid rgba(255,255,255,.18);border-radius:6px;white-space:pre-wrap;pointer-events:auto';
    const head = document.createElement('div');
    head.textContent = `진단 기록 (${DIAG_KEY}, 최근 ${log.max}건) `;
    const clear = document.createElement('button');
    clear.textContent = '지우기';
    clear.style.cssText = 'font:inherit;margin-left:6px;cursor:pointer';
    clear.addEventListener('click', () => log.clear());
    head.appendChild(clear);
    const body = document.createElement('div');
    el.append(head, body);
    const render = (items) => {
        body.textContent = items.length ? items.map(describe).reverse().join('\n') : '(기록 없음)';
    };
    render(log.items);
    log.onChange(render);
    root.appendChild(el);
    return el;
}
