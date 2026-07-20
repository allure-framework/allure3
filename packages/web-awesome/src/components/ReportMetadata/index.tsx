import type { EnvironmentItem } from "@allurereport/core-api";
import { getReportOptions } from "@allurereport/web-commons";
import { Button, Loadable } from "@allurereport/web-components";
import type { FunctionalComponent } from "preact";
import { useEffect } from "preact/hooks";
import type { AwesomeExecutorInfo, AwesomeReportOptions } from "types";

import { MetadataList } from "@/components/Metadata";
import { MetadataButton } from "@/components/MetadataButton";
import { MetadataSummary } from "@/components/ReportMetadata/MetadataSummary";
import { reportStatsStore, statsByEnvStore, useI18n } from "@/stores";
import { currentEnvironment } from "@/stores/env";
import { envInfoStore } from "@/stores/envInfo";
import { getReportEnvSectionId } from "@/stores/reportEnvSections";
import { collapsedTrees, toggleTree } from "@/stores/tree";
import { fetchVariables, variables } from "@/stores/variables";

import * as styles from "./styles.scss";

const REPORT_VISIBLE_LIMIT = 8;

export interface MetadataItem extends EnvironmentItem {
  value?: string;
  url?: string;
}

// TODO: check, where do we use the component and refactor it up to our needs
export type MetadataProps = {
  envInfo?: MetadataItem[];
  size?: "s" | "m";
  groupedLabels?: Record<string, string[]>;
};

export type MetadataVariablesProps = {
  variables?: Record<string, any>;
  size?: "s" | "m";
  groupedLabels?: Record<string, string[]>;
};

const Metadata: FunctionalComponent<MetadataProps> = ({ envInfo = [] }) => {
  const sectionId = getReportEnvSectionId("metadata");
  const showAllId = `${sectionId}-showAll`;
  const isOpened = !collapsedTrees.value.has(sectionId);
  const showAll = collapsedTrees.value.has(showAllId);
  const list = envInfo.map((env) => ({ ...env, value: env.value ?? env.values.join(", ") }));
  const totalCount = list.length;
  const visibleList = totalCount <= REPORT_VISIBLE_LIMIT ? list : showAll ? list : list.slice(0, REPORT_VISIBLE_LIMIT);
  const { t } = useI18n("ui");

  return (
    <div class={styles["report-metadata"]}>
      <MetadataButton
        isOpened={isOpened}
        setIsOpen={() => toggleTree(sectionId)}
        title={t("metadata")}
        counter={envInfo.length}
      />
      {isOpened && (
        <>
          <MetadataList envInfo={visibleList} />
          {totalCount > REPORT_VISIBLE_LIMIT && (
            <Button
              style="ghost"
              size="s"
              text={showAll ? t("showLess") : t("showMore")}
              onClick={() => toggleTree(showAllId)}
            />
          )}
        </>
      )}
    </div>
  );
};

const MetadataVariables: FunctionalComponent<MetadataVariablesProps> = (props) => {
  const { t } = useI18n("ui");
  const sectionId = getReportEnvSectionId("variables");
  const showAllId = `${sectionId}-showAll`;
  const isOpened = !collapsedTrees.value.has(sectionId);
  const showAll = collapsedTrees.value.has(showAllId);
  const fullList = Object.entries(props.variables).map(([key, value]) => ({
    name: key,
    value,
  })) as MetadataItem[];
  const totalCount = fullList.length;
  const visibleList =
    totalCount <= REPORT_VISIBLE_LIMIT ? fullList : showAll ? fullList : fullList.slice(0, REPORT_VISIBLE_LIMIT);

  return (
    <div class={styles["report-metadata"]} data-testid={"report-variables"}>
      <MetadataButton
        isOpened={isOpened}
        setIsOpen={() => toggleTree(sectionId)}
        title={t("variables")}
        counter={Object.keys(props.variables).length}
        data-testid={"report-variables-button"}
      />
      {isOpened && (
        <>
          <MetadataList envInfo={visibleList} />
          {totalCount > REPORT_VISIBLE_LIMIT && (
            <Button
              style="ghost"
              size="s"
              text={showAll ? t("showLess") : t("showMore")}
              onClick={() => toggleTree(showAllId)}
            />
          )}
        </>
      )}
    </div>
  );
};

const getExecutorLabel = (executor?: AwesomeExecutorInfo) => {
  if (!executor) return undefined;
  if (executor.name && executor.buildName) return `${executor.name} · ${executor.buildName}`;

  return (
    executor.buildName ||
    executor.reportName ||
    executor.name ||
    executor.buildUrl ||
    executor.reportUrl ||
    executor.url
  );
};

const getExecutorMetadata = (executor?: AwesomeExecutorInfo): MetadataItem[] => {
  const label = getExecutorLabel(executor);

  return label
    ? [{ name: "executor", values: [], value: label, url: executor?.buildUrl || executor?.reportUrl || executor?.url }]
    : [];
};

export const ReportMetadata = () => {
  const envId = currentEnvironment.value;
  const { executor } = getReportOptions<AwesomeReportOptions>();
  const executorMetadata = getExecutorMetadata(executor);
  const stats = envId ? statsByEnvStore.value.data[envId] : reportStatsStore.value.data;

  useEffect(() => {
    fetchVariables(envId);
  }, [envId]);

  return (
    <div className={styles["report-metadata-wrapper"]}>
      {stats && <MetadataSummary stats={stats} />}
      <Loadable
        source={variables}
        transformData={(data) => data?.[envId ?? "default"] ?? {}}
        renderData={(data) => !!Object.keys(data).length && <MetadataVariables variables={data} />}
      />
      <Loadable
        source={envInfoStore}
        renderError={() => Boolean(executorMetadata.length) && <Metadata envInfo={executorMetadata} />}
        renderData={(data) => {
          const metadata = [...executorMetadata, ...(data ?? [])];

          return Boolean(metadata.length) && <Metadata envInfo={metadata} />;
        }}
      />
    </div>
  );
};
