import * as THREE from "three";
import { createWorld } from "./render/world";
import { createSky } from "./render/sky";
import { createBird } from "./render/bird";
import { FlightEffects } from "./render/effects";
import { CollisionWorld } from "./physics/collision";
import { GameAudio } from "./audio/audio";
import { Input } from "./simulation/input";
import {
  createState,
  startState,
  stepFlight,
  collectGate,
  damage,
  finalScore,
  medalFor,
  readRecords,
  saveRecord,
  ROUTES,
  distance,
  type Mode,
} from "./simulation/game";
import { GameUI, type GameSettings } from "./ui/ui";
import "./ui/style.css";

const app = document.querySelector<HTMLElement>("#app")!;
const state = createState();
const audio = new GameAudio();
const records = readRecords();
let ready = false;
let world: ReturnType<typeof createWorld>;
let sky: ReturnType<typeof createSky>;
let physics: CollisionWorld;
let bird: Awaited<ReturnType<typeof createBird>>;
let effects: FlightEffects;
let scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  camera: THREE.PerspectiveCamera,
  sun: THREE.DirectionalLight,
  hemi: THREE.HemisphereLight;
let settings: GameSettings = {
  volume: 0.45,
  quality: "high",
  invertY: false,
  reducedMotion: false,
  timeOfDay: "sunset",
};
try {
  settings = {
    ...settings,
    ...JSON.parse(localStorage.getItem("kaze-settings-v1") || "{}"),
  };
} catch {}
let input: Input;
const ui = new GameUI(document.querySelector<HTMLElement>("#ui")!, {
  onStart: (mode, route) => start(mode, route),
  onResume: () => resume(),
  onRestart: () => start(state.mode, state.route),
  onMenu: () => menu(),
  onPause: () => pause(),
  onSettings: applySettings,
});
input = new Input(
  () => {
    if (
      Array.from(document.querySelectorAll('[role="dialog"]')).some(
        (el) => el.getClientRects().length > 0,
      )
    )
      return;
    state.screen === "playing"
      ? pause()
      : state.screen === "paused"
        ? resume()
        : null;
  },
  () => {
    if (state.screen === "playing") start(state.mode, state.route);
  },
);
input.bindTouch();
ui.setRecords(records);
ui.setLoading(8);
const targetMarker = document.createElement("div");
targetMarker.className = "target-marker";
targetMarker.innerHTML = "<span>◇</span><small></small>";
document.querySelector("#ui")!.append(targetMarker);
const extraStyle = document.createElement("style");
extraStyle.textContent = `#app{position:fixed;inset:0}#app canvas{display:block;width:100%;height:100%}.target-marker{position:absolute;pointer-events:none;display:none;z-index:5;color:#fff4cd;text-shadow:0 1px 5px #493b3d;text-align:center;transform:translate(-50%,-50%);font:11px sans-serif;letter-spacing:1px}.target-marker span{display:block;font-size:24px;line-height:26px}.target-marker.offscreen span{font-size:32px}.target-marker small{background:#40333f70;border-radius:20px;padding:3px 7px;white-space:nowrap}.impact-flash{animation:impact .4s ease-out}@keyframes impact{0%{box-shadow:inset 0 0 100px #e34b4290}100%{box-shadow:inset 0 0 0 transparent}}.fatal-error{position:fixed;inset:0;background:#f5f1e8;color:#2b454a;z-index:2000;display:grid;place-content:center;text-align:center;padding:32px;font-family:serif}.fatal-error button{background:#ed765d;border:0;color:white;padding:15px 25px;cursor:pointer}`;
document.head.append(extraStyle);
function applySettings(value: GameSettings) {
  settings = { ...settings, ...value };
  audio.setVolume(settings.volume);
  input?.setInvert(settings.invertY);
  if (!ready) return;
  const morning = settings.timeOfDay === "morning";
  sky.setTimeOfDay(settings.timeOfDay);
  world.setTimeOfDay?.(settings.timeOfDay);
  hemi.color.set(morning ? "#d2e7ee" : "#c7b4d0");
  hemi.groundColor.set(morning ? "#9b9792" : "#a1818e");
  hemi.intensity = morning ? 1.7 : 1.45;
  sun.color.set(morning ? "#fff2d8" : "#ffcb92");
  sun.intensity = morning ? 2.25 : 2.45;
  sun.position.set(-150, morning ? 230 : 145, -260);
  scene.fog = new THREE.Fog(morning ? "#d2deda" : "#dcb5b1", 175, 720);
  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio, settings.quality === "high" ? 1.65 : 1),
  );
  renderer.shadowMap.enabled = settings.quality === "high";
  renderer.shadowMap.needsUpdate = true;
}
function start(mode: Mode, route: number) {
  if (!ready) return;
  startState(state, mode, Math.max(0, Math.min(2, route)));
  input.clear();
  effects.setRoute(state.route, mode === "journey");
  ui.setScreen("playing");
  audio.start().catch(() => {});
  audio.setActive(true);
  targetMarker.style.display = mode === "journey" ? "block" : "none";
  document.activeElement instanceof HTMLElement &&
    document.activeElement.blur();
  setCamera(true);
  ui.notify(
    mode === "free"
      ? "随风而行 · 自由探索这座城市"
      : matchMedia("(pointer: coarse)").matches
        ? "穿过前方风环 · 左侧拖动转向，右侧长按疾风"
        : "穿过前方的风环 · W / S 升降，A / D 转向",
  );
}
function pause() {
  if (state.screen !== "playing") return;
  state.screen = "paused";
  input.clear();
  ui.setScreen("paused");
  audio.setActive(false);
  targetMarker.style.display = "none";
}
function resume() {
  if (state.screen !== "paused") return;
  state.screen = "playing";
  input.clear();
  ui.setScreen("playing");
  audio.setActive(true);
  document.activeElement instanceof HTMLElement &&
    document.activeElement.blur();
}
function menu() {
  state.screen = "menu";
  input.clear();
  ui.setScreen("menu");
  effects?.setVisible(false);
  targetMarker.style.display = "none";
  audio.setActive(false);
}
function finish(success: boolean) {
  state.screen = "result";
  input.clear();
  targetMarker.style.display = "none";
  const score = success ? finalScore(state) : state.score;
  const medal = success ? medalFor(state) : "继续加油";
  const best = success
    ? saveRecord(records, state.route, { score, time: state.elapsed, medal })
    : false;
  ui.setRecords(records);
  ui.showResult({
    success,
    score,
    time: state.elapsed,
    rings: state.checkpoint,
    total: ROUTES[state.route].gates.length,
    medal,
    routeName: ROUTES[state.route].name,
    best,
  });
  ui.setScreen("result");
  audio.finish(success);
  audio.setActive(false);
}
const cameraDesired = new THREE.Vector3(),
  lookDesired = new THREE.Vector3(),
  lookCurrent = new THREE.Vector3();
function setCamera(snap = false, dt = 1 / 60) {
  const p = state.position;
  const behind = new THREE.Vector3(Math.sin(state.yaw), 0, Math.cos(state.yaw));
  cameraDesired.set(p.x + behind.x * 13, p.y + 5.3, p.z + behind.z * 13);
  lookDesired.set(
    p.x - behind.x * 16,
    p.y + 1.7 + state.pitch * 8,
    p.z - behind.z * 16,
  );
  if (snap) {
    camera.position.copy(cameraDesired);
    lookCurrent.copy(lookDesired);
  } else {
    camera.position.lerp(cameraDesired, 1 - Math.exp(-5 * dt));
    lookCurrent.lerp(lookDesired, 1 - Math.exp(-6 * dt));
  }
  camera.up.set(Math.sin(state.bank * 0.1), 1, 0);
  camera.lookAt(lookCurrent);
  camera.fov = THREE.MathUtils.damp(
    camera.fov,
    state.boosted && !settings.reducedMotion ? 70 : 60,
    3,
    dt,
  );
  camera.updateProjectionMatrix();
}
let worldTime = 0,
  lastTime = 0,
  accumulator = 0,
  hudTimer = 0,
  boundaryCooldown = 0;
function tick(ms: number) {
  const dt = Math.min((ms - lastTime) / 1000 || 1 / 60, 0.06);
  lastTime = ms;
  worldTime += dt;
  if (state.screen === "playing") {
    accumulator = Math.min(accumulator + dt, 0.15);
    const controls = input.get();
    while (accumulator >= 1 / 60) {
      stepFlight(state, controls, 1 / 60);
      const hit = physics.sweep(state.previous, state.position);
      if (hit) {
        const n = hit.normal;
        state.position = {
          x: state.previous.x + n.x * 1.5,
          y: Math.max(4, state.previous.y + n.y * 1.5),
          z: state.previous.z + n.z * 1.5,
        };
        if (damage(state)) {
          audio.hit();
          effects.burst(state.position, 30);
          ui.notify("擦碰了建筑 · 放慢速度，调整方向");
          document.querySelector("#ui")!.classList.remove("impact-flash");
          requestAnimationFrame(() =>
            document.querySelector("#ui")!.classList.add("impact-flash"),
          );
        }
        if (Math.hypot(n.x, n.z) > 0.1) {
          const dx = -Math.sin(state.yaw),
            dz = -Math.cos(state.yaw),
            dot = dx * n.x + dz * n.z;
          state.yaw = Math.atan2(-(dx - 2 * dot * n.x), -(dz - 2 * dot * n.z));
        } else state.pitch = 0.35;
      }
      if (state.position.y <= 2.81) {
        state.position.y = 4.5;
        if (damage(state)) {
          audio.hit();
          ui.notify("离水面太近了 · 按 W 抬升");
        }
      }
      if (
        Math.abs(state.position.x) > 245 ||
        Math.abs(state.position.z) > 280
      ) {
        state.yaw = Math.atan2(state.position.x, state.position.z);
        if (boundaryCooldown <= 0) {
          ui.notify("城市的风把你轻轻带回 · 继续探索");
          boundaryCooldown = 5;
        }
      }
      if (collectGate(state)) {
        const gate = ROUTES[state.route].gates[state.checkpoint - 1];
        effects.burst(gate);
        audio.ring(state.combo);
        if (state.combo > 1) ui.notify(`${state.combo} 连续穿环 · 顺风而行`);
      }
      accumulator -= 1 / 60;
      if (
        state.mode === "journey" &&
        state.checkpoint === ROUTES[state.route].gates.length
      ) {
        finish(true);
        break;
      }
      if (state.integrity <= 0) {
        if (state.mode === "journey") {
          finish(false);
          break;
        } else {
          state.integrity = 100;
          state.position = { x: 0, y: 40, z: 125 };
          state.yaw = 0;
          setCamera(true);
          ui.notify("重新振翅 · 风会一直等你");
        }
      }
      if (
        state.mode === "journey" &&
        state.elapsed >= ROUTES[state.route].timeLimit
      ) {
        finish(false);
        break;
      }
    }
    boundaryCooldown -= dt;
    bird.group.position.set(
      state.position.x,
      state.position.y,
      state.position.z,
    );
    bird.group.rotation.set(state.pitch, state.yaw, state.bank, "YXZ");
    bird.group.visible =
      state.invulnerability <= 0 || Math.sin(worldTime * 24) > 0.05;
    setCamera(false, dt);
    audio.update(state.speed, state.boosted);
  } else if (state.screen === "menu") {
    const t = worldTime * 0.065;
    camera.position.set(
      64 + Math.sin(t) * 8,
      64 + Math.sin(t * 0.7) * 2,
      163 + Math.cos(t) * 5,
    );
    lookDesired.set(-12, 37, -36);
    camera.up.set(0, 1, 0);
    camera.lookAt(lookDesired);
    camera.fov = 55;
    camera.updateProjectionMatrix();
    const front = new THREE.Vector3();
    camera.getWorldDirection(front);
    const right = new THREE.Vector3()
      .crossVectors(front, camera.up)
      .normalize();
    bird.group.position
      .copy(camera.position)
      .addScaledVector(front, 29)
      .addScaledVector(right, Math.min(6.4, camera.aspect * 3.8));
    bird.group.position.y -=
      (camera.aspect < 0.8 ? 9 : 3) + Math.sin(worldTime * 0.7) * 0.4;
    bird.group.rotation.set(
      0.06,
      -0.25 + Math.sin(worldTime * 0.23) * 0.1,
      -0.08 + Math.sin(worldTime * 0.3) * 0.06,
      "YXZ",
    );
    bird.group.visible = true;
  }
  bird.update(
    worldTime,
    state.screen === "menu" ? 0.05 : state.bank,
    state.boosted && state.screen === "playing",
  );
  world.update(worldTime, dt);
  sky.update(worldTime);
  bird.group.updateMatrixWorld();
  effects.update(worldTime, dt, state, bird.group);
  if (state.screen === "playing") {
    hudTimer += dt;
    if (hudTimer > 0.08) {
      hudTimer = 0;
      const route = ROUTES[state.route],
        target = route.gates[state.checkpoint];
      ui.update({
        score: state.score,
        speed: state.speed * 3.6,
        stamina: state.stamina,
        elapsed: state.elapsed,
        timeRemaining: Math.max(0, route.timeLimit - state.elapsed),
        checkpoint: state.checkpoint,
        total: route.gates.length,
        routeName: route.name,
        combo: state.combo,
        altitude: state.position.y,
        integrity: state.integrity,
        mode: state.mode,
        targetDistance: target ? distance(state.position, target) : 0,
      });
    }
    updateTarget();
  }
  renderer.render(scene, camera);
  if (import.meta.env.DEV) {
    Object.assign(window, {
      __KAZE__: {
        state,
        settings,
        records,
        renderer: {
          calls: renderer.info.render.calls,
          triangles: renderer.info.render.triangles,
        },
        start,
        pause,
        resume,
        finish,
        applySettings,
        routeAudit: () =>
          ROUTES.map((r) => ({
            name: r.name,
            blocked: r.gates.filter((p) => physics.contains(p)),
          })),
      },
    });
  }
}
function updateTarget() {
  const point = ROUTES[state.route].gates[state.checkpoint];
  if (state.mode !== "journey" || !point) {
    targetMarker.style.display = "none";
    return;
  }
  const p = new THREE.Vector3(point.x, point.y, point.z),
    camPoint = p.clone().applyMatrix4(camera.matrixWorldInverse);
  p.project(camera);
  const behind = camPoint.z > 0;
  let x = p.x,
    y = p.y;
  if (behind) {
    x = -x;
    y = -y;
  }
  const offscreen = behind || Math.abs(x) > 0.83 || Math.abs(y) > 0.75;
  if (offscreen) {
    const max = Math.max(Math.abs(x) / 0.83, Math.abs(y) / 0.75, 1);
    x /= max;
    y /= max;
  }
  targetMarker.style.display = "block";
  targetMarker.style.left = `${(x * 0.5 + 0.5) * innerWidth}px`;
  targetMarker.style.top = `${(-y * 0.5 + 0.5) * innerHeight - (!offscreen ? 40 : 0)}px`;
  targetMarker.classList.toggle("offscreen", offscreen);
  targetMarker.querySelector("span")!.textContent = offscreen ? "➤" : "◇";
  targetMarker.querySelector<HTMLElement>("span")!.style.transform = offscreen
    ? `rotate(${Math.atan2(-y, x)}rad)`
    : "";
  targetMarker.querySelector("small")!.textContent =
    `${offscreen ? "下一风环 · " : ""}${Math.round(distance(state.position, point))} m`;
}
function resize() {
  if (!renderer) return;
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
async function boot() {
  try {
    scene = new THREE.Scene();
    scene.background = new THREE.Color("#dcb5b1");
    scene.fog = new THREE.Fog("#dcb5b1", 175, 720);
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
      alpha: false,
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.06;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    app.append(renderer.domElement);
    camera = new THREE.PerspectiveCamera(
      55,
      innerWidth / innerHeight,
      0.5,
      1800,
    );
    resize();
    hemi = new THREE.HemisphereLight("#c7b4d0", "#a1818e", 1.45);
    scene.add(hemi);
    sun = new THREE.DirectionalLight("#ffcb92", 2.45);
    sun.position.set(-150, 145, -260);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -245;
    sun.shadow.camera.right = 245;
    sun.shadow.camera.top = 245;
    sun.shadow.camera.bottom = -245;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 650;
    sun.shadow.normalBias = 0.3;
    sun.shadow.bias = -0.00015;
    scene.add(sun);
    scene.add(sun.target);
    sky = createSky(scene);
    ui.setLoading(22);
    world = createWorld(scene);
    ui.setLoading(48);
    const [loadedBird, collision] = await Promise.all([
      createBird(),
      CollisionWorld.create(world.colliders),
    ]);
    bird = loadedBird;
    physics = collision;
    scene.add(bird.group);
    ui.setLoading(78);
    effects = new FlightEffects(scene);
    effects.setRoute(0, false);
    ready = true;
    applySettings(settings);
    ui.setScreen("menu");
    ui.setLoading(100);
    document.querySelector("#boot")!.classList.add("done");
    setTimeout(() => document.querySelector("#boot")?.remove(), 600);
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) pause();
    });
    window.addEventListener("blur", () => pause());
    renderer.domElement.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      pause();
      ui.notify("图形连接暂时中断 · 正在恢复画面");
    });
    renderer.domElement.addEventListener("webglcontextrestored", () =>
      location.reload(),
    );
    renderer.setAnimationLoop(tick);
  } catch (error) {
    console.error(error);
    document.querySelector("#boot")?.remove();
    const div = document.createElement("div");
    div.className = "fatal-error";
    div.innerHTML =
      "<h1>天空暂时没有准备好</h1><p>请使用支持 WebGL 2 的浏览器，并开启硬件加速。</p><button>重新载入</button>";
    div.querySelector("button")!.onclick = () => location.reload();
    document.body.append(div);
  }
}
boot();
