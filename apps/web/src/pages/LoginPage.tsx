import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function LoginPage() {
  const { isAuthenticated, isLoading, isConfigured, authError, signIn } =
    useAuth();

  if (isLoading) {
    return (
      <main className="center-shell">
        <section className="card">
          <p className="muted">Carregando autenticação...</p>
        </section>
      </main>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <main className="center-shell">
      <section className="card login-card">
        <h1>AcadFlow</h1>
        <p className="muted">
          Gerenciador de atividades acadêmicas — Projeto Final de Sistemas
          Distribuídos (UFERSA).
        </p>

        {authError && (
          <p className="alert alert-error" role="alert">
            {authError}
          </p>
        )}

        {!isConfigured && (
          <div className="alert alert-warning" role="status">
            <strong>Ambiente Cognito não configurado:</strong> preencha as
            variáveis <code>VITE_COGNITO_*</code> e <code>VITE_API_URL</code> a
            partir de <code>.env.example</code> após o provisionamento na AWS.
          </div>
        )}

        <button
          type="button"
          className="btn btn-primary btn-full"
          disabled={!isConfigured}
          onClick={() => void signIn()}
        >
          Entrar com Amazon Cognito (PKCE)
        </button>
      </section>
    </main>
  );
}
