import test from "node:test";
import assert from "node:assert/strict";
import {
  createState,
  startState,
  stepFlight,
  collectGate,
  segmentDistance,
  damage,
  ROUTES,
} from "../src/simulation/game";
import { CollisionWorld } from "../src/physics/collision";
const idle = { turn: 0, climb: 0, boost: false, brake: false };
test("flight is independent of render cadence and pauses simulation", () => {
  const a = createState(),
    b = createState();
  startState(a, "journey", 0);
  startState(b, "journey", 0);
  for (let i = 0; i < 600; i++) stepFlight(a, idle, 1 / 60);
  for (let i = 0; i < 1200; i++) stepFlight(b, idle, 1 / 120);
  assert.ok(Math.abs(a.position.z - b.position.z) < 0.01);
  a.screen = "paused";
  const z = a.position.z;
  stepFlight(a, idle, 1);
  assert.equal(a.position.z, z);
});
test("swept checkpoint collection prevents tunneling and duplicate awards", () => {
  const s = createState();
  startState(s, "journey", 0);
  const gate = ROUTES[0].gates[0];
  s.previous = { ...gate, z: gate.z + 15 };
  s.position = { ...gate, z: gate.z - 15 };
  assert.ok(collectGate(s));
  assert.equal(s.checkpoint, 1);
  assert.ok(!collectGate(s));
  assert.equal(s.score, 250);
  assert.equal(
    segmentDistance(
      { x: 0, y: 0, z: 10 },
      { x: 0, y: 0, z: -10 },
      { x: 0, y: 0, z: 0 },
    ),
    0,
  );
});
test("boost consumes stamina and collision grace period prevents repeated damage", () => {
  const s = createState();
  startState(s, "journey", 0);
  for (let i = 0; i < 120; i++) stepFlight(s, { ...idle, boost: true }, 1 / 60);
  assert.ok(s.stamina < 51);
  assert.ok(s.speed > 29);
  assert.ok(damage(s));
  assert.equal(s.integrity, 75);
  assert.ok(!damage(s));
  assert.equal(s.integrity, 75);
});
test("Rapier swept sphere catches a thin wall at boost speed", async () => {
  const physics = await CollisionWorld.create([
    { x: 0, y: 10, z: 0, hx: 5, hy: 10, hz: 0.1 },
  ]);
  assert.ok(physics.sweep({ x: 0, y: 10, z: 8 }, { x: 0, y: 10, z: -8 }));
  assert.equal(
    physics.sweep({ x: 15, y: 10, z: 8 }, { x: 15, y: 10, z: -8 }),
    null,
  );
  physics.dispose();
});
test("exhausted boost has a recovery window rather than flickering every frame", () => {
  const s = createState();
  startState(s, "free", 0);
  s.stamina = 1;
  for (let i = 0; i < 60; i++) stepFlight(s, { ...idle, boost: true }, 1 / 60);
  assert.equal(s.boosted, false);
  assert.ok(s.stamina > 14);
  assert.equal(s.boostLocked, true);
  stepFlight(s, idle, 1 / 60);
  assert.equal(s.boostLocked, false);
});
