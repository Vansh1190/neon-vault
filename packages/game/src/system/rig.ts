import * as THREE from "three";

export interface KeyboardState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  brake: boolean;
  horn: boolean;
}

export interface PointerState {
  down: boolean;
  x: number;
  y: number;
  dx: number;
  dy: number;
  wheel: number;
}

export interface Input {
  keys: KeyboardState;
  pointer: PointerState;
  pressed: Set<string>;
  attach: () => void;
  detach: () => void;
  endFrame: () => void;
}

const MAP: Record<string, keyof KeyboardState> = {
  KeyW: "up",
  ArrowUp: "up",
  KeyS: "down",
  ArrowDown: "down",
  KeyA: "left",
  ArrowLeft: "left",
  KeyD: "right",
  ArrowRight: "right",
  Space: "brake",
  KeyH: "horn",
};

export function createInput(target: HTMLElement): Input {
  const keys: KeyboardState = {
    up: false,
    down: false,
    left: false,
    right: false,
    brake: false,
    horn: false,
  };
  const pointer: PointerState = { down: false, x: 0, y: 0, dx: 0, dy: 0, wheel: 0 };
  const pressed = new Set<string>();

  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.repeat) return;
    pressed.add(e.code);
    const mapped = MAP[e.code];
    if (mapped) {
      keys[mapped] = true;
      if (e.code === "Space") e.preventDefault();
    }
  };
  const onKeyUp = (e: KeyboardEvent): void => {
    const mapped = MAP[e.code];
    if (mapped) keys[mapped] = false;
  };
  const onPointerDown = (e: PointerEvent): void => {
    pointer.down = true;
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    target.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent): void => {
    if (!pointer.down) return;
    pointer.dx += e.clientX - pointer.x;
    pointer.dy += e.clientY - pointer.y;
    pointer.x = e.clientX;
    pointer.y = e.clientY;
  };
  const onPointerUp = (): void => {
    pointer.down = false;
  };
  const onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    pointer.wheel += Math.sign(e.deltaY);
  };

  const input: Input = {
    keys,
    pointer,
    pressed,
    attach() {
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);
      target.addEventListener("pointerdown", onPointerDown);
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      target.addEventListener("wheel", onWheel, { passive: false });
    },
    detach() {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      target.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      target.removeEventListener("wheel", onWheel);
    },
    endFrame() {
      pressed.clear();
      pointer.dx = 0;
      pointer.dy = 0;
      pointer.wheel = 0;
    },
  };
  return input;
}

export interface ChaseCameraOptions {
  distance: number;
  height: number;
  lookHeight: number;
  damping: number;
}

export class ChaseCamera {
  private readonly pos = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();
  ready = false;

  constructor(private readonly options: ChaseCameraOptions) {}

  follow(camera: THREE.PerspectiveCamera, x: number, z: number, heading: number, dt: number): void {
    const fx = Math.sin(heading);
    const fz = Math.cos(heading);
    const want = this.tmp.set(x - fx * this.options.distance, this.options.height, z - fz * this.options.distance);
    if (!this.ready) {
      this.pos.copy(want);
      this.ready = true;
    } else {
      const blend = 1 - Math.exp(-this.options.damping * dt);
      this.pos.lerp(want, blend);
    }
    camera.position.copy(this.pos);
    camera.up.set(0, 1, 0);
    camera.lookAt(x + fx * 7, this.options.lookHeight, z + fz * 7);
  }

  flythrough(
    camera: THREE.PerspectiveCamera,
    center: THREE.Vector3,
    radius: number,
    progress: number,
  ): void {
    const angle = progress * Math.PI * 0.75 + 0.6;
    const height = 190 * (1 - progress * progress * 0.82);
    camera.position.set(
      center.x + Math.sin(angle) * radius * (1 - progress * 0.55),
      center.y + height,
      center.z + Math.cos(angle) * radius * (1 - progress * 0.55),
    );
    camera.lookAt(center.x, center.y + 24, center.z);
    this.pos.copy(camera.position);
    this.ready = false;
  }
}
