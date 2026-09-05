import * as THREE from "three";

export function createSky(scene: THREE.Scene) {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color("#617f9b") },
      middle: { value: new THREE.Color("#e5a7a3") },
      bottom: { value: new THREE.Color("#ffd7a0") },
      sunDirection: { value: new THREE.Vector3(-150, 125, -420).normalize() },
    },
    vertexShader: `varying vec3 vWorld;void main(){vWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `varying vec3 vWorld;uniform vec3 top;uniform vec3 middle;uniform vec3 bottom;uniform vec3 sunDirection;
      void main(){vec3 d=normalize(vWorld);float h=max(d.y,0.);vec3 c=mix(bottom,middle,smoothstep(0.,.32,h));c=mix(c,top,smoothstep(.25,.85,h));float sun=max(dot(d,sunDirection),0.);c+=vec3(.24,.13,.015)*pow(sun,20.);gl_FragColor=vec4(c,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1400, 32, 24), material);
  dome.renderOrder = -20;
  scene.add(dome);
  // The disc sits in the distant sky, rather than intersecting the city blocks.
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(71, 96),
    new THREE.MeshBasicMaterial({
      color: "#fff1b5",
      fog: false,
      depthWrite: false,
    }),
  );
  sun.position.set(-150, 125, -420).multiplyScalar(2.45);
  sun.lookAt(0, 30, 80);
  sun.renderOrder = -10;
  scene.add(sun);
  const haloCanvas = document.createElement("canvas");
  haloCanvas.width = 256;
  haloCanvas.height = 256;
  const hc = haloCanvas.getContext("2d")!;
  const grad = hc.createRadialGradient(128, 128, 10, 128, 128, 128);
  grad.addColorStop(0, "rgba(255,215,143,.48)");
  grad.addColorStop(0.35, "rgba(255,196,125,.20)");
  grad.addColorStop(1, "rgba(255,179,108,0)");
  hc.fillStyle = grad;
  hc.fillRect(0, 0, 256, 256);
  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(haloCanvas),
      transparent: true,
      depthWrite: false,
      fog: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  halo.position.copy(sun.position).multiplyScalar(0.98);
  halo.scale.set(440, 440, 1);
  scene.add(halo);
  let seed = 17;
  const rnd = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  function cloudTexture(variant: number, morning = false) {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 512;
    const c = canvas.getContext("2d")!;
    let cloudSeed = 137 + variant * 9127;
    const rand = () => {
      cloudSeed = (Math.imul(cloudSeed, 1664525) + 1013904223) >>> 0;
      return cloudSeed / 4294967296;
    };
    type Lobe = { x: number; y: number; rx: number; ry: number };
    const lobes: Lobe[] = [];
    for (let i = 0; i < 11; i++) {
      const t = i / 10,
        hill = Math.pow(Math.sin(t * Math.PI), 1.6);
      lobes.push({
        x: 140 + t * 730,
        y: 310 - hill * (104 + variant * 13) + (rand() - 0.5) * 33,
        rx: 61 + rand() * 37,
        ry: 45 + hill * 42 + rand() * 19,
      });
    }
    // Small lower lobes give the cloud an irregular, scalloped underside.
    for (let i = 0; i < 7; i++)
      lobes.push({
        x: 224 + i * 91,
        y: 316 + (rand() - 0.5) * 27,
        rx: 66 + rand() * 24,
        ry: 31 + rand() * 20,
      });
    const silhouette = new Path2D();
    for (const l of lobes) {
      silhouette.moveTo(l.x + l.rx, l.y);
      silhouette.ellipse(l.x, l.y, l.rx, l.ry, 0, 0, Math.PI * 2);
      silhouette.closePath();
    }
    c.save();
    c.clip(silhouette);
    const body = c.createLinearGradient(0, 115, 0, 390);
    body.addColorStop(0, morning ? "#fff9e7" : "#fff0cd");
    body.addColorStop(0.52, morning ? "#e6eeee" : "#f9d6bf");
    body.addColorStop(1, morning ? "#9cbacb" : "#ac91ad");
    c.fillStyle = body;
    c.fillRect(0, 0, 1024, 512);
    // Painted interior shadows. Every ellipse starts its own subpath, avoiding
    // the straight connecting polygons produced by a chain of Canvas ellipses.
    lobes.slice(4).forEach((l, i) => {
      c.beginPath();
      c.ellipse(
        l.x + 17,
        l.y + 25,
        l.rx * 0.97,
        l.ry * 0.64,
        0,
        0,
        Math.PI * 2,
      );
      c.fillStyle = morning ? "rgba(127,164,186,.23)" : "rgba(159,121,161,.22)";
      c.fill();
      if (i % 2 === 0) {
        c.beginPath();
        c.ellipse(
          l.x + 27,
          l.y + 39,
          l.rx * 0.64,
          l.ry * 0.41,
          0,
          0,
          Math.PI * 2,
        );
        c.fillStyle = morning
          ? "rgba(128,166,189,.18)"
          : "rgba(150,115,160,.16)";
        c.fill();
      }
    });
    // Sunlit cauliflower lobes are left bright on their upper-left edges.
    lobes.slice(0, 11).forEach((l, i) => {
      const glow = c.createRadialGradient(
        l.x - l.rx * 0.35,
        l.y - l.ry * 0.47,
        2,
        l.x - 8,
        l.y - 18,
        l.rx * 1.05,
      );
      glow.addColorStop(
        0,
        morning ? "rgba(255,254,237,.93)" : "rgba(255,242,207,.96)",
      );
      glow.addColorStop(
        0.62,
        morning ? "rgba(252,249,229,.57)" : "rgba(255,229,193,.59)",
      );
      glow.addColorStop(1, "rgba(255,234,206,0)");
      c.fillStyle = glow;
      c.beginPath();
      c.ellipse(l.x - 9, l.y - 18, l.rx * 0.92, l.ry * 0.91, 0, 0, Math.PI * 2);
      c.fill();
      if (i > 2 && i < 8) {
        c.fillStyle = morning
          ? "rgba(255,252,231,.45)"
          : "rgba(255,239,202,.47)";
        c.beginPath();
        c.ellipse(
          l.x - l.rx * 0.21,
          l.y - l.ry * 0.45,
          l.rx * 0.47,
          l.ry * 0.37,
          -0.25,
          0,
          Math.PI * 2,
        );
        c.fill();
      }
    });
    c.restore();
    // Delicate detached wisps remain safely inside the transparent padding.
    c.fillStyle = morning ? "rgba(231,241,238,.63)" : "rgba(247,217,204,.59)";
    for (let i = 0; i < 3; i++) {
      c.beginPath();
      c.ellipse(
        212 + i * 213,
        408 + Math.sin(i) * 9,
        83 + rand() * 25,
        5 + rand() * 4,
        -0.025,
        0,
        Math.PI * 2,
      );
      c.fill();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }
  const textures = [cloudTexture(0), cloudTexture(1), cloudTexture(2)];
  const morningTextures = [
    cloudTexture(0, true),
    cloudTexture(1, true),
    cloudTexture(2, true),
  ];
  const clouds: THREE.Sprite[] = [];
  const cloudOrigins: number[] = [];
  for (let i = 0; i < 25; i++) {
    const a = (i / 25) * Math.PI * 2,
      radius = 660 + rnd() * 170;
    const cloud = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: textures[i % 3],
        transparent: true,
        depthWrite: false,
        fog: false,
        opacity: 0.9 + rnd() * 0.1,
      }),
    );
    const width = 215 + rnd() * 240;
    cloud.position.set(
      Math.cos(a) * radius,
      135 + rnd() * 205,
      Math.sin(a) * radius,
    );
    // Leave a deliberate opening around the setting sun, framed by the banks
    // of clouds, so the landmark remains readable from both flight cameras.
    const sunAzimuth = Math.atan2(-420, -150);
    const sunSeparation = Math.atan2(
      Math.sin(a - sunAzimuth),
      Math.cos(a - sunAzimuth),
    );
    if (Math.abs(sunSeparation) < 0.46)
      cloud.position.y = Math.max(cloud.position.y, radius * 0.67);
    cloud.scale.set(width, width * (i % 5 === 0 ? 0.32 : 0.53), 1);
    scene.add(cloud);
    clouds.push(cloud);
    cloudOrigins.push(cloud.position.x);
  }
  const mountains: THREE.Mesh[] = [];
  for (let layer = 0; layer < 3; layer++) {
    const vertices: number[] = [],
      z = -550 - layer * 140;
    const peaks = Array.from({ length: 30 }, (_, i) => ({
      x: -1000 + i * 75,
      y: 12 + Math.sin(i * 0.71 + layer) * 18 + rnd() * 45 + layer * 12,
    }));
    for (let i = 0; i < peaks.length - 1; i++) {
      const a = peaks[i],
        b = peaks[i + 1];
      vertices.push(
        a.x,
        -8,
        z,
        b.x,
        -8,
        z,
        a.x,
        a.y,
        z,
        b.x,
        -8,
        z,
        b.x,
        b.y,
        z,
        a.x,
        a.y,
        z,
      );
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(vertices, 3),
    );
    const mesh = new THREE.Mesh(
      geom,
      new THREE.MeshBasicMaterial({
        color: ["#ac8a9e", "#bc98a7", "#c8a3ad"][layer],
        fog: false,
        side: THREE.DoubleSide,
      }),
    );
    scene.add(mesh);
    mountains.push(mesh);
  }
  return {
    setTimeOfDay: (mode: "morning" | "sunset") => {
      const morning = mode === "morning";
      material.uniforms.top.value.set(morning ? "#599ebc" : "#617f9b");
      material.uniforms.middle.value.set(morning ? "#badcdd" : "#e5a7a3");
      material.uniforms.bottom.value.set(morning ? "#ffe5b6" : "#ffd7a0");
      sun.position.set(-150, morning ? 180 : 125, -420).multiplyScalar(2.45);
      sun.lookAt(0, 30, 80);
      halo.position.copy(sun.position).multiplyScalar(0.98);
      material.uniforms.sunDirection.value.copy(sun.position).normalize();
      clouds.forEach((cloud, i) => {
        cloud.material.map = (morning ? morningTextures : textures)[i % 3];
        cloud.material.needsUpdate = true;
      });
      mountains.forEach((mountain, i) =>
        (mountain.material as THREE.MeshBasicMaterial).color.set(
          (morning
            ? ["#9bb6bc", "#afc9ca", "#c0d4d0"]
            : ["#ac8a9e", "#bc98a7", "#c8a3ad"])[i],
        ),
      );
    },
    update: (time: number) => {
      for (let i = 0; i < clouds.length; i++)
        clouds[i].position.x =
          cloudOrigins[i] + Math.sin(i + time * 0.012) * 3.2;
    },
  };
}
