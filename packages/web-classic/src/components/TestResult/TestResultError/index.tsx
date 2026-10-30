import type { TestError, TestStatus } from "@allurereport/core-api";
import {
  LazyComponent,
  Spinner,
  TestResultError as TestResultErrorBlock,
  type TestResultErrorI18nKey,
} from "@allurereport/web-components";
import { type FunctionalComponent } from "preact";

import { openModal } from "@/components/Modal";
import { useI18n } from "@/stores/locale";

const loadComparison = () =>
  import(/* webpackChunkName: "error-diff" */ "./TestResultDiff").then((module) => ({
    default: module.TestResultDiff,
  }));

const Comparison = (props: Required<Pick<TestError, "actual" | "expected">>) => {
  const { t } = useI18n("controls");

  return (
    <LazyComponent
      loader={loadComparison}
      componentProps={props}
      fallback={<Spinner />}
      errorMessage={t("loadComparisonError")}
      retryLabel={t("retry")}
    />
  );
};

export type TestResultErrorProps = TestError & {
  status?: TestStatus;
  className?: string;
};

export const TestResultError: FunctionalComponent<TestResultErrorProps> = ({
  message,
  trace,
  actual,
  expected,
  status = "failed",
  className,
}) => {
  const { t } = useI18n("ui");
  const { t: tooltip } = useI18n("controls");
  const { t: empty } = useI18n("empty");
  const i18n = (key: TestResultErrorI18nKey) =>
    ({
      error: t("error"),
      noMessage: empty("no-message-provided"),
      copy: tooltip("clipboard"),
      copied: tooltip("clipboardSuccess"),
      showDiff: tooltip("showDiff"),
    })[key];
  const openDiff = () => {
    if (!actual || !expected) return;
    openModal({
      title: tooltip("comparison"),
      data: { actual, expected },
      component: <Comparison actual={actual} expected={expected} />,
    });
  };

  return (
    <TestResultErrorBlock
      message={message}
      trace={trace}
      actual={actual}
      expected={expected}
      status={status}
      className={className}
      i18n={i18n}
      onShowDiff={openDiff}
      persistentHeader
    />
  );
};
