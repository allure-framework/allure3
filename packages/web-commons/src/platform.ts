export const testPlatform = (re: RegExp): boolean => {
  const navigator = window?.navigator as (Navigator & { userAgentData?: { platform?: string | null } }) | undefined;
  const platform = navigator?.userAgentData?.platform ?? navigator?.platform;

  return platform ? re.test(platform) : false;
};
