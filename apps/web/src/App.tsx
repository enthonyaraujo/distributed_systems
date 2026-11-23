import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { PageSkeleton } from "./components/ui/Skeleton";
import { ToastProvider } from "./components/ui/ToastContext";
import { WorkspaceLayout } from "./components/WorkspaceLayout";
import { WorkspaceProvider } from "./context/WorkspaceContext";

const LoginPage = lazy(() =>
  import("./pages/LoginPage").then((m) => ({ default: m.LoginPage }))
);
const CallbackPage = lazy(() =>
  import("./pages/CallbackPage").then((m) => ({ default: m.CallbackPage }))
);
const WorkspaceDashboardPage = lazy(() =>
  import("./pages/WorkspaceDashboardPage").then((m) => ({
    default: m.WorkspaceDashboardPage,
  }))
);
const TasksPage = lazy(() =>
  import("./pages/TasksPage").then((m) => ({ default: m.TasksPage }))
);
const PagesIndexPage = lazy(() =>
  import("./pages/PagesIndexPage").then((m) => ({ default: m.PagesIndexPage }))
);
const PageEditorPage = lazy(() =>
  import("./pages/PageEditorPage").then((m) => ({ default: m.PageEditorPage }))
);

function FullScreenFallback() {
  return (
    <main className="center-shell">
      <section className="card status-card" aria-busy="true">
        <div className="status-card-row">
          <span className="spinner" aria-hidden="true" />
          <span>Carregando aplicação…</span>
        </div>
      </section>
    </main>
  );
}

export function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Suspense fallback={<FullScreenFallback />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/auth/callback" element={<CallbackPage />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <WorkspaceProvider>
                      <WorkspaceLayout />
                    </WorkspaceProvider>
                  </ProtectedRoute>
                }
              >
                <Route
                  index
                  element={
                    <Suspense fallback={<PageSkeleton />}>
                      <WorkspaceDashboardPage />
                    </Suspense>
                  }
                />
                <Route
                  path="tasks"
                  element={
                    <Suspense fallback={<PageSkeleton />}>
                      <TasksPage />
                    </Suspense>
                  }
                />
                <Route
                  path="pages"
                  element={
                    <Suspense fallback={<PageSkeleton />}>
                      <PagesIndexPage />
                    </Suspense>
                  }
                />
                <Route
                  path="pages/:pageId"
                  element={
                    <Suspense fallback={<PageSkeleton />}>
                      <PageEditorPage />
                    </Suspense>
                  }
                />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
