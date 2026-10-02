// GPU 자원 해제 도우미. 장면에서 remove만 하면 geometry 버퍼가 GPU에 남아 오래 플레이할수록 쌓인다.

// userData는 Material.clone()에도 복제된다. 공유 여부는 원본 객체에만 귀속한다.
const sharedMaterials = new WeakSet();

/** 모델 캐시가 여러 개체에 나눠 주는 재질: 개체를 지울 때 해제하지 않는다 */
export function markShared(mats) {
    for (const m of Array.isArray(mats) ? mats : Object.values(mats)) if (m?.isMaterial) sharedMaterials.add(m);
    return mats;
}

function materialsOf(o) {
    return Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
}

/** 개체 하나(적·타워·유닛 모델, 이펙트 메시)를 지울 때: geometry와 개체 전용 재질만 해제 */
export function disposeObject(root) {
    root.traverse((o) => {
        // 인스턴스 행렬·색 버퍼는 geometry가 아니라 메시의 dispose 이벤트로 해제된다.
        if (o.isInstancedMesh) o.dispose();
        o.geometry?.dispose();
        for (const m of materialsOf(o)) if (!sharedMaterials.has(m)) m.dispose();
    });
}

/**
 * 장면 전체를 버릴 때: 맵 전용 재질·텍스처·그림자 맵까지 모두 해제한다.
 * 모델 캐시의 공유 재질(markShared)은 개수가 정해져 있고 다음 맵에서도 그대로 쓰므로 남긴다.
 * 해제하면 맵을 바꿀 때마다 그 셰이더를 처음부터 다시 컴파일하느라 몇 초씩 멈춘다.
 */
export function disposeScene(scene) {
    const seen = new Set();
    const tex = (v) => {
        if (v?.isTexture && !seen.has(v)) {
            seen.add(v);
            // 환경맵처럼 렌더 타깃이 만든 텍스처는 프레임버퍼째 해제
            if (v.isRenderTargetTexture && v.renderTarget) v.renderTarget.dispose();
            else v.dispose();
        }
    };
    scene.traverse((o) => {
        if (o.isInstancedMesh) o.dispose();
        o.geometry?.dispose();
        for (const m of materialsOf(o)) {
            if (seen.has(m) || sharedMaterials.has(m)) continue;
            seen.add(m);
            for (const v of Object.values(m)) tex(v);
            if (m.uniforms) for (const u of Object.values(m.uniforms)) tex(u?.value);
            m.dispose();
        }
        if (o.isLight) o.dispose?.();
    });
    tex(scene.background);
    tex(scene.environment);
    // 셰이더 uniform으로만 쓰여 재질 속성에 없는 텍스처 (살아남기 탐험 안개 등)
    for (const v of scene.userData.disposables || []) tex(v);
}
