import type {
  ApiErrorEnvelope,
  CreateTaskInput,
  Task,
  UpdateTaskInput,
} from "../types/task";

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
  }
}

export class AuthSessionExpiredError extends ApiClientError {
  constructor(status: number, message: string) {
    super(status, "UNAUTHORIZED", message);
    this.name = "AuthSessionExpiredError";
  }
}

export interface TasksApiOptions {
  apiUrl: string;
  getAccessToken: () => string | null;
  onUnauthorized?: () => void;
  fetchImpl?: typeof fetch;
}

export class TasksApiClient {
  private readonly apiUrl: string;
  private readonly getAccessToken: () => string | null;
  private readonly onUnauthorized?: () => void;
  private readonly fetchImpl: typeof fetch;

  constructor(options: TasksApiOptions) {
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
        "Não foi possível conectar à API. Verifique sua conexão e tente novamente."
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
      throw new ApiClientError(response.status, code, message);
    }

    return parsed as T;
  }

  async listTasks(): Promise<Task[]> {
    const data = await this.request<{ items: Task[] }>("/tasks", {
      method: "GET",
    });
    return Array.isArray(data?.items) ? data.items : [];
  }

  async getTask(id: string): Promise<Task> {
    return this.request<Task>(`/tasks/${encodeURIComponent(id)}`, {
      method: "GET",
    });
  }

  async createTask(input: CreateTaskInput): Promise<Task> {
    return this.request<Task>("/tasks", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async updateTask(id: string, input: UpdateTaskInput): Promise<Task> {
    return this.request<Task>(`/tasks/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  async deleteTask(id: string): Promise<void> {
    await this.request<void>(`/tasks/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  }
}
