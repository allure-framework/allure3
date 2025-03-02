import type { TestError } from "@allurereport/core-api";
import { Code, IconButton, Text, TooltipWrapper, allureIcons } from "@allurereport/web-components";
import AnsiToHtml from "ansi-to-html";
import type { Change } from "diff";
import { diffJson } from "diff";
import { type FunctionalComponent } from "preact";
import { useState } from "preact/hooks";
import { useI18n } from "@/stores/locale";
import { copyToClipboard } from "@/utils/copyToClipboard";
import * as styles from "./styles.scss";

const TestResultErrorTrace = ({ trace, diff, expected }: { trace: string; diff: Change[]; expected: string }) => {
  const ansiTrace = new AnsiToHtml().toHtml(trace);
  return (
    <div data-testid="test-result-error-trace" className={styles["test-result-error-trace"]}>
      <Code size={"s"} type={"ui"}>
        {/* eslint-disable-next-line react/no-danger */}
        <pre dangerouslySetInnerHTML={{ __html: ansiTrace }}>{ansiTrace}</pre>
      </Code>
      <div className={styles.diff}>
        <div>
          <Code size={"s"}>Actual</Code>
          <pre className={`background-white language-markup line-numbers ${styles["diff-screen"]}`}>
            <code>{expected}</code>
          </pre>
        </div>
        <div>
          <Code size={"s"}>Expected</Code>
          <pre className={`background-white language-text line-numbers ${styles["diff-screen"]}`}>
            <code>
              {diff.map((part, index) => (
                <div key={index} className={part.added ? styles["diff-green"] : part.removed ? styles["diff-red"] : ""}>
                  {part.value}
                </div>
              ))}
            </code>
          </pre>
        </div>
      </div>
    </div>
  );
};

export const TestResultError: FunctionalComponent<TestError> = ({ message, trace, actual, expected }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useI18n("ui");
  const { t: tooltip } = useI18n("controls");
  const { t: empty } = useI18n("empty");
  const diff = diffJson(expected, actual);

  return (
    <div data-testid="test-result-error" className={styles["test-result-error"]}>
      {message ? (
        <>
          <div data-testid="test-result-error-header" className={styles["test-result-error-header"]}>
            <Text tag={"p"} size={"m"} bold className={styles["test-result-error-text"]}>
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
        // TODO add translations
        empty("no-message-provided")
      )}

      {/* TODO no trace? message is still clickable */}
      {isOpen && trace && <TestResultErrorTrace trace={trace} diff={diff} expected={expected} />}
    </div>
  );
};
