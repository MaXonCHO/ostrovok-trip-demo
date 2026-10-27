"use client";
import { useState, type ImgHTMLAttributes } from "react";
import { ImageBroken } from "@phosphor-icons/react";
export function Photo(props: ImgHTMLAttributes<HTMLImageElement>) {
  const [failed, setFailed] = useState<string | undefined>(undefined);
  if (!props.src || failed === props.src)
    return (
      <div
        className={`photo-unavailable ${props.className ?? ""}`}
        role="img"
        aria-label="Фотография пока недоступна"
      >
        <ImageBroken size={28} />
        <span>Фотография пока недоступна</span>
      </div>
    );
  return (
    <img
      {...props}
      alt={props.alt ?? ""}
      draggable={false}
      onError={() => setFailed(String(props.src))}
    />
  );
}
