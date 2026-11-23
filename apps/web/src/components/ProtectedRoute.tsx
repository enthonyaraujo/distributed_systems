import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../auth/AuthContext";
import { AcadFlowMark } from "./Icons";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <main className="center-shell">
        <section className="card status-card" aria-busy="true">
          <AcadFlowMark size={44} />
          <div className="status-card-row">
            <span className="spinner" aria-hidden="true" />
            <span>Verificando sessão…</span>
          </div>
        </section>
      </main>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
