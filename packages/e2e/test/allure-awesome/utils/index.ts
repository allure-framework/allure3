import type { FullConfig } from "@allurereport/core";
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
  additionalPlugins?: NonNullable<FullConfig["plugins"]>;
  globals?: {
    exitCode?: ExitCode;
    errors?: TestError[];
    attachments?: Record<string, Buffer>;
    attachmentsByEnv?: Record<string, Record<string, Buffer>>;
  };
};

export const bootstrapReport = async (params: BootstrapReportParams, pluginConfig?: AwesomePluginOptions) => {
  const { additionalPlugins = [], ...generatorParams } = params;

  return baseBootstrapReport({
    ...generatorParams,
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
        ...additionalPlugins,
      ],
    },
  });
};

export type { ReportBootstrap };
