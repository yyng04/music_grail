import { expect, test } from "@playwright/test";

test("rewrites the hash in canonical form", async ({ page }) => {
  await page.goto("./#p=A-aeolian&pchord=A-m7");
  await expect(page).toHaveURL(/#p=A-minor&pchord=A-m7$/);
});

test("writes the default selection to an empty hash", async ({ page }) => {
  await page.goto("./");
  await expect(page).toHaveURL(/#p=C-major$/);
});

test("drops a non-diatonic chord from the URL with a warning", async ({
  page,
}) => {
  const warnings: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "warning") warnings.push(msg.text());
  });
  await page.goto("./#p=C-major&pchord=D-7");
  await expect(page).toHaveURL(/#p=C-major$/);
  expect(warnings).toEqual(["Ignoring chord D7: not diatonic to C major"]);
});

test("rewrites a theoretical key from the URL with a warning", async ({
  page,
}) => {
  const warnings: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "warning") warnings.push(msg.text());
  });
  await page.goto("./#p=Ds-major");
  await expect(page).toHaveURL(/#p=Eb-major$/);
  expect(warnings).toEqual([
    "Rewriting D# major as Eb major: not a standard key",
  ]);
});
