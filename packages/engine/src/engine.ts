import { RenderPipeline } from "./render/pipeline.ts";
import { detectPreset, presetSettings, type EngineOptions, type QualityPreset } from "./config.ts";
import { PerfMeter, formatStats, type FrameStats } from "./perf.ts";

export interface Engine {
  readonly pipeline: RenderPipeline;
  readonly perf: PerfMeter;
  preset: QualityPreset;
  start(): void;
  stop(): void;
  stats(): FrameStats;
  hudText(): string;
  dispose(): void;
}

export function createEngine(options: EngineOptions): Engine {
  const pipeline = new RenderPipeline(options.canvas, options.antialias ?? false);
  const perf = new PerfMeter();
  let preset: QualityPreset = options.preset ?? detectPreset();
  let running = false;
  let frame = 0;
  let elapsed = 0;
  let lastMs = 0;

  const applyPreset = (): void => {
    const settings = presetSettings(preset);
    pipeline.bloomEnabled = settings.bloom.enabled;
    pipeline.bloomStrength = settings.bloom.strength;
    pipeline.bloomThreshold = settings.bloom.threshold;
    pipeline.bloomRadius = settings.bloom.radius;
    pipeline.renderer.shadowMap.enabled = settings.shadows;
    resize();
  };

  const resize = (): void => {
    const settings = presetSettings(preset);
    const canvas = options.canvas;
    const parent = canvas.parentElement;
    const width = parent?.clientWidth ?? window.innerWidth;
    const height = parent?.clientHeight ?? window.innerHeight;
    pipeline.setSize(width, height, Math.min(window.devicePixelRatio || 1, settings.pixelRatioCap), settings.resolutionScale);
  };

  const loop = (nowMs: number): void => {
    if (!running) return;
    frame = requestAnimationFrame(loop);
    perf.sample(nowMs);
    const delta = lastMs === 0 ? 0.016 : Math.min(0.05, (nowMs - lastMs) / 1000);
    lastMs = nowMs;
    elapsed += delta;
    options.onFrame?.(delta, elapsed);
    pipeline.render(elapsed);
  };

  const engine: Engine = {
    pipeline,
    perf,
    get preset() {
      return preset;
    },
    set preset(next: QualityPreset) {
      preset = next;
      applyPreset();
    },
    start() {
      if (running) return;
      running = true;
      lastMs = 0;
      window.addEventListener("resize", resize);
      resize();
      frame = requestAnimationFrame((t) => loop(t));
    },
    stop() {
      running = false;
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    },
    stats() {
      return perf.current();
    },
    hudText() {
      return `${preset.toUpperCase()} · ${formatStats(perf.current())}`;
    },
    dispose() {
      engine.stop();
      pipeline.dispose();
    },
  };

  applyPreset();
  return engine;
}
