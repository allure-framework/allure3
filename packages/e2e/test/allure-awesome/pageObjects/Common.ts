import { type Locator, type Page } from "@playwright/test";
import { PageObject } from "./pageObject.js";

export class CommonPage extends PageObject {
  reportTitleLocator: Locator;

  toggleLayoutButtonLocator: Locator;
  splitLayoutLocator: Locator;
  singleLayoutLocator: Locator;

  envPickerLocator: Locator;
  envPickerButtonLocator: Locator;

  constructor(readonly page: Page) {
    super(page);

    this.reportTitleLocator = page.getByTestId("report-title");

    this.toggleLayoutButtonLocator = page.getByTestId("toggle-layout-button");
    this.splitLayoutLocator = page.getByTestId("split-layout");
    this.singleLayoutLocator = page.getByTestId("base-layout");

    this.envPickerLocator = page.getByTestId("environment-picker");
    this.envPickerButtonLocator = page.getByTestId("environment-picker-button");
  }

  async toggleLayout() {
    await this.toggleLayoutButtonLocator.click();
  }

  async selectEnv(env: string) {
    await this.envPickerButtonLocator.click();
    await this.envPickerLocator.getByText(env).click();
  }
}
