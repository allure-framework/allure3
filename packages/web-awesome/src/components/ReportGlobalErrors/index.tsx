import { Loadable } from "@allurereport/web-components";
import { TrError } from "@/components/TestResult/TrError";
import { useI18n } from "@/stores";
import { globalsStore } from "@/stores/globals";
import * as styles from "./styles.scss";

export const ReportGlobalErrors = () => {
  const { t } = useI18n("empty");

  return (
    <Loadable
      source={globalsStore}
      renderData={({ errors }) => {
        if (!errors.length) {
          return <div className={styles["report-global-errors-empty"]}>{t("no-global-errors-results")}</div>;
        }

        return (
          <ul className={styles["report-global-errors"]}>
            {errors.map((error, i) => (
              <li key={i} style={{ marginBottom: "8px" }}>
                <TrError {...error} />
              </li>
            ))}
          </ul>
        );
      }}
    />
  );
};
