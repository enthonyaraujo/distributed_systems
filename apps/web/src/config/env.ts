export interface AppEnv {
  apiUrl: string;
  cognitoRegion: string;
  cognitoUserPoolId: string;
  cognitoClientId: string;
  cognitoDomain: string;
  cognitoScopes: string;
  appUrl: string;
}

function normalizeUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, "");
}

function normalizeHost(raw: string): string {
  return raw.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

export function loadAppEnv(
  source: Record<string, string | undefined> = import.meta.env
): AppEnv {
  const configuredAppUrl = normalizeUrl(source.VITE_APP_URL ?? "");
  const runtimeOrigin =
    typeof window !== "undefined" ? normalizeUrl(window.location.origin) : "";
  return {
    apiUrl: normalizeUrl(source.VITE_API_URL ?? ""),
    cognitoRegion: (source.VITE_COGNITO_REGION ?? "").trim(),
    cognitoUserPoolId: (source.VITE_COGNITO_USER_POOL_ID ?? "").trim(),
    cognitoClientId: (source.VITE_COGNITO_CLIENT_ID ?? "").trim(),
    cognitoDomain: normalizeHost(source.VITE_COGNITO_DOMAIN ?? ""),
    cognitoScopes: (source.VITE_COGNITO_SCOPES ?? "openid email profile").trim(),
    appUrl: configuredAppUrl || runtimeOrigin,
  };
}

export function isCognitoConfigured(env: AppEnv): boolean {
  const required = [
    env.cognitoRegion,
    env.cognitoUserPoolId,
    env.cognitoClientId,
    env.cognitoDomain,
    env.appUrl,
  ];
  return required.every((v) => v.length > 0 && !v.includes("<"));
}
