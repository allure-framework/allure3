import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";

import type { TestResult } from "@allurereport/core-api";
import type { Plugin, QualityGateRule } from "@allurereport/plugin-api";
import { BufferResultFile } from "@allurereport/reader-api";
import { generateSummary } from "@allurereport/summary";
import type { Mock, Mocked } from "vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resolveConfig } from "../src/index.js";
import { AllureReport } from "../src/report.js";
import { AllureServiceClientMock } from "./utils.js";

// JWT payload: { "iss": "allure-service", "url": "https://service.allurereport.org", "projectId": "test-project-id" }
const validAccessToken =
  "header.eyJpc3MiOiJhbGx1cmUtc2VydmljZSIsInVybCI6Imh0dHBzOi8vc2VydmljZS5hbGx1cmVyZXBvcnQub3JnIiwicHJvamVjdElkIjoidGVzdC1wcm9qZWN0LWlkIn0.signature";

vi.mock("@allurereport/service", async (importOriginal) => {
  const utils = await import("./utils.js");

  return {
    ...(await importOriginal()),
    AllureServiceClient: utils.AllureServiceClientMock,
  };
});
vi.mock("@allurereport/summary", () => ({
  generateSummary: vi.fn(),
}));
vi.mock("@allurereport/ci", () => ({
  detect: vi.fn().mockReturnValue({
    jobRunBranch: "main",
  }),
}));

const createPlugin = (id: string, enabled: boolean = true, options: Record<string, any> = {}) => {
  const plugin: Mocked<Required<Plugin>> = {
    start: vi.fn<Required<Plugin>["start"]>(),
    update: vi.fn<Required<Plugin>["update"]>(),
    done: vi.fn<Required<Plugin>["done"]>(),
    info: vi.fn<Required<Plugin>["info"]>(),
  };

  return {
    id,
    enabled,
    options,
    plugin,
  };
};

let previousCwd: string;

beforeEach(() => {
  previousCwd = process.cwd();
  vi.clearAllMocks();
});

afterEach(() => {
  process.chdir(previousCwd);
});

describe("report", () => {
  it("should not fail with the empty report", async () => {
    const config = await resolveConfig({
      name: "Allure Report",
    });

    const allureReport = new AllureReport(config);

    await allureReport.start();
    await allureReport.done();
  });

  it("should not allow call done() before start()", async () => {
    const config = await resolveConfig({
      name: "Allure Report",
    });

    const allureReport = new AllureReport(config);
    await expect(() => allureReport.done()).rejects.toThrowError(
      "report is not initialised. Call the start() method first",
    );
  });

  it("should not allow to readDirectory() before start()", async () => {
    const config = await resolveConfig({
      name: "Allure Report",
    });

    const allureReport = new AllureReport(config);
    await expect(() => allureReport.readDirectory("any")).rejects.toThrowError(
      "report is not initialised. Call the start() method first",
    );
  });

  it("should not allow to readFile() before start()", async () => {
    const config = await resolveConfig({
      name: "Allure Report",
    });

    const allureReport = new AllureReport(config);
    await expect(() => allureReport.readFile("any")).rejects.toThrowError(
      "report is not initialised. Call the start() method first",
    );
  });

  it("should not allow to readResult() before start()", async () => {
    const config = await resolveConfig({
      name: "Allure Report",
    });

    const allureReport = new AllureReport(config);
    const resultFile = new BufferResultFile(Buffer.from("some content", "utf-8"), "some-name.txt");
    await expect(() => allureReport.readResult(resultFile)).rejects.toThrowError(
      "report is not initialised. Call the start() method first",
    );
  });

  it("should call plugins in specified order on start()", async () => {
    const p1 = createPlugin("p1");
    const p2 = createPlugin("p2");
    const p3 = createPlugin("p3");
    const config = await resolveConfig({
      name: "Allure Report",
    });
    config.plugins?.push(p1, p2, p3);

    const allureReport = new AllureReport(config);
    await allureReport.start();

    expect(p1.plugin.start).toBeCalledTimes(1);
    expect(p2.plugin.start).toBeCalledTimes(1);
    expect(p3.plugin.start).toBeCalledTimes(1);

    expect(p1.plugin.start.mock.invocationCallOrder[0]).toBeLessThan(p2.plugin.start.mock.invocationCallOrder[0]);
    expect(p2.plugin.start.mock.invocationCallOrder[0]).toBeLessThan(p3.plugin.start.mock.invocationCallOrder[0]);
  });

  it("should not call disabled plugins on start()", async () => {
    const p1 = createPlugin("p1");
    const p2 = createPlugin("p2", false);
    const p3 = createPlugin("p3");
    const config = await resolveConfig({
      name: "Allure Report",
    });
    config.plugins?.push(p1, p2, p3);

    const allureReport = new AllureReport(config);
    await allureReport.start();

    expect(p1.plugin.start).toBeCalledTimes(1);
    expect(p2.plugin.start).toBeCalledTimes(0);
    expect(p3.plugin.start).toBeCalledTimes(1);

    expect(p1.plugin.start.mock.invocationCallOrder[0]).toBeLessThan(p3.plugin.start.mock.invocationCallOrder[0]);
  });

  it("should call plugins in specified order on done()", async () => {
    const p1 = createPlugin("p1");
    const p2 = createPlugin("p2");
    const p3 = createPlugin("p3");
    const config = await resolveConfig({
      name: "Allure Report",
    });
    config.plugins?.push(p1, p2, p3);

    const allureReport = new AllureReport(config);
    await allureReport.start();
    await allureReport.done();

    expect(p1.plugin.done).toBeCalledTimes(1);
    expect(p2.plugin.done).toBeCalledTimes(1);
    expect(p3.plugin.done).toBeCalledTimes(1);

    expect(p1.plugin.done.mock.invocationCallOrder[0]).toBeLessThan(p2.plugin.done.mock.invocationCallOrder[0]);
    expect(p2.plugin.done.mock.invocationCallOrder[0]).toBeLessThan(p3.plugin.done.mock.invocationCallOrder[0]);
  });

  it("should not call disabled plugins on done()", async () => {
    const p1 = createPlugin("p1");
    const p2 = createPlugin("p2", false);
    const p3 = createPlugin("p3");
    const config = await resolveConfig({
      name: "Allure Report",
    });
    config.plugins?.push(p1, p2, p3);

    const allureReport = new AllureReport(config);
    await allureReport.start();
    await allureReport.done();

    expect(p1.plugin.done).toBeCalledTimes(1);
    expect(p2.plugin.done).toBeCalledTimes(0);
    expect(p3.plugin.done).toBeCalledTimes(1);

    expect(p1.plugin.done.mock.invocationCallOrder[0]).toBeLessThan(p3.plugin.done.mock.invocationCallOrder[0]);
  });

  it("should publish reports which have publish option and marks report as complited", async () => {
    const fixtures = {
      reportUrl: "https://allurereport.com/reports",
      summaries: [
        {
          foo: "bar",
        },
        {
          bar: "baz",
        },
        {
          baz: "qux",
        },
      ],
    };
    const p1 = createPlugin("p1", true, { publish: true });
    const p2 = createPlugin("p2", true, { publish: false });
    const p3 = createPlugin("p3", true, { publish: true });
    const config = await resolveConfig({
      name: "Allure Report",
    });

    (p1.plugin.info as Mock).mockResolvedValue(fixtures.summaries[0]);
    (p2.plugin.info as Mock).mockResolvedValue(fixtures.summaries[1]);
    (p3.plugin.info as Mock).mockResolvedValue(undefined);
    (AllureServiceClientMock.prototype.createReport as Mock).mockResolvedValue({
      url: fixtures.reportUrl,
    });

    config.plugins = [p1, p2, p3];

    const allureReport = new AllureReport({
      ...config,
      allureService: {
        url: "https://service.allurereport.org",
        accessToken: validAccessToken,
      },
    });

    await allureReport.start();
    await allureReport.done();

    expect(AllureServiceClientMock.prototype.completeReport).toBeCalledTimes(1);
    expect(AllureServiceClientMock.prototype.completeReport).toBeCalledWith({
      reportUuid: allureReport.reportUuid,
      historyPoint: expect.any(Object),
    });
    expect(generateSummary).toBeCalledTimes(1);
    expect(generateSummary).toBeCalledWith(expect.any(String), [
      {
        ...fixtures.summaries[0],
        href: `${p1.id}/`,
        remoteHref: `${fixtures.reportUrl}/${p1.id}/`,
        pullRequestHref: undefined,
        jobHref: undefined,
      },
      {
        ...fixtures.summaries[1],
        href: `${p2.id}/`,
        pullRequestHref: undefined,
        jobHref: undefined,
      },
    ]);
  });

  it("should resolve configured environment ids to display names for quality gate results", async () => {
    const mockRule: QualityGateRule<number> = {
      rule: "mockRule",
      message: ({ actual, expected }) => `Mock rule failed with ${actual} vs ${expected}`,
      validate: vi.fn().mockResolvedValue({
        success: false,
        actual: 5,
        expected: 3,
      }),
    };
    const config = await resolveConfig({
      name: "Allure Report",
      environment: "qa",
      environments: {
        qa: {
          name: "QA",
          matcher: () => true,
        },
      },
      qualityGate: {
        rules: [{ mockRule: 3 }],
        use: [mockRule],
      },
    });

    const allureReport = new AllureReport(config);
    const { results } = await allureReport.validate({
      trs: [
        {
          id: "1",
          name: "Test 1",
          status: "failed",
        } as TestResult,
      ],
      knownIssues: [],
      environment: config.environment,
    });

    expect(results).toEqual([
      expect.objectContaining({
        environment: "QA",
      }),
    ]);
    expect(mockRule.validate).toHaveBeenCalledWith(
      expect.objectContaining({
        environment: "QA",
      }),
    );
  });

  it("should attach global attachments matched by glob patterns from working directory", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "allure3-global-attachments-"));
    const first = join(cwd, "global.log");
    const second = join(cwd, "artifacts", "nested.txt");

    await writeFile(first, "first");
    await mkdir(join(cwd, "artifacts"), { recursive: true });
    await writeFile(second, "second");

    process.chdir(cwd);

    const config = await resolveConfig({
      name: "Allure Report",
      globalAttachments: ["*.log", "artifacts/**/*.txt"],
    });

    const allureReport = new AllureReport(config);

    await allureReport.start();

    const attachments = await allureReport.store.allGlobalAttachments();
    const names = attachments.map((a) => a.name).sort();

    expect(names).toEqual(["global.log", "nested.txt"]);
  });

  it("should deduplicate global attachments matched by multiple glob patterns", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "allure3-global-attachments-dedup-"));
    const file = join(cwd, "duplicated.log");

    await writeFile(file, "dup");

    process.chdir(cwd);

    const config = await resolveConfig({
      name: "Allure Report",
      globalAttachments: ["*.log", "**/*.log", "duplicated.log"],
    });

    const allureReport = new AllureReport(config);

    await allureReport.start();

    const attachments = await allureReport.store.allGlobalAttachments();

    expect(attachments).toHaveLength(1);
    expect(attachments[0]?.name).toBe("duplicated.log");
  });

  it("should ignore absolute global attachments outside working directory", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "allure3-global-attachments-cwd-"));
    const outsideDir = await mkdtemp(join(tmpdir(), "allure3-global-attachments-outside-"));
    const insideFile = join(cwd, "inside.log");
    const outsideFile = join(outsideDir, "outside.log");

    await writeFile(insideFile, "inside");
    await writeFile(outsideFile, "outside");

    process.chdir(cwd);

    const config = await resolveConfig({
      name: "Allure Report",
      globalAttachments: [outsideFile, "*.log"],
    });

    expect(isAbsolute(outsideFile)).toBe(true);

    const allureReport = new AllureReport(config);

    await allureReport.start();

    const attachments = await allureReport.store.allGlobalAttachments();
    const names = attachments.map((a) => a.name).sort();

    expect(names).toEqual(["inside.log"]);
    expect(names).not.toContain("outside.log");
  });

  it("should ignore possibly sensitive files outside working directory", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "allure3-global-attachments-sensitive-cwd-"));
    const outsideRoot = await mkdtemp(join(tmpdir(), "allure3-global-attachments-sensitive-outside-"));
    const insideFile = join(cwd, "artifacts", "safe.txt");
    const sensitiveFile = join(outsideRoot, "secrets", "token.txt");

    await mkdir(join(cwd, "artifacts"), { recursive: true });
    await mkdir(join(outsideRoot, "secrets"), { recursive: true });
    await writeFile(insideFile, "safe");
    await writeFile(sensitiveFile, "super-secret");

    process.chdir(cwd);

    const config = await resolveConfig({
      name: "Allure Report",
      globalAttachments: ["**/*.txt", sensitiveFile],
    });

    const allureReport = new AllureReport(config);

    await allureReport.start();

    const attachments = await allureReport.store.allGlobalAttachments();
    const names = attachments.map((a) => a.name).sort();

    expect(names).toEqual(["safe.txt"]);
    expect(names).not.toContain("token.txt");
  });
});
