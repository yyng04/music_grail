import { expect, test, type Page } from "@playwright/test";

// One plain line above the board says whose roles the colours and
// numbers show, and follows the focus chord in every mode.
async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
}
const line = (page: Page) => page.locator(".board-reference");
async function pick(page: Page, name: RegExp) {
  const fold = page.locator("button.shape-title[aria-expanded='false']");
  if (await fold.count()) await fold.click();
  await page
    .getByRole("group", { name: "Chord" })
    .getByRole("button", { name })
    .click();
}

for (const mode of ["", "&show=triads", "&show=pairs", "&show=guide"]) {
  test(`the reference line follows the focus chord (${mode || "scale"})`, async ({
    page,
  }) => {
    await page.goto(`./#p=G-major&view=fretboard${mode}`);
    await settle(page);
    const words = mode === "&show=guide" ? "Colours" : "Colours and numbers";
    await expect(line(page)).toHaveText(`${words}: roles in G major`);
    await pick(page, /^vi7 Em7/);
    await expect(line(page)).toHaveText(`${words}: roles in Em7`);
    await pick(page, /^vi7 Em7/);
    await expect(line(page)).toHaveText(`${words}: roles in G major`);
  });
}

for (const state of [
  { name: "without-focus", hash: "#p=G-major&view=fretboard" },
  { name: "with-focus-em7", hash: "#p=G-major&pchord=E-m7&view=fretboard" },
]) {
  test(`screenshot reference line ${state.name}`, async ({ page }, info) => {
    await page.goto(`./${state.hash}`);
    await settle(page);
    await page.screenshot({
      path: `tests/e2e/__screenshots__/m3b-reference-${state.name}-${info.project.name}.png`,
      fullPage: info.project.name === "mobile",
    });
  });
}
