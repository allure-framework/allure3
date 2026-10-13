import {
  DEFAULT_ENVIRONMENT,
  MAX_ENVIRONMENT_ID_LENGTH,
  DEFAULT_ENVIRONMENT_IDENTITY,
  formatNormalizedEnvironmentCollision,
  validateEnvironmentId,
  validateEnvironmentName,
  type DynamicEnvironmentResolver,
  type DynamicEnvironmentsConfig,
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

export const validateAllowedEnvironmentIds = (
  input: string[] | undefined,
  sourcePath: string,
): {
  ids: string[];
  idsSet: Set<string>;
  errors: string[];
} => {
  const ids: string[] = [];
  const idsSet = new Set<string>();
  const errors: string[] = [];

  for (const [index, environmentId] of (input ?? []).entries()) {
    const validation = validateEnvironmentId(environmentId);

    if (!validation.valid) {
      errors.push(`${sourcePath}[${index}]: ${validation.reason}`);
      continue;
    }

    if (validation.normalized !== environmentId) {
      errors.push(`${sourcePath}[${index}]: id must not contain leading or trailing whitespace`);
      continue;
    }

    if (idsSet.has(environmentId)) {
      errors.push(`${sourcePath}: duplicated environment id ${JSON.stringify(environmentId)}`);
      continue;
    }

    idsSet.add(environmentId);
    ids.push(environmentId);
  }

  return {
    ids,
    idsSet,
    errors,
  };
};
export const validateAllowedEnvironmentId = (
  environmentId: string,
  allowedIds: ReadonlySet<string>,
  sourcePath: string,
): string | undefined => {
  if (environmentId === DEFAULT_ENVIRONMENT || allowedIds.size === 0 || allowedIds.has(environmentId)) {
    return undefined;
  }

  return `${sourcePath}: environment id ${JSON.stringify(environmentId)} is not listed in allowedEnvironments`;
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

export type DynamicEnvironmentIdentity = EnvironmentIdentity & {
  /** The original value, set only when the id had to be normalized */
  normalizedFrom?: string;
};

const normalizeDynamicEnvironmentId = (rawId: string): string =>
  rawId
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, "_")
    .slice(0, MAX_ENVIRONMENT_ID_LENGTH);

export const resolveDynamicEnvironmentIdentity = (
  resolver: DynamicEnvironmentResolver | undefined,
  payload: { labels: TestResult["labels"] },
  environmentsConfig: EnvironmentsConfig,
  onUnusableValue?: (value: string) => void,
): DynamicEnvironmentIdentity | undefined => {
  const resolved = resolver?.(payload);

  if (resolved === undefined || resolved === null) {
    return undefined;
  }

  const rawId = typeof resolved === "string" ? resolved : resolved.id;
  const rawName = typeof resolved === "string" ? undefined : resolved.name;
  const idResult = validateEnvironmentId(rawId);
  let id: string;
  let normalizedFrom: string | undefined;

  if (idResult.valid) {
    id = idResult.normalized;
  } else if (typeof rawId === "string") {
    id = normalizeDynamicEnvironmentId(rawId);
    normalizedFrom = rawId.trim();

    const normalizedResult = validateEnvironmentId(id);

    if (!normalizedResult.valid || id.replace(/_/g, "").length === 0) {
      // nothing meaningful is left of the value (e.g. "!!!"), treat it like there is no value at all
      onUnusableValue?.(rawId);

      return undefined;
    }
  } else {
    throw new Error(`dynamic environment resolver returned an invalid environment id: ${idResult.reason}`);
  }

  const configured = environmentIdentityById(environmentsConfig, id);

  if (configured) {
    return configured;
  }

  const nameResult = validateEnvironmentName(rawName ?? normalizedFrom ?? id);

  if (!nameResult.valid) {
    if (normalizedFrom !== undefined) {
      return { id, name: id, normalizedFrom };
    }

    throw new Error(`dynamic environment resolver returned an invalid environment name: ${nameResult.reason}`);
  }

  return normalizedFrom === undefined
    ? { id, name: nameResult.normalized }
    : { id, name: nameResult.normalized, normalizedFrom };
};

/**
 * Turns the declarative `{ label, pattern, name }` form into a resolver function.
 * A function is returned as is.
 */
export const createDynamicEnvironmentResolver = (
  config: DynamicEnvironmentsConfig | undefined,
): DynamicEnvironmentResolver | undefined => {
  if (config === undefined || typeof config === "function") {
    return config;
  }

  if (typeof config.label !== "string" || config.label.length === 0) {
    throw new Error(
      "The provided Allure config contains invalid dynamicEnvironments: label must be a non-empty string",
    );
  }

  let pattern: RegExp | undefined;

  try {
    pattern = config.pattern === undefined ? undefined : new RegExp(config.pattern);
  } catch (e) {
    throw new Error(
      `The provided Allure config contains invalid dynamicEnvironments: pattern is not a valid regular expression (${(e as Error).message})`,
    );
  }

  const { label, name } = config;

  return ({ labels }) => {
    const raw = labels.find((item) => item.name === label)?.value;

    if (raw === undefined || raw === "") {
      return undefined;
    }

    // not stateful even for global/sticky patterns
    const match = pattern ? new RegExp(pattern.source, pattern.flags.replace(/[gy]/g, "")).exec(raw) : undefined;

    if (pattern && !match) {
      return undefined;
    }

    const value = match ? (match[1] ?? match[0]) : raw;

    if (!value) {
      return undefined;
    }

    return name ? { id: value, name: name.replace(/\{value\}/g, value) } : value;
  };
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
    dynamicEnvironments?: DynamicEnvironmentResolver;
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
    const dynamic = resolveDynamicEnvironmentIdentity(
      options?.dynamicEnvironments,
      { labels: params.labels ?? [] },
      environmentsConfig,
    );

    return dynamic ? { id: dynamic.id, name: dynamic.name } : DEFAULT_ENVIRONMENT_IDENTITY;
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
