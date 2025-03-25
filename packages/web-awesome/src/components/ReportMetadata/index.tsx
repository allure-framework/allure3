import type { EnvironmentItem } from "@allurereport/core-api";
import { Loadable } from "@allurereport/web-components";
import type { FunctionalComponent } from "preact";
import { useEffect, useState } from "preact/hooks";
import { MetadataList } from "@/components/Metadata";
import { MetadataButton } from "@/components/MetadataButton";
import { MetadataSummary } from "@/components/ReportMetadata/MetadataSummary";
import { reportStatsStore, statsByEnvStore, useI18n } from "@/stores";
import { currentEnvironment } from "@/stores/env";
import { envInfoStore } from "@/stores/envInfo";
import { fetchVariables, variables } from "@/stores/variables";
import * as styles from "./styles.scss";

export interface MetadataItem extends EnvironmentItem {
  value?: string;
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
  const [isOpened, setIsOpen] = useState(true);
  const convertedEnvInfo = envInfo.map((env) => {
    return { ...env, value: env.values.join(", ") };
  });

  return (
    <div class={styles["report-metadata"]}>
      <MetadataButton isOpened={isOpened} setIsOpen={setIsOpen} title={"Metadata"} counter={envInfo.length} />
      {isOpened && <MetadataList envInfo={convertedEnvInfo} />}
    </div>
  );
};

const MetadataVariables: FunctionalComponent<MetadataVariablesProps> = (props) => {
  const { t } = useI18n("ui");
  const [isOpened, setIsOpen] = useState(true);
  const convertedEnvInfo = Object.entries(props.variables).map(([key, value]) => {
    return {
      name: key,
      value,
    } as MetadataItem;
  });

  return (
    <div class={styles["report-metadata"]} data-testid={"report-variables"}>
      <MetadataButton
        isOpened={isOpened}
        setIsOpen={setIsOpen}
        title={t("variables")}
        counter={Object.keys(props.variables).length}
        data-testid={"report-variables-button"}
      />
      {isOpened && <MetadataList envInfo={convertedEnvInfo} />}
    </div>
  );
};

export const ReportMetadata = () => {
  const stats = currentEnvironment.value
    ? statsByEnvStore.value.data[currentEnvironment.value]
    : reportStatsStore.value.data;

  useEffect(() => {
    fetchVariables(currentEnvironment.value);
  }, [currentEnvironment.value]);

  return (
    <div className={styles["report-metadata-wrapper"]}>
      {stats && <MetadataSummary stats={stats} />}
      <Loadable
        source={variables}
        transformData={(data) => data?.[currentEnvironment.value ?? "default"] ?? {}}
        renderData={(data) => !!Object.keys(data).length && <MetadataVariables variables={data} />}
      />
      <Loadable
        source={envInfoStore}
        renderError={() => null}
        renderData={(data) => Boolean(data?.length) && <Metadata envInfo={data} />}
      />
    </div>
  );
};
