import type { AttachmentTestStepResult } from "@allurereport/core-api";
import type { Attachments } from "@allurereport/web-commons";
import { fetchReportAttachment } from "@allurereport/web-commons";
import { Button } from "@allurereport/web-components";
import { PwTrace } from "@/components/TestResult/TrQuickActions/PwTrace";
import { openModal } from "@/stores/modal";
import * as styles from "./styles.scss";

export const fetchFromUrl = async ({ id, ext, contentType }: Attachments) => {
  const fileName = `${id || "-"}${ext || ""}`;

  return fetchReportAttachment(`data/attachments/${fileName}?attachment`, contentType);
};

export const PwTraceButton = ({ link }: Pick<AttachmentTestStepResult, "link">) => {
  const openPw = async () => {
    const hasPw = await fetchFromUrl(link);
    const blob = await hasPw.blob();

    openModal({
      component: <PwTrace blob={blob} />,
      title: `Playwright Trace Viewer | ${link.name}${link.ext}`,
    });
  };

  return (
    <Button
      size={"s"}
      style={"flat"}
      className={styles["pw-trace-button"]}
      text={"Playwright Trace Viewer"}
      onClick={openPw}
    />
  );
};
