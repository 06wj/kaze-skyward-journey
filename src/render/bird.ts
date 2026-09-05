/// <reference types="vite/client" />
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export interface BirdCharacter {
  /** World-space flight transform. The character faces -Z, with Y up. */
  group: THREE.Group;
  /** Seconds, normalized bank (-1..1), and whether the bird is boosting. */
  update: (time: number, bank: number, boost: boolean) => void;
}

/** Original Blender-built courier swallow, with stepped anime lighting. */
export async function createBird(): Promise<BirdCharacter> {
  const gltf = await new GLTFLoader().loadAsync(
    `${import.meta.env.BASE_URL}models/swallow.glb`,
  );
  const group = new THREE.Group();
  group.name = "Player_Bird";
  const model = gltf.scene;
  group.add(model);

  const gradient = new THREE.DataTexture(
    new Uint8Array([82, 82, 82, 154, 154, 154, 218, 218, 218, 255, 255, 255]),
    4,
    1,
    THREE.RGBFormat,
  );
  gradient.minFilter = THREE.NearestFilter;
  gradient.magFilter = THREE.NearestFilter;
  gradient.generateMipmaps = false;
  gradient.needsUpdate = true;

  const materials = new Map<string, THREE.MeshToonMaterial>();
  const ink = new THREE.MeshBasicMaterial({
    color: 0x122d36,
    side: THREE.BackSide,
  });
  // An inverted hull gives the bird its thin drawn silhouette. It follows each
  // feather's actual normals rather than expanding its bounding box.
  ink.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      "vec3 transformed = vec3(position) + normalize(normal) * 0.012;",
    );
  };
  ink.customProgramCacheKey = () => "swallow-ink-hull-v1";
  const outlined: THREE.Mesh[] = [];
  model.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const mesh = object;
    const convert = (source: THREE.Material): THREE.MeshToonMaterial => {
      if (materials.has(source.uuid)) return materials.get(source.uuid)!;
      const original = source as THREE.MeshStandardMaterial;
      const toon = new THREE.MeshToonMaterial({
        name: source.name,
        color: original.color?.clone() ?? new THREE.Color(0xffffff),
        gradientMap: gradient,
        side: source.name.startsWith("Scarf")
          ? THREE.DoubleSide
          : THREE.FrontSide,
      });
      // The dark plumage retains chroma even on the shaded side of the sunset.
      toon.emissive.copy(toon.color).multiplyScalar(0.07);
      materials.set(source.uuid, toon);
      return toon;
    };
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map(convert)
      : convert(mesh.material);
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    if (/^(Body_|Head_|Crown_|Beak|Primary_|Tail_Stream)/.test(mesh.name))
      outlined.push(mesh);
  });
  for (const mesh of outlined) {
    const outline = new THREE.Mesh(mesh.geometry, ink);
    outline.name = `${mesh.name}_Ink`;
    outline.castShadow = false;
    outline.receiveShadow = false;
    outline.renderOrder = -1;
    mesh.add(outline);
  }

  const left = model.getObjectByName("Wing_L");
  const right = model.getObjectByName("Wing_R");
  const tail = model.getObjectByName("Tail");
  const scarfA = model.getObjectByName("Scarf_Tail_A");
  const scarfB = model.getObjectByName("Scarf_Tail_B");
  let previousTime = 0;
  let phase = 0;
  let boostMix = 0;

  const update = (time: number, bank: number, boost: boolean): void => {
    const dt = previousTime
      ? Math.min(Math.max(time - previousTime, 0), 0.06)
      : 1 / 60;
    previousTime = time;
    boostMix = THREE.MathUtils.damp(boostMix, boost ? 1 : 0, 7, dt);
    phase += dt * THREE.MathUtils.lerp(7.8, 14.5, boostMix);
    // Cruise contains a held glide between compact, elastic wing strokes.
    const cycle = Math.sin(phase);
    const glide = 0.68 + 0.32 * Math.sin(time * 0.71);
    const flap = cycle * THREE.MathUtils.lerp(0.28 * glide, 0.48, boostMix);
    const bankFlex = THREE.MathUtils.clamp(bank, -1, 1) * 0.075;
    if (left) {
      left.rotation.z = -flap + 0.06 - bankFlex;
      left.rotation.y = -0.06 * boostMix + Math.sin(phase - 0.4) * 0.022;
    }
    if (right) {
      right.rotation.z = flap - 0.06 - bankFlex;
      right.rotation.y = 0.06 * boostMix - Math.sin(phase - 0.4) * 0.022;
    }
    if (tail) {
      tail.rotation.x = Math.sin(phase - 0.55) * 0.035 + boostMix * 0.055;
      tail.rotation.y = -bank * 0.08;
    }
    if (scarfA) {
      scarfA.rotation.x = Math.sin(time * 11) * 0.1 + boostMix * 0.13;
      scarfA.rotation.y = Math.sin(time * 8.3) * 0.12 - bank * 0.1;
      scarfA.rotation.z = Math.sin(time * 9.4) * 0.06;
    }
    if (scarfB) {
      scarfB.rotation.x = Math.sin(time * 12.4 + 1.4) * 0.14 + boostMix * 0.09;
      scarfB.rotation.y = Math.sin(time * 9.1 + 2) * 0.14 - bank * 0.14;
    }
    model.position.y = Math.sin(phase - 0.45) * 0.027;
  };

  return { group, update };
}
