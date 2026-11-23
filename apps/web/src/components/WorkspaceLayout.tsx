import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { ApiClientError, AuthSessionExpiredError } from "../api/tasksApi";

export function WorkspaceLayout() {
  const { userLabel, signOut } = useAuth();
  const { pages, loadingPages, createQuickPage } = useWorkspace();
  const navigate = useNavigate();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [creatingPage, setCreatingPage] = useState(false);
  const [sidebarError, setSidebarError] = useState<string | null>(null);

  async function handleNewPage() {
    setCreatingPage(true);
    setSidebarError(null);
    try {
      const created = await createQuickPage("Nova página");
      setMobileOpen(false);
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
      {mobileOpen && (
        <div
          className="sidebar-backdrop"
          aria-hidden="true"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`workspace-sidebar ${mobileOpen ? "is-mobile-open" : ""}`}
        aria-label="Navegação do workspace AcadFlow"
      >
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <span className="brand-mark" aria-hidden="true">
              AF
            </span>
            {!collapsed && (
              <div>
                <span className="brand-name">AcadFlow</span>
                <span className="brand-sub">Workspace Acadêmico</span>
              </div>
            )}
          </div>

          <button
            type="button"
            className="icon-btn desktop-only"
            aria-label={
              collapsed ? "Expandir barra lateral" : "Recolher barra lateral"
            }
            title={
              collapsed ? "Expandir barra lateral" : "Recolher barra lateral"
            }
            onClick={() => setCollapsed((prev) => !prev)}
          >
            {collapsed ? "»" : "«"}
          </button>

          <button
            type="button"
            className="icon-btn mobile-only"
            aria-label="Fechar menu"
            onClick={() => setMobileOpen(false)}
          >
            ✕
          </button>
        </div>

        <nav className="sidebar-nav" aria-label="Seções principais">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `nav-item ${isActive ? "is-active" : ""}`
            }
            onClick={() => setMobileOpen(false)}
          >
            <span className="nav-icon" aria-hidden="true">
              ⌂
            </span>
            {!collapsed && <span>Dashboard</span>}
          </NavLink>

          <NavLink
            to="/tasks"
            className={({ isActive }) =>
              `nav-item ${isActive ? "is-active" : ""}`
            }
            onClick={() => setMobileOpen(false)}
          >
            <span className="nav-icon" aria-hidden="true">
              ☑
            </span>
            {!collapsed && <span>Tarefas</span>}
          </NavLink>

          <NavLink
            to="/pages"
            end
            className={({ isActive }) =>
              `nav-item ${isActive ? "is-active" : ""}`
            }
            onClick={() => setMobileOpen(false)}
          >
            <span className="nav-icon" aria-hidden="true">
              ▤
            </span>
            {!collapsed && <span>Páginas</span>}
          </NavLink>
        </nav>

        {!collapsed && (
          <section
            className="sidebar-pages"
            aria-labelledby="sidebar-pages-label"
          >
            <div className="sidebar-pages-header">
              <span id="sidebar-pages-label" className="sidebar-section-title">
                Minhas páginas
              </span>
              <button
                type="button"
                className="btn-inline-add"
                disabled={creatingPage}
                onClick={() => void handleNewPage()}
                title="Criar nova página"
              >
                {creatingPage ? "..." : "+ Nova"}
              </button>
            </div>

            {sidebarError && (
              <p className="sidebar-error" role="alert">
                {sidebarError}
              </p>
            )}

            {loadingPages ? (
              <p className="sidebar-muted">Carregando páginas...</p>
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
        )}

        <div className="sidebar-footer">
          {!collapsed && (
            <span className="user-label" title={userLabel ?? ""}>
              {userLabel}
            </span>
          )}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => void signOut()}
          >
            Sair
          </button>
        </div>
      </aside>

      <div className="workspace-main">
        <header className="mobile-topbar mobile-only">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            aria-label="Abrir menu do workspace"
            onClick={() => setMobileOpen(true)}
          >
            ☰ Menu
          </button>
          <span className="brand-name">AcadFlow</span>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={creatingPage}
            onClick={() => void handleNewPage()}
          >
            + Página
          </button>
        </header>

        <main className="workspace-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
