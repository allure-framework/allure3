import { displayName, epic, feature, label, parameter, story } from "allure-js-commons";
import { beforeEach, expect, it } from "vitest";

beforeEach(async () => {
  await epic("coverage");
  await feature("report-output");
  await story("parameters");
  await label("coverage", "report-output");
  await label("env", "foo");
});

it.each([
  {
    browser: "chromium",
    locale: "en-US",
    role: "administrator",
    dataset: "fixtures/checkouts/enterprise/accounts/north-america/primary-customer.json",
    accessToken: "chromium-secret-token",
    internalId: "internal-chromium-id",
  },
  {
    browser: "firefox",
    locale: "de-DE",
    role: "viewer",
    dataset: "fixtures/checkouts/consumer/accounts/europe/returning-customer.json",
    accessToken: "firefox-secret-token",
    internalId: "internal-firefox-id",
  },
])("parameterized checkout for $browser and $locale", async (testCase) => {
  await displayName("parameterized checkout");
  await parameter("browser", testCase.browser);
  await parameter("locale", testCase.locale);
  await parameter("role", testCase.role);
  await parameter("dataset", testCase.dataset);
  await parameter("constant", "sandbox");
  await parameter("accessToken", testCase.accessToken, { mode: "masked" });
  await parameter("internalId", testCase.internalId, { mode: "hidden" });
  await parameter("empty", "");

  expect(testCase.browser).toBeTruthy();
  expect(testCase.locale).toBeTruthy();
});
