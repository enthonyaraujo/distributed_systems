import { useDeferredValue, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ApiClientError, AuthSessionExpiredError } from "../api/tasksApi";
import { IconPlus, IconRefresh, IconSearch } from "../components/Icons";
import { TaskForm } from "../components/TaskForm";
import { TaskList } from "../components/TaskList";
import { AlertBanner } from "../components/ui/AlertBanner";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { EmptyState } from "../components/ui/EmptyState";
import { SkeletonBlock } from "../components/ui/Skeleton";
import { useToast } from "../components/ui/ToastContext";
import { useWorkspace } from "../context/WorkspaceContext";
import type { CreateTaskInput, Task, TaskStatus } from "../types/task";
import { TASK_PRIORITY_RANK } from "../utils/formatters";

type StatusFilter = "all" | TaskStatus;
type SortMode = "recent" | "due_asc" | "priority";

function parseStatusParam(raw: string | null): StatusFilter {
  if (raw === "pending" || raw === "in_progress" || raw === "done") {
    return raw;
  }
  return "all";
}

export function TasksPage() {
  const {
    tasksApi,
    tasks,
    setTasks,
    loadingTasks,
    tasksError,
    refreshTasks,
  } = useWorkspace();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const statusFilter = parseStatusParam(searchParams.get("status"));

  const [actionError, setActionError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Task | null>(null);
  const [mobileFormOpen, setMobileFormOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("recent");

  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  function setStatusFilter(next: StatusFilter) {
    setSearchParams(
      (prev) => {
        const updated = new URLSearchParams(prev);
        if (next === "all") {
          updated.delete("status");
        } else {
          updated.set("status", next);
        }
        return updated;
      },
      { replace: true }
    );
  }

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
        setMobileFormOpen(false);
        showToast("Atividade atualizada.");
      } else {
        const created = await tasksApi.createTask(input);
        setTasks((prev) => [created, ...prev]);
        setMobileFormOpen(false);
        showToast("Atividade criada.");
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
      const updated = await tasksApi.updateTask(task.id, {
        status: nextStatus,
      });
      setTasks((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item))
      );
      showToast("Status atualizado.");
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

  async function confirmDeleteTask() {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setBusyTaskId(target.id);
    setActionError(null);
    try {
      await tasksApi.deleteTask(target.id);
      setTasks((prev) => prev.filter((item) => item.id !== target.id));
      if (editingTask?.id === target.id) {
        setEditingTask(null);
      }
      setPendingDelete(null);
      showToast("Atividade excluída.");
    } catch (err) {
      if (err instanceof AuthSessionExpiredError) return;
      setPendingDelete(null);
      setActionError(
        err instanceof ApiClientError
          ? err.message
          : "Erro ao excluir atividade."
      );
    } finally {
      setBusyTaskId(null);
    }
  }

  const counts = useMemo(() => {
    let pending = 0;
    let inProgress = 0;
    let done = 0;
    for (const item of tasks) {
      if (item.status === "pending") pending += 1;
      else if (item.status === "in_progress") inProgress += 1;
      else done += 1;
    }
    return { pending, inProgress, done };
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    const matching = tasks.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (!deferredQuery) return true;
      return (
        item.title.toLowerCase().includes(deferredQuery) ||
        item.description.toLowerCase().includes(deferredQuery)
      );
    });

    if (sortMode === "recent") return matching;

    return [...matching].sort((a, b) => {
      if (sortMode === "due_asc") {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      }
      return TASK_PRIORITY_RANK[a.priority] - TASK_PRIORITY_RANK[b.priority];
    });
  }, [tasks, statusFilter, deferredQuery, sortMode]);

  const combinedError = actionError ?? tasksError;
  const formVisibleCompact =
    mobileFormOpen || editingTask !== null || tasks.length === 0;
  const hasActiveFilters = statusFilter !== "all" || deferredQuery.length > 0;

  return (
    <div className="page-stack">
      <header className="page-header">
        <div className="page-header-copy">
          <h1 className="page-title">Tarefas Acadêmicas</h1>
          <p className="page-subtitle">
            Organize prazos, priorize entregas e acompanhe o progresso de cada
            atividade.
          </p>
        </div>
        <div className="header-actions">
          <button
            type="button"
            className="btn btn-primary compact-only-btn"
            aria-expanded={formVisibleCompact}
            onClick={() => setMobileFormOpen((prev) => !prev)}
          >
            <IconPlus size={15} />
            <span>
              {formVisibleCompact ? "Ocultar formulário" : "Nova atividade"}
            </span>
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={loadingTasks}
            onClick={() => void refreshTasks()}
          >
            <IconRefresh size={15} />
            <span>Atualizar</span>
          </button>
        </div>
      </header>

      {combinedError && (
        <AlertBanner
          actionLabel="Tentar novamente"
          onAction={() => void refreshTasks()}
        >
          {combinedError}
        </AlertBanner>
      )}

      <div className="tasks-workbench">
        <div
          className={`task-form-collapsible ${!formVisibleCompact ? "is-collapsed-compact" : ""}`}
        >
          <TaskForm
            editingTask={editingTask}
            submitting={submitting}
            onSubmit={handleSaveTask}
            onCancelEdit={() => {
              setEditingTask(null);
              setMobileFormOpen(false);
            }}
          />
        </div>

        <section className="stack-compact" aria-labelledby="tasks-heading">
          <div className="tasks-toolbar">
            <h2 id="tasks-heading" className="section-title">
              Minhas atividades ({filteredTasks.length})
            </h2>

            <div
              className="filter-tabs"
              role="tablist"
              aria-label="Filtrar tarefas por status"
            >
              <button
                type="button"
                role="tab"
                aria-selected={statusFilter === "all"}
                className={`filter-tab ${statusFilter === "all" ? "is-active" : ""}`}
                onClick={() => setStatusFilter("all")}
              >
                <span>Todas</span>
                <span className="filter-tab-count">{tasks.length}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={statusFilter === "pending"}
                className={`filter-tab ${statusFilter === "pending" ? "is-active" : ""}`}
                onClick={() => setStatusFilter("pending")}
              >
                <span>Pendentes</span>
                <span className="filter-tab-count">{counts.pending}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={statusFilter === "in_progress"}
                className={`filter-tab ${statusFilter === "in_progress" ? "is-active" : ""}`}
                onClick={() => setStatusFilter("in_progress")}
              >
                <span>Em andamento</span>
                <span className="filter-tab-count">{counts.inProgress}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={statusFilter === "done"}
                className={`filter-tab ${statusFilter === "done" ? "is-active" : ""}`}
                onClick={() => setStatusFilter("done")}
              >
                <span>Concluídas</span>
                <span className="filter-tab-count">{counts.done}</span>
              </button>
            </div>
          </div>

          {tasks.length > 0 && (
            <div className="tasks-controls-row">
              <div className="search-field">
                <span className="search-field-icon" aria-hidden="true">
                  <IconSearch size={15} />
                </span>
                <label className="sr-only" htmlFor="tasks-search">
                  Buscar atividades
                </label>
                <input
                  id="tasks-search"
                  name="taskSearch"
                  type="search"
                  autoComplete="off"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar por título ou descrição…"
                />
              </div>

              <label className="sr-only" htmlFor="tasks-sort">
                Ordenar atividades
              </label>
              <select
                id="tasks-sort"
                name="taskSort"
                className="tasks-sort-select"
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
              >
                <option value="recent">Mais recentes</option>
                <option value="due_asc">Prazo mais próximo</option>
                <option value="priority">Maior prioridade</option>
              </select>
            </div>
          )}

          {loadingTasks ? (
            <div
              className="skeleton-stack"
              aria-busy="true"
              aria-label="Carregando atividades…"
            >
              <div className="card skeleton-stack">
                <SkeletonBlock width="65%" height="20px" />
                <SkeletonBlock width="92%" height="15px" />
                <SkeletonBlock width="40%" height="14px" />
              </div>
              <div className="card skeleton-stack">
                <SkeletonBlock width="58%" height="20px" />
                <SkeletonBlock width="84%" height="15px" />
                <SkeletonBlock width="36%" height="14px" />
              </div>
            </div>
          ) : tasks.length > 0 && filteredTasks.length === 0 ? (
            <EmptyState
              title="Nenhuma atividade encontrada"
              description={
                hasActiveFilters
                  ? "Nenhuma atividade corresponde aos filtros ou busca aplicados."
                  : "Não há atividades nesta visualização."
              }
              action={
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setStatusFilter("all");
                    setQuery("");
                  }}
                >
                  Limpar filtros
                </button>
              }
            />
          ) : (
            <TaskList
              tasks={filteredTasks}
              busyTaskId={busyTaskId}
              onStatusChange={handleStatusChange}
              onEdit={(task) => {
                setEditingTask(task);
                setMobileFormOpen(true);
              }}
              onDelete={async (task) => {
                setPendingDelete(task);
              }}
            />
          )}
        </section>
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Excluir atividade"
        description={
          pendingDelete
            ? `Tem certeza de que deseja excluir "${pendingDelete.title}"? Esta ação não pode ser desfeita.`
            : ""
        }
        confirmLabel="Excluir atividade"
        busy={Boolean(pendingDelete && busyTaskId === pendingDelete.id)}
        onConfirm={() => void confirmDeleteTask()}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
