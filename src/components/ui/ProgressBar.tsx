"use client";

import { motion } from "framer-motion";

interface ProgressBarProps {
  value: number;
  max?: number;
  variant?: "accent" | "pop" | "purple";
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  label?: string;
  className?: string;
}

export default function ProgressBar({
  value,
  max = 100,
  variant = "accent",
  size = "md",
  showLabel = false,
  label,
  className = "",
}: ProgressBarProps) {
  const percentage = Math.min((value / max) * 100, 100);
  const heights = { sm: "h-1.5", md: "h-2.5", lg: "h-4" };
  const colors = {
    accent: "from-accent to-accent/70",
    pop: "from-pop to-pop/70",
    purple: "from-purple to-purple-light",
  };

  return (
    <div className={className}>
      {(showLabel || label) && (
        <div className="flex justify-between items-center mb-1.5">
          {label && <span className="text-xs text-text-muted">{label}</span>}
          {showLabel && (
            <span className="text-xs font-medium text-text-primary">
              {Math.round(percentage)}%
            </span>
          )}
        </div>
      )}
      <div className={`w-full bg-white/5 rounded-full ${heights[size]} overflow-hidden`}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1, ease: "easeOut" as const, delay: 0.2 }}
          className={`h-full rounded-full bg-gradient-to-r ${colors[variant]}`}
        />
      </div>
    </div>
  );
}
