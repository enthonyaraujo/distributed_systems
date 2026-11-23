import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useWorkspace } from "../context/WorkspaceContext";
import { ApiClientError, AuthSessionExpiredError } from "../api/tasksApi";

export function WorkspaceDashboardPage() {
  const {
    tasks,
    pages,
    loadingTasks,
    loadingPages,
    tasksError,
    pagesError,
    refreshTasks,
    refreshPages,
    createQuickPage,
  } = useWorkspace();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const pendingCount = tasks.filter((t) => t.status === "pending").length;
  const inProgressCount = tasks.filter((t) => t.status === "in_progress").length;
  const doneCount = tasks.filter((t) => t.status === "done").length;
  const activeTasks = tasks.filter((t) => t.status !== "done").slice(0, 5);
  const recentPages = pages.slice(0, 5);

  async function handleCreatePage() {
    setCreating(true);
    setActionError(null);
    try {
      const page = await createQuickPage("Nova página");
      navigate(`/pages/${page.id}`);
    } catch (err) {
      if (err instanceof AuthSessionExpiredError) return;
      setActionError(
        err instanceof ApiClientError
          ? err.message
          : "Não foi possível criar a página."
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <h1>Dashboard Acadêmico</h1>
          <p className="muted">
            Visão integrada das suas anotações, páginas e atividades acadêmicas.
          </p>
        </div>
        <div className="header-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={creating}
            onClick={() => void handleCreatePage()}
          >
            {creating ? "Criando..." : "+ Nova página"}
          </button>
          <Link to="/tasks" className="btn btn-secondary">
            Gerenciar tarefas
          </Link>
        </div>
      </header>

      {actionError && (
        <p className="alert alert-error" role="alert">
          {actionError}
        </p>
      )}

      <section className="stats-grid" aria-label="Resumo do workspace">
        <div className="card stat-card">
          <span className="stat-label">Páginas</span>
          <strong className="stat-value">
            {loadingPages ? "…" : pages.length}
          </strong>
        </div>
        <div className="card stat-card">
          <span className="stat-label">Tarefas pendentes</span>
          <strong className="stat-value">
            {loadingTasks ? "…" : pendingCount}
          </strong>
        </div>
        <div className="card stat-card">
          <span className="stat-label">Em andamento</span>
          <strong className="stat-value">
            {loadingTasks ? "…" : inProgressCount}
          </strong>
        </div>
        <div className="card stat-card">
          <span className="stat-label">Concluídas</span>
          <strong className="stat-value">
            {loadingTasks ? "…" : doneCount}
          </strong>
        </div>
      </section>

      <div className="dashboard-columns">
        <section className="card" aria-labelledby="recent-pages-heading">
          <div className="section-header">
            <h2 id="recent-pages-heading">Páginas recentes</h2>
            <Link to="/pages" className="text-link">
              Ver todas
            </Link>
          </div>

          {pagesError && (
            <div className="alert alert-error error-row" role="alert">
              <span>{pagesError}</span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => void refreshPages()}
              >
                Tentar novamente
              </button>
            </div>
          )}

          {loadingPages ? (
            <p className="muted">Carregando páginas...</p>
          ) : recentPages.length === 0 ? (
            <div className="empty-inline">
              <p className="muted">
                Você ainda não criou páginas de anotações.
              </p>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={creating}
                onClick={() => void handleCreatePage()}
              >
                Criar primeira página
              </button>
            </div>
          ) : (
            <ul className="compact-list">
              {recentPages.map((page) => (
                <li key={page.id}>
                  <Link to={`/pages/${page.id}`} className="compact-row">
                    <span className="compact-row-main">
                      <span aria-hidden="true">{page.icon}</span>
                      <span>{page.title}</span>
                    </span>
                    <span className="muted small">v{page.version}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card" aria-labelledby="active-tasks-heading">
          <div className="section-header">
            <h2 id="active-tasks-heading">Atividades em aberto</h2>
            <Link to="/tasks" className="text-link">
              Abrir tarefas
            </Link>
          </div>

          {tasksError && (
            <div className="alert alert-error error-row" role="alert">
              <span>{tasksError}</span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => void refreshTasks()}
              >
                Tentar novamente
              </button>
            </div>
          )}

          {loadingTasks ? (
            <p className="muted">Carregando atividades...</p>
          ) : activeTasks.length === 0 ? (
            <div className="empty-inline">
              <p className="muted">Nenhuma atividade pendente ou em andamento.</p>
              <Link to="/tasks" className="btn btn-secondary btn-sm">
                Cadastrar atividade
              </Link>
            </div>
          ) : (
            <ul className="compact-list">
              {activeTasks.map((task) => (
                <li key={task.id}>
                  <Link to="/tasks" className="compact-row">
                    <span className="compact-row-main">
                      <span className={`dot priority-dot-${task.priority}`} />
                      <span>{task.title}</span>
                    </span>
                    <span className="muted small">
                      {task.dueDate ?? "Sem prazo"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
