import { ReportLogoFull, Text } from "@allurereport/web-components";
import * as styles from "./styles.scss";

export const FooterLogo = () => {
  return (
    <div className={styles["footer-logo"]}>
      <a href="https://allurereport.org" target={"_blank"} rel="noreferrer">
        <Text type="paragraph" size="m" className={styles["footer-logo"]}>
          Powered by
        </Text>
        <ReportLogoFull className={styles.logo} />
      </a>
    </div>
  );
};
