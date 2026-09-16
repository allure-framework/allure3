import { DEFAULT_ENVIRONMENT } from "@allurereport/core-api";
import { Loadable, SvgIcon, Text, Tree, allureIcons } from "@allurereport/web-components";
import { useMemo, useState } from "preact/hooks";
import type { ReportQualityGateValidationResult, ReportTree, ReportTreeGroup } from "types";

import { MetadataButton } from "@/components/MetadataButton";
import { TrError } from "@/components/TestResult/TrError";
import { useI18n } from "@/stores";
import { currentEnvironment, environmentNameById, sharedEnvironmentId } from "@/stores/env";
import { qualityGateStore } from "@/stores/qualityGate";
import { navigateToTestResult } from "@/stores/router";
import { currentTrId } from "@/stores/testResult";
import { globalEntriesByEnv } from "@/utils/globals";
import { createTreeLocalizer } from "@/utils/tree";
import { createRecursiveTree } from "@/utils/treeFilters";

import * as styles from "./styles.scss";

const emptyTreeState = new Set<string>();

const QualityGateTestResultsTree = ({ tree }: { tree: ReportTree }) => {
  const { t } = useI18n("ui");
  const { t: tooltip } = useI18n("transitions");
  const [openedTrees, setOpenedTrees] = useState(new Set<string>());
  const recursiveTree = useMemo(
    () =>
      createRecursiveTree({
        group: tree.root as ReportTreeGroup,
        groupsById: tree.groupsById,
        leavesById: tree.leavesById,
        filterPredicate: () => true,
        sortBy: "order,asc",
      }),
    [tree],
  );
  const localizedTree = useMemo(
    () =>
      createTreeLocalizer({
        tooltip: (key: string, options?: Record<string, unknown>) =>
          tooltip(`description.${key}`, options as Record<string, string>),
      })(recursiveTree),
    [recursiveTree, tooltip],
  );
  const toggleTree = (id: string) => {
    setOpenedTrees((current) => {
      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  };

  if (recursiveTree.statistic.total === 0) {
    return null;
  }

  return (
    <div className={styles["report-quality-gate-result-test-results"]}>
      <div
        className={styles["report-quality-gate-result-test-results-tree"]}
        data-testid="quality-gate-result-test-results-title"
      >
        <Tree
          name={t("relatedTestResults", { count: recursiveTree.statistic.total })}
          tree={localizedTree}
          statistic={recursiveTree.statistic}
          reportStatistic={recursiveTree.statistic}
          collapsedTrees={emptyTreeState}
          toggleTree={toggleTree}
          isGroupOpened={(id) => openedTrees.has(id)}
          navigateTo={(testResultId) => navigateToTestResult({ testResultId })}
          routeId={currentTrId.value}
          root
        />
      </div>
    </div>
  );
};

const QualityGateResultsList = ({ results }: { results: ReportQualityGateValidationResult[] }) => {
  return (
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
              {result.testResultsTree && <QualityGateTestResultsTree tree={result.testResultsTree} />}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
};

export const ReportQualityGateResults = () => {
  const { t } = useI18n("empty");
  const { t: tEnvironments } = useI18n("environments");
  const [collapsedEnvs, setCollapsedEnvs] = useState<string[]>([]);

  return (
    <Loadable
      source={qualityGateStore}
      renderData={(results) => {
        // results dispatched without an environment are indexed under the shared bucket, so they
        // stay visible while a single environment is selected, next to the results of that one
        const entries = globalEntriesByEnv([], results, currentEnvironment.value, sharedEnvironmentId.value);

        if (!entries.length) {
          return <div className={styles["report-quality-gate-results-empty"]}>{t("no-quality-gate-results")}</div>;
        }

        // the "All" view of a report where nothing is environment specific: there is nothing to tell
        // apart, render a plain list. While a single environment is selected the section headers
        // stay, they tell the shared bucket apart from the results of that environment
        if (!currentEnvironment.value && entries.length === 1 && entries[0][0] === DEFAULT_ENVIRONMENT) {
          return <QualityGateResultsList results={entries[0][1]} />;
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
                    title={`${tEnvironments("environment", { count: 1 })}: "${environmentNameById(env)}"`}
                    titleTooltipText={environmentNameById(env)}
                    truncateTitle
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
