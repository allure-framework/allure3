import {
  DEFAULT_ENVIRONMENT,
  DEFAULT_ENVIRONMENT_IDENTITY,
  formatNormalizedEnvironmentCollision,
  matchEnvironmentIdentity,
  validateEnvironmentId,
  validateEnvironmentName,
  type EnvironmentDescriptor,
  type EnvironmentIdentity,
  type EnvironmentsConfig,
  type TestResult,
} from "@allurereport/core-api";

const normalizeEnvironmentValue = (
  value: unknown,
  sourcePath: string,
  label: "id" | "name",
  options?: {
    strictId?: boolean;
  },
): { ok: true; normalized: string } | { ok: false; error: string } => {
  const validationResult =
    label === "id" && options?.strictId ? validateEnvironmentId(value) : validateEnvironmentName(value);

  if (!validationResult.valid) {
    return {
      ok: false,
      error: `${sourcePath}: ${validationResult.reason}`,
    };
  }

  return {
    ok: true,
    normalized: validationResult.normalized,
  };
};

const createIdentity = (id: string, descriptor?: Pick<EnvironmentDescriptor, "name">): EnvironmentIdentity => ({
  id,
  name: descriptor?.name ?? id,
});
const compatibilityIdentityFromName = (normalizedName: string): EnvironmentIdentity =>
  normalizedName === DEFAULT_ENVIRONMENT ? defaultEnvironmentIdentity() : { id: normalizedName, name: normalizedName };

export type NormalizedEnvironmentsResult = {
  normalized: EnvironmentsConfig;
  identities: EnvironmentIdentity[];
  errors: string[];
};

export const normalizeEnvironmentDescriptorMap = (
  input: EnvironmentsConfig,
  sourcePath: string,
): NormalizedEnvironmentsResult => {
  const normalized: EnvironmentsConfig = {};
  const identities: EnvironmentIdentity[] = [];
  const originalIdsByNormalized = new Map<string, string[]>();
  const originalIdsByNormalizedName = new Map<string, string[]>();
  const errors: string[] = [];

  Object.entries(input).forEach(([environmentId, environmentDescriptor]) => {
    const idResult = normalizeEnvironmentValue(environmentId, `${sourcePath}[${JSON.stringify(environmentId)}]`, "id", {
      strictId: true,
    });

    if (!idResult.ok) {
      errors.push(idResult.error);
      return;
    }

    const nameResult = normalizeEnvironmentValue(
      environmentDescriptor.name ?? environmentId,
      `${sourcePath}[${JSON.stringify(environmentId)}]`,
      "name",
    );

    if (!nameResult.ok) {
      errors.push(nameResult.error);
      return;
    }

    const normalizedName = nameResult.normalized;
    const normalizedId = idResult.normalized;
    const originalIds = originalIdsByNormalized.get(normalizedId) ?? [];
    const originalIdsForName = originalIdsByNormalizedName.get(normalizedName) ?? [];

    originalIds.push(environmentId);
    originalIdsForName.push(environmentId);
    originalIdsByNormalized.set(normalizedId, originalIds);
    originalIdsByNormalizedName.set(normalizedName, originalIdsForName);

    if (!(normalizedId in normalized)) {
      normalized[normalizedId] = {
        ...environmentDescriptor,
        name: normalizedName,
      };
      identities.push({
        id: normalizedId,
        name: normalizedName,
      });
    }
  });

  originalIdsByNormalized.forEach((originalIds, normalizedId) => {
    if (originalIds.length <= 1) {
      return;
    }

    errors.push(formatNormalizedEnvironmentCollision(sourcePath, normalizedId, originalIds));
  });

  originalIdsByNormalizedName.forEach((originalIds, normalizedName) => {
    if (originalIds.length <= 1) {
      return;
    }

    errors.push(
      `${sourcePath}: normalized environment name ${JSON.stringify(normalizedName)} is produced by ids [${originalIds.map((id) => JSON.stringify(id)).join(",")}]`,
    );
  });

  return {
    normalized,
    identities,
    errors,
  };
};

export const environmentIdentityById = (
  environmentsConfig: EnvironmentsConfig,
  environmentId: string,
): EnvironmentIdentity | undefined => {
  if (!Object.prototype.hasOwnProperty.call(environmentsConfig, environmentId)) {
    return undefined;
  }

  const descriptor = environmentsConfig[environmentId];

  if (!descriptor) {
    return undefined;
  }

  return createIdentity(environmentId, descriptor);
};

export const environmentIdentityByName = (
  environmentsConfig: EnvironmentsConfig,
  environmentName: string,
): EnvironmentIdentity | undefined => {
  for (const [id, descriptor] of Object.entries(environmentsConfig)) {
    if ((descriptor.name ?? id) === environmentName) {
      return createIdentity(id, descriptor);
    }
  }

  return undefined;
};

const normalizeStoredEnvironmentName = (environmentName: unknown): string | undefined => {
  const result = validateEnvironmentName(environmentName);

  return result.valid ? result.normalized : undefined;
};

const normalizeRuntimeEnvironmentKey = (
  environmentKey: unknown,
): { ok: true; normalized: string } | { ok: false; reason: string } => {
  const idResult = validateEnvironmentId(environmentKey);

  if (idResult.valid) {
    return {
      ok: true,
      normalized: idResult.normalized,
    };
  }

  const nameResult = validateEnvironmentName(environmentKey);

  if (nameResult.valid) {
    return {
      ok: true,
      normalized: nameResult.normalized,
    };
  }

  return {
    ok: false,
    reason: nameResult.reason,
  };
};

export const assertValidRuntimeEnvironmentKey = (
  environmentKey: unknown,
  source: string = "environment key",
): string => {
  const result = normalizeRuntimeEnvironmentKey(environmentKey);

  if (!result.ok) {
    throw new Error(`Invalid ${source} ${JSON.stringify(environmentKey)}: ${result.reason}`);
  }

  return result.normalized;
};

export const resolveStoredEnvironmentIdentity = (
  params: {
    environment?: unknown;
    environmentName?: unknown;
    labels?: TestResult["labels"];
  },
  environmentsConfig: EnvironmentsConfig,
  options?: {
    forcedEnvironment?: EnvironmentIdentity;
    fallbackToMatch?: boolean;
  },
): EnvironmentIdentity | undefined => {
  if (params.environment !== undefined) {
    const idResult = validateEnvironmentId(params.environment);

    if (idResult.valid) {
      const configuredIdentity = environmentIdentityById(environmentsConfig, idResult.normalized);

      if (configuredIdentity) {
        return configuredIdentity;
      }

      return {
        id: idResult.normalized,
        name: normalizeStoredEnvironmentName(params.environmentName ?? params.environment) ?? idResult.normalized,
      };
    }

    const normalizedName = normalizeStoredEnvironmentName(params.environment);

    if (normalizedName) {
      return (
        environmentIdentityByName(environmentsConfig, normalizedName) ?? compatibilityIdentityFromName(normalizedName)
      );
    }
  }

  const storedEnvironmentName = params.environmentName ?? params.environment;

  if (storedEnvironmentName !== undefined) {
    const normalizedName = normalizeStoredEnvironmentName(storedEnvironmentName);

    if (normalizedName) {
      return (
        environmentIdentityByName(environmentsConfig, normalizedName) ?? compatibilityIdentityFromName(normalizedName)
      );
    }
  }

  if (options?.fallbackToMatch === false) {
    return undefined;
  }

  return options?.forcedEnvironment ?? matchEnvironmentIdentity(environmentsConfig, { labels: params.labels ?? [] });
};

export const resolveEnvironmentIdentity = (
  params: {
    environment?: string;
    environmentName?: string;
  },
  environmentsConfig: EnvironmentsConfig,
  sourcePath: string,
): { identity?: EnvironmentIdentity; errors: string[] } => {
  const errors: string[] = [];
  let identityFromEnvironment: EnvironmentIdentity | undefined;
  let identityFromName: EnvironmentIdentity | undefined;
  if (params.environment !== undefined) {
    const environmentResult = normalizeEnvironmentValue(params.environment, sourcePath, "name");

    if (!environmentResult.ok) {
      errors.push(`${sourcePath}: environment ${environmentResult.error.split(": ").slice(1).join(": ")}`);
    } else {
      const normalizedEnvironment = environmentResult.normalized;

      identityFromEnvironment = environmentIdentityById(environmentsConfig, normalizedEnvironment) ??
        environmentIdentityByName(environmentsConfig, normalizedEnvironment) ?? {
          id: normalizedEnvironment,
          name: normalizedEnvironment,
        };
    }
  }

  if (params.environmentName !== undefined) {
    const environmentNameResult = normalizeEnvironmentValue(params.environmentName, sourcePath, "name");

    if (!environmentNameResult.ok) {
      errors.push(`${sourcePath}: environmentName ${environmentNameResult.error.split(": ").slice(1).join(": ")}`);
    } else {
      identityFromName = environmentIdentityByName(environmentsConfig, environmentNameResult.normalized) ?? {
        id: environmentNameResult.normalized,
        name: environmentNameResult.normalized,
      };
    }
  }

  if (identityFromEnvironment && identityFromName && identityFromEnvironment.id !== identityFromName.id) {
    errors.push(
      `${sourcePath}: environment ${JSON.stringify(identityFromEnvironment.id)} and environmentName ${JSON.stringify(identityFromName.name)} resolve to different environments`,
    );
  }

  return {
    identity: identityFromEnvironment ?? identityFromName,
    errors,
  };
};

export const defaultEnvironmentIdentity = (): EnvironmentIdentity => ({
  ...DEFAULT_ENVIRONMENT_IDENTITY,
});
