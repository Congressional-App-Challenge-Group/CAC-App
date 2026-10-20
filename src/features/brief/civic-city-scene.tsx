"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

const buildingMat = (color: number, roughness = 0.72, metalness = 0.08) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });

function makeBuilding(
  scene: THREE.Scene,
  x: number,
  z: number,
  width: number,
  depth: number,
  height: number,
  material: THREE.Material,
  windowMaterial: THREE.Material,
  random: () => number,
) {
  const body = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  body.position.set(x, height / 2, z);
  body.castShadow = true;
  body.receiveShadow = true;
  scene.add(body);

  const windowGeometry = new THREE.BoxGeometry(Math.min(0.16, width * 0.14), 0.18, 0.035);
  const windows: THREE.Vector3[] = [];
  const rows = Math.max(1, Math.floor(height / 0.48));
  const columns = Math.max(1, Math.floor(width / 0.36));
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      if (random() < 0.2) continue;
      windows.push(new THREE.Vector3(
        x - width / 2 + (column + 0.5) * width / columns,
        0.32 + row * (height - 0.48) / Math.max(1, rows - 1),
        z + depth / 2 + 0.018,
      ));
    }
  }
  const lights = new THREE.InstancedMesh(windowGeometry, windowMaterial, windows.length);
  const matrix = new THREE.Matrix4();
  windows.forEach((position, index) => {
    matrix.makeTranslation(position.x, position.y, position.z);
    lights.setMatrixAt(index, matrix);
  });
  lights.instanceMatrix.needsUpdate = true;
  scene.add(lights);

  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.08, 0.12, depth + 0.08),
    buildingMat(0xb6c1c0, 0.6, 0.12),
  );
  roof.position.set(x, height + 0.04, z);
  roof.castShadow = true;
  scene.add(roof);
  return body;
}

function makeTree(scene: THREE.Scene, x: number, z: number, scale: number, bark: THREE.Material, leaves: THREE.Material) {
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.055 * scale, 0.08 * scale, 0.55 * scale, 6), bark);
  trunk.position.set(x, 0.275 * scale, z);
  trunk.castShadow = true;
  scene.add(trunk);
  const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34 * scale, 1), leaves);
  crown.position.set(x, 0.72 * scale, z);
  crown.castShadow = true;
  scene.add(crown);
  const crownTop = new THREE.Mesh(new THREE.IcosahedronGeometry(0.24 * scale, 0), leaves);
  crownTop.position.set(x + 0.08 * scale, 0.98 * scale, z - 0.035 * scale);
  crownTop.castShadow = true;
  scene.add(crownTop);
}

function addSignal(scene: THREE.Scene, x: number, z: number, color: number, radius: number) {
  const point = new THREE.Group();
  point.position.set(x, 0, z);
  const pin = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), new THREE.MeshBasicMaterial({ color }));
  pin.position.y = 1.1;
  point.add(pin);
  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(radius, 0.025, 8, 56),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.72 }),
  );
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 0.045;
  point.add(halo);
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.075, 1.02, 8, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.38, side: THREE.DoubleSide }),
  );
  beam.position.y = 0.58;
  point.add(beam);
  scene.add(point);
  return point;
}

function buildCity(scene: THREE.Scene) {
  const random = (() => {
    let seed = 20260517;
    return () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
  })();
  const terrainMaterial = buildingMat(0x182e35, 0.95, 0.01);
  const terrain = new THREE.PlaneGeometry(34, 22, 100, 64);
  terrain.rotateX(-Math.PI / 2);
  const positions = terrain.attributes.position;
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const z = positions.getZ(index);
    const hill = Math.sin(x * 0.3 + z * 0.12) * 0.16 + Math.cos(z * 0.48 - x * 0.08) * 0.11;
    const ridge = Math.max(0, 1 - Math.hypot((x + 6) / 13, (z + 3) / 8)) * 1.05;
    positions.setY(index, hill + ridge - 0.24);
  }
  terrain.computeVertexNormals();
  const land = new THREE.Mesh(terrain, terrainMaterial);
  land.position.x = 4.5;
  land.receiveShadow = true;
  scene.add(land);

  const strataMaterial = buildingMat(0x26434a, 0.82, 0.04);
  for (let layer = 0; layer < 3; layer += 1) {
    const contour = new THREE.Mesh(
      new THREE.TorusGeometry(6.6 + layer * 0.72, 0.08, 6, 110),
      strataMaterial,
    );
    contour.position.set(4.3, -0.42 - layer * 0.19, 0.1);
    contour.rotation.x = -Math.PI / 2;
    contour.scale.set(1.62, 0.78, 1);
    scene.add(contour);
  }

  const roadMaterial = new THREE.MeshStandardMaterial({ color: 0x34494d, roughness: 0.93 });
  const roadLine = new THREE.MeshBasicMaterial({ color: 0x91c2b4, transparent: true, opacity: 0.34 });
  const makeRoad = (points: THREE.Vector3[], radius: number) => {
    const curve = new THREE.CatmullRomCurve3(points);
    const road = new THREE.Mesh(new THREE.TubeGeometry(curve, 70, radius, 8, false), roadMaterial);
    road.position.y = 0.035;
    road.receiveShadow = true;
    scene.add(road);
    const centerLine = new THREE.Mesh(new THREE.TubeGeometry(curve, 70, 0.018, 6, false), roadLine);
    centerLine.position.y = 0.058;
    scene.add(centerLine);
  };
  makeRoad([
    new THREE.Vector3(-9, 0, 6), new THREE.Vector3(-3, 0, 5.2), new THREE.Vector3(2, 0, 3.4),
    new THREE.Vector3(7, 0, 3.2), new THREE.Vector3(13, 0, 4.3),
  ], 0.32);
  makeRoad([
    new THREE.Vector3(0, 0, -7), new THREE.Vector3(1.6, 0, -3), new THREE.Vector3(2.2, 0, 0),
    new THREE.Vector3(3.8, 0, 3.4), new THREE.Vector3(5.5, 0, 8),
  ], 0.25);

  const towerMaterials = [0x294650, 0x334f57, 0x3f5a5d, 0x253e49].map((color) => buildingMat(color, 0.46, 0.2));
  const windowMaterial = new THREE.MeshStandardMaterial({
    color: 0xffd698,
    emissive: 0xeaa860,
    emissiveIntensity: 0.82,
    roughness: 0.3,
  });
  const civicStone = buildingMat(0xa5967b, 0.82, 0.02);
  const civicHighlight = buildingMat(0xd4c6a6, 0.65, 0.04);
  const bark = buildingMat(0x493b32, 1, 0);
  const leaves = buildingMat(0x426352, 0.96, 0);

  const towers = [
    [-1.2, -3.3, 1.35, 1.2, 5.7], [0.55, -4.3, 1.1, 1.15, 7.4],
    [2.25, -3.8, 1.35, 1.25, 6.1], [4.25, -5.1, 1.05, 1.15, 8.5],
    [6.1, -4.1, 1.25, 1.3, 6.8], [8.3, -3.4, 1.3, 1.2, 5.4],
    [10, -1.8, 1.2, 1.25, 4.6], [7.4, -1.7, 1.1, 1.1, 3.8],
  ];
  towers.forEach(([x, z, width, depth, height], index) => {
    makeBuilding(scene, x, z, width, depth, height, towerMaterials[index % towerMaterials.length], windowMaterial, random);
  });

  // Civic hall: a warm stone landmark anchors the otherwise contemporary skyline.
  const hallBase = new THREE.Mesh(new THREE.BoxGeometry(3.55, 0.42, 2.5), civicStone);
  hallBase.position.set(3.25, 0.24, 0.3);
  hallBase.castShadow = true;
  hallBase.receiveShadow = true;
  scene.add(hallBase);
  const hall = new THREE.Mesh(new THREE.BoxGeometry(2.75, 1.38, 1.8), civicHighlight);
  hall.position.set(3.25, 1.12, 0.25);
  hall.castShadow = true;
  hall.receiveShadow = true;
  scene.add(hall);
  const pediment = new THREE.Mesh(new THREE.ConeGeometry(1.15, 0.54, 4), civicStone);
  pediment.position.set(3.25, 2.02, 1.04);
  pediment.rotation.y = Math.PI / 4;
  pediment.scale.set(1.35, 0.55, 0.38);
  pediment.castShadow = true;
  scene.add(pediment);
  const columns = new THREE.Group();
  for (let index = 0; index < 6; index += 1) {
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.1, 1.1, 10), civicHighlight);
    column.position.set(2.25 + index * 0.4, 0.91, 1.2);
    column.castShadow = true;
    columns.add(column);
  }
  scene.add(columns);

  // Neighborhood blocks, pocket parks and trees establish a human scale.
  const homes = [
    [-1.9, 0.2, 0.84, 0.78, 1.55], [-0.55, 0.5, 0.9, 0.75, 1.3],
    [6.4, 0.5, 0.82, 0.8, 1.65], [7.5, 0.8, 0.88, 0.72, 1.35],
    [8.8, 1.4, 0.95, 0.82, 1.7], [0.2, 2.8, 0.95, 0.82, 1.55],
    [1.5, 3.4, 0.92, 0.8, 1.35], [7.5, 3.2, 0.95, 0.84, 1.7],
    [9, 4.4, 0.9, 0.8, 1.45], [10.3, 4, 0.86, 0.78, 1.6],
  ];
  homes.forEach(([x, z, width, depth, height], index) => {
    makeBuilding(scene, x, z, width, depth, height, towerMaterials[(index + 2) % towerMaterials.length], windowMaterial, random);
  });

  const treeLocations: [number, number, number][] = [
    [-4.4, 1.7, 1.25], [-3.6, 3, 0.9], [-2.5, 4.6, 1.1], [-1.6, 3.6, 0.83],
    [-0.7, 5, 1.05], [0.3, 5.5, 0.78], [1.3, 5.8, 1], [2.4, 5.3, 0.8],
    [4, 5.8, 1.16], [5.2, 5.2, 0.9], [6.4, 6, 1.08], [8, 6.3, 1.2],
    [9.5, 5.6, 0.88], [11.3, 5.2, 1.1], [-4.5, -0.2, 1.1], [-3.7, -2, 0.9],
  ];
  treeLocations.forEach(([x, z, size]) => makeTree(scene, x, z, size, bark, leaves));

  const signalColors = [0x8cf1dc, 0xffc37b, 0x9ddaff];
  const signals = [
    addSignal(scene, 3.25, 0.3, signalColors[0], 0.45),
    addSignal(scene, -0.55, 2.4, signalColors[1], 0.32),
    addSignal(scene, 7.8, 3.3, signalColors[2], 0.35),
  ];

  const points = new Float32Array(240 * 3);
  for (let index = 0; index < 240; index += 1) {
    points[index * 3] = -8 + random() * 25;
    points[index * 3 + 1] = 0.6 + random() * 6.5;
    points[index * 3 + 2] = -8 + random() * 15;
  }
  const particlesGeometry = new THREE.BufferGeometry();
  particlesGeometry.setAttribute("position", new THREE.BufferAttribute(points, 3));
  const particlesMaterial = new THREE.PointsMaterial({
    color: 0x9ce9dc,
    size: 0.035,
    transparent: true,
    opacity: 0.65,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const particles = new THREE.Points(particlesGeometry, particlesMaterial);
  scene.add(particles);

  return { signals, particles };
}

export function CivicCityScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });
    } catch {
      canvas.dataset.unavailable = "true";
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 700 ? 1.2 : 1.55));
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x101d22, 0.014);
    const camera = new THREE.PerspectiveCamera(39, canvas.clientWidth / canvas.clientHeight, 0.1, 140);
    const baseCamera = new THREE.Vector3(0.4, 18, 34);
    camera.position.copy(baseCamera);
    camera.lookAt(1.7, 0.4, 0);

    const ambient = new THREE.HemisphereLight(0xa8d7dd, 0x17251f, 2.0);
    scene.add(ambient);
    const moonlight = new THREE.DirectionalLight(0xa5d7ef, 3.2);
    moonlight.position.set(-8, 18, -5);
    moonlight.castShadow = true;
    moonlight.shadow.mapSize.set(1024, 1024);
    moonlight.shadow.camera.left = -20;
    moonlight.shadow.camera.right = 20;
    moonlight.shadow.camera.top = 20;
    moonlight.shadow.camera.bottom = -20;
    scene.add(moonlight);
    const warmFill = new THREE.PointLight(0xf0aa72, 24, 34, 2);
    warmFill.position.set(1.5, 7, 9);
    scene.add(warmFill);
    const aquaFill = new THREE.PointLight(0x49c8c2, 16, 30, 2);
    aquaFill.position.set(10, 6, -4);
    scene.add(aquaFill);

    const { signals, particles } = buildCity(scene);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pointer = new THREE.Vector2(0, 0);
    const target = new THREE.Vector2(0, 0);
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const bounds = canvas.parentElement?.getBoundingClientRect() ?? canvas.getBoundingClientRect();
      target.x = THREE.MathUtils.clamp(((event.clientX - bounds.left) / bounds.width - 0.5) * 2, -1, 1);
      target.y = THREE.MathUtils.clamp(((event.clientY - bounds.top) / bounds.height - 0.5) * 2, -1, 1);
    };
    const onPointerLeave = () => target.set(0, 0);
    // The scene is decorative behind the hero content, so its canvas cannot
    // capture pointer events; observe the window and map the pointer to the scene.
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerleave", onPointerLeave, { passive: true });

    let animationId = 0;
    let frame = 0;
    const render = (time: number) => {
      if (document.hidden) return;
      const isReducedMotion = reducedMotion.matches;
      if (!isReducedMotion) {
        const seconds = time * 0.001;
        pointer.lerp(target, 0.075);
        camera.position.x = baseCamera.x + pointer.x * 3.4;
        camera.position.y = baseCamera.y + pointer.y * 1.15;
        camera.lookAt(1.7 + pointer.x * 1.05, 0.4 - pointer.y * 0.42, 0);
        signals.forEach((signal, index) => {
          const halo = signal.children[1];
          if (halo) halo.scale.setScalar(1 + (Math.sin(seconds * 1.15 + index * 2.2) + 1) * 0.12);
        });
        particles.rotation.y = Math.sin(seconds * 0.06) * 0.035;
      }
      if (!isReducedMotion || frame % 4 === 0) {
        renderer.render(scene, camera);
        if (canvas.dataset.ready !== "true") canvas.dataset.ready = "true";
      }
      frame += 1;
      if (!isReducedMotion || frame % 4 === 0) {
        animationId = window.requestAnimationFrame(render);
      }
    };
    const onVisibilityChange = () => {
      window.cancelAnimationFrame(animationId);
      if (!document.hidden) animationId = window.requestAnimationFrame(render);
    };
    const onMotionPreferenceChange = (event: MediaQueryListEvent) => {
      window.cancelAnimationFrame(animationId);
      if (event.matches) {
        pointer.set(0, 0);
        target.set(0, 0);
        camera.position.copy(baseCamera);
        camera.lookAt(1.7, 0.4, 0);
        signals.forEach((signal) => {
          const halo = signal.children[1];
          if (halo) halo.scale.setScalar(1);
        });
        particles.rotation.y = 0;
        renderer.render(scene, camera);
      } else {
        animationId = window.requestAnimationFrame(render);
      }
    };
    reducedMotion.addEventListener("change", onMotionPreferenceChange);
    document.addEventListener("visibilitychange", onVisibilityChange);
    animationId = window.requestAnimationFrame(render);

    const resizeObserver = new ResizeObserver(() => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (!width || !height) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, width < 700 ? 1.2 : 1.55));
    });
    resizeObserver.observe(canvas);

    return () => {
      window.cancelAnimationFrame(animationId);
      resizeObserver.disconnect();
      reducedMotion.removeEventListener("change", onMotionPreferenceChange);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", onPointerLeave);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.InstancedMesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      renderer.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} className="civic-world__canvas" aria-hidden="true" />;
}
