export interface FrameStats {
  fps: number;
  frameMs: number;
  avgMs: number;
  lowMs: number;
  frames: number;
}

export class PerfMeter {
  private readonly windowSize: number;
  private readonly samples: number[] = [];
  private lastTime = 0;
  private lastReport = 0;
  private stats: FrameStats = { fps: 0, frameMs: 0, avgMs: 0, lowMs: 0, frames: 0 };

  constructor(windowSize = 90) {
    this.windowSize = Math.max(2, windowSize);
  }

  sample(nowMs: number): void {
    if (this.lastTime === 0) {
      this.lastTime = nowMs;
      this.lastReport = nowMs;
      return;
    }
    const delta = Math.min(nowMs - this.lastTime, 250);
    this.lastTime = nowMs;
    this.samples.push(delta);
    if (this.samples.length > this.windowSize) this.samples.shift();
    if (nowMs - this.lastReport < 250) return;
    this.lastReport = nowMs;
    this.stats = computeStats(this.samples);
  }

  current(): FrameStats {
    return this.stats;
  }
}

export function computeStats(samples: readonly number[]): FrameStats {
  if (samples.length === 0) return { fps: 0, frameMs: 0, avgMs: 0, lowMs: 0, frames: 0 };
  const sorted = [...samples].sort((a, b) => a - b);
  const total = samples.reduce((sum, value) => sum + value, 0);
  const avgMs = total / samples.length;
  const lowIndex = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9));
  const lowMs = sorted[lowIndex] ?? avgMs;
  return {
    fps: avgMs > 0 ? 1000 / avgMs : 0,
    frameMs: sorted[0] ?? avgMs,
    avgMs,
    lowMs,
    frames: samples.length,
  };
}

export function formatStats(stats: FrameStats): string {
  return `${stats.fps.toFixed(0)} fps · ${stats.avgMs.toFixed(1)} ms · 10%low ${stats.lowMs.toFixed(1)} ms`;
}
