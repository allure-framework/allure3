import type { TestError, TestStatus } from "@allurereport/core-api";
import {
  ansiSemanticColors,
  ansiToHTML,
  copyToClipboard,
  hasErrorDiff,
  normalizeAnsiForegroundColors,
} from "@allurereport/web-commons";
import clsx from "clsx";
import type { FunctionalComponent } from "preact";
import { useState } from "preact/hooks";

import { Button, IconButton } from "@/components/Button";
import { allureIcons } from "@/components/SvgIcon";
import { TooltipWrapper } from "@/components/Tooltip";
import { Code, Text } from "@/components/Typography";

import styles from "./styles.scss";

export type TestResultErrorI18nKey = "error" | "noMessage" | "copy" | "copied" | "showDiff";

export type TestResultErrorProps = TestError & {
  i18n: (key: TestResultErrorI18nKey) => string;
  /** Called by the "show diff" button; the report opens its own comparison modal. */
  onShowDiff: () => void;
  status?: TestStatus;
  className?: string;
  /** Header text. Default: the "error" translation */
  title?: string;
  /** When false, only the diff button, the copy button and the trace are rendered. Default: true */
  showMessage?: boolean;
  /**
   * Keep the header for an error without a message, show a "no message" note under it
   * and the trace right away (the Allure 2 layout). Default: false
   */
  persistentHeader?: boolean;
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

export const TestResultError: FunctionalComponent<TestResultErrorProps> = ({
  i18n,
  onShowDiff,
  className,
  message = "",
  trace,
  actual,
  expected,
  status,
  showMessage = true,
  persistentHeader = false,
  title,
  ...rest
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const hasTrace = Boolean(trace?.length);
  const hasDiff = hasErrorDiff({ actual, expected });
  const showHeader = showMessage && (Boolean(message) || persistentHeader);
  const showTrace = isOpen || !showMessage || (persistentHeader && !message);
  const toggleTrace = () => setIsOpen((open) => !open);
  const copyButton = (
    <TooltipWrapper tooltipText={i18n("copy")} tooltipTextAfterClick={i18n("copied")}>
      <IconButton
        style={"ghost"}
        size={"s"}
        icon={allureIcons.lineGeneralCopy3}
        data-testid="test-result-error-copy"
        onClick={() => {
          copyToClipboard(trace || message);
        }}
      />
    </TooltipWrapper>
  );
  const diffButton = (
    <Button
      style={"flat"}
      data-testid={"test-result-diff-button"}
      size={"s"}
      text={i18n("showDiff")}
      onClick={onShowDiff}
    />
  );

  return (
    <div
      data-testid="test-result-error"
      className={clsx(styles["test-result-error"], styles[`tr-status-${status}`], className)}
      {...rest}
    >
      {showHeader && (
        <div data-testid="test-result-error-header" className={styles["test-result-error-header"]}>
          <Text
            tag={"p"}
            size={"m"}
            bold
            className={clsx(styles["test-result-error-text"], styles[`tr-color-${status}`])}
          >
            {title ?? i18n("error")}
          </Text>
          {copyButton}
        </div>
      )}
      {showMessage && message && (
        <button
          type="button"
          className={styles["test-result-error-message"]}
          aria-label={i18n("error")}
          aria-expanded={hasTrace ? isOpen : undefined}
          onClick={toggleTrace}
        >
          <Code data-testid="test-result-error-message" size={"s"}>
            {/* eslint-disable-next-line react/no-danger */}
            <pre dangerouslySetInnerHTML={{ __html: ansiStatusDetailsToHTML(message) }} />
          </Code>
        </button>
      )}
      {showMessage &&
        !message &&
        (persistentHeader ? (
          <Text tag={"p"} size={"s"} className={styles["test-result-error-empty"]}>
            {i18n("noMessage")}
          </Text>
        ) : (
          i18n("noMessage")
        ))}
      {!showMessage && message && (
        <div className={styles["test-result-error-header"]}>
          {hasDiff ? diffButton : <span />}
          {copyButton}
        </div>
      )}
      {(showMessage || !message) && hasDiff && diffButton}
      {showTrace && hasTrace && <TestResultErrorTrace trace={trace ?? ""} />}
    </div>
  );
};
