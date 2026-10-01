// GPU 자원 해제 도우미. 장면에서 remove만 하면 geometry 버퍼가 GPU에 남아 오래 플레이할수록 쌓인다.

/** 모델 캐시가 여러 개체에 나눠 주는 재질: 개체를 지울 때 해제하지 않는다 */
export function markShared(mats) {
    for (const m of Array.isArray(mats) ? mats : Object.values(mats)) if (m?.isMaterial) m.userData.shared = true;
    return mats;
}

function materialsOf(o) {
    return Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
}

/** 개체 하나(적·타워·유닛 모델, 이펙트 메시)를 지울 때: geometry와 개체 전용 재질만 해제 */
export function disposeObject(root) {
    root.traverse((o) => {
        o.geometry?.dispose();
        for (const m of materialsOf(o)) if (!m.userData.shared) m.dispose();
    });
}

/** 장면 전체를 버릴 때: 공유 재질·텍스처·그림자 맵까지 모두 해제 (다시 쓰이면 three가 새로 올린다) */
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
        o.geometry?.dispose();
        for (const m of materialsOf(o)) {
            if (seen.has(m)) continue;
            seen.add(m);
            for (const v of Object.values(m)) tex(v);
            if (m.uniforms) for (const u of Object.values(m.uniforms)) tex(u?.value);
            m.dispose();
        }
        if (o.isLight) o.dispose?.();
    });
    tex(scene.background);
    tex(scene.environment);
}
