export class ExecutorInfo {
  constructor(
    private readonly name: string | null = null,
    private readonly type: string | null = null,
    private readonly url: string | null = null,
    private readonly buildOrder: number | null = null,
    private readonly buildName: string | null = null,
    private readonly buildUrl: string | null = null,
    private readonly reportName: string | null = null,
    private readonly reportUrl: string | null = null
  ) {
    // Validate URLs if provided
    if (url !== null && url.trim().length > 0) {
      try {
        new URL(url);
      } catch {
        throw new Error(`Invalid executor URL: ${url}`);
      }
    }
    if (buildUrl !== null && buildUrl.trim().length > 0) {
      try {
        new URL(buildUrl);
      } catch {
        throw new Error(`Invalid build URL: ${buildUrl}`);
      }
    }
    if (reportUrl !== null && reportUrl.trim().length > 0) {
      try {
        new URL(reportUrl);
      } catch {
        throw new Error(`Invalid report URL: ${reportUrl}`);
      }
    }
  }

  getName(): string | null {
    return this.name;
  }

  getType(): string | null {
    return this.type;
  }

  getUrl(): string | null {
    return this.url;
  }

  getBuildOrder(): number | null {
    return this.buildOrder;
  }

  getBuildName(): string | null {
    return this.buildName;
  }

  getBuildUrl(): string | null {
    return this.buildUrl;
  }

  getReportName(): string | null {
    return this.reportName;
  }

  getReportUrl(): string | null {
    return this.reportUrl;
  }

  equals(other: ExecutorInfo): boolean {
    return (
      this.name === other.name &&
      this.type === other.type &&
      this.url === other.url &&
      this.buildOrder === other.buildOrder &&
      this.buildName === other.buildName &&
      this.buildUrl === other.buildUrl &&
      this.reportName === other.reportName &&
      this.reportUrl === other.reportUrl
    );
  }
}
