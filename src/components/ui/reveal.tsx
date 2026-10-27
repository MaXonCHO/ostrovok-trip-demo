"use client";
// Adapted from Motion Primitives InView by Julien Thibeaut, MIT.
// https://github.com/ibelick/motion-primitives/blob/main/components/core/in-view.tsx
import { useRef, type ReactNode } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
export function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef(null);
  const visible = useInView(ref, { once: true, margin: "0px 0px 40px 0px" });
  const reduce = useReducedMotion();
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={false}
      animate={{ opacity: 1, y: visible || reduce ? 0 : 14 }}
      transition={{
        duration: reduce ? 0 : 0.5,
        delay: reduce ? 0 : delay,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </motion.div>
  );
}
