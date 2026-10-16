export type QualityPreset = "low" | "medium" | "high";

export interface EngineOptions {
  canvas: HTMLCanvasElement;
  preset?: QualityPreset;
  antialias?: boolean;
  onFrame?: (deltaSeconds: number, elapsedSeconds: number) => void;
}

export interface BloomSettings {
  enabled: boolean;
  strength: number;
  threshold: number;
  radius: number;
}

export interface PresetSettings {
  pixelRatioCap: number;
  resolutionScale: number;
  bloom: BloomSettings;
  shadows: boolean;
  anisotropy: number;
}

const PRESETS: Record<QualityPreset, PresetSettings> = {
  low: {
    pixelRatioCap: 1,
    resolutionScale: 0.75,
    bloom: { enabled: true, strength: 0.62, threshold: 0.85, radius: 0.55 },
    shadows: false,
    anisotropy: 2,
  },
  medium: {
    pixelRatioCap: 1.5,
    resolutionScale: 1,
    bloom: { enabled: true, strength: 0.72, threshold: 0.8, radius: 0.65 },
    shadows: false,
    anisotropy: 8,
  },
  high: {
    pixelRatioCap: 2,
    resolutionScale: 1,
    bloom: { enabled: true, strength: 0.8, threshold: 0.75, radius: 0.75 },
    shadows: true,
    anisotropy: 16,
  },
};

export function presetSettings(preset: QualityPreset): PresetSettings {
  return PRESETS[preset];
}

export function detectPreset(): QualityPreset {
  if (typeof navigator === "undefined") return "high";
  const cores = navigator.hardwareConcurrency ?? 4;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  if (mobile || cores <= 4 || memory <= 4) return "low";
  if (cores <= 8 && memory <= 8) return "medium";
  return "high";
}
