import "@allurereport/web-components/index.css";
import { render } from "preact";
import { useEffect, useState } from "preact/hooks";
import "@/assets/scss/index.scss";
import { EmptyPlaceholder } from "@/components/EmptyPlaceholder";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { ReportCard } from "@/components/ReportCard";
import { getLocale, getTheme, useI18n, waitForI18next } from "@/stores";
import * as styles from "./styles.scss";

const App = () => {
  const [loaded, setLoaded] = useState(false);
  const summaries = window.reportSummaries;
  const { t } = useI18n("empty");

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
        {!summaries.length && <EmptyPlaceholder label={t("no-reports")} />}
        {!!summaries.length && (
          <ul className={styles["summary-showcase"]}>
            {summaries.map((summary: any) => {
              return (
                <li key={summary.output}>
                  <ReportCard {...summary} />
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
