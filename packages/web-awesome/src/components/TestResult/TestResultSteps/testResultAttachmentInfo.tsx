import type { AttachmentTestStepResult } from "@allurereport/core-api";
import { IconButton, Text, TooltipWrapper, allureIcons } from "@allurereport/web-components";
import { filesize } from "filesize";
import type { FunctionalComponent } from "preact";
import { useEffect } from "preact/hooks";
import { isModalOpen, openModal } from "@/components/Modal";
import { Attachment } from "@/components/TestResult/TestResultSteps/attachment";
import * as styles from "@/components/TestResult/TestResultSteps/styles.scss";
import { useI18n } from "@/stores";
import { downloadAttachment } from "@/utils/attachments";

interface TestResultAttachmentInfoProps {
  item?: AttachmentTestStepResult;
  shouldExpand?: boolean;
}

export const TestResultAttachmentInfo: FunctionalComponent<TestResultAttachmentInfoProps> = ({
  item,
  shouldExpand,
}) => {
  const { id, ext, contentType } = item.link;
  const { t: tooltip } = useI18n("controls");
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
