import { useState } from "react";
import { ApiClientError, AuthSessionExpiredError } from "../api/tasksApi";
import { TaskForm } from "../components/TaskForm";
import { TaskList } from "../components/TaskList";
import { useWorkspace } from "../context/WorkspaceContext";
import type { CreateTaskInput, Task, TaskStatus } from "../types/task";

export function TasksPage() {
  const {
    tasksApi,
    tasks,
    setTasks,
    loadingTasks,
    tasksError,
    refreshTasks,
  } = useWorkspace();

  const [actionError, setActionError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  async function handleSaveTask(input: CreateTaskInput): Promise<boolean> {
    setSubmitting(true);
    setActionError(null);
    try {
      if (editingTask) {
        const updated = await tasksApi.updateTask(editingTask.id, input);
        setTasks((prev) =>
          prev.map((item) => (item.id === updated.id ? updated : item))
        );
        setEditingTask(null);
      } else {
        const created = await tasksApi.createTask(input);
        setTasks((prev) => [created, ...prev]);
      }
      return true;
    } catch (err) {
      if (err instanceof AuthSessionExpiredError) return false;
      setActionError(
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
    setActionError(null);
    try {
      const updated = await tasksApi.updateTask(task.id, { status: nextStatus });
      setTasks((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item))
      );
    } catch (err) {
      if (err instanceof AuthSessionExpiredError) return;
      setActionError(
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
    setActionError(null);
    try {
      await tasksApi.deleteTask(task.id);
      setTasks((prev) => prev.filter((item) => item.id !== task.id));
      if (editingTask?.id === task.id) {
        setEditingTask(null);
      }
    } catch (err) {
      if (err instanceof AuthSessionExpiredError) return;
      setActionError(
        err instanceof ApiClientError
          ? err.message
          : "Erro ao excluir atividade."
      );
    } finally {
      setBusyTaskId(null);
    }
  }

  const combinedError = actionError ?? tasksError;

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <h1>Tarefas Acadêmicas</h1>
          <p className="muted">
            Crie, atualize o status e acompanhe suas entregas e prazos.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={loadingTasks}
          onClick={() => void refreshTasks()}
        >
          Atualizar
        </button>
      </header>

      <TaskForm
        editingTask={editingTask}
        submitting={submitting}
        onSubmit={handleSaveTask}
        onCancelEdit={() => setEditingTask(null)}
      />

      {combinedError && (
        <div className="alert alert-error error-row" role="alert">
          <span>{combinedError}</span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => void refreshTasks()}
          >
            Tentar novamente
          </button>
        </div>
      )}

      <section aria-labelledby="tasks-heading">
        <div className="section-header">
          <h2 id="tasks-heading">Minhas atividades ({tasks.length})</h2>
        </div>

        {loadingTasks ? (
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
    </div>
  );
}
