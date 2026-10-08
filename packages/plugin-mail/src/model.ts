import type { Statistic, TestStatus } from "@allurereport/core-api";

export interface MailPluginOptions {
  /**
   * Title of the mail. Defaults to the report name
   */
  title?: string;
  /**
   * Link to the published report. Defaults to the report url known to Allure (if any)
   */
  reportUrl?: string;
  /**
   * Max number of failed tests listed in the mail
   * @default 20
   */
  maxFailed?: number;
  /**
   * Name of the generated file, relative to the report output
   * @default "mail.html"
   */
  filename?: string;
}

export interface MailFailedTest {
  name: string;
  status: TestStatus;
  message?: string;
}

export interface MailCiInfo {
  name?: string;
  url?: string;
  branch?: string;
  pullRequestName?: string;
  pullRequestUrl?: string;
}

export interface MailData {
  title: string;
  status: TestStatus;
  stats: Statistic;
  passRate: number;
  duration: string;
  reportUrl?: string;
  ci?: MailCiInfo;
  failed: MailFailedTest[];
  hiddenFailed: number;
}
