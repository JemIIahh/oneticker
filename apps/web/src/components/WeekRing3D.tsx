'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { LitHours } from './LitHours';

const HOURS = 168;
const RADIUS = 3.2;

const session = (i: number): 'regular' | 'edge' | 'closed' => {
  const day = Math.floor(i / 24);
  const hour = i % 24;
  if (day >= 5) return 'closed';
  if (hour >= 9.5 && hour < 16) return 'regular';
  if ((hour >= 4 && hour < 9.5) || (hour >= 16 && hour < 20)) return 'edge';
  return 'closed';
};

const HEIGHT = { regular: 1.6, edge: 0.7, closed: 0.22 };
const COLOR = { regular: 0xf5b84b, edge: 0x8a6a2e, closed: 0x24443c };

/**
 * The week as a ring of 168 hour-bars: trading hours tall and lit, closed hours low and dark, the current hour
 * in ivory. Turns slowly so "now" faces the viewer. Falls back to the flat grid without WebGL or with reduced motion.
 */
export function WeekRing3D({ nowHour }: { nowHour: number }) {
  const mount = useRef<HTMLDivElement>(null);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const el = mount.current;
    if (!el) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    } catch {
      setFallback(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
    camera.position.set(0, 4.2, 8.4);
    camera.lookAt(0, 0.3, 0);

    scene.add(new THREE.HemisphereLight(0xf1ebdd, 0x10231f, 0.9));
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(4, 8, 6);
    scene.add(key);

    const ring = new THREE.Group();
    const geometry = new THREE.BoxGeometry(0.08, 1, 0.16);
    const materials = {
      regular: new THREE.MeshStandardMaterial({ color: COLOR.regular, emissive: COLOR.regular, emissiveIntensity: 0.35, roughness: 0.5 }),
      edge: new THREE.MeshStandardMaterial({ color: COLOR.edge, emissive: COLOR.edge, emissiveIntensity: 0.15, roughness: 0.6 }),
      closed: new THREE.MeshStandardMaterial({ color: COLOR.closed, roughness: 0.9 }),
      now: new THREE.MeshStandardMaterial({ color: 0xf1ebdd, emissive: 0xf1ebdd, emissiveIntensity: 0.6, roughness: 0.4 }),
    };
    const nowIndex = Math.floor(nowHour) % HOURS;
    let nowBar: THREE.Mesh | null = null;
    for (let i = 0; i < HOURS; i++) {
      const kind = session(i);
      const height = i === nowIndex ? Math.max(HEIGHT[kind], 1.0) : HEIGHT[kind];
      const bar = new THREE.Mesh(geometry, i === nowIndex ? materials.now : materials[kind]);
      const angle = (i / HOURS) * Math.PI * 2;
      bar.position.set(Math.sin(angle) * RADIUS, height / 2, Math.cos(angle) * RADIUS);
      bar.scale.y = height;
      bar.rotation.y = angle;
      ring.add(bar);
      if (i === nowIndex) nowBar = bar;
    }
    const base = new THREE.Mesh(new THREE.RingGeometry(RADIUS - 0.25, RADIUS + 0.25, 168), new THREE.MeshStandardMaterial({ color: 0x152a25, roughness: 1, side: THREE.DoubleSide }));
    base.rotation.x = -Math.PI / 2;
    ring.add(base);
    scene.add(ring);

    // Turn the ring so "now" faces the camera, then drift slowly around it.
    const facing = -(nowIndex / HOURS) * Math.PI * 2;
    ring.rotation.y = facing;

    const resize = () => {
      const size = Math.min(el.clientWidth, 420);
      renderer.setSize(size, size * 0.8, false);
      renderer.domElement.style.width = `${size}px`;
      renderer.domElement.style.height = `${size * 0.8}px`;
      camera.aspect = 1.25;
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(el);

    let frame = 0;
    const start = performance.now();
    const draw = (t: number) => {
      const s = (t - start) / 1000;
      if (!reduced) {
        ring.rotation.y = facing + Math.sin(s * 0.25) * 0.35;
        if (nowBar) (nowBar.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.45 + 0.35 * (0.5 + 0.5 * Math.sin(s * 2.2));
      }
      renderer.render(scene, camera);
      if (!reduced) frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.dispose();
      geometry.dispose();
      Object.values(materials).forEach((m) => m.dispose());
      base.geometry.dispose();
      (base.material as THREE.Material).dispose();
      el.removeChild(renderer.domElement);
    };
  }, [nowHour]);

  if (fallback) return <LitHours cell={14} gap={3} />;
  return <div ref={mount} className="flex min-h-[280px] w-full items-center justify-center" aria-label="The week as a ring of hours; the tall amber bars are when Wall Street trades" role="img" />;
}
