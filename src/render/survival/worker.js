// 살아남기 생존자(일꾼) 모델: 주황 방한복에 털모자, 등짐과 망치를 든 작은 사람.
// 걸을 때는 몸이 흔들리고, 짓거나 고칠 때는 망치를 내리친다. 발밑에 옅은 하늘색 고리를 둬서 넓은 맵에서도 찾기 쉽다.
// 고른(선택한) 생존자는 발밑 고리가 밝은 초록으로 또렷해진다. 생존자가 여럿이면 저마다 모델 하나.
// 쓰러지면 감춘다 (다시 살아나면 본진 곁에 나타난다).
import * as THREE from 'three';

const SEL = 0x8dffa8;
const IDLE = 0x7fe0ff;

/** 생존자들 (sv.workers): selected = 고른 생존자 id 모음 (조작 UI가 채운다) */
export function createWorkers(state, terrain) {
    const sv = state.survival;
    const group = new THREE.Group();
    group.name = 'survival-workers';
    const views = new Map();
    const api = {
        group,
        selected: new Set(),
        /** 머리 위 (체력바·이름표 자리) */
        top(w, out) {
            return out.set(w.x, terrain.heightAt(w.x, w.z) + 1.25, w.z);
        },
        update(t, dt) {
            for (const w of sv.workers) {
                let v = views.get(w.id);
                if (!v) {
                    v = createWorker(state, terrain, w);
                    views.set(w.id, v);
                    group.add(v.group);
                }
                v.update(t, dt, api.selected.has(w.id));
            }
        }
    };
    return api;
}

function createWorker(state, terrain, w) {
    const g = new THREE.Group();
    g.name = 'survival-worker';
    const mat = (color, extra = {}) =>
        new THREE.MeshStandardMaterial({ color, roughness: 0.75, flatShading: true, ...extra });
    const parka = mat(0xe0782c);
    const dark = mat(0x3a2c26);
    const fur = mat(0xf1ece2);
    const skin = mat(0xe8b48c);
    const steel = mat(0x9aa3ad, { metalness: 0.5, roughness: 0.4 });

    const body = new THREE.Group();
    g.add(body);
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.22, 0.42, 7), parka);
    torso.position.y = 0.42;
    body.add(torso);
    const hem = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.06, 7), fur);
    hem.position.y = 0.22;
    body.add(hem);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), skin);
    head.position.y = 0.74;
    body.add(head);
    const hood = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.05, 5, 10), fur);
    hood.position.set(0, 0.75, 0.02);
    body.add(hood);
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.18, 7), parka);
    hat.position.y = 0.9;
    body.add(hat);
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.3, 0.14), dark);
    pack.position.set(0, 0.47, -0.2);
    body.add(pack);
    for (const side of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.24, 5), dark);
        leg.position.set(side * 0.08, 0.12, 0);
        leg.name = side < 0 ? 'legL' : 'legR';
        body.add(leg);
    }
    // 망치 든 팔 (어깨를 축으로 돈다)
    const arm = new THREE.Group();
    arm.position.set(0.2, 0.55, 0.02);
    body.add(arm);
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.26, 5), parka);
    sleeve.position.y = -0.12;
    arm.add(sleeve);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.32, 4), dark);
    handle.rotation.x = Math.PI / 2;
    handle.position.set(0, -0.24, 0.14);
    arm.add(handle);
    const headH = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.14), steel);
    headH.position.set(0, -0.24, 0.3);
    arm.add(headH);
    body.traverse((o) => {
        if (o.isMesh) o.castShadow = true;
    });

    // 발밑 고리
    const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.42, 0.52, 28),
        new THREE.MeshBasicMaterial({ color: 0x7fe0ff, transparent: true, opacity: 0.75, depthWrite: false })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.renderOrder = 4;
    g.add(ring);

    const legL = body.getObjectByName('legL');
    const legR = body.getObjectByName('legR');
    let lastX = w.x;
    let lastZ = w.z;
    let walk = 0;
    let yaw = 0;
    return {
        group: g,
        update(t, dt, selected) {
            g.visible = w.alive;
            if (!w.alive) return;
            const moved = Math.hypot(w.x - lastX, w.z - lastZ);
            lastX = w.x;
            lastZ = w.z;
            walk += moved * 9;
            g.position.set(w.x, terrain.heightAt(w.x, w.z), w.z);
            // 걷는 방향을 바라본다 (부드럽게)
            const want = Math.atan2(w.dirX, w.dirZ);
            let d = want - yaw;
            d = Math.atan2(Math.sin(d), Math.cos(d));
            yaw += d * Math.min(1, dt * 12);
            body.rotation.y = yaw;
            const walking = moved > 1e-4;
            body.position.y = walking ? Math.abs(Math.sin(walk)) * 0.05 : 0;
            legL.rotation.x = walking ? Math.sin(walk) * 0.6 : 0;
            legR.rotation.x = walking ? -Math.sin(walk) * 0.6 : 0;
            const working = w.task === 'build' || w.task === 'repair';
            arm.rotation.x = working ? -1.2 + Math.abs(Math.sin(t * 7)) * 1.5 : walking ? Math.sin(walk) * 0.4 : 0.15;
            // 맞은 직후 고리가 붉게. 고른 생존자는 밝은 초록 고리 (크고 또렷하게)
            const hurt = state.time - w.hitT < 0.3;
            ring.material.color.setHex(hurt ? 0xff5a4a : selected ? SEL : IDLE);
            ring.material.opacity = selected ? 0.95 : 0.45 + 0.2 * Math.sin(t * 3);
            ring.scale.setScalar(selected ? 1.18 : 1);
            ring.position.y = 0.05;
        }
    };
}
