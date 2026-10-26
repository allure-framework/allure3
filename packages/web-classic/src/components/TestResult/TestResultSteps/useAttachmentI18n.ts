import { useI18n } from "@/stores/locale";

/**
 * Translations the shared `Attachment` renderer expects: viewer controls and image diff labels.
 */
export const useAttachmentI18n = () => {
  const { t: controls } = useI18n("controls");
  const { t: attachments } = useI18n("attachments");

  return {
    controls,
    imageDiff: (key: string) => attachments(`imageDiff.${key}`),
  };
};
