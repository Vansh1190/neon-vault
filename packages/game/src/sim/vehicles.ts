import type { Lane, Vec2 } from "../world/roads.ts";
import { lanePoint, laneProgress, nearestLane } from "../world/roads.ts";
import type { RoadGraph } from "../world/roads.ts";

export interface VehicleState {
  pos: Vec2;
  heading: number;
  speed: number;
  throttle: number;
  brake: number;
  steer: number;
  yawRate: number;
}

export interface VehicleTuning {
  maxSpeed: number;
  accel: number;
  reverseMax: number;
  brakeForce: number;
  drag: number;
  aero: number;
  grip: number;
  steerMax: number;
  steerSpeed: number;
  wheelbase: number;
  driftFactor: number;
}

export const CAR_TUNING: VehicleTuning = {
  maxSpeed: 38,
  accel: 15,
  reverseMax: 11,
  brakeForce: 34,
  drag: 0.35,
  aero: 0.0022,
  grip: 7.2,
  steerMax: 0.62,
  steerSpeed: 3.4,
  wheelbase: 3.1,
  driftFactor: 0.86,
};

export const POLICE_TUNING: VehicleTuning = {
  ...CAR_TUNING,
  maxSpeed: 44,
  accel: 18,
  grip: 8.4,
};

export function forwardOf(heading: number): Vec2 {
  return { x: Math.sin(heading), z: Math.cos(heading) };
}

export function stepVehicle(
  state: VehicleState,
  tuning: VehicleTuning,
  steerTarget: number,
  throttle: number,
  brake: number,
  dt: number,
): void {
  const steerGoal = Math.max(-1, Math.min(1, steerTarget));
  const steerDelta = steerGoal - state.steer;
  const rate = tuning.steerSpeed * (1 - Math.min(0.6, Math.abs(state.speed) / tuning.maxSpeed) * 0.6);
  state.steer += Math.max(-rate * dt, Math.min(rate * dt, steerDelta));
  let steerAngle = state.steer * tuning.steerMax;
  if (Math.abs(steerAngle) < 1e-3) steerAngle = 0;

  const fwd = forwardOf(state.heading);
  const forwardSpeed = state.speed;

  if (throttle > 0) state.speed += tuning.accel * throttle * dt;
  else if (throttle < 0) state.speed += tuning.accel * throttle * 0.7 * dt;

  if (brake > 0) {
    const drop = tuning.brakeForce * brake * dt;
    state.speed = Math.abs(state.speed) <= drop ? 0 : state.speed - Math.sign(state.speed) * drop;
  }

  state.speed -= (state.speed * tuning.drag + state.speed * Math.abs(state.speed) * tuning.aero) * dt;
  state.speed = Math.max(-tuning.reverseMax, Math.min(tuning.maxSpeed, state.speed));

  const tanSteer = Math.tan(steerAngle);
  const turnRadius = tuning.wheelbase / Math.max(1e-4, Math.abs(tanSteer));
  const maxYaw = Math.abs(tanSteer) < 1e-3 ? 0 : Math.abs(forwardSpeed) / Math.max(3.5, turnRadius);
  const desiredYaw = Math.sign(state.speed) * maxYaw;
  const yawRate = desiredYaw * Math.min(1, Math.abs(state.speed) / 6);
  state.yawRate += (yawRate - state.yawRate) * Math.min(1, tuning.grip * dt);
  state.heading += state.yawRate * dt;

  state.pos.x += fwd.x * state.speed * dt;
  state.pos.z += fwd.z * state.speed * dt;
}

export interface Box2D {
  readonly x: number;
  readonly z: number;
  readonly hx: number;
  readonly hz: number;
}

export function resolveBoxes(pos: Vec2, boxes: readonly Box2D[], radius: number): number {
  let hits = 0;
  for (const box of boxes) {
    const minx = box.x - box.hx - radius;
    const maxx = box.x + box.hx + radius;
    const minz = box.z - box.hz - radius;
    const maxz = box.z + box.hz + radius;
    if (pos.x <= minx || pos.x >= maxx || pos.z <= minz || pos.z >= maxz) continue;
    const dxLeft = pos.x - minx;
    const dxRight = maxx - pos.x;
    const dzTop = pos.z - minz;
    const dzBottom = maxz - pos.z;
    const smallest = Math.min(dxLeft, dxRight, dzTop, dzBottom);
    if (smallest === dxLeft) pos.x = minx;
    else if (smallest === dxRight) pos.x = maxx;
    else if (smallest === dzTop) pos.z = minz;
    else pos.z = maxz;
    hits++;
  }
  return hits;
}

export function speedKmh(speed: number): number {
  return Math.abs(speed) * 3.6;
}

export interface Agent {
  lane: Lane;
  t: number;
  speed: number;
  desired: number;
  pos: Vec2;
  heading: number;
  kind: "civilian" | "police";
}

export function spawnAgent(graph: RoadGraph, rand: () => number, kind: Agent["kind"]): Agent {
  const lanes = graph.lanes;
  const lane = lanes[Math.floor(rand() * lanes.length)] ?? lanes[0];
  if (!lane) throw new Error("road graph empty");
  const t = rand();
  const pos = lanePoint(lane, t);
  return {
    lane,
    t,
    speed: 0,
    desired: kind === "police" ? 30 : 12 + rand() * 9,
    pos,
    heading: Math.atan2(lane.dir.x, lane.dir.z),
    kind,
  };
}

export function nearestSpawnableLane(graph: RoadGraph, pos: Vec2): Lane {
  return nearestLane(graph, pos);
}

export function progressOf(graph: RoadGraph, lane: Lane, pos: Vec2): number {
  return laneProgress(graph, lane, pos);
}

export function stepAgent(
  graph: RoadGraph,
  agent: Agent,
  agents: readonly Agent[],
  dt: number,
  policeMultiplier: number,
): void {
  let clearance = 14;
  for (const other of agents) {
    if (other === agent) continue;
    const ahead = projectAhead(agent, other.pos);
    if (ahead > 0 && ahead < clearance) clearance = ahead;
  }
  const brakeTarget = Math.max(0, (clearance - 7) / 8);
  const target = agent.desired * Math.min(1, brakeTarget) * policeMultiplier;
  const accel = target > agent.speed ? 8 : 20;
  agent.speed += Math.max(-accel * dt, Math.min(accel * dt, target - agent.speed));
  agent.speed = Math.max(0, agent.speed);

  const laneLength = Math.max(1, agent.lane.length);
  agent.t += (agent.speed * dt) / laneLength;

  if (agent.t >= 1) {
    const options = agent.lane.next;
    const nextId = options.length > 0 ? options[0] : agent.lane.id;
    const next = graph.lanes.find((l) => l.id === nextId);
    if (next) {
      agent.lane = next;
      agent.t = 0;
    } else {
      agent.t = 1;
      agent.speed *= 0.4;
    }
  }

  const here = lanePoint(agent.lane, agent.t);
  agent.pos.x = here.x;
  agent.pos.z = here.z;
  agent.heading = Math.atan2(agent.lane.dir.x, agent.lane.dir.z);
}

function projectAhead(agent: Agent, point: Vec2): number {
  const dx = point.x - agent.pos.x;
  const dz = point.z - agent.pos.z;
  const fx = Math.sin(agent.heading);
  const fz = Math.cos(agent.heading);
  return dx * fx + dz * fz;
}

export function chasePlayer(agent: Agent, target: Vec2, dt: number, speed: number): void {
  const dx = target.x - agent.pos.x;
  const dz = target.z - agent.pos.z;
  const want = Math.atan2(dx, dz);
  let delta = want - agent.heading;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  agent.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, delta * 2.2 * dt * 10));
  const dist = Math.hypot(dx, dz);
  agent.speed += Math.max(-20 * dt, Math.min(16 * dt, Math.min(speed, dist > 6 ? speed : 0) - agent.speed));
  agent.pos.x += Math.sin(agent.heading) * agent.speed * dt;
  agent.pos.z += Math.cos(agent.heading) * agent.speed * dt;
}
