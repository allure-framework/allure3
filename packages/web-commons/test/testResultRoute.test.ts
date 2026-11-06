import { feature, label } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vite-plus/test";

import { parseTestResultRoute } from "../src/testResultRoute.js";

const id = "a049cc5833d39a62f849b32397895f1f";

describe("public test result routes", () => {
  beforeEach(async () => {
    await feature("test-result-routing");
    await label("layer", "unit");
  });

  it.each([`#testresult/${id}`, `#testresult/${id}/`, `#/testresult/${id}`, `#${id}`, `#${id}/`])(
    "extracts the result ID from %s",
    (hash) => {
      expect(parseTestResultRoute(hash)).toBe(id);
    },
  );

  it.each([
    "",
    "#overview",
    "#charts",
    "#suites/group/result/",
    "#testresult",
    "#testresult/",
    "#testresult/id/extra",
    "#unknown",
    `#${id}/history`,
  ])("does not intercept %s", (hash) => {
    expect(parseTestResultRoute(hash)).toBeUndefined();
  });
});
