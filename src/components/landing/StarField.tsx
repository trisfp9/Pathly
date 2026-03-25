"use client";

import { Canvas } from "@react-three/fiber";
import { Stars } from "@react-three/drei";

export default function StarField() {
  return (
    <Canvas>
      <Stars radius={50} count={2500} factor={4} fade speed={2} />
    </Canvas>
  );
}
