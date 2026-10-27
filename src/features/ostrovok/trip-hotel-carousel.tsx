"use client";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import type { Hotel } from "./catalog";
import { money } from "./search-state";

export function TripHotelCarousel({
  options,
  query,
  label,
}: {
  options: Hotel[];
  query: string;
  label: string;
}) {
  const track = useRef<HTMLDivElement>(null);
  const id = useId();
  const [edges, setEdges] = useState({ left: false, right: false });
  const hotelIds = options.map((h) => h.id).join(",");
  useEffect(() => {
    const element = track.current;
    if (!element) return;
    const update = () => {
      const left = element.scrollLeft > 2;
      const right =
        element.scrollLeft + element.clientWidth < element.scrollWidth - 2;
      setEdges((old) =>
        old.left === left && old.right === right ? old : { left, right },
      );
    };
    const observer = new ResizeObserver(update);
    observer.observe(element);
    for (const child of element.children) observer.observe(child);
    element.addEventListener("scroll", update, { passive: true });
    update();
    return () => {
      observer.disconnect();
      element.removeEventListener("scroll", update);
    };
  }, [hotelIds]);
  const scroll = (direction: number) => {
    const element = track.current;
    if (!element) return;
    const step =
      (element.firstElementChild?.getBoundingClientRect().width || 320) + 16;
    element.scrollBy({
      left: step * direction,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  };
  return (
    <div className="ov-trip-carousel">
      {(edges.left || edges.right) && (
        <div className="ov-trip-carousel-controls">
          {edges.left && (
            <button
              className="ov-trip-carousel-prev"
              type="button"
              aria-label={`Назад: ${label}`}
              aria-controls={id}
              onClick={() => scroll(-1)}
            >
              <CaretLeft size={22} />
            </button>
          )}
          {edges.right && (
            <button
              className="ov-trip-carousel-next"
              type="button"
              aria-label={`Дальше: ${label}`}
              aria-controls={id}
              onClick={() => scroll(1)}
            >
              <CaretRight size={22} />
            </button>
          )}
        </div>
      )}
      {options.length ? (
        <div
          className="ov-trip-hotel-track"
          id={id}
          ref={track}
          tabIndex={0}
          aria-label={`Отели: ${label}`}
        >
          {options.map((h) => (
            <Link
              key={h.slug}
              className="ov-trip-hotel-card"
              href={`/hotel/${h.slug}?${query}`}
            >
              <div className="ov-image-window">
                <img src={h.photos[0]} alt={h.name} />
              </div>
              <div className="ov-trip-hotel-info">
                <h4>{h.name}</h4>
                <p>{h.city}</p>
                <strong>от {money(h.price)}</strong>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="ov-trip-empty-pool">
          В текущем каталоге нет отелей под все условия. Уточним в диалоге,
          какое из них можно изменить.
        </p>
      )}
    </div>
  );
}
