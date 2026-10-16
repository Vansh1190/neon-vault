import { createEngine, createGreyboxCity, presetSettings, type Engine, type QualityPreset } from "@nv/engine";
import * as THREE from "three";

const canvas = document.getElementById("viewport") as HTMLCanvasElement;
const statsEl = document.getElementById("stats") as HTMLElement;
const seedEl = document.getElementById("seed") as HTMLElement;
const toastEl = document.getElementById("toast") as HTMLElement;

const SEEDS = [
  "little neon havana",
  "rainy ocean drive",
  "midnight access tile",
  "palm terminal 1986",
  "vice harbor freight",
];

let seed = SEEDS[Math.floor(Math.random() * SEEDS.length)] ?? SEEDS[0]!;

const engine: Engine = createEngine({
  canvas,
  antialias: true,
  onFrame: (_delta, elapsed) => {
    updateCamera(elapsed);
    elapsedNow = elapsed;
    statsEl.textContent = engine.hudText();
  },
});

const city = createGreyboxCity({ seed, blocks: 8 });
engine.pipeline.scene.add(city);
seedEl.textContent = `seed · ${seed}`;

const target = new THREE.Vector3(0, 26, 0);
let yaw = 0.7;
let pitch = 0.2;
let radius = 190;
let dragging = false;
let lastX = 0;
let lastY = 0;
let userYaw = 0;
let userPitch = 0;
let idleTime = 0;
let elapsedNow = 0;

function updateCamera(elapsed: number): void {
  const drift = dragging ? 0 : (elapsed - idleTime) * 0.035;
  const camera = engine.pipeline.camera;
  const currentYaw = userYaw + drift;
  const currentPitch = userPitch + (dragging ? 0 : 0.06 * Math.sin(elapsed * 0.35));
  const cp = Math.cos(pitch + currentPitch);
  camera.position.set(
    target.x + radius * cp * Math.sin(yaw + currentYaw),
    target.y + radius * Math.sin(pitch + currentPitch),
    target.z + radius * cp * Math.cos(yaw + currentYaw),
  );
  camera.lookAt(target);
}

canvas.addEventListener("pointerdown", (event) => {
  dragging = true;
  lastX = event.clientX;
  lastY = event.clientY;
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener("pointermove", (event) => {
  if (!dragging) return;
  userYaw -= (event.clientX - lastX) * 0.004;
  userPitch = Math.max(-0.35, Math.min(0.75, userPitch + (event.clientY - lastY) * 0.003));
  lastX = event.clientX;
  lastY = event.clientY;
});

const endDrag = (): void => {
  if (!dragging) return;
  dragging = false;
  yaw += userYaw;
  pitch += userPitch;
  userYaw = 0;
  userPitch = 0;
  idleTime = elapsedNow;
};

canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);

canvas.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();
    radius = Math.max(35, Math.min(420, radius * (1 + Math.sign(event.deltaY) * 0.09)));
  },
  { passive: false },
);

function rebuild(nextSeed: string): void {
  seed = nextSeed;
  engine.pipeline.scene.remove(city);
  const fresh = createGreyboxCity({ seed, blocks: 8 });
  engine.pipeline.scene.add(fresh);
  seedEl.textContent = `seed · ${seed}`;
}

window.addEventListener("keydown", (event) => {
  const presets: Record<string, QualityPreset> = { Digit1: "low", Digit2: "medium", Digit3: "high" };
  const next = presets[event.code];
  if (next) {
    engine.preset = next;
    toastEl.textContent = `${next.toUpperCase()} · scale ${presetSettings(next).resolutionScale} · bloom ${
      presetSettings(next).bloom.strength
    }`;
    return;
  }
  if (event.code === "KeyR") {
    const fresh = Math.random().toString(36).slice(2, 10);
    rebuild(fresh);
    toastEl.textContent = `regenerated from seed "${fresh}"`;
  }
});

engine.start();

interface DebugWindow extends Window {
  nv: { engine: Engine; pipeline: Engine["pipeline"] };
}

(window as unknown as DebugWindow).nv = { engine, pipeline: engine.pipeline };
