import { Loadable, PageLoader } from "@allurereport/web-components";
import { Footer } from "@/components/Footer";
import MainReport from "@/components/MainReport";
import * as styles from "./styles.scss";
import { trendStore } from "@/stores/trends";
import type { FC } from "preact/compat";

export type BaseLayoutProps = {};

export const BaseLayout: FC<BaseLayoutProps> = () => {
  return (
    <div className={styles.layout} data-testid="base-layout">
      <div className={styles.wrapper}>
        <Loadable source={trendStore} renderLoader={() => <PageLoader />} renderData={() => <MainReport />} />
        <Footer />
      </div>
    </div>
  );
};
