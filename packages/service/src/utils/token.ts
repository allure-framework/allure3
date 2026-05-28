interface ServiceTokenPayload {
  accessToken: string;
  url: string;
}

export const parseServiceToken = <T = ServiceTokenPayload>(token: string) => {
  try {
    const encodedPayload = token.split(".")[1];

    if (!encodedPayload) {
      throw new Error("missing payload");
    }

    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf-8")) as T & ServiceTokenPayload;

    if (!payload.accessToken) {
      throw new Error("missing access token");
    }

    if (!payload.url) {
      throw new Error("missing url");
    }

    return payload;
  } catch {
    throw new Error("Allure service access token is invalid");
  }
};
