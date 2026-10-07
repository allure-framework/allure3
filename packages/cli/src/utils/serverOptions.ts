import type { FullConfig } from "@allurereport/core";

/**
 * Picks the options of the built-in static server from the resolved config
 */
export const serverOptionsFromConfig = (config: Pick<FullConfig, "port" | "host">) => ({
  port: config.port ? parseInt(config.port, 10) : undefined,
  host: config.host,
});
