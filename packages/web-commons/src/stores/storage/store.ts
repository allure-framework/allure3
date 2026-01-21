import { effect, signal } from "@preact/signals-core";
import { getFromStorage, isStorageEvent, subscribeToStorageChange } from "./utils.js";

const trackedKeys = signal<Set<string>>(new Set());

const storageState = signal<Record<string, string | undefined>>({});

subscribeToStorageChange((event) => {
  if (!isStorageEvent(event)) {
    return;
  }

  const key = event.key;

  if (!key || !trackedKeys.peek().has(key)) {
    return;
  }

  trackedKeys.value.add(key);
  storageState.value = { ...storageState.peek(), [key]: event.newValue ?? undefined };
});

effect(() => {
  trackedKeys.value.forEach((key) => {
    storageState.value = { ...storageState.peek(), [key]: getFromStorage(key) ?? undefined };
  });
});

export const addTrackedKey = (key: string) => {
  if (trackedKeys.peek().has(key)) {
    return;
  }

  trackedKeys.value = new Set([...trackedKeys.peek(), key]);
};

const addToStorage = (key: string, value: string) => {
  storageState.value = { ...storageState.peek(), [key]: value };
};

export const getStorageValue = (key: string) => {
  const storageValue = storageState.value[key];

  if (storageValue) {
    return storageValue;
  }

  if (!trackedKeys.peek().has(key)) {
    addTrackedKey(key);
    const value = getFromStorage(key);

    if (value) {
      addToStorage(key, value);
    }

    return value ?? undefined;
  }

  return undefined;
};
