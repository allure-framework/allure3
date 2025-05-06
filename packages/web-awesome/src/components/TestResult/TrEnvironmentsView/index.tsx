import { type TestEnvGroup, getRealEnvsCount } from "@allurereport/core-api";
import { Loadable } from "@allurereport/web-components";
import type { FunctionalComponent } from "preact";
import { useEffect } from "preact/hooks";
import type { AwesomeTestResult } from "types";
import { TrEnvironmentItem } from "@/components/TestResult/TrEnvironmentItem";
import { useI18n } from "@/stores";
import { testEnvGroupsStore } from "@/stores/env";
import { fetchTestResult, testResultStore } from "@/stores/testResults";
import * as styles from "./styles.scss";

export const TrEnvironmentSection: FunctionalComponent<{
  env: string;
  activeTestResultId: string;
  testResultId: string;
}> = ({ env, activeTestResultId, testResultId }) => {
  useEffect(() => {
    fetchTestResult(testResultId);
  }, [testResultId]);

  return (
    <Loadable<Record<string, AwesomeTestResult>, AwesomeTestResult | undefined>
      source={testResultStore}
      transformData={(data) => data[testResultId]}
      renderData={(tr) =>
        tr && <TrEnvironmentItem env={env} testResult={tr} current={activeTestResultId === testResultId} />
      }
    />
  );
};

export const TrEnvironmentsView: FunctionalComponent<{
  testResult: AwesomeTestResult;
}> = ({ testResult }) => {
  const { t } = useI18n("empty");

  return (
    <div className={styles["test-result-environments"]}>
      <Loadable<Record<string, TestEnvGroup>, TestEnvGroup | undefined>
        source={testEnvGroupsStore}
        renderData={(group) => {
          if (!getRealEnvsCount(group)) {
            return <div className={styles["test-result-empty"]}>{t("no-environments-results")}</div>;
          }

          const envs = Object.entries(group.testResultsByEnv).sort(([a], [b]) => b.localeCompare(a));

          return (
            <ul>
              {envs.map(([env, trId]) => {
                return (
                  <li key={`${env}-${trId}`}>
                    <TrEnvironmentSection env={env} testResultId={trId} activeTestResultId={testResult.id} />
                  </li>
                );
              })}
            </ul>
          );
        }}
        transformData={(groups) => groups[testResult?.testCase?.id]}
      />
    </div>
  );
};
