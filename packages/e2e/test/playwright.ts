import { expect as baseExpect } from "@playwright/test";
import type { StepResultFixture } from "./pageObjects/StepResult.js";

export { test } from "@playwright/test";

export const expect = baseExpect.extend({
  async toHaveDetails(step: StepResultFixture, message: string | RegExp, trace?: string | RegExp) {
    const assertionName = "toHaveDetails";
    let pass: boolean;
    let matcherResult: any;

    let locator = step.stepMessageLocator;
    let expectedValue = message;

    if (await step.hasDetails()) {
      try {
        const expectation = this.isNot ? baseExpect(locator).not : baseExpect(locator);
        await expectation.toHaveText(message);
        pass = true;
      } catch (e: any) {
        matcherResult = e.matcherResult;
        pass = false;
      }
    }

    if (pass && typeof trace !== "undefined") {
      locator = step.stepTraceLocator;
      expectedValue = trace;
      try {
        const expectation = this.isNot ? baseExpect(locator).not : baseExpect(locator);
        await expectation.toHaveText(expectedValue);
        pass = true;
      } catch (e: any) {
        matcherResult = e.matcherResult;
        pass = false;
      }
    }

    if (this.isNot) {
      pass = !pass;
    }

    const matcherHint = this.utils.matcherHint(assertionName, undefined, undefined, { isNot: this.isNot });
    const expected = this.utils.printExpected(expectedValue);
    const received = matcherResult ? `Received: ${this.utils.printReceived(matcherResult.actual)}` : "";

    /* eslint-disable @typescript-eslint/restrict-template-expressions */
    /* eslint-disable @typescript-eslint/no-base-to-string */
    const getErrorMessage = pass
      ? () => `${matcherHint}\n\nLocator: ${locator}\nExpected: not ${expected}\n${received}`
      : () => `${matcherHint}\n\nLocator: ${locator}\nExpected: ${expected}\n${received}`;
    /* eslint-enable @typescript-eslint/no-base-to-string */
    /* eslint-enable @typescript-eslint/restrict-template-expressions */

    return {
      message: getErrorMessage,
      pass,
      name: assertionName,
      expected: expectedValue,
      actual: matcherResult?.actual,
    };
  },
});
