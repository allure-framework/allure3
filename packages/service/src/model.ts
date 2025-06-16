import { homedir } from "node:os";
import { join, resolve } from "node:path";

export const DEFAULT_HISTORY_SERVICE_URL = "https://history.allurereport.org";

export const ALLURE_FILES_DIRNAME = resolve(homedir(), ".allure");

export const ALLURE_LOGIN_EXCHANGE_TOKEN_PATH = join(ALLURE_FILES_DIRNAME, "exchange_token");

export const ALLURE_ACCESS_TOKEN_PATH = join(ALLURE_FILES_DIRNAME, "access_token");
