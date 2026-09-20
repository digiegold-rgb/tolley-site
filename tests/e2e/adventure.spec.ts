import { test, expect, type Page } from "@playwright/test";
import type { PortalGame } from "../../components/game/portal3d/model";
import type { PortalInput } from "../../components/game/portal3d/input";
import type { PortalAudio } from "../../components/game/portal3d/audio";

declare global {
  interface Window {
    __portal3d?: { game: PortalGame; input: PortalInput; audio: PortalAudio };
  }
}
test.use({ launchOptions: { args: ["--enable-unsafe-swiftshader"] } });
test.beforeEach(async ({ baseURL }) => {
  test.skip(
    !baseURL || !/^http:\/\/(127\.0\.0\.1|localhost):/.test(baseURL),
    "Mutation hooks exist only in opt-in local development.",
  );
});
async function ready(page: Page) {
  await page.goto("/game?test=1");
  await expect(page.getByTestId("portal-3d")).toHaveAttribute(
    "data-ready",
    "true",
    { timeout: 120_000 },
  );
}
async function start(page: Page) {
  await page.getByRole("button", { name: /Let’s play!/ }).click();
  await expect(page.getByTestId("portal-3d")).toHaveAttribute(
    "data-mode",
    "play",
  );
  await page.waitForFunction(() => window.__portal3d!.game.time > 0.2);
}
test("original adventure starts in Gadget Works with music, movement and pause", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await ready(page);
  await start(page);
  expect(await page.evaluate(() => window.__portal3d!.game.world.name)).toBe(
    "Clank's Gadget Works",
  );
  await page.keyboard.down("KeyW");
  await page.waitForFunction(() => window.__portal3d!.game.position.z < 8);
  await page.keyboard.up("KeyW");
  await page.waitForFunction(() => window.__portal3d!.audio.notes > 5);
  expect(await page.evaluate(() => window.__portal3d!.audio.track)).toBe(
    "factory",
  );
  await page.getByRole("button", { name: "Pause game" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const time = await page.evaluate(() => window.__portal3d!.game.time);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__portal3d!.game.time)).toBe(time);
  await page.getByRole("button", { name: /Keep hopping/ }).click();
  expect(errors).toEqual([]);
});
test("three bashes free Zippy, unlock double jump, and persist after reload", async ({
  page,
}) => {
  await ready(page);
  await start(page);
  await page.evaluate(() => {
    const g = window.__portal3d!.game;
    const c = g.world.cages[0];
    g.position = { x: c.x, y: c.y, z: c.z + 1.6 };
  });
  for (let i = 0; i < 3; i++) {
    await page.waitForFunction(
      () => window.__portal3d!.game.attackCooldown === 0,
    );
    await page.keyboard.press("KeyX");
    await page.waitForTimeout(150);
  }
  await expect(
    page.getByRole("dialog", { name: "Friend rescued" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => window.__portal3d!.game.has("doubleJump")),
  ).toBe(true);
  await page.reload();
  await expect(page.getByTestId("portal-3d")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await page.getByRole("button", { name: /Continue adventure/ }).click();
  expect(
    await page.evaluate(() => window.__portal3d!.game.saveData.rescued),
  ).toContain("zippy");
});
test("blocked storage keeps play available and displays a saving notice", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new Error("storage disabled");
      },
    }),
  );
  await ready(page);
  await start(page);
  await expect(
    page.getByText("This browser couldn’t save progress.", { exact: false }),
  ).toBeVisible();
});
test("unavailable WebGL offers the original Portal Hoppers", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      type: string,
      ...args: unknown[]
    ) {
      if (type === "webgl2") return null;
      return Reflect.apply(get, this, [type, ...args]);
    } as typeof get;
  });
  await page.goto("/game");
  await expect(page.locator('.ph-modal[role="alert"]')).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Play original Portal Hoppers" }),
  ).toHaveAttribute("href", "/game/classic");
});
