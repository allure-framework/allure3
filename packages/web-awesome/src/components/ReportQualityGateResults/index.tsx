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
              <li key={result.rule} data-testid="report-quality-gate-result">
                <div className={styles["report-quality-gate-result"]}>
                  <SvgIcon id={allureIcons.solidXCircle} className={styles["report-quality-gate-result-icon"]} />
                  <div className={styles["report-quality-gate-result-content"]}>
                    <Text tag="p" size="l" type="ui" bold data-testid="report-quality-gate-result-rule">
                      {result.rule}
                    </Text>
                    <TrError
                      className={styles["report-quality-gate-result-error"]}
                      message={result.message}
                      data-testid="report-quality-gate-result-message"
                    />
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
