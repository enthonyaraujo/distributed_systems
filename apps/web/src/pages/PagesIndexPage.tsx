import { useDeferredValue, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useWorkspace } from "../context/WorkspaceContext";
import { PageConflictError } from "../api/pagesApi";
import { ApiClientError, AuthSessionExpiredError } from "../api/tasksApi";
import {
  IconAlert,
  IconCalendar,
  IconCheck,
  IconClose,
  IconEdit,
  IconPages,
  IconPlus,
  IconSearch,
  IconTrash,
} from "../components/Icons";
import { AlertBanner } from "../components/ui/AlertBanner";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { EmptyState } from "../components/ui/EmptyState";
import { SkeletonBlock } from "../components/ui/Skeleton";
import { useToast } from "../components/ui/ToastContext";
import type { PageSummary } from "../types/page";
import { formatShortDate } from "../utils/formatters";
import { validatePageTitle } from "../utils/pageValidation";

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
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PageSummary | null>(null);

  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  const filteredPages = useMemo(() => {
    if (!deferredQuery) return pages;
    return pages.filter((p) => p.title.toLowerCase().includes(deferredQuery));
  }, [pages, deferredQuery]);

  async function handleCreate() {
    setCreating(true);
    setError(null);
    try {
      const created = await createQuickPage("Nova página");
      showToast("Página criada.");
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

  function startInlineRename(page: PageSummary) {
    setRenamingId(page.id);
    setRenameDraft(page.title);
    setRenameError(null);
    setError(null);
  }

  function cancelInlineRename() {
    setRenamingId(null);
    setRenameDraft("");
    setRenameError(null);
  }

  async function submitInlineRename(event: FormEvent, page: PageSummary) {
    event.preventDefault();
    const trimmed = renameDraft.trim();
    if (trimmed === page.title) {
      cancelInlineRename();
      return;
    }

    const validationError = validatePageTitle(trimmed);
    if (validationError) {
      setRenameError(validationError);
      return;
    }

    setBusyId(page.id);
    setRenameError(null);
    setError(null);
    try {
      const updated = await pagesApi.updatePage(page.id, {
        title: trimmed,
        expectedVersion: page.version,
      });
      upsertPageSummary(updated);
      cancelInlineRename();
      showToast("Página renomeada.");
    } catch (err) {
      if (err instanceof AuthSessionExpiredError) return;
      if (err instanceof PageConflictError) {
        cancelInlineRename();
        setError(
          "A página foi alterada em outra sessão. A lista foi atualizada; tente renomear novamente."
        );
        void refreshPages();
        return;
      }
      setRenameError(
        err instanceof ApiClientError
          ? err.message
          : "Não foi possível renomear a página."
      );
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDeletePage() {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setBusyId(target.id);
    setError(null);
    try {
      await pagesApi.deletePage(target.id);
      removePageSummary(target.id);
      setPendingDelete(null);
      showToast("Página excluída.");
    } catch (err) {
      if (err instanceof AuthSessionExpiredError) return;
      setPendingDelete(null);
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
        <div className="page-header-copy">
          <h1 className="page-title">Páginas e Anotações</h1>
          <p className="page-subtitle">
            Estruture resumos de disciplinas, roteiros de estudo e checklists
            com salvamento automático.
          </p>
        </div>
        <div className="header-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={creating}
            onClick={() => void handleCreate()}
          >
            <IconPlus size={16} />
            <span>{creating ? "Criando…" : "Nova página"}</span>
          </button>
        </div>
      </header>

      {displayError && (
        <AlertBanner
          actionLabel="Recarregar"
          onAction={() => void refreshPages()}
        >
          {displayError}
        </AlertBanner>
      )}

      {pages.length > 0 && !loadingPages && (
        <div className="pages-toolbar">
          <div className="search-field">
            <span className="search-field-icon" aria-hidden="true">
              <IconSearch size={15} />
            </span>
            <label className="sr-only" htmlFor="pages-search">
              Buscar páginas
            </label>
            <input
              id="pages-search"
              name="pageSearch"
              type="search"
              autoComplete="off"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filtrar páginas por título…"
            />
          </div>
          <span className="meta-chip">
            {filteredPages.length} de {pages.length} página
            {pages.length === 1 ? "" : "s"}
          </span>
        </div>
      )}

      {loadingPages ? (
        <div
          className="pages-grid"
          aria-busy="true"
          aria-label="Carregando páginas…"
        >
          {[0, 1, 2].map((idx) => (
            <div key={idx} className="card skeleton-stack">
              <SkeletonBlock width="44px" height="44px" radius="12px" />
              <SkeletonBlock width="80%" height="20px" />
              <SkeletonBlock width="55%" height="14px" />
            </div>
          ))}
        </div>
      ) : pages.length === 0 ? (
        <EmptyState
          icon={<IconPages size={24} />}
          title="Nenhuma página criada ainda"
          description="Crie sua primeira página para começar a estruturar anotações, listas e checklists no editor visual."
          action={
            <button
              type="button"
              className="btn btn-secondary"
              disabled={creating}
              onClick={() => void handleCreate()}
            >
              <IconPlus size={16} />
              <span>Criar primeira página</span>
            </button>
          }
        />
      ) : filteredPages.length === 0 ? (
        <EmptyState
          title="Nenhuma página encontrada"
          description="Nenhuma página corresponde ao termo pesquisado."
          action={
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setQuery("")}
            >
              Limpar busca
            </button>
          }
        />
      ) : (
        <div className="pages-grid">
          {filteredPages.map((page) => {
            const isBusy = busyId === page.id;
            const isRenaming = renamingId === page.id;
            return (
              <article key={page.id} className="card page-card">
                {isRenaming ? (
                  <form
                    className="page-rename-form"
                    onSubmit={(e) => void submitInlineRename(e, page)}
                    noValidate
                  >
                    <div className="page-card-top">
                      <span className="page-card-icon-wrap" aria-hidden="true">
                        {page.icon}
                      </span>
                      <span
                        className="version-pill"
                        title={`Versão ${page.version}`}
                      >
                        v{page.version}
                      </span>
                    </div>
                    <div className="field">
                      <label htmlFor={`rename-${page.id}`}>
                        Novo título da página
                      </label>
                      <input
                        id={`rename-${page.id}`}
                        name="pageTitle"
                        type="text"
                        autoComplete="off"
                        maxLength={120}
                        value={renameDraft}
                        disabled={isBusy}
                        aria-invalid={Boolean(renameError)}
                        aria-describedby={
                          renameError ? `rename-err-${page.id}` : undefined
                        }
                        onChange={(e) => {
                          setRenameDraft(e.target.value);
                          if (renameError) setRenameError(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") cancelInlineRename();
                        }}
                      />
                      {renameError && (
                        <p
                          id={`rename-err-${page.id}`}
                          className="field-error"
                          role="alert"
                        >
                          <IconAlert size={14} />
                          <span>{renameError}</span>
                        </p>
                      )}
                    </div>
                    <div className="page-rename-actions">
                      <button
                        type="submit"
                        className="btn btn-primary btn-sm"
                        disabled={isBusy}
                      >
                        <IconCheck size={14} />
                        <span>{isBusy ? "Salvando…" : "Salvar"}</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={isBusy}
                        onClick={cancelInlineRename}
                      >
                        <IconClose size={14} />
                        <span>Cancelar</span>
                      </button>
                    </div>
                  </form>
                ) : (
                  <Link to={`/pages/${page.id}`} className="page-card-link">
                    <div className="page-card-top">
                      <span className="page-card-icon-wrap" aria-hidden="true">
                        {page.icon}
                      </span>
                      <span
                        className="version-pill"
                        title={`Versão ${page.version}`}
                      >
                        v{page.version}
                      </span>
                    </div>
                    <h3 className="page-card-title">{page.title}</h3>
                    <span className="page-card-meta">
                      <IconCalendar size={13} />
                      <span>Atualizada em {formatShortDate(page.updatedAt)}</span>
                    </span>
                  </Link>
                )}

                {!isRenaming && (
                  <div className="page-card-footer">
                    <div className="page-card-actions">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={isBusy}
                        onClick={() => startInlineRename(page)}
                      >
                        <IconEdit size={13} />
                        <span>Renomear</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        disabled={isBusy}
                        onClick={() => setPendingDelete(page)}
                      >
                        <IconTrash size={13} />
                        <span>Excluir</span>
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Excluir página"
        description={
          pendingDelete
            ? `Tem certeza de que deseja excluir permanentemente "${pendingDelete.title}"?`
            : ""
        }
        confirmLabel="Excluir página"
        busy={Boolean(pendingDelete && busyId === pendingDelete.id)}
        onConfirm={() => void confirmDeletePage()}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
