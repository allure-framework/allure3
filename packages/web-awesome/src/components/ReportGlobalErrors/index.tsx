import type { EnvironmentItem, TestError } from "@allurereport/core-api";
import { Loadable } from "@allurereport/web-components";
import { TrError } from "@/components/TestResult/TrError";
import { reportStatsStore, statsByEnvStore, useI18n } from "@/stores";
import { globalsStore } from "@/stores/globals";
import { fetchVariables, variables } from "@/stores/variables";
import * as styles from "./styles.scss";

export const ReportGlobalErrors = () => {
  const { t } = useI18n("ui");

  return (
    <Loadable
      source={globalsStore}
      renderData={({ errors }) => (
        <ul className={styles["report-global-errors"]}>
          {errors.map((error, i) => (
            <li key={i} style={{ marginBottom: "8px" }}>
              <TrError {...error} />
            </li>
          ))}
        </ul>
      )}
    />
  );
};
