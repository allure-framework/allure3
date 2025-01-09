import { sanitizeHtml } from "@allurereport/web-commons";
import { useState } from "preact/hooks";
import LineGeneralCopy3 from "@/assets/svg/line-general-copy-3.svg";
import { IconButton } from "@/components/commons/Button";
import { TooltipWrapper } from "@/components/commons/Tooltip";
import { Code, Text } from "@/components/commons/Typography";
import { useI18n } from "@/stores/locale";
import { copyToClipboard } from "@/utils/copyToClipboard";
import * as styles from "./styles.scss";

const TestResultErrorTrace = ({ trace }) => {
  const sanitizedTrace = sanitizeHtml(trace);

  return (
    <div data-testid="test-result-error-trace" className={styles["test-result-error-trace"]}>
      <Code size={"s"} type={"ui"}>
        <pre dangerouslySetInnerHTML={{ __html: sanitizedTrace }} />
      </Code>
    </div>
  );
};

export const TestResultError = ({ message, trace }) => {
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
            icon={LineGeneralCopy3.id}
            onClick={() => {
              copyToClipboard(message);
            }}
          />
        </TooltipWrapper>
      </div>
      <div className={styles["test-result-error-message"]} onClick={() => setIsOpen(!isOpen)}>
        <Code data-testid="test-result-error-message" size={"s"}>
          {message}
        </Code>
      </div>
      {isOpen && trace && <TestResultErrorTrace trace={trace} />}
    </div>
  );
};
