export function hashSeed(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i) ?? 0;
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededRandom(seedText: string): () => number {
  return mulberry32(hashSeed(seedText));
}

export function rangeOf(rand: () => number, min: number, max: number): number {
  return min + rand() * (max - min);
}

export function pickOf<T>(rand: () => number, items: readonly T[]): T {
  const item = items[Math.floor(rand() * items.length) % items.length] as T;
  return item;
}
