import type { AttachmentTestStepResult } from "@allurereport/core-api";
import { reportDataUrl } from "@allurereport/web-commons";
import { Button, IconButton, Text, TooltipWrapper, allureIcons } from "@allurereport/web-components";

import { openPlaywrightTraceInNewTab } from "@/components/TestResult/TrPwTraces/openPwTraceInNewTab";
import { useI18n } from "@/stores";
import { closeModal, openModal } from "@/stores/modal";

const PwTracePopupBlocked = ({ onRetry, t }: { onRetry: () => void; t: (key: string) => string }) => (
  <div data-testid={"pw-trace-popup-blocked"}>
    <Text>
      {t("pwTracePopupBlocked")}
      <br />
      {t("pwTracePopupBlockedHint")}
    </Text>
    <Button
      style={"flat"}
      size={"s"}
      text={t("retries")}
      onClick={() => {
        closeModal();
        onRetry();
      }}
    />
  </div>
);

const PwTraceUnsupported = ({ t }: { t: (key: string) => string }) => <Text>{t("pwTraceUnsupported")}</Text>;

export const PwTraceButton = ({ link }: Pick<AttachmentTestStepResult, "link">) => {
  const { t } = useI18n("ui");
  const traceTitle = `Playwright Trace Viewer | ${link.name}${link.ext}`;

  const openPw = async () => {
    // Use a top-level tab and the official trace URL parameter to avoid third-party blob/storage partitioning issues.
    // - https://bugzilla.mozilla.org/show_bug.cgi?id=1917842
    // - https://privacysandbox.google.com/cookies/storage-partitioning
    try {
      const traceUrl = await reportDataUrl(
        `data/attachments/${link.id || "-"}${link.ext || ""}?attachment`,
        link.contentType,
      );

      if (traceUrl.startsWith("data:")) {
        openModal({
          title: traceTitle,
          component: <PwTraceUnsupported t={t} />,
        });
        return;
      }

      const opened = openPlaywrightTraceInNewTab(traceUrl);

      if (!opened) {
        openModal({
          title: traceTitle,
          component: <PwTracePopupBlocked onRetry={openPw} t={t} />,
        });
      }
    } catch {
      openModal({
        title: traceTitle,
        component: <Text>Failed to load Playwright trace attachment.</Text>,
      });
    }
  };

  return (
    <TooltipWrapper tooltipText={t("openPwTrace")}>
      <IconButton
        aria-label={t("openPwTrace")}
        icon={allureIcons.lineArrowsExpand3}
        size={"s"}
        style={"ghost"}
        onClick={openPw}
      />
    </TooltipWrapper>
  );
};
