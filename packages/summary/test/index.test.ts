import { story } from "allure-js-commons";
import { beforeEach, expect, it } from "vitest";

import { generateSummaryStaticFiles } from "../src/generators.js";

beforeEach(async () => {
  await story("index");
});
it("should embed the packaged bundle", async () => {
  const html = await generateSummaryStaticFiles({ summaries: [] });

  expect(html).toContain("data:text/javascript;base64,");
});
