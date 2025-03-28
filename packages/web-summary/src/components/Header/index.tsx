import { ReportLogo } from "@allurereport/web-components";
import { type FunctionalComponent } from "preact";
import { LanguagePicker } from "@/components/LanguagePicker";
import { ThemeButton } from "@/components/ThemeButton";
import * as styles from "./styles.scss";

export const Header: FunctionalComponent = () => {
  return (
    <header class={styles.header}>
      <ReportLogo className={styles.logo} />
      <ThemeButton />
      <LanguagePicker />
    </header>
  );
};
