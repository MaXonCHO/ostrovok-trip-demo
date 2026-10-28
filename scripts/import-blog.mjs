import { readFile, mkdir, copyFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";

const root = process.cwd();
const source = resolve(root, "ostrovok_blog_parser");
const articles = JSON.parse(
  await readFile(resolve(source, "data/articles.json"), "utf8"),
);
const slugs = new Set();
const imported = [];
const bodies = {};
for (const article of articles) {
  if (!/^[a-z0-9-]+$/.test(article.slug) || slugs.has(article.slug))
    throw Error("Invalid or duplicate article slug");
  slugs.add(article.slug);
  try {
    const body = JSON.parse(
      await readFile(
        resolve(root, "data/article-bodies", `${article.slug}.json`),
        "utf8",
      ),
    );
    if (
      body.schema_version !== 1 ||
      body.source_url !== article.url ||
      !Array.isArray(body.blocks)
    )
      throw Error(`Invalid article body: ${article.slug}`);
    bodies[article.slug] = body;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (new URL(article.url).origin !== "https://blog.ostrovok.ru")
    throw Error("Unexpected article source");
  const images = [];
  for (const image of article.images) {
    const imagePrefix = `articles/${article.slug}/images/`;
    if (
      !image.path.startsWith(imagePrefix) ||
      !/^[a-zA-Z0-9_.-]+\.webp$/.test(image.path.slice(imagePrefix.length))
    )
      throw Error("Invalid local image path");
    const path = `/ostrovok/blog/${article.slug}/${image.path.split("/").at(-1)}`;
    const destination = resolve(root, `public${path}`);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(resolve(source, image.path), destination);
    images.push({
      src: path,
      width: image.width,
      height: image.height,
      caption: image.caption,
      credit: image.credit,
      sourceUrl: image.original_url,
    });
  }
  if (!images.length) throw Error(`Article without photos: ${article.slug}`);
  imported.push({
    slug: article.slug,
    title: article.title,
    url: article.url,
    date: article.date_published,
    author: article.author,
    category: article.category,
    categoryLabel: article.category_label,
    summary: article.summary,
    ...(Number.isFinite(article.views) && article.views >= 0
      ? { views: article.views }
      : {}),
    tags: article.tags,
    images,
  });
}
await mkdir(resolve(root, "src/data"), { recursive: true });
await writeFile(
  resolve(root, "src/data/blog-articles.json"),
  JSON.stringify(imported, null, 2) + "\n",
);
await writeFile(
  resolve(root, "src/data/blog-bodies.json"),
  JSON.stringify(bodies, null, 2) + "\n",
);
console.log(
  `Imported ${imported.length} articles, ${Object.keys(bodies).length} article bodies and ${imported.reduce((n, a) => n + a.images.length, 0)} photos.`,
);
