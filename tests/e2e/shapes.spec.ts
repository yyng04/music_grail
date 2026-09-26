import { expect, test, type Page } from "@playwright/test";

// §8.2 states for M3b: the Show list, the shape strip and the shape board.
async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
}
const show = (page: Page, mode: string) =>
  page
    .getByRole("region", { name: "Show" })
    .getByRole("button", { name: new RegExp(`${mode}$`) })
    .click();

const states: {
  name: string;
  hash: string;
  steps: (page: Page) => Promise<void>;
}[] = [
  {
    name: "1-g-major-e-shape",
    hash: "#p=G-major&view=fretboard",
    steps: (p) =>
      p
        .getByRole("group", { name: "Positions" })
        .getByRole("button", { name: /E shape/ })
        .click(),
  },
  {
    name: "2-g-triads-strings-123",
    hash: "#p=G-major&view=fretboard",
    steps: (p) => show(p, "Triads"),
  },
  {
    name: "3-g7-pair-3rd-7th",
    hash: "#p=C-major&pchord=G-7&view=fretboard",
    steps: (p) => show(p, "Two-note chords"),
  },
  {
    name: "4-g-major-3rds-strings-23",
    hash: "#p=G-major&view=fretboard",
    steps: async (p) => {
      await show(p, "Two-note chords");
      await p.getByRole("button", { name: "The key's scale" }).click();
    },
  },
  {
    name: "5-guide-tones-am7-d7",
    hash: "#p=G-major&pchord=A-m7&view=fretboard",
    steps: (p) => show(p, "Guide tones"),
  },
];

for (const state of states) {
  test(`screenshot ${state.name}`, async ({ page }, info) => {
    await page.goto(`./${state.hash}`);
    await settle(page);
    await state.steps(page);
    await settle(page);
    await page.screenshot({
      path: `tests/e2e/__screenshots__/m3b-${state.name}-${info.project.name}.png`,
      fullPage: info.project.name === "mobile",
    });
  });
}

test("triads step through the inversions up the neck", async ({ page }) => {
  await page.goto("./#p=G-major&view=fretboard");
  await settle(page);
  await show(page, "Triads");
  const shapes = page.getByRole("group", { name: "Shapes" });
  await expect(
    shapes.getByRole("button", { name: /1st inversion/ }).first(),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("button", { name: "Next shape, up the neck" })
    .first()
    .click();
  await expect(
    shapes.getByRole("button", { name: /2nd inversion/ }).first(),
  ).toHaveAttribute("aria-pressed", "true");
});
