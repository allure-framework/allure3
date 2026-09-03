import { DEFAULT_ENVIRONMENT } from "@allurereport/core-api";
import { Loadable, SvgIcon, Text, Tree, allureIcons } from "@allurereport/web-components";
import clsx from "clsx";
import { useMemo, useState } from "preact/hooks";
import type { AwesomeQualityGateValidationResult, AwesomeTree, AwesomeTreeGroup } from "types";

import { MetadataButton } from "@/components/MetadataButton";
import { TrError } from "@/components/TestResult/TrError";
import { useI18n } from "@/stores";
import { currentEnvironment, environmentNameById } from "@/stores/env";
import { qualityGateStore } from "@/stores/qualityGate";
import { navigateToTestResult } from "@/stores/router";
import { currentTrId } from "@/stores/testResult";
import { createTreeLocalizer } from "@/utils/tree";
import { createRecursiveTree } from "@/utils/treeFilters";

import * as styles from "./styles.scss";

const emptyTreeState = new Set<string>();

const QualityGateTestResultsTree = ({ tree }: { tree: AwesomeTree }) => {
  const { t } = useI18n("ui");
  const { t: tooltip } = useI18n("transitions");
  const [openedTrees, setOpenedTrees] = useState(new Set<string>());
  const recursiveTree = useMemo(
    () =>
      createRecursiveTree({
        group: tree.root as AwesomeTreeGroup,
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

const QualityGateResultsList = ({ results }: { results: AwesomeQualityGateValidationResult[] }) => {
  const { t } = useI18n("ui");

  return (
    <ul className={styles["report-quality-gate-results-list"]} data-testid={"quality-gate-results-section-env-content"}>
      {results.map((result) => (
        <li key={result.rule} data-testid="quality-gate-result" data-success={String(Boolean(result.success))}>
          <div className={styles["report-quality-gate-result"]}>
            <SvgIcon
              id={result.success ? allureIcons.solidCheckCircle : allureIcons.solidXCircle}
              className={clsx(
                styles["report-quality-gate-result-icon"],
                styles[
                  result.success ? "report-quality-gate-result-icon-passed" : "report-quality-gate-result-icon-failed"
                ],
              )}
              data-testid={result.success ? "quality-gate-result-passed-icon" : "quality-gate-result-failed-icon"}
            />
            <div className={styles["report-quality-gate-result-content"]}>
              <Text tag="p" size="l" type="ui" bold data-testid="quality-gate-result-rule">
                {result.rule}
              </Text>
              <TrError
                className={styles["report-quality-gate-result-error"]}
                message={result.message}
                status={result.success ? "passed" : "failed"}
                title={result.success ? t("success") : undefined}
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
