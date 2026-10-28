import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import {
  articleBySlug,
  blogArticles,
  blogDate,
} from "@/features/blog/articles";
import { BlogCard } from "@/features/blog/catalog";
import { articleBody, ArticleBodyContent } from "@/features/blog/article-body";
import { ReadingEngagement } from "@/features/blog/reading-engagement";
import { BlogTripBanner } from "@/features/blog/trip-banner";
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const article = articleBySlug((await params).slug);
  const body = article && articleBody(article);
  return article
    ? { title: body?.title || article.title, description: article.summary }
    : { title: "Материал не найден" };
}
export default async function ArticlePage({ params }: Props) {
  const article = articleBySlug((await params).slug);
  if (!article) notFound();
  const body = articleBody(article);
  const related = [
    ...blogArticles.filter(
      (a) => a.category === article.category && a.slug !== article.slug,
    ),
    ...blogArticles.filter((a) => a.category !== article.category),
  ].slice(0, 3);
  return (
    <>
      <div className="ov-container ov-journal ov-journal-article">
        <Link href="/blog" className="ov-blog-text-link ov-journal-back">
          <ArrowLeft size={19} /> Все статьи
        </Link>
        <article>
          <header className="ov-journal-article-heading">
            <span className="ov-blog-eyebrow">
              О!Блог · {article.categoryLabel}
            </span>
            <h1>{body?.title || article.title}</h1>
            <div className="ov-journal-byline">
              {body?.content_kind === "editorial_adaptation" ? (
                <>
                  <span>
                    {body.recap ? "Пересказ статьи" : "Редакционная адаптация"}
                  </span>
                  <time dateTime={article.date}>
                    По материалу от {blogDate(article.date)}
                  </time>
                </>
              ) : (
                <>
                  <time dateTime={article.date}>{blogDate(article.date)}</time>
                  {article.author && <span>{article.author}</span>}
                </>
              )}
            </div>
          </header>
          <figure className="ov-journal-cover">
            <img
              src={article.images[0].src}
              width={article.images[0].width}
              height={article.images[0].height}
              alt={article.title}
              fetchPriority="high"
            />
            {article.images[0].credit && (
              <figcaption>Фото: {article.images[0].credit}</figcaption>
            )}
          </figure>
          <div className="ov-journal-intro">
            <p>{article.summary}</p>
            <div className="ov-journal-tags">
              {article.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
            {!body && (
              <>
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ov-button"
                >
                  Читать полную статью в О!Блоге <ArrowUpRight size={20} />
                </a>
                <p className="ov-journal-source-note">
                  {body ? (
                    "Источник материала — блог Островка."
                  ) : (
                    <>
                      Здесь — краткое описание и фотографии материала. Полный
                      текст — в блоге Островка.
                    </>
                  )}
                </p>
              </>
            )}
          </div>
          {body && <ArticleBodyContent article={article} body={body} />}
          {body && (
            <ReadingEngagement
              articleSlug={article.slug}
              title={article.title}
              category={article.category}
              tags={article.tags}
            />
          )}
          {body && (
            <aside
              className="ov-journal-original"
              aria-label="Источник материала"
            >
              <p>
                {body.content_kind === "editorial_adaptation"
                  ? body.recap
                    ? "Пересказ по материалам О!Блога."
                    : "Редакционная адаптация по материалам О!Блога."
                  : "Источник материала — О!Блог."}
                {article.author &&
                  ` Автор исходного материала — ${article.author}.`}
              </p>
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="ov-blog-text-link"
              >
                Читать оригинал в О!Блоге <ArrowUpRight size={18} />
              </a>
            </aside>
          )}
          {!body && article.images.length > 1 && (
            <section
              className="ov-journal-gallery"
              aria-labelledby="article-gallery-title"
            >
              <h2 id="article-gallery-title">Вдохновение в деталях</h2>
              <div>
                {article.images.slice(1).map((image) => (
                  <figure key={image.src}>
                    <img
                      src={image.src}
                      width={image.width}
                      height={image.height}
                      alt={image.caption || article.title}
                      loading="lazy"
                    />
                    <figcaption>
                      {image.caption.replace(/^Иллюстрация раздела:\s*/, "")}
                      {image.credit && <span>Фото: {image.credit}</span>}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </section>
          )}
        </article>
        <section
          className="ov-journal-related"
          aria-labelledby="related-articles-title"
        >
          <h2 id="related-articles-title">Ещё идеи для Петербурга</h2>
          <div className="ov-journal-grid">
            {related.map((a) => (
              <BlogCard key={a.slug} article={a} />
            ))}
          </div>
        </section>
      </div>
      <div className="ov-blog-related-scene ov-article-final-scene has-trip-banner">
        <div
          className="ov-blog-related-backdrop"
          aria-hidden="true"
          style={{
            backgroundImage:
              'linear-gradient(#142d3b70, #142d3b9f), url("/ostrovok/petersburg-background.jpg")',
          }}
        />
        <BlogTripBanner embedded />
      </div>
    </>
  );
}
