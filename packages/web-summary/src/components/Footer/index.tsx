import { ReportLogoFull, Text } from "@allurereport/web-components";
import cx from "clsx";
import { type FunctionalComponent } from "preact";
import * as styles from "./styles.scss";

export type FooterProps = {
  className?: string;
};

export const Footer: FunctionalComponent<FooterProps> = ({ className }) => {
  return (
    <footer className={cx(styles.footer, className)}>
      <a className={styles.link} href="https://allurereport.org" target={"_blank"} rel="noreferrer">
        <Text type="paragraph" size="m" className={styles["logo-label"]}>
          Powered by
        </Text>
        <ReportLogoFull className={styles.logo} />
      </a>
    </footer>
  );
};
