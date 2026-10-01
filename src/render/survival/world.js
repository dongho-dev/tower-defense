// 살아남기 월드 조립: 구름 위 섬 대신 넓은 설원 한 장. World(일반 맵)와 같은 모양의 객체를 채워
// 앱·EntityView·이펙트·오버레이가 그대로 쓸 수 있게 한다. 그림자는 카메라가 보는 곳만 따라간다.
import * as THREE from 'three';
import { createSky, createCloudSea, sunDirection, LIGHT_ELEVATION } from '../env/sky.js';
import { createRangeIndicator } from '../env/range.js';
import { createCore } from '../env/structures.js';
import { createNightCycle } from '../env/nightcycle.js';
import { createFogLayer } from './fogLayer.js';
import { createSurvivalTerrain } from './terrainMesh.js';
import { createSurvivalProps } from './props.js';
import { createNest } from './nest.js';
import { createSurvivalBuildings } from './buildings.js';
import { createWorker } from './worker.js';
import { createBuildGrid } from './buildGrid.js';

const NONE = () => ({ group: new THREE.Group(), pickables: [], update() {} });

/** world: 빈 World 인스턴스 (필드를 여기서 채운다) */
export function buildSurvivalWorld(world, renderer, state, quality, th) {
    const scene = world.scene;
    scene.fog = new THREE.Fog(th.fog, 130, 280);
    const { sky, env } = createSky(renderer, th);
    world.sky = sky;
    scene.add(sky);
    scene.environment = env;
    scene.environmentIntensity = th.env;
    scene.background = new THREE.Color(0x05060c);

    const sunDir = (world.sunDir = sunDirection(LIGHT_ELEVATION));
    const sun = (world.sun = new THREE.DirectionalLight(th.sun.color, th.sun.intensity));
    sun.position.copy(sunDir).multiplyScalar(60);
    sun.castShadow = true;
    sun.shadow.mapSize.set(quality.shadow, quality.shadow);
    const sc = sun.shadow.camera;
    sc.near = 5;
    sc.far = 160;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.04;
    sun.shadow.radius = 2;
    scene.add(sun, sun.target);
    const hemi = new THREE.HemisphereLight(th.hemi.sky, th.hemi.ground, th.hemi.intensity * 1.1);
    scene.add(hemi);
    const rim = new THREE.DirectionalLight(th.rim.color, th.rim.intensity);
    rim.position.set(18, 14, -22);
    scene.add(rim);
    // 밤 순환이 구름바다 재질 색을 바꾸므로 만들어 두되 보이지 않게 (섬이 아니다)
    const cloud = (world.cloud = createCloudSea(sunDir, th));
    cloud.sea.visible = false;
    cloud.puffs.visible = false;
    scene.add(cloud.sea, cloud.puffs);
    world.islets = { group: new THREE.Group(), update() {} };

    const fog = (world.fogLayer = createFogLayer(state));
    fog.update();
    scene.userData.disposables = [fog.tex];
    const terrain = (world.terrain = createSurvivalTerrain(state, fog));
    scene.add(terrain.group);
    world.props = createSurvivalProps(state, terrain, fog);
    scene.add(world.props.group);
    world.nest = createNest(state, terrain);
    scene.add(world.nest.group);
    world.buildings = createSurvivalBuildings(state, terrain);
    scene.add(world.buildings.group);
    world.worker = createWorker(state, terrain);
    scene.add(world.worker.group);
    world.buildGrid = createBuildGrid(state, terrain);
    scene.add(world.buildGrid.group);

    world.vegetation = { group: new THREE.Group() };
    world.lanterns = NONE();
    world.ramparts = NONE();
    world.fortress = { ...NONE(), gateTop: () => null };
    world.portals = [];
    world.portal = { group: world.nest.group };
    world.caves = null;
    world.veins = null;
    // 본진(수정): 생존자가 짓기 전에는 숨겨 둔다
    const core = (world.core = createCore(state, { core: { x: 0, z: 0 }, heightAt: () => 0 }));
    core.group.visible = false;
    core.group.scale.setScalar(1.35);
    // 넓은 설원에서 수정의 둥근 빛 번짐이 건물을 덮지 않게 줄인다 (하늘로 솟는 빛은 없다)
    core.group.traverse((o) => {
        if (o.isSprite) {
            o.scale.multiplyScalar(0.45);
            o.material.color.setScalar(0.55);
        } else if (o.isMesh && o.material.blending === THREE.AdditiveBlending) {
            // 바닥 룬 고리는 은은하게, 수정 둘레에 떠 있는 고리는 없앤다
            if (o.rotation.x !== -Math.PI / 2) o.visible = false;
            else o.material.color.multiplyScalar(0.12);
        }
    });
    // setHealth가 매 프레임 수정 빛과 점광원 세기를 다시 정하므로, 그 뒤에 줄인다
    const lights = [];
    core.group.traverse((o) => o.isPointLight && lights.push(o));
    const setHealth = core.setHealth;
    core.setHealth = (r) => {
        setHealth(r);
        for (const l of lights) l.intensity *= 0.3;
        core.crystal.material.emissiveIntensity *= 0.4;
    };
    scene.add(core.group);
    world.sockets = { group: new THREE.Group(), pickables: [], topY: () => 0, update() {} };
    world.ley = NONE();
    scene.add(world.sockets.group);
    world.hoverSocket = null;
    world.range = createRangeIndicator((x, z) => terrain.heightAt(x, z));
    scene.add(world.range.mesh);
    world.night = createNightCycle(state, th, { scene, sky, cloud, sun, hemi, rim, core });
    world.survival = true;
    world.update = (t, dt) => updateSurvivalWorld(world, t, dt);
    return world;
}

const _focus = new THREE.Vector3();

function updateSurvivalWorld(world, t, dt) {
    const state = world.state;
    const sv = state.survival;
    world.fogLayer.update();
    world.props.update(t);
    world.nest.update(t, dt);
    world.buildings.update();
    world.worker.update(t, dt);
    world.night.update(dt);
    // 밤 순환은 섬 크기에 맞춘 안개 거리를 쓴다: 넓은 맵에서는 카메라 거리만큼 밀어낸다
    const rig0 = world.rig;
    if (rig0) {
        const fog = world.scene.fog;
        fog.near = Math.max(fog.near, rig0.distance * 1.3);
        fog.far = Math.max(fog.far, rig0.distance * 2.8);
    }
    world.range.update(t, dt);
    // 본진: 세운 자리로 옮기고 보이게 (짓는 중이면 다 지은 만큼만 솟는다)
    const core = world.core;
    if (sv.base) {
        if (!core.group.visible || core.placedFor !== sv.base) {
            core.placedFor = sv.base;
            core.group.visible = true;
            const y = world.buildings.baseTop();
            core.group.position.set(sv.base.x, y, sv.base.z);
            core.top.set(sv.base.x, y + 1.6, sv.base.z);
        }
        const bp = sv.base.build ? Math.max(0.1, sv.base.build.t / sv.base.build.T) : 1;
        core.group.scale.set(1.35, 1.35 * bp, 1.35);
    } else core.group.visible = false;
    core.update(t);
    core.setHealth(state.lives / state.maxLives);
    // 그림자: 카메라가 보는 곳 둘레만 (넓은 맵 전체를 한 장에 담으면 흐려진다)
    const rig = world.rig;
    if (rig) {
        _focus.copy(rig.target);
        const ext = THREE.MathUtils.clamp(rig.distance * 0.85, 16, 75);
        const sun = world.sun;
        const sc = sun.shadow.camera;
        if (Math.abs(sc.right - ext) > 0.5) {
            sc.left = -ext;
            sc.right = ext;
            sc.top = ext;
            sc.bottom = -ext;
            sc.updateProjectionMatrix();
        }
        // 그림자 텍셀 단위로 맞춰 움직여 가장자리가 떨리지 않게
        const texel = (ext * 2) / sun.shadow.mapSize.x;
        _focus.x = Math.round(_focus.x / texel) * texel;
        _focus.z = Math.round(_focus.z / texel) * texel;
        sun.target.position.copy(_focus);
        sun.position.copy(world.sunDir).multiplyScalar(70).add(_focus);
    }
}
