import type { AttachmentTestStepResult } from "@allurereport/core-api";
import type { FunctionalComponent } from "preact";
import type { AwesomeTestResult } from "types";
import { TrAttachment } from "@/components/TestResult/TrSteps/TrAttachment";
import { useI18n } from "@/stores";
import * as styles from "./styles.scss";

export type TrAttachmentViewProps = {
  testResult?: AwesomeTestResult;
};

export const TrAttachmentView: FunctionalComponent<TrAttachmentViewProps> = ({ testResult }) => {
  const { attachments } = testResult ?? {};
  const { t } = useI18n("empty");

  return (
    <div className={styles["test-result-attachments-view"]}>
      {attachments.length ? (
        attachments?.map((attach, key) => (
          <TrAttachment item={attach as AttachmentTestStepResult} key={key} stepIndex={key + 1} />
        ))
      ) : (
        <div className={styles["test-result-empty"]}>{t("no-attachments-results")}</div>
      )}
    </div>
  );
};
