import type { TestParameter } from "@allurereport/core-api";
import { md5 } from "@allurereport/plugin-api";

export type LegacyHistoryIdInput = {
  historyId?: string;
  testCase?: {
    allureId?: string;
    externalId?: string;
  };
  fullName?: string;
  parameters?: readonly TestParameter[];
  sourceMetadata?: {
    legacyTestCaseHash?: string;
  };
};

const compareLegacyParameters = (first: TestParameter, second: TestParameter): number =>
  first.name.localeCompare(second.name) || first.value.localeCompare(second.value);

/**
 * Calculates the history ID produced before canonical retry hashes.
 * Falls back to current test-case metadata only for manually constructed results
 * that don't contain the exact per-result compatibility hash.
 *
 * @deprecated Remove this compatibility layer when TestOps accepts `retryHash`
 * directly. See https://github.com/allure-framework/allure3/pull/903.
 */
export const calculateLegacyHistoryId = ({
  historyId,
  testCase,
  fullName,
  parameters = [],
  sourceMetadata,
}: LegacyHistoryIdInput): string | undefined => {
  if (historyId) {
    return historyId;
  }

  const allureId = testCase?.allureId;
  const legacyTestCaseHash =
    sourceMetadata?.legacyTestCaseHash ??
    (allureId && allureId !== "-1"
      ? md5(`ALLURE_ID=${allureId}`)
      : testCase?.externalId
        ? md5(testCase.externalId)
        : fullName
          ? md5(fullName)
          : undefined);

  if (!legacyTestCaseHash) {
    return undefined;
  }

  const serializedParameters = [...parameters]
    .filter(({ excluded }) => !excluded)
    .sort(compareLegacyParameters)
    .map(({ name, value }) => `${name}:${value}`)
    .join(",");

  return `${legacyTestCaseHash}.${md5(serializedParameters)}`;
};
