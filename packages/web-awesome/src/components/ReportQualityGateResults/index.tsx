import { DEFAULT_ENVIRONMENT } from "@allurereport/core-api";
import type { QualityGateValidationResult } from "@allurereport/plugin-api";
import { Loadable, SvgIcon, Text, allureIcons } from "@allurereport/web-components";
import { useState } from "preact/hooks";
import { MetadataButton } from "@/components/MetadataButton";
import { TrError } from "@/components/TestResult/TrError";
import { useI18n } from "@/stores";
import { currentEnvironment } from "@/stores/env";
import { qualityGateStore } from "@/stores/qualityGate";
import * as styles from "./styles.scss";

const QualityGateResultsList = ({ results }: { results: QualityGateValidationResult[] }) => (
  <ul className={styles["report-quality-gate-results-list"]} data-testid={"quality-gate-results-section-env-content"}>
    {results.map((result) => (
      <li key={result.rule} data-testid="quality-gate-result">
        <div className={styles["report-quality-gate-result"]}>
          <SvgIcon id={allureIcons.solidXCircle} className={styles["report-quality-gate-result-icon"]} />
          <div className={styles["report-quality-gate-result-content"]}>
            <Text tag="p" size="l" type="ui" bold data-testid="quality-gate-result-rule">
              {result.rule}
            </Text>
            <TrError
              className={styles["report-quality-gate-result-error"]}
              message={result.message}
              data-testid="quality-gate-result-message"
            />
          </div>
        </div>
      </li>
    ))}
  </ul>
);

export const ReportQualityGateResults = () => {
  const { t } = useI18n("empty");
  const { t: tEnvironments } = useI18n("environments");
  const [collapsedEnvs, setCollapsedEnvs] = useState<string[]>([]);

  return (
    <Loadable
      source={qualityGateStore}
      renderData={(results) => {
        if (currentEnvironment.value) {
          const currentEnvResults = results[currentEnvironment.value] ?? [];

          if (!currentEnvResults.length) {
            return <div className={styles["report-quality-gate-results-empty"]}>{t("no-quality-gate-results")}</div>;
          }

          return <QualityGateResultsList results={currentEnvResults} />;
        }

        const entries = Object.entries(results).filter(([, envResults]) => envResults.length > 0);

        if (!entries.length) {
          return <div className={styles["report-quality-gate-results-empty"]}>{t("no-quality-gate-results")}</div>;
        }

        // single default environment
        if (entries.length === 1 && entries[0][0] === DEFAULT_ENVIRONMENT) {
          const currentEnvResults = entries[0][1] ?? [];

          if (!currentEnvResults.length) {
            return <div className={styles["report-quality-gate-results-empty"]}>{t("no-quality-gate-results")}</div>;
          }

          return <QualityGateResultsList results={currentEnvResults} />;
        }

        return (
          <div className={styles["report-quality-gate-results"]}>
            {entries.map(([env, envResults]) => {
              const isOpened = !collapsedEnvs.includes(env);
              const toggleEnv = () => {
                setCollapsedEnvs((prev) => (isOpened ? prev.concat(env) : prev.filter((e) => e !== env)));
              };

              return (
                <div
                  key={env}
                  className={styles["report-quality-gate-section"]}
                  data-testid={"quality-gate-results-section"}
                >
                  <MetadataButton
                    isOpened={isOpened}
                    setIsOpen={toggleEnv}
                    title={`${tEnvironments("environment", { count: 1 })}: "${env}"`}
                    counter={envResults.length}
                    data-testid={"quality-gate-results-section-env-button"}
                  />
                  {isOpened && <QualityGateResultsList results={envResults} />}
                </div>
              );
            })}
          </div>
        );
      }}
    />
  );
};
