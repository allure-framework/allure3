import { type Locator, type Page } from "@playwright/test";

export class CommonPage {
  reportTitleLocator: Locator;

  toggleLayoutButtonLocator: Locator;
  splitLayoutLocator: Locator;
  singleLayoutLocator: Locator;

  envPickerLocator: Locator;
  envPickerButtonLocator: Locator;

  constructor(readonly page: Page) {
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
