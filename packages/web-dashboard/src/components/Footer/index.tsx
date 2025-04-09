import { clsx } from "clsx";
import * as styles from "@/components/BaseLayout/styles.scss";
import { FooterLogo } from "@/components/Footer/FooterLogo";
import { FooterVersion } from "@/components/Footer/FooterVersion";

export const Footer = () => {
  return (
    <div className={clsx(styles.below)}>
      <FooterLogo />
      <FooterVersion />
    </div>
  );
};
