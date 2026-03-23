import type { FullConfig } from "@allurereport/core";
import type { EnvironmentIdentity } from "@allurereport/core-api";
import { validateEnvironmentId, validateEnvironmentName } from "@allurereport/core-api";
import { Option, UsageError } from "clipanion";

const environmentOptionDescription =
  "Force specific environment ID to all tests in the run. Given environment has higher priority than the one defined in the config file (default: empty string)";

const environmentNameOptionDescription =
  "Force specific environment display name to all tests in the run. Has lower priority than --environment and higher priority than the config value (default: empty string)";

type CommandEnvironmentOptions = {
  environment?: string;
  environmentName?: string;
};

const environmentIdentityById = (
  config: Pick<FullConfig, "environments">,
  environmentId: string,
): EnvironmentIdentity | undefined => {
  if (!Object.prototype.hasOwnProperty.call(config.environments ?? {}, environmentId)) {
    return undefined;
  }

  const descriptor = config.environments?.[environmentId];

  if (!descriptor) {
    return undefined;
  }

  return {
    id: environmentId,
    name: descriptor.name ?? environmentId,
  };
};

export const environmentOption = () =>
  Option.String("--environment,--env", {
    description: environmentOptionDescription,
  });

export const environmentNameOption = () =>
  Option.String("--environment-name", {
    description: environmentNameOptionDescription,
  });

const resolveEnvironmentByName = (
  config: Pick<FullConfig, "environments">,
  environmentName: string,
  source: string,
): EnvironmentIdentity => {
  const identity = environmentIdentityByName(config, environmentName);

  if (!identity) {
    throw new UsageError(
      `${source}: environment name ${JSON.stringify(environmentName)} does not match any configured environment`,
    );
  }

  return identity;
};

const environmentIdentityByName = (
  config: Pick<FullConfig, "environments">,
  environmentName: string,
): EnvironmentIdentity | undefined => {
  for (const [environmentId, descriptor] of Object.entries(config.environments ?? {})) {
    if ((descriptor.name ?? environmentId) === environmentName) {
      return {
        id: environmentId,
        name: descriptor.name ?? environmentId,
      };
    }
  }
};

const resolveConfigEnvironment = (config: Pick<FullConfig, "environment" | "environments">) => {
  if (config.environment === undefined) {
    return undefined;
  }

  return (
    environmentIdentityById(config, config.environment) ??
    environmentIdentityByName(config, config.environment) ?? {
      id: config.environment,
      name: config.environment,
    }
  );
};

export const resolveCommandEnvironment = (
  config: Pick<FullConfig, "environment" | "environments">,
  options: CommandEnvironmentOptions & { source?: string },
): EnvironmentIdentity | undefined => {
  const source = options.source ?? "cli";
  const { environment, environmentName } = normalizeCommandEnvironmentOptions(options);
  const identityFromId =
    environment !== undefined
      ? (environmentIdentityById(config, environment) ?? { id: environment, name: environment })
      : undefined;
  const identityFromName =
    environmentName !== undefined ? resolveEnvironmentByName(config, environmentName, source) : undefined;
  const configIdentity = resolveConfigEnvironment(config);

  if (identityFromId && identityFromName && identityFromId.id !== identityFromName.id) {
    throw new UsageError(
      `${source}: environment id ${JSON.stringify(identityFromId.id)} and environment name ${JSON.stringify(identityFromName.name)} resolve to different environments`,
    );
  }

  const identity = identityFromId ?? identityFromName ?? configIdentity;

  return identity;
};

export const normalizeCommandEnvironmentOptions = (options: CommandEnvironmentOptions) => {
  let environment: string | undefined;
  let environmentName: string | undefined;

  if (typeof options.environment === "string") {
    const validation = validateEnvironmentId(options.environment);

    if (!validation.valid) {
      throw new UsageError(`Invalid --environment value ${JSON.stringify(options.environment)}: ${validation.reason}`);
    }

    environment = validation.normalized;
  }

  if (typeof options.environmentName === "string") {
    const validation = validateEnvironmentName(options.environmentName);

    if (!validation.valid) {
      throw new UsageError(
        `Invalid --environment-name value ${JSON.stringify(options.environmentName)}: ${validation.reason}`,
      );
    }

    environmentName = validation.normalized;
  }

  return {
    environment,
    environmentName,
  };
};
