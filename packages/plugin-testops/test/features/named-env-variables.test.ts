import type { CiDescriptor, TestResult } from "@allurereport/core-api";
import type { AllureStore, PluginContext, PluginState } from "@allurereport/plugin-api";
import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { TestOpsPlugin } from "../../src/plugin.js";
import { handleBeforeEach, mockAllureStore, mockRequests } from "./helpers.js";

vi.mock("@allurereport/ci", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@allurereport/ci")>();

  return {
    ...actual,
    detect: vi.fn(() => ({ type: "github" }) as CiDescriptor),
  };
});

// upload retries back off with real delays; skip them
vi.mock("node:timers/promises", () => ({ setTimeout: () => Promise.resolve() }));

beforeEach(async () => {
  await epic("coverage");
  await feature("testops-integration");
  await story("named-env-variables");
  await label("coverage", "testops-integration");
  handleBeforeEach();
});

const context = {
  allureVersion: "3.0.0",
  reportUuid: "test-uuid",
  reportName: "Test Report",
  output: "/tmp/out",
  categories: [],
  publish: true,
  id: "test",
  reportFiles: [] as any,
  state: {} as PluginState,
} as PluginContext;

const realTimeContext = { ...context, realTime: true } as PluginContext;

const tr = (id: string, environment?: string) =>
  ({
    id,
    name: `test ${id}`,
    fullName: `suite test ${id}`,
    status: "passed",
    stage: "finished",
    start: 1,
    stop: 2,
    steps: [],
    ...(environment ? { environment } : {}),
  }) as unknown as TestResult;

const createPlugin = (autocloseLaunch = true) =>
  new TestOpsPlugin({
    accessToken: "test",
    endpoint: "http://example.com",
    projectId: "12345",
    launchName: "Test Launch",
    launchTags: [],
    autocloseLaunch,
    filter: () => true,
  });

type EnvItem = { key: string; value: string };

const setup = (params: {
  trs: TestResult[];
  reportVariables?: Record<string, string>;
  envVariables?: Record<string, Record<string, string>>;
}) => {
  const requests = mockRequests();
  const store = mockAllureStore();
  const reportVariables = params.reportVariables ?? {};
  let sessionId = 0;

  store.allTestResults.mockResolvedValue(params.trs);
  store.allEnvironmentIdentities.mockResolvedValue([
    { id: "chrome", name: "Chrome" },
    { id: "firefox", name: "Firefox" },
  ]);
  store.allVariables.mockResolvedValue(reportVariables);
  store.envVariablesByEnvironmentId.mockImplementation(async (envId: string) => ({
    ...reportVariables,
    ...(params.envVariables?.[envId] ?? {}),
  }));
  requests.createNamedEnvsRequest.mockImplementation(async (_url, data) => ({
    data: data.items.map(({ externalId }: { externalId: string }, idx: number) => ({ id: idx + 1, externalId })),
  }));
  requests.createSessionRequest.mockImplementation(async () => {
    sessionId += 1;

    return { data: { id: sessionId } } as any;
  });

  const sessionEnvironments = () =>
    requests.createSessionRequest.mock.calls.map(([, data]) => data.environment as EnvItem[]);
  const sessionIdOf = (trId: string) =>
    requests.uploadTestResultsRequest.mock.calls
      .map(([, data]) => data)
      .find((body) => body.results.some(({ uuid }: { uuid: string }) => uuid === trId))?.testSessionId;

  return { ...requests, store: store as unknown as AllureStore, storeMock: store, sessionEnvironments, sessionIdOf };
};

const valueOf = (environment: EnvItem[], key: string) => environment.filter((item) => item.key === key);

describe("named environment variables", () => {
  test("should create one session per cycle when there are no variables", async () => {
    const { store, createSessionRequest, closeLaunchRequest, sessionIdOf } = setup({
      trs: [tr("1", "chrome"), tr("2", "firefox")],
    });
    const plugin = createPlugin();

    await plugin.start(context, store);

    expect(createSessionRequest).toHaveBeenCalledTimes(1);
    expect(sessionIdOf("1")).toBe(1);
    expect(sessionIdOf("2")).toBe(1);

    await plugin.done(context, store);

    expect(closeLaunchRequest).toHaveBeenCalledTimes(1);
  });

  test("should send report variables with the base session", async () => {
    const { store, createSessionRequest, sessionEnvironments } = setup({
      trs: [tr("1", "chrome")],
      reportVariables: { Stand: "staging" },
    });

    await createPlugin().start(context, store);

    expect(createSessionRequest).toHaveBeenCalledTimes(1);
    expect(valueOf(sessionEnvironments()[0], "Stand")).toEqual([{ key: "Stand", value: "staging" }]);
  });

  test("should create own session for every environment with own variables", async () => {
    const { store, createSessionRequest, sessionEnvironments, sessionIdOf } = setup({
      trs: [tr("1", "chrome"), tr("2", "firefox")],
      reportVariables: { Stand: "staging" },
      envVariables: { chrome: { Browser: "chrome" }, firefox: { Browser: "firefox" } },
    });

    await createPlugin().start(context, store);

    expect(createSessionRequest).toHaveBeenCalledTimes(3);

    const [base, chrome, firefox] = sessionEnvironments();

    expect(valueOf(base, "Browser")).toEqual([]);
    expect(valueOf(chrome, "Browser")).toEqual([{ key: "Browser", value: "chrome" }]);
    expect(valueOf(chrome, "Stand")).toEqual([{ key: "Stand", value: "staging" }]);
    expect(valueOf(firefox, "Browser")).toEqual([{ key: "Browser", value: "firefox" }]);
    expect(sessionIdOf("1")).toBe(2);
    expect(sessionIdOf("2")).toBe(3);
  });

  test("should override process env by config ignoring case", async () => {
    vi.stubEnv("BROWSER", "chrome");

    const { store, sessionEnvironments, sessionIdOf } = setup({
      trs: [tr("2", "firefox")],
      envVariables: { firefox: { Browser: "firefox" } },
    });

    await createPlugin().start(context, store);

    const firefox = sessionEnvironments()[sessionIdOf("2") - 1];

    expect(valueOf(firefox, "Browser")).toEqual([{ key: "Browser", value: "firefox" }]);
    expect(valueOf(firefox, "BROWSER")).toEqual([]);
  });

  test("should upload results without environment into the base session", async () => {
    const { store, createSessionRequest, sessionEnvironments, sessionIdOf } = setup({
      trs: [tr("1")],
      reportVariables: { Stand: "staging" },
    });

    await createPlugin().start(context, store);

    expect(createSessionRequest).toHaveBeenCalledTimes(1);
    expect(valueOf(sessionEnvironments()[0], "Stand")).toEqual([{ key: "Stand", value: "staging" }]);
    expect(sessionIdOf("1")).toBe(1);
  });

  test("should keep environment repeating report variables in the base session", async () => {
    const { store, createSessionRequest, sessionIdOf } = setup({
      trs: [tr("1", "chrome")],
      reportVariables: { Stand: "staging" },
      envVariables: { chrome: { Stand: "staging" } },
    });

    await createPlugin().start(context, store);

    expect(createSessionRequest).toHaveBeenCalledTimes(1);
    expect(sessionIdOf("1")).toBe(1);
  });

  test("should upload other environments and keep launch open when one environment session keeps failing", async () => {
    const { store, createSessionRequest, closeLaunchRequest, sessionIdOf } = setup({
      trs: [tr("1", "chrome"), tr("2", "firefox")],
      envVariables: { chrome: { Browser: "chrome" }, firefox: { Browser: "firefox" } },
    });
    const defaultImplementation = createSessionRequest.getMockImplementation()!;

    createSessionRequest.mockImplementation(async (url, data, config) => {
      if (data.environment.some(({ key, value }: EnvItem) => key === "Browser" && value === "chrome")) {
        throw { isAxiosError: true, response: { status: 503, data: {} } };
      }

      return defaultImplementation(url, data, config);
    });

    const plugin = createPlugin();

    await plugin.start(context, store);
    await plugin.done(context, store);

    expect(sessionIdOf("1")).toBeUndefined();
    expect(sessionIdOf("2")).toBeDefined();
    expect(closeLaunchRequest).not.toHaveBeenCalled();
  });

  test("should keep launch open when an environment session fails with a non-retryable error", async () => {
    const { store, createSessionRequest, closeLaunchRequest, sessionIdOf } = setup({
      trs: [tr("1", "chrome"), tr("2", "firefox")],
      envVariables: { chrome: { Browser: "chrome" }, firefox: { Browser: "firefox" } },
    });
    const defaultImplementation = createSessionRequest.getMockImplementation()!;

    createSessionRequest.mockImplementation(async (url, data, config) => {
      if (data.environment.some(({ key, value }: EnvItem) => key === "Browser" && value === "chrome")) {
        throw { isAxiosError: true, response: { status: 400, data: {} } };
      }

      return defaultImplementation(url, data, config);
    });

    const plugin = createPlugin();

    await plugin.start(context, store);
    await plugin.done(context, store);

    expect(sessionIdOf("1")).toBeUndefined();
    expect(sessionIdOf("2")).toBeDefined();
    expect(closeLaunchRequest).not.toHaveBeenCalled();
  });

  test("should retry every suspended environment group at done", async () => {
    const { store, createSessionRequest, sessionIdOf } = setup({
      trs: [tr("1", "chrome"), tr("2", "firefox")],
      envVariables: { chrome: { Browser: "chrome" }, firefox: { Browser: "firefox" } },
    });
    const defaultImplementation = createSessionRequest.getMockImplementation()!;
    let failures = 0;

    // the first environment session fails with a resource error until the queue suspends
    createSessionRequest.mockImplementation(async (url, data, config) => {
      const isChrome = data.environment.some(({ key, value }: EnvItem) => key === "Browser" && value === "chrome");

      if (isChrome && failures < 4) {
        failures += 1;
        throw { isAxiosError: true, response: { status: 423, data: {} } };
      }

      return defaultImplementation(url, data, config);
    });

    // closing the launch polls its progress with real delays; not needed here
    const plugin = createPlugin(false);

    await plugin.start(context, store);

    expect(sessionIdOf("1")).toBeUndefined();
    expect(sessionIdOf("2")).toBeUndefined();

    await plugin.done(context, store);

    expect(sessionIdOf("1")).toBeDefined();
    expect(sessionIdOf("2")).toBeDefined();
  });

  test("should create environment sessions only for environments with new results in real-time update", async () => {
    const { store, storeMock, createSessionRequest, sessionEnvironments } = setup({
      trs: [tr("1", "chrome")],
      envVariables: { chrome: { Browser: "chrome" }, firefox: { Browser: "firefox" } },
    });
    const plugin = createPlugin();

    await plugin.start(realTimeContext, store);

    // the plugin skips already uploaded results through the store filter
    storeMock.allTestResults.mockImplementation(async (options?: { filter?: (tr: TestResult) => boolean }) =>
      [tr("1", "chrome"), tr("2", "firefox")].filter((item) => options?.filter?.(item) ?? true),
    );
    createSessionRequest.mockClear();

    await plugin.update(realTimeContext, store);

    const browsers = sessionEnvironments().flatMap((environment) => valueOf(environment, "Browser"));

    expect(createSessionRequest).toHaveBeenCalledTimes(2);
    expect(browsers).toEqual([{ key: "Browser", value: "firefox" }]);
  });
});
