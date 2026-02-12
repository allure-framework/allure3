import { ReportSummaryCard } from "@allurereport/web-components";
import "@allurereport/web-components/index.css";
import { render } from "preact";
import "@/assets/scss/index.scss";
import { EmptyPlaceholder } from "@/components/EmptyPlaceholder";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { getLocale, useI18n, waitForI18next } from "@/stores";
import * as styles from "./styles.scss";

const getSummaries = () => {
  return window.reportSummaries as Record<string, any>[] | undefined;
};

const App = () => {
  const summaries = getSummaries();
  const { t: tEmpty } = useI18n("empty");
  const { t: tSummary } = useI18n("summary");

  if (!summaries) {
    return (
      <div className={styles.container}>
        <Header />
        <main>
          <EmptyPlaceholder label={tEmpty("no-reports")} />
        </main>
        <Footer className={styles.footer} />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Header />
      <main>
        <div className={styles["summary-showcase"]}>
          {summaries.map((summary: any) => (
            <ReportSummaryCard key={summary.output} i18n={tSummary} summary={summary} />
          ))}
        </div>
      </main>
      <Footer className={styles.footer} />
    </div>
  );
};

const init = async () => {
  await getLocale();
  await waitForI18next;

  render(<App />, document.getElementById("app")!);
};

init();
