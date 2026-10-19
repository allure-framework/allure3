export const getIframeContentHeight = (iframe: HTMLIFrameElement) => {
  const documentElement = iframe.contentDocument?.documentElement;
  const body = iframe.contentDocument?.body;
  const bodyRectHeight = body?.getBoundingClientRect().height ?? 0;
  const scrollHeight = Math.max(body?.scrollHeight ?? 0, documentElement?.scrollHeight ?? 0);
  const offsetHeight = Math.max(body?.offsetHeight ?? 0, documentElement?.offsetHeight ?? 0);

  return Math.ceil(Math.max(bodyRectHeight, scrollHeight, offsetHeight));
};
