// WebGL 렌더러 + 후처리 체인 (MSAA → 블룸 → 톤매핑 → 색보정).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

export const QUALITY = {
    high: { pixelRatio: 2, shadow: 4096, bloom: true, samples: 4, grass: 1, particles: 1 },
    medium: { pixelRatio: 1.5, shadow: 2048, bloom: true, samples: 4, grass: 0.6, particles: 0.7 },
    low: { pixelRatio: 1, shadow: 1024, bloom: false, samples: 0, grass: 0.3, particles: 0.45 }
};

const GradeShader = {
    uniforms: {
        tDiffuse: { value: null },
        uVignette: { value: 0.32 },
        uSaturation: { value: 1.1 },
        uShadowTint: { value: new THREE.Color('#5a4a8a') },
        uHighTint: { value: new THREE.Color('#ffd9a8') },
        uTime: { value: 0 },
        uGrain: { value: 0.025 }
    },
    vertexShader:
        'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse;
        uniform float uVignette, uSaturation, uTime, uGrain;
        uniform vec3 uShadowTint, uHighTint;
        varying vec2 vUv;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233)) + uTime) * 43758.5453); }
        void main() {
            vec4 c = texture2D(tDiffuse, vUv);
            float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
            c.rgb = mix(vec3(l), c.rgb, uSaturation);
            // 스플릿 토닝: 어두운 곳은 보라, 밝은 곳은 금빛
            c.rgb += (uShadowTint - 0.5) * 0.12 * (1.0 - smoothstep(0.0, 0.5, l));
            c.rgb += (uHighTint - 0.5) * 0.08 * smoothstep(0.5, 1.0, l);
            vec2 d = vUv - 0.5;
            float v = smoothstep(0.85, 0.25, length(d * vec2(1.1, 1.0)));
            c.rgb *= mix(1.0 - uVignette, 1.0, v);
            c.rgb += (hash(vUv * 999.0) - 0.5) * uGrain;
            gl_FragColor = c;
        }`
};

export class Renderer {
    constructor(container, qualityName = 'high') {
        this.container = container;
        this.renderer = new THREE.WebGLRenderer({
            antialias: false,
            powerPreference: 'high-performance',
            stencil: false
        });
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 0.9;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.appendChild(this.renderer.domElement);
        this.setQuality(qualityName);
    }

    setQuality(name) {
        this.qualityName = name;
        this.quality = QUALITY[name];
        this.renderer.setPixelRatio(Math.min(this.quality.pixelRatio, window.devicePixelRatio || 1));
        if (this.scene) this.buildComposer(this.scene, this.camera);
    }

    buildComposer(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        const { w, h } = this.size();
        const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: this.quality.samples });
        this.composer = new EffectComposer(this.renderer, rt);
        this.composer.addPass(new RenderPass(scene, camera));
        this.bloom = new UnrealBloomPass(new THREE.Vector2(w / 2, h / 2), 0.7, 0.5, 2.4);
        this.bloom.enabled = this.quality.bloom;
        this.composer.addPass(this.bloom);
        this.composer.addPass(new OutputPass());
        this.grade = new ShaderPass(GradeShader);
        this.composer.addPass(this.grade);
        this.resize();
    }

    size() {
        return {
            w: this.container.clientWidth || window.innerWidth,
            h: this.container.clientHeight || window.innerHeight
        };
    }

    resize() {
        const { w, h } = this.size();
        this.renderer.setSize(w, h, false);
        this.renderer.domElement.style.width = '100%';
        this.renderer.domElement.style.height = '100%';
        if (this.camera) {
            this.camera.aspect = w / h;
            this.camera.updateProjectionMatrix();
        }
        this.composer?.setSize(w, h);
    }

    render(t) {
        if (this.grade) this.grade.uniforms.uTime.value = t % 10;
        this.composer.render();
    }
}
