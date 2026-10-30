import { ErrorDiff } from "@allurereport/web-components/ErrorDiff";

import { useI18n } from "@/stores";

export const TestResultDiff = ({ expected, actual }: { expected: string; actual: string }) => {
  const { t } = useI18n("controls");

  return <ErrorDiff expected={expected} actual={actual} i18n={t} />;
};
