import type { FullConfig } from "@allurereport/core";
import AwesomePlugin, { type AwesomePluginOptions } from "@allurereport/plugin-awesome";
import {
  type GeneratorParams,
  type ReportBootstrap,
  bootstrapReport as baseBootstrapReport,
} from "../../utils/index.js";

export const bootstrapReport = async (
  params: Omit<GeneratorParams, "reportDir" | "resultsDir" | "reportConfig"> & {
    reportConfig: Omit<FullConfig, "output" | "reportFiles" | "plugins">;
  },
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
