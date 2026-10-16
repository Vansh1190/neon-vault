export interface Vec2 {
  x: number;
  z: number;
}

export interface Lane {
  readonly id: number;
  readonly from: Vec2;
  readonly to: Vec2;
  readonly dir: Vec2;
  readonly length: number;
  readonly next: number[];
}

export interface RoadGraph {
  readonly lanes: readonly Lane[];
  readonly spacing: number;
  readonly count: number;
  readonly half: number;
}

function laneId(col: number, row: number, axis: number, dir: number, count: number): number {
  return (((col * count + row) * 2 + axis) * 2 + dir) >>> 0;
}

export function buildGridGraph(spacing: number, count: number): RoadGraph {
  const lanes: Lane[] = [];
  const half = ((count - 1) * spacing) / 2;
  const at = (i: number): number => i * spacing - half;

  for (let col = 0; col < count; col++) {
    for (let row = 0; row < count; row++) {
      for (let axis = 0; axis < 2; axis++) {
        for (let dir = 0; dir < 2; dir++) {
          const sign = dir === 0 ? 1 : -1;
          const lateral = (col - (count - 1) / 2) * 1.6;
          const from: Vec2 = axis === 0 ? { x: at(row), z: lateral } : { x: lateral, z: at(row) };
          const to: Vec2 =
            axis === 0
              ? { x: at(row) + sign * spacing, z: lateral }
              : { x: lateral, z: at(row) + sign * spacing };
          const dirv: Vec2 = axis === 0 ? { x: sign, z: 0 } : { x: 0, z: sign };
          const id = laneId(col, row, axis, dir, count);
          const next: number[] = [];
          const along = id ^ 1;
          void along;
          if (row + sign >= 0 && row + sign < count) next.push(laneId(col, row + sign, axis, dir, count));
          for (let a = 0; a < 2; a++) {
            if (a === axis) continue;
            for (let d = 0; d < 2; d++) next.push(laneId(col, row, a, d, count));
          }
          lanes.push({
            id,
            from,
            to,
            dir: dirv,
            length: spacing,
            next,
          });
        }
      }
    }
  }

  return { lanes, spacing, count, half };
}

export function laneAt(graph: RoadGraph, id: number): Lane {
  const lane = graph.lanes[id % graph.lanes.length];
  if (!lane) throw new Error("empty road graph");
  return lane;
}

export function lanePoint(lane: Lane, t: number): Vec2 {
  const k = Math.max(0, Math.min(1, t));
  return {
    x: lane.from.x + (lane.to.x - lane.from.x) * k,
    z: lane.from.z + (lane.to.z - lane.from.z) * k,
  };
}

export function nearestLane(graph: RoadGraph, pos: Vec2, rand: () => number): Lane {
  let best: Lane | undefined;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const lane of graph.lanes) {
    const mid = lanePoint(lane, 0.5);
    const dx = mid.x - pos.x;
    const dz = mid.z - pos.z;
    const dist = dx * dx + dz * dz;
    if (dist < bestDist) {
      bestDist = dist;
      best = lane;
    }
  }
  if (!best) throw new Error("empty road graph");
  if (!rand) return best;
  const alt = graph.lanes[Math.floor(rand() * graph.lanes.length)];
  return alt ?? best;
}
