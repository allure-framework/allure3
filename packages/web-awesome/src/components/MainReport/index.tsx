import clsx from "clsx";
import { ReportBody } from "@/components/ReportBody";
import { ReportHeader } from "@/components/ReportHeader";
import { ReportMetadata } from "@/components/ReportMetadata";
import { isSplitMode } from "@/stores/layout";
import * as styles from "./styles.scss";

const MainReport = () => {
  return (
    <>
      <div className={clsx(styles.content, isSplitMode.value ? styles["scroll-inside"] : "")}>
        <ReportHeader />
        <ReportMetadata />
        <ReportBody />
      </div>
    </>
  );
};
export default MainReport;
