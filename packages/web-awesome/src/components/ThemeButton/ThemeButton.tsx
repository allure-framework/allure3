import { IconButton } from "@allurereport/web-components";
import { useEffect } from "preact/hooks";
import lineShapesMoonIcon from "@/assets/svg/line-shapes-moon.svg";
import lineShapesSunIcon from "@/assets/svg/line-shapes-sun.svg";
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
      icon={theme === "light" ? lineShapesMoonIcon.id : lineShapesSunIcon.id}
      size="s"
    />
  );
};
