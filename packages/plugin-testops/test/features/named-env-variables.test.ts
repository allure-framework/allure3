import type { CiDescriptor, EnvironmentIdentity, TestResult } from "@allurereport/core-api";
import type { AllureStore, PluginContext, PluginState } from "@allurereport/plugin-api";
import { epic, feature, label, story } from "allure-js-commons";
import { AxiosHeaders } from "axios";
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";

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

afterEach(() => {
  vi.unstubAllEnvs();
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

const createPlugin = (options: { reopenClosedLaunch?: boolean } = {}) =>
  new TestOpsPlugin({
    accessToken: "test",
    endpoint: "http://example.com",
    projectId: "12345",
    launchName: "Test Launch",
    launchTags: [],
    autocloseLaunch: true,
    filter: () => true,
    ...options,
  });

type EnvItem = { key: string; value: string };

/** Returns the HTTP status a request of the session with the given `Browser` env var should fail with. */
type Failure = ((browser: string | undefined) => number | undefined) | undefined;

const httpError = (status: number) => ({ isAxiosError: true, response: { status, data: {} } });

const identities: EnvironmentIdentity[] = [
  { id: "chrome", name: "Chrome" },
  { id: "firefox", name: "Firefox" },
];

const setup = (params: {
  trs: TestResult[];
  reportVariables?: Record<string, unknown>;
  envVariables?: Record<string, Record<string, unknown>>;
}) => {
  const requests = mockRequests();
  const store = mockAllureStore();
  const reportVariables = params.reportVariables ?? {};
  const environments = new Map<number, EnvItem[]>();
  const failures: { session: Failure; upload: Failure } = { session: undefined, upload: undefined };
  const uploaded: { testSessionId: number; uuids: string[] }[] = [];
  let trs = params.trs;

  // the plugin skips already uploaded results through the store filter
  store.allTestResults.mockImplementation(async (options?: { filter?: (tr: TestResult) => boolean }) =>
    trs.filter((item) => options?.filter?.(item) ?? true),
  );
  store.allEnvironmentIdentities.mockResolvedValue(identities);
  store.environmentIdByTrId.mockImplementation(async (trId: string) => trs.find(({ id }) => id === trId)?.environment);
  store.allVariables.mockResolvedValue(reportVariables);
  store.envVariablesByEnvironmentId.mockImplementation(async (envId: string) => ({
    ...reportVariables,
    ...(params.envVariables?.[envId] ?? {}),
  }));
  requests.createNamedEnvsRequest.mockImplementation(async (_url, data) => ({
    status: 200,
    statusText: "OK",
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: data.items.map(({ externalId }: { externalId: string }, idx: number) => ({ id: idx + 1, externalId })),
  }));

  const browserOf = (environment: EnvItem[]) => environment.find(({ key }) => key === "Browser")?.value;

  requests.createSessionRequest.mockImplementation(async (_url, data) => {
    const status = failures.session?.(browserOf(data.environment));

    if (status) {
      throw httpError(status);
    }

    const id = environments.size + 1;

    environments.set(id, data.environment);

    return { data: { id } } as any;
  });
  requests.uploadTestResultsRequest.mockImplementation((_url, data) => {
    const status = failures.upload?.(browserOf(environments.get(data.testSessionId) ?? []));

    if (status) {
      return Promise.reject(httpError(status));
    }

    uploaded.push({ testSessionId: data.testSessionId, uuids: data.results.map(({ uuid }: { uuid: string }) => uuid) });

    return undefined;
  });

  const sessionEnvironments = () => [...environments.values()];
  const sessionIdOf = (trId: string): number | undefined =>
    uploaded.find(({ uuids }) => uuids.includes(trId))?.testSessionId;
  const sessionEnvironmentOf = (trId: string) => environments.get(sessionIdOf(trId) ?? -1);

  return {
    ...requests,
    store: store as unknown as AllureStore,
    storeMock: store,
    failures,
    setTestResults: (next: TestResult[]) => {
      trs = next;
    },
    sessionEnvironments,
    sessionIdOf,
    sessionEnvironmentOf,
  };
};

const valueOf = (environment: EnvItem[] | undefined, key: string) =>
  (environment ?? []).filter((item) => item.key === key);

const bothBrowsers = { chrome: { Browser: "chrome" }, firefox: { Browser: "firefox" } };

/** Fails the first `times` calls for which `matches` is true with the given status. */
const failTimes =
  (status: number, times: number, matches: (browser: string | undefined) => boolean): Failure =>
  (browser) => {
    if (!matches(browser) || times <= 0) {
      return undefined;
    }

    times -= 1;

    return status;
  };

const isChrome = (browser: string | undefined) => browser === "chrome";
const isBase = (browser: string | undefined) => browser === undefined;

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

  test("should upload every environment with own variables into its own session and close the launch", async () => {
    const { store, createSessionRequest, closeLaunchRequest, sessionEnvironmentOf } = setup({
      trs: [tr("1", "chrome"), tr("2", "firefox")],
      reportVariables: { Stand: "staging" },
      envVariables: bothBrowsers,
    });
    const plugin = createPlugin();

    await plugin.start(context, store);

    // no result goes into the base session, so it isn't created
    expect(createSessionRequest).toHaveBeenCalledTimes(2);
    expect(valueOf(sessionEnvironmentOf("1"), "Browser")).toEqual([{ key: "Browser", value: "chrome" }]);
    expect(valueOf(sessionEnvironmentOf("1"), "Stand")).toEqual([{ key: "Stand", value: "staging" }]);
    expect(valueOf(sessionEnvironmentOf("2"), "Browser")).toEqual([{ key: "Browser", value: "firefox" }]);

    await plugin.done(context, store);

    expect(closeLaunchRequest).toHaveBeenCalledTimes(1);
  });

  test("should create the base session for results of environments without own variables", async () => {
    const { store, createSessionRequest, sessionEnvironmentOf } = setup({
      trs: [tr("0"), tr("1", "chrome")],
      envVariables: { chrome: { Browser: "chrome" } },
    });

    await createPlugin().start(context, store);

    expect(createSessionRequest).toHaveBeenCalledTimes(2);
    expect(sessionEnvironmentOf("0")).toBeDefined();
    expect(valueOf(sessionEnvironmentOf("0"), "Browser")).toEqual([]);
    expect(valueOf(sessionEnvironmentOf("1"), "Browser")).toEqual([{ key: "Browser", value: "chrome" }]);
  });

  test("should check the launch once per cycle when only environment sessions are needed", async () => {
    const { store, getLaunchRequest } = setup({
      trs: [tr("1", "chrome"), tr("2", "firefox")],
      envVariables: bothBrowsers,
    });

    await createPlugin().start(context, store);

    expect(getLaunchRequest).toHaveBeenCalledTimes(1);
  });

  test("should override process env by config with the same key and keep other process env", async () => {
    vi.stubEnv("Browser", "ci-browser");
    vi.stubEnv("CI_ONLY_VARIABLE", "kept");

    const { store, sessionEnvironmentOf } = setup({
      trs: [tr("2", "firefox")],
      envVariables: { firefox: { Browser: "firefox" } },
    });

    await createPlugin().start(context, store);

    expect(valueOf(sessionEnvironmentOf("2"), "Browser")).toEqual([{ key: "Browser", value: "firefox" }]);
    expect(valueOf(sessionEnvironmentOf("2"), "CI_ONLY_VARIABLE")).toEqual([
      { key: "CI_ONLY_VARIABLE", value: "kept" },
    ]);
  });

  test("should not send config variables without a value", async () => {
    vi.stubEnv("Stand", "prod");

    const { store, sessionEnvironments } = setup({
      trs: [tr("1")],
      reportVariables: { Stand: undefined, Region: null, Shard: 3, Matrix: { os: "linux" } },
    });

    await createPlugin().start(context, store);

    const [base] = sessionEnvironments();

    expect(valueOf(base, "Stand")).toEqual([{ key: "Stand", value: "prod" }]);
    expect(valueOf(base, "Region")).toEqual([]);
    expect(valueOf(base, "Shard")).toEqual([{ key: "Shard", value: "3" }]);
    expect(valueOf(base, "Matrix")).toEqual([]);
  });

  test("should fall back to the report value for an environment variable without a value", async () => {
    vi.stubEnv("Stand", "prod");

    const { store, sessionEnvironmentOf } = setup({
      trs: [tr("1", "chrome")],
      reportVariables: { Stand: "staging" },
      envVariables: { chrome: { Browser: "chrome", Stand: undefined } },
    });

    await createPlugin().start(context, store);

    expect(valueOf(sessionEnvironmentOf("1"), "Stand")).toEqual([{ key: "Stand", value: "staging" }]);
    expect(valueOf(sessionEnvironmentOf("1"), "Browser")).toEqual([{ key: "Browser", value: "chrome" }]);
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

  test("should use the environment id everywhere for results that keep the environment name", async () => {
    const failed = { ...tr("1", "Chrome"), status: "failed" } as TestResult;
    const { store, storeMock, createNamedEnvsRequest, uploadTestResultsRequest, sessionEnvironmentOf } = setup({
      trs: [failed],
      envVariables: { chrome: { Browser: "chrome" } },
    });
    const categories = [
      {
        id: "product-errors",
        name: "Product errors",
        matchers: [{ statuses: ["failed"] }],
        groupBy: ["environment"],
        groupByMessage: false,
        groupEnvironments: false,
        expand: false,
        hide: false,
        index: 0,
      },
    ];

    await createPlugin().start({ ...context, categories } as unknown as PluginContext, store);

    const [result] = uploadTestResultsRequest.mock.calls[0][1].results;

    expect(storeMock.envVariablesByEnvironmentId).toHaveBeenCalledWith("chrome");
    expect(valueOf(sessionEnvironmentOf("1"), "Browser")).toEqual([{ key: "Browser", value: "chrome" }]);
    expect(createNamedEnvsRequest.mock.calls.flatMap(([, data]) => data.items)).toEqual([
      { externalId: "chrome", name: "Chrome" },
    ]);
    expect(result.namedEnv).toEqual({ id: 1 });
    expect(result.category.grouping).toEqual([expect.objectContaining({ key: "environment", value: "chrome" })]);
  });

  test("should attach named environments to quality gate results on the first upload", async () => {
    const { store, storeMock, uploadQualityGateResultsRequest } = setup({
      trs: [tr("1", "chrome")],
      envVariables: { chrome: { Browser: "chrome" } },
    });

    // core reports quality gate results by environment name
    storeMock.qualityGateResults.mockResolvedValue([
      { rule: "maxFailures", message: "too many failures", success: false, environment: "Chrome" },
    ] as any);

    await createPlugin().start(context, store);

    expect(uploadQualityGateResultsRequest.mock.calls[0][1].items).toEqual([
      { name: "maxFailures", message: "too many failures", namedEnvId: 1 },
    ]);
  });

  test("should upload results into the base session when environment variables can't be resolved", async () => {
    const { store, storeMock, createSessionRequest, sessionIdOf } = setup({
      trs: [tr("1", "chrome")],
      envVariables: { chrome: { Browser: "chrome" } },
    });

    storeMock.envVariablesByEnvironmentId.mockRejectedValue(new Error("Invalid environmentId"));

    await createPlugin().start(context, store);

    expect(createSessionRequest).toHaveBeenCalledTimes(1);
    expect(sessionIdOf("1")).toBe(1);
  });

  test("should upload other environments and keep launch open when an environment session fails", async () => {
    const { store, failures, closeLaunchRequest, sessionIdOf } = setup({
      trs: [tr("1", "chrome"), tr("2", "firefox")],
      envVariables: bothBrowsers,
    });
    const plugin = createPlugin();

    failures.session = (browser) => (isChrome(browser) ? 400 : undefined);

    await plugin.start(context, store);
    await plugin.done(context, store);

    expect(sessionIdOf("1")).toBeUndefined();
    expect(sessionIdOf("2")).toBeDefined();
    expect(closeLaunchRequest).not.toHaveBeenCalled();
  });

  test("should keep launch open when environment results fail with a non-retryable error", async () => {
    const { store, failures, closeLaunchRequest, sessionIdOf } = setup({
      trs: [tr("1", "chrome"), tr("2", "firefox")],
      envVariables: bothBrowsers,
    });
    const plugin = createPlugin();

    failures.upload = (browser) => (isChrome(browser) ? 400 : undefined);

    await plugin.start(context, store);
    await plugin.done(context, store);

    expect(sessionIdOf("1")).toBeUndefined();
    expect(sessionIdOf("2")).toBeDefined();
    expect(closeLaunchRequest).not.toHaveBeenCalled();
  });

  test("should keep launch open when results without own variables fail with a non-retryable error", async () => {
    const { store, failures, closeLaunchRequest, sessionIdOf } = setup({ trs: [tr("1")] });
    const plugin = createPlugin();

    failures.upload = () => 400;

    await plugin.start(context, store);
    await plugin.done(context, store);

    expect(sessionIdOf("1")).toBeUndefined();
    expect(closeLaunchRequest).not.toHaveBeenCalled();
  });

  test("should close launch when a failed environment group is uploaded in a later cycle", async () => {
    const { store, failures, closeLaunchRequest, sessionEnvironmentOf } = setup({
      trs: [tr("1", "chrome")],
      envVariables: bothBrowsers,
    });
    const plugin = createPlugin();

    failures.session = (browser) => (isChrome(browser) ? 400 : undefined);
    await plugin.start(context, store);

    failures.session = undefined;
    await plugin.done(context, store);

    expect(valueOf(sessionEnvironmentOf("1"), "Browser")).toEqual([{ key: "Browser", value: "chrome" }]);
    expect(closeLaunchRequest).toHaveBeenCalledTimes(1);
  });

  test("should close launch when a failed environment group is uploaded at finalization", async () => {
    const { store, failures, closeLaunchRequest, sessionEnvironmentOf } = setup({
      trs: [tr("1", "chrome")],
      envVariables: bothBrowsers,
    });
    const plugin = createPlugin();

    failures.session = (browser) => (isChrome(browser) ? 400 : undefined);
    await plugin.start(context, store);

    // a resource error defers the group in done; the finalization flush then uploads it
    failures.session = failTimes(423, 4, isChrome);
    await plugin.done(context, store);

    expect(valueOf(sessionEnvironmentOf("1"), "Browser")).toEqual([{ key: "Browser", value: "chrome" }]);
    expect(closeLaunchRequest).toHaveBeenCalledTimes(1);
  });

  test("should retry every suspended environment group at done and close the launch", async () => {
    const { store, failures, closeLaunchRequest, sessionIdOf } = setup({
      trs: [tr("1", "chrome"), tr("2", "firefox")],
      envVariables: bothBrowsers,
    });
    const plugin = createPlugin();

    // a resource error suspends the queue, so the firefox group is deferred too
    failures.session = (browser) => (isChrome(browser) ? 423 : undefined);
    await plugin.start(context, store);

    expect(sessionIdOf("1")).toBeUndefined();
    expect(sessionIdOf("2")).toBeUndefined();

    failures.session = undefined;
    await plugin.done(context, store);

    expect(sessionIdOf("1")).toBeDefined();
    expect(sessionIdOf("2")).toBeDefined();
    expect(closeLaunchRequest).toHaveBeenCalledTimes(1);
  });

  test("should upload deferred base results into their base session after an environment session was created", async () => {
    const { store, failures, sessionIdOf, sessionEnvironmentOf } = setup({
      trs: [tr("0"), tr("1", "chrome")],
      envVariables: { chrome: { Browser: "chrome" } },
    });
    const plugin = createPlugin();

    // a service error defers the base group without suspending the queue, so the chrome session is created
    failures.upload = failTimes(503, 16, isBase);
    await plugin.start(context, store);

    expect(sessionIdOf("0")).toBeUndefined();
    expect(sessionIdOf("1")).toBe(2);

    // done can't create a new base session, so the finalization flush runs the deferred base task
    failures.session = (browser) => (isBase(browser) ? 400 : undefined);
    await plugin.done(context, store);

    expect(sessionIdOf("0")).toBe(1);
    expect(valueOf(sessionEnvironmentOf("0"), "Browser")).toEqual([]);
  });

  test("should reuse the environment session when its upload is retried", async () => {
    const { store, failures, sessionEnvironments, sessionIdOf } = setup({
      trs: [tr("1", "chrome")],
      envVariables: { chrome: { Browser: "chrome" } },
    });

    // fails every chunk attempt of the first task run, so the whole task is retried
    failures.upload = failTimes(503, 4, isChrome);

    await createPlugin().start(context, store);

    expect(sessionIdOf("1")).toBeDefined();
    expect(sessionEnvironments().filter((environment) => valueOf(environment, "Browser").length > 0)).toHaveLength(1);
  });

  test("should reuse environment sessions and create new ones only for new environments in real-time updates", async () => {
    const { store, createSessionRequest, sessionEnvironments, setTestResults, sessionEnvironmentOf } = setup({
      trs: [tr("1", "chrome")],
      envVariables: bothBrowsers,
    });
    const plugin = createPlugin();

    await plugin.start(realTimeContext, store);

    setTestResults([tr("1", "chrome"), tr("2", "firefox"), tr("3", "chrome")]);
    createSessionRequest.mockClear();

    await plugin.update(realTimeContext, store);

    const updateSessions = sessionEnvironments().slice(-createSessionRequest.mock.calls.length);

    expect(updateSessions.flatMap((environment) => valueOf(environment, "Browser"))).toEqual([
      { key: "Browser", value: "firefox" },
    ]);
    expect(valueOf(sessionEnvironmentOf("3"), "Browser")).toEqual([{ key: "Browser", value: "chrome" }]);
  });

  test("should reopen a closed launch when only environment sessions are needed", async () => {
    const { store, getLaunchRequest, reopenLaunchRequest, sessionEnvironmentOf } = setup({
      trs: [tr("1", "chrome")],
      envVariables: { chrome: { Browser: "chrome" } },
    });

    getLaunchRequest.mockResolvedValue({ data: { closed: true } } as any);

    await createPlugin({ reopenClosedLaunch: true }).start(context, store);

    expect(reopenLaunchRequest).toHaveBeenCalledTimes(1);
    expect(valueOf(sessionEnvironmentOf("1"), "Browser")).toEqual([{ key: "Browser", value: "chrome" }]);
  });
});
