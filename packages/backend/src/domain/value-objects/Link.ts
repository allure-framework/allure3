export class Link {
  constructor(
    private readonly url: string,
    private readonly name: string | null = null,
    private readonly type: string | null = null
  ) {
    if (!url || url.trim().length === 0) {
      throw new Error('Link URL cannot be empty');
    }
    // Basic URL validation
    try {
      new URL(url);
    } catch {
      throw new Error(`Invalid URL: ${url}`);
    }
  }

  getName(): string | null {
    return this.name;
  }

  getUrl(): string {
    return this.url;
  }

  getType(): string | null {
    return this.type;
  }

  equals(other: Link): boolean {
    return this.url === other.url && this.name === other.name && this.type === other.type;
  }
}
