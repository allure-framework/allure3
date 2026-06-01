import { LanguagePicker } from "@allurereport/web-components";
import type { ClassValue } from "clsx";
import { clsx } from "clsx";

import { FooterLogo } from "@/components/Footer/FooterLogo";
import { FooterVersion } from "@/components/Footer/FooterVersion";
import { currentLocale, setLocale } from "@/stores/locale";

import * as styles from "@/components/BaseLayout/styles.scss";
import * as footerStyles from "@/components/Footer/styles.scss";

interface FooterProps {
  className?: ClassValue;
}
export const Footer = ({ className }: FooterProps) => {
  return (
    <div className={clsx(styles.below, className)}>
      <FooterLogo />
      <div className={footerStyles["footer-controls"]}>
        <LanguagePicker locale={currentLocale.value} setLocale={setLocale} />
        <FooterVersion />
      </div>
    </div>
  );
};
