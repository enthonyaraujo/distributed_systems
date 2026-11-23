import { describe, expect, it, vi } from "vitest";
import {
  buildCognitoLogoutUrl,
  buildOidcSettings,
  revokeCognitoRefreshToken,
} from "./oidcConfig";
import type { AppEnv } from "../config/env";

const SAMPLE_ENV: AppEnv = {
  apiUrl: "https://api.aluno.grupo.sd.ufersa.dev.br",
  cognitoRegion: "us-east-1",
  cognitoUserPoolId: "us-east-1_ABC123",
  cognitoClientId: "public-client-id",
  cognitoDomain: "acadflow-demo.auth.us-east-1.amazoncognito.com",
  cognitoScopes: "openid email profile",
  appUrl: "https://aluno.grupo.sd.ufersa.dev.br",
};

describe("oidcConfig", () => {
  it("configures Authorization Code + PKCE public client without client_secret", () => {
    const settings = buildOidcSettings(SAMPLE_ENV);
    expect(settings.response_type).toBe("code");
    expect(settings.client_id).toBe("public-client-id");
    expect(settings.client_secret).toBeUndefined();
    expect(settings.redirect_uri).toBe(
      "https://aluno.grupo.sd.ufersa.dev.br/auth/callback"
    );
    expect(settings.metadata?.token_endpoint).toBe(
      "https://acadflow-demo.auth.us-east-1.amazoncognito.com/oauth2/token"
    );
  });

  it("builds Cognito /logout URL with client_id and logout_uri", () => {
    const url = buildCognitoLogoutUrl(SAMPLE_ENV);
    expect(url).toBe(
      "https://acadflow-demo.auth.us-east-1.amazoncognito.com/logout?client_id=public-client-id&logout_uri=https%3A%2F%2Faluno.grupo.sd.ufersa.dev.br%2F"
    );
  });

  it("posts refresh token revocation to /oauth2/revoke", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe(
        "https://acadflow-demo.auth.us-east-1.amazoncognito.com/oauth2/revoke"
      );
      expect(init?.method).toBe("POST");
      expect(String(init?.body)).toContain("token=refresh-xyz");
      expect(String(init?.body)).toContain("client_id=public-client-id");
      return new Response("", { status: 200 });
    });

    const ok = await revokeCognitoRefreshToken(
      SAMPLE_ENV,
      "refresh-xyz",
      fetchMock as unknown as typeof fetch
    );
    expect(ok).toBe(true);
  });
});
