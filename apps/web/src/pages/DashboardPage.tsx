import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import {
  ApiClientError,
  AuthSessionExpiredError,
  TasksApiClient,
} from "../api/tasksApi";
import { TaskForm } from "../components/TaskForm";
import { TaskList } from "../components/TaskList";
import type { CreateTaskInput, Task, TaskStatus } from "../types/task";

export function DashboardPage() {
  const { env, accessToken, userLabel, signOut, handleSessionExpired } =
    useAuth();

  const api = useMemo(
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

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await api.listTasks();
      setTasks(items);
    } catch (err) {
      if (err instanceof AuthSessionExpiredError) {
        return;
      }
      setError(
        err instanceof ApiClientError
          ? err.message
          : "Erro inesperado ao carregar atividades."
      );
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  async function handleSaveTask(input: CreateTaskInput): Promise<boolean> {
    setSubmitting(true);
    setError(null);
    try {
      if (editingTask) {
        const updated = await api.updateTask(editingTask.id, input);
        setTasks((prev) =>
          prev.map((item) => (item.id === updated.id ? updated : item))
        );
        setEditingTask(null);
      } else {
        const created = await api.createTask(input);
        setTasks((prev) => [created, ...prev]);
      }
      return true;
    } catch (err) {
      if (err instanceof AuthSessionExpiredError) return false;
      setError(
        err instanceof ApiClientError
          ? err.message
          : "Erro inesperado ao salvar atividade."
      );
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(task: Task, nextStatus: TaskStatus) {
    setBusyTaskId(task.id);
    setError(null);
    try {
      const updated = await api.updateTask(task.id, { status: nextStatus });
      setTasks((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item))
      );
    } catch (err) {
      if (err instanceof AuthSessionExpiredError) return;
      setError(
        err instanceof ApiClientError
          ? err.message
          : "Erro ao atualizar status da atividade."
      );
    } finally {
      setBusyTaskId(null);
    }
  }

  async function handleDelete(task: Task) {
    if (!window.confirm(`Excluir a atividade "${task.title}"?`)) {
      return;
    }
    setBusyTaskId(task.id);
    setError(null);
    try {
      await api.deleteTask(task.id);
      setTasks((prev) => prev.filter((item) => item.id !== task.id));
      if (editingTask?.id === task.id) {
        setEditingTask(null);
      }
    } catch (err) {
      if (err instanceof AuthSessionExpiredError) return;
      setError(
        err instanceof ApiClientError
          ? err.message
          : "Erro ao excluir atividade."
      );
    } finally {
      setBusyTaskId(null);
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <h1 className="brand">AcadFlow</h1>
          <p className="muted small">Atividades acadêmicas</p>
        </div>

        <div className="user-bar">
          <span className="user-label" title={userLabel ?? ""}>
            {userLabel}
          </span>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void signOut()}
          >
            Sair
          </button>
        </div>
      </header>

      <main className="content">
        <TaskForm
          editingTask={editingTask}
          submitting={submitting}
          onSubmit={handleSaveTask}
          onCancelEdit={() => setEditingTask(null)}
        />

        {error && (
          <div className="alert alert-error error-row" role="alert">
            <span>{error}</span>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void loadTasks()}
            >
              Tentar novamente
            </button>
          </div>
        )}

        <section aria-labelledby="tasks-heading">
          <div className="section-header">
            <h2 id="tasks-heading">Minhas atividades</h2>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={loading}
              onClick={() => void loadTasks()}
            >
              Atualizar
            </button>
          </div>

          {loading ? (
            <section className="card" aria-busy="true">
              <p className="muted">Carregando atividades...</p>
            </section>
          ) : (
            <TaskList
              tasks={tasks}
              busyTaskId={busyTaskId}
              onStatusChange={handleStatusChange}
              onEdit={setEditingTask}
              onDelete={handleDelete}
            />
          )}
        </section>
      </main>
    </div>
  );
}
