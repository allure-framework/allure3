import { formatNormalizedEnvironmentCollision, validateEnvironmentName } from "@allurereport/core-api";

export const normalizeEnvironmentDescriptorMap = <T>(
  input: Record<string, T>,
  sourcePath: string,
  options: {
    formatInvalidError?: (originalKey: string, reason: string, sourcePath: string) => string;
  } = {},
): { normalized: Record<string, T>; errors: string[] } => {
  const normalized: Record<string, T> = {};
  const originalKeysByNormalized = new Map<string, string[]>();
  const errors: string[] = [];

  Object.entries(input).forEach(([environmentName, environmentDescriptor]) => {
    const validationResult = validateEnvironmentName(environmentName);

    if (!validationResult.valid) {
      if (options.formatInvalidError) {
        errors.push(options.formatInvalidError(environmentName, validationResult.reason, sourcePath));
      } else {
        errors.push(
          `Invalid ${sourcePath}[${JSON.stringify(environmentName)}] ${JSON.stringify(environmentName)}: ${validationResult.reason}`,
        );
      }
      return;
    }

    const normalizedEnvironment = validationResult.normalized;
    const originalKeys = originalKeysByNormalized.get(normalizedEnvironment) ?? [];

    originalKeys.push(environmentName);
    originalKeysByNormalized.set(normalizedEnvironment, originalKeys);

    if (!(normalizedEnvironment in normalized)) {
      normalized[normalizedEnvironment] = environmentDescriptor;
    }
  });

  originalKeysByNormalized.forEach((originalKeys, normalizedEnvironment) => {
    if (originalKeys.length <= 1) {
      return;
    }

    errors.push(formatNormalizedEnvironmentCollision(sourcePath, normalizedEnvironment, originalKeys));
  });

  return { normalized, errors };
};
