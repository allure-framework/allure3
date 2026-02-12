import type { AttachmentTestStepResult } from "@allurereport/core-api";
import { Loadable } from "@allurereport/web-components";
import { TrAttachmentView } from "@/components/TestResult/TrAttachmentsView";
import { useI18n } from "@/stores";
import { globalsStore } from "@/stores/globals";
import { AwesomeTestResult } from "../../../types";
import * as styles from "./styles.scss";

export const ReportGlobalAttachments = () => {
  const { t } = useI18n("empty");

  return (
    <Loadable
      source={globalsStore}
      renderData={({ attachments }) => {
        if (!attachments.length) {
          return <div className={styles["report-global-attachments-empty"]}>{t("no-attachments-results")}</div>;
        }

        const attachmentSteps: AttachmentTestStepResult[] = attachments.map((attachment: any) => ({
          link: attachment,
          type: "attachment",
        }));

        return (
          <TrAttachmentView
            className={styles["report-global-attachments"]}
            testResult={{ attachments: attachmentSteps } as AwesomeTestResult}
          />
        );
      }}
    />
  );
};
