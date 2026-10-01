// 정적 월드 조립: 조명, 하늘, 구름바다, 섬, 도로, 소품, 포털, 수정, 소켓.
import * as THREE from 'three';
import { createSky, createCloudSea, createIslets, sunDirection, LIGHT_ELEVATION } from './env/sky.js';
import { createTerrain } from './env/terrain.js';
import { createVegetation, makeTree, windUniforms } from './env/vegetation.js';
import { createRangeIndicator } from './env/range.js';
import { themeOf } from './themes.js';
import {
    createRoad,
    createLanterns,
    createRamparts,
    createPortal,
    createCore,
    createSockets,
    createLeyLines
} from './env/structures.js';
import { createFortress } from './env/fortress.js';
import { createNightCycle } from './env/nightcycle.js';
import { buildSurvivalWorld } from './survival/world.js';

export class World {
    constructor(renderer, state, quality) {
        this.state = state;
        const th = (this.theme = themeOf(state.map));
        const scene = (this.scene = new THREE.Scene());
        // 살아남기는 섬이 아니라 넓은 설원 한 장이다 (survival/world.js가 같은 모양으로 채운다)
        if (state.survival) {
            buildSurvivalWorld(this, renderer, state, quality, th);
            return;
        }
        scene.fog = new THREE.Fog(th.fog, 60, 150);

        const { sky, env } = createSky(renderer, th);
        this.sky = sky;
        scene.add(sky);
        scene.environment = env;
        scene.environmentIntensity = th.env;

        // 조명: 따뜻한 낮은 해 + 보랏빛 하늘 반사 + 뒤쪽 차가운 림
        const sunDir = sunDirection(LIGHT_ELEVATION);
        const sun = (this.sun = new THREE.DirectionalLight(th.sun.color, th.sun.intensity));
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
        const hemi = new THREE.HemisphereLight(th.hemi.sky, th.hemi.ground, th.hemi.intensity);
        scene.add(hemi);
        const rim = new THREE.DirectionalLight(th.rim.color, th.rim.intensity);
        rim.position.set(18, 14, -22);
        scene.add(rim);

        const cloud = (this.cloud = createCloudSea(sunDir, th));
        scene.add(cloud.sea, cloud.puffs);
        this.islets = createIslets((rand) => makeTree(rand, th.veg), th);
        scene.add(this.islets.group);

        const terrain = (this.terrain = createTerrain(state, th));
        scene.add(terrain.group);
        scene.add(createRoad(state, th).group);
        this.vegetation = createVegetation(terrain, { island: state.map.island, quality: quality.grass, theme: th });
        scene.add(this.vegetation.group);
        this.lanterns = createLanterns(state, terrain);
        // 성채 맵은 섬 가장자리 성벽 대신 수정을 둘러싼 성벽과 성문을 세운다
        this.ramparts = state.map.fortress
            ? { group: new THREE.Group(), update() {} }
            : createRamparts(state, terrain, th);
        this.fortress = createFortress(state, terrain, th);
        // 시작점이 같은 갈래(갈라지는 길)는 포털 하나를 같이 쓴다
        const starts = [];
        state.paths.forEach((p, i) => {
            if (!starts.some((j) => Math.hypot(state.paths[j].xs[0] - p.xs[0], state.paths[j].zs[0] - p.zs[0]) < 1))
                starts.push(i);
        });
        this.portals = starts.map((i) => createPortal(state, terrain, i));
        this.portal = this.portals[0];
        this.core = createCore(state, terrain);
        this.sockets = createSockets(state, terrain);
        this.ley = createLeyLines(state, terrain);
        for (const o of [
            this.lanterns,
            this.ramparts,
            this.fortress,
            ...this.portals,
            this.core,
            this.sockets,
            this.ley
        ])
            scene.add(o.group);
        this.hoverSocket = null;
        this.range = createRangeIndicator((x, z) => terrain.heightAt(x, z));
        scene.add(this.range.mesh);
        this.night = createNightCycle(state, th, { scene, sky, cloud, sun, hemi, rim, core: this.core });
    }

    showRange(opt) {
        this.range.show(opt);
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
        this.fortress.update(t, dt, this.state);
        for (const p of this.portals) p.update(t);
        this.night.update(dt);
        this.core.update(t);
        this.core.setHealth(this.state.lives / this.state.maxLives);
        this.sockets.update(t, this.state, this.hoverSocket);
        this.ley.update(t, this.state);
        this.range.update(t, dt);
    }
}
