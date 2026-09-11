import { DEFAULT_ENVIRONMENT, type AttachmentTestStepResult } from "@allurereport/core-api";
import type { PluginGlobalAttachment } from "@allurereport/plugin-api";
import { Loadable } from "@allurereport/web-components";
import { useState } from "preact/hooks";

import { MetadataButton } from "@/components/MetadataButton";
import { TrAttachment } from "@/components/TestResult/TrSteps/TrAttachment";
import { useI18n } from "@/stores";
import { currentEnvironment, environmentNameById } from "@/stores/env";
import { globalsStore } from "@/stores/globals";
import { globalEntriesByEnv } from "@/utils/globals";

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

  const renderAttachmentSections = (entries: Array<[string, PluginGlobalAttachment[]]>) => (
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

  return (
    <Loadable
      source={globalsStore}
      renderData={({ attachments = [], attachmentsByEnv = {} }) => {
        const entries = globalEntriesByEnv(attachments, attachmentsByEnv, currentEnvironment.value);

        if (!entries.length) {
          return <div className={styles["report-global-attachments-empty"]}>{t("no-attachments-results")}</div>;
        }

        // nothing is environment specific in the current view, no need to group by environment
        if (entries.length === 1 && entries[0][0] === DEFAULT_ENVIRONMENT) {
          return renderAttachmentsContent(entries[0][1]);
        }

        return renderAttachmentSections(entries);
      }}
    />
  );
};
