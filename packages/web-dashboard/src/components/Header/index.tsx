import type { ClassValue } from "clsx";
import clsx from "clsx";
import { LanguagePicker } from "@/components/LanguagePicker";
import { ThemeButton } from "@/components/ThemeButton/ThemeButton";
import * as styles from "./styles.scss";

interface HeaderProps {
  className?: ClassValue;
}

export const Header = ({ className }: HeaderProps) => {
  return (
    <div className={clsx(styles.above, className)}>
      <div className={styles.right}>
        <LanguagePicker />
        <ThemeButton />
      </div>
    </div>
  );
};
