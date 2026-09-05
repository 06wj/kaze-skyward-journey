import * as THREE from "three";

export interface WorldCollider {
  x: number;
  y: number;
  z: number;
  hx: number;
  hy: number;
  hz: number;
}

type Shape = "box" | "cylinder" | "sphere" | "leaf" | "cone";
type Batch = {
  shape: Shape;
  material: THREE.Material;
  matrices: THREE.Matrix4[];
  shadow: boolean;
};

/** The entire city is deterministic and batched by material, including façade details. */
export function createWorld(scene: THREE.Scene) {
  const group = new THREE.Group();
  group.name = "Aobane — riverside district";
  scene.add(group);
  const colliders: WorldCollider[] = [];
  let seed = 94731;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const range = (a: number, b: number) => a + random() * (b - a);
  const choose = <T>(items: T[]) => items[Math.floor(random() * items.length)];
  const gradient = new THREE.DataTexture(
    new Uint8Array([116, 178, 221, 255]),
    4,
    1,
    THREE.RedFormat,
  );
  gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
  gradient.needsUpdate = true;
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [gradient];
  const toon = (color: number, emissive = 0) => {
    const mat = new THREE.MeshToonMaterial({
      color,
      gradientMap: gradient,
      emissive,
      emissiveIntensity: emissive ? 0.16 : 0,
    });
    materials.push(mat);
    return mat;
  };
  const palette = {
    ivory: toon(0xfff2d7),
    milk: toon(0xeef0de),
    peach: toon(0xeec6aa),
    apricot: toon(0xf4d8b0),
    mint: toon(0xb2d5c7),
    sage: toon(0xb6c6b2),
    blue: toon(0xb6d4df),
    rose: toon(0xe4b1aa),
    concrete: toon(0xced1bc),
    stone: toon(0xa6bab4),
    roof: toon(0x778f91),
    roofLight: toon(0xa6bbb0),
    dark: toon(0x364f61),
    glass: toon(0x45788d, 0x255b70),
    glassLight: toon(0x92d6da, 0x46797f),
    windowWarm: toon(0xf1dab0, 0x725d22),
    trim: toon(0xf8ebcb),
    white: toon(0xfff7e6),
    street: toon(0x829b9f),
    pavement: toon(0xd4d2bd),
    crossing: toon(0xf0e8c8),
    grass: toon(0x8eae8a),
    green: toon(0x60957c),
    leaf: toon(0x87b991),
    lightLeaf: toon(0xb3c992),
    sakura: toon(0xf4b7c1),
    sakuraLight: toon(0xffd3d4),
    sakuraDark: toon(0xd68f9e),
    bark: toon(0x715d61),
    orange: toon(0xec7048),
    red: toon(0xcf6553),
    teal: toon(0x4a9992),
    line: toon(0xeac484),
    metal: toon(0x647d7e),
    waterLine: toon(0xd8efe6, 0x708e8b),
  };
  const geometries: Record<Shape, THREE.BufferGeometry> = {
    box: new THREE.BoxGeometry(1, 1, 1),
    cylinder: new THREE.CylinderGeometry(1, 1, 1, 8),
    sphere: new THREE.IcosahedronGeometry(1, 1),
    leaf: new THREE.IcosahedronGeometry(1, 0),
    cone: new THREE.ConeGeometry(1, 1, 6),
  };
  const batches = new Map<string, Batch>();
  const dummy = new THREE.Object3D();
  function shape(
    kind: Shape,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    rx = 0,
    ry = 0,
    rz = 0,
    shadow = true,
  ) {
    const key = `${kind}:${mat.uuid}:${shadow}`;
    let batch = batches.get(key);
    if (!batch) {
      batch = { shape: kind, material: mat, matrices: [], shadow };
      batches.set(key, batch);
    }
    dummy.position.set(x, y, z);
    dummy.rotation.set(rx, ry, rz);
    dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix();
    batch.matrices.push(dummy.matrix.clone());
  }
  const box = (
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    ry = 0,
    shadow = true,
  ) => shape("box", mat, x, y, z, w, h, d, 0, ry, 0, shadow);
  const sphere = (
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy = sx,
    sz = sx,
  ) => shape("sphere", mat, x, y, z, sx, sy, sz);
  const cylinder = (
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
    r: number,
    h: number,
  ) => shape("cylinder", mat, x, y, z, r, h, r);
  const beam = (
    mat: THREE.Material,
    a: THREE.Vector3,
    b: THREE.Vector3,
    width: number,
    depth = width,
  ) => {
    dummy.position.copy(a).add(b).multiplyScalar(0.5);
    dummy.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      b.clone().sub(a).normalize(),
    );
    dummy.scale.set(width, a.distanceTo(b), depth);
    dummy.updateMatrix();
    const key = `box:${mat.uuid}:true`;
    if (!batches.has(key))
      batches.set(key, {
        shape: "box",
        material: mat,
        matrices: [],
        shadow: true,
      });
    batches.get(key)!.matrices.push(dummy.matrix.clone());
  };
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const edgeVertices: number[] = [];
  function outlineBox(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
  ) {
    const points = [
      V(x - w / 2, y - h / 2, z - d / 2),
      V(x + w / 2, y - h / 2, z - d / 2),
      V(x + w / 2, y + h / 2, z - d / 2),
      V(x - w / 2, y + h / 2, z - d / 2),
      V(x - w / 2, y - h / 2, z + d / 2),
      V(x + w / 2, y - h / 2, z + d / 2),
      V(x + w / 2, y + h / 2, z + d / 2),
      V(x - w / 2, y + h / 2, z + d / 2),
    ];
    for (const [a, b] of [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
      [4, 5],
      [5, 6],
      [6, 7],
      [7, 4],
      [0, 4],
      [1, 5],
      [2, 6],
      [3, 7],
    ])
      edgeVertices.push(...points[a].toArray(), ...points[b].toArray());
  }

  // Ground, streets and raised banks establish a coherent, navigable city plan.
  box(palette.grass, 0, -2.25, -35, 1200, 3, 1300, 0, false);
  box(palette.street, -128.5, -0.4, -20, 223, 0.7, 600, 0, false);
  box(palette.street, 128.5, -0.4, -20, 223, 0.7, 600, 0, false);
  box(palette.stone, 0, -1.7, -40, 35.5, 0.7, 610, 0, false);
  for (const side of [-1, 1]) {
    box(palette.stone, side * 17.15, 0.3, -40, 2.1, 3.7, 610);
    box(palette.pavement, side * 20.1, 1.45, -40, 4.4, 0.55, 610);
    box(palette.trim, side * 17.4, 1.95, -40, 0.62, 0.55, 610);
    box(palette.crossing, side * 22.5, 0.06, -40, 0.14, 0.04, 610, 0, false);
    box(palette.line, side * 27.2, 0.08, -40, 0.11, 0.04, 610, 0, false);
    box(palette.pavement, side * 32.5, 0.2, -40, 2.2, 0.4, 610);
    for (let z = -330; z <= 250; z += 9)
      box(palette.crossing, side * 26.4, 0.06, z, 0.13, 0.03, 3.8, 0, false);
    for (let z = -322; z < 252; z += 8) {
      box(palette.metal, side * 17.4, 2.8, z, 0.095, 1.4, 0.095);
      box(palette.metal, side * 17.4, 3.35, z + 4, 0.07, 0.07, 8);
    }
    for (let z = -298; z < 230; z += 33) {
      box(palette.grass, side * 20.3, 1.85, z, 2.65, 0.35, 5);
      // Small benches face the river.
      box(palette.bark, side * 19.5, 2.45, z + 7, 0.9, 0.22, 2.1);
      box(palette.bark, side * 20.05, 2.9, z + 7, 0.15, 1.15, 2.1);
      for (const offset of [-0.65, 0.65])
        box(palette.dark, side * 19.5, 2.05, z + 7 + offset, 0.65, 0.65, 0.12);
    }
  }

  const waterMaterial = new THREE.ShaderMaterial({
    fog: true,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0 },
        uDusk: { value: 1 },
        uDeep: { value: new THREE.Color(0x3b9eaa) },
        uShallow: { value: new THREE.Color(0x7fcac7) },
        uReflection: { value: new THREE.Color(0xf5bc79) },
      },
    ]),
    vertexShader: `varying vec3 vWorld;
      #include <fog_pars_vertex>
      void main(){vec4 wp=modelMatrix*vec4(position,1.);vWorld=wp.xyz;vec4 mvPosition=viewMatrix*wp;gl_Position=projectionMatrix*mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: `uniform float uTime; uniform float uDusk; uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uReflection; varying vec3 vWorld;
      #include <fog_pars_fragment>
      void main(){float wave=sin(vWorld.z*.37+uTime*.38+sin(vWorld.x*.39)*2.)*.5+.5;
      float ripple=sin(vWorld.z*1.6+vWorld.x*.22-uTime*.85)*sin(vWorld.x*.73+vWorld.z*.14);
      float streak=smoothstep(.90,.97,ripple);float bank=smoothstep(11.,16.,abs(vWorld.x));
      vec3 col=mix(uDeep,uShallow,.32+wave*.17+bank*.21);col=mix(col,vec3(.83,.94,.85),streak*.52);
      float reflection=exp(-pow((vWorld.x+5.+sin(vWorld.z*.032)*3.)/6.5,2.));
      col=mix(col,uReflection,reflection*(.17+uDusk*.27+step(.78,wave)*.16));
      gl_FragColor=vec4(col,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      #include <fog_fragment>
      }`,
  });
  materials.push(waterMaterial);
  const waterGeometry = new THREE.PlaneGeometry(32.8, 610);
  const water = new THREE.Mesh(waterGeometry, waterMaterial);
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, -0.14, -40);
  water.receiveShadow = true;
  group.add(water);
  // Graphic white dashes and quiet moorings catch the bright afternoon light.
  for (let i = 0; i < 95; i++)
    box(
      palette.waterLine,
      range(-13, 13),
      -0.1,
      range(-320, 245),
      range(0.4, 1.5),
      0.015,
      range(0.05, 0.12),
      0,
      false,
    );
  for (const z of [-208, -64, 87, 196]) {
    box(palette.bark, -13.4, 0.24, z, 4.9, 0.4, 7.5);
    for (const dz of [-3, 3])
      cylinder(palette.bark, -11.1, 0.85, z + dz, 0.13, 2);
    // A little cream sightseeing boat with teal canopy.
    box(palette.ivory, -8.3, 0.38, z, 2.6, 0.9, 6.9);
    box(palette.teal, -8.3, 1.36, z - 0.2, 2.1, 0.25, 4.4);
    box(palette.glassLight, -8.3, 0.94, z - 0.2, 1.9, 0.75, 4.1);
    box(palette.orange, -8.3, 0.7, z + 3.2, 1.8, 0.5, 0.24);
  }

  const signMeshes: THREE.Mesh[] = [];
  const makeSign = (
    text: string,
    accent: string,
    small = "",
    vertical = false,
  ) => {
    const canvas = document.createElement("canvas");
    canvas.width = vertical ? 128 : 512;
    canvas.height = vertical ? 512 : 192;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#f7edcf";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = accent;
    ctx.fillRect(7, 7, canvas.width - 14, canvas.height - 14);
    ctx.strokeStyle = "#fbf4dc";
    ctx.lineWidth = 3;
    ctx.strokeRect(16, 16, canvas.width - 32, canvas.height - 32);
    ctx.fillStyle = "#fff4d6";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (vertical) {
      ctx.font = '800 67px "Hiragino Kaku Gothic ProN", sans-serif';
      Array.from(text).forEach((char, i) =>
        ctx.fillText(char, 64, 76 + i * 92),
      );
    } else {
      ctx.font = '800 67px "Hiragino Kaku Gothic ProN", sans-serif';
      ctx.fillText(text, 256, 83, 450);
      ctx.font = "500 24px sans-serif";
      ctx.fillText(small, 256, 145, 440);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    textures.push(texture);
    const mat = new THREE.MeshBasicMaterial({ map: texture });
    materials.push(mat);
    return mat;
  };
  const signMaterials = [
    makeSign("青羽書店", "#397d7b", "AOBA BOOKS"),
    makeSign("喫茶 つばめ", "#b66f58", "COFFEE & SODA"),
    makeSign("さくら薬局", "#628f73", "SAKURA PHARMACY"),
    makeSign("空色電器", "#588b9b", "SORAIRO ELECTRIC"),
    makeSign("ひかり写真館", "#c88872", "HIKARI PHOTO"),
    makeSign("青空ホテル", "#5a8d89", "AOZORA HOTEL"),
  ];
  const verticalSigns = [
    makeSign("喫茶店", "#ac725b", "", true),
    makeSign("青羽堂", "#4b8d83", "", true),
    makeSign("写真館", "#be7770", "", true),
  ];
  const signGeometry = new THREE.PlaneGeometry(1, 1);
  const addSign = (
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    ry: number,
  ) => {
    const mesh = new THREE.Mesh(signGeometry, mat);
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, 1);
    mesh.rotation.y = ry;
    group.add(mesh);
    signMeshes.push(mesh);
  };

  function tree(x: number, z: number, pink: boolean, scale = 1, ground = 1.8) {
    const trunkH = range(2.4, 3.3) * scale;
    cylinder(palette.bark, x, ground + trunkH / 2, z, 0.15 * scale, trunkH);
    const top = ground + trunkH;
    for (let j = 0; j < 3; j++) {
      const angle = j * 2.094 + random();
      beam(
        palette.bark,
        V(x, top - 0.7 * scale, z),
        V(
          x + Math.cos(angle) * 1.1 * scale,
          top + 0.85 * scale,
          z + Math.sin(angle) * 1.1 * scale,
        ),
        0.1 * scale,
      );
    }
    for (let j = 0; j < 7; j++) {
      const angle = j * 2.39996;
      const r = j === 0 ? 0 : range(0.9, 1.55) * scale;
      sphere(
        pink
          ? choose([
              palette.sakura,
              palette.sakuraLight,
              palette.sakuraLight,
              palette.sakuraDark,
            ])
          : choose([palette.leaf, palette.green, palette.lightLeaf]),
        x + Math.cos(angle) * r,
        top + range(0.6, 1.6) * scale,
        z + Math.sin(angle) * r,
        range(1.2, 1.7) * scale,
        range(0.9, 1.3) * scale,
        range(1.2, 1.7) * scale,
      );
    }
  }
  for (const side of [-1, 1]) {
    for (let i = 0; i < 37; i++)
      tree(side * 20.2, -304 + i * 15.2, i % 5 !== 2, range(0.85, 1.22));
    for (let z = -294; z < 245; z += 27) {
      const x = side * 22.4;
      cylinder(palette.dark, x, 4.3, z, 0.085, 5.4);
      beam(palette.dark, V(x, 6.95, z), V(x - side * 1.5, 7.05, z), 0.09);
      box(palette.ivory, x - side * 1.4, 6.95, z, 0.9, 0.2, 0.52);
    }
  }

  const facadeColors = [
    palette.ivory,
    palette.milk,
    palette.apricot,
    palette.peach,
    palette.mint,
    palette.blue,
    palette.sage,
    palette.rose,
  ];
  function building(
    x: number,
    z: number,
    w: number,
    d: number,
    h: number,
    style: number,
    detail: boolean,
  ) {
    const base = 0.55;
    const wall = choose(facadeColors);
    const floorH = 3.15;
    const floors = Math.max(2, Math.floor(h / floorH));
    h = floors * floorH;
    box(wall, x, base + h / 2, z, w, h, d);
    colliders.push({ x, y: base + h / 2, z, hx: w / 2, hy: h / 2, hz: d / 2 });
    outlineBox(x, base + h / 2, z, w + 0.02, h + 0.02, d + 0.02);
    box(palette.roof, x, base + h + 0.05, z, w + 0.34, 0.32, d + 0.34);
    box(palette.trim, x, base + h + 0.31, z, w + 0.75, 0.26, d + 0.75);
    // White roof coping and parapets make the silhouettes architectural.
    for (const side of [-1, 1]) {
      box(wall, x + side * (w / 2 - 0.18), base + h + 0.77, z, 0.28, 1.05, d);
      box(wall, x, base + h + 0.77, z + side * (d / 2 - 0.18), w, 1.05, 0.28);
      box(palette.trim, x + (side * w) / 2, base + 0.2, z, 0.28, 0.44, d + 0.2);
    }
    if (style === 1 || style === 3) {
      for (let f = 1; f < floors; f++)
        box(palette.trim, x, base + f * floorH, z, w + 0.32, 0.16, d + 0.32);
    }
    // Separate windows and balcony slabs on the canal-facing façades.
    const side = x > 0 ? -1 : 1;
    const faceX = x + side * (w / 2 + 0.055);
    const zCols = Math.max(2, Math.floor(d / 3.3));
    const winSpacing = d / (zCols + 0.35);
    for (let f = 0; f < floors; f++) {
      const cy = base + f * floorH + 1.8;
      for (let c = 0; c < zCols; c++) {
        const wz = z + (c - (zCols - 1) / 2) * winSpacing;
        const glass =
          (f + c) % 9 === 0
            ? palette.windowWarm
            : (f + c) % 4 === 0
              ? palette.glassLight
              : palette.glass;
        box(
          glass,
          faceX,
          cy,
          wz,
          0.1,
          style === 2 ? 2.12 : 1.63,
          winSpacing * 0.59,
          0,
          false,
        );
        if (detail) {
          box(
            palette.trim,
            faceX + side * 0.06,
            cy + 0.88,
            wz,
            0.19,
            0.11,
            winSpacing * 0.72,
            0,
            false,
          );
          box(
            palette.trim,
            faceX + side * 0.08,
            cy - 0.9,
            wz,
            0.26,
            0.17,
            winSpacing * 0.75,
          );
          if (style === 0 || style === 3) {
            box(
              palette.trim,
              faceX + side * 0.53,
              cy - 1.13,
              wz,
              1.25,
              0.16,
              winSpacing * 0.87,
            );
            box(
              style === 3 ? palette.teal : palette.milk,
              faceX + side * 1.1,
              cy - 0.72,
              wz,
              0.13,
              0.8,
              winSpacing * 0.87,
            );
            for (const dz of [-0.4, 0.4])
              box(
                palette.trim,
                faceX + side * 0.63,
                cy - 0.72,
                wz + dz * winSpacing,
                1.1,
                0.8,
                0.1,
              );
          }
          if (c === zCols - 1 && f % 2 === 0) {
            box(
              palette.ivory,
              faceX + side * 0.22,
              cy - 0.57,
              wz + winSpacing * 0.42,
              0.43,
              0.59,
              0.8,
            );
            for (let l = 0; l < 3; l++)
              box(
                palette.stone,
                faceX + side * 0.45,
                cy - 0.72 + l * 0.12,
                wz + winSpacing * 0.42,
                0.015,
                0.025,
                0.56,
                0,
                false,
              );
          }
        }
      }
    }
    const xCols = Math.max(2, Math.floor(w / 3.7));
    for (const front of [-1, 1]) {
      const faceZ = z + front * (d / 2 + 0.04);
      for (let f = 0; f < floors; f++)
        for (let c = 0; c < xCols; c++) {
          const wx = x + (c - (xCols - 1) / 2) * (w / (xCols + 0.4));
          box(
            (f + c) % 5 === 0 ? palette.glassLight : palette.glass,
            wx,
            base + f * floorH + 1.76,
            faceZ,
            (w / (xCols + 0.4)) * 0.6,
            1.68,
            0.08,
            0,
            false,
          );
          if (detail)
            box(
              palette.trim,
              wx,
              base + f * floorH + 0.86,
              faceZ + front * 0.1,
              (w / (xCols + 0.4)) * 0.71,
              0.13,
              0.33,
            );
        }
      if (style === 2)
        for (let c = 0; c < xCols + 1; c++) {
          box(
            palette.trim,
            x + (c - xCols / 2) * (w / (xCols + 0.4)),
            base + h / 2,
            faceZ + front * 0.1,
            0.23,
            h,
            0.22,
          );
        }
    }
    // Lift housing, tanks, solar panels and aerials are visible throughout flight.
    const roofY = base + h + 0.7;
    box(wall, x + w * 0.22, roofY + 1.5, z - d * 0.18, w * 0.31, 3, d * 0.32);
    box(
      palette.roofLight,
      x + w * 0.22,
      roofY + 3.05,
      z - d * 0.18,
      w * 0.33,
      0.18,
      d * 0.34,
    );
    if (random() < 0.63) {
      const tankX = x - w * 0.2,
        tankZ = z - d * 0.2;
      for (const a of [-1, 1])
        for (const b of [-1, 1])
          box(
            palette.dark,
            tankX + a * 0.8,
            roofY + 0.65,
            tankZ + b * 0.8,
            0.1,
            1.3,
            0.1,
          );
      cylinder(palette.ivory, tankX, roofY + 2.2, tankZ, 1.4, 2.1);
      cylinder(palette.roofLight, tankX, roofY + 3.28, tankZ, 1.47, 0.13);
      cylinder(palette.roofLight, tankX, roofY + 1.12, tankZ, 1.47, 0.12);
    }
    if (random() < 0.6) {
      for (let k = 0; k < 2; k++) {
        box(
          palette.dark,
          x - w * 0.18 + k * 2.8,
          roofY + 0.4,
          z + d * 0.24,
          2.35,
          0.16,
          2.7,
        );
        for (let line = 0; line < 3; line++)
          box(
            palette.glassLight,
            x - w * 0.18 + k * 2.8 - 0.7 + line * 0.7,
            roofY + 0.49,
            z + d * 0.24,
            0.025,
            0.018,
            2.6,
            0,
            false,
          );
      }
    }
    for (let a = 0; a < (detail ? 2 : 1); a++) {
      const ax = x + range(-w * 0.3, w * 0.3),
        az = z + range(-d * 0.3, d * 0.3);
      box(palette.ivory, ax, roofY + 0.45, az, 1.6, 0.9, 1.1);
      box(palette.stone, ax, roofY + 0.92, az, 1.35, 0.03, 0.85);
    }
    if (detail && random() < 0.55) {
      cylinder(
        palette.dark,
        x + w * 0.3,
        roofY + 4.25,
        z + d * 0.31,
        0.045,
        5.6,
      );
      for (let k = 0; k < 3; k++)
        box(
          palette.dark,
          x + w * 0.3,
          roofY + 4.7 + k * 0.52,
          z + d * 0.31,
          1.7 - k * 0.3,
          0.045,
          0.045,
        );
    }
    // Plants and rooftop laundry add a lived-in, hand-built scale.
    if (detail && random() < 0.5) {
      box(
        palette.peach,
        x - w * 0.27,
        roofY + 0.25,
        z + d * 0.26,
        w * 0.31,
        0.5,
        1.25,
      );
      for (let k = 0; k < 4; k++)
        sphere(
          palette.green,
          x - w * 0.39 + k * w * 0.08,
          roofY + 0.8,
          z + d * 0.26,
          0.65,
          0.75,
          0.65,
        );
    }
    if (detail && style === 0) {
      const lx = x - w * 0.25,
        lz = z + d * 0.3;
      cylinder(palette.metal, lx, roofY + 1.6, lz, 0.045, 2.5);
      cylinder(palette.metal, lx + 4, roofY + 1.6, lz, 0.045, 2.5);
      box(palette.metal, lx + 2, roofY + 2.6, lz, 4.1, 0.04, 0.04);
      for (let k = 0; k < 3; k++)
        box(
          k === 1 ? palette.blue : palette.white,
          lx + 0.7 + k * 1.25,
          roofY + 1.9,
          lz,
          0.85,
          1.35,
          0.045,
          0,
          false,
        );
    }
    if (detail && random() < 0.64) {
      // Ground-floor storefronts and striped canvas awnings.
      box(
        palette.glass,
        faceX + side * 0.02,
        base + 1.35,
        z,
        0.14,
        2.4,
        d * 0.72,
        0,
        false,
      );
      box(
        choose([palette.teal, palette.orange, palette.red]),
        faceX + side * 0.65,
        base + 3.1,
        z,
        1.5,
        0.35,
        d * 0.76,
      );
      for (let stripe = 0; stripe < Math.floor(d * 0.4); stripe++)
        box(
          palette.trim,
          faceX + side * 0.65,
          base + 3.3,
          z - d * 0.35 + stripe * 2,
          1.5,
          0.07,
          0.6,
          0,
          false,
        );
      if (random() < 0.7)
        addSign(
          choose(signMaterials),
          faceX + side * 0.2,
          base + 4.2,
          z,
          d * 0.63,
          1.55,
          (side * Math.PI) / 2,
        );
      if (random() < 0.25) {
        box(
          palette.trim,
          faceX + side * 0.8,
          base + 7,
          z + d * 0.38,
          0.38,
          4.5,
          1.32,
        );
        addSign(
          choose(verticalSigns),
          faceX + side * 1.01,
          base + 7,
          z + d * 0.38,
          1.15,
          4.3,
          (side * Math.PI) / 2,
        );
      }
    }
  }

  for (const side of [-1, 1])
    for (let row = 0; row < 4; row++)
      for (let block = 0; block < 15; block++) {
        const z = -260 + block * 35;
        const cx = side * (46 + row * 43 + range(-2.4, 2.4));
        const w = range(row === 0 ? 15 : 19, row === 0 ? 22 : 31),
          d = range(22, 28);
        if (side === 1 && Math.abs(cx - 123) < 36 && Math.abs(z + 130) < 38) {
          box(palette.pavement, cx, 0.22, z, 38, 0.45, 31);
          box(palette.grass, cx, 0.65, z, 33, 0.35, 27);
          for (const sideZ of [-1, 1])
            tree(cx + 12, z + sideZ * 10, false, 1, 0.9);
          continue;
        }
        let h = range(12 + row * 7, 29 + row * 14);
        if (block === 8 && row === 0) h = 13;
        box(palette.pavement, cx, 0.22, z, 38, 0.45, 31);
        building(cx, z, w, d, h, Math.floor(random() * 4), row < 2);
        if (row < 2) {
          for (const end of [-1, 1])
            tree(cx + side * (w / 2 + 3), z + end * d * 0.3, false, 0.63, 0.5);
          // Garden planters bordering the side streets.
          box(palette.green, cx, 0.8, z + d / 2 + 1.7, w * 0.85, 0.7, 1.4);
        }
      }
  // Distant blocks use fewer details but keep stepped, varied silhouettes.
  for (let i = 0; i < 35; i++) {
    const x = -300 + i * 18 + range(-4, 4),
      z = -363 - range(0, 95),
      w = range(12, 23),
      h = range(35, 110);
    const mat = choose([
      palette.blue,
      palette.mint,
      palette.milk,
      palette.sage,
    ]);
    box(mat, x, h / 2, z, w, h, range(16, 28));
    box(palette.roofLight, x, h + 3, z, w * 0.65, 6, 14);
    for (let f = 5; f < h; f += 5.6)
      box(palette.glassLight, x, f, z + 14.1, w * 0.8, 0.7, 0.08, 0, false);
    if (i % 5 === 0) cylinder(palette.roof, x, h + 9, z, 0.22, 15);
  }
  // Side-street road markings, vending machines, utility poles and overhead cables.
  const wireVertices: number[] = [];
  function wire(a: THREE.Vector3, b: THREE.Vector3, sag: number) {
    let previous = a.clone();
    for (let i = 1; i <= 12; i++) {
      const t = i / 12,
        p = a.clone().lerp(b, t);
      p.y -= Math.sin(t * Math.PI) * sag;
      wireVertices.push(...previous.toArray(), ...p.toArray());
      previous = p;
    }
  }
  for (const side of [-1, 1]) {
    for (let i = 0; i < 15; i++) {
      const z = -242.5 + i * 35;
      for (let stripe = 0; stripe < 6; stripe++)
        box(
          palette.crossing,
          side * 26.6,
          0.07,
          z - 2.8 + stripe * 1.04,
          7.1,
          0.025,
          0.53,
          0,
          false,
        );
      for (let k = 0; k < 5; k++)
        box(
          palette.crossing,
          side * (39 + k * 2),
          0.08,
          z,
          1.15,
          0.025,
          4.5,
          0,
          false,
        );
      const px = side * 33.9;
      cylinder(palette.stone, px, 5.1, z, 0.14, 10.2);
      box(palette.dark, px, 9.55, z, 2.5, 0.13, 0.14);
      for (const cross of [-0.8, 0, 0.8]) {
        cylinder(palette.ivory, px + cross, 9.83, z, 0.11, 0.45);
        if (i < 14)
          wire(V(px + cross, 10.05, z), V(px + cross, 10.05, z + 35), 1.15);
      }
      if (i % 2 === 0) {
        box(palette.red, side * 34.7, 1.35, z - 4, 1.1, 2.7, 0.85);
        box(
          palette.glassLight,
          side * 34.7 - side * 0.56,
          1.55,
          z - 4,
          0.025,
          1.9,
          0.67,
          0,
          false,
        );
        for (let v = 0; v < 4; v++)
          box(
            palette.white,
            side * 34.7 - side * 0.58,
            1 + v * 0.38,
            z - 4,
            0.03,
            0.12,
            0.5,
            0,
            false,
          );
      }
    }
  }

  function bridge(z: number, railway = false) {
    const width = railway ? 8.5 : 10;
    const top = railway ? 6.8 : 4.8;
    box(palette.stone, 0, top - 0.8, z, 78, 1.5, width);
    box(
      railway ? palette.roofLight : palette.street,
      0,
      top,
      z,
      78,
      0.22,
      width - 0.45,
    );
    colliders.push({ x: 0, y: top - 0.75, z, hx: 39, hy: 0.9, hz: width / 2 });
    for (const x of [-15, 15]) {
      box(palette.concrete, x, top / 2 - 0.7, z, 2.1, top + 1.4, width - 0.6);
      box(palette.trim, x, top - 1.3, z, 3.7, 0.8, width);
    }
    for (const s of [-1, 1]) {
      box(
        palette.trim,
        0,
        top + 0.24,
        z + s * (width / 2 - 0.3),
        78,
        0.35,
        0.45,
      );
      box(
        railway ? palette.teal : palette.mint,
        0,
        top + 1.22,
        z + s * (width / 2 - 0.32),
        78,
        0.15,
        0.18,
      );
      for (let x = -38; x <= 38; x += 2.4)
        box(
          railway ? palette.teal : palette.mint,
          x,
          top + 0.8,
          z + s * (width / 2 - 0.32),
          0.12,
          1.04,
          0.12,
        );
    }
    if (railway) {
      for (const rail of [-2.2, -1.1, 1.1, 2.2])
        box(palette.dark, 0, top + 0.2, z + rail, 78, 0.14, 0.13);
      for (let x = -37; x < 39; x += 1.2)
        box(palette.bark, x, top + 0.12, z, 0.24, 0.09, 5.6);
      for (const x of [-29, -9, 11, 31]) {
        for (const s of [-1, 1])
          box(palette.metal, x, top + 2.8, z + s * 3.7, 0.16, 5.2, 0.16);
        box(palette.metal, x, top + 5.2, z, 0.15, 0.15, 7.5);
      }
      for (const s of [-1, 1])
        wire(V(-40, top + 5, z + s * 1.7), V(40, top + 5, z + s * 1.7), 0.15);
    } else {
      for (let x = -34; x < 37; x += 8)
        box(palette.crossing, x, top + 0.14, z, 3.8, 0.025, 0.11, 0, false);
      // A low arch rises above the parapet, never into the primary flight lane.
      for (const s of [-1, 1]) {
        let last = V(-17, top + 0.8, z + s * (width / 2 - 0.4));
        for (let k = 1; k <= 12; k++) {
          const u = k / 12,
            x = -17 + u * 34,
            y = top + 0.8 + Math.sin(u * Math.PI) * 4;
          const next = V(x, y, z + s * (width / 2 - 0.4));
          beam(palette.mint, last, next, 0.38);
          last = next;
          box(
            palette.mint,
            x,
            (y + top + 0.3) / 2,
            z + s * (width / 2 - 0.4),
            0.09,
            y - top - 0.3,
            0.09,
          );
        }
      }
    }
  }
  bridge(61);
  bridge(-81);
  bridge(-186, true);
  bridge(204);

  // Tokyo-inspired steel observation tower: four flared legs, lattice bracing,
  // cream observation decks and a striped needle, constructed from real beams.
  const tx = 123,
    tz = -130;
  box(palette.pavement, tx, 0.5, tz, 47, 1, 47);
  box(palette.grass, tx, 0.8, tz, 40, 0.35, 40);
  const levels = [
    { y: 1, r: 18 },
    { y: 17, r: 12 },
    { y: 34, r: 8.2 },
    { y: 53, r: 5.6 },
    { y: 71, r: 3.6 },
    { y: 88, r: 1.8 },
  ];
  for (let level = 0; level < levels.length - 1; level++) {
    const a = levels[level],
      b = levels[level + 1];
    for (const sx of [-1, 1])
      for (const sz of [-1, 1])
        beam(
          palette.orange,
          V(tx + sx * a.r, a.y, tz + sz * a.r),
          V(tx + sx * b.r, b.y, tz + sz * b.r),
          level < 2 ? 0.9 : 0.65,
        );
    for (let face = 0; face < 4; face++) {
      const coords = (r: number, y: number, t: number) =>
        face === 0
          ? V(tx + t * r, y, tz - r)
          : face === 1
            ? V(tx + r, y, tz + t * r)
            : face === 2
              ? V(tx - t * r, y, tz + r)
              : V(tx - r, y, tz - t * r);
      beam(palette.orange, coords(a.r, a.y, -1), coords(a.r, a.y, 1), 0.55);
      beam(palette.orange, coords(a.r, a.y, -1), coords(b.r, b.y, 1), 0.34);
      beam(palette.orange, coords(a.r, a.y, 1), coords(b.r, b.y, -1), 0.34);
      const my = (a.y + b.y) / 2,
        mr = (a.r + b.r) / 2;
      beam(palette.orange, coords(mr, my, -1), coords(mr, my, 1), 0.38);
    }
  }
  for (const y of [35, 73]) {
    const w = y === 35 ? 19 : 10;
    box(palette.orange, tx, y, tz, w + 1, 0.9, w + 1);
    box(palette.ivory, tx, y + 1.35, tz, w, 2.5, w);
    box(palette.glass, tx, y + 1.6, tz, w + 0.08, 1.1, w + 0.08);
    box(palette.ivory, tx, y + 2.85, tz, w + 1.1, 0.5, w + 1.1);
    for (const s of [-1, 1])
      for (let n = -3; n <= 3; n++) {
        box(
          palette.trim,
          tx + (n * w) / 7,
          y + 1.55,
          tz + s * (w / 2 + 0.08),
          0.13,
          1.4,
          0.14,
        );
        box(
          palette.trim,
          tx + s * (w / 2 + 0.08),
          y + 1.55,
          tz + (n * w) / 7,
          0.14,
          1.4,
          0.13,
        );
      }
  }
  for (let i = 0; i < 7; i++)
    cylinder(
      i % 2 === 0 ? palette.ivory : palette.orange,
      tx,
      89 + i * 4.2,
      tz,
      Math.max(0.13, 1 - i * 0.135),
      4.2,
    );
  cylinder(palette.dark, tx, 119, tz, 0.11, 7);
  colliders.push({ x: tx, y: 49, z: tz, hx: 4.5, hy: 41, hz: 4.5 });
  colliders.push({ x: tx, y: 36.7, z: tz, hx: 10, hy: 2, hz: 10 });
  colliders.push({ x: tx, y: 74.7, z: tz, hx: 5.5, hy: 2, hz: 5.5 });
  for (const s of [-1, 1]) tree(tx + s * 21, tz + 21, false, 1.6, 0.7);
  // A pale clock tower and elevated rooftop shrine punctuate the neighborhood.
  box(palette.ivory, -58, 21, -104, 9, 42, 10);
  box(palette.mint, -58, 43, -104, 10, 2, 11);
  shape("cone", palette.teal, -58, 48, -104, 7, 9, 7, 0, Math.PI / 4);
  const clockCanvas = document.createElement("canvas");
  clockCanvas.width = 128;
  clockCanvas.height = 128;
  const clockCtx = clockCanvas.getContext("2d")!;
  clockCtx.fillStyle = "#f5edce";
  clockCtx.beginPath();
  clockCtx.arc(64, 64, 57, 0, Math.PI * 2);
  clockCtx.fill();
  clockCtx.strokeStyle = "#496677";
  clockCtx.lineWidth = 7;
  clockCtx.stroke();
  clockCtx.lineWidth = 3;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    clockCtx.beginPath();
    clockCtx.moveTo(64 + Math.sin(a) * 44, 64 - Math.cos(a) * 44);
    clockCtx.lineTo(64 + Math.sin(a) * 50, 64 - Math.cos(a) * 50);
    clockCtx.stroke();
  }
  clockCtx.lineWidth = 5;
  clockCtx.beginPath();
  clockCtx.moveTo(43, 50);
  clockCtx.lineTo(64, 64);
  clockCtx.lineTo(64, 29);
  clockCtx.stroke();
  const clockTexture = new THREE.CanvasTexture(clockCanvas);
  clockTexture.colorSpace = THREE.SRGBColorSpace;
  textures.push(clockTexture);
  const clockMaterial = new THREE.MeshBasicMaterial({
    map: clockTexture,
    transparent: true,
  });
  materials.push(clockMaterial);
  addSign(clockMaterial, -53.42, 36.5, -104, 5.8, 5.8, Math.PI / 2);
  colliders.push({ x: -58, y: 22, z: -104, hx: 5, hy: 24, hz: 5.5 });

  // Static mesh submission: roughly 80 batches for thousands of details.
  for (const batch of batches.values()) {
    const mesh = new THREE.InstancedMesh(
      geometries[batch.shape],
      batch.material,
      batch.matrices.length,
    );
    batch.matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = batch.shadow;
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    group.add(mesh);
  }
  const edgeGeometry = new THREE.BufferGeometry();
  edgeGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(edgeVertices, 3),
  );
  const edgeMaterial = new THREE.LineBasicMaterial({
    color: 0x335664,
    transparent: true,
    opacity: 0.27,
  });
  materials.push(edgeMaterial);
  group.add(new THREE.LineSegments(edgeGeometry, edgeMaterial));
  const wireGeometry = new THREE.BufferGeometry();
  wireGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(wireVertices, 3),
  );
  const wireMaterial = new THREE.LineBasicMaterial({
    color: 0x52616a,
    transparent: true,
    opacity: 0.65,
  });
  materials.push(wireMaterial);
  group.add(new THREE.LineSegments(wireGeometry, wireMaterial));

  // Moving city life uses three instanced passes, independent of the game simulation.
  const carCount = 22;
  const carBody = new THREE.InstancedMesh(
    geometries.box,
    palette.white,
    carCount,
  );
  const carCabin = new THREE.InstancedMesh(
    geometries.box,
    palette.glass,
    carCount,
  );
  const carWheels = new THREE.InstancedMesh(
    geometries.box,
    palette.dark,
    carCount * 2,
  );
  [carBody, carCabin, carWheels].forEach((mesh) => {
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    group.add(mesh);
  });
  const carState = Array.from({ length: carCount }, (_, i) => ({
    side: i % 2 === 0 ? 1 : -1,
    lane: i % 3 === 0 ? 1 : 0,
    z: range(-300, 240),
    speed: range(3.2, 7),
    length: range(2.8, 4.1),
  }));
  carState.forEach((_, i) =>
    carBody.setColorAt(
      i,
      new THREE.Color(
        choose([0xf4e9c9, 0xef987b, 0x7baea9, 0xb5d0bc, 0xe5be73]),
      ),
    ),
  );
  const transform = (
    mesh: THREE.InstancedMesh,
    i: number,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
  ) => {
    dummy.position.set(x, y, z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(w, h, d);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  };

  const train = new THREE.Group();
  train.position.set(-70, 7.62, -186);
  group.add(train);
  const trainGeometries: THREE.BufferGeometry[] = [];
  const trainPart = (
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
  ) => {
    const geom = new THREE.BoxGeometry(w, h, d);
    trainGeometries.push(geom);
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    train.add(mesh);
  };
  for (let c = 0; c < 3; c++) {
    const x = c * 11.3;
    trainPart(palette.ivory, x, 1.1, 0, 10.7, 2.5, 2.45);
    trainPart(palette.teal, x, 0.7, 0, 10.78, 0.43, 2.5);
    trainPart(palette.roofLight, x, 2.44, 0, 10.4, 0.32, 2.35);
    trainPart(palette.dark, x, -0.13, 0, 8.1, 0.45, 1.8);
    for (let k = 0; k < 5; k++)
      for (const s of [-1, 1])
        trainPart(
          palette.glass,
          x - 4 + k * 2,
          1.7,
          s * 1.235,
          1.5,
          0.77,
          0.04,
        );
  }

  // A modest number of drifting blossom flecks bring motion to the foreground.
  const petalGeometry = new THREE.PlaneGeometry(0.1, 0.18);
  const petalMaterial = new THREE.MeshBasicMaterial({
    color: 0xffd2d5,
    side: THREE.DoubleSide,
  });
  materials.push(petalMaterial);
  const petals = new THREE.InstancedMesh(petalGeometry, petalMaterial, 110);
  petals.frustumCulled = false;
  group.add(petals);
  const petalState = Array.from({ length: 110 }, () => ({
    x: range(-23, 23),
    y: range(3, 28),
    z: range(-240, 220),
    phase: range(0, Math.PI * 2),
    speed: range(0.2, 0.7),
  }));
  const update = (time: number, delta: number) => {
    waterMaterial.uniforms.uTime.value = time;
    for (let i = 0; i < carCount; i++) {
      const car = carState[i];
      car.z += delta * car.speed * car.side;
      if (car.z > 259) car.z = -338;
      if (car.z < -340) car.z = 258;
      const x = car.side * (car.lane === 0 ? 24.8 : 29.1);
      transform(carBody, i, x, 0.88, car.z, 1.55, 0.77, car.length);
      transform(
        carCabin,
        i,
        x,
        1.48,
        car.z - 0.18 * car.side,
        1.37,
        0.65,
        car.length * 0.54,
      );
      for (let a = 0; a < 2; a++)
        transform(
          carWheels,
          i * 2 + a,
          x,
          0.49,
          car.z + (a === 0 ? -0.31 : 0.31) * car.length,
          1.71,
          0.42,
          0.47,
        );
    }
    carBody.instanceMatrix.needsUpdate = true;
    carCabin.instanceMatrix.needsUpdate = true;
    carWheels.instanceMatrix.needsUpdate = true;
    train.position.x = ((time * 5.4 + 35) % 250) - 150;
    for (let i = 0; i < petalState.length; i++) {
      const p = petalState[i];
      dummy.position.set(
        p.x + Math.sin(time * 0.3 + p.phase) * 3,
        3 + ((((p.y - time * p.speed) % 25) + 25) % 25),
        p.z + Math.sin(time * 0.16 + p.phase) * 7,
      );
      dummy.rotation.set(time * 0.9 + p.phase, time * 0.4 + p.phase, p.phase);
      dummy.scale.setScalar(1 + Math.sin(p.phase) * 0.3);
      dummy.updateMatrix();
      petals.setMatrixAt(i, dummy.matrix);
    }
    petals.instanceMatrix.needsUpdate = true;
  };
  const originalColors = new Map<THREE.MeshToonMaterial, THREE.Color>();
  Object.values(palette).forEach((material) =>
    originalColors.set(material, material.color.clone()),
  );
  const warmFacadeMaterials = [
    palette.ivory,
    palette.milk,
    palette.peach,
    palette.apricot,
    palette.concrete,
    palette.pavement,
    palette.trim,
    palette.white,
  ];
  const sunsetTint = new THREE.Color(0xf5c6a1);
  const setTimeOfDay = (mode: "morning" | "sunset") => {
    const dusk = mode === "sunset";
    originalColors.forEach((color, material) => material.color.copy(color));
    if (dusk)
      warmFacadeMaterials.forEach((material) =>
        material.color.lerp(sunsetTint, 0.16),
      );
    palette.dark.color.set(dusk ? 0x4b526e : 0x364f61);
    palette.roof.color.set(dusk ? 0x838497 : 0x778f91);
    palette.street.color.set(dusk ? 0x8f939f : 0x829b9f);
    palette.glass.color.set(dusk ? 0x687b92 : 0x45788d);
    palette.glassLight.color.set(dusk ? 0xb8c7c6 : 0x92d6da);
    palette.windowWarm.color.set(dusk ? 0xffd291 : 0xf1dab0);
    palette.windowWarm.emissive.set(dusk ? 0xf2a14f : 0x725d22);
    palette.windowWarm.emissiveIntensity = dusk ? 0.34 : 0.13;
    waterMaterial.uniforms.uDusk.value = dusk ? 1 : 0;
    waterMaterial.uniforms.uDeep.value.set(dusk ? 0x688c9b : 0x3b9eaa);
    waterMaterial.uniforms.uShallow.value.set(dusk ? 0xb8b5a4 : 0x7fcac7);
    waterMaterial.uniforms.uReflection.value.set(dusk ? 0xf7b975 : 0xe6ede0);
    edgeMaterial.color.set(dusk ? 0x55536d : 0x335664);
  };
  setTimeOfDay("sunset");
  update(0, 0);
  return {
    colliders,
    update,
    setTimeOfDay,
    dispose: () => {
      scene.remove(group);
      group.traverse((object) => {
        if (object instanceof THREE.InstancedMesh) object.dispose();
      });
      Object.values(geometries).forEach((geometry) => geometry.dispose());
      [
        waterGeometry,
        signGeometry,
        edgeGeometry,
        wireGeometry,
        petalGeometry,
        ...trainGeometries,
      ].forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      textures.forEach((texture) => texture.dispose());
    },
  };
}
