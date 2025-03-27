import "@allurereport/web-components/index.css";
import { render } from "preact";
import "@/assets/scss/index.scss";
import { ReportCard } from "@/components/ReportCard";
import * as styles from "./styles.scss";

const App = () => {
  const summaries = window.reportSummaries;

  if (!summaries) {
    return <div>no reports found</div>;
  }

  return (
    <ul class={styles["summary-showcase"]}>
      {summaries.map((summary: any) => {
        return (
          <li key={summary.output}>
            <ReportCard
              href={summary.output}
              name={summary.name}
              status={summary.status}
              stats={summary.stats}
              duration={summary.duration}
            />
          </li>
        );
      })}
    </ul>
  );
};

const rootElement = document.getElementById("app");

render(<App />, rootElement);
