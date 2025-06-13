import { randomBytes } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { EOL } from "node:os";
import { ALLURE_ACCESS_TOKEN_PATH, ALLURE_FILES_DIRNAME, ALLURE_LOGIN_EXCHANGE_TOKEN_PATH } from "../model.js";

export class InvalidTokenError extends Error {
  constructor() {
    super("Invalid token");
    this.name = "InvalidTokenError";
  }
}

export class ExpiredTokenError extends Error {
  constructor() {
    super("Expired token");
    this.name = "ExpiredTokenError";
  }
}

/**
 * Generates a token, which can be exchanged to access token that can be used to access history service
 * Every token is valid for 10 minutes and re-generates every time login command is called
 */
export const generateExchangeToken = (): string => {
  const token = randomBytes(32).toString("hex");
  const validTill = Date.now() + 10 * 60 * 1000;

  return Buffer.from(`${token}:${validTill}`, "utf8").toString("base64");
};

/**
 * Makes an attempt to decrypt the exchange token
 * Throw an error if token is expired
 * @param exchangeToken
 */
export const decryptExchangeToken = (exchangeToken: string) => {
  const [token, validTill] = Buffer.from(exchangeToken, "base64").toString("utf8").split(":");

  if (!token) {
    throw new InvalidTokenError();
  }

  if (validTill && parseInt(validTill, 10) < Date.now()) {
    throw new ExpiredTokenError();
  }

  return token;
};

/**
 * Generates and writes a new exchange token to the home dir in the `.allure` directory
 */
export const writeExchangeToken = async () => {
  const tempToken = generateExchangeToken();

  await mkdir(ALLURE_FILES_DIRNAME, { recursive: true });
  await writeFile(ALLURE_LOGIN_EXCHANGE_TOKEN_PATH, tempToken);

  return tempToken;
};

/**
 * Writes given access token to the home dir in the `.allure` directory
 * @param token
 */
export const writeAccessToken = async (token: string) => {
  await mkdir(ALLURE_FILES_DIRNAME, { recursive: true });
  await writeFile(ALLURE_ACCESS_TOKEN_PATH, token);
};

/**
 * Tries to read the access token from the home dir in the `.allure` directory
 * If token doesn't exist – returns undefined
 */
export const readAccessToken = async () => {
  try {
    const accessToken = await readFile(ALLURE_ACCESS_TOKEN_PATH, "utf-8");

    return accessToken.replaceAll(EOL, "").trim();
  } catch (e) {
    return undefined;
  }
};

/**
 * Deletes the access token from the home dir permanently
 */
export const deleteAccessToken = async () => {
  try {
    await rm(ALLURE_ACCESS_TOKEN_PATH, { force: true });
  } catch (ignore) {}
};
