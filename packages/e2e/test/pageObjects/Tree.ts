import { type Locator, type Page } from "@playwright/test";
import { randomNumber } from "../utils/index.js";
import { CommonPage } from "./Common.js";

export class TreePage extends CommonPage {
  leafLocator: Locator;

  leafStatusPassedLocator: Locator;
  leafStatusFailedLocator: Locator;
  leafStatusSkippedLocator: Locator;
  leafStatusBrokenLocator: Locator;
  leafStatusUnknownLocator: Locator;

  sectionsLocator: Locator;
  searchLocator: Locator;
  searchClearLocator: Locator;

  metadataTotalLocator: Locator;
  metadataRetriesLocator: Locator;
  metadataFlakyLocator: Locator;
  metadataPassedLocator: Locator;
  metadataFailedLocator: Locator;
  metadataSkippedLocator: Locator;
  metadataBrokenLocator: Locator;
  metadataUnknownLocator: Locator;
  metadataNewLocator: Locator;

  envSectionButtonLocator: Locator;
  envSectionContentLocator: Locator;

  filtersButtonLocator: Locator;
  filtersMenuLocator: Locator;

  retryFilterLocator: Locator;
  flakyFilterLocator: Locator;
  newFilterLocator: Locator;

  constructor(readonly page: Page) {
    super(page);

    this.leafLocator = page.getByTestId("tree-leaf");

    this.leafStatusPassedLocator = page.getByTestId("tree-leaf-status-passed");
    this.leafStatusFailedLocator = page.getByTestId("tree-leaf-status-failed");
    this.leafStatusSkippedLocator = page.getByTestId("tree-leaf-status-skipped");
    this.leafStatusBrokenLocator = page.getByTestId("tree-leaf-status-broken");
    this.leafStatusUnknownLocator = page.getByTestId("tree-leaf-status-unknown");

    this.sectionsLocator = page.getByTestId("tree-section");
    this.searchLocator = page.getByTestId("search-input");
    this.searchClearLocator = page.getByTestId("clear-button");

    this.metadataTotalLocator = page.getByTestId("metadata-item-total");
    this.metadataRetriesLocator = page.getByTestId("metadata-item-retries");
    this.metadataFlakyLocator = page.getByTestId("metadata-item-flaky");
    this.metadataPassedLocator = page.getByTestId("metadata-item-passed");
    this.metadataFailedLocator = page.getByTestId("metadata-item-failed");
    this.metadataBrokenLocator = page.getByTestId("metadata-item-broken");
    this.metadataSkippedLocator = page.getByTestId("metadata-item-skipped");
    this.metadataUnknownLocator = page.getByTestId("metadata-item-unknown");
    this.metadataNewLocator = page.getByTestId("metadata-item-new");

    this.envSectionContentLocator = page.getByTestId("tree-section-env-content");
    this.envSectionButtonLocator = page.getByTestId("tree-section-env-button");

    this.filtersButtonLocator = page.getByTestId("filters-button");
    this.filtersMenuLocator = page.getByTestId("filters-menu");

    this.retryFilterLocator = page.getByTestId("retry-filter");
    this.flakyFilterLocator = page.getByTestId("flaky-filter");
    this.newFilterLocator = page.getByTestId("new-filter");
  }

  getNthLeafLocator(n: number) {
    return this.leafLocator.nth(n);
  }

  getNthLeafTitleLocator(n: number) {
    return this.getNthLeafLocator(n).getByTestId("tree-leaf-title");
  }

  getNthLeafOrderLocator(n: number) {
    return this.getNthLeafLocator(n).getByTestId("tree-leaf-order");
  }

  getNthLeafPassedStatusLocator(n: number) {
    return this.getNthLeafLocator(n).getByTestId("tree-leaf-status-passed");
  }

  getNthLeafFailedStatusLocator(n: number) {
    return this.getNthLeafLocator(n).getByTestId("tree-leaf-status-failed");
  }

  getNthLeafSkippedStatusLocator(n: number) {
    return this.getNthLeafLocator(n).getByTestId("tree-leaf-status-skipped");
  }

  getNthLeafBrokenStatusLocator(n: number) {
    return this.getNthLeafLocator(n).getByTestId("tree-leaf-status-broken");
  }

  getNthLeafUnknownStatusLocator(n: number) {
    return this.getNthLeafLocator(n).getByTestId("tree-leaf-status-unknown");
  }

  getNthSectionLocator(n: number) {
    return this.sectionsLocator.nth(n);
  }

  getNthSectionTitleLocator(n: number) {
    return this.getNthSectionLocator(n).getByTestId("tree-section-title");
  }

  getLeafByTitle(title: string) {
    return this.leafLocator.filter({
      has: this.page.getByText(title, { exact: true }),
    });
  }

  async getMetadataValue(
    metadata: "total" | "retries" | "flaky" | "passed" | "failed" | "skipped" | "broken" | "unknown" | "new" = "total",
  ) {
    let baseLocator: Locator;

    switch (metadata) {
      case "total":
        baseLocator = this.metadataTotalLocator;
        break;
      case "retries":
        baseLocator = this.metadataRetriesLocator;
        break;
      case "flaky":
        baseLocator = this.metadataFlakyLocator;
        break;
      case "passed":
        baseLocator = this.metadataPassedLocator;
        break;
      case "failed":
        baseLocator = this.metadataFailedLocator;
        break;
      case "skipped":
        baseLocator = this.metadataSkippedLocator;
        break;
      case "broken":
        baseLocator = this.metadataBrokenLocator;
        break;
      case "unknown":
        baseLocator = this.metadataUnknownLocator;
        break;
      case "new":
        baseLocator = this.metadataNewLocator;
        break;
      default:
        throw new Error(`Unknown metadata: ${metadata as string}`);
    }

    try {
      return (await baseLocator.getByTestId("metadata-value").innerText({ timeout: 1000 })).trim();
    } catch (err) {
      return undefined;
    }
  }

  async getMetadataValues() {
    return {
      total: await this.getMetadataValue("total"),
      retries: await this.getMetadataValue("retries"),
      flaky: await this.getMetadataValue("flaky"),
      new: await this.getMetadataValue("new"),
      passed: await this.getMetadataValue("passed"),
      failed: await this.getMetadataValue("failed"),
      skipped: await this.getMetadataValue("skipped"),
      broken: await this.getMetadataValue("broken"),
      unknown: await this.getMetadataValue("unknown"),
    };
  }

  async clickNthLeaf(n: number) {
    await this.leafLocator.nth(n).click();
  }

  async clickLeafByTitle(title: string) {
    await this.getLeafByTitle(title).nth(0).click();
  }

  async clickRandomLeaf() {
    // wait before any leaf appear
    await this.leafLocator.nth(0).waitFor({ state: "visible" });

    const leavesCount = await this.leafLocator.count();

    if (leavesCount === 0) {
      throw new Error("No leaves found");
    }

    await this.leafLocator.nth(randomNumber(0, leavesCount - 1)).click();
  }

  async toggleNthSection(n: number) {
    await this.sectionsLocator.nth(n).getByTestId("tree-arrow").click();
  }

  async clickTreeTab(tab: string) {
    await this.page.getByTestId(`tab-${tab}`).click();
  }

  async searchTree(text: string) {
    await this.searchLocator.fill(text);
  }

  async searchClear() {
    await this.searchClearLocator.click();
  }

  async openFilterMenu() {
    await this.filtersButtonLocator.click();
    await this.filtersMenuLocator.waitFor({ state: "visible" });
  }

  async closeFilterMenu() {
    await this.filtersMenuLocator.waitFor({ state: "visible" });
    await this.filtersButtonLocator.click();
    await this.filtersMenuLocator.waitFor({ state: "hidden" });
  }

  async toggleRetryFilter() {
    await this.openFilterMenu();
    await this.retryFilterLocator.click();
    await this.closeFilterMenu();
  }

  async toggleFlakyFilter() {
    await this.openFilterMenu();
    await this.flakyFilterLocator.click();
    await this.closeFilterMenu();
  }

  async toggleNewFilter() {
    await this.openFilterMenu();
    await this.newFilterLocator.click();
    await this.closeFilterMenu();
  }
}
