import type { AttachmentTestStepResult } from "@allurereport/core-api";
import { attachmentType, fetchAttachment } from "@allurereport/web-commons";
import type { Attachments } from "@allurereport/web-commons/";
import type { FunctionalComponent } from "preact";
import { useEffect, useState } from "preact/hooks";
import { AttachmentCode } from "@/components/Attachment/AttachmentCode";
import { AttachmentImage } from "@/components/Attachment/AttachmentImage";
import { AttachmentVideo } from "@/components/Attachment/AttachmentVideo";
import { HtmlPreview } from "@/components/Attachment/HtmlPreview";
import { Spinner } from "@/components/Spinner";
import * as styles from "./styles.scss";

const componentsByAttachmentType: Record<string, any> = {
  image: AttachmentImage,
  svg: AttachmentImage,
  json: AttachmentCode,
  code: AttachmentCode,
  uri: AttachmentCode,
  css: AttachmentCode,
  table: AttachmentCode,
  html: AttachmentCode,
  text: AttachmentCode,
  video: AttachmentVideo,
};

const previewComponentsByAttachmentType: Record<string, any> = {
  html: HtmlPreview,
};

export interface AttachmentTestStepResultProps {
  item: AttachmentTestStepResult;
  previewable?: boolean;
}

export const Attachment: FunctionalComponent<AttachmentTestStepResultProps> = ({ item, previewable }) => {
  const {
    link: { contentType, id, ext },
  } = item;
  const [attachment, setAttachment] = useState<Attachments | null>(null);
  const [loaded, setLoaded] = useState(false);
  const attachmentComponent = attachmentType(contentType as string);
  const CurrentComponent = componentsByAttachmentType[attachmentComponent.type as string];
  const CurrentPreviewComponent = previewComponentsByAttachmentType[attachmentComponent.type as string];

  useEffect(() => {
    const fetchData = async () => {
      const result = (await fetchAttachment(id, ext, contentType as string)) || null;
      setLoaded(true);
      setAttachment(result);
    };
    fetchData();
  }, [contentType, id, ext]);

  if (!loaded) {
    return (
      <div className={styles["test-result-spinner"]}>
        <Spinner />
      </div>
    );
  }

  // temp solution before modal component refactoring
  if (CurrentPreviewComponent && previewable) {
    return <CurrentPreviewComponent attachment={attachment} item={item} />;
  }

  return CurrentComponent ? <CurrentComponent attachment={attachment} item={item} /> : <></>;
};
