import { attachment } from "allure-js-commons";
import { expect, it } from "vite-plus/test";

const MERMAID_CONTENT_TYPE = "application/vnd.allure.diagrams.mermaid";

it("sample test with Mermaid chart attachment", async () => {
  const chart = [
    "flowchart LR",
    "  Request[Submit order] --> Validation{Order valid?}",
    "  Validation -->|Yes| Fulfillment[Fulfill order]",
    "  Validation -->|No| Rejection[Reject order]",
  ].join("\n");

  await attachment("Order flow", chart, MERMAID_CONTENT_TYPE);

  expect(chart).toContain("flowchart LR");
});
