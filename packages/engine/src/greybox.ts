import * as THREE from "three";
import { pickOf, rangeOf, seededRandom } from "./rng.ts";

export interface GreyboxOptions {
  seed: string;
  blocks?: number;
  blockSize?: number;
  street?: number;
  neonCount?: number;
}

const NEON = [0xff2e88, 0x00e5ff, 0xffd166, 0x7c5cff, 0x2effa5];
const SKY_TOP = 0x1b0f3a;
const SKY_BOTTOM = 0xff4f7f;

export function createGreyboxCity(options: GreyboxOptions): THREE.Group {
  const rand = seededRandom(options.seed);
  const blocks = options.blocks ?? 7;
  const blockSize = options.blockSize ?? 34;
  const street = options.street ?? 16;
  const pitch = blockSize + street;
  const extent = blocks * pitch;

  const city = new THREE.Group();
  city.name = "greybox-city";

  const asphalt = new THREE.MeshStandardMaterial({
    color: 0x0b0b12,
    roughness: 0.28,
    metalness: 0.35,
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(extent * 2.4, extent * 2.4), asphalt);
  ground.rotation.x = -Math.PI / 2;
  city.add(ground);

  const shell = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x554a6e, roughness: 0.42, metalness: 0.45 }),
    blocks * blocks,
  );
  const matrix = new THREE.Matrix4();
  const tint = new THREE.Color();
  let index = 0;
  for (let x = 0; x < blocks; x++) {
    for (let z = 0; z < blocks; z++) {
      const height = rangeOf(rand, 10, 92);
      const width = blockSize * rangeOf(rand, 0.62, 0.95);
      const depth = blockSize * rangeOf(rand, 0.62, 0.95);
      matrix.compose(
        new THREE.Vector3((x - blocks / 2) * pitch, height / 2, (z - blocks / 2) * pitch),
        new THREE.Quaternion(),
        new THREE.Vector3(width, height, depth),
      );
      shell.setMatrixAt(index, matrix);
      tint.setHSL(rangeOf(rand, 0.68, 0.92), 0.22, rangeOf(rand, 0.1, 0.2));
      shell.setColorAt(index, tint);
      index++;
    }
  }
  shell.instanceMatrix.needsUpdate = true;
  if (shell.instanceColor) shell.instanceColor.needsUpdate = true;
  city.add(shell);

  const neonGeometry = new THREE.PlaneGeometry(1, 1);
  const neonCount = options.neonCount ?? blocks * blocks * 3;
  for (const color of NEON) {
    const material = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, toneMapped: false });
    material.color.multiplyScalar(14);
    const mesh = new THREE.InstancedMesh(neonGeometry, material, Math.ceil(neonCount / NEON.length));
    let n = 0;
    for (let i = 0; i < blocks; i++) {
      for (let z = 0; z < blocks; z++) {
        if (rand() > 0.55) continue;
        const height = rangeOf(rand, 4, 40);
        const face = Math.floor(rand() * 4) % 4;
        const position = new THREE.Vector3((i - blocks / 2) * pitch, height, (z - blocks / 2) * pitch);
        const rotation = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(0, (face * Math.PI) / 2, 0),
        );
        position.add(new THREE.Vector3(0, 0, blockSize / 2 + 0.2).applyQuaternion(rotation));
        matrix.compose(position, rotation, new THREE.Vector3(rangeOf(rand, 2, 8), rangeOf(rand, 0.35, 1.6), 1));
        mesh.setMatrixAt(n++, matrix);
        if (n >= mesh.count) break;
      }
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    city.add(mesh);
  }

  const marking = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ color: 0x0f8fa8, side: THREE.DoubleSide, toneMapped: false, transparent: true, opacity: 0.85 }),
    blocks * 2,
  );
  (marking.material as THREE.MeshBasicMaterial).color.multiplyScalar(2.4);
  let mi = 0;
  for (let i = 0; i <= blocks; i++) {
    const offset = (i - blocks / 2) * pitch - pitch / 2;
    for (const axis of [0, 1] as const) {
      if (i % 2 === 0) continue;
      const rotation = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(-Math.PI / 2, 0, axis === 0 ? 0 : Math.PI / 2),
      );
      const position = new THREE.Vector3(axis === 0 ? offset : 0, 0.06, axis === 0 ? 0 : offset);
      matrix.compose(position, rotation, new THREE.Vector3(0.5, extent * 1.6, 1));
      marking.setMatrixAt(mi++, matrix);
      if (mi >= marking.count) break;
    }
  }
  marking.count = mi;
  marking.instanceMatrix.needsUpdate = true;
  city.add(marking);

  for (let i = 0; i < 6; i++) {
    const light = new THREE.PointLight(pickOf(rand, NEON), 900, 210, 2);
    light.position.set(rangeOf(rand, -extent / 3, extent / 3), rangeOf(rand, 12, 40), rangeOf(rand, -extent / 3, extent / 3));
    city.add(light);
  }

  const gradient = new THREE.Mesh(
    new THREE.SphereGeometry(2400, 24, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new THREE.Color(SKY_TOP) },
        bottom: { value: new THREE.Color(SKY_BOTTOM) },
        horizon: { value: new THREE.Color(0x2a0f3d) },
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorld;
        void main() {
          vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 top;
        uniform vec3 bottom;
        uniform vec3 horizon;
        varying vec3 vWorld;
        void main() {
          float h = clamp(normalize(vWorld).y, -1.0, 1.0);
          vec3 low = mix(horizon, bottom, smoothstep(0.0, -0.35, h));
          vec3 col = mix(low, top, smoothstep(0.02, 0.65, h));
          gl_FragColor = vec4(col * 1.6, 1.0);
        }
      `,
    }),
  );
  gradient.name = "sky";
  city.add(gradient);

  const hemi = new THREE.HemisphereLight(0x5a2c86, 0x07040f, 2.2);
  city.add(hemi);
  const key = new THREE.DirectionalLight(0xff5fa2, 2.6);
  key.position.set(-120, 90, 70);
  city.add(key);
  const rim = new THREE.DirectionalLight(0x2ad8ff, 2.1);
  rim.position.set(140, 60, -110);
  city.add(rim);

  return city;
}
