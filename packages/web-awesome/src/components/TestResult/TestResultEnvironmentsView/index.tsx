import type { TestEnvGroup } from "@allurereport/core-api";
import { Loadable } from "@allurereport/web-components";
import type { FunctionalComponent } from "preact";
import type { AwesomeTestResult } from "types";
import { TestResultEnvironmentItem } from "@/components/TestResult/TestResultEnvironmentItem";
import { useI18n } from "@/stores";
import { currentEnvironment, testEnvGroupsStore } from "@/stores/env";
import { testResultStore } from "@/stores/testResults";
import * as styles from "./styles.scss";

export const TestResultEnvironmentsView: FunctionalComponent<{
  testResult: AwesomeTestResult;
}> = ({ testResult }) => {
  const { t } = useI18n("empty");

  return (
    <div className={styles["test-result-environments"]}>
      <Loadable<Record<string, TestEnvGroup>, TestEnvGroup | undefined>
        source={testEnvGroupsStore}
        renderData={(group) => {
          if (!group) {
            return <div className={styles["test-result-empty"]}>{t("no-environments-results")}</div>;
          }

          const envs = Object.entries(group.testResultsByEnv);

          return (
            <ul>
              {envs.map(([env, trId]) => {
                const tr = testResultStore.value.data[trId];

                return (
                  <li key={`${env}-${trId}`}>
                    <TestResultEnvironmentItem env={env} testResult={tr} current={currentEnvironment.value === env} />
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
