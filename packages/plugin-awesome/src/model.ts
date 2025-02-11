export type AllureAwesomeOptions = {
  reportName?: string;
  singleFile?: boolean;
  logo?: string;
  theme?: "light" | "dark";
  reportLanguage?: "en" | "ru";
  groupBy?: string[];
  ci?: {
    type: "github" | "jenkins";
    url: string;
    name: string;
  };
};

export type TemplateManifest = Record<string, string>;

export type AllureAwesomePluginOptions = AllureAwesomeOptions;
