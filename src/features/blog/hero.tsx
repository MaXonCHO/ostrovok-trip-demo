"use client";

import { MagnifyingGlass, X } from "@phosphor-icons/react";
import { BlogRubrics } from "./masthead";

export interface BlogHeroProps {
  query: string;
  onQueryChange: (query: string) => void;
  category: string;
  onCategoryChange: (category: string) => void;
  articleCount: number;
}

export function BlogHero({
  query,
  onQueryChange,
  category,
  onCategoryChange,
  articleCount,
}: BlogHeroProps) {
  return (
    <section className="ov-blog-hero" aria-labelledby="blog-hero-heading">
      <div className="ov-blog-hero-media" aria-hidden="true">
        <img
          src="/ostrovok/petersburg-background.jpg"
          alt=""
          fetchPriority="high"
        />
      </div>
      <div className="ov-container ov-blog-hero-inner">
        <div className="ov-blog-hero-copy">
          <h1 id="blog-hero-heading">
            Вдохновение для ваших путешествий от О!Блога
          </h1>
          <p>
            Небанальные места, прогулки и маленькие открытия. Собрали идеи для
            вашей следующей поездки.
          </p>
          <span className="ov-blog-hero-count">
            {articleCount} идей для новых впечатлений
          </span>
        </div>
        <div className="ov-blog-hero-panel">
          <label className="ov-blog-hero-search">
            <MagnifyingGlass size={25} aria-hidden="true" />
            <input
              type="search"
              aria-label="Поиск по статьям"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Музеи, кофейни, прогулки…"
              autoComplete="off"
            />
            {query && (
              <button
                type="button"
                aria-label="Очистить поиск"
                onClick={() => onQueryChange("")}
              >
                <X size={21} aria-hidden="true" />
              </button>
            )}
          </label>
          <BlogRubrics section={category} onSection={onCategoryChange} />
        </div>
      </div>
    </section>
  );
}
