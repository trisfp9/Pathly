"use client";

import { motion, HTMLMotionProps } from "framer-motion";
import { ReactNode } from "react";

interface ButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "pop" | "energy" | "purple";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

const variants = {
  primary: "bg-accent hover:bg-accent/90 text-white shadow-lg shadow-accent/20",
  secondary: "bg-surface border border-white/10 hover:border-accent/40 text-text-primary",
  ghost: "bg-transparent hover:bg-white/5 text-text-primary",
  pop: "bg-pop hover:bg-pop/90 text-background font-semibold shadow-lg shadow-pop/20",
  energy: "bg-energy hover:bg-energy/90 text-white font-semibold shadow-lg shadow-energy/25",
  purple: "bg-purple hover:bg-purple/90 text-white font-semibold shadow-lg shadow-purple/25",
};

const sizes = {
  sm: "px-4 py-2 text-sm",
  md: "px-6 py-3 text-sm",
  lg: "px-8 py-4 text-base",
};

export default function Button({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  return (
    <motion.button
      whileHover={{ scale: disabled || loading ? 1 : 1.02 }}
      whileTap={{ scale: disabled || loading ? 1 : 0.98 }}
      className={`
        ${variants[variant]}
        ${sizes[size]}
        rounded-button font-body font-medium
        transition-colors duration-200
        disabled:opacity-50 disabled:cursor-not-allowed
        inline-flex items-center justify-center gap-2
        ${className}
      `}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </motion.button>
  );
}
