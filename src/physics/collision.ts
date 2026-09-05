import RAPIER from "@dimforge/rapier3d-compat";
import type { V3 } from "../simulation/game";
export type BoxCollider = {
  x: number;
  y: number;
  z: number;
  hx: number;
  hy: number;
  hz: number;
};
export class CollisionWorld {
  private world: RAPIER.World;
  private shape = new RAPIER.Ball(0.8);
  static async create(boxes: BoxCollider[]) {
    await RAPIER.init();
    return new CollisionWorld(boxes);
  }
  private constructor(boxes: BoxCollider[]) {
    this.world = new RAPIER.World({ x: 0, y: 0, z: 0 });
    for (const b of boxes)
      this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(b.hx, b.hy, b.hz).setTranslation(
          b.x,
          b.y,
          b.z,
        ),
      );
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(1000, 1, 1000).setTranslation(0, -1, 0),
    );
    this.world.step();
  }
  sweep(from: V3, to: V3): { normal: V3; toi: number } | null {
    const velocity = { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z };
    const hit = this.world.castShape(
      from,
      { x: 0, y: 0, z: 0, w: 1 },
      velocity,
      this.shape,
      0.02,
      1,
      true,
    );
    return hit ? { normal: hit.normal1, toi: hit.time_of_impact } : null;
  }
  contains(p: V3) {
    let found = false;
    this.world.intersectionsWithShape(
      p,
      { x: 0, y: 0, z: 0, w: 1 },
      this.shape,
      () => {
        found = true;
        return false;
      },
    );
    return found;
  }
  dispose() {
    this.world.free();
  }
}
