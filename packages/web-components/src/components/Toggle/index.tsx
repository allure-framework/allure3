import styles from "./styles.scss";

type Props = {
  value: boolean;
  label: string;
  size?: "s" | "m";
  onChange: (value: boolean) => void;
  focusable?: boolean;
};

export const Toggle = (props: Props) => {
  const { value, label, onChange, focusable = true, size = "m", ...rest } = props;

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
      onClick={handleChange}
      data-size={size}
    />
  );
};
