import type { TestResultPage } from "./TestResult.js";
import { PageObject } from "./pageObject.js";

/**
 * A test fixture to validate retries.
 */
export class RetryItemFixture extends PageObject {
  /**
   * A locator for the retry item.
   */
  readonly locator = this.testResultPage.retriesItemLocator.nth(this.index);

  /**
   * A locator for the text of the retry item.
   */
  readonly textLocator = this.locator.getByTestId("test-result-retries-item-text");

  /**
   * A locator for the retry item's details.
   */
  readonly detailsLocator = this.locator.getByTestId("test-result-error");

  /**
   * A locator for the retry item's details message.
   */
  readonly messageLocator = this.detailsLocator.getByTestId("test-result-error-message");

  /**
   * A locator for the retry item's details trace.
   */
  readonly traceLocator = this.detailsLocator.getByTestId("test-result-error-trace");

  constructor(
    readonly testResultPage: TestResultPage,
    readonly index: number,
  ) {
    super(testResultPage.page);
  }

  async screenshot() {
    return await this.locator.screenshot();
  }

  /**
   * Expands or collapses the retry item's details.
   */
  async toggleDetails() {
    await this.locator.getByTestId("test-result-retries-item-arrow-button").click();
  }

  /**
   * Expands or collapses the retry item's trace.
   */
  async toggleTrace() {
    await this.messageLocator.click();
  }

  /**
   * Opens a retry details page.
   */
  async openRetry() {
    await this.locator.getByTestId("test-result-retries-item-open-button").click();
  }
}
