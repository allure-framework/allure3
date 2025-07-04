import AwesomePlugin, { type AwesomePluginOptions } from "@allurereport/plugin-awesome";
import {
  type GeneratorParams,
  type ReportBootstrap,
  bootstrapReport as baseBootstrapReport,
} from "../../utils/index.js";
import type { ReportConfig } from "../../types.js";

export type BootstrapReportParams = Omit<GeneratorParams, "rootDir" | "reportDir" | "resultsDir" | "reportConfig"> & {
  reportConfig: ReportConfig;
};

export const bootstrapReport = async (
  params: BootstrapReportParams,
  pluginConfig?: AwesomePluginOptions,
) => {
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
