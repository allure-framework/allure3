import { type Locator, type Page } from "@playwright/test";
import { PageObject } from "./pageObject.js";

export class SummaryPage extends PageObject {
  reportCardLocator: Locator;

  constructor(readonly page: Page) {
    super(page);

    this.reportCardLocator = page.getByTestId("summary-report-card");
  }

  async clickReportCard(idx: number) {
    await this.reportCardLocator.nth(idx).click();
  }
}
