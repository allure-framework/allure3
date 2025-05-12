import { type Locator, type Page } from "@playwright/test";
import { PageObject } from "./pageObject.js";

export class TestResultPage extends PageObject {
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

  tabLocator: Locator;

  envItemLocator: Locator;

  stepLocator: Locator;

  testResultAttachmentLocator: Locator;

  imageAttachmentContentLocator: Locator;
  codeAttachmentContentLocator: Locator;
  videoAttachmentContentLocator: Locator;

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

    this.tabLocator = page.getByTestId("test-result-tab");

    this.envItemLocator = page.getByTestId("test-result-env-item");

    this.stepLocator = page.getByTestId("test-result-step");

    this.testResultAttachmentLocator = page.getByTestId("test-result-attachment");

    this.imageAttachmentContentLocator = page.getByTestId("image-attachment-content");
    this.codeAttachmentContentLocator = page.getByTestId("code-attachment-content");
    this.videoAttachmentContentLocator = page.getByTestId("video-attachment-content");
  }

  tabById(id: string) {
    return this.page.getByTestId(`test-result-tab-${id}`);
  }

  get envTabLocator() {
    return this.tabById("environments");
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

    await locator.nth(0).getByTestId("test-result-step-arrow-button").click();
  }

  async toggleAttachmentByTitle(title: string) {
    const locator = this.testResultAttachmentLocator.filter({
      has: this.page.getByText(title, { exact: true }),
    });

    await locator.click();
  }
}
