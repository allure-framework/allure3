import { clsx } from "clsx";

import { FooterLogo } from "@/components/Footer/FooterLogo";
import { FooterVersion } from "@/components/Footer/FooterVersion";

import * as styles from "@/components/BaseLayout/styles.scss";

export const Footer = () => {
  return (
    <div className={clsx(styles.below)}>
      <FooterLogo />
      <FooterVersion />
    </div>
  );
};
