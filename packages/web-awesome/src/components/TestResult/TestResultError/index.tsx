import type { TestError } from "@allurereport/core-api";
import { Button, Code, CodeViewer, IconButton, Text, TooltipWrapper, allureIcons } from "@allurereport/web-components";
import AnsiToHtml from "ansi-to-html";
import type { BaseOptions, Change } from "diff";
import { diffChars, diffJson, diffLines, diffWords, parsePatch } from "diff";
import { type FunctionalComponent } from "preact";
import { useState } from "preact/hooks";
import { useI18n } from "@/stores/locale";
import { openModal } from "@/stores/modal";
import { copyToClipboard } from "@/utils/copyToClipboard";
import * as styles from "./styles.scss";

const diffFunctions = {
  chars: diffChars,
  words: diffWords,
  lines: diffLines,
  json: diffJson,
} as const;

type DiffType = keyof typeof diffFunctions;

const TRDiff = ({ expected, actual }: { expected: string; actual: string }) => {
  const [diff, setDiff] = useState<Change[]>(() => diffJson(expected, actual));

  const DiffCode = () => {
    return (
      <>
        {diff.map((part, index) => (
          <div key={index} className={part.added ? styles["diff-green"] : part.removed ? styles["diff-red"] : ""}>
            {part.value}
          </div>
        ))}
      </>
    );
  };
  const changeTypeDiff = (type: DiffType = "chars") => {
    const diffFn = diffFunctions[type];
    const result = (diffFn as (oldStr: string, newStr: string, options?: BaseOptions) => Change[])(
      expected,
      actual,
      {},
    );

    setDiff(result);
  };

  return (
    <div className={styles.diff}>
      <div className={styles.side}>
        <Code size={"s"} className={styles["side-title"]}>
          Actual
        </Code>
        <CodeViewer code={actual} className={styles["diff-screen"]} />
      </div>
      <div className={styles.side}>
        <div className={styles.expected}>
          <Code size={"s"} className={styles["side-title"]}>
            Expected
          </Code>
          <div className={styles["diff-buttons"]}>
            <Code size={"s"}>Diff by:</Code>
            <Button size={"s"} style={"outline"} text={"chars"} onClick={() => changeTypeDiff("chars")} />
            <Button size={"s"} style={"outline"} text={"words"} onClick={() => changeTypeDiff("words")} />
            <Button size={"s"} style={"outline"} text={"lines"} onClick={() => changeTypeDiff("lines")} />
            <Button size={"s"} style={"outline"} text={"json"} onClick={() => changeTypeDiff("json")} />
          </div>
        </div>
        <CodeViewer className={styles["diff-screen"]}>
          <DiffCode />
        </CodeViewer>
      </div>
    </div>
  );
};
const TestResultErrorTrace = ({ trace }: { trace: string }) => {
  const ansiTrace = new AnsiToHtml().toHtml(trace);
  return (
    <div data-testid="test-result-error-trace" className={styles["test-result-error-trace"]}>
      <Code size={"s"} type={"ui"}>
        {/* eslint-disable-next-line react/no-danger */}
        <pre dangerouslySetInnerHTML={{ __html: ansiTrace }}>{ansiTrace}</pre>
      </Code>
    </div>
  );
};

export const TestResultError: FunctionalComponent<TestError> = ({ message, trace, actual, expected }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useI18n("ui");
  const { t: tooltip } = useI18n("controls");
  const { t: empty } = useI18n("empty");

  const openDiff = () =>
    openModal({
      data: { actual, expected },
      component: <TRDiff actual={actual} expected={expected} />,
    });

  return (
    <div data-testid="test-result-error" className={styles["test-result-error"]}>
      {message ? (
        <>
          <div data-testid="test-result-error-header" className={styles["test-result-error-header"]}>
            <Text tag={"p"} size={"m"} bold className={styles["test-result-error-text"]}>
              {t("error")}
            </Text>
            <Button style={"ghost"} size={"s"} text={"Show diff"} onClick={openDiff} />
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

      {isOpen && actual && expected && <TRDiff expected={expected} actual={actual} />}
      {/* TODO no trace? message is still clickable */}
      {isOpen && trace && <TestResultErrorTrace trace={trace} />}
    </div>
  );
};
