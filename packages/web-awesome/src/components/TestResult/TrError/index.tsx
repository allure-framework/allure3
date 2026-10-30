import type { TestError, TestStatus } from "@allurereport/core-api";
import {
  LazyComponent,
  Spinner,
  TestResultError,
  type TestResultErrorI18nKey,
} from "@allurereport/web-components/core";
import { type FunctionalComponent } from "preact";

import { useI18n } from "@/stores/locale";
import { openModal } from "@/stores/modal";

const loadComparison = () =>
  import(/* webpackChunkName: "error-diff" */ "./TrDiff").then((module) => ({ default: module.TrDiff }));

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

export const TrError: FunctionalComponent<
  TestError & { className?: string; status?: TestStatus; showMessage?: boolean; title?: string }
> = (props) => {
  const { t } = useI18n("ui");
  const { t: tooltip } = useI18n("controls");
  const { t: empty } = useI18n("empty");
  const { actual, expected } = props;
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

  return <TestResultError {...props} i18n={i18n} onShowDiff={openDiff} />;
};
