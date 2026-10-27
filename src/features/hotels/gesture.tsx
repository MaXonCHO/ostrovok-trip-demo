"use client";
import { useRef } from "react";
import {
  motion,
  useMotionValue,
  useTransform,
  useReducedMotion,
  animate,
} from "motion/react";
export function GestureSurface({
  children,
  onSwipe,
  enabled = true,
}: {
  children: React.ReactNode;
  onSwipe: (direction: number) => unknown;
  enabled?: boolean;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-180, 180], [-5, 5]);
  const reduced = useReducedMotion();
  const start = useRef<{
    x: number;
    y: number;
    time: number;
    id: number;
    dragging: boolean;
  } | null>(null);
  const locked = useRef(false);
  return (
    <motion.div
      className="gesture-surface"
      style={{ x, rotate: reduced ? 0 : rotate, touchAction: "pan-y" }}
      onPointerDown={(e) => {
        if (
          !enabled ||
          locked.current ||
          e.button !== 0 ||
          (e.target as HTMLElement).closest("button,a,input,textarea,select") ||
          start.current
        )
          return;
        start.current = {
          x: e.clientX,
          y: e.clientY,
          time: performance.now(),
          id: e.pointerId,
          dragging: false,
        };
      }}
      onPointerMove={(e) => {
        const s = start.current;
        if (!s || e.pointerId !== s.id) return;
        const dx = e.clientX - s.x,
          dy = e.clientY - s.y;
        if (!s.dragging && Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) {
          start.current = null;
          return;
        }
        if (
          !s.dragging &&
          Math.abs(dx) > 12 &&
          Math.abs(dx) > Math.abs(dy) * 1.4
        ) {
          s.dragging = true;
          e.currentTarget.setPointerCapture(e.pointerId);
        }
        if (s.dragging) x.set(dx);
      }}
      onPointerUp={(e) => {
        const s = start.current;
        start.current = null;
        if (!s || !s.dragging) return;
        const dx = e.clientX - s.x;
        const threshold = e.currentTarget.clientWidth * 0.25;
        const fast =
          Math.abs(dx) > 45 &&
          Math.abs(dx) / (performance.now() - s.time) > 0.5;
        if (Math.abs(dx) > threshold || fast) {
          locked.current = true;
          const d = dx > 0 ? 1 : -1;
          void animate(x, reduced ? 0 : d * (e.currentTarget.clientWidth + 70), {
            duration: reduced ? 0 : 0.22,
          }).then(async () => {
            await onSwipe(d);
            x.set(0);
            locked.current = false;
          });
        } else void animate(x, 0, { duration: 0.18, ease: "easeOut" });
      }}
      onPointerCancel={() => {
        start.current = null;
        void animate(x, 0, { duration: 0.18 });
      }}
    >
      {children}
    </motion.div>
  );
}
