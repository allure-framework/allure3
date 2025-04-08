import type { TestError, TestResult, TestStatus } from "@allurereport/core-api";
import { Button, Code, IconButton, Text, TooltipWrapper, allureIcons } from "@allurereport/web-components";
import AnsiToHtml from "ansi-to-html";
import clsx from "clsx";
import { type FunctionalComponent } from "preact";
import { useState } from "preact/hooks";
import { TrDiff } from "@/components/TestResult/TrError/TrDiff";
import { useI18n } from "@/stores/locale";
import { openModal } from "@/stores/modal";
import { copyToClipboard } from "@/utils/copyToClipboard";
import * as styles from "./styles.scss";

const TrErrorTrace = ({ trace }: { trace: string }) => {
  const ansiTrace = new AnsiToHtml({
    fg: "var(--on-text-primary)",
    colors: {},
  }).toHtml(trace);
  return (
    <div data-testid="test-result-error-trace" className={styles["test-result-error-trace"]}>
      <Code size={"s"} type={"ui"}>
        {/* eslint-disable-next-line react/no-danger */}
        <pre dangerouslySetInnerHTML={{ __html: ansiTrace }}>{ansiTrace}</pre>
      </Code>
    </div>
  );
};

export const TrError: FunctionalComponent<TestError & { status?: TestStatus }> = ({
  message,
  trace,
  actual,
  expected,
  status,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useI18n("ui");
  const { t: tooltip } = useI18n("controls");
  const { t: empty } = useI18n("empty");

  const openDiff = () =>
    openModal({
      title: tooltip("comparison"),
      data: { actual, expected },
      component: <TrDiff actual={actual} expected={expected} />,
    });

  return (
    <div data-testid="test-result-error" className={clsx(styles["test-result-error"], styles[`tr-status-${status}`])}>
      {message ? (
        <>
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
                onClick={() => {
                  copyToClipboard(message);
                }}
              />
            </TooltipWrapper>
          </div>
          <div className={styles["test-result-error-message"]} onClick={() => setIsOpen(!isOpen)}>
            <Code data-testid="test-result-error-message" size={"s"}>
              <pre>{message}</pre>
            </Code>
          </div>
        </>
      ) : (
        empty("no-message-provided")
      )}

      {Boolean(actual && actual !== "undefined" && expected && expected !== "undefined") && (
        <Button
          style={"flat"}
          data-testId={"test-result-diff-button"}
          size={"s"}
          text={tooltip("showDiff")}
          onClick={openDiff}
        />
      )}
      {isOpen && Boolean(trace.length) && <TrErrorTrace trace={trace} />}
    </div>
  );
};
