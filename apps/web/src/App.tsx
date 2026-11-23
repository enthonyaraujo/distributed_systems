import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { WorkspaceLayout } from "./components/WorkspaceLayout";
import { WorkspaceProvider } from "./context/WorkspaceContext";
import { CallbackPage } from "./pages/CallbackPage";
import { LoginPage } from "./pages/LoginPage";
import { PageEditorPage } from "./pages/PageEditorPage";
import { PagesIndexPage } from "./pages/PagesIndexPage";
import { TasksPage } from "./pages/TasksPage";
import { WorkspaceDashboardPage } from "./pages/WorkspaceDashboardPage";

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
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
            <Route index element={<WorkspaceDashboardPage />} />
            <Route path="tasks" element={<TasksPage />} />
            <Route path="pages" element={<PagesIndexPage />} />
            <Route path="pages/:pageId" element={<PageEditorPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
