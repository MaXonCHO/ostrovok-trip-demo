import test from "node:test";
import assert from "node:assert/strict";
import {
  articleBody,
  parseArticleBody,
} from "../src/features/blog/article-body";
import { blogArticles } from "../src/features/blog/articles";
const source = "https://blog.ostrovok.ru/test-article/";
test("structured article bodies preserve supplied sections and reject wrong sources or HTML blocks", () => {
  const blocks = [
    { type: "heading", level: 2, text: "Синтетический заголовок" },
    { type: "paragraph", text: "Собственный тестовый текст." },
    { type: "list", ordered: false, items: ["Пункт 1", "Пункт 2"] },
    { type: "quote", text: "Тестовая цитата" },
    {
      type: "table",
      rows: [
        ["Имя", "Описание"],
        ["Пример", "Значение"],
      ],
    },
    {
      type: "image",
      url: "https://blog.ostrovok.ru/test.webp",
      alt: "Тест",
      caption: "Подпись",
      credit: "Автор",
    },
  ];
  const body = { schema_version: 1, source_url: source, blocks };
  assert.deepEqual(parseArticleBody(body, source)?.blocks, blocks);
  assert.equal(parseArticleBody(body, "https://blog.ostrovok.ru/other/"), null);
  assert.equal(
    parseArticleBody(
      { ...body, blocks: [{ type: "html", html: "<script>test()</script>" }] },
      source,
    ),
    null,
  );
  assert.equal(
    parseArticleBody(
      {
        ...body,
        blocks: [{ type: "heading", level: 1, text: "Неверный уровень" }],
      },
      source,
    ),
    null,
  );
  assert.equal(
    parseArticleBody(
      { ...body, blocks: [{ type: "list", ordered: true, items: [42] }] },
      source,
    ),
    null,
  );
  assert.equal(
    parseArticleBody(
      {
        ...body,
        blocks: [
          {
            type: "image",
            url: "javascript:test()",
            alt: "",
            caption: "",
            credit: "",
          },
        ],
      },
      source,
    ),
    null,
  );
});

test("all 25 articles have readable recaps, source links and correctly matched local illustrations", () => {
  for (const article of blogArticles) {
    const body = articleBody(article);
    assert.ok(body, `Missing body: ${article.slug}`);
    assert.equal(body.recap, true, article.slug);
    assert.equal(body.content_kind, "editorial_adaptation");
    assert.ok(body.title?.trim());
    assert.equal(body.source_url, article.url);
    assert.ok(
      body.blocks.filter((b) => b.type === "paragraph").length >= 4,
      article.slug,
    );
    assert.ok(
      body.blocks.filter((b) => b.type === "heading").length >= 3,
      article.slug,
    );
    const prose = [
      body.title,
      ...body.blocks
        .slice(0, body.extension_start_index ?? body.blocks.length)
        .flatMap((b) =>
          b.type === "paragraph" || b.type === "heading" || b.type === "quote"
            ? [b.text]
            : b.type === "list"
              ? b.items
              : [],
        ),
    ].join(" ");
    const words = prose.trim().split(/\s+/).length;
    assert.ok(words >= 150 && words <= 200, `${article.slug}: ${words} words`);
    assert.equal(body.editorial_extensions, true);
    const fullText = body.blocks
      .flatMap((b) =>
        "text" in b ? [b.text] : b.type === "list" ? b.items : [],
      )
      .join(" ");
    assert.ok(
      fullText.trim().split(/\s+/).length >= 340,
      `Article must be expanded: ${article.slug}`,
    );
    const illustrated = new Set<string>();
    for (let index = 1; index < body.blocks.length; index++) {
      assert.ok(
        !(
          body.blocks[index].type === "image" &&
          body.blocks[index - 1].type === "image"
        ),
        `Images need contextual text between them: ${article.slug}`,
      );
    }
    for (const block of body.blocks)
      if (block.type === "image") {
        assert.ok(
          article.images.some((image) => image.sourceUrl === block.url),
          article.slug,
        );
        assert.notEqual(
          block.url,
          article.images[0].sourceUrl,
          "Cover must not repeat in the body",
        );
        assert.ok(!illustrated.has(block.url), "Body image must not repeat");
        illustrated.add(block.url);
      }
  }
});
