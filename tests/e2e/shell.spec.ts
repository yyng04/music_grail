import { expect, test } from "@playwright/test";

test("app shell renders", async ({ page }, testInfo) => {
  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: "Music Theory Centre" }),
  ).toBeVisible();
  await page.screenshot({
    path: `tests/e2e/__screenshots__/m0-shell-${testInfo.project.name}.png`,
    fullPage: true,
  });
});
