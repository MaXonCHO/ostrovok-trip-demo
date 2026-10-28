"use client";
import { useEffect, useRef } from "react";
import { ArrowUpRight, MapPin } from "@phosphor-icons/react";
import {
  AutumnOffers,
  MysticRoutes,
  HalloweenStays,
  GastroNotes,
  TravelBlog,
} from "./home-blocks";
import { TravelPrompt } from "./travel-prompt";
import { BlogRecommendation } from "@/features/blog/recommendation";

export function OstrovokHome() {
  const heroRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    const motion = window.matchMedia(
      "(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)",
    );
    let frame = 0;
    let x = 0;
    let y = 0;
    const paint = () => {
      frame = 0;
      hero.style.setProperty("--hero-pan-x", `${x.toFixed(2)}px`);
      hero.style.setProperty("--hero-pan-y", `${y.toFixed(2)}px`);
    };
    const reset = () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
        frame = 0;
      }
      x = 0;
      y = 0;
      paint();
    };
    const move = (event: PointerEvent) => {
      if (!motion.matches || event.pointerType !== "mouse") return;
      const bounds = hero.getBoundingClientRect();
      x = ((event.clientX - bounds.left) / bounds.width - 0.5) * -18;
      y = ((event.clientY - bounds.top) / bounds.height - 0.5) * -14;
      if (!frame) frame = window.requestAnimationFrame(paint);
    };
    hero.addEventListener("pointermove", move, { passive: true });
    hero.addEventListener("pointerleave", reset);
    motion.addEventListener("change", reset);
    return () => {
      hero.removeEventListener("pointermove", move);
      hero.removeEventListener("pointerleave", reset);
      motion.removeEventListener("change", reset);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);
  return (
    <>
      <section className="ov-hero" ref={heroRef}>
        <div className="ov-hero-media" aria-hidden="true">
          <img
            className="ov-hero-cover"
            src="/ostrovok/home-cover.png"
            alt="Горная долина и река на Алтае"
            fetchPriority="high"
          />
          <div className="ov-hero-shade" />
        </div>
        <div className="ov-container ov-hero-content">
          <h1>
            Отели, в которых
            <br />
            хочется остаться
          </h1>
          <TravelPrompt />
        </div>
        <span className="ov-hero-location">
          <MapPin size={15} />
          Алтай, Россия
        </span>
      </section>
      <div className="ov-home-white ov-home-upper">
        <div className="ov-container">
          <AutumnOffers />
          <BlogRecommendation />
          <MysticRoutes />
          <GastroNotes />
        </div>
      </div>
      <HalloweenStays />
      <div className="ov-home-white ov-home-lower">
        <div className="ov-container">
          <TravelBlog />
        </div>
      </div>
      <section className="ov-final-cta" aria-labelledby="closer-to-holiday">
        <div className="ov-final-cta-backdrop" aria-hidden="true" />
        <div className="ov-final-cta-content">
          <p>Где начнётся ваша следующая история?</p>
          <h2 id="closer-to-holiday">
            Давайте ближе
            <br />к отпуску.
          </h2>
          <button
            className="ov-button"
            onClick={() => {
              window.dispatchEvent(new Event("ov:focus-request"));
            }}
          >
            Начать мою поездку <ArrowUpRight size={23} />
          </button>
        </div>
      </section>
    </>
  );
}
