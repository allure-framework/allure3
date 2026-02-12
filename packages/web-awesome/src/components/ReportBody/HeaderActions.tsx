import { ReportFilters } from "../ReportFilters";
import { ReportSearch } from "../ReportSearch";
import * as styles from "./styles.scss";

export const HeaderActions = () => {
  return (
    <div className={styles.headerActions}>
      <ReportSearch />
      <ReportFilters />
    </div>
  );
};
