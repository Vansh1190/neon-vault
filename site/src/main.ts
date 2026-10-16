import * as THREE from "three";
import { createEngine, detectPreset, type Engine, type QualityPreset } from "@nv/engine";
import {
  CAR_TUNING,
  ChaseCamera,
  POLICE_TUNING,
  chasePlayer,
  resolveBoxes,
  createCity,
  createInput,
  nearestSpawnableLane,
  spawnAgent,
  speedKmh,
  stepAgent,
  stepVehicle,
  type Agent,
  type City,
  type VehicleState,
} from "@nv/game";

const canvas = document.getElementById("viewport") as HTMLCanvasElement;
const statsEl = document.getElementById("stats") as HTMLElement;
const seedEl = document.getElementById("seed") as HTMLElement;
const toastEl = document.getElementById("toast") as HTMLElement;
const speedEl = document.getElementById("speed") as HTMLElement;
const districtEl = document.getElementById("district") as HTMLElement;

const SEEDS = [
  "little neon havana",
  "rainy ocean drive",
  "midnight access tile",
  "palm terminal 1986",
  "vice harbor freight",
];

function readSeed(): string {
  const hash = decodeURIComponent(window.location.hash.replace(/^#/, ""));
  const match = /s=(.+)/.exec(hash);
  return match?.[1] ?? SEEDS[Math.floor(Math.random() * SEEDS.length)] ?? SEEDS[0]!;
}

function writeSeed(seed: string): void {
  window.history.replaceState(null, "", `#s=${encodeURIComponent(seed)}`);
}

let seed = readSeed();
let city: City = createCity({ seed, blocks: 9 });

const engine: Engine = createEngine({
  canvas,
  antialias: true,
  preset: detectPreset(),
  onFrame: (dt, elapsed) => frame(dt, elapsed),
});

engine.pipeline.scene.add(city.group);
seedEl.textContent = `seed ${seed}`;
writeSeed(seed);

const playerBody = new THREE.Group();
const paint = new THREE.MeshStandardMaterial({ color: 0x27d3ff, roughness: 0.28, metalness: 0.75 });
const glass = new THREE.MeshStandardMaterial({ color: 0x0a0714, roughness: 0.12, metalness: 0.9 });
const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.85, 4.6), paint);
body.position.y = 0.75;
const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 2.2), glass);
cabin.position.set(0, 1.42, -0.15);
const under = new THREE.Mesh(
  new THREE.PlaneGeometry(2.6, 5.4),
  new THREE.MeshBasicMaterial({ color: 0xff2e88, transparent: true, opacity: 0.65, toneMapped: false }),
);
under.rotation.x = -Math.PI / 2;
under.position.y = 0.06;
playerBody.add(body, cabin, under);
engine.pipeline.scene.add(playerBody);

const player: VehicleState = {
  pos: { x: 0, z: -30 },
  heading: 0,
  speed: 0,
  throttle: 0,
  brake: 0,
  steer: 0,
  yawRate: 0,
};

const input = createInput(canvas);
input.attach();
const camera = new ChaseCamera({ distance: 15, height: 6.4, lookHeight: 2.2, damping: 6.5 });

const agents: Agent[] = [];
const agentMeshes: THREE.Group[] = [];
const AGENT_COUNT = 14;
const CAR_COLORS = [0xff2e88, 0xffd166, 0x7c5cff, 0x2effa5, 0xff7a3d, 0x9ff7ff];

function rand(): number {
  return Math.random();
}

function makeAgentMesh(kind: Agent["kind"], index: number): THREE.Group {
  const group = new THREE.Group();
  const color = kind === "police" ? 0xf2f6ff : CAR_COLORS[index % CAR_COLORS.length]!;
  const shell = new THREE.Mesh(
    new THREE.BoxGeometry(2, 0.8, 4.3),
    new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.6 }),
  );
  shell.position.y = 0.72;
  const top = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.62, 2),
    new THREE.MeshStandardMaterial({ color: 0x090612, roughness: 0.15, metalness: 0.85 }),
  );
  top.position.set(0, 1.34, -0.1);
  group.add(shell, top);
  if (kind === "police") {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.22, 0.5),
      new THREE.MeshBasicMaterial({ color: 0x2a7bff, toneMapped: false }),
    );
    (bar.material as THREE.MeshBasicMaterial).color.multiplyScalar(6);
    bar.position.set(0, 1.75, -0.1);
    group.add(bar);
  }
  const lamps = new THREE.Mesh(
    new THREE.PlaneGeometry(1.6, 0.22),
    new THREE.MeshBasicMaterial({ color: 0xfff2c2, toneMapped: false }),
  );
  (lamps.material as THREE.MeshBasicMaterial).color.multiplyScalar(4);
  lamps.position.set(0, 0.7, 2.2);
  group.add(lamps);
  return group;
}

for (let i = 0; i < AGENT_COUNT; i++) {
  const agent = spawnAgent(city.graph, rand, i < AGENT_COUNT - 3 ? "civilian" : "police");
  agents.push(agent);
  const mesh = makeAgentMesh(agent.kind, i);
  agentMeshes.push(mesh);
  engine.pipeline.scene.add(mesh);
}

let introStart = 0;
let wanted = 0;

const center = new THREE.Vector3(0, 0, 0);

function frame(dt: number, elapsed: number): void {
  const keys = input.keys;
  const intro = elapsed - introStart < 3.6;

  if (!intro) {
    const throttle = (keys.up ? 1 : 0) + (keys.down ? -1 : 0);
    const steer = (keys.left ? 1 : 0) + (keys.right ? -1 : 0);
    player.throttle = throttle;
    player.brake = keys.brake ? 1 : 0;
    stepVehicle(player, CAR_TUNING, steer, throttle, player.brake, dt);
    const hits = resolveBoxes(player.pos, city.buildings, 1.3);
    if (hits > 0) {
      player.speed *= 0.35;
      player.yawRate *= 0.2;
      if (Math.abs(player.speed) > 8) {
        wanted = Math.min(1, wanted + 0.25);
        toastEl.textContent = "impact · attention drawn";
      }
    }

    for (const agent of agents) {
      const dx = agent.pos.x - player.pos.x;
      const dz = agent.pos.z - player.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 6.5) {
        agent.desired = Math.max(4, agent.desired - 40 * dt);
        if (agent.kind === "civilian" && Math.abs(player.speed) > 14) wanted = Math.min(1, wanted + dt * 0.35);
      } else {
        agent.desired += (14 - agent.desired) * dt * 0.25;
      }
    }
  }

  for (let i = 0; i < agents.length; i++) {
    const agent = agents[i]!;
    const mesh = agentMeshes[i]!;
    if (!intro) {
      if (agent.kind === "police" && wanted > 0.2) {
        chasePlayer(agent, player.pos, dt, POLICE_TUNING.maxSpeed * 0.8);
      } else {
        stepAgent(city.graph, agent, agents, dt, 1);
      }
    }
    mesh.position.set(agent.pos.x, 0, agent.pos.z);
    mesh.rotation.y = agent.heading;
  }

  wanted = Math.max(0, wanted - dt * 0.04);
  playerBody.position.set(player.pos.x, 0, player.pos.z);
  playerBody.rotation.y = player.heading;

  const cam = engine.pipeline.camera;
  if (intro) {
    camera.flythrough(cam, center, city.extent * 0.85, elapsed / 3.6);
  } else {
    camera.follow(cam, player.pos.x, player.pos.z, player.heading, dt);
  }

  if (input.pressed.has("KeyR")) {
    const fresh = Math.random().toString(36).slice(2, 12);
    rebuild(fresh);
  }
  if (input.pressed.has("KeyC")) {
    introStart = elapsed;
    toastEl.textContent = "replaying establishing shot";
  }
  const PRESETS: Record<string, QualityPreset> = { Digit1: "low", Digit2: "medium", Digit3: "high" };
  const preset = PRESETS[[...input.pressed].find((code) => code.startsWith("Digit")) ?? ""];
  if (preset) engine.preset = preset;

  input.endFrame();

  speedEl.textContent = `${speedKmh(player.speed).toFixed(0)}`;
  statsEl.textContent = engine.hudText();
  districtEl.textContent = `${wanted > 0.2 ? "pursuit" : "free roam"} · ${city.districts.length} districts`;
}

function rebuild(nextSeed: string): void {
  seed = nextSeed;
  engine.pipeline.scene.remove(city.group);
  city.dispose();
  city = createCity({ seed, blocks: 9 });
  engine.pipeline.scene.add(city.group);
  seedEl.textContent = `seed ${seed}`;
  writeSeed(seed);
  toastEl.textContent = `city rebuilt from "${seed}"`;
  for (let i = 0; i < agents.length; i++) {
    const lane = nearestSpawnableLane(city.graph, agents[i]!.pos);
    agents[i]!.lane = lane;
    agents[i]!.t = Math.random();
  }
}

engine.start();
