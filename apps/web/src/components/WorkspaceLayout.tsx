import { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { ApiClientError, AuthSessionExpiredError } from "../api/tasksApi";
import {
  AcadFlowMark,
  IconClose,
  IconDashboard,
  IconLogout,
  IconMenu,
  IconPages,
  IconPanelCollapse,
  IconPanelExpand,
  IconPlus,
  IconTasks,
} from "./Icons";
import { OfflineBanner } from "./ui/OfflineBanner";
import { useToast } from "./ui/ToastContext";
import { getUserInitials } from "../utils/formatters";

export function WorkspaceLayout() {
  const { userLabel, signOut } = useAuth();
  const { tasks, pages, loadingPages, createQuickPage } = useWorkspace();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [creatingPage, setCreatingPage] = useState(false);
  const [sidebarError, setSidebarError] = useState<string | null>(null);

  const openMenuBtnRef = useRef<HTMLButtonElement | null>(null);
  const closeMenuBtnRef = useRef<HTMLButtonElement | null>(null);
  const wasMobileOpenRef = useRef(false);

  const openTasksCount = useMemo(
    () => tasks.filter((t) => t.status !== "done").length,
    [tasks]
  );
  const userInitials = getUserInitials(userLabel);

  // Keyboard Escape & focus management for mobile navigation drawer (CRIT-03)
  useEffect(() => {
    if (mobileOpen) {
      wasMobileOpenRef.current = true;
      closeMenuBtnRef.current?.focus();
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          setMobileOpen(false);
        }
      };
      window.addEventListener("keydown", onKeyDown);
      return () => window.removeEventListener("keydown", onKeyDown);
    }

    if (wasMobileOpenRef.current) {
      wasMobileOpenRef.current = false;
      openMenuBtnRef.current?.focus();
    }
    return undefined;
  }, [mobileOpen]);

  async function handleNewPage() {
    setCreatingPage(true);
    setSidebarError(null);
    try {
      const created = await createQuickPage("Nova página");
      setMobileOpen(false);
      showToast("Página criada.");
      navigate(`/pages/${created.id}`);
    } catch (err) {
      if (err instanceof AuthSessionExpiredError) return;
      setSidebarError(
        err instanceof ApiClientError
          ? err.message
          : "Não foi possível criar a página."
      );
    } finally {
      setCreatingPage(false);
    }
  }

  return (
    <div
      className={`workspace-root ${collapsed ? "sidebar-is-collapsed" : ""}`}
    >
      <a className="skip-link" href="#main-content">
        Pular para o conteúdo principal
      </a>

      {mobileOpen && (
        <div
          className="sidebar-backdrop"
          aria-hidden="true"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        id="workspace-sidebar"
        className={`workspace-sidebar ${mobileOpen ? "is-mobile-open" : ""}`}
        aria-label="Navegação do workspace AcadFlow"
      >
        <div className="sidebar-header">
          <Link
            to="/"
            className="sidebar-brand"
            onClick={() => setMobileOpen(false)}
            title="Ir para o Dashboard"
          >
            <span className="brand-mark-wrap">
              <AcadFlowMark size={34} />
            </span>
            {!collapsed && (
              <div className="brand-text">
                <span className="brand-name" translate="no">
                  AcadFlow
                </span>
                <span className="brand-sub">Workspace acadêmico</span>
              </div>
            )}
          </Link>

          <button
            type="button"
            className="icon-btn desktop-only"
            aria-expanded={!collapsed}
            aria-controls="workspace-sidebar"
            aria-label={
              collapsed ? "Expandir barra lateral" : "Recolher barra lateral"
            }
            title={
              collapsed ? "Expandir barra lateral" : "Recolher barra lateral"
            }
            onClick={() => setCollapsed((prev) => !prev)}
          >
            {collapsed ? (
              <IconPanelExpand size={16} />
            ) : (
              <IconPanelCollapse size={16} />
            )}
          </button>

          <button
            ref={closeMenuBtnRef}
            type="button"
            className="icon-btn mobile-only"
            aria-label="Fechar menu"
            onClick={() => setMobileOpen(false)}
          >
            <IconClose size={18} />
          </button>
        </div>

        <div className="sidebar-nav-group">
          {!collapsed && (
            <span className="sidebar-section-title">Navegação</span>
          )}
          <nav className="sidebar-nav" aria-label="Seções principais">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `nav-item ${isActive ? "is-active" : ""}`
              }
              title={collapsed ? "Dashboard" : undefined}
              onClick={() => setMobileOpen(false)}
            >
              <span className="nav-icon">
                <IconDashboard size={18} />
              </span>
              {!collapsed && <span className="nav-label">Dashboard</span>}
            </NavLink>

            <NavLink
              to="/tasks"
              className={({ isActive }) =>
                `nav-item ${isActive ? "is-active" : ""}`
              }
              title={collapsed ? "Tarefas" : undefined}
              onClick={() => setMobileOpen(false)}
            >
              <span className="nav-icon">
                <IconTasks size={18} />
              </span>
              {!collapsed && (
                <>
                  <span className="nav-label">Tarefas</span>
                  <span
                    className="nav-count"
                    aria-label={`${openTasksCount} em aberto`}
                  >
                    {openTasksCount}
                  </span>
                </>
              )}
            </NavLink>

            <NavLink
              to="/pages"
              end
              className={({ isActive }) =>
                `nav-item ${isActive ? "is-active" : ""}`
              }
              title={collapsed ? "Páginas" : undefined}
              onClick={() => setMobileOpen(false)}
            >
              <span className="nav-icon">
                <IconPages size={18} />
              </span>
              {!collapsed && (
                <>
                  <span className="nav-label">Páginas</span>
                  <span
                    className="nav-count"
                    aria-label={`${pages.length} páginas`}
                  >
                    {pages.length}
                  </span>
                </>
              )}
            </NavLink>
          </nav>
        </div>

        {!collapsed ? (
          <>
            <div className="sidebar-divider" aria-hidden="true" />
            <section
              className="sidebar-pages"
              aria-labelledby="sidebar-pages-label"
            >
              <div className="sidebar-pages-header">
                <span
                  id="sidebar-pages-label"
                  className="sidebar-section-title"
                >
                  Páginas recentes
                </span>
                <button
                  type="button"
                  className="btn-inline-add"
                  disabled={creatingPage}
                  onClick={() => void handleNewPage()}
                  title="Criar nova página"
                >
                  <IconPlus size={12} />
                  <span>{creatingPage ? "…" : "Nova"}</span>
                </button>
              </div>

              {sidebarError && (
                <p className="sidebar-error" role="alert">
                  {sidebarError}
                </p>
              )}

              {loadingPages ? (
                <p className="sidebar-muted">Carregando páginas…</p>
              ) : pages.length === 0 ? (
                <p className="sidebar-muted">Nenhuma página criada.</p>
              ) : (
                <ul className="sidebar-page-list">
                  {pages.map((page) => (
                    <li key={page.id}>
                      <NavLink
                        to={`/pages/${page.id}`}
                        className={({ isActive }) =>
                          `sidebar-page-link ${isActive ? "is-active" : ""}`
                        }
                        onClick={() => setMobileOpen(false)}
                        title={page.title}
                      >
                        <span className="page-link-icon" aria-hidden="true">
                          {page.icon}
                        </span>
                        <span className="page-link-title">{page.title}</span>
                      </NavLink>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        ) : (
          <div className="sidebar-spacer" aria-hidden="true" />
        )}

        <div className="sidebar-footer">
          <div className="sidebar-user-card">
            <div className="sidebar-user-info">
              <span className="user-avatar" aria-hidden="true">
                {userInitials}
              </span>
              {!collapsed && (
                <div className="user-meta">
                  <span className="user-label" title={userLabel ?? ""}>
                    {userLabel ?? "Usuário autenticado"}
                  </span>
                  <span className="user-role">Conta conectada</span>
                </div>
              )}
            </div>
            <button
              type="button"
              className="btn-logout-icon"
              aria-label="Sair da conta"
              title="Sair"
              onClick={() => void signOut()}
            >
              <IconLogout size={16} />
            </button>
          </div>
        </div>
      </aside>

      <div className="workspace-main">
        <OfflineBanner />

        <header className="mobile-topbar mobile-only">
          <button
            ref={openMenuBtnRef}
            type="button"
            className="icon-btn"
            aria-expanded={mobileOpen}
            aria-controls="workspace-sidebar"
            aria-label="Abrir menu do workspace"
            onClick={() => setMobileOpen(true)}
          >
            <IconMenu size={18} />
          </button>
          <Link to="/" className="mobile-topbar-brand">
            <AcadFlowMark size={26} />
            <span className="brand-name" translate="no">
              AcadFlow
            </span>
          </Link>
          <button
            type="button"
            className="icon-btn"
            disabled={creatingPage}
            aria-label="Criar nova página"
            title="Nova página"
            onClick={() => void handleNewPage()}
          >
            <IconPlus size={18} />
          </button>
        </header>

        <main id="main-content" className="workspace-content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
