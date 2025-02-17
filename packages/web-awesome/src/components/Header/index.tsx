import { LanguagePicker } from "@/components/LanguagePicker";
import { ThemeButton } from "@/components/ThemeButton/ThemeButton";
import ToggleLayout from "@/components/ToggleLayout";
import * as styles from "./styles.scss";

export const Header = () => {
  return (
    <div className={styles.above}>
      <div className={styles.right}>
        <LanguagePicker />
        <ToggleLayout />
        <ThemeButton />
      </div>
    </div>
  );
};
