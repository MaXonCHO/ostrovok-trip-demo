"use client";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { ArrowRight, CaretLeft, CaretRight } from "@phosphor-icons/react";
import {
  blogArticles,
  blogDate,
  filterBlogSection,
  groupBlogCollections,
  type BlogArticle,
} from "./articles";
import { BlogHero } from "./hero";
import { BlogFeature } from "./feature";
import { BlogTripBanner } from "./trip-banner";
import { BlogNotes } from "./notes";

export function BlogCard({
  article,
  compact = false,
}: {
  article: BlogArticle;
  compact?: boolean;
}) {
  return (
    <article className={`ov-journal-card${compact ? " is-compact" : ""}`}>
      <Link
        href={`/blog/${article.slug}`}
        className="ov-journal-card-photo"
        tabIndex={-1}
        aria-hidden="true"
      >
        <img
          src={article.images[0].src}
          width={article.images[0].width}
          height={article.images[0].height}
          alt=""
          loading="lazy"
        />
        <span>{article.categoryLabel}</span>
      </Link>
      <div className="ov-journal-card-copy">
        <time dateTime={article.date}>{blogDate(article.date)}</time>
        <h3>
          <Link href={`/blog/${article.slug}`}>{article.title}</Link>
        </h3>
        {!compact && <p>{article.summary}</p>}
        <Link
          href={`/blog/${article.slug}`}
          className="ov-blog-text-link"
          aria-label={`Читать: ${article.title}`}
        >
          Читать <ArrowRight size={18} />
        </Link>
      </div>
    </article>
  );
}
function BlogCarousel({
  articles,
  title,
}: {
  articles: BlogArticle[];
  title: string;
}) {
  const track = useRef<HTMLDivElement>(null);
  const id = useId();
  const [edges, setEdges] = useState({ left: false, right: false });
  useEffect(() => {
    const element = track.current;
    if (!element) return;
    const update = () =>
      setEdges({
        left: element.scrollLeft > 2,
        right:
          element.scrollLeft + element.clientWidth < element.scrollWidth - 2,
      });
    const observer = new ResizeObserver(update);
    observer.observe(element);
    for (const child of element.children) observer.observe(child);
    element.addEventListener("scroll", update, { passive: true });
    update();
    return () => {
      observer.disconnect();
      element.removeEventListener("scroll", update);
    };
  }, []);
  const move = (direction: number) => {
    const element = track.current;
    if (!element) return;
    element.scrollBy({
      left:
        direction *
        ((element.firstElementChild?.getBoundingClientRect().width ?? 320) +
          22),
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  };
  return (
    <div className="ov-blog-carousel">
      <div
        id={id}
        ref={track}
        className="ov-blog-article-track"
        tabIndex={0}
        role="region"
        aria-label={`Другие статьи: ${title}`}
      >
        {articles.map((article) => (
          <BlogCard article={article} key={article.slug} compact />
        ))}
      </div>
      {edges.left && (
        <button
          className="ov-blog-carousel-prev"
          aria-label={`Назад: ${title}`}
          aria-controls={id}
          onClick={() => move(-1)}
        >
          <CaretLeft size={24} />
        </button>
      )}
      {edges.right && (
        <button
          className="ov-blog-carousel-next"
          aria-label={`Дальше: ${title}`}
          aria-controls={id}
          onClick={() => move(1)}
        >
          <CaretRight size={24} />
        </button>
      )}
    </div>
  );
}
export function BlogCatalog({
  initialTopic = "all",
}: {
  initialTopic?: string;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(initialTopic);
  const visible = filterBlogSection(query, category);
  const collections = groupBlogCollections(query, category);
  return (
    <>
      <BlogHero
        query={query}
        onQueryChange={setQuery}
        category={category}
        onCategoryChange={setCategory}
        articleCount={blogArticles.length}
      />
      <div className="ov-journal-content">
        <BlogNotes />
        <p className="ov-journal-results ov-container" role="status">
          Показано: {visible.length}
        </p>
        {visible.length ? (
          <div className="ov-journal-collections">
            {collections.map((collection, index) => (
              <section
                className="ov-journal-collection"
                key={collection.id}
                aria-labelledby={`collection-${collection.id}`}
              >
                <div className="ov-blog-collection-sheet">
                  <div className="ov-container">
                    <header>
                      <h2 id={`collection-${collection.id}`}>
                        {collection.title}
                      </h2>
                      <p>{collection.description}</p>
                    </header>
                    <BlogFeature
                      article={collection.lead}
                      label={collection.leadLabel}
                    />
                  </div>
                </div>
                {(collection.articles.length > 0 ||
                  index === collections.length - 1) && (
                  <div
                    className={`ov-blog-related-scene${index === collections.length - 1 ? " has-trip-banner" : ""}`}
                  >
                    <div
                      className="ov-blog-related-backdrop"
                      aria-hidden="true"
                      style={{
                        backgroundImage: `linear-gradient(180deg, #142d3b70, #142d3bbf), url("${collection.lead.images.at(-1)!.src}")`,
                      }}
                    />
                    {collection.articles.length > 0 && (
                      <div className="ov-container">
                        <h3 className="ov-blog-related-title">
                          Ещё идеи для вашей поездки
                        </h3>
                        <BlogCarousel
                          key={collection.articles.map((a) => a.slug).join(",")}
                          articles={collection.articles}
                          title={collection.title}
                        />
                      </div>
                    )}
                    {index === collections.length - 1 && (
                      <BlogTripBanner embedded />
                    )}
                  </div>
                )}
              </section>
            ))}
          </div>
        ) : (
          <div className="ov-journal-empty">
            <h2>Пока ничего не нашлось</h2>
            <p>Попробуйте другую тему или более короткий запрос.</p>
            <button
              className="ov-button"
              onClick={() => {
                setCategory("all");
                setQuery("");
              }}
            >
              Показать все статьи
            </button>
          </div>
        )}
      </div>
    </>
  );
}
