import {
  DEFAULT_ENVIRONMENT,
  DEFAULT_ENVIRONMENT_IDENTITY,
  formatNormalizedEnvironmentCollision,
  validateEnvironmentId,
  validateEnvironmentName,
  type EnvironmentDescriptor,
  type EnvironmentIdentity,
  type EnvironmentsConfig,
  type TestResult,
} from "@allurereport/core-api";

const createIdentity = (id: string, descriptor?: Pick<EnvironmentDescriptor, "name">): EnvironmentIdentity => ({
  id,
  name: descriptor?.name ?? id,
});
const compatibilityIdentityFromName = (normalizedName: string): EnvironmentIdentity =>
  normalizedName === DEFAULT_ENVIRONMENT ? DEFAULT_ENVIRONMENT_IDENTITY : { id: normalizedName, name: normalizedName };

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
    const idResult = validateEnvironmentId(environmentId);

    if (!idResult.valid) {
      errors.push(`${sourcePath}[${JSON.stringify(environmentId)}]: ${idResult.reason}`);
      return;
    }

    const nameResult = validateEnvironmentName(environmentDescriptor.name ?? environmentId);

    if (!nameResult.valid) {
      errors.push(`${sourcePath}[${JSON.stringify(environmentId)}]: ${nameResult.reason}`);
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
    if ((descriptor?.name ?? id) === environmentName) {
      return createIdentity(id, descriptor);
    }
  }

  return undefined;
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
      const byId = environmentIdentityById(environmentsConfig, idResult.normalized);
      if (byId) {
        return byId;
      }
      const byName = environmentIdentityByName(environmentsConfig, idResult.normalized);
      if (byName) {
        return byName;
      }
      const nameResult = validateEnvironmentName(params.environmentName ?? params.environment);
      return {
        id: idResult.normalized,
        name: nameResult.valid ? nameResult.normalized : idResult.normalized,
      };
    }

    const nameResult = validateEnvironmentName(params.environment);
    if (nameResult.valid) {
      return (
        environmentIdentityByName(environmentsConfig, nameResult.normalized) ??
        compatibilityIdentityFromName(nameResult.normalized)
      );
    }
  }

  if (params.environmentName !== undefined) {
    const nameResult = validateEnvironmentName(params.environmentName);
    if (nameResult.valid) {
      return (
        environmentIdentityByName(environmentsConfig, nameResult.normalized) ??
        compatibilityIdentityFromName(nameResult.normalized)
      );
    }
  }

  if (options?.fallbackToMatch === false) {
    return undefined;
  }

  if (options?.forcedEnvironment) {
    return options.forcedEnvironment;
  }

  const match = Object.entries(environmentsConfig).find(([, { matcher }]) => matcher({ labels: params.labels ?? [] }));

  if (!match) {
    return DEFAULT_ENVIRONMENT_IDENTITY;
  }

  const [id, descriptor] = match;

  return { id, name: descriptor.name ?? id };
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
    const environmentResult = validateEnvironmentId(params.environment);

    if (!environmentResult.valid) {
      errors.push(`${sourcePath}: environment ${environmentResult.reason}`);
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
    const environmentNameResult = validateEnvironmentName(params.environmentName);

    if (!environmentNameResult.valid) {
      errors.push(`${sourcePath}: environmentName ${environmentNameResult.reason}`);
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
