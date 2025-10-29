import type { TestError, TestStatus } from "@allurereport/core-api";
import { ansiToHTML } from "@allurereport/web-commons";
import { Button, Code, IconButton, Text, TooltipWrapper, allureIcons } from "@allurereport/web-components";
import clsx from "clsx";
import { type FunctionalComponent } from "preact";
import { useState } from "preact/hooks";
import { TrDiff } from "@/components/TestResult/TrError/TrDiff";
import { useI18n } from "@/stores/locale";
import { openModal } from "@/stores/modal";
import { copyToClipboard } from "@/utils/copyToClipboard";
import * as styles from "./styles.scss";

const TrErrorTrace = ({ trace }: { trace: string }) => {
  const sanitizedTrace = ansiToHTML(trace, {
    fg: "var(--on-text-primary)",
    colors: {},
  });

  return (
    <div data-testid="test-result-error-trace" className={styles["test-result-error-trace"]}>
      <Code size={"s"} type={"ui"}>
        {/* eslint-disable-next-line react/no-danger */}
        <pre dangerouslySetInnerHTML={{ __html: sanitizedTrace }} />
      </Code>
    </div>
  );
};

export const TrError: FunctionalComponent<TestError & { className?: string; status?: TestStatus }> = ({
  className,
  message = "",
  trace,
  actual,
  expected,
  status,
  ...rest
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
  const sanitizedMessage = ansiToHTML(message, {
    fg: "var(--on-text-primary)",
    colors: {},
  });

  return (
    <div
      data-testid="test-result-error"
      className={clsx(styles["test-result-error"], styles[`tr-status-${status}`], className)}
      {...rest}
    >
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
              {/* eslint-disable-next-line react/no-danger */}
              <pre dangerouslySetInnerHTML={{ __html: sanitizedMessage }} />
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
      {isOpen && Boolean(trace?.length) && <TrErrorTrace trace={trace} />}
    </div>
  );
};
