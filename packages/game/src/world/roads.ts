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
  readonly lateral: number;
}

const OFFSET = 2.1;

export function buildGridGraph(spacing: number, count: number): RoadGraph {
  const lanes: Lane[] = [];
  const segs = Math.max(1, count - 1);
  const half = ((count - 1) * spacing) / 2;
  const at = (i: number): number => i * spacing - half;
  const idOf = (seg: number, axis: number, dir: number): number => (seg * 2 + axis) * 2 + dir;

  for (let seg = 0; seg < segs; seg++) {
    for (let axis = 0; axis < 2; axis++) {
      for (let dir = 0; dir < 2; dir++) {
        const sign = dir === 0 ? 1 : -1;
        const shift = axis === 0 ? { x: 0, z: OFFSET * sign } : { x: OFFSET * sign, z: 0 };
        const from: Vec2 =
          axis === 0
            ? { x: at(seg + 1) + shift.x, z: at(seg) + shift.z }
            : { x: at(seg) + shift.x, z: at(seg + 1) + shift.z };
        const to: Vec2 =
          axis === 0
            ? { x: at(seg + 1) + shift.x, z: at(seg + 1) + shift.z }
            : { x: at(seg) + shift.x, z: at(seg) + shift.z };
        const nextSeg = (seg + 1) % segs;
        const next = [idOf(nextSeg, axis, dir)];
        next.push(idOf(nextSeg, 1 - axis, 0));
        next.push(idOf(nextSeg, 1 - axis, 1));
        lanes.push({
          id: idOf(seg, axis, dir),
          from,
          to,
          dir: axis === 0 ? { x: 0, z: sign } : { x: sign, z: 0 },
          length: Math.hypot(to.x - from.x, to.z - from.z),
          next,
        });
      }
    }
  }

  return { lanes, spacing, count, half, lateral: OFFSET };
}

export function lanePoint(lane: Lane, t: number): Vec2 {
  const k = kClamp(t);
  return {
    x: lane.from.x + (lane.to.x - lane.from.x) * k,
    z: lane.from.z + (lane.to.z - lane.from.z) * k,
  };
}

function kClamp(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

export function nearestLane(graph: RoadGraph, pos: Vec2): Lane {
  let best: Lane | undefined;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const lane of graph.lanes) {
    const axisX = Math.abs(lane.dir.x) > 0.5;
    const along = axisX ? pos.z : pos.x;
    const across = axisX ? pos.x : pos.z;
    const laneAt = axisX ? lane.from.z : lane.from.x;
    const acrossRef = axisX ? lane.from.x : lane.from.z;
    const dAlong = Math.abs(along - laneAt) * 0.35;
    const dAcross = Math.abs(across - acrossRef);
    const dist = dAcross * 2 + dAlong;
    if (dist < bestDist) {
      bestDist = dist;
      best = lane;
    }
  }
  if (!best) throw new Error("road graph has no lanes");
  return best;
}

export function laneProgress(graph: RoadGraph, lane: Lane, pos: Vec2): number {
  const along =
    Math.abs(lane.dir.x) > 0.5 ? pos.z - lane.from.z : pos.x - lane.from.x;
  return kClamp(along / Math.max(1, graph.spacing * (graph.count - 1)));
}
