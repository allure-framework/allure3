import { LegendItem } from "./LegendItem";
import type { LegendItemValue } from "./LegendItem/types";
import styles from "./styles.scss";

export const Legends = <T extends Record<string, number | string>>(props: {
  data: LegendItemValue<T>[];
  onLegendClick?: (data: LegendItemValue<T>) => void;
}) => {
  const { data, onLegendClick } = props;

  return (
    <div className={styles.legends}>
      {data.map((item) => (
        <LegendItem key={item.id} legend={item} onClick={onLegendClick} />
      ))}
    </div>
  );
};
