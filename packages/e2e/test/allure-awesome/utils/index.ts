import type { TestError } from "@allurereport/core-api";
import type { ExitCode } from "@allurereport/plugin-api";
import AwesomePlugin, { type AwesomePluginOptions } from "@allurereport/plugin-awesome";
import type { ReportConfig } from "../../types.js";
import {
  type GeneratorParams,
  type ReportBootstrap,
  bootstrapReport as baseBootstrapReport,
} from "../../utils/index.js";

export type BootstrapReportParams = Omit<GeneratorParams, "rootDir" | "reportDir" | "resultsDir" | "reportConfig"> & {
  reportConfig: ReportConfig;
  globals?: {
    exitCode?: ExitCode;
    errors?: TestError[];
    attachments?: Record<string, Buffer>;
  };
};

export const bootstrapReport = async (params: BootstrapReportParams, pluginConfig?: AwesomePluginOptions) => {
  return baseBootstrapReport({
    ...params,
    reportConfig: {
      ...params.reportConfig,
      plugins: [
        {
          id: "awesome",
          enabled: true,
          plugin: new AwesomePlugin(pluginConfig),
          options: {
            ...pluginConfig,
          },
        },
      ],
    },
  });
};

export type { ReportBootstrap };
