type NavigateTo =
  | string
  | {
      path: string;
      searchParams?: URLSearchParams;
    };

const isExternalUrl = (url: string): boolean => {
  // Check if URL starts with http:// or https://
  if (url.startsWith("http://") || url.startsWith("https://")) {
    try {
      const urlObj = new URL(url);
      // Only treat as external if origin is different
      return urlObj.origin !== window.location.origin;
    } catch {
      // If URL parsing fails but starts with http/https, treat as external
      return true;
    }
  }

  // Relative paths are internal
  return false;
};

const extractPathFromUrl = (url: string): string => {
  try {
    const urlObj = new URL(url);
    // If same origin, extract pathname and search
    if (urlObj.origin === window.location.origin) {
      return urlObj.pathname + urlObj.search;
    }
  } catch {
    // If parsing fails, return as is
  }
  return url;
};

export const navigateTo = (to: NavigateTo) => {
  if (typeof window === "undefined") {
    return;
  }

  let targetUrl: string;

  if (typeof to === "string") {
    targetUrl = to;
  } else {
    let path = to.path;

    // Add searchParams as query string if provided
    if (to.searchParams && to.searchParams.size > 0) {
      path = `${path}?${to.searchParams.toString()}`;
    }

    targetUrl = path;
  }

  // Check if it's an external URL
  if (isExternalUrl(targetUrl)) {
    window.location.href = targetUrl;
    return;
  }

  // If URL starts with http:// or https:// but same origin, extract pathname
  if (targetUrl.startsWith("http://") || targetUrl.startsWith("https://")) {
    targetUrl = extractPathFromUrl(targetUrl);
  }

  if (targetUrl.trim() === "" || targetUrl.trim() === "/") {
    targetUrl = "";
  }

  // Internal hash routing - add # prefix
  window.history.pushState({}, "", targetUrl === "" ? "/" : `#${targetUrl}`);

  // Trigger hashchange event to update currentUrl
  // history.pushState doesn't trigger hashchange automatically
  window.dispatchEvent(new Event("hashchange"));
};

export const openInNewTab = (to: NavigateTo) => {
  let targetUrl: string;

  if (typeof to === "string") {
    targetUrl = to;
  } else {
    let path = to.path;

    // Add searchParams as query string if provided
    if (to.searchParams && to.searchParams.size > 0) {
      path = `${path}?${to.searchParams.toString()}`;
    }

    targetUrl = path;
  }

  // Check if it's an external URL
  if (isExternalUrl(targetUrl)) {
    window.open(targetUrl, "_blank");
    return;
  }

  // If URL starts with http:// or https:// but same origin, extract pathname
  if (targetUrl.startsWith("http://") || targetUrl.startsWith("https://")) {
    targetUrl = extractPathFromUrl(targetUrl);
  }

  if (targetUrl.trim() === "" || targetUrl.trim() === "/") {
    targetUrl = "";
  }

  // Internal hash routing - add # prefix
  window.open(targetUrl === "" ? "/" : `#${targetUrl}`, "_blank");
};
