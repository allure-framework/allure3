export const testPlatform = (re: RegExp) => {
  // @ts-ignore
  const platform: string = window?.navigator?.userAgentData?.platform ?? window?.navigator?.platform;

  return platform ? re.test(platform) : false;
};

export const isMac = testPlatform(/^Mac/i);
