import { describe, expect, it } from "vitest";
import { CAR_TUNING, resolveBoxes, spawnAgent, speedKmh, stepAgent, stepVehicle, type VehicleState } from "../packages/game/src/sim/vehicles.ts";
import { buildGridGraph, lanePoint } from "../packages/game/src/world/roads.ts";

function mkVehicle(x = 0, z = 0, heading = 0): VehicleState {
  return {
    pos: { x, z },
    heading,
    speed: 0,
    throttle: 0,
    brake: 0,
    steer: 0,
    yawRate: 0,
  };
}

const DT = 1 / 60;

function run(state: VehicleState, steps: number, steer = 0, throttle = 1, brake = 0): void {
  for (let i = 0; i < steps; i++) stepVehicle(state, CAR_TUNING, steer, throttle, brake, DT);
}

describe("vehicle physics", () => {
  it("accelerates forward along heading", () => {
    const car = mkVehicle(0, 0, 0);
    run(car, 90, 0, 1);
    
    expect(car.speed).toBeGreaterThan(5);
    expect(car.pos.z).toBeGreaterThan(1);
    expect(car.pos.x).toBeCloseTo(0, 4);
  });

  it("clamps speed to the tuned maximum", () => {
    const car = mkVehicle();
    run(car, 60 * 12, 0, 1);
    expect(car.speed).toBeLessThanOrEqual(CAR_TUNING.maxSpeed + 0.001);
    expect(car.speed).toBeGreaterThan(CAR_TUNING.maxSpeed * 0.85);
  });

  it("turns only when there is speed to steer with", () => {
    const still = mkVehicle();
    run(still, 60, 1, 0);
    expect(Math.abs(still.heading)).toBeLessThan(0.01);

    const moving = mkVehicle();
    run(moving, 30, 0, 1);
    const before = moving.heading;
    run(moving, 45, 1, 1);
    expect(Math.abs(moving.heading - before)).toBeGreaterThan(0.2);
  });

  it("brakes to a stop instead of overshooting into reverse", () => {
    const car = mkVehicle();
    run(car, 60, 0, 1);
    const speedBefore = car.speed;
    run(car, 60 * 3, 0, 0, 1);
    expect(car.speed).toBe(0);
    expect(speedBefore).toBeGreaterThan(10);
  });

  it("reports speed in km/h", () => {
    expect(speedKmh(10)).toBeCloseTo(36);
  });
});

describe("road graph", () => {
  it("builds four lanes per grid line with onward connections", () => {
    const graph = buildGridGraph(50, 5);
    expect(graph.lanes.length).toBe((5 - 1) * 2 * 2);
    expect(graph.lanes.every((lane) => lane.next.length === 3)).toBe(true);
    expect(graph.lanes.every((lane) => Math.abs(lane.length - 50) < 0.001)).toBe(true);
  });

  it("keeps lane endpoints on the expected axis", () => {
    const graph = buildGridGraph(50, 4);
    const onZ = graph.lanes.filter((lane) => Math.abs(lane.dir.z) > 0.5);
    expect(onZ.length).toBeGreaterThan(0);
    expect(onZ.every((lane) => Math.abs(lane.from.x - lane.to.x) < 0.0001)).toBe(true);
  });
});

describe("traffic agents", () => {
  const graph = buildGridGraph(54, 6);

  it("advances along its lane and reports world position", () => {
    const agent = spawnAgent(graph, () => 0.25, "civilian");
    const start = { ...agent.pos };
    const startT = agent.t;
    for (let i = 0; i < 120; i++) stepAgent(graph, agent, [agent], DT, 1);
    expect(agent.speed).toBeGreaterThan(1);
    expect(agent.t).not.toBe(startT);
    expect(Math.hypot(agent.pos.x - start.x, agent.pos.z - start.z)).toBeGreaterThan(1);
  });

  it("slows down when another car blocks the lane ahead", () => {
    const leader = spawnAgent(graph, () => 0.4, "civilian");
    const follower = spawnAgent(graph, () => 0.4, "civilian");
    follower.lane = leader.lane;
    follower.t = leader.t - 0.01;
    follower.desired = 30;
    leader.desired = 0;
    for (let i = 0; i < 30; i++) stepAgent(graph, leader, [leader, follower], DT, 1);
    for (let i = 0; i < 30; i++) stepAgent(graph, follower, [leader, follower], DT, 1);
    expect(follower.speed).toBeLessThan(12);
  });

  it("returns points inside the city bounds", () => {
    for (const lane of graph.lanes) {
      for (const t of [0, 0.5, 1]) {
        const p = lanePoint(lane, t);
        const bound = graph.half + graph.lateral + 0.001;
        expect(Math.abs(p.x)).toBeLessThanOrEqual(bound);
        expect(Math.abs(p.z)).toBeLessThanOrEqual(bound);
      }
    }
  });
});

describe("collision resolution", () => {
  const boxes = [{ x: 20, z: 20, hx: 5, hz: 5 }];

  it("pushes a car out of a building footprint", () => {
    const pos = { x: 22, z: 21 };
    const hits = resolveBoxes(pos, boxes, 1);
    expect(hits).toBe(1);
    expect(pos.x <= 14 || pos.x >= 26 || pos.z <= 14 || pos.z >= 26).toBe(true);
  });

  it("leaves free cars alone", () => {
    const pos = { x: 0, z: 0 };
    expect(resolveBoxes(pos, boxes, 1)).toBe(0);
    expect(pos).toEqual({ x: 0, z: 0 });
  });
});
