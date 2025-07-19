import { env } from "node:process";

export const getEnv = (key: string): string => env?.[key] ?? "";

export const parseURLPath = (urlString: string): string => {
  try {
    const { pathname } = new URL(urlString);

    return pathname.replace(/^\/+/, "");
  } catch (error) {
    return "";
  }
};
