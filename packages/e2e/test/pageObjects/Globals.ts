import { type Locator, type Page } from "@playwright/test";
import { CommonPage } from "./Common.js";

export class GlobalsPage extends CommonPage {
  reportDateLocator: Locator;

  globalAttachmentsTabLocator: Locator;
  globalErrorsTabLocator: Locator;

  constructor(readonly page: Page) {
    super(page);

    this.reportDateLocator = page.getByTestId("report-date");
    this.globalAttachmentsTabLocator = page.getByTestId("nav-tab-globalAttachments");
    this.globalErrorsTabLocator = page.getByTestId("nav-tab-globalErrors");
  }
}
