import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { blogDate, type BlogArticle } from "./articles";

export function BlogFeature({
  article,
  label,
}: {
  article: BlogArticle;
  label: React.ReactNode;
}) {
  return (
    <article className="ov-blog-feature" data-article={article.slug}>
      <Link
        href={`/blog/${article.slug}`}
        className="ov-blog-feature-image"
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
      </Link>
      <div className="ov-blog-feature-copy">
        <span className="ov-blog-reason">{label}</span>
        <h3>
          <Link href={`/blog/${article.slug}`}>{article.title}</Link>
        </h3>
        <p>{article.summary}</p>
        <div className="ov-blog-feature-bottom">
          <time dateTime={article.date}>{blogDate(article.date)}</time>
          <Link className="ov-blog-read" href={`/blog/${article.slug}`}>
            Читать <ArrowRight size={20} />
          </Link>
        </div>
      </div>
    </article>
  );
}
