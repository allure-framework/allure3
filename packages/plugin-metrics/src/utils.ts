/** Allure 2 normalization: lower case and whitespaces replaced with underscores */
export const normalize = (value: string): string => value.toLowerCase().replace(/\s+/g, "_");

/** Removes credentials from a url, so it is safe to put into logs and error messages */
export const redactUrl = (url: string): string => {
  try {
    const parsed = new URL(url);

    parsed.username = "";
    parsed.password = "";

    return parsed.toString();
  } catch {
    return url;
  }
};
