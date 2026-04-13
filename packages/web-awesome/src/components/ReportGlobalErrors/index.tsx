import { DEFAULT_ENVIRONMENT } from "@allurereport/core-api";
import type { PluginGlobalError } from "@allurereport/plugin-api";
import { Loadable } from "@allurereport/web-components";
import { useState } from "preact/hooks";

import { MetadataButton } from "@/components/MetadataButton";
import { TrError } from "@/components/TestResult/TrError";
import { useI18n } from "@/stores";
import { currentEnvironment, environmentNameById } from "@/stores/env";
import { globalsStore } from "@/stores/globals";

import * as styles from "./styles.scss";

export const ReportGlobalErrors = () => {
  const { t } = useI18n("empty");
  const { t: tEnvironments } = useI18n("environments");
  const [collapsedEnvs, setCollapsedEnvs] = useState<string[]>([]);

  const renderErrors = (errors: PluginGlobalError[]) => (
    <ul className={styles["report-global-errors"]}>
      {errors.map((error, i) => (
        <li key={i} className={styles["report-global-errors-item"]}>
          <TrError {...error} />
        </li>
      ))}
    </ul>
  );

  const renderErrorsContent = (errors: PluginGlobalError[]) => (
    <div className={styles["report-global-errors-container"]}>{renderErrors(errors)}</div>
  );

  return (
    <Loadable
      source={globalsStore}
      renderData={({ errors = [], errorsByEnv = {} }) => {
        if (currentEnvironment.value) {
          const currentEnvErrors = errorsByEnv[currentEnvironment.value] ?? [];

          if (!currentEnvErrors.length) {
            return <div className={styles["report-global-errors-empty"]}>{t("no-global-errors-results")}</div>;
          }

          return renderErrorsContent(currentEnvErrors);
        }

        const entries = Object.entries(errorsByEnv).filter(([, envErrors]) => envErrors.length > 0);

        if (!entries.length && !errors.length) {
          return <div className={styles["report-global-errors-empty"]}>{t("no-global-errors-results")}</div>;
        }

        if (!entries.length) {
          return renderErrorsContent(errors);
        }

        if (entries.length === 1 && entries[0][0] === DEFAULT_ENVIRONMENT) {
          return renderErrorsContent(entries[0][1] ?? []);
        }

        if (!errors.length) {
          return <div className={styles["report-global-errors-empty"]}>{t("no-global-errors-results")}</div>;
        }

        return (
          <div className={styles["report-global-errors-container"]}>
            {entries.map(([environmentId, envErrors]) => {
              const isOpened = !collapsedEnvs.includes(environmentId);
              const toggleEnv = () => {
                setCollapsedEnvs((prev) =>
                  isOpened ? prev.concat(environmentId) : prev.filter((currentId) => currentId !== environmentId),
                );
              };

              return (
                <div key={environmentId} className={styles["report-global-errors-section"]}>
                  <MetadataButton
                    isOpened={isOpened}
                    setIsOpen={toggleEnv}
                    title={`${tEnvironments("environment", { count: 1 })}: "${environmentNameById(environmentId)}"`}
                    titleTooltipText={environmentNameById(environmentId)}
                    truncateTitle
                    counter={envErrors.length}
                  />
                  {isOpened ? renderErrors(envErrors) : null}
                </div>
              );
            })}
          </div>
        );
      }}
    />
  );
};
