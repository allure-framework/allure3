import { Loadable } from "@/components/commons/Loadable";
import { SuccessRatePieChart } from "@/components/commons/SuccessRatePieChart";
import { pieChartStore } from "@/stores/chart";
import * as styles from "./styles.scss";

export const ReportHeaderPie = () => (
  <div className={styles["report-header-pie"]}>
    <Loadable
      source={pieChartStore}
      renderLoader={() => null}
      renderData={(chartData) => <SuccessRatePieChart slices={chartData.slices} percentage={chartData.percentage} />}
    />
  </div>
);