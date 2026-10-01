import { expect, test, type Page } from "@playwright/test";

// Progression mode: typed chords with bar counts, shells with rings for the
// next chord, and the metronome in a bar along the bottom of the window.
async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
}

const OWNER =
  "#p=E-major&view=fretboard&show=progression&chords=A-maj7,A-dim7,Gs-m7,Cs-m7,Fs-m7,F-maj7,E-maj7";
const II_V_I =
  "#p=C-major&view=fretboard&show=progression&chords=D-m7,G-7,C-maj7&bars=2,2,2&time=3-4&drums=waltz";

const title = (page: Page) => page.locator(".shape-title");
const beats = (page: Page) => page.locator(".beat-words");
const start = (page: Page) =>
  page.getByRole("region", { name: "Metronome" }).getByRole("button", {
    name: /^(Start|Stop)$/,
  });
const entry = (page: Page) => page.getByRole("textbox", { name: "Chords" });

async function shoot(page: Page, name: string, project: string) {
  const path = `tests/e2e/__screenshots__/m6-${name}-${project}`;
  await page.screenshot({ path: `${path}.png` });
  if (project === "mobile")
    await page.screenshot({ path: `${path}-full.png`, fullPage: true });
}

test("screenshot 1: stopped on Amaj7, rings for A°7", async ({
  page,
}, info) => {
  await page.goto(`./${OWNER}`);
  await settle(page);
  await expect(title(page)).toHaveText(
    "Amaj7 shell · R 7 3, root on E · A G♯ C♯",
  );
  await shoot(page, "1-stopped-amaj7", info.project.name);
});

test("screenshot 2: running in bar 3 on G♯m7, swing drums", async ({
  page,
}, info) => {
  test.setTimeout(40_000);
  await page.goto(`./${OWNER}&drums=swing`);
  await settle(page);
  await start(page).click();
  await expect(beats(page)).toHaveText(/^Bar 3/, { timeout: 20_000 });
  await expect(title(page)).toHaveText(/^G♯m7 shell/);
  await page.waitForTimeout(350);
  await shoot(page, "2-running-g-sharp-m7-swing", info.project.name);
});

test("screenshot 3: Xm7 marked as not a chord", async ({ page }, info) => {
  await page.goto(`./${OWNER}`);
  await settle(page);
  await entry(page).fill("Amaj7 Adim7 Xm7 Emaj7");
  await expect(page.locator(".entry-bad")).toHaveText("Xm7");
  await expect(page.locator(".entry-note")).toHaveText(
    "Xm7 is not a chord, so the progression skips it.",
  );
  await expect(page.locator(".strip-item.bad")).toContainText("not a chord");
  await expect(page).toHaveURL(/chords=A-maj7,A-dim7,E-maj7$/);
  await entry(page).blur();
  await settle(page);
  await shoot(page, "3-xm7-not-a-chord", info.project.name);
});

test("screenshot 4: Dm7 G7 Cmaj7 in 3/4, jazz waltz, running", async ({
  page,
}, info) => {
  test.setTimeout(40_000);
  await page.goto(`./${II_V_I}`);
  await settle(page);
  await start(page).click();
  await expect(beats(page)).toHaveText(/^Bar 4/, { timeout: 20_000 });
  await expect(title(page)).toHaveText(/^G7 shell/);
  await page.waitForTimeout(350);
  await shoot(page, "4-ii-v-i-waltz-running", info.project.name);
});

test("counts in, then changes the board on each chord's first bar", async ({
  page,
}) => {
  await page.goto(`./${OWNER}&bars=2,1,1,1,1,1,1&bpm=240`);
  await settle(page);
  await start(page).click();
  await expect(start(page)).toHaveAttribute("aria-pressed", "true");
  await expect(beats(page)).toHaveText(/^Count-in · (beat )?\d$/);
  await expect(beats(page)).toHaveText(/^Bar 1( of 8)? ·/, { timeout: 5000 });
  await expect(title(page)).toHaveText(/^Amaj7 shell/);
  await expect(beats(page)).toHaveText(/^Bar 2( of 8)? ·/, { timeout: 5000 });
  await expect(title(page)).toHaveText(/^Amaj7 shell/);
  await expect(beats(page)).toHaveText(/^Bar 3( of 8)? ·/, { timeout: 5000 });
  await expect(title(page)).toHaveText(/^A°7 shell/);
  await start(page).click();
  await expect(beats(page)).toHaveText(/^(Stopped · )?8 bars$/);
  // Stopping leaves the board on the chord that was playing.
  await expect(title(page)).toHaveText(/^A°7 shell/);
});

test("the space bar starts and stops; arrows step through the chords when stopped", async ({
  page,
}) => {
  await page.goto(`./${OWNER}&bpm=240`);
  await settle(page);
  await page.keyboard.press("ArrowRight");
  await expect(title(page)).toHaveText(/^A°7 shell/);
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await expect(title(page)).toHaveText(/^Emaj7 shell/);
  await page.keyboard.press("Space");
  await expect(start(page)).toHaveAttribute("aria-pressed", "true");
  // While playing, the metronome decides the chord.
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Space");
  await expect(start(page)).toHaveAttribute("aria-pressed", "false");
  // Typing a space in the chord field types a space.
  await entry(page).press("End");
  await entry(page).press("Space");
  await expect(start(page)).toHaveAttribute("aria-pressed", "false");
});

test("bar counts, tempo, time and backing are kept in the URL", async ({
  page,
}) => {
  await page.goto(`./${OWNER}`);
  await settle(page);
  const amaj7 = page.locator(".strip-item").first();
  await amaj7.getByRole("button", { name: "One bar more" }).click();
  await expect(amaj7).toContainText("2 bars");
  await expect(page).toHaveURL(/&bars=2,1,1,1,1,1,1/);
  const bar = page.getByRole("region", { name: "Metronome" });
  if (await bar.getByRole("button", { name: "Faster" }).isVisible())
    await bar.getByRole("button", { name: "Faster" }).click();
  await expect(page).toHaveURL(/&bpm=91/);
  const more = bar.locator(".player-toggle");
  if (await more.isVisible()) await more.click();
  await page.getByRole("group", { name: "Time" }).getByText("3/4").click();
  await page
    .getByRole("group", { name: "Backing" })
    .getByText("Jazz waltz")
    .click();
  await expect(page).toHaveURL(/&time=3-4&drums=waltz/);
  // Styles written for other time signatures are hidden.
  await expect(
    page.getByRole("group", { name: "Backing" }).getByRole("button"),
  ).toHaveText(["Click only", "Jazz waltz"]);
  await page.reload();
  await settle(page);
  await expect(page.locator(".strip-item").first()).toContainText("2 bars");
});

test("drum samples load only when drums are first turned on", async ({
  page,
}) => {
  const drums: string[] = [];
  const errors: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/samples/drums/")) drums.push(r.url());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`./${OWNER}&bpm=240`);
  await settle(page);
  await start(page).click();
  await expect(beats(page)).toHaveText(/^Bar 1/, { timeout: 5000 });
  expect(drums).toEqual([]);
  const bar = page.getByRole("region", { name: "Metronome" });
  const more = bar.locator(".player-toggle");
  if (await more.isVisible()) await more.click();
  await page.getByRole("group", { name: "Backing" }).getByText("Rock").click();
  await expect.poll(() => drums.length).toBe(14);
  await page.waitForTimeout(1500);
  expect(errors).toEqual([]);
});

test("the player bar stays on screen while the page scrolls, and the page never scrolls sideways", async ({
  page,
}) => {
  await page.goto(`./${OWNER}`);
  await settle(page);
  await page.mouse.wheel(0, 1200);
  await page.waitForTimeout(200);
  const box = await page
    .getByRole("region", { name: "Metronome" })
    .boundingBox();
  const height = page.viewportSize()?.height ?? 0;
  expect(box && Math.round(box.y + box.height)).toBe(height);
  await expect(start(page)).toBeInViewport();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBeLessThanOrEqual(0);
});

test("leaving Progression mode stops the metronome; the circle lights the current chord in the key", async ({
  page,
}) => {
  await page.goto(`./${OWNER}`);
  await settle(page);
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(title(page)).toHaveText(/^G♯m7 shell/);
  await page
    .getByRole("navigation", { name: "Views" })
    .getByText("Circle")
    .click();
  await settle(page);
  await expect(
    page.locator(".label:has(.focus-halo) .name").first(),
  ).toHaveText(/^G.m$/);
  await page
    .getByRole("navigation", { name: "Views" })
    .getByText("Fretboard")
    .click();
  await page.keyboard.press("ArrowLeft");
  await expect(title(page)).toHaveText(/^A°7 shell/);
  await page
    .getByRole("navigation", { name: "Views" })
    .getByText("Circle")
    .click();
  await settle(page);
  // A°7 is not in E major: no cell is lit.
  await expect(page.locator(".focus-halo")).toHaveCount(0);
  await page
    .getByRole("navigation", { name: "Views" })
    .getByText("Fretboard")
    .click();
  await start(page).click();
  await expect(start(page)).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("tab", { name: "Scale" }).click();
  await page.getByRole("tab", { name: "Progression" }).click();
  await expect(start(page)).toHaveAttribute("aria-pressed", "false");
});
