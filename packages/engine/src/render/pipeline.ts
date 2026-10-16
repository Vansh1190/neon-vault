import * as THREE from "three";

const FULLSCREEN_VERTEX = /* glsl */ `
varying vec2 vScreenUv;
void main() {
  vScreenUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const COPY_FRAGMENT = /* glsl */ `
uniform sampler2D tCopySource;
varying vec2 vScreenUv;
void main() {
  gl_FragColor = vec4(texture2D(tCopySource, vScreenUv).rgb, 1.0);
}
`;

const BRIGHT_FRAGMENT = /* glsl */ `
uniform sampler2D tBrightSource;
uniform float threshold;
varying vec2 vScreenUv;
void main() {
  vec4 color = texture2D(tBrightSource, vScreenUv);
  float lum = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
  float keep = smoothstep(threshold, threshold + 0.6, lum);
  gl_FragColor = vec4(color.rgb * keep, 1.0);
}
`;

const BLUR_FRAGMENT = /* glsl */ `
uniform sampler2D tBlurSource;
uniform vec2 direction;
varying vec2 vScreenUv;
void main() {
  vec4 sum = texture2D(tBlurSource, vScreenUv) * 0.2270270270;
  vec2 off1 = direction * 1.3846153846;
  vec2 off2 = direction * 3.2307692308;
  sum += (texture2D(tBlurSource, vScreenUv + off1) + texture2D(tBlurSource, vScreenUv - off1)) * 0.3162162162;
  sum += (texture2D(tBlurSource, vScreenUv + off2) + texture2D(tBlurSource, vScreenUv - off2)) * 0.0702702703;
  gl_FragColor = sum;
}
`;

const COMPOSITE_FRAGMENT = /* glsl */ `
uniform sampler2D tSceneColor;
uniform sampler2D tGlowColor;
uniform float bloomStrength;
uniform float exposure;
uniform float vignette;
uniform float grain;
uniform float time;
varying vec2 vScreenUv;

vec3 rrtOdtFit(vec3 v) {
  const float a = 2.51;
  const float b = 0.03;
  const float c = 2.43;
  const float d = 0.59;
  const float e = 0.14;
  return clamp((v * (a * v + b)) / (v * (c * v + d) + e), 0.0, 1.0);
}

float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

void main() {
  vec2 uv = vScreenUv;
  vec2 centered = uv - 0.5;
  float ca = 0.0014 + dot(centered, centered) * 0.0045;
  vec3 scene;
  scene.r = texture2D(tSceneColor, uv + centered * ca).r;
  scene.g = texture2D(tSceneColor, uv).g;
  scene.b = texture2D(tSceneColor, uv - centered * ca).b;

  vec3 glow = texture2D(tGlowColor, uv).rgb;
  vec3 color = rrtOdtFit((scene + glow * bloomStrength) * exposure);
  color *= 1.0 - vignette * smoothstep(0.22, 0.98, length(centered) * 1.25);
  color += (hash21(uv * 1024.0 + time) - 0.5) * grain;
  gl_FragColor = vec4(pow(clamp(color, 0.0, 1.0), vec3(1.0 / 2.2)), 1.0);
}
`;

function passMaterial(fragmentShader: string, uniforms: Record<string, THREE.IUniform>): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: FULLSCREEN_VERTEX,
    fragmentShader,
    uniforms,
    depthTest: false,
    depthWrite: false,
    blending: THREE.NoBlending,
  });
}

function makeTarget(width: number, height: number, depth: boolean): THREE.WebGLRenderTarget {
  return new THREE.WebGLRenderTarget(Math.max(1, Math.floor(width)), Math.max(1, Math.floor(height)), {
    type: THREE.HalfFloatType,
    depthBuffer: depth,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
  });
}

export interface PipelineSize {
  width: number;
  height: number;
  ratio: number;
}

export class RenderPipeline {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;

  exposure = 0.95;
  vignette = 0.55;
  grain = 0.012;
  bloomStrength = 0.85;
  bloomThreshold = 1;
  bloomRadius = 0.7;
  bloomEnabled = true;
  bloomIterations = 3;
  size: PipelineSize = { width: 1, height: 1, ratio: 1 };

  private readonly quadScene = new THREE.Scene();
  private readonly quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null as unknown as THREE.Material);
  private readonly copyMaterial = passMaterial(COPY_FRAGMENT, { tCopySource: { value: null } });
  private readonly brightMaterial = passMaterial(BRIGHT_FRAGMENT, {
    tBrightSource: { value: null },
    threshold: { value: 1 },
  });
  private readonly blurMaterial = passMaterial(BLUR_FRAGMENT, {
    tBlurSource: { value: null },
    direction: { value: new THREE.Vector2() },
  });
  private readonly compositeMaterial = passMaterial(COMPOSITE_FRAGMENT, {
    tSceneColor: { value: null },
    tGlowColor: { value: null },
    bloomStrength: { value: 0.8 },
    exposure: { value: 1 },
    vignette: { value: 0.55 },
    grain: { value: 0.012 },
    time: { value: 0 },
  });
  private readonly sceneTarget = makeTarget(1, 1, true);
  private readonly finalTarget = makeTarget(1, 1, false);
  private readonly brightHalf = makeTarget(1, 1, false);
  private readonly blurHalfA = makeTarget(1, 1, false);
  private readonly blurHalfB = makeTarget(1, 1, false);

  constructor(canvas: HTMLCanvasElement, antialias: boolean) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias,
      powerPreference: "high-performance",
      stencil: false,
      alpha: false,
    });
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setPixelRatio(1);

    this.camera = new THREE.PerspectiveCamera(58, 1, 0.25, 4000);
    this.scene.fog = new THREE.FogExp2(0x0d0518, 0.0006);
    this.scene.background = new THREE.Color(0x07040e);

    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);
  }

  setSize(cssWidth: number, cssHeight: number, devicePixelRatio: number, resolutionScale: number): void {
    const ratio = Math.max(0.4, Math.min(devicePixelRatio, 2) * resolutionScale);
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(cssWidth, cssHeight, false);
    const width = Math.max(1, Math.floor(cssWidth * ratio));
    const height = Math.max(1, Math.floor(cssHeight * ratio));
    this.size = { width, height, ratio };
    this.sceneTarget.setSize(width, height);
    this.finalTarget.setSize(width, height);
    const halfWidth = Math.max(1, width >> 1);
    const halfHeight = Math.max(1, height >> 1);
    this.brightHalf.setSize(halfWidth, halfHeight);
    this.blurHalfA.setSize(halfWidth, halfHeight);
    this.blurHalfB.setSize(halfWidth, halfHeight);
    this.camera.aspect = cssWidth / Math.max(1, cssHeight);
    this.camera.updateProjectionMatrix();
  }

  render(elapsed: number): void {
    const composite = this.compositeMaterial;
    composite.uniforms["exposure"]!.value = this.exposure;
    composite.uniforms["vignette"]!.value = this.vignette;
    composite.uniforms["grain"]!.value = this.grain;
    composite.uniforms["time"]!.value = elapsed;
    composite.uniforms["bloomStrength"]!.value = this.bloomEnabled ? this.bloomStrength : 0;

    this.renderer.setRenderTarget(this.sceneTarget);
    this.renderer.render(this.scene, this.camera);

    this.brightMaterial.uniforms["tBrightSource"]!.value = this.sceneTarget.texture;
    this.brightMaterial.uniforms["threshold"]!.value = this.bloomThreshold;
    this.drawQuad(this.brightMaterial, this.brightHalf);

    let glow: THREE.WebGLRenderTarget = this.brightHalf;
    if (this.bloomEnabled) {
      const blur = this.blurMaterial;
      let read = this.brightHalf;
      let write = this.blurHalfA;
      for (let i = 0; i < this.bloomIterations; i++) {
        const scale = this.bloomRadius * (1 + i * 0.9);
        for (const axis of [[1, 0], [0, 1]] as const) {
          blur.uniforms["tBlurSource"]!.value = read.texture;
          (blur.uniforms["direction"]!.value as THREE.Vector2).set(
            (axis[0] * scale) / read.width,
            (axis[1] * scale) / read.height,
          );
          this.drawQuad(blur, write);
          glow = write;
          const swap = write === this.blurHalfA ? this.blurHalfB : this.blurHalfA;
          write = swap;
          read = glow;
        }
      }
    }

    composite.uniforms["tSceneColor"]!.value = this.sceneTarget.texture;
    composite.uniforms["tGlowColor"]!.value = glow.texture;
    this.drawQuad(composite, this.finalTarget);
    this.copyMaterial.uniforms["tCopySource"]!.value = this.finalTarget.texture;
    this.drawQuad(this.copyMaterial, null);
  }

  private drawQuad(material: THREE.Material, target: THREE.WebGLRenderTarget | null): void {
    this.quad.material = material;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.quadScene, this.quadCamera);
  }

  dispose(): void {
    this.sceneTarget.dispose();
    this.finalTarget.dispose();
    this.brightHalf.dispose();
    this.blurHalfA.dispose();
    this.blurHalfB.dispose();
    this.quad.geometry.dispose();
    this.renderer.dispose();
  }
}
