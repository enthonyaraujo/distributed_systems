import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PageConflictError } from "../api/pagesApi";
import { ApiClientError, AuthSessionExpiredError } from "../api/tasksApi";
import {
  IconAlert,
  IconCalendar,
  IconChevronRight,
  IconRefresh,
  IconSave,
  IconTrash,
} from "../components/Icons";
import { RichTextEditor } from "../components/RichTextEditor";
import { AlertBanner } from "../components/ui/AlertBanner";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { EmptyState } from "../components/ui/EmptyState";
import { SkeletonBlock } from "../components/ui/Skeleton";
import { useToast } from "../components/ui/ToastContext";
import { useWorkspace } from "../context/WorkspaceContext";
import type { Page, ProseMirrorDoc } from "../types/page";
import {
  canStartAutosave,
  resolvePostSaveState,
} from "../utils/autosaveState";
import { formatShortDate } from "../utils/formatters";
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
  const { showToast } = useToast();

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
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const titleAreaRef = useRef<HTMLTextAreaElement | null>(null);
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

  // Auto-resize multiline title textarea cleanly on all viewports (HIGH-03)
  useEffect(() => {
    const el = titleAreaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [title, loading]);

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

  const persistDraft = useCallback(
    async (explicit = false) => {
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
        if (explicit && !transition.stillDirty) {
          showToast(`Página salva (v${updated.version}).`);
        }
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
    },
    [pageId, pagesApi, upsertPageSummary, showToast]
  );

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

  // Keyboard shortcut Ctrl+S / Cmd+S for immediate save (REF-05)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (saveState !== "conflict" && saveState !== "saving") {
          void persistDraft(true);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [persistDraft, saveState]);

  // Debounced auto-save (1.5s after idle edit)
  useEffect(() => {
    if (saveState !== "dirty") return;
    const timer = window.setTimeout(() => {
      void persistDraft(false);
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

  async function confirmDeletePage() {
    if (!page) return;
    setDeleting(true);
    try {
      await pagesApi.deletePage(page.id);
      removePageSummary(page.id);
      setConfirmDeleteOpen(false);
      showToast("Página excluída.");
      navigate("/pages", { replace: true });
    } catch (err) {
      if (err instanceof AuthSessionExpiredError) return;
      setConfirmDeleteOpen(false);
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
      <div className="editor-page" aria-busy="true" aria-label="Carregando página…">
        <div className="editor-topbar">
          <SkeletonBlock width="220px" height="22px" />
          <SkeletonBlock width="180px" height="32px" />
        </div>
        <article className="card document-paper skeleton-stack">
          <SkeletonBlock width="280px" height="38px" radius="12px" />
          <SkeletonBlock width="70%" height="34px" />
          <SkeletonBlock width="100%" height="44px" radius="12px" />
          <SkeletonBlock width="90%" height="18px" />
          <SkeletonBlock width="84%" height="18px" />
          <SkeletonBlock width="62%" height="18px" />
        </article>
      </div>
    );
  }

  if (loadError || !page || !content) {
    return (
      <EmptyState
        icon={<IconAlert size={24} />}
        title={loadError ?? "Página indisponível"}
        description="Não foi possível abrir esta página. Ela pode ter sido removida ou estar temporariamente inacessível."
        action={
          <Link to="/pages" className="btn btn-primary">
            Voltar para páginas
          </Link>
        }
      />
    );
  }

  const statusLabel: Record<SaveState, string> = {
    saved: `Salvo (v${page.version})`,
    dirty: "Alterações não salvas",
    saving: "Salvando…",
    error: "Erro ao salvar",
    conflict: "Conflito 409",
  };

  return (
    <div className="editor-page">
      <div className="editor-topbar">
        <nav className="editor-breadcrumb" aria-label="Navegação da página">
          <Link to="/pages" className="text-link">
            Páginas
          </Link>
          <IconChevronRight size={14} className="muted" />
          <span className="breadcrumb-current">{title || "Sem título"}</span>
        </nav>

        <div className="editor-actions">
          <span className={`save-pill save-${saveState}`} role="status">
            {statusLabel[saveState]}
          </span>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={saveState === "saving" || saveState === "conflict"}
            title="Salvar alterações (Ctrl+S)"
            onClick={() => void persistDraft(true)}
          >
            <IconSave size={14} />
            <span>Salvar</span>
          </button>
          <button
            type="button"
            className="btn btn-danger btn-sm"
            disabled={deleting}
            onClick={() => setConfirmDeleteOpen(true)}
          >
            <IconTrash size={14} />
            <span>Excluir</span>
          </button>
        </div>
      </div>

      {saveState === "conflict" && (
        <AlertBanner
          tone="warning"
          actionLabel="Recarregar página"
          actionIcon={<IconRefresh size={14} />}
          onAction={() => void loadPage()}
        >
          <strong>Conflito de salvamento (HTTP 409):</strong>{" "}
          {saveError ??
            "Esta página foi alterada em outra sessão. A edição foi bloqueada para evitar sobrescrita; recarregue a versão mais recente."}
        </AlertBanner>
      )}

      {saveState === "error" && saveError && (
        <AlertBanner
          actionLabel="Tentar salvar novamente"
          onAction={() => void persistDraft(true)}
        >
          {saveError}
        </AlertBanner>
      )}

      <article className="card document-paper">
        <div className="document-meta-bar">
          <div className="icon-picker" role="group" aria-label="Ícone da página">
            {ICON_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className={`icon-choice ${icon === preset ? "is-selected" : ""}`}
                aria-pressed={icon === preset}
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

          <span className="meta-chip">
            <IconCalendar size={13} />
            <span>Atualizada em {formatShortDate(page.updatedAt)}</span>
          </span>
        </div>

        <label className="sr-only" htmlFor="page-title-input">
          Título da página
        </label>
        <textarea
          ref={titleAreaRef}
          id="page-title-input"
          name="pageTitle"
          rows={1}
          autoComplete="off"
          className="document-title-input"
          value={title}
          maxLength={120}
          disabled={saveState === "conflict"}
          placeholder="Título da página…"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
            }
          }}
          onChange={(e) => {
            const next = e.target.value.replace(/\r?\n/g, " ");
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

      <ConfirmDialog
        open={confirmDeleteOpen}
        title="Excluir página"
        description={`Tem certeza de que deseja excluir permanentemente "${page.title}"?`}
        confirmLabel="Excluir página"
        busy={deleting}
        onConfirm={() => void confirmDeletePage()}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </div>
  );
}
