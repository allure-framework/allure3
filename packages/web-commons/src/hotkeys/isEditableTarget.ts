const EDITABLE_SELECTOR = "input, textarea, select, [contenteditable=''], [contenteditable='true']";

export const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  return Boolean(target.closest(EDITABLE_SELECTOR));
};
