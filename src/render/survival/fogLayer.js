// 탐험 안개(렌더): 로직의 타일 마스크(sv.fog)를 두 배로 키워 부드럽게 번진 텍스처로 만들고,
// 지형·바위·나무·광맥 재질의 셰이더에 곱한다. 미탐험 = 검정, 탐험했지만 시야 밖 = 어둑하고 푸르게, 시야 안 = 그대로.
import * as THREE from 'three';

const UP = 4;
const DIM = 118;

/** 상자 흐림 (가로 → 세로), 반경 r. a를 제자리에서 흐린다 */
function blur(a, b, S, r) {
    const n = 2 * r + 1;
    for (let y = 0; y < S; y++) {
        let acc = 0;
        const o = y * S;
        for (let x = -r; x <= r; x++) acc += a[o + Math.min(S - 1, Math.max(0, x))];
        for (let x = 0; x < S; x++) {
            b[o + x] = acc / n;
            acc += a[o + Math.min(S - 1, x + r + 1)] - a[o + Math.max(0, x - r)];
        }
    }
    for (let x = 0; x < S; x++) {
        let acc = 0;
        for (let y = -r; y <= r; y++) acc += b[Math.min(S - 1, Math.max(0, y)) * S + x];
        for (let y = 0; y < S; y++) {
            a[y * S + x] = acc / n;
            acc += b[Math.min(S - 1, y + r + 1) * S + x] - b[Math.max(0, y - r) * S + x];
        }
    }
}

export function createFogLayer(state) {
    const sv = state.survival;
    const f = sv.field;
    const N = f.N;
    const S = N * UP;
    const raw = new Uint8Array(N * N);
    const data = new Uint8Array(S * S);
    const tmp = new Float32Array(S * S);
    const tmp2 = new Float32Array(S * S);
    const tex = new THREE.DataTexture(data, S, S, THREE.RedFormat, THREE.UnsignedByteType);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    const uniforms = {
        uFogTex: { value: tex },
        uFogRect: { value: new THREE.Vector3(-f.half, -f.half, 1 / (2 * f.half)) },
        uFogOn: { value: 1 }
    };
    let version = -1;

    function rebuild() {
        const { explored, visible } = sv.fog;
        for (let k = 0; k < N * N; k++) raw[k] = visible[k] ? 255 : explored[k] ? DIM : 0;
        // 키운 뒤 가로·세로 상자 흐림 두 번 (칸 경계가 계단처럼 보이지 않게)
        for (let y = 0; y < S; y++) {
            const row = Math.floor(y / UP) * N;
            for (let x = 0; x < S; x++) tmp[y * S + x] = raw[row + Math.floor(x / UP)];
        }
        blur(tmp, tmp2, S, UP);
        blur(tmp, tmp2, S, UP);
        for (let k = 0; k < S * S; k++) data[k] = tmp[k];
        tex.needsUpdate = true;
    }

    return {
        tex,
        uniforms,
        update() {
            if (sv.fog.version === version) return;
            version = sv.fog.version;
            rebuild();
        },
        /** 재질에 안개를 입힌다 (onBeforeCompile). 인스턴스 메시도 된다 */
        patch(material) {
            const prev = material.onBeforeCompile;
            material.onBeforeCompile = (sh, r) => {
                prev?.call(material, sh, r);
                Object.assign(sh.uniforms, uniforms);
                sh.vertexShader = sh.vertexShader
                    .replace('#include <common>', '#include <common>\nvarying vec2 vFogW;')
                    .replace(
                        '#include <project_vertex>',
                        `#include <project_vertex>
                        vec4 fogWp = vec4( transformed, 1.0 );
                        #ifdef USE_INSTANCING
                            fogWp = instanceMatrix * fogWp;
                        #endif
                        vFogW = ( modelMatrix * fogWp ).xz;`
                    );
                sh.fragmentShader = sh.fragmentShader
                    .replace(
                        '#include <common>',
                        '#include <common>\nvarying vec2 vFogW;\nuniform sampler2D uFogTex;\nuniform vec3 uFogRect;\nuniform float uFogOn;'
                    )
                    .replace(
                        '#include <dithering_fragment>',
                        `{
                            float fv = texture2D( uFogTex, ( vFogW - uFogRect.xy ) * uFogRect.z ).r;
                            fv = mix( 1.0, fv, uFogOn );
                            vec3 dimC = gl_FragColor.rgb * vec3( 0.5, 0.55, 0.72 );
                            vec3 c = mix( vec3( 0.0 ), dimC, smoothstep( 0.02, 0.46, fv ) );
                            gl_FragColor.rgb = mix( c, gl_FragColor.rgb, smoothstep( 0.5, 0.97, fv ) );
                        }
                        #include <dithering_fragment>`
                    );
            };
            material.customProgramCacheKey = () => 'fogw-' + (material.vertexColors ? 'vc' : 'n');
            material.needsUpdate = true;
            return material;
        },
        /** 이 자리의 안개 값 0~1 (미니맵·마커용) */
        valueAt(x, z) {
            const k = f.cellAt(x, z);
            if (k < 0) return 0;
            return sv.fog.visible[k] ? 1 : sv.fog.explored[k] ? DIM / 255 : 0;
        }
    };
}
