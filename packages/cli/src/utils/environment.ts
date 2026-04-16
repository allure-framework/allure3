import { environmentIdentityById, environmentIdentityByName, validateAllowedEnvironmentId } from "@allurereport/core";
import type { EnvironmentIdentity } from "@allurereport/core-api";
import { validateEnvironmentId, validateEnvironmentName, type EnvironmentsConfig } from "@allurereport/core-api";
import { Option, UsageError } from "clipanion";

const environmentOptionDescription =
  "Force specific environment ID to all tests in the run. Given environment has higher priority than the one defined in the config file (default: empty string)";

const environmentNameOptionDescription =
  "Force specific environment display name to all tests in the run. Has lower priority than --environment and higher priority than the config value (default: empty string)";

type CommandEnvironmentOptions = {
  environment?: string;
  environmentName?: string;
};

type EnvironmentConfig = {
  environment?: string;
  environments?: EnvironmentsConfig;
  allowedEnvironments?: string[];
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
  config: Pick<EnvironmentConfig, "environments">,
  environmentName: string,
  source: string,
): EnvironmentIdentity => {
  const identity = environmentIdentityByName(config.environments ?? {}, environmentName);

  if (!identity) {
    throw new UsageError(
      `${source}: environment name ${JSON.stringify(environmentName)} does not match any configured environment`,
    );
  }

  return identity;
};

const resolveConfigEnvironment = (config: Pick<EnvironmentConfig, "environment" | "environments">) => {
  if (config.environment === undefined) {
    return undefined;
  }

  return (
    environmentIdentityById(config.environments ?? {}, config.environment) ??
    environmentIdentityByName(config.environments ?? {}, config.environment) ?? {
      id: config.environment,
      name: config.environment,
    }
  );
};

export const resolveCommandEnvironment = (
  config: Pick<EnvironmentConfig, "environment" | "environments" | "allowedEnvironments">,
  options: CommandEnvironmentOptions & { source?: string },
): EnvironmentIdentity | undefined => {
  const source = options.source ?? "cli";
  const { environment, environmentName } = normalizeCommandEnvironmentOptions(options);
  const identityFromId =
    environment !== undefined
      ? (environmentIdentityById(config.environments ?? {}, environment) ?? { id: environment, name: environment })
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
  const allowedEnvironmentIds = new Set<string>(config.allowedEnvironments ?? []);
  const allowlistError =
    identity?.id !== undefined ? validateAllowedEnvironmentId(identity.id, allowedEnvironmentIds, source) : undefined;

  if (allowlistError) {
    throw new UsageError(allowlistError);
  }

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
