import { expect, test, type Page } from "@playwright/test";

// Under reduced motion the key window jumps and nothing fades;
// otherwise it turns over about 400 ms.
async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
}
const lensAngle = (page: Page) =>
  page
    .locator(".circle .lens-body")
    .evaluate((el) =>
      Number(/rotate\(([-\d.]+)/.exec(el.getAttribute("transform") ?? "")?.[1]),
    );

test("reduced motion: the window jumps and transitions are off", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("./#p=C-major");
  await settle(page);
  await page.getByRole("button", { name: "A major", exact: true }).click();
  await page.waitForTimeout(40);
  expect(await lensAngle(page)).toBe(90);
  const durations = await page.evaluate(() =>
    [".halo", ".chords button", ".compare-open"].map(
      (s) =>
        getComputedStyle(document.querySelector(s) ?? document.body)
          .transitionDuration,
    ),
  );
  expect(
    durations.every((d) => d.split(",").every((x) => parseFloat(x) === 0)),
  ).toBe(true);
  const glow = await page.evaluate(
    () =>
      getComputedStyle(document.querySelector(".glow") ?? document.body)
        .animationName,
  );
  expect(glow).toBe("none");
});

test("full motion: the window turns over time", async ({ page }) => {
  await page.goto("./#p=C-major");
  await settle(page);
  await page.getByRole("button", { name: "A major", exact: true }).click();
  await page.waitForTimeout(60);
  const mid = await lensAngle(page);
  expect(mid).toBeGreaterThan(0);
  expect(mid).toBeLessThan(90);
  await page.waitForTimeout(600);
  expect(await lensAngle(page)).toBe(90);
});
