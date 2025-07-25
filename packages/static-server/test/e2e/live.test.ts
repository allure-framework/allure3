import { test } from "@playwright/test";
import { layer } from "allure-js-commons";
import getPort from "get-port";
import { rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
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

  await page.pause();

  test.expect(prevContent).not.toEqual(fixtures.json.content);

  await writeFile(sampleFilePath, JSON.stringify(fixtures.json), "utf8");
  await page.waitForTimeout(200);

  await page.pause();

  const actualContent = await page.$("#content").then((el) => el?.textContent());

  test.expect(actualContent).toEqual(fixtures.json.content);
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
