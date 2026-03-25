"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";

export default function GeometricGrid() {
  const shapes = useMemo(() => {
    const grid: { x: number; y: number; type: string; delay: number; distance: number }[] = [];
    const cols = 18;
    const rows = 5;
    const centerX = Math.floor(cols / 2);
    const centerY = Math.floor(rows / 2);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const dx = col - centerX;
        const dy = row - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const maxDist = Math.sqrt(centerX * centerX + centerY * centerY);
        const normalizedDist = distance / maxDist;

        const types = ["circle", "crescent-left", "crescent-right", "half-left", "half-right"];
        const typeIndex = Math.floor((distance * 3 + col * 0.7 + row * 1.3) % types.length);

        grid.push({
          x: col,
          y: row,
          type: distance < 1 ? "full-circle" : types[typeIndex],
          delay: normalizedDist * 0.8,
          distance: normalizedDist,
        });
      }
    }
    return grid;
  }, []);

  return (
    <div className="w-full flex justify-center py-12 overflow-hidden">
      <div
        className="grid gap-3"
        style={{
          gridTemplateColumns: `repeat(18, 28px)`,
          gridTemplateRows: `repeat(5, 28px)`,
        }}
      >
        {shapes.map((shape, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              duration: 0.6,
              delay: shape.delay + 0.3,
              ease: "easeOut" as const,
            }}
            className="w-7 h-7 flex items-center justify-center"
          >
            <Shape
              type={shape.type}
              distance={shape.distance}
            />
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function Shape({ type, distance }: { type: string; distance: number }) {
  const accentOpacity = Math.max(0, 1 - distance * 1.5);
  const baseColor = `rgba(148, 163, 184, ${0.2 + (1 - distance) * 0.25})`;
  const tealColor = `rgba(0, 180, 216, ${accentOpacity})`;
  const tealLightColor = `rgba(72, 209, 232, ${accentOpacity * 0.8})`;
  const orangeColor = `rgba(255, 140, 66, ${accentOpacity * 0.9})`;
  const color = distance < 0.15 ? orangeColor : distance < 0.3 ? tealLightColor : distance < 0.5 ? tealColor : baseColor;

  const size = 20;

  if (type === "full-circle") {
    return (
      <motion.div
        animate={{
          boxShadow: [
            "0 0 20px rgba(255,140,66,0.4)",
            "0 0 40px rgba(255,140,66,0.6)",
            "0 0 20px rgba(255,140,66,0.4)",
          ],
        }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="rounded-full"
        style={{
          width: size,
          height: size,
          background: `radial-gradient(circle, rgba(255,207,156,0.9), rgba(255,140,66,0.9))`,
        }}
      />
    );
  }

  if (type === "circle") {
    return (
      <div
        className="rounded-full"
        style={{ width: size, height: size, backgroundColor: color }}
      />
    );
  }

  if (type === "crescent-left") {
    return (
      <svg width={size} height={size} viewBox="0 0 20 20">
        <path
          d="M 14 10 A 6 6 0 1 1 14 10.01 M 10 4 A 6 6 0 0 1 10 16"
          fill={color}
        />
      </svg>
    );
  }

  if (type === "crescent-right") {
    return (
      <svg width={size} height={size} viewBox="0 0 20 20">
        <path
          d="M 6 10 A 6 6 0 1 0 6 10.01 M 10 4 A 6 6 0 0 0 10 16"
          fill={color}
        />
      </svg>
    );
  }

  if (type === "half-left") {
    return (
      <svg width={size} height={size} viewBox="0 0 20 20">
        <path d="M 10 2 A 8 8 0 0 0 10 18 Z" fill={color} />
      </svg>
    );
  }

  // half-right
  return (
    <svg width={size} height={size} viewBox="0 0 20 20">
      <path d="M 10 2 A 8 8 0 0 1 10 18 Z" fill={color} />
    </svg>
  );
}
