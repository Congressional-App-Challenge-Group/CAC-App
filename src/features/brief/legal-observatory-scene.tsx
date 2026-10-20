"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

function makeRibbon(scene: THREE.Scene, points: THREE.Vector3[], color: number, radius: number, phase: number) {
  const curve = new THREE.CatmullRomCurve3(points);
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 180, radius, 8, false),
    new THREE.MeshStandardMaterial({ color, metalness: 0.88, roughness: 0.27, emissive: color, emissiveIntensity: 0.16 }),
  );
  scene.add(tube);
  const light = new THREE.PointLight(color, 1.3, 4);
  scene.add(light);
  return { curve, light, phase };
}

function makeColumn(scene: THREE.Object3D, x: number, z: number, scale: number, stone: THREE.Material, brass: THREE.Material) {
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.25 * scale, 0.29 * scale, 0.12 * scale, 32), brass);
  base.position.set(x, 0.06 * scale - 0.85, z);
  scene.add(base);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.15 * scale, 0.2 * scale, 1.65 * scale, 20, 1), stone);
  shaft.position.set(x, 0.88 * scale - 0.85, z);
  shaft.castShadow = true;
  scene.add(shaft);
  const capital = new THREE.Mesh(new THREE.CylinderGeometry(0.28 * scale, 0.16 * scale, 0.18 * scale, 32), brass);
  capital.position.set(x, 1.79 * scale - 0.85, z);
  scene.add(capital);
}

export function LegalObservatoryScene() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = mountRef.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
    } catch {
      host.dataset.unavailable = "true";
      if (host.parentElement) host.parentElement.dataset.sceneUnavailable = "true";
      return;
    }

    const width = host.clientWidth;
    const height = host.clientHeight;
    const compact = window.matchMedia("(max-width: 767px)").matches;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compact ? 1 : 1.35));
    renderer.setSize(width, height, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.shadowMap.enabled = !compact;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x090a0b, 0.035);
    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 80);
    const initialPosition = new THREE.Vector3(0.15, 2.2, 11.7);
    camera.position.copy(initialPosition);
    camera.lookAt(0, 0.1, 0);

    scene.add(new THREE.HemisphereLight(0xd6c7a5, 0x100e0b, 1.65));
    const key = new THREE.DirectionalLight(0xffe1a4, 3.3);
    key.position.set(-5, 8, 6);
    key.castShadow = !compact;
    key.shadow.mapSize.set(768, 768);
    scene.add(key);
    const jadeFill = new THREE.PointLight(0x477b67, 13, 17, 2);
    jadeFill.position.set(4, 0.7, 2);
    scene.add(jadeFill);
    const brassFill = new THREE.PointLight(0xc6a15b, 20, 16, 2);
    brassFill.position.set(-1, 2.4, 2.4);
    scene.add(brassFill);

    const stone = new THREE.MeshStandardMaterial({ color: 0x37322a, metalness: 0.24, roughness: 0.46 });
    const darkStone = new THREE.MeshStandardMaterial({ color: 0x171613, metalness: 0.35, roughness: 0.4 });
    const brass = new THREE.MeshStandardMaterial({ color: 0xc6a15b, metalness: 0.91, roughness: 0.25, emissive: 0x5f4218, emissiveIntensity: 0.12 });
    const champagne = new THREE.MeshStandardMaterial({ color: 0xe7d2a0, metalness: 0.88, roughness: 0.22 });
    const glass = new THREE.MeshPhysicalMaterial({ color: 0x887650, metalness: 0.38, roughness: 0.2, transmission: 0.68, thickness: 0.65, transparent: true, opacity: 0.38, ior: 1.35, clearcoat: 1, clearcoatRoughness: 0.12 });
    const jade = new THREE.MeshStandardMaterial({ color: 0x477b67, metalness: 0.72, roughness: 0.32, emissive: 0x17382b, emissiveIntensity: 0.28 });

    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(2.25, 2.6, 0.38, 96), darkStone);
    plinth.position.y = -1.55;
    plinth.receiveShadow = true;
    scene.add(plinth);
    const inlay = new THREE.Mesh(new THREE.TorusGeometry(2.38, 0.025, 8, 128), brass);
    inlay.rotation.x = Math.PI / 2;
    inlay.position.y = -1.34;
    scene.add(inlay);
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.05, 0.56, 64), stone);
    pedestal.position.y = -1.08;
    scene.add(pedestal);
    const pedestalInlay = new THREE.Mesh(new THREE.TorusGeometry(0.84, 0.025, 8, 96), champagne);
    pedestalInlay.rotation.x = Math.PI / 2;
    pedestalInlay.position.y = -0.82;
    scene.add(pedestalInlay);

    const sculpture = new THREE.Group();
    scene.add(sculpture);
    const lens = new THREE.Mesh(new THREE.SphereGeometry(1.62, 80, 56), glass);
    lens.scale.set(1.08, 0.82, 0.36);
    lens.castShadow = true;
    sculpture.add(lens);
    const frame = new THREE.Mesh(new THREE.TorusGeometry(1.57, 0.075, 16, 120), brass);
    frame.scale.set(1.08, 0.82, 1);
    sculpture.add(frame);
    const innerFrame = new THREE.Mesh(new THREE.TorusGeometry(1.34, 0.018, 8, 120), champagne);
    innerFrame.scale.set(1.08, 0.82, 1);
    innerFrame.material = champagne;
    sculpture.add(innerFrame);
    const sealBacking = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.09, 64), darkStone);
    sealBacking.position.set(0, 0.12, 0.25);
    sculpture.add(sealBacking);
    const seal = new THREE.Mesh(new THREE.TorusGeometry(0.39, 0.035, 10, 80), champagne);
    seal.position.set(0, 0.12, 0.31);
    sculpture.add(seal);
    const sealCore = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.06, 48), jade);
    sealCore.position.set(0, 0.12, 0.32);
    sculpture.add(sealCore);
    const sealPoint = new THREE.Mesh(new THREE.OctahedronGeometry(0.13, 1), champagne);
    sealPoint.position.set(0, 0.12, 0.42);
    sculpture.add(sealPoint);

    const documentMaterial = new THREE.MeshPhysicalMaterial({ color: 0xe7d2a0, metalness: 0.15, roughness: 0.38, transparent: true, opacity: 0.25, side: THREE.DoubleSide, emissive: 0x5d4723, emissiveIntensity: 0.12 });
    for (const [x, y, z, angle] of [[-0.72, 0.1, -0.28, -0.19], [0.73, -0.16, -0.18, 0.2]] as const) {
      const sheet = new THREE.Mesh(new THREE.PlaneGeometry(0.82, 1.08), documentMaterial);
      sheet.position.set(x, y, z);
      sheet.rotation.y = angle;
      sheet.rotation.x = -0.08;
      sculpture.add(sheet);
      const rule = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.012, 0.01), brass);
      rule.position.set(x, y + 0.2, z + 0.012);
      rule.rotation.y = angle;
      sculpture.add(rule);
      for (let index = 0; index < 3; index += 1) {
        const textRule = new THREE.Mesh(new THREE.BoxGeometry(0.42 - index * 0.06, 0.007, 0.007), stone);
        textRule.position.set(x, y + 0.08 - index * 0.095, z + 0.014);
        textRule.rotation.y = angle;
        sculpture.add(textRule);
      }
    }

    const columns = new THREE.Group();
    sculpture.add(columns);
    makeColumn(columns, -0.78, -0.3, 0.46, stone, brass);
    makeColumn(columns, 0.78, -0.3, 0.46, stone, brass);
    makeColumn(columns, 0, -0.45, 0.57, stone, champagne);
    const chamberFloor = new THREE.Mesh(new THREE.CylinderGeometry(1.02, 1.02, 0.08, 72), darkStone);
    chamberFloor.position.set(0, -0.78, -0.1);
    columns.add(chamberFloor);
    const floorRing = new THREE.Mesh(new THREE.TorusGeometry(0.86, 0.018, 8, 96), brass);
    floorRing.rotation.x = Math.PI / 2;
    floorRing.position.set(0, -0.72, -0.1);
    columns.add(floorRing);

    const rings = [0, 1, 2].map((index) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.83 + index * 0.18, 0.012, 6, 144), index === 1 ? champagne : brass);
      ring.rotation.x = 0.78 + index * 0.08;
      ring.rotation.y = 0.3 + index * 0.48;
      ring.scale.set(1.06, 0.85, 0.72);
      sculpture.add(ring);
      return ring;
    });

    const ribbons = [
      makeRibbon(scene, [new THREE.Vector3(-4.1, -0.35, -1.3), new THREE.Vector3(-3.1, 1.45, -0.8), new THREE.Vector3(-1.35, 2.25, 0.15), new THREE.Vector3(0.35, 1.75, 0.55), new THREE.Vector3(2.4, 2.05, -0.2), new THREE.Vector3(4.35, 0.68, -1.15)], 0xc6a15b, 0.018, 0.05),
      makeRibbon(scene, [new THREE.Vector3(-4.4, 0.98, -1.9), new THREE.Vector3(-2.6, -0.6, -0.75), new THREE.Vector3(-0.9, -1.82, 0.2), new THREE.Vector3(0.55, -1.42, 0.46), new THREE.Vector3(2.65, -0.2, -0.45), new THREE.Vector3(4.25, 1.2, -1.55)], 0xe7d2a0, 0.014, 1.7),
      makeRibbon(scene, [new THREE.Vector3(-3.7, -1.1, -0.6), new THREE.Vector3(-2.75, -2.2, 0.1), new THREE.Vector3(-1.35, -2.1, 0.5), new THREE.Vector3(0.15, -1.3, 0.7), new THREE.Vector3(2.1, -1.05, 0.15), new THREE.Vector3(3.65, -1.85, -0.8)], 0x477b67, 0.012, 3.1),
    ];

    const starsGeometry = new THREE.BufferGeometry();
    const stars = new Float32Array(100 * 3);
    for (let index = 0; index < 100; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 2.7 + Math.random() * 2.7;
      stars[index * 3] = Math.cos(angle) * radius;
      stars[index * 3 + 1] = (Math.random() - 0.5) * 5.6;
      stars[index * 3 + 2] = -2 - Math.random() * 2;
    }
    starsGeometry.setAttribute("position", new THREE.BufferAttribute(stars, 3));
    const starPoints = new THREE.Points(starsGeometry, new THREE.PointsMaterial({ color: 0xe7d2a0, size: 0.018, transparent: true, opacity: 0.48, depthWrite: false }));
    scene.add(starPoints);

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pointer = new THREE.Vector2();
    const target = new THREE.Vector2();
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch" || reducedMotion.matches) return;
      const bounds = host.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) {
        target.set(0, 0);
        return;
      }
      target.x = THREE.MathUtils.clamp(((event.clientX - bounds.left) / bounds.width - 0.5) * 2, -1, 1);
      target.y = THREE.MathUtils.clamp(((event.clientY - bounds.top) / bounds.height - 0.5) * 2, -1, 1);
    };
    const onPointerLeave = () => target.set(0, 0);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("blur", onPointerLeave);

    let animationId = 0;
    const render = (time: number) => {
      if (document.hidden) return;
      const seconds = time * 0.001;
      if (!reducedMotion.matches) {
        pointer.lerp(target, 0.035);
        camera.position.x = initialPosition.x + pointer.x * 0.5;
        camera.position.y = initialPosition.y - pointer.y * 0.22;
        camera.lookAt(pointer.x * 0.15, 0.05 + pointer.y * 0.08, 0);
        sculpture.rotation.y = Math.sin(seconds * 0.16) * 0.075 + pointer.x * 0.035;
        sculpture.rotation.x = pointer.y * 0.018;
        rings.forEach((ring, index) => { ring.rotation.z = seconds * (0.035 + index * 0.012) * (index === 1 ? -1 : 1); });
        ribbons.forEach(({ curve, light, phase }, index) => {
          const point = curve.getPoint((seconds * (0.022 + index * 0.004) + phase) % 1);
          light.position.copy(point);
          light.intensity = 0.8 + Math.sin(seconds * 0.65 + phase) * 0.25;
        });
      }
      renderer.render(scene, camera);
      host.dataset.ready = "true";
      if (host.parentElement) {
        host.parentElement.dataset.sceneReady = "true";
        delete host.parentElement.dataset.sceneUnavailable;
      }
      if (!reducedMotion.matches) animationId = window.requestAnimationFrame(render);
    };
    const start = () => {
      window.cancelAnimationFrame(animationId);
      if (!document.hidden) animationId = window.requestAnimationFrame(render);
    };
    const onVisibility = () => document.hidden ? window.cancelAnimationFrame(animationId) : start();
    reducedMotion.addEventListener("change", start);
    document.addEventListener("visibilitychange", onVisibility);
    start();

    const observer = new ResizeObserver(() => {
      const nextWidth = host.clientWidth;
      const nextHeight = host.clientHeight;
      if (!nextWidth || !nextHeight) return;
      camera.aspect = nextWidth / nextHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(nextWidth, nextHeight, false);
    });
    observer.observe(host);

    return () => {
      window.cancelAnimationFrame(animationId);
      observer.disconnect();
      reducedMotion.removeEventListener("change", start);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("blur", onPointerLeave);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.InstancedMesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
      if (host.parentElement) {
        delete host.parentElement.dataset.sceneReady;
        delete host.parentElement.dataset.sceneUnavailable;
      }
    };
  }, []);

  return <div ref={mountRef} className="observatory-scene" data-scene="loading" aria-hidden="true" />;
}
