import type { ClassValue } from "clsx";
import { clsx } from "clsx";
import * as styles from "@/components/BaseLayout/styles.scss";
import { FooterLogo } from "@/components/Footer/FooterLogo";
import { FooterVersion } from "@/components/Footer/FooterVersion";

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
