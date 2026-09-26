import { expect, test, type Page } from "@playwright/test";

// §8.2 states for the circle (M2), plus A harmonic minor (§5.1).
const states = [
  { name: "1-default-c-major", hash: "" },
  { name: "2-g-major", hash: "#p=G-major" },
  { name: "3-g-major-vs-d-major", hash: "#p=G-major&c=D-major" },
  { name: "4-bb-major-focus-bbmaj7", hash: "#p=Bb-major&pchord=Bb-maj7" },
  { name: "5-bb-major-focus-gm7", hash: "#p=Bb-major&pchord=G-m7" },
  { name: "6-a-harmonic-minor", hash: "#p=A-harmonic-minor" },
];

async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
}

for (const state of states) {
  test(`screenshot ${state.name}`, async ({ page }, info) => {
    await page.goto(`./${state.hash}`);
    await settle(page);
    await page.screenshot({
      path: `tests/e2e/__screenshots__/m2-${state.name}-${info.project.name}.png`,
      fullPage: info.project.name === "mobile",
    });
  });
}

const cell = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true });

test("a click selects the primary key and updates the URL", async ({
  page,
}) => {
  await page.goto("./");
  await settle(page);
  await cell(page, "G major").click();
  await expect(page).toHaveURL(/#p=G-major$/);
  await expect(page.getByRole("heading", { level: 2 }).first()).toContainText(
    "G",
  );
});

test("the middle ring selects minors, the inner ring its column's major", async ({
  page,
}) => {
  await page.goto("./");
  await settle(page);
  await cell(page, "E minor").click();
  await expect(page).toHaveURL(/#p=E-minor$/);
});

test("shift-click sets the compare without selecting text", async ({
  page,
}) => {
  await page.goto("./#p=G-major");
  await settle(page);
  await cell(page, "D major").click({ modifiers: ["Shift"] });
  await expect(page).toHaveURL(/#p=G-major&c=D-major$/);
  expect(
    await page.evaluate(() => window.getSelection()?.toString() ?? ""),
  ).toBe("");
  await expect(page.getByRole("region", { name: "Comparison" })).toContainText(
    "C becomes C",
  );
});

test("the Compare control arms compare mode; Esc cancels and clears", async ({
  page,
}) => {
  await page.goto("./#p=G-major");
  await settle(page);
  await page.getByRole("button", { name: /Compare with another key/ }).click();
  await cell(page, "F major").click();
  await expect(page).toHaveURL(/#p=G-major&c=F-major$/);
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/#p=G-major$/);
});

test("arrow keys move the primary key round the circle", async ({ page }) => {
  await page.goto("./#p=G-major");
  await settle(page);
  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/#p=D-major$/);
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await expect(page).toHaveURL(/#p=C-major$/);
});

test("the enharmonic toggle respells the selected key", async ({ page }) => {
  await page.goto("./#p=Fs-major");
  await settle(page);
  await page.getByRole("button", { name: "Spell as G flat" }).click();
  await expect(page).toHaveURL(/#p=Gb-major$/);
  await page.getByRole("button", { name: "Spell as F sharp" }).click();
  await expect(page).toHaveURL(/#p=Fs-major$/);
});

test("a chord chip sets and clears the focus chord", async ({ page }) => {
  await page.goto("./#p=Bb-major");
  await settle(page);
  const chip = page.getByRole("button", { name: /vi7/ });
  await chip.click();
  await expect(page).toHaveURL(/#p=Bb-major&pchord=G-m7$/);
  await chip.click();
  await expect(page).toHaveURL(/#p=Bb-major$/);
});

test("the page never scrolls sideways", async ({ page }) => {
  for (const hash of [
    "",
    "#p=G-major&c=D-major",
    "#p=D-major&c=F-major",
    "#p=A-harmonic-minor",
  ]) {
    await page.goto(`./${hash}`);
    await settle(page);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      ),
    ).toBeLessThanOrEqual(0);
  }
});
