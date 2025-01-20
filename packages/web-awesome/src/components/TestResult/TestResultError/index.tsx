import { Code, IconButton, Text, TooltipWrapper, allureIcons } from "@allurereport/web-components";
import { type FunctionalComponent } from "preact";
import { useState } from "preact/hooks";
import { useI18n } from "@/stores/locale";
import { copyToClipboard } from "@/utils/copyToClipboard";
import * as styles from "./styles.scss";

const TestResultErrorTrace = ({ trace }: { trace: string }) => {
  return (
    <div data-testid="test-result-error-trace" className={styles["test-result-error-trace"]}>
      <Code size={"s"} type={"ui"}>
        <pre>{trace}</pre>
      </Code>
    </div>
  );
};

export const TestResultError: FunctionalComponent<{ message: string; trace: string }> = ({ message, trace }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useI18n("ui");
  const { t: tooltip } = useI18n("controls");

  return (
    <div data-testid="test-result-error" className={styles["test-result-error"]}>
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
      {isOpen && trace && <TestResultErrorTrace trace={trace} />}
    </div>
  );
};
