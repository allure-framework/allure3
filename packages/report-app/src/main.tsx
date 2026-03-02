import "@allurereport/web-components/dist/index.css";
import "@allurereport/web-awesome/styles";
import { render } from "preact";
import { LaunchesPage } from "./pages/LaunchesPage";

/**
 * Report is served as report.html by nginx when using ./scripts/restart-all.sh --nginx.
 * In Vite dev (without nginx), /report shows a hint to use --nginx.
 */
const pathname = typeof window !== "undefined" ? window.location.pathname : "";
const isReport = pathname === "/report" || pathname.startsWith("/report/");

function Root() {
  if (isReport) {
    return (
      <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
        <p>Report requires nginx mode. Run: <code>./scripts/restart-all.sh --nginx</code></p>
        <p><a href="/">Back to Launches</a></p>
      </div>
    );
  }
  return <LaunchesPage />;
}

const root = document.getElementById("app");
if (root) {
  render(<Root />, root);
}
