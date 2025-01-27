import { ensureReportDataReady } from "@allurereport/web-commons";
import { useEffect } from "preact/compat";
import SideNav from "@/components/SideNav/SideNav";
import { fetchStats, getLocale, getTheme } from "@/stores";
import { fetchPieChartData } from "@/stores/chart";
import { fetchEnvInfo } from "@/stores/envInfo";
import { fetchTreeData } from "@/stores/tree";
import * as styles from "./styles.scss";

export const BaseLayout = ({ children }) => {
  useEffect(() => {
    getTheme();
    getLocale();
  }, []);

  useEffect(() => {
    // if (testResultId) {
    //   fetchTestResult(testResultId);
    //   fetchTestResultNav();
    // } else {
    ensureReportDataReady();
    fetchStats();
    // fetchPieChartData();
    fetchTreeData();
    // fetchEnvInfo();
    // }
  }, []);

  return (
    <div className={styles.layout}>
      <SideNav />
      {children}
    </div>
  );
};
