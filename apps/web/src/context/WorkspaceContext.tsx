import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "../auth/AuthContext";
import {
  ApiClientError,
  AuthSessionExpiredError,
  TasksApiClient,
} from "../api/tasksApi";
import { PagesApiClient } from "../api/pagesApi";
import type { Page, PageSummary } from "../types/page";
import type { Task } from "../types/task";

interface WorkspaceContextValue {
  tasksApi: TasksApiClient;
  pagesApi: PagesApiClient;
  tasks: Task[];
  pages: PageSummary[];
  loadingTasks: boolean;
  loadingPages: boolean;
  tasksError: string | null;
  pagesError: string | null;
  refreshTasks: () => Promise<void>;
  refreshPages: () => Promise<void>;
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  createQuickPage: (title?: string) => Promise<Page>;
  upsertPageSummary: (page: PageSummary) => void;
  removePageSummary: (pageId: string) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { env, accessToken, handleSessionExpired } = useAuth();

  const tasksApi = useMemo(
    () =>
      new TasksApiClient({
        apiUrl: env.apiUrl,
        getAccessToken: () => accessToken,
        onUnauthorized: () => {
          void handleSessionExpired();
        },
      }),
    [env.apiUrl, accessToken, handleSessionExpired]
  );

  const pagesApi = useMemo(
    () =>
      new PagesApiClient({
        apiUrl: env.apiUrl,
        getAccessToken: () => accessToken,
        onUnauthorized: () => {
          void handleSessionExpired();
        },
      }),
    [env.apiUrl, accessToken, handleSessionExpired]
  );

  const [tasks, setTasks] = useState<Task[]>([]);
  const [pages, setPages] = useState<PageSummary[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [loadingPages, setLoadingPages] = useState(true);
  const [tasksError, setTasksError] = useState<string | null>(null);
  const [pagesError, setPagesError] = useState<string | null>(null);

  const refreshTasks = useCallback(async () => {
    setLoadingTasks(true);
    setTasksError(null);
    try {
      const items = await tasksApi.listTasks();
      setTasks(items);
    } catch (err) {
      if (err instanceof AuthSessionExpiredError) return;
      setTasksError(
        err instanceof ApiClientError
          ? err.message
          : "Erro inesperado ao carregar atividades."
      );
    } finally {
      setLoadingTasks(false);
    }
  }, [tasksApi]);

  const refreshPages = useCallback(async () => {
    setLoadingPages(true);
    setPagesError(null);
    try {
      const items = await pagesApi.listPages();
      setPages(items);
    } catch (err) {
      if (err instanceof AuthSessionExpiredError) return;
      setPagesError(
        err instanceof ApiClientError
          ? err.message
          : "Erro inesperado ao carregar páginas."
      );
    } finally {
      setLoadingPages(false);
    }
  }, [pagesApi]);

  useEffect(() => {
    void refreshTasks();
    void refreshPages();
  }, [refreshTasks, refreshPages]);

  const upsertPageSummary = useCallback((summary: PageSummary) => {
    setPages((prev) => {
      const without = prev.filter((p) => p.id !== summary.id);
      return [
        {
          id: summary.id,
          title: summary.title,
          icon: summary.icon,
          version: summary.version,
          createdAt: summary.createdAt,
          updatedAt: summary.updatedAt,
        },
        ...without,
      ];
    });
  }, []);

  const removePageSummary = useCallback((pageId: string) => {
    setPages((prev) => prev.filter((p) => p.id !== pageId));
  }, []);

  const createQuickPage = useCallback(
    async (title = "Nova página") => {
      const created = await pagesApi.createPage({ title });
      upsertPageSummary(created);
      return created;
    },
    [pagesApi, upsertPageSummary]
  );

  const value: WorkspaceContextValue = {
    tasksApi,
    pagesApi,
    tasks,
    pages,
    loadingTasks,
    loadingPages,
    tasksError,
    pagesError,
    refreshTasks,
    refreshPages,
    setTasks,
    createQuickPage,
    upsertPageSummary,
    removePageSummary,
  };

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useWorkspace must be used inside WorkspaceProvider.");
  }
  return ctx;
}
