import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { AcadFlowMark } from "../components/Icons";
import { AlertBanner } from "../components/ui/AlertBanner";

export function CallbackPage() {
  const { completeCallback } = useAuth();
  const navigate = useNavigate();
  const processedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (processedRef.current) return;
    processedRef.current = true;

    completeCallback()
      .then(() => {
        // Replace callback URL so authorization code/state do not stay in history
        navigate("/", { replace: true });
      })
      .catch(() => {
        setError(
          "Não foi possível concluir a autenticação. Tente entrar novamente."
        );
      });
  }, [completeCallback, navigate]);

  return (
    <main className="center-shell">
      <section className="card status-card">
        <AcadFlowMark size={44} />
        {error ? (
          <>
            <h2>Falha no login</h2>
            <AlertBanner>{error}</AlertBanner>
            <Link to="/login" className="btn btn-primary btn-full">
              Voltar para o login
            </Link>
          </>
        ) : (
          <div className="status-card-row" aria-busy="true">
            <span className="spinner" aria-hidden="true" />
            <span>Concluindo login seguro…</span>
          </div>
        )}
      </section>
    </main>
  );
}
