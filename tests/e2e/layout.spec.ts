import { expect, test, type Page } from "@playwright/test";

// The control bar above the board wraps instead of running off the edge, in
// every mode and at every width (also run in WebKit, see playwright.config.ts).
const states = [
  "#p=G-major&view=fretboard",
  "#p=G-major&view=fretboard&show=triads",
  "#p=G-major&pchord=G-maj7&view=fretboard&show=shells",
  "#p=C-major&pchord=G-7&view=fretboard&show=pairs",
  "#p=G-major&view=fretboard&show=harmony&in=6ths",
  "#p=G-major&pchord=G-maj7&view=fretboard&show=guide",
];

async function overflow(page: Page) {
  return page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const bad: string[] = [];
    for (const el of document.querySelectorAll(
      ".board-bar *, .shape-bar *, .strip-group > .choice-label",
    )) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.right > width + 0.5)
        bad.push(`${el.tagName} "${el.textContent.slice(0, 24)}"`);
    }
    const bar = document.querySelector(".shape-bar");
    if (bar && bar.scrollWidth > bar.clientWidth + 0.5)
      bad.push("shape-bar scrolls");
    return bad;
  });
}

for (const width of [1440, 1280, 1024, 768]) {
  test(`nothing in the control bar runs off at ${String(width)}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const hash of states) {
      await page.goto(`./${hash}`);
      await page.evaluate(() => document.fonts.ready);
      expect(await overflow(page), hash).toEqual([]);
    }
  });
}

test("on a phone, the opened settings fit the screen", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  for (const hash of states) {
    await page.goto(`./${hash}`);
    await page.evaluate(() => document.fonts.ready);
    const fold = page.locator("button.shape-title");
    if (await fold.count()) await fold.click();
    expect(await overflow(page), hash).toEqual([]);
  }
});
