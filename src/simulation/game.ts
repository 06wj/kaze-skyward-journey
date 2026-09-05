export type V3 = { x: number; y: number; z: number };
export type Mode = "journey" | "free";
export type Screen = "menu" | "playing" | "paused" | "result";
export interface FlightInput {
  turn: number;
  climb: number;
  boost: boolean;
  brake: boolean;
}
export interface Route {
  name: string;
  subtitle: string;
  timeLimit: number;
  spawn: V3;
  yaw: number;
  gates: V3[];
}
export const ROUTES: Route[] = [
  {
    name: "晴空启程",
    subtitle: "沿着晴川，认识飞翔的感觉",
    timeLimit: 100,
    spawn: { x: 0, y: 26, z: 136 },
    yaw: 0,
    gates: [
      { x: 0, y: 26, z: 96 },
      { x: -5, y: 28, z: 57 },
      { x: 6, y: 31, z: 16 },
      { x: 0, y: 27, z: -25 },
      { x: -6, y: 29, z: -64 },
      { x: 5, y: 34, z: -105 },
      { x: 0, y: 38, z: -148 },
      { x: 0, y: 45, z: -195 },
    ],
  },
  {
    name: "天际回响",
    subtitle: "掠过楼顶，把城市留在脚下",
    timeLimit: 115,
    spawn: { x: 0, y: 48, z: 146 },
    yaw: 0,
    gates: [
      { x: 0, y: 48, z: 106 },
      { x: 10, y: 58, z: 64 },
      { x: -9, y: 67, z: 20 },
      { x: 8, y: 78, z: -25 },
      { x: 0, y: 87, z: -73 },
      { x: -12, y: 99, z: -122 },
      { x: 0, y: 106, z: -170 },
      { x: 15, y: 117, z: -210 },
      { x: 50, y: 126, z: -230 },
      { x: 85, y: 128, z: -207 },
    ],
  },
  {
    name: "暮色逐风",
    subtitle: "追逐远方的风，绕过城市的天际线",
    timeLimit: 140,
    spawn: { x: 0, y: 115, z: 145 },
    yaw: 0,
    gates: [
      { x: 0, y: 115, z: 99 },
      { x: -20, y: 123, z: 56 },
      { x: -56, y: 128, z: 18 },
      { x: -86, y: 135, z: -23 },
      { x: -88, y: 140, z: -71 },
      { x: -59, y: 150, z: -110 },
      { x: -12, y: 151, z: -132 },
      { x: 39, y: 149, z: -126 },
      { x: 79, y: 147, z: -94 },
      { x: 82, y: 139, z: -43 },
      { x: 57, y: 131, z: 2 },
      { x: 13, y: 122, z: 27 },
    ],
  },
];
export interface FlightState {
  position: V3;
  previous: V3;
  yaw: number;
  pitch: number;
  bank: number;
  speed: number;
  stamina: number;
  integrity: number;
  elapsed: number;
  score: number;
  combo: number;
  checkpoint: number;
  invulnerability: number;
  boosted: boolean;
  boostLocked: boolean;
  mode: Mode;
  route: number;
  screen: Screen;
}
export function createState(): FlightState {
  const p = { ...ROUTES[0].spawn };
  return {
    position: p,
    previous: { ...p },
    yaw: 0,
    pitch: 0,
    bank: 0,
    speed: 15,
    stamina: 100,
    integrity: 100,
    elapsed: 0,
    score: 0,
    combo: 0,
    checkpoint: 0,
    invulnerability: 0,
    boosted: false,
    boostLocked: false,
    mode: "journey",
    route: 0,
    screen: "menu",
  };
}
export function startState(s: FlightState, mode: Mode, route: number): void {
  Object.assign(s, createState(), {
    mode,
    route,
    screen: "playing",
    position: { ...ROUTES[route].spawn },
    previous: { ...ROUTES[route].spawn },
    yaw: ROUTES[route].yaw,
  });
}
const approach = (v: number, t: number, r: number, dt: number) =>
  v + (t - v) * (1 - Math.exp(-r * dt));
export function stepFlight(
  s: FlightState,
  input: FlightInput,
  dt: number,
): void {
  if (s.screen !== "playing") return;
  s.elapsed += dt;
  s.previous = { ...s.position };
  s.invulnerability = Math.max(0, s.invulnerability - dt);
  if (!input.boost || s.stamina >= 28) s.boostLocked = false;
  s.boosted = input.boost && s.stamina > 2 && !input.brake && !s.boostLocked;
  s.stamina = Math.max(
    0,
    Math.min(100, s.stamina + (s.boosted ? -25 : 15) * dt),
  );
  if (s.stamina <= 2 && input.boost) s.boostLocked = true;
  s.speed = approach(s.speed, input.brake ? 6.5 : s.boosted ? 30 : 15, 3, dt);
  s.bank = approach(s.bank, -input.turn * 0.62, 5, dt);
  s.yaw -= input.turn * (input.brake ? 1.6 : 1.18) * dt;
  s.pitch = approach(s.pitch, input.climb * 0.56, 3.5, dt);
  s.position.x -= Math.sin(s.yaw) * Math.cos(s.pitch) * s.speed * dt;
  s.position.z -= Math.cos(s.yaw) * Math.cos(s.pitch) * s.speed * dt;
  s.position.y += Math.sin(s.pitch) * s.speed * dt;
  s.position.y = Math.max(2.8, Math.min(190, s.position.y));
}
export function distance(a: V3, b: V3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}
export function segmentDistance(a: V3, b: V3, p: V3): number {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    dz = b.z - a.z;
  const t = Math.max(
    0,
    Math.min(
      1,
      ((p.x - a.x) * dx + (p.y - a.y) * dy + (p.z - a.z) * dz) /
        (dx * dx + dy * dy + dz * dz || 1),
    ),
  );
  return Math.hypot(a.x + dx * t - p.x, a.y + dy * t - p.y, a.z + dz * t - p.z);
}
export function collectGate(s: FlightState): boolean {
  const target = ROUTES[s.route].gates[s.checkpoint];
  if (
    s.mode !== "journey" ||
    !target ||
    segmentDistance(s.previous, s.position, target) > 6.5
  )
    return false;
  s.checkpoint++;
  s.combo++;
  s.score += Math.round(
    250 * (1 + Math.min(s.combo - 1, 5) * 0.2) + (s.boosted ? 100 : 0),
  );
  s.stamina = Math.min(100, s.stamina + 22);
  s.integrity = Math.min(100, s.integrity + 9);
  return true;
}
export function damage(s: FlightState): boolean {
  if (s.invulnerability > 0) return false;
  s.integrity = Math.max(0, s.integrity - 25);
  s.combo = 0;
  s.invulnerability = 2.5;
  s.speed = 6.5;
  return true;
}
export function finalScore(s: FlightState): number {
  return (
    s.score +
    Math.round(Math.max(0, ROUTES[s.route].timeLimit - s.elapsed) * 12) +
    Math.round(s.integrity * 8)
  );
}
export function medalFor(s: FlightState): string {
  const ratio = s.elapsed / ROUTES[s.route].timeLimit;
  return ratio < 0.55 && s.integrity >= 75
    ? "金羽"
    : ratio < 0.8 && s.integrity >= 50
      ? "银羽"
      : "铜羽";
}
export interface FlightRecord {
  score: number;
  time: number;
  medal: string;
}
export function readRecords(): Record<string, FlightRecord> {
  try {
    const raw = JSON.parse(localStorage.getItem("kaze-records-v1") || "{}");
    return Object.fromEntries(
      Object.entries(raw).filter(
        ([, v]) =>
          v &&
          typeof v === "object" &&
          Number.isFinite((v as FlightRecord).score) &&
          Number.isFinite((v as FlightRecord).time) &&
          typeof (v as FlightRecord).medal === "string",
      ),
    ) as Record<string, FlightRecord>;
  } catch {
    return {};
  }
}
export function saveRecord(
  records: Record<string, FlightRecord>,
  route: number,
  record: FlightRecord,
): boolean {
  const key = String(route),
    best = !records[key] || record.score > records[key].score;
  if (best) {
    records[key] = record;
    try {
      localStorage.setItem("kaze-records-v1", JSON.stringify(records));
    } catch {}
  }
  return best;
}
