import { type Locator, type Page } from "@playwright/test";
import { CommonPage } from "./Common.js";

export class QualityGatesPage extends CommonPage {
  qualityGatesTabLocator: Locator;

  qualityGatesSectionLocator: Locator;
  qualityGatesSectionEnvContentLocator: Locator;
  qualityGatesSectionEnvButton: Locator;

  qualityGatesResultLocator: Locator;
  qualityGatesResultRuleLocator: Locator;
  qualityGatesResultMessageLocator: Locator;

  constructor(readonly page: Page) {
    super(page);

    this.qualityGatesTabLocator = page.getByTestId("nav-tab-qualityGate");

    this.qualityGatesResultLocator = page.getByTestId("quality-gate-result");
    this.qualityGatesResultRuleLocator = page.getByTestId("quality-gate-result-rule");
    this.qualityGatesResultMessageLocator = page.getByTestId("quality-gate-result-message");

    this.qualityGatesSectionLocator = page.getByTestId("quality-gate-results-section");
    this.qualityGatesSectionEnvButton = page.getByTestId("quality-gate-results-section-env-button");
    this.qualityGatesSectionEnvContentLocator = page.getByTestId("quality-gate-results-section-env-content");
  }
}
