import { normalizeCategoriesConfig } from "@allurereport/core-api";
import type { AllureStore, PluginContext } from "@allurereport/plugin-api";
import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { generateTestResults } from "../src/generators.js";
import { ClassicPlugin } from "../src/plugin.js";

vi.mock("../src/generators.js", () => ({
  generateAllCharts: vi.fn(),
  generateEnvironmentJson: vi.fn(),
  generatePieChart: vi.fn(),
  generateStaticFiles: vi.fn(),
  generateStatistic: vi.fn(),
  generateTestResults: vi.fn().mockResolvedValue([]),
  generateTree: vi.fn(),
  generateTreeByCategories: vi.fn(),
}));

vi.mock("@allurereport/plugin-api/internal/report", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  generateAttachmentsFiles: vi.fn(),
  generateHistoryDataPoints: vi.fn(),
}));

beforeEach(async () => {
  vi.clearAllMocks();
  await epic("coverage");
  await feature("categories");
  await story("plugin");
  await label("coverage", "categories");
});

const createStore = (metadata: Record<string, unknown> = {}) =>
  ({
    metadataByKey: vi.fn(async (key: string) => metadata[key]),
    testsStatistic: vi.fn().mockResolvedValue({ total: 0 }),
    allAttachments: vi.fn().mockResolvedValue([]),
    allTestResults: vi.fn().mockResolvedValue([]),
  }) as unknown as AllureStore;

const createContext = (overrides: Partial<PluginContext> = {}) =>
  ({
    reportFiles: { addFile: vi.fn() },
    reportName: "Report",
    reportUuid: "uuid",
    allureVersion: "1.0.0",
    ...overrides,
  }) as unknown as PluginContext;

describe("ClassicPlugin", () => {
  it("should match test results against allurerc categories merged with categories.json", async () => {
    const plugin = new ClassicPlugin();
    const context = createContext({
      categories: normalizeCategoriesConfig([{ name: "Config category", matchers: { statuses: ["failed"] } }]),
    });
    const store = createStore({ allure2_categories: [{ name: "Legacy category", matchedStatuses: ["broken"] }] });

    await plugin.start(context);
    await plugin.done(context, store);

    const [, , options] = vi.mocked(generateTestResults).mock.calls[0];

    expect(options?.categories?.map(({ name }) => name)).toEqual([
      "Config category",
      "Legacy category",
      "Product defects",
      "Test defects",
    ]);
  });

  it("should apply the filter option to statistic and test results", async () => {
    const filter = () => true;
    const plugin = new ClassicPlugin({ filter });
    const context = createContext();
    const store = createStore();

    await plugin.start(context);
    await plugin.done(context, store);

    expect(store.testsStatistic).toHaveBeenCalledWith(filter);
    expect(vi.mocked(generateTestResults).mock.calls[0][2]).toEqual(expect.objectContaining({ filter }));
  });
});
