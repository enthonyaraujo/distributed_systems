import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { User, UserManager } from "oidc-client-ts";
import { isCognitoConfigured, loadAppEnv, type AppEnv } from "../config/env";
import {
  buildCognitoLogoutUrl,
  buildOidcSettings,
  revokeCognitoRefreshToken,
} from "./oidcConfig";

export interface AuthContextValue {
  env: AppEnv;
  isConfigured: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  userLabel: string | null;
  accessToken: string | null;
  authError: string | null;
  signIn: () => Promise<void>;
  completeCallback: () => Promise<void>;
  signOut: () => Promise<void>;
  handleSessionExpired: (message?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const env = useMemo(() => loadAppEnv(), []);
  const configured = useMemo(() => isCognitoConfigured(env), [env]);
  const manager = useMemo(() => {
    if (!configured) {
      return null;
    }
    return new UserManager(buildOidcSettings(env, window.sessionStorage));
  }, [configured, env]);

  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(configured);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (!manager) {
      setIsLoading(false);
      return;
    }

    let active = true;
    manager
      .getUser()
      .then((loaded) => {
        if (!active) return;
        if (loaded && !loaded.expired && loaded.access_token) {
          setUser(loaded);
        } else {
          setUser(null);
        }
      })
      .catch(() => {
        if (active) {
          setUser(null);
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    const onExpired = () => {
      setUser(null);
      setAuthError("Sua sessão expirou. Faça login novamente.");
    };

    manager.events.addAccessTokenExpired(onExpired);
    return () => {
      active = false;
      manager.events.removeAccessTokenExpired(onExpired);
    };
  }, [manager]);

  const signIn = useCallback(async () => {
    if (!manager) {
      setAuthError("Cognito ainda não configurado neste ambiente.");
      return;
    }
    setAuthError(null);
    await manager.signinRedirect();
  }, [manager]);

  const completeCallback = useCallback(async () => {
    if (!manager) {
      throw new Error("Cognito não configurado.");
    }
    const authenticatedUser = await manager.signinRedirectCallback();
    if (!authenticatedUser.access_token) {
      throw new Error("Access token ausente na resposta de autenticação.");
    }
    setUser(authenticatedUser);
    setAuthError(null);
  }, [manager]);

  const handleSessionExpired = useCallback(
    async (message = "Sessão inválida ou expirada. Faça login novamente.") => {
      if (manager) {
        await manager.removeUser();
      }
      setUser(null);
      setAuthError(message);
    },
    [manager]
  );

  const signOut = useCallback(async () => {
    const refreshToken = user?.refresh_token ?? "";
    if (refreshToken) {
      await revokeCognitoRefreshToken(env, refreshToken);
    }
    if (manager) {
      await manager.removeUser();
    }
    setUser(null);
    setAuthError(null);
    if (configured) {
      window.location.assign(buildCognitoLogoutUrl(env));
    }
  }, [configured, env, manager, user]);

  const isAuthenticated = Boolean(user && !user.expired && user.access_token);
  const userLabel = useMemo(() => {
    if (!user) return null;
    const email = user.profile?.email;
    if (typeof email === "string" && email.trim()) return email;
    const username = user.profile?.["cognito:username"];
    if (typeof username === "string" && username.trim()) return username;
    return user.profile?.sub ?? "Usuário autenticado";
  }, [user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      env,
      isConfigured: configured,
      isLoading,
      isAuthenticated,
      userLabel,
      accessToken: isAuthenticated ? (user?.access_token ?? null) : null,
      authError,
      signIn,
      completeCallback,
      signOut,
      handleSessionExpired,
    }),
    [
      env,
      configured,
      isLoading,
      isAuthenticated,
      userLabel,
      user,
      authError,
      signIn,
      completeCallback,
      signOut,
      handleSessionExpired,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }
  return ctx;
}
