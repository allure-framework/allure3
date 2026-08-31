import { createHash } from "node:crypto";

export const UNKNOWN_PARAMETER_VALUE = "#___unknown_value___#";

export type IdentityParameter = {
  name?: string | null;
  value?: string | null;
  excluded?: boolean | null;
};

const utf8Encoder = new TextEncoder();

export const compareUtf8 = (first: string, second: string): number => {
  const firstBytes = utf8Encoder.encode(first);
  const secondBytes = utf8Encoder.encode(second);
  const length = Math.min(firstBytes.length, secondBytes.length);

  for (let index = 0; index < length; index++) {
    const comparison = firstBytes[index] - secondBytes[index];

    if (comparison !== 0) {
      return comparison;
    }
  }

  return firstBytes.length - secondBytes.length;
};

export const md5Utf8 = (value: string): string => createHash("md5").update(value, "utf8").digest("hex");

export const calculateTestCaseHash = (
  testCaseId: string | null | undefined,
  fullName: string | null | undefined,
): string | undefined => {
  const identity = testCaseId?.length ? testCaseId : fullName?.length ? fullName : undefined;

  return identity === undefined ? undefined : md5Utf8(identity);
};

const compareIdentityParameters = (
  first: { name: string; value: string },
  second: { name: string; value: string },
): number => compareUtf8(first.name, second.name) || compareUtf8(first.value, second.value);

export const stringifyIdentityParameters = (
  parameters: readonly (IdentityParameter | null | undefined)[] | null | undefined,
): string => {
  const normalized: { name: string; value: string }[] = [];

  for (const parameter of parameters ?? []) {
    if (parameter == null) {
      continue;
    }

    const { name } = parameter;

    if (typeof name !== "string" || name.length === 0 || parameter.excluded === true) {
      continue;
    }

    normalized.push({
      name,
      value: parameter.value ?? UNKNOWN_PARAMETER_VALUE,
    });
  }

  const unique = normalized
    .sort(compareIdentityParameters)
    .filter(
      (parameter, index, all) =>
        index === 0 || parameter.name !== all[index - 1].name || parameter.value !== all[index - 1].value,
    );

  return unique.map(({ name, value }) => `${name}:${value}`).join(",");
};

export const calculateParametersHash = (
  parameters: readonly (IdentityParameter | null | undefined)[] | null | undefined,
): string => md5Utf8(stringifyIdentityParameters(parameters));

export const calculateEnvironmentHash = (namedEnvironmentId: string | undefined): string | undefined =>
  namedEnvironmentId === undefined ? undefined : md5Utf8(namedEnvironmentId);

export const calculateRetryHash = (
  testCaseHash: string | undefined,
  parametersHash: string,
  environmentHash?: string,
): string | undefined => {
  if (!testCaseHash) {
    return undefined;
  }

  return environmentHash ? `${testCaseHash}.${parametersHash}.${environmentHash}` : `${testCaseHash}.${parametersHash}`;
};
