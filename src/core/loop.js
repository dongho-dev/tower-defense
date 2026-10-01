// 게임 루프 안전장치: 프레임 시간 상한, 고정 스텝 수 상한, 같은 오류 한 번만 경고.
// DOM·WebGL과 무관하게 테스트할 수 있도록 순수 함수와 작은 클래스만 둔다.

/** 한 프레임에서 인정하는 최대 실제 시간(초). 탭 복귀처럼 rAF가 멈췄다 돌아오면 이만큼만 진행한다. */
export const MAX_FRAME_DT = 0.05;
/** 한 프레임에 돌리는 최대 시뮬레이션 스텝 수 */
export const MAX_STEPS = 12;

/** rAF 시각 차이(ms)를 안전한 프레임 시간(초)으로: 음수·NaN은 0, 큰 값은 상한 */
export function frameDt(now, last, maxDt = MAX_FRAME_DT) {
    const dt = (now - last) / 1000;
    if (!(dt > 0)) return 0;
    return Math.min(maxDt, dt);
}

/**
 * 고정 스텝 누적기: acc에 simDt를 더하고 tick 단위로 몇 번 돌릴지 정한다.
 * 상한에 걸리면 밀린 시간을 버린다. 버리지 않으면 다음 프레임도 상한까지 돌고
 * 또 밀리는 '죽음의 나선'이 생긴다.
 * @returns {{ steps: number, acc: number, dropped: number }}
 */
export function planSteps(acc, simDt, tick, maxSteps = MAX_STEPS) {
    let a = acc + (simDt > 0 ? simDt : 0);
    let steps = Math.floor(a / tick + 1e-9);
    let dropped = 0;
    if (steps > maxSteps) {
        dropped = (steps - maxSteps) * tick;
        steps = maxSteps;
    }
    a -= steps * tick + dropped;
    // 부동소수점 오차로 생긴 아주 작은 음수와, 혹시 남은 큰 값을 정리
    a = Math.min(Math.max(0, a), tick);
    return { steps, acc: a, dropped };
}

/**
 * 루프 안 예외 기록기. 처음 보는 오류는 스택과 함께 console.error,
 * 같은 오류가 다시 나면 한 번만 console.warn을 남기고 그 뒤로는 세기만 한다.
 */
export class ErrorGate {
    /** @param {(where: string, err: unknown) => void} [onFirst] 처음 보는 오류마다 불린다 (진단 기록용) */
    constructor(log = console, limit = 50, onFirst = null) {
        this.log = log;
        this.limit = limit;
        this.onFirst = onFirst;
        this.seen = new Map();
        this.total = 0;
    }

    /** @returns {boolean} 처음 보는 오류면 true */
    report(where, err) {
        this.total++;
        const msg = err && err.message ? err.message : String(err);
        const key = `${where}: ${msg}`;
        const rec = this.seen.get(key);
        if (rec) {
            rec.count++;
            if (!rec.warned) {
                rec.warned = true;
                this.log.warn?.(`[루프] 같은 오류가 반복됩니다 (이후 생략): ${key}`);
            }
            return false;
        }
        // 오류 종류가 끝없이 늘어도 기록은 일정 수만 둔다
        if (this.seen.size >= this.limit) this.seen.delete(this.seen.keys().next().value);
        this.seen.set(key, { count: 1, warned: false });
        this.log.error?.(`[루프] ${where} 중 오류:`, err);
        try {
            this.onFirst?.(where, err);
        } catch {
            /* 기록 실패가 루프를 멈추게 하지 않는다 */
        }
        return true;
    }

    /** 같은 오류 묶음별 횟수 (디버깅용) */
    summary() {
        return [...this.seen].map(([key, r]) => ({ key, count: r.count }));
    }
}
