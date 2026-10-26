import type { TestError, TestStatus } from "@allurereport/core-api";
import {
  ansiSemanticColors,
  ansiToHTML,
  copyToClipboard,
  normalizeAnsiForegroundColors,
} from "@allurereport/web-commons";
import {
  Button,
  Code,
  IconButton,
  LazyComponent,
  Spinner,
  Text,
  TooltipWrapper,
  allureIcons,
} from "@allurereport/web-components";
import clsx from "clsx";
import { type FunctionalComponent } from "preact";
import { useState } from "preact/hooks";

import { openModal } from "@/components/Modal";
import { hasErrorDiff } from "@/components/TestResult/TestResultError/errorDetails";
import { useI18n } from "@/stores/locale";

import * as styles from "./styles.scss";

const loadComparison = () =>
  import(/* webpackChunkName: "error-diff" */ "./TestResultDiff").then((module) => ({
    default: module.TestResultDiff,
  }));

const Comparison = (props: Pick<TestError, "actual" | "expected">) => {
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

const ansiStatusDetailsToHTML = (text: string) =>
  ansiToHTML(normalizeAnsiForegroundColors(text), {
    fg: "var(--color-text-primary)",
    bg: "none",
    colors: ansiSemanticColors,
  });

const TestResultErrorTrace = ({ trace }: { trace: string }) => (
  <div data-testid="test-result-error-trace" className={styles["test-result-error-trace"]}>
    <Code size={"s"} type={"ui"}>
      {/* eslint-disable-next-line react/no-danger */}
      <pre dangerouslySetInnerHTML={{ __html: ansiStatusDetailsToHTML(trace) }} />
    </Code>
  </div>
);

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
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useI18n("ui");
  const { t: tooltip } = useI18n("controls");
  const { t: empty } = useI18n("empty");
  const hasTrace = Boolean(trace?.length);
  const hasDiff = hasErrorDiff({ actual, expected });
  const toggleTrace = () => setIsOpen((open) => !open);
  const openDiff = () =>
    openModal({
      title: tooltip("comparison"),
      data: { actual, expected },
      component: <Comparison actual={actual} expected={expected} />,
    });

  return (
    <div
      data-testid="test-result-error"
      className={clsx(styles["test-result-error"], styles[`tr-status-${status}`], className)}
    >
      <div data-testid="test-result-error-header" className={styles["test-result-error-header"]}>
        <Text
          tag={"p"}
          size={"m"}
          bold
          className={clsx(styles["test-result-error-text"], styles[`tr-color-${status}`])}
        >
          {t("error")}
        </Text>
        <TooltipWrapper tooltipText={tooltip("clipboard")} tooltipTextAfterClick={tooltip("clipboardSuccess")}>
          <IconButton
            style={"ghost"}
            size={"s"}
            icon={allureIcons.lineGeneralCopy3}
            data-testid="test-result-error-copy"
            onClick={() => {
              copyToClipboard(trace || message || "");
            }}
          />
        </TooltipWrapper>
      </div>
      {message ? (
        <button
          type="button"
          className={styles["test-result-error-message"]}
          aria-label={t("error")}
          aria-expanded={hasTrace ? isOpen : undefined}
          onClick={toggleTrace}
        >
          <Code data-testid="test-result-error-message" size={"s"}>
            {/* eslint-disable-next-line react/no-danger */}
            <pre dangerouslySetInnerHTML={{ __html: ansiStatusDetailsToHTML(message) }} />
          </Code>
        </button>
      ) : (
        <Text tag={"p"} size={"s"} className={styles["test-result-error-empty"]}>
          {empty("no-message-provided")}
        </Text>
      )}
      {hasDiff && (
        <Button
          style={"flat"}
          data-testid={"test-result-diff-button"}
          size={"s"}
          text={tooltip("showDiff")}
          onClick={openDiff}
        />
      )}
      {(isOpen || !message) && hasTrace && <TestResultErrorTrace trace={trace} />}
    </div>
  );
};
