"use client";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "accent" | "pop" | "muted" | "warning" | "energy" | "purple";
  className?: string;
}

const variants = {
  accent: "bg-accent/15 text-accent border-accent/20",
  pop: "bg-pop/15 text-pop border-pop/20",
  muted: "bg-white/5 text-text-muted border-white/10",
  warning: "bg-energy/15 text-energy border-energy/20",
  energy: "bg-energy/15 text-energy border-energy/20",
  purple: "bg-purple/15 text-purple border-purple/20",
};

export default function Badge({ children, variant = "accent", className = "" }: BadgeProps) {
  return (
    <span
      className={`
        ${variants[variant]}
        inline-flex items-center px-3 py-1
        text-xs font-medium
        rounded-badge border
        ${className}
      `}
    >
      {children}
    </span>
  );
}
