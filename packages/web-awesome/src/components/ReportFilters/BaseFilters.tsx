import {
  type ArrayField,
  type BooleanField,
  type FieldFilter,
  type FieldFilterGroup,
  type LogicalOperator,
  MAX_ARRAY_FIELD_VALUES,
} from "@allurereport/web-commons";
import {
  Button,
  Counter,
  DropdownButton,
  IconButton,
  Menu,
  Text,
  Tooltip,
  allureIcons,
  useTooltip,
} from "@allurereport/web-components";
import { createPortal } from "preact/compat";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { useI18n } from "@/stores/locale";
import * as styles from "./styles.scss";

const FilterBtn = (props: {
  icon: string;
  text: string;
  isActive: boolean;
  counter?: number;
  onClick: () => void;
  onClear?: () => void;
  isDropdown?: boolean;
  isExpanded?: boolean;
  error?: string;
  testId?: string;
  description?: string;
  disabled?: boolean;
}) => {
  const {
    icon,
    text,
    isActive,
    counter,
    onClick,
    onClear,
    isDropdown,
    isExpanded,
    error,
    testId,
    description,
    disabled,
  } = props;
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  useTooltip({ isVisible: isTooltipVisible, triggerRef, tooltipRef, placement: "top" });

  const hasError = error?.length > 0;
  const hasDescription = description?.length > 0;

  useEffect(() => {
    if (!hasError && !hasDescription) {
      setIsTooltipVisible(false);
    }
  }, [hasError, hasDescription]);

  const handleMouseOver = useCallback(() => {
    if (hasError || hasDescription) {
      setIsTooltipVisible(true);
    }
  }, [hasError, hasDescription]);

  const handleMouseLeave = useCallback(() => {
    setIsTooltipVisible(false);
  }, []);

  const commonProps = {
    icon,
    text,
    size: "m",
    style: isActive ? "raised" : "ghost",
    action: hasError ? "danger" : "default",
    onClick,
    trailingSlot: counter !== undefined ? <Counter count={counter} size="s" truncateCount /> : null,
    isDisabled: disabled,
  } as const;

  const clearButton =
    isActive && onClear ? (
      <div className={styles.clear}>
        <IconButton size="xs" style="ghost" icon={allureIcons.solidXCircle} onClick={onClear} rounded />
      </div>
    ) : null;

  let content = <Button {...commonProps} />;

  if (isDropdown) {
    content = <DropdownButton {...commonProps} isExpanded={isExpanded} />;
  }

  const hasTooltipContent = !isExpanded && (hasError || hasDescription);

  return (
    <div className={styles.btnWrapper} data-testid={testId}>
      <div ref={triggerRef} onPointerOver={handleMouseOver} onPointerLeave={handleMouseLeave}>
        {content}
      </div>
      {clearButton}
      {createPortal(
        <div
          ref={tooltipRef}
          className={styles.tooltip}
          data-testid="filter-tooltip"
          data-visible={(isTooltipVisible && hasTooltipContent) || undefined}
        >
          {error && <Tooltip ref={tooltipRef}>{error}</Tooltip>}
          {!error && description && <Tooltip ref={tooltipRef}>{description}</Tooltip>}
        </div>,
        document.body,
      )}
    </div>
  );
};

export const BooleanFieldFilter = <T extends BooleanField = BooleanField>(props: {
  field: T;
  onChange: (filter: T) => void;
  icon?: string;
  label?: string;
  testId?: string;
  description?: string;
}) => {
  const { field, onChange, icon, label, testId, description } = props;
  const { value, key } = field;

  const handleChange = useCallback(() => {
    onChange({ ...field, value: !value });
  }, [field, onChange, value]);

  return (
    <FilterBtn
      icon={icon}
      text={label ?? key}
      isActive={value}
      onClick={handleChange}
      testId={testId}
      description={description}
    />
  );
};

export const MultipleChoiceFieldFilter = (props: {
  group: FieldFilterGroup;
  counter?: boolean;
  onChange: (group: FieldFilterGroup) => void;
  onClear?: () => void;
  options: { key: string; label?: string; description?: string; icon?: string }[];
  fieldKey: string;
  logicalOperator?: LogicalOperator;
  strict?: boolean;
  icon?: string;
  label?: string;
  testId?: string;
  disabled?: boolean;
}) => {
  const {
    group,
    onChange,
    icon,
    label,
    fieldKey,
    options,
    logicalOperator = "AND",
    strict = true,
    counter = true,
    onClear,
    testId,
    disabled,
  } = props;
  const { value } = group;

  const handleOptionClick = useCallback(
    (optionKey: string, optionValue: boolean) => {
      const newValues = value.filter(
        (v) =>
          v.type === "field" && v.value.type === "string" && v.value.key === fieldKey && v.value.value !== optionKey,
      );

      if (optionValue) {
        newValues.push({
          type: "field",
          value: {
            type: "string",
            key: fieldKey,
            value: optionKey,
            strict,
          },
          logicalOperator,
        });
      }

      onChange({ ...group, value: newValues });
    },
    [group, onChange, value, fieldKey, strict, logicalOperator],
  );

  const isOptionChecked = (optionKey: string) => {
    return value.some(
      (v) => v.type === "field" && v.value.type === "string" && v.value.key === fieldKey && v.value.value === optionKey,
    );
  };

  const checkedValuesCount = options.map(({ key }) => key).filter(isOptionChecked).length;
  const hasCheckedValues = checkedValuesCount > 0;

  if (disabled) {
    return (
      <FilterBtn
        icon={icon}
        text={label ?? fieldKey}
        isActive={hasCheckedValues}
        onClick={() => {}}
        disabled
        testId={testId}
      />
    );
  }

  return (
    <Menu
      size="l"
      placement="bottom-start"
      menuTrigger={({ onClick, isOpened }) => (
        <FilterBtn
          icon={icon}
          text={label ?? fieldKey}
          isActive={hasCheckedValues}
          isExpanded={isOpened}
          counter={counter && hasCheckedValues ? checkedValuesCount : undefined}
          onClick={onClick}
          onClear={onClear}
          isDropdown
          testId={testId}
        />
      )}
    >
      <Menu.Section>
        {options.map((option) => (
          <Menu.ItemWithCheckmark
            key={option.key}
            onClick={() => handleOptionClick(option.key, !isOptionChecked(option.key))}
            isChecked={isOptionChecked(option.key)}
            leadingIcon={option.icon}
            closeMenuOnClick={false}
            dataTestId={`${option.key}-filter`}
          >
            <div className={styles.itemContent}>
              <Text tag="div">{option.label ?? option.key}</Text>
              {option.description && (
                <Text tag="div" size="s" type="paragraph" className={styles.description}>
                  {option.description}
                </Text>
              )}
            </div>
          </Menu.ItemWithCheckmark>
        ))}
      </Menu.Section>
    </Menu>
  );
};

export const ArrayFieldFilter = <T extends ArrayField = ArrayField>(props: {
  filter: FieldFilter & { value: T };
  counter?: boolean;
  onChange: (filter: FieldFilter & { value: T }) => void;
  onClear?: () => void;
  options: { key: string; label?: string; icon?: string }[];
  icon?: string;
  label?: string;
  description?: string;
  disabled?: boolean;
}) => {
  const { filter, onChange, icon, label, options, counter = true, onClear, description, disabled } = props;
  const { value, key } = filter.value;
  const { t } = useI18n("filters");

  const handleOptionClick = useCallback(
    (optionKey: string, optionValue: boolean) => {
      const newValues = value.filter((v) => v !== optionKey);

      if (optionValue) {
        newValues.push(optionKey);
      }

      onChange({ ...filter, value: { ...filter.value, value: newValues } });
    },
    [filter, onChange, value],
  );

  const isOptionChecked = (optionKey: string) => {
    return value.some((v) => v === optionKey);
  };

  const checkedValuesCount = options.map(({ key: optionKey }) => optionKey).filter(isOptionChecked).length;
  const hasCheckedValues = checkedValuesCount > 0;

  const errorText = t("errors.max_values", { count: MAX_ARRAY_FIELD_VALUES });
  const hasError = checkedValuesCount > MAX_ARRAY_FIELD_VALUES;

  return (
    <Menu
      placement="bottom-start"
      menuTrigger={({ onClick, isOpened }) => (
        <FilterBtn
          icon={icon}
          text={label ?? key}
          isActive={hasCheckedValues}
          isExpanded={isOpened}
          counter={counter && hasCheckedValues ? checkedValuesCount : undefined}
          onClick={onClick}
          onClear={onClear}
          isDropdown
          error={hasError ? errorText : undefined}
          description={description}
          disabled={disabled}
        />
      )}
    >
      <Menu.Section>
        {options.map((option) => (
          <Menu.ItemWithCheckmark
            closeMenuOnClick={false}
            key={option.key}
            onClick={() => handleOptionClick(option.key, !isOptionChecked(option.key))}
            isChecked={isOptionChecked(option.key)}
            leadingIcon={option.icon}
          >
            {option.label ?? option.key}
          </Menu.ItemWithCheckmark>
        ))}
      </Menu.Section>
    </Menu>
  );
};
