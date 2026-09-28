import { expect, test, type Page, type Request } from "@playwright/test";

// Sound is muted by default; Tone.js and the samples load only once sound is on,
// the bass samples only for a bass; clicks play without errors.
async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
}

function watch(page: Page) {
  const requests: string[] = [];
  const errors: string[] = [];
  page.on("request", (r: Request) => requests.push(r.url()));
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" || m.text().includes("Could not play"))
      errors.push(m.text());
  });
  return { requests, errors };
}

const sound = (page: Page) =>
  page.getByRole("button", { name: /Sound (off|on)/ });

test("nothing loads while muted", async ({ page }) => {
  const { requests } = watch(page);
  await page.goto("./#p=G-major&view=fretboard");
  await settle(page);
  await page
    .getByRole("button", { name: "G 2, root, string 6, fret 3" })
    .click();
  await page.waitForTimeout(300);
  expect(requests.filter((u) => u.includes("/samples/"))).toEqual([]);
  // Tone.js is its own chunk, fetched only when sound is turned on.
  expect(requests.filter((u) => /assets\/.*\.js$/.test(u))).toHaveLength(1);
});

test("sound on loads the guitar samples and plays clicks", async ({ page }) => {
  const { requests, errors } = watch(page);
  await page.goto("./#p=G-major&view=fretboard&show=triads");
  await settle(page);
  await sound(page).click();
  await expect(sound(page)).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(() => requests.filter((u) => u.includes("/samples/guitar/")).length)
    .toBe(17);
  expect(requests.some((u) => u.includes("/samples/bass/"))).toBe(false);
  await page
    .getByRole("button", { name: /G 4, root, string 1, fret 3/ })
    .click();
  await page.keyboard.press("ArrowRight");
  await page.getByRole("button", { name: "Circle" }).click();
  await page.getByRole("button", { name: "D major", exact: true }).click();
  await page.waitForTimeout(800);
  expect(errors).toEqual([]);
});

test("a shell plays when it is picked", async ({ page }) => {
  const { requests, errors } = watch(page);
  await page.goto("./#p=G-major&pchord=G-maj7&view=fretboard&show=shells");
  await settle(page);
  await sound(page).click();
  await expect
    .poll(() => requests.filter((u) => u.includes("/samples/guitar/")).length)
    .toBe(17);
  await page
    .getByRole("group", { name: "Shapes along the neck" })
    .getByRole("button", { name: /^R 7 3, root on E/ })
    .first()
    .click();
  await expect(page).toHaveURL(/shape=2/);
  await page.waitForTimeout(600);
  expect(errors).toEqual([]);
});

test("a bass loads its own samples", async ({ page }) => {
  const { requests, errors } = watch(page);
  await page.addInitScript(() => {
    localStorage.setItem(
      "music-grail:fretboard",
      JSON.stringify({ instrument: "bass5" }),
    );
  });
  await page.goto("./#p=E-minor&view=fretboard");
  await settle(page);
  await sound(page).click();
  await expect
    .poll(() => requests.filter((u) => u.includes("/samples/bass/")).length)
    .toBe(11);
  await page.getByRole("button", { name: /B 0, .*string 5, open/ }).click();
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
});
