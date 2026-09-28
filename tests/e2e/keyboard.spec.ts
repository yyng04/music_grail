import { expect, test, type Page } from "@playwright/test";

// Every control is reachable with Tab; the circle's 36 cells, the shape
// strip and the notes on the board are single tab stops moved with the arrows.
async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
}
const focusedName = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    return el?.getAttribute("aria-label") ?? el?.textContent ?? "";
  });

async function tabTo(page: Page, name: string | RegExp, limit = 80) {
  for (let i = 0; i < limit; i++) {
    await page.keyboard.press("Tab");
    const now = await focusedName(page);
    if (typeof name === "string" ? now === name : name.test(now)) return;
  }
  throw new Error(`Tab never reached ${String(name)}`);
}

test("Tab reaches the circle on the current key; arrows move, Enter chooses", async ({
  page,
}) => {
  await page.goto("./#p=G-major");
  await settle(page);
  await tabTo(page, "G major");
  await page.keyboard.press("ArrowRight");
  expect(await focusedName(page)).toBe("D major");
  await expect(page).toHaveURL(/#p=G-major$/);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#p=D-major$/);
  await page.keyboard.press("ArrowDown");
  expect(await focusedName(page)).toBe("B minor");
  await page.keyboard.press("ArrowDown");
  expect(await focusedName(page)).toMatch(
    /^C sharp diminished, selects D major$/,
  );
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowLeft");
  expect(await focusedName(page)).toBe("E minor");
  await page.keyboard.press("Shift+Enter");
  await expect(page).toHaveURL(/#p=D-major&c=E-minor$/);
});

test("all 36 cells can be reached with the arrow keys", async ({ page }) => {
  await page.goto("./#p=C-major");
  await settle(page);
  await tabTo(page, "C major");
  const seen = new Set<string>();
  for (const down of [false, true, true]) {
    if (down) await page.keyboard.press("ArrowDown");
    for (let i = 0; i < 12; i++) {
      seen.add(await focusedName(page));
      await page.keyboard.press("ArrowRight");
    }
  }
  expect(seen.size).toBe(36);
});

test("the shape strip is one tab stop, stepped with the arrows", async ({
  page,
}) => {
  await page.goto("./#p=G-major&view=fretboard&show=triads");
  await settle(page);
  await tabTo(page, /^1st inversion ?frets 3 to 4, B in the bass$/);
  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/shape=2/);
  expect(await focusedName(page)).toMatch(/^2nd inversion/);
});

test("notes on the board are one tab stop, moved with the arrows", async ({
  page,
}) => {
  await page.goto("./#p=C-major&view=fretboard");
  await settle(page);
  const first = page.locator(".fret-dot[tabindex='0']");
  await expect(first).toHaveCount(1);
  await first.focus();
  const start = await focusedName(page);
  await page.keyboard.press("ArrowRight");
  const moved = await focusedName(page);
  // Lying down → moves along the string; upright it moves across the strings.
  expect(moved).not.toBe(start);
  expect(moved).toMatch(/string \d/);
  await expect(page.locator(".fret-dot[tabindex='0']")).toHaveCount(1);
  // The arrows on a note move focus; they do not step the strip.
  await expect(page).not.toHaveURL(/pos=/);
});

test("every button has a name", async ({ page }) => {
  for (const hash of [
    "#p=G-major",
    "#p=G-major&c=D-major",
    "#p=G-major&view=fretboard&show=triads",
    "#p=C-major&pchord=G-7&view=fretboard&show=pairs",
  ]) {
    await page.goto(`./${hash}`);
    await settle(page);
    const unnamed = await page.evaluate(() =>
      [...document.querySelectorAll("button, [role='button']")]
        .filter((el) => {
          const label =
            el.getAttribute("aria-label") ??
            (el as HTMLElement).innerText.trim();
          return !label && !el.closest("[aria-hidden='true']");
        })
        .map((el) => el.outerHTML.slice(0, 80)),
    );
    expect(unnamed).toEqual([]);
  }
});
