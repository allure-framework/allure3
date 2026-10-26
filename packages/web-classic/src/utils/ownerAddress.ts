/**
 * Parses owner string per RFC 2822 (Internet Message Format).
 * Supports: "Display Name <email@example.com>", "Display Name <https://url>",
 * plain "email@example.com", plain "https://url", or plain text.
 */
const RFC2822_ADDRESS = /^([^<>]+)\s+<\s*(\S*)\s*>$/;

type UrlOwnerAddress = {
  displayName: string;
  url: string;
  type: "url";
};

type EmailOwnerAddress = {
  displayName: string;
  email: string;
  type: "email";
};

export type OwnerAddress =
  | UrlOwnerAddress
  | EmailOwnerAddress
  | {
      displayName: string;
      type: "none";
    };

const isValidUrl = (value: string): boolean => {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
};

/**
 * Simple email validation: local@domain.tld, domain part must not start with dot.
 * Rejects invalid forms like "user@.example.com".
 */
const isValidEmail = (value: string): boolean => {
  const simpleEmail = /^[^\s@]+@[^\s.@][^\s@]*\.[^\s@]+$/;
  return simpleEmail.test(value);
};

/**
 * Quick check to avoid regex on plain text (no @, :, or <).
 */
const isLikelyAddress = (input: string): boolean => {
  return input.includes("@") || input.includes(":") || input.includes("<");
};

/**
 * Parses a single owner value into display name and optional link (mailto or URL).
 * Returns null for null/empty input.
 */
export const parseOwnerAddress = (maybeAddress: string): OwnerAddress => {
  if (!maybeAddress || maybeAddress.trim() === "") {
    return { displayName: "", type: "none" };
  }

  if (!isLikelyAddress(maybeAddress)) {
    return { displayName: maybeAddress, type: "none" };
  }

  let displayName = maybeAddress;
  let urlOrEmail = maybeAddress;

  const match = maybeAddress.match(RFC2822_ADDRESS);
  if (match) {
    displayName = match[1].trim();
    urlOrEmail = match[2];
  }

  // e.g.: John Doe <>
  if (urlOrEmail === "") {
    return { displayName, type: "none" };
  }

  // e.g.: John Doe <https://example.com> or plain https://...
  if (isValidUrl(urlOrEmail)) {
    return { displayName, url: urlOrEmail, type: "url" };
  }

  // e.g.: John Doe <mail@example.com> or plain mail@...
  if (isValidEmail(urlOrEmail)) {
    return { displayName, email: urlOrEmail, type: "email" };
  }

  // Non-compliant: treat as plain text
  return { displayName: maybeAddress, type: "none" };
};
