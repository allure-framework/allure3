import type { FC } from "preact/compat";
import { Footer } from "@/components/Footer";
import MainReport from "@/components/MainReport";
import * as styles from "./styles.scss";

export type BaseLayoutProps = {};

export const BaseLayout: FC<BaseLayoutProps> = () => {
  return (
    <div className={styles.layout} data-testid="base-layout">
      <div className={styles.wrapper}>
        <MainReport />
        <Footer />
      </div>
    </div>
  );
};
