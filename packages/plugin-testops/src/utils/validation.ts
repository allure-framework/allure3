export const validateExecutableName = (name: unknown): name is string => {
  if (typeof name !== "string" || name.length === 0 || name.trim().length === 0) {
    return false;
  }

  for (let index = 0; index < name.length; index += 1) {
    const code = name.charCodeAt(index);

    // TestOps boundary policy: reject U+FFFD to catch decoded-PNG corruption in production.
    if (code <= 0x1f || (code >= 0x7f && code <= 0x9f) || code === 0xfffd) {
      return false;
    }

    if (code >= 0xd800 && code <= 0xdbff) {
      const nextCode = name.charCodeAt(index + 1);

      if (nextCode < 0xdc00 || nextCode > 0xdfff || Number.isNaN(nextCode)) {
        return false;
      }

      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return false;
    }
  }

  return true;
};
