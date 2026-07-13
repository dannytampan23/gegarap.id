'use client';

import { useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { HouseModel } from './HouseModel';
import { FloatingBadge } from './FloatingBadge';

// DECISION: drive the DEFAULT R3F camera via `useThree` instead of mounting
// drei's <PerspectiveCamera makeDefault>. It's the same PerspectiveCamera with
// fewer moving parts — GSAP gets a stable `camera.position` ref to scrub, and a
// per-frame lookAt keeps the model centred as z changes.
function CameraRig({ containerRef }: { containerRef: React.RefObject<HTMLDivElement | null> }) {
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // §3: register the plugin client-side only (never at module scope).
    gsap.registerPlugin(ScrollTrigger);
    // More oblique 3/4 view ("lebih miring"): bigger side offset (x) + higher (y).
    camera.position.set(5.5, 3.3, 6);
    camera.lookAt(0, 0, 0);

    // Scrub camera dolly-in (z 6 → 3) across the hero's scroll range.
    const tween = gsap.fromTo(
      camera.position,
      { z: 6 },
      {
        z: 3,
        ease: 'none',
        scrollTrigger: {
          trigger: el,
          start: 'top top',
          end: 'bottom top',
          scrub: true,
          onUpdate: () => invalidate(), // ensure a render even in demand mode
        },
      }
    );

    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, [camera, containerRef, invalidate]);

  // Keep the camera aimed at the origin throughout the dolly.
  useFrame(() => camera.lookAt(0, 0, 0));
  return null;
}

/**
 * The R3F hero canvas (master prompt §6). Mounted ONLY by the desktop/motion/
 * WebGL gate upstream. `pointer-events:none` so it never steals clicks from the
 * search bar. `frameloop` is `demand` when the hero is scrolled out of view
 * (near-zero cost) and `always` while visible so the idle float + scrub run.
 */
export function Scene({
  containerRef,
  active,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  active: boolean;
}) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      frameloop={active ? 'always' : 'demand'}
      camera={{ position: [5.5, 3.3, 6], fov: 45 }}
      gl={{ antialias: true, alpha: true }}
      style={{ pointerEvents: 'none' }}
    >
      {/* Shadows intentionally OFF (performance, §6). Brightened a touch
          ("lebih silau"): higher key light for stronger highlights. */}
      <ambientLight intensity={0.7} />
      <directionalLight position={[5, 5, 5]} intensity={1.8} />
      <HouseModel />
      <FloatingBadge />
      <CameraRig containerRef={containerRef} />
    </Canvas>
  );
}
