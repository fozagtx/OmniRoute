"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

const COINS = [
  { src: "/coins/usdc.png", speed: 0.72, phase: 0, scale: 0.34 },
  { src: "/coins/pyusd.png", speed: 0.72, phase: Math.PI / 2, scale: 0.34 },
  { src: "/coins/eurc.png", speed: 0.72, phase: Math.PI, scale: 0.34 },
  { src: "/brand/somnia.png", speed: 0.72, phase: Math.PI * 1.5, scale: 0.42 },
];

function createEarthTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const ocean = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  ocean.addColorStop(0, "#164f68");
  ocean.addColorStop(0.45, "#1f7a73");
  ocean.addColorStop(1, "#183f58");
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(223, 248, 197, 0.08)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= canvas.width; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 32; y < canvas.height; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  const point = (lon: number, lat: number) => [
    ((lon + 180) / 360) * canvas.width,
    ((90 - lat) / 180) * canvas.height,
  ];

  const land = (coords: Array<[number, number]>) => {
    ctx.beginPath();
    coords.forEach(([lon, lat], index) => {
      const [x, y] = point(lon, lat);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  };

  ctx.fillStyle = "#d4eaa5";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
  ctx.lineWidth = 2;
  land([[-168, 58], [-132, 72], [-70, 56], [-54, 22], [-82, 8], [-118, 18], [-134, 34]]);
  land([[-82, 12], [-36, 4], [-50, -55], [-72, -48], [-82, -14]]);
  land([[-18, 34], [8, 58], [48, 54], [88, 28], [76, 8], [28, 8], [8, -36], [-16, -34], [-28, 6]]);
  land([[44, 28], [112, 58], [154, 42], [136, 10], [98, 2], [78, -8], [54, 8]]);
  land([[112, -10], [154, -12], [152, -42], [116, -44], [104, -24]]);
  land([[-54, 74], [-20, 78], [8, 68], [-18, 60]]);

  ctx.fillStyle = "rgba(228, 254, 83, 0.2)";
  for (let i = 0; i < 90; i += 1) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    ctx.fillRect(x, y, 1.2, 1.2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function createOrbitStreak(start: number, length: number) {
  const points: THREE.Vector3[] = [];
  const segments = 44;

  for (let i = 0; i <= segments; i += 1) {
    const angle = start + (length * i) / segments;
    points.push(new THREE.Vector3(Math.cos(angle) * 1.08, Math.sin(angle) * 0.54, 1.965));
  }

  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color: 0xe4fe53,
    transparent: true,
    opacity: 0.5,
    depthTest: false,
    depthWrite: false,
  });

  const line = new THREE.Line(geometry, material);
  line.renderOrder = 2.5;
  return line;
}

export default function ThreeGlobe() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.set(0, 0.15, 7);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    const globeGroup = new THREE.Group();
    scene.add(globeGroup);

    const earthTexture = createEarthTexture();
    const globeGeometry = new THREE.SphereGeometry(1.72, 96, 64);
    const globeMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: earthTexture ?? undefined,
      roughness: 0.55,
      metalness: 0.08,
      emissive: 0x0b211e,
      emissiveIntensity: 0.18,
    });
    const globe = new THREE.Mesh(globeGeometry, globeMaterial);
    globeGroup.add(globe);

    const gridGeometry = new THREE.SphereGeometry(1.735, 48, 24);
    const gridMaterial = new THREE.MeshBasicMaterial({
      color: 0xdff8c5,
      transparent: true,
      opacity: 0.08,
      wireframe: true,
    });
    const grid = new THREE.Mesh(gridGeometry, gridMaterial);
    globeGroup.add(grid);

    const atmosphereGeometry = new THREE.SphereGeometry(1.9, 72, 48);
    const atmosphereMaterial = new THREE.MeshBasicMaterial({
      color: 0x9ed8c7,
      transparent: true,
      opacity: 0.12,
      side: THREE.BackSide,
    });
    const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
    globeGroup.add(atmosphere);

    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0xe4fe53,
      transparent: true,
      opacity: 0.36,
      depthWrite: false,
    });
    const orbitRing = new THREE.Mesh(new THREE.TorusGeometry(1.08, 0.008, 12, 180), ringMaterial);
    orbitRing.position.z = 1.78;
    orbitRing.scale.y = 0.5;
    orbitRing.renderOrder = 2;
    scene.add(orbitRing);

    const orbitStreaks = COINS.map((coin) => {
      const streak = createOrbitStreak(-0.62, 0.5);
      scene.add(streak);
      return { phase: coin.phase, speed: coin.speed, streak };
    });

    const coinGroup = new THREE.Group();
    scene.add(coinGroup);

    const loader = new THREE.TextureLoader();
    const coinSprites = COINS.map((coin) => {
      const texture = loader.load(coin.src);
      texture.colorSpace = THREE.SRGBColorSpace;
      const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(material);
      sprite.scale.set(0.52, 0.52, 1);
      sprite.renderOrder = 3;
      coinGroup.add(sprite);
      return { ...coin, sprite, texture, material };
    });

    scene.add(new THREE.AmbientLight(0xdff8c5, 1.3));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.3);
    keyLight.position.set(3, 4, 5);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0x8be3d2, 1.8);
    rimLight.position.set(-4, -1, 2);
    scene.add(rimLight);

    let frame = 0;
    const clock = new THREE.Clock();

    const resize = () => {
      const { width, height } = mount.getBoundingClientRect();
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
    };

    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();

    const render = () => {
      const t = clock.getElapsedTime();
      globeGroup.rotation.y = -0.72 + t * 0.14;
      grid.rotation.y = -t * 0.08;
      orbitRing.rotation.z = t * 0.08;

      orbitStreaks.forEach(({ phase, speed, streak }) => {
        streak.rotation.z = phase + t * speed;
      });

      coinSprites.forEach((coin) => {
        const angle = coin.phase + t * coin.speed;
        coin.sprite.position.set(Math.cos(angle) * 1.08, Math.sin(angle) * 0.54, 1.94);
        coin.sprite.scale.setScalar(coin.scale);
      });

      renderer.render(scene, camera);
      if (!reducedMotion) frame = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
      mount.removeChild(renderer.domElement);
      coinSprites.forEach(({ texture, material }) => {
        texture.dispose();
        material.dispose();
      });
      orbitRing.geometry.dispose();
      ringMaterial.dispose();
      orbitStreaks.forEach(({ streak }) => {
        streak.geometry.dispose();
        if (Array.isArray(streak.material)) {
          streak.material.forEach((material) => material.dispose());
        } else {
          streak.material.dispose();
        }
      });
      earthTexture?.dispose();
      globeGeometry.dispose();
      globeMaterial.dispose();
      gridGeometry.dispose();
      gridMaterial.dispose();
      atmosphereGeometry.dispose();
      atmosphereMaterial.dispose();
      renderer.dispose();
    };
  }, []);

  return <div ref={mountRef} className="three-globe" />;
}
