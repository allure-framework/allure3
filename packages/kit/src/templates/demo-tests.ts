export interface DemoTestTemplate {
  frameworkId: string;
  filename: string;
  content: string;
}

const VITEST_DEMO = `import { describe, expect, it } from "vitest";
import * as allure from "allure-js-commons";

describe("Allure Demo — Vitest", () => {
  it("showcases labels and metadata", async () => {
    await allure.epic("Allure Demo");
    await allure.feature("Labels & Metadata");
    await allure.story("All label types");
    await allure.severity("critical");
    await allure.owner("QA Team");
    await allure.tag("demo");
    await allure.tag("smoke");

    await allure.description(
      "This test demonstrates how to attach rich metadata to your test results.\\n\\n" +
        "Allure supports: **epic**, **feature**, **story**, **severity**, **owner**, **tags**, and more.",
    );

    await allure.link("https://docs.qameta.io/allure-report/", "Allure Docs", "docs");

    expect(true).toBe(true);
  });

  it("showcases steps", async () => {
    await allure.epic("Allure Demo");
    await allure.feature("Steps");
    await allure.severity("normal");

    await allure.step("Step 1: Prepare test data", async () => {
      const data = { user: "demo", role: "admin" };

      await allure.step("Generate user payload", async () => {
        expect(data.user).toBe("demo");
      });
    });

    await allure.step("Step 2: Execute action", async () => {
      const result = 2 + 2;

      expect(result).toBe(4);
    });

    await allure.step("Step 3: Verify result", async () => {
      expect(true).toBe(true);
    });
  });

  it("showcases attachments", async () => {
    await allure.epic("Allure Demo");
    await allure.feature("Attachments");
    await allure.severity("minor");

    await allure.attachment("plain-text.txt", "Hello from Allure!", "text/plain");

    await allure.attachment(
      "test-data.json",
      JSON.stringify({ status: "ok", items: [1, 2, 3] }, null, 2),
      "application/json",
    );

    await allure.attachment(
      "sample.csv",
      "name,value\\nalpha,1\\nbeta,2\\ngamma,3",
      "text/csv",
    );

    expect(true).toBe(true);
  });

  it("showcases parameters", async () => {
    await allure.epic("Allure Demo");
    await allure.feature("Parameters");
    await allure.severity("normal");

    const browser = "chromium";
    const viewport = "1920x1080";

    await allure.parameter("browser", browser);
    await allure.parameter("viewport", viewport);
    await allure.parameter("env", "staging", { mode: "hidden" });

    expect(browser).toBe("chromium");
  });

  it("showcases links and issue tracking", async () => {
    await allure.epic("Allure Demo");
    await allure.feature("Links");
    await allure.severity("normal");

    await allure.issue("DEMO-123", "https://jira.example.com/browse/DEMO-123");
    await allure.tms("TMS-456", "https://tms.example.com/case/TMS-456");
    await allure.link("https://example.com/docs/api", "API Documentation");

    expect(true).toBe(true);
  });
});
`;

const PLAYWRIGHT_DEMO = `import { expect, test } from "@playwright/test";
import * as allure from "allure-js-commons";

test.describe("Allure Demo — Playwright", () => {
  test("showcases labels and metadata", async ({ page }) => {
    await allure.epic("Allure Demo");
    await allure.feature("Labels & Metadata");
    await allure.story("All label types");
    await allure.severity("critical");
    await allure.owner("QA Team");
    await allure.tag("demo");
    await allure.tag("smoke");

    await allure.description(
      "This test demonstrates how to attach rich metadata to your Playwright test results.",
    );

    await allure.link("https://docs.qameta.io/allure-report/", "Allure Docs", "docs");

    await page.goto("https://example.com");
    await expect(page).toHaveTitle(/Example/);
  });

  test("showcases steps", async ({ page }) => {
    await allure.epic("Allure Demo");
    await allure.feature("Steps");
    await allure.severity("normal");

    await allure.step("Navigate to page", async () => {
      await page.goto("https://example.com");
    });

    await allure.step("Verify page content", async () => {
      await expect(page.locator("h1")).toBeVisible();
    });

    await allure.step("Check page title", async () => {
      await expect(page).toHaveTitle(/Example/);
    });
  });

  test("showcases attachments and screenshots", async ({ page }) => {
    await allure.epic("Allure Demo");
    await allure.feature("Attachments");
    await allure.severity("minor");

    await page.goto("https://example.com");

    const screenshot = await page.screenshot();

    await allure.attachment("page-screenshot.png", screenshot, "image/png");

    await allure.attachment(
      "page-info.json",
      JSON.stringify({ url: page.url(), title: await page.title() }, null, 2),
      "application/json",
    );

    await expect(page).toHaveTitle(/Example/);
  });

  test("showcases parameters", async ({ page }) => {
    await allure.epic("Allure Demo");
    await allure.feature("Parameters");
    await allure.severity("normal");

    const url = "https://example.com";

    await allure.parameter("url", url);
    await allure.parameter("browser", test.info().project.name || "default");

    await page.goto(url);
    await expect(page).toHaveTitle(/Example/);
  });

  test("showcases links and issue tracking", async () => {
    await allure.epic("Allure Demo");
    await allure.feature("Links");
    await allure.severity("normal");

    await allure.issue("DEMO-123", "https://jira.example.com/browse/DEMO-123");
    await allure.tms("TMS-456", "https://tms.example.com/case/TMS-456");
    await allure.link("https://example.com/docs/api", "API Documentation");

    expect(true).toBe(true);
  });
});
`;

const JEST_DEMO = `import * as allure from "allure-js-commons";

describe("Allure Demo — Jest", () => {
  it("showcases labels and metadata", async () => {
    await allure.epic("Allure Demo");
    await allure.feature("Labels & Metadata");
    await allure.story("All label types");
    await allure.severity("critical");
    await allure.owner("QA Team");
    await allure.tag("demo");
    await allure.tag("smoke");

    await allure.description(
      "This test demonstrates how to attach rich metadata to your Jest test results.",
    );

    await allure.link("https://docs.qameta.io/allure-report/", "Allure Docs", "docs");

    expect(true).toBe(true);
  });

  it("showcases steps", async () => {
    await allure.epic("Allure Demo");
    await allure.feature("Steps");
    await allure.severity("normal");

    await allure.step("Step 1: Prepare test data", async () => {
      const data = { user: "demo", role: "admin" };

      await allure.step("Generate user payload", async () => {
        expect(data.user).toBe("demo");
      });
    });

    await allure.step("Step 2: Execute action", async () => {
      const result = 2 + 2;

      expect(result).toBe(4);
    });

    await allure.step("Step 3: Verify result", async () => {
      expect(true).toBe(true);
    });
  });

  it("showcases attachments", async () => {
    await allure.epic("Allure Demo");
    await allure.feature("Attachments");
    await allure.severity("minor");

    await allure.attachment("plain-text.txt", "Hello from Allure!", "text/plain");

    await allure.attachment(
      "test-data.json",
      JSON.stringify({ status: "ok", items: [1, 2, 3] }, null, 2),
      "application/json",
    );

    expect(true).toBe(true);
  });

  it("showcases parameters", async () => {
    await allure.epic("Allure Demo");
    await allure.feature("Parameters");
    await allure.severity("normal");

    await allure.parameter("browser", "chromium");
    await allure.parameter("viewport", "1920x1080");
    await allure.parameter("env", "staging", { mode: "hidden" });

    expect(true).toBe(true);
  });

  it("showcases links and issue tracking", async () => {
    await allure.epic("Allure Demo");
    await allure.feature("Links");
    await allure.severity("normal");

    await allure.issue("DEMO-123", "https://jira.example.com/browse/DEMO-123");
    await allure.tms("TMS-456", "https://tms.example.com/case/TMS-456");
    await allure.link("https://example.com/docs/api", "API Documentation");

    expect(true).toBe(true);
  });
});
`;

const MOCHA_DEMO = `const allure = require("allure-js-commons");
const { expect } = require("chai");

describe("Allure Demo — Mocha", () => {
  it("showcases labels and metadata", async () => {
    await allure.epic("Allure Demo");
    await allure.feature("Labels & Metadata");
    await allure.story("All label types");
    await allure.severity("critical");
    await allure.owner("QA Team");
    await allure.tag("demo");
    await allure.tag("smoke");

    await allure.description(
      "This test demonstrates how to attach rich metadata to your Mocha test results.",
    );

    await allure.link("https://docs.qameta.io/allure-report/", "Allure Docs", "docs");

    expect(true).to.be.true;
  });

  it("showcases steps", async () => {
    await allure.epic("Allure Demo");
    await allure.feature("Steps");
    await allure.severity("normal");

    await allure.step("Step 1: Prepare test data", async () => {
      const data = { user: "demo", role: "admin" };

      await allure.step("Generate user payload", async () => {
        expect(data.user).to.equal("demo");
      });
    });

    await allure.step("Step 2: Execute action", async () => {
      expect(2 + 2).to.equal(4);
    });

    await allure.step("Step 3: Verify result", async () => {
      expect(true).to.be.true;
    });
  });

  it("showcases attachments", async () => {
    await allure.epic("Allure Demo");
    await allure.feature("Attachments");
    await allure.severity("minor");

    await allure.attachment("plain-text.txt", "Hello from Allure!", "text/plain");

    await allure.attachment(
      "test-data.json",
      JSON.stringify({ status: "ok", items: [1, 2, 3] }, null, 2),
      "application/json",
    );

    expect(true).to.be.true;
  });

  it("showcases parameters", async () => {
    await allure.epic("Allure Demo");
    await allure.feature("Parameters");
    await allure.severity("normal");

    await allure.parameter("browser", "chromium");
    await allure.parameter("viewport", "1920x1080");

    expect(true).to.be.true;
  });

  it("showcases links and issue tracking", async () => {
    await allure.epic("Allure Demo");
    await allure.feature("Links");
    await allure.severity("normal");

    await allure.issue("DEMO-123", "https://jira.example.com/browse/DEMO-123");
    await allure.tms("TMS-456", "https://tms.example.com/case/TMS-456");
    await allure.link("https://example.com/docs/api", "API Documentation");

    expect(true).to.be.true;
  });
});
`;

const CYPRESS_DEMO = `describe("Allure Demo — Cypress", () => {
  it("showcases labels and metadata", () => {
    cy.allure().epic("Allure Demo");
    cy.allure().feature("Labels & Metadata");
    cy.allure().story("All label types");
    cy.allure().severity("critical");
    cy.allure().owner("QA Team");
    cy.allure().tag("demo");
    cy.allure().tag("smoke");

    cy.allure().description(
      "This test demonstrates how to attach rich metadata to your Cypress test results.",
    );

    cy.allure().link("https://docs.qameta.io/allure-report/", "Allure Docs", "docs");

    cy.visit("https://example.com");
    cy.title().should("contain", "Example");
  });

  it("showcases steps", () => {
    cy.allure().epic("Allure Demo");
    cy.allure().feature("Steps");
    cy.allure().severity("normal");

    cy.allure().step("Navigate to page", () => {
      cy.visit("https://example.com");
    });

    cy.allure().step("Verify page content", () => {
      cy.get("h1").should("be.visible");
    });

    cy.allure().step("Check page title", () => {
      cy.title().should("contain", "Example");
    });
  });

  it("showcases attachments", () => {
    cy.allure().epic("Allure Demo");
    cy.allure().feature("Attachments");
    cy.allure().severity("minor");

    cy.visit("https://example.com");

    cy.allure().attachment(
      "test-data.json",
      JSON.stringify({ status: "ok", items: [1, 2, 3] }, null, 2),
      "application/json",
    );

    cy.title().should("contain", "Example");
  });

  it("showcases parameters", () => {
    cy.allure().epic("Allure Demo");
    cy.allure().feature("Parameters");
    cy.allure().severity("normal");

    cy.allure().parameter("browser", Cypress.browser.name);
    cy.allure().parameter("viewport", \`\${Cypress.config("viewportWidth")}x\${Cypress.config("viewportHeight")}\`);

    cy.visit("https://example.com");
    cy.title().should("contain", "Example");
  });

  it("showcases links and issue tracking", () => {
    cy.allure().epic("Allure Demo");
    cy.allure().feature("Links");
    cy.allure().severity("normal");

    cy.allure().issue("DEMO-123", "https://jira.example.com/browse/DEMO-123");
    cy.allure().tms("TMS-456", "https://tms.example.com/case/TMS-456");
    cy.allure().link("https://example.com/docs/api", "API Documentation");

    cy.visit("https://example.com");
    cy.title().should("contain", "Example");
  });
});
`;

const CUCUMBERJS_DEMO = `Feature: Allure Demo — Cucumber.js

  Demonstrates all Allure reporting features with Cucumber.

  @demo @smoke @severity:critical
  Scenario: Showcases labels and tags
    Given a test with Allure labels
    When I add metadata to the scenario
    Then the report should display all labels

  @demo @severity:normal
  Scenario: Showcases steps
    Given I start a multi-step process
    When I execute step 1
    And I execute step 2
    Then the final verification passes

  @demo @severity:minor
  Scenario Outline: Showcases parameters
    Given a parameterized test with "<browser>"
    When viewport is "<viewport>"
    Then the test runs successfully

    Examples:
      | browser  | viewport  |
      | chromium | 1920x1080 |
      | firefox  | 1280x720  |
      | webkit   | 390x844   |
`;

const JASMINE_DEMO = `const allure = require("allure-js-commons");

describe("Allure Demo — Jasmine", () => {
  it("showcases labels and metadata", async () => {
    await allure.epic("Allure Demo");
    await allure.feature("Labels & Metadata");
    await allure.story("All label types");
    await allure.severity("critical");
    await allure.owner("QA Team");
    await allure.tag("demo");
    await allure.tag("smoke");

    await allure.description(
      "This test demonstrates how to attach rich metadata to your Jasmine test results.",
    );

    await allure.link("https://docs.qameta.io/allure-report/", "Allure Docs", "docs");

    expect(true).toBe(true);
  });

  it("showcases steps", async () => {
    await allure.epic("Allure Demo");
    await allure.feature("Steps");
    await allure.severity("normal");

    await allure.step("Step 1: Prepare test data", async () => {
      expect({ user: "demo" }.user).toBe("demo");
    });

    await allure.step("Step 2: Execute action", async () => {
      expect(2 + 2).toBe(4);
    });

    await allure.step("Step 3: Verify result", async () => {
      expect(true).toBe(true);
    });
  });

  it("showcases attachments", async () => {
    await allure.epic("Allure Demo");
    await allure.feature("Attachments");
    await allure.severity("minor");

    await allure.attachment("plain-text.txt", "Hello from Allure!", "text/plain");

    await allure.attachment(
      "test-data.json",
      JSON.stringify({ status: "ok", items: [1, 2, 3] }, null, 2),
      "application/json",
    );

    expect(true).toBe(true);
  });

  it("showcases parameters", async () => {
    await allure.epic("Allure Demo");
    await allure.feature("Parameters");
    await allure.severity("normal");

    await allure.parameter("browser", "chromium");
    await allure.parameter("viewport", "1920x1080");

    expect(true).toBe(true);
  });

  it("showcases links and issue tracking", async () => {
    await allure.epic("Allure Demo");
    await allure.feature("Links");
    await allure.severity("normal");

    await allure.issue("DEMO-123", "https://jira.example.com/browse/DEMO-123");
    await allure.tms("TMS-456", "https://tms.example.com/case/TMS-456");
    await allure.link("https://example.com/docs/api", "API Documentation");

    expect(true).toBe(true);
  });
});
`;

const CODECEPTJS_DEMO = `Feature("Allure Demo — CodeceptJS");

Scenario("showcases labels and metadata", async ({ I }) => {
  I.addAllureLabel("epic", "Allure Demo");
  I.addAllureLabel("feature", "Labels & Metadata");
  I.addAllureLabel("story", "All label types");
  I.addAllureLabel("severity", "critical");
  I.addAllureLabel("owner", "QA Team");
  I.addAllureLabel("tag", "demo");
  I.addAllureLabel("tag", "smoke");

  I.amOnPage("https://example.com");
  I.see("Example Domain");
});

Scenario("showcases steps", async ({ I }) => {
  I.addAllureLabel("epic", "Allure Demo");
  I.addAllureLabel("feature", "Steps");
  I.addAllureLabel("severity", "normal");

  I.say("Step 1: Navigate to page");
  I.amOnPage("https://example.com");

  I.say("Step 2: Verify content");
  I.see("Example Domain");

  I.say("Step 3: Check heading");
  I.seeElement("h1");
});

Scenario("showcases attachments", async ({ I }) => {
  I.addAllureLabel("epic", "Allure Demo");
  I.addAllureLabel("feature", "Attachments");
  I.addAllureLabel("severity", "minor");

  I.amOnPage("https://example.com");
  I.saveScreenshot("demo-screenshot.png");

  I.see("Example Domain");
});

Scenario("showcases parameters and links", async ({ I }) => {
  I.addAllureLabel("epic", "Allure Demo");
  I.addAllureLabel("feature", "Parameters & Links");
  I.addAllureLabel("severity", "normal");

  I.amOnPage("https://example.com");
  I.see("Example Domain");
});
`;

export const DEMO_TEST_TEMPLATES: Record<string, DemoTestTemplate> = {
  vitest: {
    frameworkId: "vitest",
    filename: "allure-demo.test.ts",
    content: VITEST_DEMO,
  },
  playwright: {
    frameworkId: "playwright",
    filename: "allure-demo.spec.ts",
    content: PLAYWRIGHT_DEMO,
  },
  jest: {
    frameworkId: "jest",
    filename: "allure-demo.test.ts",
    content: JEST_DEMO,
  },
  mocha: {
    frameworkId: "mocha",
    filename: "allure-demo.test.js",
    content: MOCHA_DEMO,
  },
  cypress: {
    frameworkId: "cypress",
    filename: "allure-demo.cy.js",
    content: CYPRESS_DEMO,
  },
  cucumberjs: {
    frameworkId: "cucumberjs",
    filename: "allure-demo.feature",
    content: CUCUMBERJS_DEMO,
  },
  jasmine: {
    frameworkId: "jasmine",
    filename: "allure-demo.spec.js",
    content: JASMINE_DEMO,
  },
  codeceptjs: {
    frameworkId: "codeceptjs",
    filename: "allure-demo_test.js",
    content: CODECEPTJS_DEMO,
  },
};

export const getDemoTestTemplate = (frameworkId: string): DemoTestTemplate | undefined => {
  return DEMO_TEST_TEMPLATES[frameworkId];
};

export const getDemoTestPath = (frameworkId: string): string => {
  switch (frameworkId) {
    case "cypress":
      return "cypress/e2e";
    case "jasmine":
      return "spec";
    case "cucumberjs":
      return "features";
    case "playwright":
      return "tests";
    default:
      return "test";
  }
};
