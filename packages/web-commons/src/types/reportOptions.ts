export type WebReportOptions = {
  allureVersion: string;
  reportName?: string;
  logo?: string;
  theme?: "light" | "dark" | "auto";
  reportLanguage?: "en" | "ru";
  createdAt: number;
  reportUuid: string;
};
