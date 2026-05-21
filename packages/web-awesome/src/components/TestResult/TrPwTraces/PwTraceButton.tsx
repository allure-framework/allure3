import type { AttachmentTestStepResult } from "@allurereport/core-api";
import { downloadAttachment, reportDataUrl } from "@allurereport/web-commons";
import { Button, ButtonLink, IconButton, Text, TooltipWrapper, allureIcons } from "@allurereport/web-components";

import { openPlaywrightTraceInNewTab } from "@/components/TestResult/TrPwTraces/openPwTraceInNewTab";
import { useI18n } from "@/stores";
import { closeModal, openModal } from "@/stores/modal";

import * as styles from "./styles.scss";

const PLAYWRIGHT_TRACE_VIEWER_URL = "https://trace.playwright.dev/";

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

const PwTraceUnsupported = ({ link, t }: { link: AttachmentTestStepResult["link"]; t: (key: string) => string }) => (
  <div className={styles["pw-trace-unsupported"]} data-testid={"pw-trace-unsupported"}>
    <Text>{t("pwTraceUnsupported")}</Text>
    <Text>{t("pwTraceUnsupportedHint")}</Text>
    <div className={styles["pw-trace-unsupported-actions"]}>
      <Button
        style={"flat"}
        size={"s"}
        text={t("downloadPwTrace")}
        icon={allureIcons.lineGeneralDownloadCloud}
        onClick={() => downloadAttachment(link.id, link.ext, link.contentType)}
      />
      <ButtonLink
        style={"flat"}
        size={"s"}
        text={t("openPwTraceViewer")}
        href={PLAYWRIGHT_TRACE_VIEWER_URL}
        target={"_blank"}
      />
    </div>
  </div>
);

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
          size: "content",
          component: <PwTraceUnsupported link={link} t={t} />,
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
