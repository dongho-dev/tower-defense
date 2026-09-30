// 전술 카메라: 고정 기울기, 드래그 이동, 휠 줌, 부드러운 감쇠, 흔들림, 인트로 비행.
import * as THREE from 'three';

const PITCH = THREE.MathUtils.degToRad(52);

export class CameraRig {
    constructor(bounds) {
        this.camera = new THREE.PerspectiveCamera(34, 16 / 9, 0.5, 3000);
        this.bounds = bounds; // { rx, rz }
        this.target = new THREE.Vector3(0.5, 0, 0.6);
        this.goal = this.target.clone();
        this.distance = 34;
        this.goalDistance = 34;
        this.minDistance = 13;
        this.maxDistance = 40;
        this.yaw = 0;
        this.shakeAmp = 0;
        this.intro = null;
        this.keys = new Set();
        this.apply();
    }

    attach(dom) {
        this.dom = dom;
        let drag = null;
        dom.addEventListener('pointerdown', (e) => {
            if (e.button === 1 || e.button === 2 || e.button === 0) {
                drag = { x: e.clientX, y: e.clientY, moved: false, button: e.button };
            }
        });
        window.addEventListener('pointermove', (e) => {
            if (!drag) return;
            const dx = e.clientX - drag.x;
            const dy = e.clientY - drag.y;
            if (!drag.moved && Math.hypot(dx, dy) < 6) return;
            drag.moved = true;
            this.dragging = true;
            const k = (this.distance / dom.clientHeight) * 1.25;
            this.goal.x -= dx * k;
            this.goal.z -= (dy * k) / Math.sin(PITCH);
            drag.x = e.clientX;
            drag.y = e.clientY;
            this.clampGoal();
        });
        window.addEventListener('pointerup', () => {
            drag = null;
            // 클릭 이벤트가 드래그 끝에서 발생하지 않도록 한 프레임 늦게 해제
            setTimeout(() => (this.dragging = false), 0);
        });
        dom.addEventListener(
            'wheel',
            (e) => {
                e.preventDefault();
                this.goalDistance = THREE.MathUtils.clamp(
                    this.goalDistance * (1 + Math.sign(e.deltaY) * 0.1),
                    this.minDistance,
                    this.maxDistance
                );
            },
            { passive: false }
        );
        dom.addEventListener('contextmenu', (e) => e.preventDefault());
        window.addEventListener('keydown', (e) => this.keys.add(e.key.toLowerCase()));
        window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    }

    clampGoal() {
        const { rx, rz } = this.bounds;
        this.goal.x = THREE.MathUtils.clamp(this.goal.x, -rx * 0.7, rx * 0.7);
        this.goal.z = THREE.MathUtils.clamp(this.goal.z, -rz * 0.7, rz * 0.8);
    }

    shake(amount) {
        this.shakeAmp = Math.min(0.6, this.shakeAmp + amount);
    }

    /** 포털에서 수정까지 훑는 인트로 */
    playIntro(from, to, duration = 3.2) {
        this.intro = { t: 0, duration, from: from.clone(), to: to.clone() };
    }

    skipIntro() {
        this.intro = null;
    }

    update(dt) {
        const pan = 18 * dt * (this.distance / 30);
        if (this.keys.has('arrowleft')) this.goal.x -= pan;
        if (this.keys.has('arrowright')) this.goal.x += pan;
        if (this.keys.has('arrowup')) this.goal.z -= pan;
        if (this.keys.has('arrowdown')) this.goal.z += pan;
        this.clampGoal();
        if (this.intro) {
            const it = this.intro;
            it.t += dt;
            const k = Math.min(1, it.t / it.duration);
            const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
            this.target.lerpVectors(it.from, it.to, e);
            this.distance = THREE.MathUtils.lerp(16, this.goalDistance, e);
            this.goal.copy(it.to);
            if (k >= 1) this.intro = null;
        } else {
            const a = 1 - Math.exp(-dt * 8);
            this.target.lerp(this.goal, a);
            this.distance += (this.goalDistance - this.distance) * a;
        }
        this.shakeAmp = Math.max(0, this.shakeAmp - dt * 1.6);
        this.apply();
    }

    apply() {
        const c = this.camera;
        const h = Math.sin(PITCH) * this.distance;
        const back = Math.cos(PITCH) * this.distance;
        c.position.set(
            this.target.x + Math.sin(this.yaw) * back,
            this.target.y + h,
            this.target.z + Math.cos(this.yaw) * back
        );
        if (this.shakeAmp > 0) {
            const s = this.shakeAmp * this.shakeAmp;
            c.position.x += (Math.random() - 0.5) * s;
            c.position.y += (Math.random() - 0.5) * s;
        }
        c.lookAt(this.target);
    }
}
