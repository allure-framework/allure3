import { IconButton, allureIcons } from "@allurereport/web-components";
import { useEffect } from "preact/hooks";
import { getTheme, themeStore, toggleTheme } from "@/stores/theme";

export const ThemeButton = () => {
  const theme = themeStore.value;

  useEffect(() => {
    getTheme();
  }, []);

  return (
    <IconButton
      onClick={toggleTheme}
      style="ghost"
      icon={theme === "light" ? allureIcons.lineShapesMoon : allureIcons.lineShapesSun}
      size="s"
    />
  );
};
