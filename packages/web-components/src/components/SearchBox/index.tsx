import { clsx } from "clsx";
import { useEffect, useState } from "preact/hooks";
import searchIcon from "@/assets/svg/line-general-search-md.svg";
import closeIcon from "@/assets/svg/line-general-x-close.svg";
import { IconButton } from "@/components/Button";
import { SvgIcon } from "@/components/SvgIcon";
import { Text } from "@/components/Typography";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";
import styles from "./styles.scss";

type Props = {
  placeholder?: string;
  invalid?: string;
  error?: string;
  value: string;
  onChange: (value: string) => void;
  changeDebounce?: number;
};

export const SearchBox = (props: Props) => {
  const { placeholder, value, onChange, changeDebounce = 300 } = props;
  const [localValue, setLocalValue] = useState(value);
  // @ts-ignore
  const onChangeDebounced = useDebouncedCallback(onChange, changeDebounce);
  const handleChange = (e: Event) => {
    const newValue = (e.target as HTMLInputElement).value;

    setLocalValue(newValue);
    onChangeDebounced(newValue);
  };
  const handleClear = (e: PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setLocalValue("");
    onChangeDebounced("");
  };
  const showClear = !!localValue;

  useEffect(() => {
    if (localValue !== value) {
      setLocalValue(value);
    }
  }, [localValue, value]);

  // @ts-ignore
  return (
    <Text className={styles.inputWrap} type="ui" size="m" tag="div">
      <SvgIcon id={searchIcon.id} size="s" className={styles.leadingIcon} />
      <input
        className={clsx(styles.input, showClear && styles.inputClear)}
        type="text"
        placeholder={placeholder}
        onInput={handleChange}
        value={localValue}
        name="search"
        autocomplete="off"
        data-testid="search-input"
      />
      {showClear && (
        <div className={styles.clearButton}>
          {
            // TODO:FIXME
            // @ts-ignore
            <IconButton size="s" icon={closeIcon.id} onClick={handleClear} style="ghost" />
          }
        </div>
      )}
    </Text>
  );
};
