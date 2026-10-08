import type { ComponentChild } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";

import { IconButton } from "@/components/Button";
import { SvgIcon, allureIcons } from "@/components/SvgIcon";
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

export const SearchBox = (props: Props) => {
  const { placeholder, value, onChange, changeDebounce = 300, leadingSlot, trailingSlot, error } = props;
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const onChangeDebounced = useDebouncedCallback(onChange, changeDebounce);
  const onChangeDebouncedRef = useRef(onChangeDebounced);
  onChangeDebouncedRef.current = onChangeDebounced;

  useEffect(() => {
    setLocalValue(value ?? "");
    onChangeDebouncedRef.current.cancel();
  }, [value]);

  const handleChange = (e: Event) => {
    const newValue = (e.target as HTMLInputElement).value;
    setLocalValue(newValue);
    onChangeDebounced(newValue);
  };

  const handleClear = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setLocalValue("");
    onChangeDebounced.cancel();
    onChange("");
  };
  const handleWrapClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;

    if (target.closest("[data-search-box-slot]")) {
      e.stopPropagation();
      return;
    }

    inputRef.current?.focus();
  };
  const showClear = !!localValue;
  const hasError = !!error;

  return (
    <Text
      className={styles.inputWrap}
      type="ui"
      size="m"
      tag="div"
      onClick={handleWrapClick}
      data-invalid={hasError || undefined}
    >
      <div className={styles.leadingIcon}>
        <SvgIcon id={allureIcons.lineGeneralSearchMd} size="s" />
      </div>
      {leadingSlot && (
        <div className={styles.slot} data-search-box-slot>
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
        aria-label={placeholder ?? "Search"}
      />
      {trailingSlot && (
        <div className={styles.slot} data-search-box-slot>
          {trailingSlot}
        </div>
      )}
      {showClear && (
        <div className={styles.clearButton}>
          <IconButton
            size="s"
            icon={allureIcons.lineGeneralXClose}
            onClick={handleClear}
            style="ghost"
            data-testid="clear-button"
          />
        </div>
      )}
    </Text>
  );
};
