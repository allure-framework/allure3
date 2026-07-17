import type { AttachmentTestStepResult } from "@allurereport/core-api";
import { downloadAttachment } from "@allurereport/web-commons";
import { Attachment, IconButton, Text, TooltipWrapper, allureIcons } from "@allurereport/web-components";
import cx from "clsx";
import { filesize } from "filesize";
import type { FunctionalComponent } from "preact";
import { useEffect } from "preact/hooks";

import { PwTraceButton } from "@/components/TestResult/TrPwTraces/PwTraceButton";
import { useI18n } from "@/stores";
import { isModalOpen, openModal } from "@/stores/modal";

import * as styles from "@/components/TestResult/TrSteps/styles.scss";

interface TrAttachmentInfo {
  item?: AttachmentTestStepResult;
  shouldExpand?: boolean;
  isPreviewable?: boolean;
  showPreview?: boolean;
  onPreviewToggle?: () => void;
  highlightCode?: boolean;
  onHighlightToggle?: () => void;
}

export const TrAttachmentInfo: FunctionalComponent<TrAttachmentInfo> = ({
  item,
  shouldExpand,
  isPreviewable,
  showPreview,
  onPreviewToggle,
  highlightCode = true,
  onHighlightToggle,
}) => {
  const { t: tooltip } = useI18n("controls");
  const { t: tAttachments } = useI18n("attachments");
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
      preview: isPreviewable,
      component: (
        <Attachment
          item={item}
          previewable={isPreviewable}
          i18n={{ imageDiff: (key: string) => tAttachments(`imageDiff.${key}`) }}
        />
      ),
    });
  };

  useEffect(() => {
    if (isModalOpen.value) {
      openModal({
        isModalOpen: true,
        data: item,
        preview: isPreviewable,
        component: (
          <Attachment
            item={item}
            previewable={isPreviewable}
            i18n={{ imageDiff: (key: string) => tAttachments(`imageDiff.${key}`) }}
          />
        ),
      });
    }
  }, [item, isPreviewable, tAttachments]);

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
        {isPreviewable && onPreviewToggle && (
          <>
            <TooltipWrapper tooltipText={tooltip("previewAttachment")}>
              <IconButton
                className={cx(styles["item-button"], showPreview && styles["item-button-active"])}
                style={"ghost"}
                size={"s"}
                iconSize={"s"}
                isActive={showPreview}
                icon={allureIcons.view}
                aria-pressed={showPreview}
                onClick={(e: Event) => {
                  e.stopPropagation();
                  if (!showPreview) {
                    onPreviewToggle();
                  }
                }}
              />
            </TooltipWrapper>
            <TooltipWrapper tooltipText={tooltip("viewCode")}>
              <IconButton
                className={cx(styles["item-button"], !showPreview && styles["item-button-active"])}
                style={"ghost"}
                size={"s"}
                iconSize={"s"}
                isActive={!showPreview}
                icon={allureIcons.lineFilesFileAttachment2}
                aria-pressed={!showPreview}
                onClick={(e: Event) => {
                  e.stopPropagation();
                  if (showPreview) {
                    onPreviewToggle();
                  }
                }}
              />
            </TooltipWrapper>
          </>
        )}
        {onHighlightToggle && (
          <TooltipWrapper tooltipText={tooltip("syntaxHighlight")}>
            <IconButton
              className={cx(
                styles["item-button"],
                highlightCode && styles["item-button-active"],
                !highlightCode && styles["item-button-syntax-off"],
              )}
              style={"ghost"}
              size={"s"}
              iconSize={"s"}
              isActive={highlightCode}
              icon={allureIcons.lineDevCodeSquare}
              aria-pressed={highlightCode}
              onClick={(e: Event) => {
                e.stopPropagation();
                onHighlightToggle();
              }}
            />
          </TooltipWrapper>
        )}
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
