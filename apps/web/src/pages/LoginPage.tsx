import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import {
  AcadFlowMark,
  IconPages,
  IconShieldLock,
  IconTasks,
} from "../components/Icons";
import { AlertBanner } from "../components/ui/AlertBanner";

export function LoginPage() {
  const { isAuthenticated, isLoading, isConfigured, authError, signIn } =
    useAuth();

  if (isLoading) {
    return (
      <main className="center-shell">
        <section className="card status-card" aria-busy="true">
          <AcadFlowMark size={44} />
          <div className="status-card-row">
            <span className="spinner" aria-hidden="true" />
            <span>Carregando autenticação…</span>
          </div>
        </section>
      </main>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <main className="center-shell">
      <div className="login-shell">
        <section
          className="login-showcase"
          aria-label="Apresentação do AcadFlow"
        >
          <div className="login-brand-row">
            <AcadFlowMark size={40} />
            <div>
              <span className="login-brand-name" translate="no">
                AcadFlow
              </span>
              <span className="login-brand-tag">
                Sistemas Distribuídos — UFERSA
              </span>
            </div>
          </div>

          <div className="login-hero-copy">
            <h1>Seu workspace acadêmico organizado em nuvem.</h1>
            <p>
              Reúna tarefas, prazos e anotações de disciplinas em um ambiente
              pessoal sincronizado e acessível de qualquer dispositivo.
            </p>
          </div>

          <ul className="login-feature-list">
            <li className="login-feature-item">
              <span className="login-feature-icon" aria-hidden="true">
                <IconTasks size={17} />
              </span>
              <div>
                <span className="login-feature-title">
                  Tarefas e prazos sob controle
                </span>
                <span className="login-feature-desc">
                  Filtre por status, priorize entregas e acompanhe seu avanço.
                </span>
              </div>
            </li>

            <li className="login-feature-item">
              <span className="login-feature-icon" aria-hidden="true">
                <IconPages size={17} />
              </span>
              <div>
                <span className="login-feature-title">
                  Caderno de anotações estruturado
                </span>
                <span className="login-feature-desc">
                  Editor visual com checklists, salvamento automático e proteção
                  contra conflitos de edição.
                </span>
              </div>
            </li>

            <li className="login-feature-item">
              <span className="login-feature-icon" aria-hidden="true">
                <IconShieldLock size={17} />
              </span>
              <div>
                <span className="login-feature-title">
                  Dados isolados por conta
                </span>
                <span className="login-feature-desc">
                  Cada estudante acessa exclusivamente suas próprias atividades
                  e páginas.
                </span>
              </div>
            </li>
          </ul>
        </section>

        <section className="login-panel" aria-labelledby="login-panel-heading">
          <div className="login-panel-header">
            <h2 id="login-panel-heading">Entrar no AcadFlow</h2>
            <p>
              Use sua conta cadastrada para acessar seu workspace pessoal de
              atividades e páginas.
            </p>
          </div>

          {authError && <AlertBanner>{authError}</AlertBanner>}

          {!isConfigured && (
            <AlertBanner tone="warning">
              <strong>Ambiente Cognito não configurado:</strong> preencha as
              variáveis <code>VITE_COGNITO_*</code> e <code>VITE_API_URL</code>{" "}
              a partir de <code>.env.example</code> após o provisionamento na
              AWS.
            </AlertBanner>
          )}

          <button
            type="button"
            className="btn btn-primary btn-lg btn-full"
            disabled={!isConfigured}
            onClick={() => void signIn()}
          >
            <IconShieldLock size={17} />
            <span>Entrar com Amazon Cognito</span>
          </button>

          <div className="login-security-note">
            <IconShieldLock size={16} />
            <span>
              Autenticação delegada via Amazon Cognito (OAuth 2.0 com PKCE).
              Nenhuma senha é coletada ou armazenada pelo aplicativo.
            </span>
          </div>
        </section>
      </div>
    </main>
  );
}
