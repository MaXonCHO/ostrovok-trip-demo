"use client";
import { useId, useState, type ReactNode } from "react";
import { DotsThree } from "@phosphor-icons/react";

/** Native popover handles outside click, Escape and focus return. */
export function ActionMenu({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const id = useId();
  const [position, setPosition] = useState({ top: 0, left: 0 });
  return (
    <>
      <button
        type="button"
        className="ov-more-actions"
        aria-label={label}
        popoverTarget={id}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setPosition({
            top: Math.min(rect.bottom + 8, window.innerHeight - 210),
            left: Math.max(
              12,
              Math.min(rect.right - 240, window.innerWidth - 252),
            ),
          });
        }}
      >
        <DotsThree size={24} weight="bold" />
      </button>
      <div
        id={id}
        popover="auto"
        className="ov-planner-popover"
        style={position}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("button:not(:disabled)"))
            e.currentTarget.hidePopover();
        }}
      >
        {children}
      </div>
    </>
  );
}
