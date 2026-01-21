import type { ComponentChild } from "preact";
import { useRef, useState } from "preact/hooks";
import searchIcon from "@/assets/svg/line-general-search-md.svg";
import closeIcon from "@/assets/svg/line-general-x-close.svg";
import { IconButton } from "@/components/Button";
import { SvgIcon } from "@/components/SvgIcon";
import { Text } from "@/components/Typography";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";
import styles from "./styles.scss";

type Props = {
  placeholder?: string;
  error?: string;
  value: string;
  onChange: (value: string) => void;
  changeDebounce?: number;
  leadingSlot?: ComponentChild;
  trailingSlot?: ComponentChild;
};

const stopPropagation = (e: MouseEvent) => {
  e.stopPropagation();
};

export const SearchBox = (props: Props) => {
  const { placeholder, value, onChange, changeDebounce = 300, leadingSlot, trailingSlot, error } = props;
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const onChangeDebounced = useDebouncedCallback(onChange, changeDebounce);
  const handleChange = (e: Event) => {
    const newValue = (e.target as HTMLInputElement).value;
    setLocalValue(newValue);
    onChangeDebounced(newValue);
  };

  const handleClear = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setLocalValue("");
    onChangeDebounced("");
  };
  const showClear = !!localValue;
  const hasError = !!error;

  return (
    <Text
      className={styles.inputWrap}
      type="ui"
      size="m"
      tag="div"
      onClick={() => inputRef.current?.focus()}
      data-invalid={hasError || undefined}
    >
      <div className={styles.leadingIcon}>
        <SvgIcon id={searchIcon.id} size="s" />
      </div>
      {leadingSlot && (
        <div className={styles.slot} onClick={stopPropagation}>
          {leadingSlot}
        </div>
      )}
      <input
        ref={inputRef}
        className={styles.input}
        type="text"
        placeholder={placeholder}
        onInput={handleChange}
        value={localValue}
        name="search"
        autocomplete="off"
        data-testid="search-input"
        aria-invalid={hasError || undefined}
      />
      {trailingSlot && (
        <div className={styles.slot} onClick={stopPropagation}>
          {trailingSlot}
        </div>
      )}
      {showClear && (
        <div className={styles.clearButton} onClick={stopPropagation}>
          {<IconButton size="s" icon={closeIcon.id} onClick={handleClear} style="ghost" data-testid="clear-button" />}
        </div>
      )}
    </Text>
  );
};
