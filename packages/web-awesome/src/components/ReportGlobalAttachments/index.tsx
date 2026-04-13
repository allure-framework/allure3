import { DEFAULT_ENVIRONMENT, type AttachmentTestStepResult } from "@allurereport/core-api";
import type { PluginGlobalAttachment } from "@allurereport/plugin-api";
import { Loadable } from "@allurereport/web-components";
import { useState } from "preact/hooks";

import { MetadataButton } from "@/components/MetadataButton";
import { TrAttachment } from "@/components/TestResult/TrSteps/TrAttachment";
import { useI18n } from "@/stores";
import { currentEnvironment, environmentNameById } from "@/stores/env";
import { globalsStore } from "@/stores/globals";

import * as styles from "./styles.scss";

export const ReportGlobalAttachments = () => {
  const { t } = useI18n("empty");
  const { t: tEnvironments } = useI18n("environments");
  const [collapsedEnvs, setCollapsedEnvs] = useState<string[]>([]);

  const renderAttachmentList = (attachments: PluginGlobalAttachment[]) => {
    const attachmentSteps: AttachmentTestStepResult[] = attachments.map((attachment) => ({
      link: attachment,
      type: "attachment",
    }));

    return (
      <div className={styles["report-global-attachments-view"]}>
        {attachmentSteps.map((attachment, index) => (
          <TrAttachment
            item={attachment}
            key={attachment.link.id ?? `${attachment.link.name}-${index}`}
            stepIndex={index + 1}
          />
        ))}
      </div>
    );
  };

  const renderAttachmentsContent = (attachments: PluginGlobalAttachment[]) => (
    <div className={styles["report-global-attachments"]}>{renderAttachmentList(attachments)}</div>
  );

  return (
    <Loadable
      source={globalsStore}
      renderData={({ attachments = [], attachmentsByEnv = {} }) => {
        if (currentEnvironment.value) {
          const currentEnvAttachments = attachmentsByEnv[currentEnvironment.value] ?? [];

          if (!currentEnvAttachments.length) {
            return <div className={styles["report-global-attachments-empty"]}>{t("no-attachments-results")}</div>;
          }

          return renderAttachmentsContent(currentEnvAttachments);
        }

        const entries = Object.entries(attachmentsByEnv).filter(([, envAttachments]) => envAttachments.length > 0);

        if (!entries.length && !attachments.length) {
          return <div className={styles["report-global-attachments-empty"]}>{t("no-attachments-results")}</div>;
        }

        if (!entries.length) {
          return renderAttachmentsContent(attachments);
        }

        if (entries.length === 1 && entries[0][0] === DEFAULT_ENVIRONMENT) {
          return renderAttachmentsContent(entries[0][1] ?? []);
        }

        if (!attachments.length) {
          return <div className={styles["report-global-attachments-empty"]}>{t("no-attachments-results")}</div>;
        }

        return (
          <div className={styles["report-global-attachments"]}>
            {entries.map(([environmentId, envAttachments]) => {
              const isOpened = !collapsedEnvs.includes(environmentId);
              const toggleEnv = () => {
                setCollapsedEnvs((prev) =>
                  isOpened ? prev.concat(environmentId) : prev.filter((currentId) => currentId !== environmentId),
                );
              };

              return (
                <div key={environmentId} className={styles["report-global-attachments-section"]}>
                  <MetadataButton
                    isOpened={isOpened}
                    setIsOpen={toggleEnv}
                    title={`${tEnvironments("environment", { count: 1 })}: "${environmentNameById(environmentId)}"`}
                    titleTooltipText={environmentNameById(environmentId)}
                    truncateTitle
                    counter={envAttachments.length}
                  />
                  {isOpened ? renderAttachmentList(envAttachments) : null}
                </div>
              );
            })}
          </div>
        );
      }}
    />
  );
};
