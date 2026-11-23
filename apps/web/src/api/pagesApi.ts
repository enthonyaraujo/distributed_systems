import type { ApiErrorEnvelope } from "../types/task";
import type {
  CreatePageInput,
  Page,
  PageSummary,
  UpdatePageInput,
} from "../types/page";
import { ApiClientError, AuthSessionExpiredError } from "./tasksApi";

export class PageConflictError extends ApiClientError {
  constructor(
    message = "Esta página foi modificada em outra sessão. Recarregue antes de salvar."
  ) {
    super(409, "VERSION_CONFLICT", message);
    this.name = "PageConflictError";
  }
}

export interface PagesApiOptions {
  apiUrl: string;
  getAccessToken: () => string | null;
  onUnauthorized?: () => void;
  fetchImpl?: typeof fetch;
}

export class PagesApiClient {
  private readonly apiUrl: string;
  private readonly getAccessToken: () => string | null;
  private readonly onUnauthorized?: () => void;
  private readonly fetchImpl: typeof fetch;

  constructor(options: PagesApiOptions) {
    this.apiUrl = options.apiUrl.replace(/\/+$/, "");
    this.getAccessToken = options.getAccessToken;
    this.onUnauthorized = options.onUnauthorized;
    this.fetchImpl = options.fetchImpl ?? fetch.bind(globalThis);
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    if (!this.apiUrl) {
      throw new ApiClientError(
        0,
        "API_NOT_CONFIGURED",
        "URL da API (VITE_API_URL) não configurada."
      );
    }

    const token = this.getAccessToken();
    if (!token) {
      this.onUnauthorized?.();
      throw new AuthSessionExpiredError(
        401,
        "Sessão ausente. Faça login novamente."
      );
    }

    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    headers.set("Accept", "application/json");
    if (init.body !== undefined) {
      headers.set("Content-Type", "application/json");
    }

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.apiUrl}${path}`, {
        ...init,
        headers,
      });
    } catch {
      throw new ApiClientError(
        0,
        "NETWORK_ERROR",
        "Não foi possível conectar à API de páginas. Verifique sua conexão."
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const rawText = await response.text();
    let parsed: unknown = null;
    if (rawText) {
      try {
        parsed = JSON.parse(rawText);
      } catch {
        parsed = null;
      }
    }

    if (!response.ok) {
      const envelope = parsed as Partial<ApiErrorEnvelope> | null;
      const code = envelope?.error?.code ?? `HTTP_${response.status}`;
      const message =
        envelope?.error?.message ??
        `Erro ao comunicar com a API (HTTP ${response.status}).`;

      if (response.status === 401 || response.status === 403) {
        this.onUnauthorized?.();
        throw new AuthSessionExpiredError(response.status, message);
      }
      if (response.status === 409) {
        throw new PageConflictError(message);
      }
      throw new ApiClientError(response.status, code, message);
    }

    return parsed as T;
  }

  async listPages(): Promise<PageSummary[]> {
    const data = await this.request<{ items: PageSummary[] }>("/pages", {
      method: "GET",
    });
    return Array.isArray(data?.items) ? data.items : [];
  }

  async getPage(id: string): Promise<Page> {
    return this.request<Page>(`/pages/${encodeURIComponent(id)}`, {
      method: "GET",
    });
  }

  async createPage(input: CreatePageInput): Promise<Page> {
    return this.request<Page>("/pages", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async updatePage(id: string, input: UpdatePageInput): Promise<Page> {
    return this.request<Page>(`/pages/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  async deletePage(id: string): Promise<void> {
    await this.request<void>(`/pages/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  }
}
