import type { Page } from "@playwright/test";
import { attachment } from "allure-js-commons";

export class PageObject {
  constructor(readonly page: Page) {}

  async screenshot(name: string = "screenshot") {
    const screenshot = await this.page.screenshot({
      fullPage: true,
    });

    await attachment(name, screenshot, "image/png");
  }
}
