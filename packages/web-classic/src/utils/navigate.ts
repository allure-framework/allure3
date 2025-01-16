export const navigateTo = (path: string) => {
  globalThis.location.hash = path;
};

export const openInNewTab = (path: string) => {
  window.open(`#${path}`, "_blank");
};
