export const subscribeToUrlChange = (callback: () => void) => {
  if (typeof window === "undefined") {
    return;
  }

  window.addEventListener("popstate", callback);
  window.addEventListener("replaceState", callback);
  window.addEventListener("pushState", callback);
  window.addEventListener("hashchange", callback);

  return () => {
    window.removeEventListener("popstate", callback);
    window.removeEventListener("replaceState", callback);
    window.removeEventListener("pushState", callback);
    window.removeEventListener("hashchange", callback);
  };
};

type NavigateTo =
  | URL
  | string
  | {
      path: string;
    };

type NavigateToOptions = {
  replace?: boolean;
};

const getUrl = (to: NavigateTo) => {
  if (typeof to === "string") {
    return to;
  }

  if (to instanceof URL) {
    return to;
  }

  return new URL(to.path, getCurrentUrl());
};

export const goTo = (to: NavigateTo, options?: NavigateToOptions) => {
  if (typeof window === "undefined") {
    return;
  }

  const url = getUrl(to);

  if (options?.replace) {
    window.history.replaceState(null, "", url);
    // Because nothing is triggered when replaceState is called, we need to dispatch an event to notify the subscribers
    window.dispatchEvent(new Event("replaceState"));
  } else {
    window.history.pushState(null, "", url);
    window.dispatchEvent(new Event("pushState"));
  }
};

export const getCurrentUrl = () => {
  if (typeof window === "undefined") {
    return "";
  }

  return window.location.href;
};
