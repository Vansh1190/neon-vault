import * as THREE from "three";
import { pickOf, rangeOf, seededRandom } from "@nv/engine";
import { buildGridGraph, type RoadGraph } from "./roads.ts";

export interface WorldOptions {
  seed: string;
  blocks?: number;
  spacing?: number;
}

export interface District {
  name: string;
  center: number;
  radius: number;
  minH: number;
  maxH: number;
  palette: number[];
}

export interface Building {
  readonly x: number;
  readonly z: number;
  readonly hx: number;
  readonly hz: number;
  readonly height: number;
}

export interface City {
  group: THREE.Group;
  buildings: Building[];
  graph: RoadGraph;
  seed: string;
  districts: District[];
  extent: number;
  dispose: () => void;
}

const NEON = [0xff2e88, 0x00e5ff, 0xffd166, 0x7c5cff, 0x2effa5];

const DISTRICT_NAMES = ["beach", "downtown", "harbor", "strip", "oldtown"];

export function createCity(options: WorldOptions): City {
  const rand = seededRandom(options.seed);
  const blocks = options.blocks ?? 9;
  const spacing = options.spacing ?? 54;
  const extent = (blocks - 1) * spacing;
  const half = extent / 2;
  const group = new THREE.Group();
  group.name = "city";
  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  const districts: District[] = [];
  for (let i = 0; i < 3; i++) {
    districts.push({
      name: DISTRICT_NAMES[Math.floor(rand() * DISTRICT_NAMES.length) % DISTRICT_NAMES.length] ?? "strip",
      center: rangeOf(rand, -half * 0.6, half * 0.6),
      radius: rangeOf(rand, extent * 0.28, extent * 0.55),
      minH: rangeOf(rand, 8, 30),
      maxH: rangeOf(rand, 40, 105),
      palette: [pickOf(rand, NEON), pickOf(rand, NEON)],
    });
  }

  const asphalt = track(
    new THREE.MeshStandardMaterial({ color: 0x0a0a12, roughness: 0.34, metalness: 0.4 }),
  );
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(extent * 3, extent * 3), asphalt);
  ground.rotation.x = -Math.PI / 2;
  group.add(ground);

  const shellGeo = track(new THREE.BoxGeometry(1, 1, 1));
  const windows = track(makeWindowTexture());
  const shellMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x4b4066,
      roughness: 0.5,
      metalness: 0.35,
      emissive: 0xffc46b,
      emissiveIntensity: 0.85,
      emissiveMap: windows,
    }),
  );
  const shell = new THREE.InstancedMesh(shellGeo, shellMat, blocks * blocks);
  const matrix = new THREE.Matrix4();
  const tint = new THREE.Color();
  const buildings: Building[] = [];
  let placed = 0;
  for (let i = 0; i < blocks; i++) {
    for (let j = 0; j < blocks; j++) {
      const x = (i + 0.5) * spacing - half;
      const z = (j + 0.5) * spacing - half;
      const height = heightAt(districts, x, z, rand);
      const width = spacing * rangeOf(rand, 0.38, 0.56);
      const depth = spacing * rangeOf(rand, 0.38, 0.56);
      buildings.push({ x, z, hx: width / 2, hz: depth / 2, height });
      matrix.compose(
        new THREE.Vector3(x, height / 2, z),
        new THREE.Quaternion(),
        new THREE.Vector3(width, height, depth),
      );
      shell.setMatrixAt(placed, matrix);
      tint.setHSL(rangeOf(rand, 0.66, 0.95), 0.26, rangeOf(rand, 0.12, 0.26));
      shell.setColorAt(placed, tint);
      placed++;
    }
  }
  shell.count = placed;
  shell.instanceMatrix.needsUpdate = true;
  if (shell.instanceColor) shell.instanceColor.needsUpdate = true;
  group.add(shell);

  const signGeo = track(new THREE.PlaneGeometry(1, 1));
  for (const color of NEON) {
    const mat = track(
      new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, toneMapped: false }),
    );
    mat.color.multiplyScalar(13);
    const mesh = new THREE.InstancedMesh(signGeo, mat, blocks * 4);
    let n = 0;
    for (let i = 0; i < blocks && n < mesh.count; i++) {
      for (let j = 0; j < blocks && n < mesh.count; j++) {
        if (rand() > 0.35) continue;
        const b = buildings[(i * blocks + j) % buildings.length];
        if (!b) continue;
        const x = b.x;
        const z = b.z;
        const face = Math.floor(rand() * 4) % 4;
        const rot = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, (face * Math.PI) / 2, 0));
        const pos = new THREE.Vector3(x, rangeOf(rand, 3, 42), z);
        pos.add(new THREE.Vector3(0, 0, b.hz + 0.25).applyQuaternion(rot));
        matrix.compose(
          pos,
          rot,
          new THREE.Vector3(rangeOf(rand, 1.6, 6.5), rangeOf(rand, 0.3, 1.4), 1),
        );
        mesh.setMatrixAt(n++, matrix);
      }
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    group.add(mesh);
  }

  const paintRoad = (
    offset: number,
    axis: number,
  ): void => {
    const geo = track(new THREE.PlaneGeometry(1, 1));
    const mat = track(
      new THREE.MeshBasicMaterial({
        color: 0x0f8fa8,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    );
    mat.color.multiplyScalar(2.6);
    const a = new THREE.Mesh(geo, mat);
    const b = new THREE.Mesh(geo, mat);
    for (const [mesh, shift] of [
      [a, -2.1],
      [b, 2.1],
    ] as const) {
      mesh.rotation.x = -Math.PI / 2;
      mesh.rotation.z = axis === 0 ? 0 : Math.PI / 2;
      mesh.position.set(
        axis === 0 ? offset + shift : 0,
        0.05,
        axis === 0 ? 0 : offset + shift,
      );
      mesh.scale.set(0.42, extent * 1.9, 1);
      group.add(mesh);
    }
  };
  for (let i = 0; i < blocks; i++) paintRoad(i * spacing - half, 0);
  for (let i = 0; i < blocks; i++) paintRoad(i * spacing - half, 1);

  const sky = createSky(track);
  group.add(sky);
  group.add(new THREE.HemisphereLight(0x5a2c86, 0x07040f, 2.1));
  const key = new THREE.DirectionalLight(0xff5fa2, 2.4);
  key.position.set(-140, 110, 90);
  group.add(key);
  const rim = new THREE.DirectionalLight(0x2ad8ff, 2);
  rim.position.set(160, 70, -130);
  group.add(rim);

  for (let i = 0; i < 5; i++) {
    const light = new THREE.PointLight(pickOf(rand, NEON), 2200, 300, 2);
    light.position.set(
      rangeOf(rand, -half, half),
      rangeOf(rand, 10, 40),
      rangeOf(rand, -half, half),
    );
    group.add(light);
  }

  return {
    group,
    buildings,
    graph: buildGridGraph(spacing, blocks),
    seed: options.seed,
    districts,
    extent,
    dispose: () => {
      buildings.length = 0;
      for (const item of disposables) item.dispose();
    },
  };
}

function heightAt(districts: District[], x: number, z: number, rand: () => number): number {
  let best: District | undefined;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const d of districts) {
    const dist = Math.abs(d.center - x) + Math.abs(d.center - z);
    if (dist < bestScore) {
      bestScore = dist;
      best = d;
    }
  }
  if (!best) return rangeOf(rand, 10, 60);
  const falloff = Math.max(0, 1 - bestScore / Math.max(1, best.radius));
  return rangeOf(rand, best.minH, best.minH + (best.maxH - best.minH) * falloff);
}

function createSky(track: <T extends { dispose: () => void }>(item: T) => T): THREE.Mesh {
  const geo = track(new THREE.SphereGeometry(2600, 24, 16));
  const mat = track(
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new THREE.Color(0x160c33) },
        mid: { value: new THREE.Color(0x2c0f42) },
        low: { value: new THREE.Color(0xff4f7f) },
      },
      vertexShader: `
        varying vec3 vWorld;
        void main() {
          vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 top;
        uniform vec3 mid;
        uniform vec3 low;
        varying vec3 vWorld;
        void main() {
          float h = clamp(normalize(vWorld).y, -1.0, 1.0);
          vec3 col = mix(low, mid, smoothstep(-0.02, 0.16, h));
          col = mix(col, top, smoothstep(0.12, 0.7, h));
          gl_FragColor = vec4(col * 1.7, 1.0);
        }
      `,
    }),
  );
  const sky = new THREE.Mesh(geo, mat);
  sky.name = "sky";
  return sky;
}

function makeWindowTexture(size = 256): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const u = x / size;
      const v = y / size;
      const col = Math.floor(u * 12);
      const row = Math.floor(v * 18);
      const cell = (col * 7 + row * 13 + ((col * col + row) % 5) * 3) % 23;
      const lit = cell < 7 ? 1 : 0;
      const edge = u % (1 / 12) < 0.16 || u % (1 / 12) > 0.84 || v % (1 / 18) < 0.22 || v % (1 / 18) > 0.78;
      const value = edge ? 4 : lit ? 232 : 12;
      const warm = lit ? 255 : 150;
      data[i] = value;
      data[i + 1] = Math.round(value * (lit ? 0.82 : 0.9));
      data[i + 2] = Math.round(value * (lit ? 0.55 : 1));
      data[i + 3] = warm;
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 6);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}
