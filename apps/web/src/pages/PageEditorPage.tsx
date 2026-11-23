import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PageConflictError } from "../api/pagesApi";
import { ApiClientError, AuthSessionExpiredError } from "../api/tasksApi";
import { RichTextEditor } from "../components/RichTextEditor";
import { useWorkspace } from "../context/WorkspaceContext";
import type { Page, ProseMirrorDoc } from "../types/page";
import {
  canStartAutosave,
  resolvePostSaveState,
} from "../utils/autosaveState";
import {
  validatePageContentSize,
  validatePageIcon,
  validatePageTitle,
} from "../utils/pageValidation";

const ICON_PRESETS = ["📄", "📘", "📝", "🧪", "🎯", "📅", "💡", "✅"];

type SaveState = "saved" | "dirty" | "saving" | "error" | "conflict";

export function PageEditorPage() {
  const { pageId } = useParams<{ pageId: string }>();
  const navigate = useNavigate();
  const { pagesApi, upsertPageSummary, removePageSummary } = useWorkspace();

  const [page, setPage] = useState<Page | null>(null);
  const [title, setTitle] = useState("");
  const [icon, setIcon] = useState("📄");
  const [content, setContent] = useState<ProseMirrorDoc | null>(null);
  const [editorResetKey, setEditorResetKey] = useState(0);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const versionRef = useRef<number>(1);
  const dirtyRef = useRef<boolean>(false);
  const savingRef = useRef<boolean>(false);
  const editSeqRef = useRef<number>(0);
  const loadSeqRef = useRef<number>(0);
  const activePageIdRef = useRef<string | undefined>(pageId);
  const latestDraftRef = useRef<{
    title: string;
    icon: string;
    content: ProseMirrorDoc | null;
  }>({ title: "", icon: "📄", content: null });

  useEffect(() => {
    activePageIdRef.current = pageId;
  }, [pageId]);

  const loadPage = useCallback(async () => {
    if (!pageId) return;
    const requestSeq = ++loadSeqRef.current;
    const targetPageId = pageId;
    setLoading(true);
    setLoadError(null);
    setSaveError(null);
    try {
      const loaded = await pagesApi.getPage(targetPageId);
      if (
        loadSeqRef.current !== requestSeq ||
        activePageIdRef.current !== targetPageId
      ) {
        return;
      }
      setPage(loaded);
      setTitle(loaded.title);
      setIcon(loaded.icon);
      setContent(loaded.content);
      versionRef.current = loaded.version;
      dirtyRef.current = false;
      savingRef.current = false;
      editSeqRef.current += 1;
      latestDraftRef.current = {
        title: loaded.title,
        icon: loaded.icon,
        content: loaded.content,
      };
      setSaveState("saved");
      setEditorResetKey((k) => k + 1);
      upsertPageSummary(loaded);
    } catch (err) {
      if (
        loadSeqRef.current !== requestSeq ||
        activePageIdRef.current !== targetPageId
      ) {
        return;
      }
      if (err instanceof AuthSessionExpiredError) return;
      setPage(null);
      setLoadError(
        err instanceof ApiClientError && err.status === 404
          ? "Página não encontrada ou indisponível."
          : err instanceof ApiClientError
            ? err.message
            : "Erro ao carregar a página."
      );
    } finally {
      if (loadSeqRef.current === requestSeq) {
        setLoading(false);
      }
    }
  }, [pageId, pagesApi, upsertPageSummary]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  const persistDraft = useCallback(async () => {
    if (!pageId || !canStartAutosave(savingRef.current, dirtyRef.current)) {
      return;
    }
    const draft = latestDraftRef.current;
    if (!draft.content) return;

    const titleErr = validatePageTitle(draft.title);
    const iconErr = validatePageIcon(draft.icon);
    const sizeErr = validatePageContentSize(draft.content);
    const validationErr = titleErr ?? iconErr ?? sizeErr;
    if (validationErr) {
      setSaveState("error");
      setSaveError(validationErr);
      return;
    }

    const targetPageId = pageId;
    const seqAtSaveStart = editSeqRef.current;
    savingRef.current = true;
    setSaveState("saving");
    setSaveError(null);
    try {
      const updated = await pagesApi.updatePage(targetPageId, {
        title: draft.title.trim(),
        icon: draft.icon.trim() || "📄",
        content: draft.content,
        expectedVersion: versionRef.current,
      });
      upsertPageSummary(updated);
      if (activePageIdRef.current !== targetPageId) {
        return;
      }
      versionRef.current = updated.version;
      setPage(updated);
      const transition = resolvePostSaveState(
        seqAtSaveStart,
        editSeqRef.current
      );
      dirtyRef.current = transition.stillDirty;
      setSaveState(transition.nextSaveState);
    } catch (err) {
      if (activePageIdRef.current !== targetPageId) {
        return;
      }
      if (err instanceof AuthSessionExpiredError) return;
      if (err instanceof PageConflictError) {
        setSaveState("conflict");
        setSaveError(err.message);
        return;
      }
      setSaveState("error");
      setSaveError(
        err instanceof ApiClientError
          ? err.message
          : "Falha ao salvar a página."
      );
    } finally {
      if (activePageIdRef.current === targetPageId) {
        savingRef.current = false;
      }
    }
  }, [pageId, pagesApi, upsertPageSummary]);

  // Warn before accidental tab reload/close while edits have not been persisted yet
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current && !savingRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  // Debounced auto-save (1.5s after idle edit)
  useEffect(() => {
    if (saveState !== "dirty") return;
    const timer = window.setTimeout(() => {
      void persistDraft();
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [saveState, title, icon, content, persistDraft]);

  function markDirty(next: {
    title?: string;
    icon?: string;
    content?: ProseMirrorDoc;
  }) {
    latestDraftRef.current = {
      title: next.title ?? latestDraftRef.current.title,
      icon: next.icon ?? latestDraftRef.current.icon,
      content: next.content ?? latestDraftRef.current.content,
    };
    editSeqRef.current += 1;
    dirtyRef.current = true;
    setSaveState("dirty");
    setSaveError(null);
  }

  async function handleDelete() {
    if (!page) return;
    if (!window.confirm(`Excluir permanentemente a página "${page.title}"?`)) {
      return;
    }
    setDeleting(true);
    try {
      await pagesApi.deletePage(page.id);
      removePageSummary(page.id);
      navigate("/pages", { replace: true });
    } catch (err) {
      if (err instanceof AuthSessionExpiredError) return;
      setSaveError(
        err instanceof ApiClientError
          ? err.message
          : "Erro ao excluir a página."
      );
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <section className="card" aria-busy="true">
        <p className="muted">Carregando página...</p>
      </section>
    );
  }

  if (loadError || !page || !content) {
    return (
      <section className="card empty-state">
        <h2>{loadError ?? "Página indisponível"}</h2>
        <div className="header-actions" style={{ justifyContent: "center" }}>
          <Link to="/pages" className="btn btn-primary">
            Voltar para páginas
          </Link>
        </div>
      </section>
    );
  }

  const statusLabel: Record<SaveState, string> = {
    saved: `Salvo (v${page.version})`,
    dirty: "Alterações não salvas",
    saving: "Salvando...",
    error: "Erro ao salvar",
    conflict: "Conflito de versão",
  };

  return (
    <div className="editor-page">
      <div className="editor-topbar">
        <div className="editor-breadcrumb">
          <Link to="/pages" className="text-link">
            Páginas
          </Link>
          <span className="muted">/</span>
          <span className="muted truncate">{title || "Sem título"}</span>
        </div>

        <div className="editor-actions">
          <span className={`save-pill save-${saveState}`} role="status">
            {statusLabel[saveState]}
          </span>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={saveState === "saving" || saveState === "conflict"}
            onClick={() => void persistDraft()}
          >
            Salvar
          </button>
          <button
            type="button"
            className="btn btn-danger btn-sm"
            disabled={deleting}
            onClick={() => void handleDelete()}
          >
            Excluir
          </button>
        </div>
      </div>

      {saveState === "conflict" && (
        <div className="alert alert-warning error-row" role="alert">
          <span>
            <strong>Conflito de salvamento (409):</strong>{" "}
            {saveError ??
              "Esta página foi alterada em outra sessão. Recarregue para evitar perda de dados."}
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => void loadPage()}
          >
            Recarregar página
          </button>
        </div>
      )}

      {saveState === "error" && saveError && (
        <div className="alert alert-error error-row" role="alert">
          <span>{saveError}</span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => void persistDraft()}
          >
            Tentar salvar novamente
          </button>
        </div>
      )}

      <article className="card document-paper">
        <div className="icon-picker" role="group" aria-label="Ícone da página">
          {ICON_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              className={`icon-choice ${icon === preset ? "is-selected" : ""}`}
              disabled={saveState === "conflict"}
              onClick={() => {
                setIcon(preset);
                markDirty({ icon: preset });
              }}
              title={`Usar ícone ${preset}`}
            >
              {preset}
            </button>
          ))}
        </div>

        <label className="sr-only" htmlFor="page-title-input">
          Título da página
        </label>
        <input
          id="page-title-input"
          type="text"
          className="document-title-input"
          value={title}
          maxLength={120}
          disabled={saveState === "conflict"}
          placeholder="Título da página..."
          onChange={(e) => {
            const next = e.target.value;
            setTitle(next);
            markDirty({ title: next });
          }}
        />

        <RichTextEditor
          key={`${page.id}-${editorResetKey}`}
          initialContent={content}
          disabled={saveState === "conflict"}
          onChange={(nextDoc) => {
            setContent(nextDoc);
            markDirty({ content: nextDoc });
          }}
        />
      </article>
    </div>
  );
}
