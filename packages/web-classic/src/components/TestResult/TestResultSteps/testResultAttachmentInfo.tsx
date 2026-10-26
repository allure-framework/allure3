import type { AttachmentTestStepResult } from "@allurereport/core-api";
import { downloadAttachment, openAttachmentInNewTab } from "@allurereport/web-commons";
import { Attachment, IconButton, Text, TooltipWrapper, allureIcons } from "@allurereport/web-components";
import clsx from "clsx";
import { filesize } from "filesize";
import type { FunctionalComponent } from "preact";
import { useEffect } from "preact/hooks";

import { isModalOpen, openModal } from "@/components/Modal";
import { useAttachmentI18n } from "@/components/TestResult/TestResultSteps/useAttachmentI18n";
import { useI18n } from "@/stores";

import * as styles from "@/components/TestResult/TestResultSteps/styles.scss";

interface TestResultAttachmentInfoProps {
  item?: AttachmentTestStepResult;
  shouldExpand?: boolean;
  isPreviewable?: boolean;
  showPreview?: boolean;
  onPreviewToggle?: () => void;
}

export const TestResultAttachmentInfo: FunctionalComponent<TestResultAttachmentInfoProps> = ({
  item,
  shouldExpand,
  isPreviewable,
  showPreview,
  onPreviewToggle,
}) => {
  const { id, ext, contentType } = item.link;
  const { t: tooltip } = useI18n("controls");
  const i18n = useAttachmentI18n();
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
      component: <Attachment item={item} previewable={isPreviewable} i18n={i18n} />,
      preview: isPreviewable,
    });
  };

  useEffect(() => {
    if (isModalOpen.value) {
      openModal({
        data: item,
        component: <Attachment item={item} previewable={isPreviewable} i18n={i18n} />,
        preview: isPreviewable,
      });
    }
  }, [item]);

  const downloadData = async (e: MouseEvent) => {
    e.stopPropagation();
    await downloadAttachment(id, ext, contentType);
  };

  const openInNewTab = async (e: MouseEvent) => {
    e.stopPropagation();
    await openAttachmentInNewTab(id, ext, contentType);
  };

  const setPreview = (e: Event, preview: boolean) => {
    e.stopPropagation();
    if (showPreview !== preview) {
      onPreviewToggle?.();
    }
  };

  return (
    <div className={styles["item-info"]}>
      {Boolean(contentType) && (
        <Text size={"s"} className={styles["item-info-content-type"]}>
          {contentType}
        </Text>
      )}
      {Boolean(contentSize) && <Text size={"s"}>{contentSize}</Text>}
      <div className={styles["item-buttons"]}>
        {isPreviewable && onPreviewToggle && (
          <>
            <TooltipWrapper tooltipText={tooltip("previewAttachment")}>
              <IconButton
                className={clsx(styles["item-button"], showPreview && styles["item-button-active"])}
                style={"ghost"}
                size={"s"}
                iconSize={"s"}
                icon={allureIcons.view}
                aria-pressed={showPreview}
                data-testid="attachment-preview-button"
                onClick={(e: Event) => setPreview(e, true)}
              />
            </TooltipWrapper>
            <TooltipWrapper tooltipText={tooltip("viewCode")}>
              <IconButton
                className={clsx(styles["item-button"], !showPreview && styles["item-button-active"])}
                style={"ghost"}
                size={"s"}
                iconSize={"s"}
                icon={allureIcons.lineFilesFileAttachment2}
                aria-pressed={!showPreview}
                data-testid="attachment-code-button"
                onClick={(e: Event) => setPreview(e, false)}
              />
            </TooltipWrapper>
          </>
        )}
        {shouldExpand && (
          <TooltipWrapper tooltipText={tooltip("expand")}>
            <IconButton
              className={styles["item-button"]}
              style={"ghost"}
              size={"s"}
              iconSize={"s"}
              icon={allureIcons.lineArrowsExpand3}
              data-testid="attachment-expand-button"
              onClick={expandAttachment}
            />
          </TooltipWrapper>
        )}
        {!item.link.missed && (
          <TooltipWrapper tooltipText={tooltip("openInNewTab")}>
            <IconButton
              className={styles["item-button"]}
              style={"ghost"}
              size={"s"}
              iconSize={"s"}
              icon={allureIcons.lineGeneralLinkExternal}
              data-testid="attachment-open-button"
              onClick={(e: MouseEvent) => openInNewTab(e)}
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
