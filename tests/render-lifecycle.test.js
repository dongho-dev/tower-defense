import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { WebGLObjects } from 'three/src/renderers/webgl/WebGLObjects.js';
import { disposeObject, disposeScene, markShared } from '../src/render/dispose.js';
import { CameraRig } from '../src/render/CameraRig.js';
import { buildEnemyModel } from '../src/render/models/enemies.js';
import { buildTowerModel } from '../src/render/models/towers.js';
import { materials } from '../src/render/models/materials.js';

test('removing enemies and upgraded tower models releases private material clones, preserving shared originals', () => {
    const originals = Object.values(materials());
    const sharedDisposed = new Set();
    const onSharedDispose = (event) => sharedDisposed.add(event.target);
    for (const mat of originals) mat.addEventListener('dispose', onSharedDispose);
    try {
        for (const type of ['ironclad', 'wraith', 'rimeguard']) {
            const model = buildEnemyModel(type, false);
            const neighbor = buildEnemyModel(type, false);
            const neighborMaterials = new Set();
            neighbor.root.traverse((o) => {
                if (o.material) neighborMaterials.add(o.material);
            });
            const owned = new Set();
            model.root.traverse((o) => {
                if (o.material && !neighborMaterials.has(o.material)) owned.add(o.material);
            });
            assert.ok(owned.size > 0);
            const disposed = new Set();
            for (const mat of owned) mat.addEventListener('dispose', () => disposed.add(mat));
            disposeObject(model.root);
            assert.deepEqual(disposed, owned, `${type} retained an individual material`);
            disposeObject(neighbor.root);
        }
        const tower = buildTowerModel('ranger', 2, null, 1, 0);
        const cloths = new Set();
        tower.group.traverse((o) => {
            if (o.material?.type === materials().cloth.type && o.geometry?.type === 'PlaneGeometry')
                cloths.add(o.material);
        });
        assert.ok(cloths.size > 0);
        const disposed = new Set();
        for (const mat of cloths) mat.addEventListener('dispose', () => disposed.add(mat));
        disposeObject(tower.group);
        assert.deepEqual(disposed, cloths);
        assert.equal(sharedDisposed.size, 0);
    } finally {
        for (const mat of originals) mat.removeEventListener('dispose', onSharedDispose);
    }
});

for (const [name, dispose] of [
    ['object', disposeObject],
    ['scene', disposeScene]
]) {
    test(`${name} disposal releases instance buffers and their renderer bindings`, () => {
        const buffers = new Set();
        const bindings = new Set();
        // Exercise the installed Three.js disposal listener without creating a GPU context.
        const objects = WebGLObjects(
            { ARRAY_BUFFER: 1 },
            { get: (_, geometry) => geometry, update() {} },
            { update: (attribute) => buffers.add(attribute), remove: (attribute) => buffers.delete(attribute) },
            { releaseStatesOfObject: (object) => bindings.delete(object) },
            { render: { frame: 0 } }
        );
        const scene = new THREE.Scene();
        const material = new THREE.MeshBasicMaterial();
        markShared([material]);
        let materialDisposals = 0;
        material.addEventListener('dispose', () => materialDisposals++);
        for (const colored of [false, true]) {
            const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(), material, 10);
            if (colored) mesh.setColorAt(0, new THREE.Color('red'));
            scene.add(mesh);
            bindings.add(mesh);
            objects.update(mesh);
        }
        assert.equal(buffers.size, 3);
        dispose(scene);
        assert.equal(buffers.size, 0);
        assert.equal(bindings.size, 0);
        // 공유 재질은 장면을 버릴 때도 남긴다: 다음 맵에서 셰이더를 다시 컴파일하느라 멈추지 않게
        assert.equal(materialDisposals, 0);
    });
}

function send(target, type, props = {}) {
    target.dispatchEvent(Object.assign(new Event(type), props));
}

function cameraInput(t) {
    const oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
    const oldDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
    const window = new EventTarget();
    const document = Object.assign(new EventTarget(), { hidden: false });
    Object.defineProperty(globalThis, 'window', { value: window, configurable: true });
    Object.defineProperty(globalThis, 'document', { value: document, configurable: true });
    t.after(() => {
        if (oldWindow) Object.defineProperty(globalThis, 'window', oldWindow);
        else delete globalThis.window;
        if (oldDocument) Object.defineProperty(globalThis, 'document', oldDocument);
        else delete globalThis.document;
    });
    const dom = Object.assign(new EventTarget(), { clientHeight: 600 });
    const rig = new CameraRig({ rx: 20, rz: 20 });
    rig.attach(dom);
    return { rig, dom, window, document };
}

for (const event of ['blur', 'pointercancel', 'visibilitychange']) {
    test(`camera ${event} clears held keys and cancels an interrupted drag`, (t) => {
        const { rig, dom, window, document } = cameraInput(t);
        send(window, 'keydown', { key: 'ArrowRight' });
        const before = rig.goal.x;
        rig.update(0.1);
        assert.ok(rig.goal.x > before);
        send(dom, 'pointerdown', { button: 0, clientX: 100, clientY: 100 });
        send(window, 'pointermove', { clientX: 120, clientY: 120 });
        assert.equal(rig.dragging, true);
        if (event === 'visibilitychange') {
            document.hidden = true;
            send(document, event);
        } else send(window, event);
        const goal = rig.goal.clone();
        rig.update(0.1);
        send(window, 'pointermove', { clientX: 200, clientY: 200 });
        assert.deepEqual(rig.goal.toArray(), goal.toArray());
        assert.equal(rig.keys.size, 0);
        assert.equal(rig.dragging, false);
        // Fresh input still works after the interrupted gesture.
        send(dom, 'pointerdown', { button: 0, clientX: 100, clientY: 100 });
        send(window, 'pointermove', { clientX: 130, clientY: 100 });
        assert.notEqual(rig.goal.x, goal.x);
    });
}
