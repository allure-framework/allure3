import { PageLoader } from "@allurereport/web-components/core";

import * as styles from "./styles.scss";

export const TestResultLoader = () => (
  <div className={styles["test-result-loader"]}>
    <PageLoader />
  </div>
);
