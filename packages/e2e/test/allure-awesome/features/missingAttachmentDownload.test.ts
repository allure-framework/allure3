import { expect, test } from "@playwright/test";

import { TestResultPage, TreePage } from "../../pageObjects/index.js";
import { bootstrapReport } from "../utils/index.js";

for (const singleFile of [false, true]) {
  test(`disables missing attachment downloads and preserves empty files (singleFile=${singleFile})`, async ({
    page,
  }) => {
    const bootstrap = await bootstrapReport(
      {
        reportConfig: { name: "Missing attachments" },
        testResults: [
          {
            name: "test with missing attachments",
            status: "passed",
            attachments: [
              { name: "archive", source: "missing.zip", type: "application/zip" },
              { name: "screenshot", source: "missing.png", type: "image/png" },
              { name: "log", source: "missing.txt", type: "text/plain" },
              { name: "empty log", source: "empty.txt", type: "text/plain" },
            ],
          },
        ],
        attachments: [{ source: "empty.txt", content: Buffer.alloc(0) }],
      },
      { singleFile },
    );
    try {
      await page.goto(bootstrap.url);
      await new TreePage(page).clickNthLeaf(0);
      const result = new TestResultPage(page);
      await expect(result.testResultAttachmentLocator).toHaveCount(4);
      for (const name of ["archive", "screenshot", "log"]) {
        const row = result.testResultAttachmentLocator.filter({ has: page.getByText(name, { exact: true }) });
        const download = row.getByTestId("attachment-download-button");
        await expect(download).toBeDisabled();
        await download.locator("..").hover();
        await expect(page.getByText("Attachment not found", { exact: true }).last()).toBeVisible();
        await page.mouse.move(0, 0);
        await expect(page.getByText("Attachment not found", { exact: true })).toHaveCount(0);
      }
      await result.testResultAttachmentLocator
        .filter({ has: page.getByText("screenshot", { exact: true }) })
        .getByTestId("attachment-expand-button")
        .click();
      const modal = page.getByTestId("attachment-modal");
      await expect(modal.getByTestId("attachment-download-button")).toBeDisabled();
      await expect(modal.getByRole("button", { name: "Open in new tab" })).toBeDisabled();
      await page.keyboard.press("Escape");
      await expect(modal).not.toBeVisible();
      const emptyRow = result.testResultAttachmentLocator.filter({ has: page.getByText("empty log", { exact: true }) });
      const downloadEvent = page.waitForEvent("download");
      await emptyRow.getByTestId("attachment-download-button").click();
      const download = await downloadEvent;
      expect(await download.failure()).toBeNull();
      const stream = await download.createReadStream();
      const chunks: Buffer[] = [];
      for await (const chunk of stream) chunks.push(Buffer.from(chunk));
      expect(Buffer.concat(chunks)).toHaveLength(0);
      await result.attachScreenshot();
    } finally {
      await bootstrap.shutdown();
    }
  });
}
