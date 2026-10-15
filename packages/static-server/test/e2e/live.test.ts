import { rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { type Page, test } from "@playwright/test";
import { epic, feature, label, layer, story } from "allure-js-commons";
import getPort from "get-port";

import { type AllureStaticServer, serve } from "../../src/index.js";

const baseDir = dirname(fileURLToPath(import.meta.url));
const servePath = join(baseDir, "fixtures");
const sampleFilePath = join(servePath, "sample.json");
const fixtures = {
  json: {
    content: "Hello world!",
  },
};

let server: AllureStaticServer;
let port: number;
let url: string;

test.beforeEach(async () => {
  await layer("e2e");
  await epic("coverage");
  await feature("static-server");
  await story("live");
  await label("coverage", "static-server");

  port = await getPort();
  url = `http://localhost:${port}`;

  try {
    await rm(sampleFilePath);
  } catch (ignore) {}
});

test.afterEach(async () => {
  await server.stop();
});

test("doesn't reload the page when a file changes and live reload is disabled", async ({ page }) => {
  server = await serve({ port, servePath, live: false });

  await page.goto(url);

  const prevContent = await page.$("#content").then((el) => el?.textContent());

  test.expect(prevContent).not.toEqual(fixtures.json.content);

  await writeFile(sampleFilePath, JSON.stringify(fixtures.json), "utf8");
  await page.waitForTimeout(200);

  const actualContent = await page.$("#content").then((el) => el?.textContent());

  test.expect(actualContent).not.toEqual(fixtures.json.content);
});

test("reloads the page when a file changes", async ({ page }) => {
  server = await serve({ port, servePath, live: true });

  await page.goto(url);
  await page.waitForURL(url);

  const prevContent = await page.$("#content").then((el) => el?.textContent());

  test.expect(prevContent).not.toEqual(fixtures.json.content);

  await writeFile(sampleFilePath, JSON.stringify(fixtures.json), "utf8");
  await page.waitForTimeout(200);

  const actualContent = await page.$("#content").then((el) => el?.textContent());

  test.expect(actualContent).toEqual(fixtures.json.content);
});

test("lets the page handle live reload without a full reload", async ({ page }) => {
  server = await serve({ port, servePath, live: true });

  await page.goto(url);
  await page.evaluate(() => {
    (window as Window & { __allureLiveReload?: () => void }).__allureLiveReload = () => {
      document.body.dataset.liveReload = "handled";
    };
  });

  await writeFile(sampleFilePath, JSON.stringify(fixtures.json), "utf8");
  await page.waitForFunction(() => document.body.dataset.liveReload === "handled");

  const actualContent = await page.$("#content").then((el) => el?.textContent());

  test.expect(actualContent).not.toEqual(fixtures.json.content);
});

test("reloads the page manually even when live reload is disabled", async ({ page }) => {
  server = await serve({ port, servePath, live: false });

  await page.goto(url);

  const prevContent = await page.$("#content").then((el) => el?.textContent());

  test.expect(prevContent).not.toEqual(fixtures.json.content);

  await writeFile(sampleFilePath, JSON.stringify(fixtures.json), "utf8");
  await page.waitForTimeout(200);
  await server.reload();
  await page.waitForTimeout(200);

  const actualContent = await page.$("#content").then((el) => el?.textContent());

  test.expect(actualContent).toEqual(fixtures.json.content);
});

const setHidden = (page: Page, hidden: boolean) =>
  page.evaluate((isHidden) => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => isHidden });
    document.dispatchEvent(new Event("visibilitychange"));
  }, hidden);

test("catches up with the reloads missed while the page was hidden", async ({ page }) => {
  server = await serve({ port, servePath, live: false });

  await page.goto(url);
  await setHidden(page, true);
  await writeFile(sampleFilePath, JSON.stringify(fixtures.json), "utf8");
  await server.reload();
  await page.waitForTimeout(200);

  // the page is hidden, so it is not connected to the server and can't be reloaded yet
  test.expect(await page.$("#content").then((el) => el?.textContent())).not.toEqual(fixtures.json.content);

  await setHidden(page, false);
  await page.waitForFunction(
    (content) => document.querySelector("#content")?.textContent === content,
    fixtures.json.content,
  );
});

test("catches up with the reloads missed by the page that was loaded hidden", async ({ page }) => {
  server = await serve({ port, servePath, live: false });

  await page.addInitScript(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
  });
  await page.goto(url);
  await writeFile(sampleFilePath, JSON.stringify(fixtures.json), "utf8");
  await server.reload();
  await page.waitForTimeout(200);

  test.expect(await page.$("#content").then((el) => el?.textContent())).not.toEqual(fixtures.json.content);

  await setHidden(page, false);
  await page.waitForFunction(
    (content) => document.querySelector("#content")?.textContent === content,
    fixtures.json.content,
  );
});
