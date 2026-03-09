import type { ClassValue } from "clsx";
import { clsx } from "clsx";

import { FooterLogo } from "@/components/Footer/FooterLogo";
import { FooterVersion } from "@/components/Footer/FooterVersion";

import * as styles from "@/components/BaseLayout/styles.scss";

interface FooterProps {
  className?: ClassValue;
}
export const Footer = ({ className }: FooterProps) => {
  return (
    <div className={clsx(styles.below, className)}>
      <FooterLogo />
      <FooterVersion />
    </div>
  );
};
