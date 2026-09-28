import { expect, test, type Page } from "@playwright/test";

// Shape states: triad shapes (G major,
// strings G B E, 1st inversion), two-note chords (G7, 3rd + 7th, strings B E)
// and guide tones (Gmaj7 → Cmaj7).
async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
}

const states = [
  { name: "1-g-major-e-shape", hash: "#p=G-major&view=fretboard&pos=E" },
  {
    name: "2-g-triads-strings-gbe",
    hash: "#p=G-major&view=fretboard&show=triads",
  },
  {
    name: "3-g7-3rd-7th-strings-be",
    hash: "#p=C-major&pchord=G-7&view=fretboard&show=pairs",
  },
  {
    name: "4-g-major-3rds-strings-gb",
    hash: "#p=G-major&view=fretboard&show=harmony",
  },
  {
    name: "5-guide-tones-gmaj7-cmaj7",
    hash: "#p=G-major&pchord=G-maj7&view=fretboard&show=guide",
  },
  {
    name: "6-guide-tones-am7-d7",
    hash: "#p=G-major&pchord=A-m7&view=fretboard&show=guide",
  },
];

// Gmaj7 shells, all four forms.
for (const n of [1, 2, 3, 4])
  states.push({
    name: `7-gmaj7-shells-form-${String(n)}`,
    hash: `#p=G-major&pchord=G-maj7&view=fretboard&show=shells${n > 1 ? `&shape=${String(n)}` : ""}`,
  });

for (const state of states) {
  test(`screenshot ${state.name}`, async ({ page }, info) => {
    await page.goto(`./${state.hash}`);
    await settle(page);
    await page.screenshot({
      path: `tests/e2e/__screenshots__/m3b-${state.name}-${info.project.name}.png`,
      fullPage: info.project.name === "mobile",
    });
  });
}

const title = (page: Page) => page.locator(".shape-title");
const shapes = (page: Page) =>
  page.getByRole("group", { name: "Shapes along the neck" });

test("the Show modes write the URL and title what the board shows", async ({
  page,
}) => {
  await page.goto("./#p=G-major&view=fretboard");
  await settle(page);
  await page.getByRole("tab", { name: "Chord shapes" }).click();
  await expect(page).toHaveURL(/show=triads/);
  await expect(title(page)).toHaveText(
    "G major triad · strings G B E · 1st inversion (B in the bass)",
  );
  // Only the current shape is on the board: three notes.
  await expect(page.locator(".fret-dot:not(.hidden)")).toHaveCount(3);
  // The strings in use are named at the nut and the others dimmed.
  await expect(page.locator(".string-name.on")).toHaveText(["G", "B", "E"]);
  await expect(page.locator(".string-name.dim")).toHaveCount(3);
});

test("← / → and the strip's arrows step through the shapes", async ({
  page,
}) => {
  await page.goto("./#p=G-major&view=fretboard&show=triads");
  await settle(page);
  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/shape=2/);
  await expect(
    shapes(page).getByRole("button", { pressed: true }),
  ).toHaveAccessibleName(/^2nd inversion frets 7 to 8\s*, D in the bass$/);
  await page
    .getByRole("button", { name: "Previous shape, down the neck" })
    .click();
  await expect(page).not.toHaveURL(/shape=/);
  await expect(title(page)).toContainText("1st inversion");
});

test("chord chips show another chord without leaving the board", async ({
  page,
}) => {
  await page.goto("./#p=G-major&view=fretboard&show=triads");
  await settle(page);
  // On phones the settings fold away behind the title line.
  const fold = page.locator("button.shape-title");
  if (await fold.count()) await fold.click();
  await page
    .getByRole("group", { name: "Chord" })
    .getByRole("button", { name: /^ii7 Am7\s*, A minor 7$/ })
    .click();
  await expect(page).toHaveURL(/pchord=A-m7&/);
  // A 7th chord in Triads uses its triad, and the title says so.
  await expect(title(page)).toContainText(
    "A minor triad (the triad of Am7) · strings G B E",
  );
});

test("two-note chords by string pair, labelled by notes then interval", async ({
  page,
}) => {
  await page.goto("./#p=C-major&pchord=G-7&view=fretboard&show=pairs");
  await settle(page);
  await expect(title(page)).toHaveText(
    "G7 · 3rd + 7th · strings B E · B + F (d5)",
  );
  const count = await shapes(page).getByRole("button").count();
  expect(count).toBeGreaterThan(0);
  expect(count).toBeLessThanOrEqual(6);
});

test("guide tones name their notes and state the real motion", async ({
  page,
}) => {
  await page.goto("./#p=G-major&pchord=G-maj7&view=fretboard&show=guide");
  await settle(page);
  await expect(page.locator(".shape-caption")).toContainText(
    "B held, F♯ → E, a whole step down.",
  );
  const labels = await page
    .locator(".fret-dot:not(.hidden) .halo")
    .allTextContents();
  expect(labels.sort()).toEqual(["B", "E", "F♯"]);
});

test("every strip tile and chord button is named by its visible text", async ({
  page,
}) => {
  await page.goto("./#p=G-major&view=fretboard&show=triads");
  await settle(page);
  // No aria-label: the visible text is the name, so voice control can say what it sees.
  for (const b of await page
    .locator(".tile, .chips button, .chords button")
    .all()) {
    expect(((await b.textContent()) ?? "").length).toBeGreaterThan(3);
    expect(await b.getAttribute("aria-label")).toBeNull();
  }
});

test("the page never scrolls sideways in the shape modes", async ({ page }) => {
  for (const s of states) {
    await page.goto(`./${s.hash}`);
    await settle(page);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      ),
    ).toBeLessThanOrEqual(0);
  }
});

test("shells step through the four Gmaj7 forms, each titled by form and notes", async ({
  page,
}) => {
  await page.goto("./#p=G-major&pchord=G-maj7&view=fretboard&show=shells");
  await settle(page);
  const titles = [
    "Gmaj7 shell · R 3 7, root on E · G B F♯",
    "Gmaj7 shell · R 7 3, root on E · G F♯ B",
    "Gmaj7 shell · R 3 7, root on A · G B F♯",
    "Gmaj7 shell · R 7 3, root on A · G F♯ B",
  ];
  for (const [i, text] of titles.entries()) {
    await expect(title(page)).toHaveText(text);
    await expect(page.locator(".fret-dot:not(.hidden)")).toHaveCount(3);
    if (i < titles.length - 1) await page.keyboard.press("ArrowRight");
  }
  // The strings in use are named at the nut; the shell has no string choice.
  await expect(page.locator(".string-name.on")).toHaveText(["A", "G", "B"]);
  await expect(page.getByRole("group", { name: "Strings" })).toHaveCount(0);
});
