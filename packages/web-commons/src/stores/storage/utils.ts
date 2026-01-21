export const subscribeToStorageChange = (callback: (event: StorageEvent) => void) => {
  if (typeof window === "undefined") {
    return;
  }

  window.addEventListener("storage", callback);

  return () => {
    window.removeEventListener("storage", callback);
  };
};

export const getFromStorage = (key: string) => {
  if (typeof window === "undefined") {
    return undefined;
  }

  return localStorage.getItem(key);
};

export const setToStorage = (key: string, value: string) => {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(key, value);
  window.dispatchEvent(new StorageEvent("storage", { key, newValue: value, storageArea: localStorage }));
};

export const isStorageEvent = (event: StorageEvent) => {
  if (typeof window === "undefined") {
    return false;
  }

  return event.storageArea === localStorage;
};
