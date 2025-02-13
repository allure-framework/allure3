import { IconButton, allureIcons } from "@allurereport/web-components";
import { LanguagePicker } from "@/components/LanguagePicker";
import { ThemeButton } from "@/components/ThemeButton/ThemeButton";
import { layoutStore, toggleLayout } from "@/stores/layout";
import * as styles from "./styles.scss";

export const Header = () => {
  const isSplitMode = layoutStore.value === "split";
  return (
    <div className={styles.above}>
      <div className={isSplitMode ? styles.left : styles.right}>
        <IconButton size={"s"} icon={allureIcons.reportLogo} style={"ghost"} onClick={() => toggleLayout()} />
        <LanguagePicker />
        <ThemeButton />
      </div>
    </div>
  );
};
