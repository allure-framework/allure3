import type { AttachmentTestStepResult } from "@allurereport/core-api";
import { Loadable } from "@allurereport/web-components";
import { TrAttachmentView } from "@/components/TestResult/TrAttachmentsView";
import { globalsStore } from "@/stores/globals";
import { AwesomeTestResult } from "../../../types";
import * as styles from "./styles.scss";

export const ReportGlobalAttachments = () => (
  <Loadable
    source={globalsStore}
    renderData={({ attachments }) => {
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
