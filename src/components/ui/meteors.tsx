"use client";

import { cn } from "@/lib/utils";
import React, { useEffect, useMemo, useState } from "react";

export const Meteors = ({
  number,
  className,
}: {
  number?: number;
  className?: string;
}) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const meteorStyles = useMemo(() => {
    const count = number || 20;
    return Array.from({ length: count }, () => ({
      left: Math.floor(Math.random() * 800 - 400) + "px",
      animationDelay: (Math.random() * 0.6 + 0.2).toFixed(2) + "s",
      animationDuration: Math.floor(Math.random() * 8 + 2) + "s",
    }));
  }, [number]);

  if (!mounted) return null;

  return (
    <>
      {meteorStyles.map((style, idx) => (
        <span
          key={"meteor" + idx}
          className={cn(
            "animate-meteor-effect absolute top-1/2 left-1/2 h-0.5 w-0.5 rounded-[9999px] bg-slate-500 shadow-[0_0_0_1px_#ffffff10] rotate-[215deg]",
            "before:content-[''] before:absolute before:top-1/2 before:transform before:-translate-y-[50%] before:w-[50px] before:h-[1px] before:bg-gradient-to-r before:from-[#64748b] before:to-transparent",
            className
          )}
          style={{
            top: 0,
            left: style.left,
            animationDelay: style.animationDelay,
            animationDuration: style.animationDuration,
          }}
        ></span>
      ))}
    </>
  );
};
