import type { ColorSchemeOption } from "@/stores/colorScheme";

import * as styles from "./styles.scss";

interface ColorSchemeItemProps {
  option: ColorSchemeOption;
}

export const ColorSchemeItem = ({ option }: ColorSchemeItemProps) => (
  <span className={styles.item}>
    <span className={styles.swatch} style={option.preview ? { background: option.preview } : undefined} />
    {option.label}
  </span>
);
