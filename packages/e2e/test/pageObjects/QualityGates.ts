import { type Locator, type Page } from "@playwright/test";
import { CommonPage } from "./Common.js";

export class QualityGatesPage extends CommonPage {
  qualityGatesTabLocator: Locator;
  qualityGatesResultLocator: Locator;

  constructor(readonly page: Page) {
    super(page);

    this.qualityGatesTabLocator = page.getByTestId("nav-tab-qualityGate");
    this.qualityGatesResultLocator = page.getByTestId("report-quality-gate-result");
  }
}
