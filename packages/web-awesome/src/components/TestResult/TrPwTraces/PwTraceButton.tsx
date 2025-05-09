import type { AttachmentTestStepResult } from "@allurereport/core-api";
import type { Attachments } from "@allurereport/web-commons";
import { fetchReportAttachment } from "@allurereport/web-commons";
import { IconButton, TooltipWrapper, allureIcons } from "@allurereport/web-components";
import { PwTrace } from "@/components/TestResult/TrPwTraces/PwTrace";
import { useI18n } from "@/stores";
import { openModal } from "@/stores/modal";

export const fetchFromUrl = async ({ id, ext, contentType }: Attachments) => {
  const fileName = `${id || "-"}${ext || ""}`;

  return fetchReportAttachment(`data/attachments/${fileName}?attachment`, contentType);
};

export const PwTraceButton = ({ link }: Pick<AttachmentTestStepResult, "link">) => {
  const { t } = useI18n("ui");
  const openPw = async () => {
    const hasPw = await fetchFromUrl(link);
    const blob = await hasPw.blob();

    openModal({
      component: <PwTrace blob={blob} />,
      title: `Playwright Trace Viewer | ${link.name}${link.ext}`,
    });
  };

  return (
    <TooltipWrapper tooltipText={t("openPwTrace")}>
      <IconButton icon={allureIcons.lineArrowsExpand3} size={"s"} style={"ghost"} onClick={openPw} />
    </TooltipWrapper>
  );
};
