import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import AwesomePlugin from "@allurereport/plugin-awesome";
import ClassicPlugin from "@allurereport/plugin-classic";
import { expect, test } from "@playwright/test";
import { attachment, label } from "allure-js-commons";

import { bootstrapReport } from "./utils/index.js";

declare global {
  interface Window {
    previewUrls: { created: string[]; revoked: string[] };
  }
}

for (const variant of ["awesome", "classic"] as const) {
  test(`${variant} releases preview URLs on collapse, modal close and SPA navigation`, async ({
    page,
    browserName,
  }) => {
    await label("env", browserName);
    const report = await bootstrapReport({
      reportConfig: {
        name: "Attachment lifecycle",
        plugins: [
          { id: variant, enabled: true, plugin: variant === "awesome" ? new AwesomePlugin() : new ClassicPlugin() },
        ],
      },
      rawTestResults: [
        {
          uuid: "preview-owner",
          name: "Preview owner",
          fullName: "preview-owner",
          status: "passed",
          labels: [{ name: "suite", value: "Lifecycle" }],
          attachments: [{ name: "Preview image", source: "image.png", type: "image/png" }],
        },
        {
          uuid: "next-test",
          name: "Next test",
          fullName: "next-test",
          status: "passed",
          labels: [{ name: "suite", value: "Lifecycle" }],
        },
      ],
      attachments: [
        {
          source: "image.png",
          content: await readFile(fileURLToPath(new URL("./fixtures/image.png", import.meta.url))),
        },
      ],
    });
    try {
      await page.addInitScript(() => {
        window.previewUrls = { created: [], revoked: [] };
        const create = URL.createObjectURL.bind(URL);
        const revoke = URL.revokeObjectURL.bind(URL);
        URL.createObjectURL = (blob) => {
          const url = create(blob);
          window.previewUrls.created.push(url);
          return url;
        };
        URL.revokeObjectURL = (url) => {
          window.previewUrls.revoked.push(url);
          revoke(url);
        };
      });
      await page.goto(report.url);
      if (variant === "classic") await page.getByText("Suites", { exact: true }).first().click();
      const group = page
        .getByTestId(variant === "awesome" ? "tree-section" : "tree-header")
        .filter({ hasText: "Lifecycle" });
      await expect(page.getByTestId("tree-content")).toBeVisible();
      if (!(await page.getByTestId("tree-leaf").filter({ hasText: "Preview owner" }).isVisible()))
        await group.first().click();
      await page.getByTestId("tree-leaf").filter({ hasText: "Preview owner" }).click();
      const header =
        variant === "awesome"
          ? page.getByTestId("test-result-attachment").filter({ hasText: "Preview image" }).first()
          : page.getByText("Preview image", { exact: true }).locator("..");
      await test.step("Collapse an active inline preview and release its URL", async () => {
        await header.getByText("Preview image", { exact: true }).click();
        const image = page.locator('img[src^="blob:"]').first();
        await expect(image).toBeVisible();
        await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
        const url = await image.getAttribute("src");
        expect(await page.evaluate(async (src) => (await fetch(src!)).ok, url)).toBe(true);
        await header.getByText("Preview image", { exact: true }).click();
        await expect(page.locator('img[src^="blob:"]')).toHaveCount(0);
        await expect.poll(() => page.evaluate(() => window.previewUrls.revoked)).toContain(url);
        expect(
          await page.evaluate(
            async (src) =>
              fetch(src!).then(
                () => true,
                () => false,
              ),
            url,
          ),
        ).toBe(false);
      });
      await test.step("Close the modal and release all of its previews", async () => {
        if (variant === "awesome") await header.getByTestId("attachment-expand-button").click();
        else await header.getByRole("button").nth(1).click();
        const title = page.getByText("Preview image", { exact: true }).last();
        const modal = variant === "awesome" ? page.getByTestId("attachment-modal") : title.locator("../../..");
        await expect(modal).toBeVisible();
        await expect(modal.locator('img[src^="blob:"]')).toHaveCount(variant === "classic" ? 2 : 1);
        const urls = await modal
          .locator('img[src^="blob:"]')
          .evaluateAll((images) => images.map((img: HTMLImageElement) => img.src));
        expect(
          await page.evaluate((active) => active.every((url) => !window.previewUrls.revoked.includes(url)), urls),
        ).toBe(true);
        const popupPromise = page.waitForEvent("popup");
        await modal.getByRole("button", { name: "Open in new tab" }).click();
        const popup = await popupPromise;
        await popup.waitForLoadState();
        const openedUrl = popup.url();
        const buttons = title.locator("..");
        await buttons.getByRole("button").last().click();
        await expect(page.getByRole("button", { name: "Open in new tab" })).toHaveCount(0);
        await expect
          .poll(() => page.evaluate((active) => active.every((url) => window.previewUrls.revoked.includes(url)), urls))
          .toBe(true);
        expect(await page.evaluate((url) => window.previewUrls.revoked.includes(url), openedUrl)).toBe(false);
        expect(await page.evaluate(async (url) => (await fetch(url)).ok, openedUrl)).toBe(true);
        await popup.close();
      });
      await test.step("Navigate away within the SPA and release the inline image", async () => {
        await header.getByText("Preview image", { exact: true }).click();
        const image = page.locator('img[src^="blob:"]').first();
        await expect(image).toBeVisible();
        const url = await image.getAttribute("src");
        if (variant === "awesome")
          await page.getByRole("navigation", { name: "Breadcrumbs" }).getByRole("button").first().click();
        await page.getByTestId("tree-leaf").filter({ hasText: "Next test" }).click();
        await expect(page.locator('img[src^="blob:"]')).toHaveCount(0);
        await expect.poll(() => page.evaluate(() => window.previewUrls.revoked)).toContain(url);
        expect(
          await page.evaluate(
            async (src) =>
              fetch(src!).then(
                () => true,
                () => false,
              ),
            url,
          ),
        ).toBe(false);
        await attachment(
          "Preview URL lifecycle",
          JSON.stringify(await page.evaluate(() => window.previewUrls)),
          "application/json",
        );
      });
    } finally {
      await report.shutdown();
    }
  });
}
