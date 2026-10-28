import { test, expect, type Page } from "@playwright/test";

const slug = "chto-poprobovat-v-peterburge";
async function openArticle(page: Page) {
  await page.route("**/api/trip-chat", (route) => route.abort());
  await page.goto(`/blog/${slug}`);
  await expect(page.locator(".ov-journal-body")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Полезная статья", exact: true }),
  ).toBeEnabled();
}
async function selectDoughnuts(page: Page) {
  const paragraph = page
    .locator(".ov-journal-body p")
    .filter({ hasText: /Пышечные предлагают/ })
    .first();
  await paragraph.scrollIntoViewIfNeeded();
  const text = (await paragraph.innerText()).replace(/\s+/g, " ").trim();
  await paragraph.evaluate((element) => {
    const selection = window.getSelection()!;
    const range = document.createRange();
    range.selectNodeContents(element);
    selection.removeAllRanges();
    selection.addRange(range);
    document.dispatchEvent(new Event("selectionchange"));
    document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  });
  const save = page.getByRole("button", {
    name: "Сохранить заметку",
    exact: true,
  });
  await expect(save).toBeVisible();
  return { text, save };
}
test("a useful article and selected note persist, infer dining interests and can be removed", async ({
  page,
}) => {
  await openArticle(page);
  const like = page.getByRole("button", {
    name: "Полезная статья",
    exact: true,
  });
  await like.click();
  await expect(like).toHaveAttribute("aria-pressed", "true");
  await expect(like).toBeEnabled();
  await page.reload();
  await expect(like).toBeEnabled();
  await expect(like).toHaveAttribute("aria-pressed", "true");
  let summary = await (await page.request.get("/api/reading-interest")).json();
  expect(summary.inferredExpectations.criteria).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        key: "restaurants",
        importance: "preferred",
        value: true,
      }),
    ]),
  );
  const { text, save } = await selectDoughnuts(page);
  await save.click();
  await expect(page.locator(".ov-reading-note")).toHaveCount(1);
  await expect(page.locator(".ov-reading-note p")).toHaveText(text);
  const persisted = await (
    await page.request.get(`/api/reading-interest?slug=${slug}`)
  ).json();
  expect(persisted.liked).toBe(true);
  expect(persisted.notes[0].text).toBe(text);
  summary = await (await page.request.get("/api/reading-interest")).json();
  expect(
    summary.inferredExpectations.criteria.find(
      (c: { key: string }) => c.key === "restaurants",
    ).detail,
  ).toContain("Пышки");
  await page.goto("/blog");
  const sharedNote = page.locator(".ov-blog-note-card");
  await expect(
    page.getByRole("heading", { name: "Заметки", exact: true }),
  ).toBeVisible();
  await expect(sharedNote.locator("blockquote p")).toHaveText(text);
  await expect(sharedNote.getByRole("link")).toHaveAttribute(
    "href",
    `/blog/${slug}`,
  );
  await sharedNote.getByRole("link").click();
  await expect(page).toHaveURL(new RegExp(`/blog/${slug}$`));
  await page.reload();
  await expect(page.locator(".ov-reading-note p")).toHaveText(text);
  await page
    .getByRole("button", { name: "Удалить заметку", exact: true })
    .click();
  await expect(page.locator(".ov-reading-note")).toHaveCount(0);
  expect(
    (
      await (
        await page.request.get(`/api/reading-interest?slug=${slug}`)
      ).json()
    ).notes,
  ).toHaveLength(0);
  const invalid = await page.request.post("/api/reading-interest", {
    data: {
      slug,
      note: "Придуманный фрагмент, которого нет в тексте этой статьи.",
    },
  });
  expect(invalid.status()).toBe(400);
  await page.locator(".ov-reading").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/reading-desktop.png" });
});

test("mobile selection action fits the viewport and saving is always explicit", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openArticle(page);
  const { text, save } = await selectDoughnuts(page);
  expect(
    (
      await (
        await page.request.get(`/api/reading-interest?slug=${slug}`)
      ).json()
    ).notes,
  ).toHaveLength(0);
  const bounds = await save.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
  await page.screenshot({ path: "test-results/reading-mobile-selection.png" });
  await save.click();
  await expect(page.locator(".ov-reading-note p")).toHaveText(text);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.locator(".ov-reading").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/reading-mobile-note.png" });
  await page.goto("/blog");
  const saved = page.locator(".ov-blog-note-card");
  await expect(saved.locator("blockquote p")).toHaveText(text);
  await saved.scrollIntoViewIfNeeded();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "test-results/blog-notes-mobile.png" });
  await saved
    .getByRole("button", { name: /Удалить заметку из статьи/ })
    .click();
  await expect(saved).toHaveCount(0);
  await expect(page.locator(".ov-blog-notes-empty")).toContainText(
    "сохранённые заметки появятся здесь",
  );
  expect(
    (
      await (
        await page.request.get(`/api/reading-interest?slug=${slug}`)
      ).json()
    ).notes,
  ).toHaveLength(0);
});
