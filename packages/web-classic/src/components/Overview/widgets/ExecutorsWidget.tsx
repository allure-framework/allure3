import { sanitizeExternalUrl } from "@allurereport/core-api";
import type { ReportExecutorInfo } from "@allurereport/plugin-api";
import { Text, Widget } from "@allurereport/web-components/core";
import type { ComponentChildren } from "preact";

import { useI18n } from "@/stores/locale";

import * as styles from "../Overview.module.scss";

const ExternalLink = ({ href, children }: { href?: string; children: ComponentChildren }) => {
  const safeHref = sanitizeExternalUrl(href);

  if (!safeHref) {
    return <>{children}</>;
  }

  return (
    <a href={safeHref} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
};

export const ExecutorsWidget = ({ executor }: { executor?: ReportExecutorInfo }) => {
  const { t } = useI18n("overview");
  const name = executor?.name || executor?.type;
  const build = executor?.buildName || (executor?.buildOrder !== undefined ? `#${executor.buildOrder}` : undefined);

  return (
    <div className={styles["overview-widget"]} data-testid="overview-executors">
      <Widget title={t("executors")}>
        {!executor || (!name && !build && !executor.reportName) ? (
          <Text className={styles["overview-empty"]}>{t("noExecutors")}</Text>
        ) : (
          <div className={styles["overview-executor"]}>
            {name && (
              <Text type="ui" size="m" bold>
                <ExternalLink href={executor.url}>{name}</ExternalLink>
              </Text>
            )}
            {build && (
              <Text type="ui" size="m">
                {t("build")}: <ExternalLink href={executor.buildUrl}>{build}</ExternalLink>
              </Text>
            )}
            {executor.reportName && (
              <Text type="ui" size="m">
                <ExternalLink href={executor.reportUrl}>{executor.reportName}</ExternalLink>
              </Text>
            )}
          </div>
        )}
      </Widget>
    </div>
  );
};
