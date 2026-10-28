import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  blogArticles,
  filterBlogArticles,
  filterBlogSection,
  sectionForBlogArticle,
  recommendBlogArticle,
  groupBlogCollections,
} from "../src/features/blog/articles";

const auditedSections: Record<string, string[]> = {
  actual: [
    "na-zavode-lada-v-peterburge-nachali-provodit-ekskursii",
    "v-pitere-zapustili-novyj-ekomarshrut-edem-gulyat-na-novyj-uchastok-ozyornoj-tropy",
    "belye-nochi-v-pitere",
    "10-idej-chem-zanyatsya-v-sankt-peterburge-osenyu",
    "novyj-god-v-sankt-peterburge-sovetuem-mesta-s-prazdnichnoj-atmosferoj",
  ],
  housing: [
    "10-glempingov-ryadom-s-peterburgom",
    "rajony-sankt-peterburga",
    "gde-luchshe-ostanovitsya-v-sankt-peterburge",
    "10-istoricheskix-kvartir-v-sankt-peterburge",
  ],
  places: [
    "peterburg-na-vykhodnye",
    "10-neobychnyx-muzeev-sankt-peterburga",
    "isaakievskij-sobor-v-sankt-peterburge",
    "zimnij-dvorec-v-sankt-peterburge-foto-istoriya-i-interesnye-fakty",
    "11-smotrovyx-ploshhadok-peterburga",
    "dyshim-zimnim-vozduxom-fontanka-sobrala-luchshie-ekotropy-peterburga-i-lenoblasti",
  ],
  tips: ["besplatnyj-sankt-peterburg", "chto-privezti-iz-sankt-peterburga"],
  experiences: [
    "6-avtorskix-restoranov-sankt-peterburga",
    "chto-poprobovat-v-peterburge",
    "luchshie-kofejni-peterburga",
    "kuda-sxodit-poest-v-pitere",
    "nedelya-v-sankt-peterburge-kuda-sxodit-s-detmi",
  ],
  guides: [
    "dostoprimechatelnosti-sankt-peterburga",
    "samye-krasivye-dvorcy-i-parki",
    "kuda-sezdit-na-vyxodnye-iz-peterburga",
  ],
};
test("each rubric contains the editorially audited articles, with every source article assigned once", () => {
  const assigned = Object.values(auditedSections).flat();
  assert.equal(assigned.length, 25);
  assert.equal(new Set(assigned).size, 25);
  assert.deepEqual(
    [...assigned].sort(),
    blogArticles.map((a) => a.slug).sort(),
  );
  for (const [section, expected] of Object.entries(auditedSections)) {
    const filtered = filterBlogSection("", section);
    assert.deepEqual(
      filtered.map((a) => a.slug).sort(),
      [...expected].sort(),
      section,
    );
    assert.ok(filtered.every((a) => sectionForBlogArticle(a) === section));
    const groups = groupBlogCollections("", section);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].id, section);
    assert.deepEqual(
      [groups[0].lead.slug, ...groups[0].articles.map((a) => a.slug)].sort(),
      [...expected].sort(),
    );
  }
});
test("search stays inside every selected rubric and respects news/accommodation overrides", () => {
  const cases = [
    [
      "actual",
      "LADA",
      "na-zavode-lada-v-peterburge-nachali-provodit-ekskursii",
    ],
    ["housing", "глэмпингов", "10-glempingov-ryadom-s-peterburgom"],
    ["places", "собор", "isaakievskij-sobor-v-sankt-peterburge"],
    ["tips", "сувениры", "chto-privezti-iz-sankt-peterburga"],
    ["experiences", "кофейни", "luchshie-kofejni-peterburga"],
    ["guides", "дворцы", "samye-krasivye-dvorcy-i-parki"],
  ];
  for (const [section, query, expected] of cases) {
    assert.deepEqual(
      filterBlogSection(query, section).map((a) => a.slug),
      [expected],
    );
    const groups = groupBlogCollections(query, section);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].lead.slug, expected);
    for (const other of Object.keys(auditedSections).filter(
      (id) => id !== section,
    ))
      assert.ok(
        filterBlogSection(query, other).every((a) => a.slug !== expected),
      );
  }
  const lada = blogArticles.find((a) => a.slug === cases[0][2])!;
  assert.equal(lada.date, "2026-10-28");
  assert.equal(
    lada.category,
    "unusual",
    "editorial rubric must not rewrite source metadata",
  );
});

test("collections partition all articles once and keep their featured article out of the carousel", () => {
  const groups = groupBlogCollections("", "all");
  assert.equal(groups.length, 6);
  const slugs = groups.flatMap((g) => [
    g.lead.slug,
    ...g.articles.map((a) => a.slug),
  ]);
  assert.equal(slugs.length, 25);
  assert.equal(new Set(slugs).size, 25);
  assert.ok(
    groups.every(
      (g) => g.title && g.description && g.leadLabel === "Выбор редакции",
    ),
  );
  const coffee = groupBlogCollections("кофейни", "experiences");
  assert.equal(coffee.length, 1);
  assert.equal(coffee[0].lead.slug, "luchshie-kofejni-peterburga");
  assert.equal(coffee[0].articles.length, 0);
  assert.deepEqual(groupBlogCollections("кофейни", "housing"), []);
});
test("real readership figures override editorial selection when supplied", () => {
  const article = blogArticles.find(
    (a) => a.slug === "luchshie-kofejni-peterburga",
  )!;
  try {
    article.views = 120;
    const group = groupBlogCollections("", "experiences")[0];
    assert.equal(group.lead.slug, article.slug);
    assert.equal(group.leadLabel, "Популярное в подборке");
  } finally {
    delete article.views;
  }
});

test("all imported articles preserve sources, dates and locally available photos", () => {
  assert.equal(blogArticles.length, 25);
  assert.equal(new Set(blogArticles.map((a) => a.slug)).size, 25);
  for (const article of blogArticles) {
    assert.equal(new URL(article.url).origin, "https://blog.ostrovok.ru");
    assert.match(article.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(article.summary && article.title && article.images.length);
    for (const image of article.images) {
      assert.ok(image.src.startsWith(`/ostrovok/blog/${article.slug}/`));
      assert.ok(existsSync(resolve(`public${image.src}`)), image.src);
    }
  }
  assert.equal(
    blogArticles.reduce((n, a) => n + a.images.length, 0),
    129,
  );
});
test("blog search combines topic and query without losing the full collection", () => {
  assert.equal(filterBlogArticles("", "all").length, 25);
  assert.equal(
    filterBlogArticles(" КОФЕЙНИ  ", "food")[0].slug,
    "luchshie-kofejni-peterburga",
  );
  assert.equal(filterBlogArticles("кофейни", "family").length, 0);
  assert.ok(filterBlogArticles("", "food").every((a) => a.category === "food"));
});
test("editorial recommendation follows draft wishes and confirmed preferences", () => {
  assert.equal(
    recommendBlogArticle("С детьми на выходные", null).article.category,
    "family",
  );
  assert.equal(
    recommendBlogArticle("Хочу кофе и уютные кофейни", null).article.slug,
    "luchshie-kofejni-peterburga",
  );
  assert.equal(
    recommendBlogArticle("Необычные музеи", null).article.slug,
    "10-neobychnyx-muzeev-sankt-peterburga",
  );
  assert.equal(
    recommendBlogArticle("Подарки и сувениры", null).article.slug,
    "chto-privezti-iz-sankt-peterburga",
  );
  assert.equal(
    recommendBlogArticle("", { profile: { children: 2 } }).article.category,
    "family",
  );
  assert.equal(
    recommendBlogArticle("", {
      expectations: { criteria: [{ key: "restaurants", value: true }] },
    }).article.category,
    "food",
  );
  assert.equal(
    recommendBlogArticle("кофе", { profile: { children: 2 } }).article.slug,
    "luchshie-kofejni-peterburga",
  );
});
test("assistant questions, unconfirmed criteria and malformed history cannot invent interests", () => {
  for (const state of [
    null,
    "broken",
    [],
    {
      messages: [
        { role: "assistant", content: "Хотите с детьми или в рестораны?" },
      ],
    },
    { expectations: { criteria: [{ key: "children", value: false }] } },
  ]) {
    const result = recommendBlogArticle("", state);
    assert.equal(result.article.slug, "peterburg-na-vykhodnye");
    assert.equal(result.personalized, false);
  }
  assert.notEqual(
    recommendBlogArticle("Едем без детей", null).article.category,
    "family",
  );
});
