import type { TestResultPage } from "./TestResult.js";
import { PageObject } from "./pageObject.js";

/**
 * A test fixture to validate test links.
 */
export class LinkFixture extends PageObject {
  /**
   * A locator for the link.
   */
  readonly locator = this.testResultPage.linksLocator.getByTestId("test-result-meta-link").nth(this.linkIndex);

  /**
   * A locator for the link's icon.
   */
  readonly iconLocator = this.locator.locator("svg");

  /**
   * A locator for the link's anchor (<a> tag).
   */
  readonly anchorLocator = this.locator.getByRole("link");

  constructor(
    readonly testResultPage: TestResultPage,
    readonly linkIndex: number,
  ) {
    super(testResultPage.page);
  }

  async screenshot() {
    return await this.locator.screenshot();
  }
}
