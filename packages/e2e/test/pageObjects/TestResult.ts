import { type Locator, type Page } from "@playwright/test";

import { CommonPage } from "./Common.js";
import { LinkFixture } from "./LinkFixture.js";
import { RetryItemFixture } from "./RetryItem.js";
import { StepResultFixture } from "./StepResult.js";

export class TestResultPage extends CommonPage {
  titleLocator: Locator;
  fullnameLocator: Locator;
  fullnameCopyLocator: Locator;

  statusPassedLocator: Locator;
  statusFailedLocator: Locator;
  statusSkippedLocator: Locator;
  statusBrokenLocator: Locator;
  statusUnknownLocator: Locator;

  navPrevLocator: Locator;
  navNextLocator: Locator;
  navCurrentLocator: Locator;

  errorMessageLocator: Locator;
  errorTraceLocator: Locator;
  errorDiffButtonLocator: Locator;
  errorDiffLocator: Locator;

  descriptionLocator: Locator;

  tabLocator: Locator;

  envItemLocator: Locator;

  stepLocator: Locator;

  testResultAttachmentLocator: Locator;

  imageAttachmentContentLocator: Locator;
  codeAttachmentContentLocator: Locator;
  videoAttachmentContentLocator: Locator;

  historyItemLocator: Locator;
  retriesItemLocator: Locator;
  prevStatusLocator: Locator;

  linksLocator: Locator;

  constructor(readonly page: Page) {
    super(page);

    this.titleLocator = page.getByTestId("test-result-info-title");
    this.fullnameLocator = page.getByTestId("test-result-fullname");
    this.fullnameCopyLocator = page.getByTestId("test-result-fullname-copy");

    this.statusPassedLocator = page.getByTestId("test-result-status-passed");
    this.statusFailedLocator = page.getByTestId("test-result-status-failed");
    this.statusSkippedLocator = page.getByTestId("test-result-status-skipped");
    this.statusBrokenLocator = page.getByTestId("test-result-status-broken");
    this.statusUnknownLocator = page.getByTestId("test-result-status-unknown");

    this.navPrevLocator = page.getByTestId("test-result-nav-prev");
    this.navNextLocator = page.getByTestId("test-result-nav-next");
    this.navCurrentLocator = page.getByTestId("test-result-nav-current");

    this.errorMessageLocator = page.getByTestId("test-result-error-message");
    this.errorTraceLocator = page.getByTestId("test-result-error-trace");
    this.errorDiffButtonLocator = page.getByTestId("test-result-diff-button");
    this.errorDiffLocator = page.getByTestId("test-result-diff");

    this.descriptionLocator = page.getByTestId("test-result-description");

    this.tabLocator = page.getByTestId("test-result-tab");

    this.envItemLocator = page.getByTestId("test-result-env-item");

    this.stepLocator = page.getByTestId("test-result-step");

    this.testResultAttachmentLocator = page.getByTestId("test-result-attachment");

    this.imageAttachmentContentLocator = page.getByTestId("image-attachment-content");
    this.codeAttachmentContentLocator = page.getByTestId("code-attachment-content");
    this.videoAttachmentContentLocator = page.getByTestId("video-attachment-content");

    this.historyItemLocator = page.getByTestId("test-result-history-item");
    this.retriesItemLocator = page.getByTestId("test-result-retries-item");
    this.prevStatusLocator = page.getByTestId("test-result-prev-status");

    this.linksLocator = page.getByTestId("test-result-meta-links");
  }

  tabById(id: string) {
    return this.page.getByTestId(`test-result-tab-${id}`);
  }

  /**
   * Returns a fixture for a top-level step of the current test.
   */
  getStepByName(stepName: string) {
    return new StepResultFixture(this, stepName);
  }

  /**
   * Returns a fixture for a retry item at a specific index.
   *
   * NOTE: the retries are in the most recent first order, which means index 0 corresponds to the most recent retry in
   * the list.
   */
  getRetry(index: number) {
    return new RetryItemFixture(this, index);
  }

  /**
   * Returns a fixture for a link by its index.
   */
  getLink(index: number) {
    return new LinkFixture(this, index);
  }

  get envTabLocator() {
    return this.tabById("environments");
  }

  get historyTabLocator() {
    return this.tabById("history");
  }

  get attachmentsTabLocator() {
    return this.tabById("attachments");
  }

  async clickNextTestResult() {
    await this.navNextLocator.click();
  }

  async clickPrevTestResult() {
    await this.navPrevLocator.click();
  }

  async copyFullname() {
    await this.fullnameCopyLocator.click();
  }

  async toggleStepByTitle(title: string) {
    const locator = this.stepLocator.filter({
      has: this.page.getByText(title, { exact: true }),
    });

    await locator.nth(0).waitFor({ state: "visible" });
    await locator.nth(0).getByTestId("test-result-step-header").click();
  }

  async expandStepByTitle(title: string) {
    const locator = this.stepLocator.filter({
      has: this.page.getByText(title, { exact: true }),
    });
    const step = locator.first();
    const content = step.getByTestId("test-result-step-content");

    await step.waitFor({ state: "visible", timeout: 10000 });
    const isOpened = await content.isVisible().catch(() => false);
    if (isOpened) {
      return;
    }

    await step.getByTestId("test-result-step-header").click();
    await content.waitFor({ state: "visible", timeout: 10000 });
  }

  async toggleAttachmentByTitle(title: string) {
    const locator = this.testResultAttachmentLocator.filter({
      has: this.page.getByText(title, { exact: true }),
    });

    await locator.first().waitFor({ state: "visible", timeout: 10000 });
    await locator.first().click();
  }

  async waitForImageAttachmentLoaded(timeout = 15000) {
    const image = this.imageAttachmentContentLocator.first().locator("img");
    await image.waitFor({ state: "visible", timeout });
    const imageHandle = await image.elementHandle();
    if (!imageHandle) {
      throw new Error("Image element is not available");
    }
    await this.page.waitForFunction(
      (el: unknown) => {
        if (!el || typeof el !== "object") {
          return false;
        }
        const candidate = el as { complete?: boolean; naturalWidth?: number };
        return Boolean(candidate.complete) && (candidate.naturalWidth ?? 0) > 0;
      },
      imageHandle,
      { timeout },
    );
  }

  async toggleLinkSection() {
    this.linksLocator.getByRole("button").click();
  }
}
