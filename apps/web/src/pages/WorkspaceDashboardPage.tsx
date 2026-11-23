import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useWorkspace } from "../context/WorkspaceContext";
import { ApiClientError, AuthSessionExpiredError } from "../api/tasksApi";
import {
  IconActivity,
  IconCalendar,
  IconCheckCircle,
  IconClock,
  IconPages,
  IconPlus,
  IconTasks,
} from "../components/Icons";
import { AlertBanner } from "../components/ui/AlertBanner";
import { EmptyState } from "../components/ui/EmptyState";
import { SkeletonBlock } from "../components/ui/Skeleton";
import { useToast } from "../components/ui/ToastContext";
import {
  computeDashboardMetrics,
  formatShortDate,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
} from "../utils/formatters";

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
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const metrics = useMemo(() => computeDashboardMetrics(tasks), [tasks]);
  const recentPages = useMemo(() => pages.slice(0, 5), [pages]);

  const latestPageDate = pages[0]?.updatedAt
    ? formatShortDate(pages[0].updatedAt)
    : null;

  async function handleCreatePage() {
    setCreating(true);
    setActionError(null);
    try {
      const page = await createQuickPage("Nova página");
      showToast("Página criada.");
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
        <div className="page-header-copy">
          <h1 className="page-title">Dashboard Acadêmico</h1>
          <p className="page-subtitle">
            Acompanhe suas anotações, prazos e andamento das disciplinas em um
            só painel.
          </p>
        </div>
        <div className="header-actions has-multiple">
          <button
            type="button"
            className="btn btn-primary"
            disabled={creating}
            onClick={() => void handleCreatePage()}
          >
            <IconPlus size={16} />
            <span>{creating ? "Criando…" : "Nova página"}</span>
          </button>
          <Link to="/tasks" className="btn btn-secondary">
            <IconTasks size={16} />
            <span>Gerenciar tarefas</span>
          </Link>
        </div>
      </header>

      {actionError && <AlertBanner>{actionError}</AlertBanner>}

      <section className="stats-grid" aria-label="Indicadores do workspace">
        <article className="card stat-card stat-tone-primary">
          <div className="stat-card-top">
            <span className="stat-label">Total de páginas</span>
            <span className="stat-icon-badge" aria-hidden="true">
              <IconPages size={18} />
            </span>
          </div>
          <div className="stat-card-body">
            {loadingPages ? (
              <>
                <SkeletonBlock width="56px" height="32px" />
                <SkeletonBlock width="128px" height="16px" />
              </>
            ) : (
              <>
                <strong className="stat-value">{pages.length}</strong>
                <span className="stat-footnote">
                  {latestPageDate
                    ? `Atualizada em ${latestPageDate}`
                    : "Nenhuma anotação"}
                </span>
              </>
            )}
          </div>
        </article>

        <article className="card stat-card stat-tone-warning">
          <div className="stat-card-top">
            <span className="stat-label">Tarefas pendentes</span>
            <span className="stat-icon-badge" aria-hidden="true">
              <IconClock size={18} />
            </span>
          </div>
          <div className="stat-card-body">
            {loadingTasks ? (
              <>
                <SkeletonBlock width="56px" height="32px" />
                <SkeletonBlock width="116px" height="22px" radius="999px" />
              </>
            ) : (
              <>
                <strong className="stat-value">{metrics.pendingCount}</strong>
                <span className="stat-footnote">
                  {metrics.highPendingCount > 0 ? (
                    <span className="stat-pill stat-pill-warning">
                      {metrics.highPendingCount} alta prioridade
                    </span>
                  ) : metrics.totalTasks > 0 ? (
                    "Sem urgências pendentes"
                  ) : (
                    "Aguardando registros"
                  )}
                </span>
              </>
            )}
          </div>
        </article>

        <article className="card stat-card stat-tone-navy">
          <div className="stat-card-top">
            <span className="stat-label">Em andamento</span>
            <span className="stat-icon-badge" aria-hidden="true">
              <IconActivity size={18} />
            </span>
          </div>
          <div className="stat-card-body">
            {loadingTasks ? (
              <>
                <SkeletonBlock width="56px" height="32px" />
                <SkeletonBlock width="104px" height="22px" radius="999px" />
              </>
            ) : (
              <>
                <strong className="stat-value">
                  {metrics.inProgressCount}
                </strong>
                <span className="stat-footnote">
                  {metrics.totalTasks > 0 ? (
                    <span className="stat-pill stat-pill-primary">
                      {metrics.inProgressPct}% em curso
                    </span>
                  ) : (
                    "Nenhuma em execução"
                  )}
                </span>
              </>
            )}
          </div>
        </article>

        <article className="card stat-card stat-tone-success">
          <div className="stat-card-top">
            <span className="stat-label">Concluídas</span>
            <span className="stat-icon-badge" aria-hidden="true">
              <IconCheckCircle size={18} />
            </span>
          </div>
          <div className="stat-card-body">
            {loadingTasks ? (
              <>
                <SkeletonBlock width="56px" height="32px" />
                <SkeletonBlock width="104px" height="22px" radius="999px" />
              </>
            ) : (
              <>
                <strong className="stat-value">{metrics.doneCount}</strong>
                <span className="stat-footnote">
                  {metrics.totalTasks > 0 ? (
                    <span className="stat-pill stat-pill-success">
                      {metrics.completionPct}% concluídas
                    </span>
                  ) : (
                    "Aguardando registros"
                  )}
                </span>
              </>
            )}
          </div>
        </article>
      </section>

      <section
        className="dashboard-overview-grid"
        aria-label="Panorama das atividades"
      >
        <article
          className="card progress-overview-card"
          aria-busy={loadingTasks}
        >
          <div className="section-header section-header-flush">
            <div className="section-heading-group">
              <h2 className="section-title">Progresso das atividades</h2>
              <p className="section-caption">
                Distribuição real entre tarefas concluídas, em andamento e
                pendentes.
              </p>
            </div>
            {loadingTasks ? (
              <SkeletonBlock width="84px" height="28px" />
            ) : (
              <div className="progress-header-metric">
                <strong className="progress-percent">
                  {metrics.completionPct}%
                </strong>
                <span className="small muted">
                  ({metrics.doneCount}/{metrics.totalTasks})
                </span>
              </div>
            )}
          </div>

          {loadingTasks ? (
            <>
              <SkeletonBlock width="100%" height="12px" radius="999px" />
              <div className="progress-legend">
                <SkeletonBlock width="110px" height="16px" />
                <SkeletonBlock width="130px" height="16px" />
                <SkeletonBlock width="110px" height="16px" />
              </div>
            </>
          ) : (
            <>
              <div
                className="progress-bar-track"
                role="img"
                aria-label={`Progresso: ${metrics.doneCount} concluídas, ${metrics.inProgressCount} em andamento e ${metrics.pendingCount} pendentes`}
              >
                {metrics.totalTasks > 0 && (
                  <>
                    {metrics.doneCount > 0 && (
                      <div
                        className="progress-seg progress-seg-done"
                        style={{
                          width: `${(metrics.doneCount / metrics.totalTasks) * 100}%`,
                        }}
                      />
                    )}
                    {metrics.inProgressCount > 0 && (
                      <div
                        className="progress-seg progress-seg-progress"
                        style={{
                          width: `${(metrics.inProgressCount / metrics.totalTasks) * 100}%`,
                        }}
                      />
                    )}
                    {metrics.pendingCount > 0 && (
                      <div
                        className="progress-seg progress-seg-pending"
                        style={{
                          width: `${(metrics.pendingCount / metrics.totalTasks) * 100}%`,
                        }}
                      />
                    )}
                  </>
                )}
              </div>

              <div className="progress-legend">
                <span className="legend-item">
                  <span
                    className="legend-swatch swatch-done"
                    aria-hidden="true"
                  />
                  Concluídas: <strong>{metrics.doneCount}</strong> (
                  {metrics.completionPct}%)
                </span>
                <span className="legend-item">
                  <span
                    className="legend-swatch swatch-progress"
                    aria-hidden="true"
                  />
                  Em andamento: <strong>{metrics.inProgressCount}</strong> (
                  {metrics.inProgressPct}%)
                </span>
                <span className="legend-item">
                  <span
                    className="legend-swatch swatch-pending"
                    aria-hidden="true"
                  />
                  Pendentes: <strong>{metrics.pendingCount}</strong> (
                  {metrics.pendingPct}%)
                </span>
              </div>
            </>
          )}
        </article>

        <article className="card focus-card" aria-busy={loadingTasks}>
          <div className="focus-body">
            <span className="focus-eyebrow">
              <IconCalendar size={14} />
              <span>Próximo foco acadêmico</span>
            </span>
            {loadingTasks ? (
              <div className="skeleton-stack">
                <SkeletonBlock width="85%" height="22px" />
                <SkeletonBlock width="60%" height="16px" />
              </div>
            ) : metrics.nextDueTask ? (
              <>
                <h2 className="focus-task-title">
                  {metrics.nextDueTask.title}
                </h2>
                <div className="focus-meta-row">
                  <span>
                    Prazo: {formatShortDate(metrics.nextDueTask.dueDate)}
                  </span>
                  <span>
                    Prioridade{" "}
                    {TASK_PRIORITY_LABELS[metrics.nextDueTask.priority]}
                  </span>
                </div>
              </>
            ) : metrics.totalTasks === 0 ? (
              <>
                <h2 className="focus-task-title">
                  Comece registrando suas entregas
                </h2>
                <div className="focus-meta-row">
                  <span>
                    Adicione sua primeira tarefa com prazo para destacar aqui.
                  </span>
                </div>
              </>
            ) : (
              <>
                <h2 className="focus-task-title">
                  Todas as atividades concluídas
                </h2>
                <div className="focus-meta-row">
                  <span>Nenhuma tarefa pendente ou em andamento.</span>
                </div>
              </>
            )}
          </div>

          <div
            className="focus-priority-summary"
            aria-label="Atividades em aberto por prioridade"
          >
            <div className="focus-mini-stat">
              <span className="focus-mini-label">Alta (abertas)</span>
              <strong className="focus-mini-value">
                {loadingTasks ? "—" : metrics.openHighCount}
              </strong>
            </div>
            <div className="focus-mini-stat">
              <span className="focus-mini-label">Média</span>
              <strong className="focus-mini-value">
                {loadingTasks ? "—" : metrics.openMediumCount}
              </strong>
            </div>
            <div className="focus-mini-stat">
              <span className="focus-mini-label">Baixa</span>
              <strong className="focus-mini-value">
                {loadingTasks ? "—" : metrics.openLowCount}
              </strong>
            </div>
          </div>
        </article>
      </section>

      <div className="dashboard-columns">
        <section className="card" aria-labelledby="recent-pages-heading">
          <div className="section-header">
            <div className="section-heading-group">
              <h2 id="recent-pages-heading" className="section-title">
                Páginas recentes
              </h2>
              <p className="section-caption">
                Acesso rápido aos documentos atualizados recentemente.
              </p>
            </div>
            <Link to="/pages" className="text-link">
              Ver todas
            </Link>
          </div>

          {pagesError && (
            <AlertBanner
              actionLabel="Tentar novamente"
              onAction={() => void refreshPages()}
            >
              {pagesError}
            </AlertBanner>
          )}

          {loadingPages ? (
            <div className="skeleton-stack" aria-busy="true">
              <SkeletonBlock height="56px" radius="12px" />
              <SkeletonBlock height="56px" radius="12px" />
              <SkeletonBlock height="56px" radius="12px" />
            </div>
          ) : recentPages.length === 0 ? (
            <EmptyState
              variant="inline"
              description="Você ainda não criou páginas de anotações."
              action={
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={creating}
                  onClick={() => void handleCreatePage()}
                >
                  <IconPlus size={14} />
                  <span>Criar primeira página</span>
                </button>
              }
            />
          ) : (
            <ul className="compact-list">
              {recentPages.map((page) => (
                <li key={page.id}>
                  <Link to={`/pages/${page.id}`} className="compact-row">
                    <span className="compact-row-main">
                      <span className="compact-icon-chip" aria-hidden="true">
                        {page.icon}
                      </span>
                      <span className="compact-text-stack">
                        <span className="compact-title">{page.title}</span>
                        <span className="compact-sub">
                          Atualizada em {formatShortDate(page.updatedAt)}
                        </span>
                      </span>
                    </span>
                    <span className="compact-row-aside">
                      <span
                        className="version-pill"
                        title={`Versão ${page.version}`}
                      >
                        v{page.version}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card" aria-labelledby="active-tasks-heading">
          <div className="section-header">
            <div className="section-heading-group">
              <h2 id="active-tasks-heading" className="section-title">
                Atividades em aberto
              </h2>
              <p className="section-caption">
                Entregas pendentes e em andamento com prioridade destacada.
              </p>
            </div>
            <Link to="/tasks" className="text-link">
              Abrir tarefas
            </Link>
          </div>

          {tasksError && (
            <AlertBanner
              actionLabel="Tentar novamente"
              onAction={() => void refreshTasks()}
            >
              {tasksError}
            </AlertBanner>
          )}

          {loadingTasks ? (
            <div className="skeleton-stack" aria-busy="true">
              <SkeletonBlock height="56px" radius="12px" />
              <SkeletonBlock height="56px" radius="12px" />
              <SkeletonBlock height="56px" radius="12px" />
            </div>
          ) : metrics.activeTasks.length === 0 ? (
            <EmptyState
              variant="inline"
              description={
                metrics.totalTasks === 0
                  ? "Nenhuma atividade registrada até o momento."
                  : "Nenhuma atividade pendente ou em andamento."
              }
              action={
                <Link to="/tasks" className="btn btn-secondary btn-sm">
                  <IconPlus size={14} />
                  <span>Cadastrar atividade</span>
                </Link>
              }
            />
          ) : (
            <ul className="compact-list">
              {metrics.activeTasks.map((task) => (
                <li key={task.id}>
                  <Link to="/tasks" className="compact-row">
                    <span className="compact-row-main">
                      <span
                        className={`dot priority-dot-${task.priority}`}
                        aria-hidden="true"
                      />
                      <span className="compact-text-stack">
                        <span className="compact-title">{task.title}</span>
                        <span className="compact-sub">
                          <span>{TASK_STATUS_LABELS[task.status]}</span>
                          <span>
                            Prioridade {TASK_PRIORITY_LABELS[task.priority]}
                          </span>
                        </span>
                      </span>
                    </span>
                    <span className="compact-row-aside">
                      <span className="meta-chip">
                        <IconCalendar size={13} />
                        <span>{formatShortDate(task.dueDate)}</span>
                      </span>
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
