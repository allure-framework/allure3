import { ansiToHTML } from "@allurereport/web-commons";
import { Loadable, SvgIcon, Text, allureIcons } from "@allurereport/web-components";
import { TrError } from "@/components/TestResult/TrError";
import { useI18n } from "@/stores";
import { qualityGateStore } from "@/stores/qualityGate";
import * as styles from "./styles.scss";

export const ReportQualityGateResults = () => {
  const { t } = useI18n("empty");

  return (
    <Loadable
      source={qualityGateStore}
      renderData={(results) => {
        if (!results.length) {
          return <div className={styles["report-quality-gate-results-empty"]}>{t("no-quality-gate-results")}</div>;
        }

        return (
          <ul className={styles["report-quality-gate-results"]}>
            {results.map((result) => (
              <li key={result.rule}>
                <div className={styles["report-quality-gate-result"]}>
                  <SvgIcon id={allureIcons.solidXCircle} className={styles["report-quality-gate-result-icon"]} />
                  <div className={styles["report-quality-gate-result-content"]}>
                    <Text tag="p" size="l" type="ui" bold>
                      {result.rule}
                    </Text>
                    <TrError className={styles["report-quality-gate-result-error"]} message={result.message} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        );
      }}
    />
  );
};
