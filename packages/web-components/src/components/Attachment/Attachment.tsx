import type { AttachmentTestStepResult } from "@allurereport/core-api";
import { attachmentType, fetchAttachment } from "@allurereport/web-commons";
import type { AttachmentData, AttachmentType } from "@allurereport/web-commons";
import { batch, useSignal } from "@preact/signals";
import type { ComponentChildren } from "preact";
import { useCallback, useEffect } from "preact/hooks";
import { Spinner } from "@/components/Spinner";
import { IconButton } from "../Button";
import { EmptyView } from "../EmptyView";
import { allureIcons } from "../SvgIcon";
import { AttachmentCode } from "./AttachmentCode";
import { AttachmentImage } from "./AttachmentImage";
import { AttachmentImageDiff } from "./AttachmentImageDiff";
import { AttachmentVideo } from "./AttachmentVideo";
import { HtmlPreview } from "./HtmlPreview";
import type { AttachmentProps } from "./model";
import styles from "./styles.scss";

const componentsByAttachmentType: Record<AttachmentType, ((props: AttachmentProps) => ComponentChildren) | null> = {
  "image": AttachmentImage,
  "svg": AttachmentImage,
  "json": AttachmentCode,
  "code": AttachmentCode,
  "uri": AttachmentCode,
  "css": AttachmentCode,
  "table": AttachmentCode,
  "html": AttachmentCode,
  "text": AttachmentCode,
  "video": AttachmentVideo,
  "image-diff": AttachmentImageDiff,
  "archive": null,
};

const previewComponentsByAttachmentType: Record<string, any> = {
  html: HtmlPreview,
};

export interface AttachmentTestStepResultProps {
  item: AttachmentTestStepResult;
  previewable?: boolean;
}

export const Attachment = (props: AttachmentTestStepResultProps) => {
  const { item, previewable } = props;
  const {
    link: { contentType, id, ext },
  } = item;
  const attachment = useSignal<AttachmentData | null>(null);
  const isLoading = useSignal<boolean>(true);
  const isError = useSignal<boolean>(false);
  const componentType = attachmentType(contentType);

  const fetchData = useCallback(async () => {
    isLoading.value = true;
    isError.value = false;
    try {
      const result = await fetchAttachment(id, ext, contentType);
      batch(() => {
        isLoading.value = false;
        attachment.value = result;
      });
    } catch (error) {
      batch(() => {
        isLoading.value = false;
        isError.value = true;
      });
    }
  }, [id, ext, contentType, isLoading, attachment, isError]);

  useEffect(() => {
    if (!componentType) {
      return;
    }

    fetchData();
  }, [componentType, fetchData]);

  if (!componentType) {
    return null;
  }

  if (isLoading.value) {
    return (
      <div className={styles["test-result-spinner"]}>
        <Spinner />
      </div>
    );
  }

  if (isError.value) {
    return (
      <EmptyView description="Failed to load attachment" size="xs">
        <IconButton style="flat" icon={allureIcons.lineArrowsRefreshCcw1} onClick={fetchData} />
      </EmptyView>
    );
  }

  const CurrentPreviewComponent = previewComponentsByAttachmentType[componentType];

  // temp solution before modal component refactoring
  if (previewable && CurrentPreviewComponent) {
    return <CurrentPreviewComponent attachment={attachment.value} item={item} />;
  }

  const CurrentComponent = componentsByAttachmentType[componentType];

  if (!CurrentComponent) {
    return null;
  }

  return <CurrentComponent attachment={attachment.value} item={item} />;
};
