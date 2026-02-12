import type { Locator } from "@playwright/test";
import type { TestResultPage } from "./TestResult.js";
import { PageObject } from "./pageObject.js";

/**
 * A test fixture to validate test steps.
 */
export class StepResultFixture extends PageObject {
  /**
   * A locator for the step result.
   */
  readonly locator = (this.parent?.substepsLocator ?? this.testResultPage.stepLocator)
    .filter({ has: this.page.getByText(this.stepName, { exact: true }) })
    .last();

  /**
   * A locator for the content of the step. The step's content is visible if and only if the step exists and is
   * expanded.
   */
  readonly contentLocator = this.locator.getByTestId("test-result-step-content").first();

  /**
   * A locator for the sub-steps of the step. The step's sub-steps are visible if and only if the step exists,
   * is expanded, and has at least one sub-step.
   */
  readonly substepsLocator: Locator = this.locator.getByTestId("test-result-step");

  #allStepDetailsLocator = this.locator.getByTestId("test-result-error");
  #substepDetailsLocator = this.substepsLocator.getByTestId("test-result-error");

  /**
   * A locator for the step's details. The step's details are visible if and only if the step exists, is expanded,
   * and has details.
   *
   * WARNING: make sure `hasDetails` returns `true` before using this locator. Otherwise, it may point to a sub-step's
   * details.
   */
  readonly stepDetailsLocator = this.#allStepDetailsLocator.first();

  /**
   * A locator for the step's message. The step's message is visible if and only if the step exists, is expanded, and
   * has details.
   *
   * WARNING: make sure `hasDetails` returns `true` before using this locator. Otherwise, it may point to a sub-step's
   * message.
   */
  readonly stepMessageLocator = this.stepDetailsLocator.getByTestId("test-result-error-message");

  /**
   * A locator for the step's trace. The step's trace is visible if and only if the step exists, is expanded, has
   * details with a trace defined, and the details are expanded.
   *
   * WARNING: make sure `hasDetails` returns `true` before using this locator. Otherwise, it may point to a sub-step's
   * trace.
   */
  readonly stepTraceLocator = this.stepDetailsLocator.getByTestId("test-result-error-trace");

  constructor(
    readonly testResultPage: TestResultPage,
    readonly stepName: string,
    readonly parent?: StepResultFixture,
  ) {
    super(testResultPage.page);
  }

  async screenshot() {
    return await this.locator.screenshot();
  }

  /**
   * Expands or collapses the step's sub-steps.
   */
  async toggleStep() {
    await this.locator.getByTestId("test-result-step-arrow-button").click();
  }

  /**
   * Expands or collapses the step's trace.
   */
  async toggleDetails() {
    if (await this.hasDetails()) {
      await this.stepMessageLocator.click();
    }
  }

  /**
   * Checks if the step has details.
   *
   * WARNING: make sure the step is expanded before calling this method.
   *
   * @returns `true` if the step is visible, has status details and is expanded, `false` otherwise.
   */
  async hasDetails() {
    await this.contentLocator.waitFor();
    return (await this.#allStepDetailsLocator.count()) === (await this.#substepDetailsLocator.count()) + 1;
  }

  /**
   * Returns a fixture for a sub-step of the current step.
   *
   * HINT: make sure the step is expanded before accessing the sub-step.
   *
   * @param name The name of the sub-step to get.
   */
  getSubstepByName(name: string) {
    return new StepResultFixture(this.testResultPage, name, this);
  }
}
