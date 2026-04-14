export interface FrameworkDescriptor {
  id: string;
  displayName: string;
  /**
   * Primary package name used for display and adapter mapping.
   * Detection may include additional package names via `detectPackageNames`.
   */
  packageName: string;
  /**
   * Additional package names that indicate this framework is used in the project.
   * Useful when a framework is typically installed as a set of packages (e.g. WebdriverIO).
   */
  detectPackageNames?: string[];
  adapterPackage: string;
  setupHint: string;
  configFilePatterns: string[];
  testFilePatterns: string[];
}

export interface PluginOptionDescriptor {
  name: string;
  description: string;
  type: "text" | "boolean" | "select";
  defaultValue?: string | boolean;
  choices?: { title: string; value: string }[];
  envVar?: string;
}

export interface ReportPluginDescriptor {
  id: string;
  packageName: string;
  description: string;
  isDefault: boolean;
  options?: PluginOptionDescriptor[];
}

export const FRAMEWORK_REGISTRY: FrameworkDescriptor[] = [
  {
    id: "vitest",
    displayName: "Vitest",
    packageName: "vitest",
    adapterPackage: "allure-vitest",
    setupHint: 'Add "allure-vitest/reporter" to reporters and "allure-vitest/setup" to setupFiles in vitest.config.ts',
    configFilePatterns: ["vitest.config.ts", "vitest.config.js", "vitest.config.mts", "vitest.config.mjs"],
    testFilePatterns: ["**/*.test.ts", "**/*.test.js", "**/*.spec.ts", "**/*.spec.js"],
  },
  {
    id: "playwright",
    displayName: "Playwright",
    packageName: "@playwright/test",
    adapterPackage: "allure-playwright",
    setupHint: 'Add ["allure-playwright"] to reporter in playwright.config.ts',
    configFilePatterns: [
      "playwright.config.ts",
      "playwright.config.js",
      "playwright.config.mts",
      "playwright.config.mjs",
    ],
    testFilePatterns: ["**/*.spec.ts", "**/*.spec.js", "**/e2e/**/*.ts"],
  },
  {
    id: "jest",
    displayName: "Jest",
    packageName: "jest",
    adapterPackage: "allure-jest",
    setupHint: 'Set testEnvironment to "allure-jest/environment" in jest.config.js',
    configFilePatterns: ["jest.config.ts", "jest.config.js", "jest.config.mjs", "jest.config.cjs", "jest.config.json"],
    testFilePatterns: ["**/*.test.ts", "**/*.test.js", "**/*.test.tsx", "**/*.test.jsx"],
  },
  {
    id: "mocha",
    displayName: "Mocha",
    packageName: "mocha",
    adapterPackage: "allure-mocha",
    setupHint: 'Add "--reporter allure-mocha/reporter" to your mocha command or .mocharc file',
    configFilePatterns: [
      ".mocharc.yml",
      ".mocharc.yaml",
      ".mocharc.json",
      ".mocharc.js",
      ".mocharc.cjs",
      ".mocharc.mjs",
    ],
    testFilePatterns: ["test/**/*.js", "test/**/*.ts"],
  },
  {
    id: "cypress",
    displayName: "Cypress",
    packageName: "cypress",
    adapterPackage: "allure-cypress",
    setupHint: "Import allure-cypress in cypress/support/e2e.ts and add the plugin to cypress.config.ts",
    configFilePatterns: ["cypress.config.ts", "cypress.config.js", "cypress.config.mts", "cypress.config.mjs"],
    testFilePatterns: ["cypress/e2e/**/*.cy.ts", "cypress/e2e/**/*.cy.js"],
  },
  {
    id: "cucumberjs",
    displayName: "Cucumber.js",
    packageName: "@cucumber/cucumber",
    adapterPackage: "allure-cucumberjs",
    setupHint: 'Add "--format allure-cucumberjs/reporter" to your cucumber-js command',
    configFilePatterns: ["cucumber.js", "cucumber.cjs", "cucumber.mjs", "cucumber.yml", "cucumber.yaml"],
    testFilePatterns: ["**/*.feature"],
  },
  {
    id: "jasmine",
    displayName: "Jasmine",
    packageName: "jasmine",
    adapterPackage: "allure-jasmine",
    setupHint: "Add AllureJasmineReporter to jasmine helpers in your spec/support/jasmine.json",
    configFilePatterns: ["spec/support/jasmine.json"],
    testFilePatterns: ["spec/**/*.spec.js", "spec/**/*.spec.ts"],
  },
  {
    id: "codeceptjs",
    displayName: "CodeceptJS",
    packageName: "codeceptjs",
    adapterPackage: "allure-codeceptjs",
    setupHint: 'Add "allure-codeceptjs" to plugins in codecept.conf.js',
    configFilePatterns: ["codecept.conf.ts", "codecept.conf.js", "codecept.conf.mjs", "codecept.conf.cjs"],
    testFilePatterns: ["**/*_test.js", "**/*_test.ts"],
  },
  {
    id: "newman",
    displayName: "Newman (Postman)",
    packageName: "newman",
    adapterPackage: "newman-reporter-allure",
    setupHint: 'Run newman with "-r allure" flag, e.g. newman run collection.json -r allure',
    configFilePatterns: [],
    testFilePatterns: ["**/*.postman_collection.json"],
  },
  {
    id: "wdio",
    displayName: "WebdriverIO (WDIO)",
    packageName: "webdriverio",
    detectPackageNames: [
      "webdriverio",
      "@wdio/cli",
      "@wdio/local-runner",
      "@wdio/runner",
      "@wdio/cucumber-framework",
      "@wdio/mocha-framework",
      "@wdio/jasmine-framework",
    ],
    adapterPackage: "@wdio/allure-reporter",
    setupHint:
      'Install "@wdio/allure-reporter" and add it to reporters in wdio.conf.ts (works for WDIO+Cucumber too), e.g. reporters: [["allure", { outputDir: "allure-results" }]]',
    configFilePatterns: ["wdio.conf.ts", "wdio.conf.js", "wdio.conf.mts", "wdio.conf.mjs", "wdio.conf.cjs"],
    testFilePatterns: [],
  },
];

export const REPORT_PLUGIN_REGISTRY: ReportPluginDescriptor[] = [
  {
    id: "awesome",
    packageName: "@allurereport/plugin-awesome",
    description: "Interactive HTML report",
    isDefault: true,
    options: [
      { name: "reportName", description: "Report title", type: "text", defaultValue: "Allure Report" },
      {
        name: "theme",
        description: "Report theme",
        type: "select",
        defaultValue: "auto",
        choices: [
          { title: "Auto (follows system)", value: "auto" },
          { title: "Light", value: "light" },
          { title: "Dark", value: "dark" },
        ],
      },
      { name: "singleFile", description: "Emit single HTML file", type: "boolean", defaultValue: false },
      { name: "reportLanguage", description: "Report language (e.g. en, ru, zh)", type: "text" },
      { name: "logo", description: "Logo URL or path", type: "text" },
    ],
  },
  {
    id: "classic",
    packageName: "@allurereport/plugin-classic",
    description: "Classic Allure HTML report",
    isDefault: false,
    options: [
      { name: "reportName", description: "Report title", type: "text", defaultValue: "Allure Report" },
      {
        name: "theme",
        description: "Report theme",
        type: "select",
        defaultValue: "auto",
        choices: [
          { title: "Auto (follows system)", value: "auto" },
          { title: "Light", value: "light" },
          { title: "Dark", value: "dark" },
        ],
      },
      { name: "singleFile", description: "Emit single HTML file", type: "boolean", defaultValue: false },
      { name: "reportLanguage", description: "Report language (e.g. en, ru, zh)", type: "text" },
      { name: "logo", description: "Logo URL or path", type: "text" },
    ],
  },
  {
    id: "dashboard",
    packageName: "@allurereport/plugin-dashboard",
    description: "Summary dashboard",
    isDefault: false,
    options: [
      { name: "reportName", description: "Report title", type: "text", defaultValue: "Allure Report" },
      {
        name: "theme",
        description: "Report theme",
        type: "select",
        defaultValue: "light",
        choices: [
          { title: "Light", value: "light" },
          { title: "Dark", value: "dark" },
        ],
      },
      { name: "singleFile", description: "Emit single HTML file", type: "boolean", defaultValue: false },
      { name: "reportLanguage", description: "Report language (e.g. en, ru, zh)", type: "text" },
      { name: "logo", description: "Logo URL or path", type: "text" },
    ],
  },
  {
    id: "csv",
    packageName: "@allurereport/plugin-csv",
    description: "CSV export",
    isDefault: false,
    options: [
      { name: "fileName", description: "Output file name", type: "text", defaultValue: "allure-results.csv" },
      { name: "separator", description: "CSV column separator", type: "text", defaultValue: "," },
      { name: "disableHeaders", description: "Disable header row", type: "boolean", defaultValue: false },
    ],
  },
  {
    id: "log",
    packageName: "@allurereport/plugin-log",
    description: "Console log output",
    isDefault: false,
    options: [
      {
        name: "groupBy",
        description: "Group results by",
        type: "select",
        defaultValue: "none",
        choices: [
          { title: "None", value: "none" },
          { title: "Suites", value: "suites" },
          { title: "Features", value: "features" },
          { title: "Packages", value: "packages" },
        ],
      },
      { name: "allSteps", description: "Include all steps in output", type: "boolean", defaultValue: false },
      { name: "withTrace", description: "Include stack traces", type: "boolean", defaultValue: false },
    ],
  },
  {
    id: "slack",
    packageName: "@allurereport/plugin-slack",
    description: "Slack notifications",
    isDefault: false,
    options: [
      { name: "channel", description: "Slack channel name", type: "text", envVar: "ALLURE_SLACK_CHANNEL" },
      { name: "token", description: "Slack API token", type: "text", envVar: "ALLURE_SLACK_TOKEN" },
    ],
  },
  {
    id: "jira",
    packageName: "@allurereport/plugin-jira",
    description: "Jira integration",
    isDefault: false,
    options: [
      { name: "webhook", description: "Allure Forge App webhook URL", type: "text", envVar: "ALLURE_JIRA_WEBHOOK" },
      { name: "token", description: "Atlassian API token", type: "text", envVar: "ALLURE_JIRA_TOKEN" },
      { name: "issue", description: "Jira issue key to link report to", type: "text" },
      { name: "uploadReport", description: "Upload report to Jira", type: "boolean", defaultValue: false },
      { name: "uploadResults", description: "Upload test results to Jira", type: "boolean", defaultValue: false },
    ],
  },
  {
    id: "testops",
    packageName: "@allurereport/plugin-testops",
    description: "Allure TestOps integration",
    isDefault: false,
    options: [
      { name: "endpoint", description: "TestOps API endpoint URL", type: "text" },
      { name: "accessToken", description: "API access token", type: "text" },
      { name: "projectId", description: "Project ID in TestOps", type: "text" },
      { name: "launchName", description: "Launch name", type: "text" },
    ],
  },
  {
    id: "allure2",
    packageName: "@allurereport/plugin-allure2",
    description: "Allure 2 compatible report format",
    isDefault: false,
    options: [
      { name: "reportName", description: "Report title", type: "text", defaultValue: "Allure Report" },
      { name: "singleFile", description: "Emit single HTML file", type: "boolean", defaultValue: false },
      { name: "reportLanguage", description: "Report language (e.g. en, ru, zh)", type: "text" },
    ],
  },
  {
    id: "testplan",
    packageName: "@allurereport/plugin-testplan",
    description: "Generate testplan.json for selective test execution",
    isDefault: false,
    options: [{ name: "fileName", description: "Output file name", type: "text", defaultValue: "testplan.json" }],
  },
  {
    id: "progress",
    packageName: "@allurereport/plugin-progress",
    description: "Show report generation progress in console",
    isDefault: false,
  },
];

export const findFrameworkByPackageName = (packageName: string): FrameworkDescriptor | undefined => {
  return FRAMEWORK_REGISTRY.find((framework) => {
    if (framework.packageName === packageName) {
      return true;
    }

    return framework.detectPackageNames?.includes(packageName) ?? false;
  });
};

export const findReportPluginById = (pluginId: string): ReportPluginDescriptor | undefined => {
  return REPORT_PLUGIN_REGISTRY.find((plugin) => plugin.id === pluginId);
};

export const getDefaultReportPlugins = (): ReportPluginDescriptor[] => {
  return REPORT_PLUGIN_REGISTRY.filter((plugin) => plugin.isDefault);
};
