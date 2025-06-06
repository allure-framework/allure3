import { describe, expect, it } from "vitest";
import {
  ExpiredTokenError,
  InvalidTokenError,
  decryptExchangeToken,
  generateExchangeToken,
  generateTokenizedEndpointURL,
} from "../../src/utils/token.js";

describe("generateTokenizedEndpointURL", () => {
  it("should generate a valid tokenized endpoint URL", () => {
    const url = generateTokenizedEndpointURL("token", "https://example.com");

    expect(url).toBe("https://example.com/?token=token");
  });
});

describe("decryptExchangeToken", () => {
  it("should throw an error if the token is invalid", () => {
    expect(() => decryptExchangeToken(Buffer.from("invalid-token", "base64").toString("utf8"))).toThrow(
      InvalidTokenError,
    );
  });

  it("should throw an error if the token is expired", () => {
    const expirationDate = new Date("2020-01-01").getTime().toString();
    const expiredToken = Buffer.from(`expired-token:${expirationDate}`, "utf8").toString("base64");

    expect(() => decryptExchangeToken(expiredToken)).toThrow(ExpiredTokenError);
  });

  it("should return the token if it is valid", () => {
    const token = generateExchangeToken();

    expect(() => decryptExchangeToken(token)).not.toThrow();
  });
});
