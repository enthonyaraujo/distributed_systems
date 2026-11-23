import {
  WebStorageStateStore,
  type UserManagerSettings,
} from "oidc-client-ts";
import type { AppEnv } from "../config/env";

export function buildCognitoAuthority(env: AppEnv): string {
  return `https://cognito-idp.${env.cognitoRegion}.amazonaws.com/${env.cognitoUserPoolId}`;
}

export function buildCognitoLogoutUrl(env: AppEnv): string {
  const params = new URLSearchParams({
    client_id: env.cognitoClientId,
    logout_uri: `${env.appUrl}/`,
  });
  return `https://${env.cognitoDomain}/logout?${params.toString()}`;
}

export function buildCognitoRevokeUrl(env: AppEnv): string {
  return `https://${env.cognitoDomain}/oauth2/revoke`;
}

export function buildOidcSettings(
  env: AppEnv,
  storage?: Storage
): UserManagerSettings {
  const authority = buildCognitoAuthority(env);
  const hostedBase = `https://${env.cognitoDomain}`;

  const settings: UserManagerSettings = {
    authority,
    client_id: env.cognitoClientId,
    redirect_uri: `${env.appUrl}/auth/callback`,
    post_logout_redirect_uri: `${env.appUrl}/`,
    response_type: "code", // Authorization Code + PKCE (S256 enabled by default in oidc-client-ts)
    scope: env.cognitoScopes,
    loadUserInfo: false,
    automaticSilentRenew: false,
    metadata: {
      issuer: authority,
      authorization_endpoint: `${hostedBase}/oauth2/authorize`,
      token_endpoint: `${hostedBase}/oauth2/token`,
      jwks_uri: `${authority}/.well-known/jwks.json`,
      end_session_endpoint: `${hostedBase}/logout`,
      revocation_endpoint: `${hostedBase}/oauth2/revoke`,
    },
  };

  if (storage) {
    settings.userStore = new WebStorageStateStore({ store: storage });
    settings.stateStore = new WebStorageStateStore({ store: storage });
  }

  return settings;
}

/**
 * Best-effort revocation of a Cognito refresh token before clearing local session.
 * Note: Cognito /logout and /oauth2/revoke do not invalidate already-issued
 * stateless JWT access tokens before their `exp` timestamp.
 */
export async function revokeCognitoRefreshToken(
  env: AppEnv,
  refreshToken: string,
  fetchImpl: typeof fetch = fetch
): Promise<boolean> {
  if (!refreshToken || !env.cognitoDomain || !env.cognitoClientId) {
    return false;
  }
  try {
    const body = new URLSearchParams({
      token: refreshToken,
      client_id: env.cognitoClientId,
    });
    const res = await fetchImpl(buildCognitoRevokeUrl(env), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    return res.ok;
  } catch {
    return false;
  }
}
