import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useWorkspace } from "../context/WorkspaceContext";
import { ApiClientError, AuthSessionExpiredError } from "../api/tasksApi";
import type { PageSummary } from "../types/page";

export function PagesIndexPage() {
  const {
    pagesApi,
    pages,
    loadingPages,
    pagesError,
    refreshPages,
    createQuickPage,
    upsertPageSummary,
    removePageSummary,
  } = useWorkspace();
  const navigate = useNavigate();

  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setCreating(true);
    setError(null);
    try {
      const created = await createQuickPage("Nova página");
      navigate(`/pages/${created.id}`);
    } catch (err) {
      if (err instanceof AuthSessionExpiredError) return;
      setError(
        err instanceof ApiClientError
          ? err.message
          : "Erro ao criar nova página."
      );
    } finally {
      setCreating(false);
    }
  }

  async function handleRename(page: PageSummary) {
    const nextTitle = window.prompt("Novo título da página:", page.title);
    if (!nextTitle || nextTitle.trim() === page.title) return;

    setBusyId(page.id);
    setError(null);
    try {
      const updated = await pagesApi.updatePage(page.id, {
        title: nextTitle.trim(),
        expectedVersion: page.version,
      });
      upsertPageSummary(updated);
    } catch (err) {
      if (err instanceof AuthSessionExpiredError) return;
      setError(
        err instanceof ApiClientError
          ? err.message
          : "Não foi possível renomear a página."
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(page: PageSummary) {
    if (!window.confirm(`Excluir a página "${page.title}"?`)) return;
    setBusyId(page.id);
    setError(null);
    try {
      await pagesApi.deletePage(page.id);
      removePageSummary(page.id);
    } catch (err) {
      if (err instanceof AuthSessionExpiredError) return;
      setError(
        err instanceof ApiClientError
          ? err.message
          : "Não foi possível excluir a página."
      );
    } finally {
      setBusyId(null);
    }
  }

  const displayError = error ?? pagesError;

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <h1>Páginas e Anotações</h1>
          <p className="muted">
            Organize resumos de disciplinas, roteiros de estudo e checklists.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          disabled={creating}
          onClick={() => void handleCreate()}
        >
          {creating ? "Criando..." : "+ Nova página"}
        </button>
      </header>

      {displayError && (
        <div className="alert alert-error error-row" role="alert">
          <span>{displayError}</span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => void refreshPages()}
          >
            Recarregar
          </button>
        </div>
      )}

      {loadingPages ? (
        <section className="card" aria-busy="true">
          <p className="muted">Carregando páginas...</p>
        </section>
      ) : pages.length === 0 ? (
        <section className="card empty-state">
          <h3>Nenhuma página criada ainda</h3>
          <p className="muted">
            Crie sua primeira página para começar a estruturar anotações no
            editor visual.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            disabled={creating}
            onClick={() => void handleCreate()}
          >
            Criar primeira página
          </button>
        </section>
      ) : (
        <div className="pages-grid">
          {pages.map((page) => {
            const isBusy = busyId === page.id;
            return (
              <article key={page.id} className="card page-card">
                <Link to={`/pages/${page.id}`} className="page-card-link">
                  <span className="page-card-icon" aria-hidden="true">
                    {page.icon}
                  </span>
                  <h3 className="page-card-title">{page.title}</h3>
                  <span className="muted small">
                    Atualizada em {page.updatedAt.slice(0, 10)} · v{page.version}
                  </span>
                </Link>
                <div className="page-card-actions">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={isBusy}
                    onClick={() => void handleRename(page)}
                  >
                    Renomear
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    disabled={isBusy}
                    onClick={() => void handleDelete(page)}
                  >
                    Excluir
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
