import * as console from "node:console";

import { readConfig, readRawConfig, type FullConfig, type PluginInstance } from "@allurereport/core";
import type {
  AgentHumanReportMode,
  AgentHumanReportStatus,
  AgentHumanReportStatusProvider,
} from "@allurereport/plugin-agent";
import type { AllureStore, Plugin, PluginContext, PluginSummary, RealtimeSubscriber } from "@allurereport/plugin-api";
import AwesomePlugin, { type AwesomePluginOptions } from "@allurereport/plugin-awesome";

export const AGENT_HUMAN_REPORT_THRESHOLD = 1000;

type AgentHumanReportConfigOverride = {
  name?: FullConfig["name"];
  open?: FullConfig["open"];
  port?: FullConfig["port"];
  hideLabels?: FullConfig["hideLabels"];
  historyLimit?: FullConfig["historyLimit"];
};

type AgentHumanReportBuildParams = {
  mode: AgentHumanReportMode;
  cwd: string;
  configPath?: string;
  outputDir: string;
  configOverride?: AgentHumanReportConfigOverride;
};

type AgentHumanReportPluginParams = {
  mode: AgentHumanReportMode;
  status: AgentHumanReportStatus;
  threshold: number;
  pluginId: string;
  plugin: Plugin;
  reportPath: string;
};

const createInitialHumanReportStatus = (mode: AgentHumanReportMode): AgentHumanReportStatus => ({
  schema_version: "allure-agent-human-report/v1",
  mode,
  status: mode === "off" ? "disabled" : "pending",
  result_count: null,
  threshold: AGENT_HUMAN_REPORT_THRESHOLD,
  path: null,
  reports: [],
  reason: mode === "off" ? "disabled by --report off" : null,
  error: null,
});

const isAgentPluginId = (id: string) => id === "agent" || id === "plugin-agent";

const isAwesomeDescriptor = (id: string, descriptor: { import?: string }) =>
  id === "awesome" ||
  id === "@allurereport/plugin-awesome" ||
  descriptor.import === "awesome" ||
  descriptor.import === "@allurereport/plugin-awesome";

const configuredAwesomeOptions = async (cwd: string, configPath?: string): Promise<AwesomePluginOptions> => {
  const rawConfig = await readRawConfig(cwd, configPath);
  const plugins = rawConfig.plugins ?? {};

  for (const id of Object.keys(plugins)) {
    const descriptor = plugins[id];

    if (isAwesomeDescriptor(id, descriptor)) {
      return (descriptor.options ?? {}) as AwesomePluginOptions;
    }
  }

  return {};
};

const recordGeneratedReport = (status: AgentHumanReportStatus, pluginId: string, path: string) => {
  const alreadyRecorded = status.reports.some(
    (report: { plugin_id: string; path: string }) => report.plugin_id === pluginId && report.path === path,
  );

  if (!alreadyRecorded) {
    status.reports.push({
      plugin_id: pluginId,
      path,
    });
  }

  status.status = status.error ? "failed" : "generated";
  status.path ??= path;
  status.reason = null;
  status.generated_at = new Date().toISOString();
};

const recordFailedReport = (status: AgentHumanReportStatus, pluginId: string, error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);

  status.status = "failed";
  status.error ??= message;
  status.errors = [...(status.errors ?? []), { plugin_id: pluginId, message }];
};

class AgentHumanReportPlugin implements Plugin {
  #realtime?: RealtimeSubscriber;
  #generated = false;

  constructor(private readonly params: AgentHumanReportPluginParams) {}

  start = async (_context: PluginContext, _store: AllureStore, realtime: RealtimeSubscriber) => {
    this.#realtime = realtime;
  };

  done = async (context: PluginContext, store: AllureStore) => {
    const { mode, status, threshold, pluginId, plugin, reportPath } = this.params;
    const resultCount = (await store.allTestResults()).length;

    status.result_count = resultCount;

    if (status.status === "skipped") {
      return;
    }

    if (mode === "auto" && resultCount > threshold) {
      status.status = "skipped";
      status.reason = `result count ${resultCount} exceeds threshold ${threshold}`;
      return;
    }

    try {
      await plugin.start?.(context, store, this.#realtime!);
      await plugin.done?.(context, store);
      this.#generated = true;
      recordGeneratedReport(status, pluginId, reportPath);
    } catch (error) {
      recordFailedReport(status, pluginId, error);
      console.error(`agent human report ${pluginId} error`, error);
    }
  };

  info = async (context: PluginContext, store: AllureStore): Promise<PluginSummary | undefined> => {
    if (!this.#generated) {
      return undefined;
    }

    return this.params.plugin.info?.(context, store);
  };
}

const wrapHumanReportPlugin = (params: {
  mode: AgentHumanReportMode;
  status: AgentHumanReportStatus;
  plugin: PluginInstance;
  reportPath?: string;
}): PluginInstance => {
  const { mode, status, plugin, reportPath = `${plugin.id}/` } = params;

  return {
    ...plugin,
    plugin: new AgentHumanReportPlugin({
      mode,
      status,
      threshold: AGENT_HUMAN_REPORT_THRESHOLD,
      pluginId: plugin.id,
      plugin: plugin.plugin,
      reportPath,
    }),
  };
};

export const createAgentHumanReportConfig = async ({
  mode,
  cwd,
  configPath,
  outputDir,
  configOverride,
}: AgentHumanReportBuildParams): Promise<{
  status: AgentHumanReportStatus;
  statusProvider: AgentHumanReportStatusProvider;
  plugins: PluginInstance[];
}> => {
  const status = createInitialHumanReportStatus(mode);
  const statusProvider = () => status;

  if (mode === "off") {
    return {
      status,
      statusProvider,
      plugins: [],
    };
  }

  if (mode === "auto" || mode === "awesome") {
    const awesomeOptions = {
      ...(await configuredAwesomeOptions(cwd, configPath)),
      singleFile: true,
    } satisfies AwesomePluginOptions;
    const awesomePlugin: PluginInstance = {
      id: "awesome",
      enabled: true,
      options: awesomeOptions,
      plugin: new AwesomePlugin(awesomeOptions),
    };

    return {
      status,
      statusProvider,
      plugins: [
        wrapHumanReportPlugin({
          mode,
          status,
          plugin: awesomePlugin,
          reportPath: "awesome/index.html",
        }),
      ],
    };
  }

  const reportConfig = await readConfig(cwd, configPath, {
    ...configOverride,
    output: outputDir,
  });
  const plugins =
    reportConfig.plugins
      ?.filter((plugin) => !isAgentPluginId(plugin.id))
      .map((plugin) =>
        wrapHumanReportPlugin({
          mode,
          status,
          plugin,
        }),
      ) ?? [];

  if (!plugins.length) {
    status.status = "disabled";
    status.reason = "no configured non-agent report plugins";
  }

  return {
    status,
    statusProvider,
    plugins,
  };
};
