import type { Page } from "@playwright/test";
import { attachment } from "allure-js-commons";

export class PageObject {
  constructor(readonly page: Page) {}

  async screenshot() {
    return await this.page.screenshot({
      fullPage: true,
    });
  }

  async attachScreenshot(name: string = "screenshot") {
    await attachment(name, await this.screenshot(), "image/png");
  }
}
