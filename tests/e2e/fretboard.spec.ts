import { expect, test, type Page } from "@playwright/test";

// §8.2 states for the fretboard (M3).
const states = [
  { name: "1-default-c-major", hash: "#p=C-major&view=fretboard" },
  { name: "2-g-major", hash: "#p=G-major&view=fretboard" },
  { name: "3-g-major-vs-d-major", hash: "#p=G-major&c=D-major&view=fretboard" },
  {
    name: "4-bb-major-focus-bbmaj7",
    hash: "#p=Bb-major&pchord=Bb-maj7&view=fretboard",
  },
  {
    name: "5-bb-major-focus-gm7",
    hash: "#p=Bb-major&pchord=G-m7&view=fretboard",
  },
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
      path: `tests/e2e/__screenshots__/m3-${state.name}-${info.project.name}.png`,
      fullPage: info.project.name === "mobile",
    });
  });
}

// Other settings, stored the way the settings row stores them.
const setups = [
  {
    name: "6-settings-open",
    hash: "#p=E-minor&view=fretboard",
    settings: {},
    open: true,
  },
  {
    name: "11-key-picker",
    hash: "#p=G-major&view=fretboard",
    settings: {},
    picker: true,
  },
  {
    name: "7-bass5-outside-dimmed",
    hash: "#p=Eb-major&view=fretboard",
    settings: { instrument: "bass5", label: "note", showOutside: true },
  },
  {
    name: "8-left-handed-players-view",
    hash: "#p=A-major&c=E-major&view=fretboard",
    settings: { leftHanded: true, lowOnTop: true, label: "interval" },
  },
  {
    name: "10-upright-left-handed",
    hash: "#p=A-major&c=E-major&view=fretboard",
    settings: { leftHanded: true, label: "note" },
  },
  {
    name: "9-drop-d-no-labels",
    hash: "#p=D-minor&pchord=D-m7&view=fretboard",
    settings: { tuning: "drop-d", label: "none", frets: 22 },
  },
];

for (const setup of setups) {
  test(`screenshot ${setup.name}`, async ({ page }, info) => {
    await page.addInitScript((value) => {
      localStorage.setItem("music-grail:fretboard", value);
    }, JSON.stringify(setup.settings));
    await page.goto(`./${setup.hash}`);
    await settle(page);
    if (setup.open)
      await page.getByRole("button", { name: /tuning \(/ }).click();
    if (setup.picker)
      await page
        .getByRole("button", { name: /Compare with another key/ })
        .click();
    await page.screenshot({
      path: `tests/e2e/__screenshots__/m3-${setup.name}-${info.project.name}.png`,
      fullPage: info.project.name === "mobile",
    });
  });
}

const dot = (page: Page, name: string) =>
  page.getByRole("img", { name, exact: true });

test("the Fretboard tab opens the board and is kept in the URL", async ({
  page,
}) => {
  await page.goto("./#p=G-major");
  await settle(page);
  await page.getByRole("button", { name: "Fretboard" }).click();
  await expect(page).toHaveURL(/#p=G-major&view=fretboard$/);
  await expect(
    page.getByRole("group", { name: "Fretboard showing G major" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Circle" }).click();
  await expect(page).toHaveURL(/#p=G-major$/);
});

test("each dot names its exact pitch in the key's spelling", async ({
  page,
}) => {
  await page.goto("./#p=Fs-major&view=fretboard");
  await settle(page);
  // High E string, fret 1: F natural, spelled E# in F# major.
  await expect(dot(page, "E sharp 4, 7th, string 1, fret 1")).toBeAttached();
  // G string, fret 4: B, the 4th degree, spelled B in F# major.
  await expect(dot(page, "B 3, string 3, fret 4")).toBeAttached();
  // Notes outside the key are hidden by default.
  await expect(
    page.getByRole("img", { name: /string 1, fret 3$/ }),
  ).toHaveCount(0);
});

test("dot labels switch between note, degree, interval and none", async ({
  page,
}) => {
  await page.goto("./#p=G-major&view=fretboard");
  await settle(page);
  const low3 = dot(page, "G 2, root, string 6, fret 3");
  await expect(low3).toHaveText("1");
  await page.getByRole("button", { name: "Note", exact: true }).click();
  await expect(low3).toHaveText("G");
  await page.getByRole("button", { name: "Interval" }).click();
  await expect(low3).toHaveText("R");
  await expect(dot(page, "B 2, 3rd, string 5, fret 2")).toHaveText("M3");
  await page.getByRole("button", { name: "None", exact: true }).click();
  await expect(low3).toHaveText("");
});

test("settings change the instrument and show outside notes dimmed", async ({
  page,
}) => {
  await page.goto("./#p=C-major&view=fretboard");
  await settle(page);
  await page.getByRole("button", { name: /tuning \(/ }).click();
  await page.getByRole("button", { name: "Bass, 5-string" }).click();
  await expect(dot(page, "B 0, 7th, string 5, open")).toBeAttached();
  await page.getByRole("button", { name: "Dimmed" }).click();
  await expect(
    dot(page, "D flat 1, string 5, fret 2, outside the key"),
  ).toBeAttached();
  // Settings survive a reload.
  await page.reload();
  await settle(page);
  await expect(dot(page, "B 0, 7th, string 5, open")).toBeAttached();
});

test("compare on the fretboard opens a key picker and stays on the board", async ({
  page,
}) => {
  await page.goto("./#p=G-major&view=fretboard");
  await settle(page);
  await page.getByRole("button", { name: /Compare with another key/ }).click();
  const picker = page.getByRole("region", {
    name: "Pick a key to compare with",
  });
  await expect(picker.getByRole("button", { name: "G major" })).toBeDisabled();
  await picker.getByRole("button", { name: "D major" }).click();
  await expect(page).toHaveURL(/#p=G-major&c=D-major&view=fretboard$/);
  await expect(
    dot(page, "C sharp 4, string 2, fret 2, only in the compare key"),
  ).toBeAttached();
  // Change reopens the picker; minor keys are one switch away; Esc cancels.
  await page.getByRole("button", { name: "Change" }).click();
  await picker.getByRole("button", { name: "Minor" }).click();
  await picker.getByRole("button", { name: "E minor" }).click();
  await expect(page).toHaveURL(/#p=G-major&c=E-minor&view=fretboard$/);
  await page.getByRole("button", { name: "Change" }).click();
  await page.keyboard.press("Escape");
  await expect(picker).toHaveCount(0);
  await expect(page).toHaveURL(/c=E-minor/);
});

test("with a focus chord the note row shows roles, not key degrees", async ({
  page,
}) => {
  await page.goto("./#p=Bb-major&pchord=G-m7&view=fretboard");
  await settle(page);
  const row = page.getByRole("list", { name: "Notes of the key" });
  await expect(row.getByRole("listitem", { name: "G, root" })).toBeAttached();
  await expect(row.getByRole("listitem", { name: "Bb, 3rd" })).toBeAttached();
  await expect(row.locator(".note-degree")).toHaveCount(0);
  await page.goto("./#p=Bb-major&view=fretboard");
  await settle(page);
  await expect(row.locator(".note-degree")).toHaveCount(7);
});

test("phones get an upright board with the nut at the top", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "mobile", "phone layout only");
  await page.goto("./#p=G-major&view=fretboard");
  await settle(page);
  const board = page.getByRole("group", { name: /^Fretboard showing/ });
  const box = await board.boundingBox();
  expect(box && box.height > box.width).toBe(true);
  // Low E on the left, high E on the right; fret 3 below the open strings.
  const low3 = await dot(page, "G 2, root, string 6, fret 3").boundingBox();
  const high3 = await dot(page, "G 4, root, string 1, fret 3").boundingBox();
  const high0 = await dot(page, "E 4, string 1, open").boundingBox();
  expect(low3 && high3 && low3.x < high3.x).toBe(true);
  expect(high0 && high3 && high0.y < high3.y).toBe(true);
});

test("the page never scrolls sideways on the fretboard", async ({ page }) => {
  for (const hash of [
    "#view=fretboard",
    "#p=G-major&c=D-major&view=fretboard",
    "#p=D-major&c=F-major&view=fretboard",
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
