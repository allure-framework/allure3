import { LANG_LOCALE } from "@allurereport/web-commons";
import { ReportSummaryCard } from "@allurereport/web-components";
import "@allurereport/web-components/index.css";
import { computed } from "@preact/signals";
import { render } from "preact";
import { useEffect, useState } from "preact/hooks";
import "@/assets/scss/index.scss";
import { EmptyPlaceholder } from "@/components/EmptyPlaceholder";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { currentLocale, getLocale, getTheme, useI18n, waitForI18next } from "@/stores";
import * as styles from "./styles.scss";

export const currentLocaleIso = computed(() => LANG_LOCALE[currentLocale.value]?.iso ?? LANG_LOCALE.en.iso);

const App = () => {
  const [loaded, setLoaded] = useState(false);
  const summaries = window.reportSummaries;
  const { t: tEmpty } = useI18n("empty");
  const { t: tSummary } = useI18n("summary");

  useEffect(() => {
    getLocale();
    getTheme();
    waitForI18next.then(() => {
      setLoaded(true);
    });
  }, []);

  if (!loaded) {
    return null;
  }

  return (
    <div className={styles.container}>
      <Header />
      <main>
        {!summaries.length && <EmptyPlaceholder label={tEmpty("no-reports")} />}
        {!!summaries.length && (
          <ul className={styles["summary-showcase"]}>
            {summaries.map((summary: any) => {
              return (
                <li key={summary.output}>
                  <ReportSummaryCard
                    localeIso={currentLocaleIso.value}
                    locales={{
                      failed: tSummary("failed"),
                      broken: tSummary("broken"),
                      passed: tSummary("passed"),
                      skipped: tSummary("skipped"),
                      unknown: tSummary("unknown"),
                      in: tSummary("in"),
                      new: tSummary("new"),
                      retry: tSummary("retry"),
                      flaky: tSummary("flaky"),
                      total: tSummary("total"),
                    }}
                    {...summary}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </main>
      <Footer className={styles.footer} />
    </div>
  );
};

const rootElement = document.getElementById("app");

render(<App />, rootElement);
