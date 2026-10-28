import bodies from "@/data/blog-bodies.json";
import type { BlogArticle } from "./articles";

type BodyBlock =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph" | "quote"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "image"; url: string; alt: string; caption: string; credit: string }
  | { type: "table"; rows: string[][] };
interface ArticleBody {
  schema_version: 1;
  source_url: string;
  content_kind?: "editorial_adaptation";
  recap?: boolean;
  editorial_extensions?: boolean;
  extension_start_index?: number;
  title?: string;
  blocks: BodyBlock[];
}
const isText = (value: unknown): value is string =>
  typeof value === "string" && value.length <= 20000;
export function parseArticleBody(
  value: unknown,
  sourceUrl: string,
): ArticleBody | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  if (
    body.schema_version !== 1 ||
    body.source_url !== sourceUrl ||
    (body.content_kind !== undefined &&
      body.content_kind !== "editorial_adaptation") ||
    (body.recap !== undefined && typeof body.recap !== "boolean") ||
    (body.editorial_extensions !== undefined &&
      typeof body.editorial_extensions !== "boolean") ||
    (body.extension_start_index !== undefined &&
      (!Number.isInteger(body.extension_start_index) ||
        Number(body.extension_start_index) < 0 ||
        Number(body.extension_start_index) >=
          (Array.isArray(body.blocks) ? body.blocks.length : 0))) ||
    (body.title !== undefined &&
      (!isText(body.title) || !body.title.trim() || body.title.length > 300)) ||
    !Array.isArray(body.blocks) ||
    !body.blocks.length ||
    body.blocks.length > 3000
  )
    return null;
  for (const block of body.blocks) {
    if (!block || typeof block !== "object") return null;
    switch (block.type) {
      case "heading":
        if (
          !isText(block.text) ||
          !Number.isInteger(block.level) ||
          block.level < 2 ||
          block.level > 6
        )
          return null;
        break;
      case "paragraph":
      case "quote":
        if (!isText(block.text)) return null;
        break;
      case "list":
        if (
          typeof block.ordered !== "boolean" ||
          !Array.isArray(block.items) ||
          !block.items.every(isText)
        )
          return null;
        break;
      case "table":
        if (
          !Array.isArray(block.rows) ||
          !block.rows.every(
            (row: unknown) => Array.isArray(row) && row.every(isText),
          )
        )
          return null;
        break;
      case "image":
        if (
          ![block.url, block.alt, block.caption, block.credit].every(isText) ||
          !/^https:\/\//.test(block.url)
        )
          return null;
        break;
      default:
        return null;
    }
  }
  return value as ArticleBody;
}
export function articleBody(article: BlogArticle) {
  return parseArticleBody(
    (bodies as Record<string, unknown>)[article.slug],
    article.url,
  );
}
export function ArticleBodyContent({
  body,
  article,
}: {
  body: ArticleBody;
  article: BlogArticle;
}) {
  return (
    <div className="ov-journal-body">
      {body.blocks.map((block, index) => {
        const extensionLabel =
          body.editorial_extensions && body.extension_start_index === index ? (
            <p className="ov-journal-extension-label">
              Идеи редакции для планирования поездки
            </p>
          ) : null;
        switch (block.type) {
          case "heading": {
            const Heading = `h${block.level}` as
              | "h2"
              | "h3"
              | "h4"
              | "h5"
              | "h6";
            return (
              <div key={index} className="ov-journal-section-heading">
                {extensionLabel}
                <Heading>{block.text}</Heading>
              </div>
            );
          }
          case "paragraph":
            return <p key={index}>{block.text}</p>;
          case "quote":
            return <blockquote key={index}>{block.text}</blockquote>;
          case "list": {
            const List = block.ordered ? "ol" : "ul";
            return (
              <List key={index}>
                {block.items.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </List>
            );
          }
          case "table":
            return (
              <div className="ov-journal-table" key={index}>
                <table>
                  <tbody>
                    {block.rows.map((row, i) => (
                      <tr key={i}>
                        {row.map((cell, j) => (
                          <td key={j}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "image": {
            const image = article.images.find(
              (image) => image.sourceUrl === block.url,
            );
            return image ? (
              <figure key={index}>
                <img
                  src={image.src}
                  width={image.width}
                  height={image.height}
                  alt={block.alt || image.caption}
                  loading="lazy"
                />
                <figcaption>
                  {block.caption.replace(/^Иллюстрация раздела:\s*/, "")}
                  {block.credit && <span>Фото: {block.credit}</span>}
                </figcaption>
              </figure>
            ) : null;
          }
        }
      })}
    </div>
  );
}
