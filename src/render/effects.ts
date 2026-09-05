import * as THREE from "three";
import { ROUTES, type V3, type FlightState } from "../simulation/game";
export class FlightEffects {
  private gates: THREE.Group[] = [];
  private root = new THREE.Group();
  private route = 0;
  private particles: THREE.Points;
  private positions = new Float32Array(300 * 3);
  private velocities = new Float32Array(300 * 3);
  private lives = new Float32Array(300);
  private cursor = 0;
  private trailGeometry = new THREE.BufferGeometry();
  private trailPosition = new Float32Array(2 * 70 * 3);
  private trails: THREE.LineSegments;
  private history: THREE.Vector3[][] = [[], []];
  private sparks = new THREE.Group();
  constructor(scene: THREE.Scene) {
    scene.add(this.root);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));
    this.particles = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        color: "#fff5c0",
        size: 0.22,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      }),
    );
    this.particles.frustumCulled = false;
    scene.add(this.particles);
    this.trailGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(this.trailPosition, 3),
    );
    this.trails = new THREE.LineSegments(
      this.trailGeometry,
      new THREE.LineBasicMaterial({
        color: "#ffedce",
        transparent: true,
        opacity: 0.48,
        depthWrite: false,
      }),
    );
    this.trails.frustumCulled = false;
    scene.add(this.trails);
    scene.add(this.sparks);
  }
  setRoute(index: number, visible: boolean) {
    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
    this.root.clear();
    this.gates = [];
    this.route = index;
    this.root.visible = visible;
    this.history = [[], []];
    const route = ROUTES[index];
    route.gates.forEach((point, i) => {
      const group = new THREE.Group();
      group.position.set(point.x, point.y, point.z);
      const previous = i ? route.gates[i - 1] : route.spawn;
      const next = route.gates[Math.min(i + 1, route.gates.length - 1)];
      const direction = new THREE.Vector3(
        next.x - previous.x,
        next.y - previous.y,
        next.z - previous.z,
      ).normalize();
      group.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        direction,
      );
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(6.4, 0.095, 6, 80),
        new THREE.MeshBasicMaterial({
          color: "#fff6cf",
          transparent: true,
          opacity: 0.85,
        }),
      );
      group.add(ring);
      const inner = new THREE.Mesh(
        new THREE.TorusGeometry(6.15, 0.028, 4, 80),
        new THREE.MeshBasicMaterial({
          color: "#ffc579",
          transparent: true,
          opacity: 0.6,
        }),
      );
      group.add(inner);
      const arc = new THREE.Mesh(
        new THREE.TorusGeometry(6.75, 0.06, 4, 64, Math.PI * 1.5),
        new THREE.MeshBasicMaterial({
          color: "#f9ca79",
          transparent: true,
          opacity: 0.8,
        }),
      );
      arc.name = "orbit";
      group.add(arc);
      for (let k = 0; k < 4; k++) {
        const diamond = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.35),
          new THREE.MeshBasicMaterial({ color: "#fff3bb" }),
        );
        diamond.position.set(
          Math.cos((k * Math.PI) / 2) * 6.4,
          Math.sin((k * Math.PI) / 2) * 6.4,
          0,
        );
        group.add(diamond);
      }
      this.root.add(group);
      this.gates.push(group);
    });
  }
  burst(point: V3, count = 65) {
    for (let n = 0; n < count; n++) {
      const i = this.cursor++ % 300;
      this.positions[i * 3] = point.x;
      this.positions[i * 3 + 1] = point.y;
      this.positions[i * 3 + 2] = point.z;
      this.velocities[i * 3] = (Math.random() - 0.5) * 12;
      this.velocities[i * 3 + 1] = (Math.random() - 0.25) * 10;
      this.velocities[i * 3 + 2] = (Math.random() - 0.5) * 12;
      this.lives[i] = 0.6 + Math.random() * 0.9;
    }
  }
  update(time: number, dt: number, state: FlightState, bird: THREE.Group) {
    for (let i = 0; i < this.gates.length; i++) {
      const g = this.gates[i];
      g.visible = i >= state.checkpoint;
      const active = i === state.checkpoint;
      g.scale.setScalar(active ? 1 + Math.sin(time * 2.2) * 0.022 : 1);
      g.getObjectByName("orbit")!.rotation.z = time * 0.3 + i;
      g.children.forEach((o) => {
        if (o instanceof THREE.Mesh) {
          const m = o.material as THREE.MeshBasicMaterial;
          m.opacity = active ? 0.96 : 0.32;
        }
      });
    }
    for (let i = 0; i < 300; i++) {
      if (this.lives[i] > 0) {
        this.lives[i] -= dt;
        for (let j = 0; j < 3; j++)
          this.positions[i * 3 + j] += this.velocities[i * 3 + j] * dt;
        this.velocities[i * 3 + 1] -= dt * 1.6;
      } else this.positions[i * 3 + 1] = -100;
    }
    this.particles.geometry.attributes.position.needsUpdate = true;
    this.trails.visible = state.screen === "playing";
    if (this.trails.visible) {
      for (let side = 0; side < 2; side++) {
        const p = new THREE.Vector3(
          side === 0 ? -2.6 : 2.6,
          0.05,
          0.45,
        ).applyMatrix4(bird.matrixWorld);
        this.history[side].unshift(p);
        if (this.history[side].length > 36) this.history[side].pop();
        for (let j = 0; j < 35; j++) {
          const a =
              this.history[side][Math.min(j, this.history[side].length - 1)],
            b =
              this.history[side][
                Math.min(j + 1, this.history[side].length - 1)
              ];
          const offset = (side * 35 + j) * 6;
          this.trailPosition.set([a.x, a.y, a.z, b.x, b.y, b.z], offset);
        }
      }
      this.trailGeometry.attributes.position.needsUpdate = true;
      (this.trails.material as THREE.LineBasicMaterial).opacity = state.boosted
        ? 0.65
        : 0.21;
    }
  }
  setVisible(v: boolean) {
    this.root.visible = v;
  }
}
