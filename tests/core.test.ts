import { describe, expect, it } from "vitest";
import { computeStats, PerfMeter } from "../packages/engine/src/perf.ts";
import { hashSeed, mulberry32, seededRandom } from "../packages/engine/src/rng.ts";

describe("rng", () => {
  it("is deterministic for the same seed text", () => {
    expect(seededRandom("rainy ocean drive")()).toBe(seededRandom("rainy ocean drive")());
  });

  it("produces values inside the unit range", () => {
    const rand = mulberry32(hashSeed("palm terminal 1986"));
    for (let i = 0; i < 500; i++) {
      const value = rand();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("separates distinct seeds", () => {
    const first = Array.from({ length: 8 }, seededRandom("vice harbor freight"));
    const second = Array.from({ length: 8 }, seededRandom("vice harbor freighu"));
    expect(first).not.toEqual(second);
  });
});

describe("perf", () => {
  it("reports fps and 10% low from frame samples", () => {
    const stats = computeStats([10, 20, 30, 40]);
    expect(stats.avgMs).toBeCloseTo(25);
    expect(stats.fps).toBeCloseTo(40);
    expect(stats.lowMs).toBe(40);
    expect(stats.frames).toBe(4);
  });

  it("clamps pathological frame gaps", () => {
    const meter = new PerfMeter(10);
    meter.sample(0);
    meter.sample(50);
    meter.sample(100);
    expect(meter.current().frames).toBe(0);
    meter.sample(1000);
    expect(meter.current().avgMs).toBeLessThanOrEqual(250);
  });
});
