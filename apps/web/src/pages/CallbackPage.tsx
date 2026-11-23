import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

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
      <section className="card">
        {error ? (
          <>
            <h2>Falha no login</h2>
            <p className="alert alert-error" role="alert">
              {error}
            </p>
            <Link to="/login" className="btn btn-primary">
              Voltar para o login
            </Link>
          </>
        ) : (
          <p className="muted">Concluindo login seguro (PKCE)...</p>
        )}
      </section>
    </main>
  );
}
