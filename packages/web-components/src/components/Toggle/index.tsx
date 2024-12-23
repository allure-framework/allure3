import * as styles from "./styles.scss";

type Props = {
  value: boolean;
  label: string;
  onChange: (value: boolean) => void;
  focusable?: boolean;
};

export const Toggle = (props: Props) => {
  const { value, label, onChange, focusable = true, ...rest } = props;

  const handleChange = (e: Event) => {
    const newValue = !(e.target as HTMLInputElement).checked;
    onChange(newValue);
  };

  return (
    <input
      {...rest}
      tabIndex={focusable ? 0 : -1}
      className={styles.toggle}
      role="switch"
      type="checkbox"
      checked={value}
      aria-label={label}
      onToggle={handleChange}
    />
  );
};
