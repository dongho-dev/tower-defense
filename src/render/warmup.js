// 셰이더 미리 굽기. 처음 그리는 재질은 그 프레임 안에서 셰이더를 컴파일하느라 화면이 멈춘다
// (이 PC의 ANGLE/D3D11에서 맵 진입 7~9초, 첫 적 등장 0.5~1.7초). 맵을 지을 때 장면과
// 나올 수 있는 모델을 KHR_parallel_shader_compile로 병렬 컴파일해 두면, 그동안 루프는 계속 돈다.
import * as THREE from 'three';
import { ENEMIES } from '../core/data/enemies.js';
import { TOWER_ORDER, TOWERS, MAX_TIER } from '../core/data/towers.js';
import { buildEnemyModel } from './models/enemies.js';
import { buildTowerModel } from './models/towers.js';
import { buildUnitModel } from './models/units.js';

// 미리 굽기 모델은 한 번만 만들어 계속 붙잡아 둔다: 재질이 살아 있어야 셰이더 프로그램도 해제되지 않고,
// 다음 맵에서는 이미 있는 프로그램을 그대로 찾아 쓴다. 장면에 넣지 않으므로 geometry는 GPU에 올라가지 않는다.
let held = null;

/** 게임에 나올 수 있는 적·타워·병사·영웅 모델을 한 벌씩 (장면에는 넣지 않는다) */
export function buildWarmupGroup() {
    const g = new THREE.Group();
    for (const type of Object.keys(ENEMIES)) g.add(buildEnemyModel(type, false).root);
    for (const type of TOWER_ORDER) {
        for (let tier = 1; tier <= MAX_TIER; tier++) g.add(buildTowerModel(type, tier, null).group);
        for (const br of Object.keys(TOWERS[type].branches || {}))
            g.add(buildTowerModel(type, MAX_TIER, br, 1, 1).group);
    }
    for (const variant of ['base', 'a', 'b']) g.add(buildUnitModel('soldier', variant).root);
    g.add(buildUnitModel('hero').root);
    return g;
}

/**
 * 장면과 미리 굽기 모델의 셰이더를 병렬로 컴파일한다. 끝나면(또는 timeoutMs가 지나면) resolve.
 * 실제 화면은 후처리 렌더 타깃에 그리므로(톤매핑·색공간이 셰이더 키에 들어간다) 같은 타깃을 걸고 컴파일한다.
 * 프로그램 생성 단계는 동기라 약 1~2초 막히지만 맵 전환의 검은 화면 뒤에서 한 번만 일어난다.
 * (모델을 몇 개씩 나눠 프레임 사이에 넘기면 GPU 쪽 대기가 여러 번으로 쪼개져 오히려 정지가 늘었다.)
 * 진단용으로 { syncMs: 동기로 막힌 시간, timedOut } 을 돌려준다.
 */
export async function precompile(renderer, scene, camera, target = null, timeoutMs = 10000) {
    if (!renderer.compileAsync) return null;
    const t0 = performance.now();
    const extra = (held ??= buildWarmupGroup());
    const prev = renderer.getRenderTarget();
    let jobs;
    try {
        renderer.setRenderTarget(target);
        jobs = Promise.all([renderer.compileAsync(scene, camera), renderer.compileAsync(extra, camera, scene)]);
    } finally {
        renderer.setRenderTarget(prev);
    }
    const syncMs = performance.now() - t0;
    let timer;
    let timedOut = false;
    const timeout = new Promise((res) => (timer = setTimeout(() => res((timedOut = true)), timeoutMs)));
    try {
        await Promise.race([jobs, timeout]);
    } finally {
        clearTimeout(timer);
    }
    return { syncMs, timedOut };
}
