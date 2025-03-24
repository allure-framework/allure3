import type { AttachmentTestStepResult } from "@allurereport/core-api";
import { downloadAttachment } from "@allurereport/web-commons";
import { Attachment, IconButton, Text, TooltipWrapper, allureIcons } from "@allurereport/web-components";
import { filesize } from "filesize";
import type { FunctionalComponent } from "preact";
import { useEffect } from "preact/hooks";
import { PwTraceButton } from "@/components/TestResult/TrPwTraces/PwTraceButton";
import * as styles from "@/components/TestResult/TrSteps/styles.scss";
import { useI18n } from "@/stores";
import { isModalOpen, openModal } from "@/stores/modal";

interface TrAttachmentInfo {
  item?: AttachmentTestStepResult;
  shouldExpand?: boolean;
}

export const TrAttachmentInfo: FunctionalComponent<TrAttachmentInfo> = ({ item, shouldExpand }) => {
  const { t: tooltip } = useI18n("controls");
  const { id, ext, contentType } = item.link;
  const isPwTrace = contentType === "application/vnd.allure.playwright-trace";
  const contentLength = item.link.missed === false ? item.link.contentLength : undefined;
  const contentSize = contentLength
    ? filesize(contentLength, {
        base: 2,
        round: 1,
      })
    : "-";

  const expandAttachment = (event: Event) => {
    event.stopPropagation();
    openModal({
      data: item,
      component: <Attachment item={item} previewable={true} />,
    });
  };

  useEffect(() => {
    if (isModalOpen.value) {
      openModal({
        isModalOpen: true,
        data: item,
        component: <Attachment item={item} />,
      });
    }
  }, [item]);

  const downloadData = async (e: MouseEvent) => {
    e.stopPropagation();
    await downloadAttachment(id, ext, contentType);
  };

  return (
    <div className={styles["item-info"]}>
      {Boolean(contentType) && <Text size={"s"}>{contentType}</Text>}
      {Boolean(contentSize) && <Text size={"s"}>{contentSize}</Text>}
      <div className={styles["item-buttons"]}>
        {isPwTrace && <PwTraceButton link={item.link} />}
        {shouldExpand && (
          <TooltipWrapper tooltipText={tooltip("expand")}>
            <IconButton
              className={styles["item-button"]}
              style={"ghost"}
              size={"s"}
              iconSize={"s"}
              icon={allureIcons.lineArrowsExpand3}
              onClick={expandAttachment}
            />
          </TooltipWrapper>
        )}
        <TooltipWrapper tooltipText={tooltip("downloadAttachment")}>
          <IconButton
            style={"ghost"}
            size={"s"}
            iconSize={"s"}
            className={styles["item-button"]}
            icon={allureIcons.lineGeneralDownloadCloud}
            onClick={(e: MouseEvent) => downloadData(e)}
          />
        </TooltipWrapper>
      </div>
    </div>
  );
};
