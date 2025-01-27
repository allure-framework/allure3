import * as styles from "@/components/BaseLayout/styles.scss";
import { Header } from "@/components/Header";
import { ReportBody } from "@/components/ReportBody";
import { ReportHeader } from "@/components/ReportHeader";
import { ReportMetadata } from "@/components/ReportMetadata";

const MainReport = () => {
  return (
    <>
      <Header />
      <div className={styles.content}>
        <ReportHeader />
        <ReportMetadata />
        <ReportBody />
      </div>
    </>
  );
};
export default MainReport;
