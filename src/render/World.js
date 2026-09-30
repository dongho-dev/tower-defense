// 정적 월드 조립: 조명, 하늘, 구름바다, 섬, 도로, 소품, 포털, 수정, 소켓.
import * as THREE from 'three';
import { createSky, createCloudSea, createIslets, sunDirection, LIGHT_ELEVATION } from './env/sky.js';
import { createTerrain } from './env/terrain.js';
import { createVegetation, makeTree, windUniforms } from './env/vegetation.js';
import {
    createRoad,
    createLanterns,
    createRamparts,
    createPortal,
    createCore,
    createSockets,
    createLeyLines
} from './env/structures.js';

export class World {
    constructor(renderer, state, quality) {
        this.state = state;
        const scene = (this.scene = new THREE.Scene());
        scene.fog = new THREE.Fog(0xd99a86, 55, 140);

        const { sky, env } = createSky(renderer);
        scene.add(sky);
        scene.environment = env;
        scene.environmentIntensity = 0.35;

        // 조명: 따뜻한 낮은 해 + 보랏빛 하늘 반사 + 뒤쪽 차가운 림
        const sunDir = sunDirection(LIGHT_ELEVATION);
        const sun = (this.sun = new THREE.DirectionalLight(0xffa25e, 2.9));
        sun.position.copy(sunDir).multiplyScalar(40);
        sun.castShadow = true;
        sun.shadow.mapSize.set(quality.shadow, quality.shadow);
        const sc = sun.shadow.camera;
        sc.left = -22;
        sc.right = 22;
        sc.top = 16;
        sc.bottom = -16;
        sc.near = 5;
        sc.far = 90;
        sun.shadow.bias = -0.0005;
        sun.shadow.normalBias = 0.03;
        sun.shadow.radius = 3;
        scene.add(sun, sun.target);
        scene.add(new THREE.HemisphereLight(0x8c7fe0, 0x4a3226, 0.62));
        const rim = new THREE.DirectionalLight(0x8f7cff, 0.9);
        rim.position.set(18, 14, -22);
        scene.add(rim);

        const cloud = (this.cloud = createCloudSea(sunDir));
        scene.add(cloud.sea, cloud.puffs);
        this.islets = createIslets(makeTree);
        scene.add(this.islets.group);

        const terrain = (this.terrain = createTerrain(state));
        scene.add(terrain.group);
        scene.add(createRoad(state).group);
        this.vegetation = createVegetation(terrain, { island: state.map.island, quality: quality.grass });
        scene.add(this.vegetation.group);
        this.lanterns = createLanterns(state, terrain);
        this.ramparts = createRamparts(state, terrain);
        this.portal = createPortal(state, terrain);
        this.core = createCore(state, terrain);
        this.sockets = createSockets(state, terrain);
        this.ley = createLeyLines(state, terrain);
        for (const o of [this.lanterns, this.ramparts, this.portal, this.core, this.sockets, this.ley])
            scene.add(o.group);
        this.hoverSocket = null;
    }

    heightAt(x, z) {
        return this.terrain.heightAt(x, z);
    }

    update(t, dt) {
        windUniforms.uTime.value = t;
        this.cloud.update(t);
        this.islets.update(t);
        this.lanterns.update(t);
        this.ramparts.update(t);
        this.portal.update(t);
        this.core.update(t);
        this.core.setHealth(this.state.lives / this.state.maxLives);
        this.sockets.update(t, this.state, this.hoverSocket);
        this.ley.update(t, this.state);
        void dt;
    }
}
