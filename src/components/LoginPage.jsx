import { useState } from 'react';
import LanguageSelector from './LanguageSelector';
import { getTranslation } from '../i18n/translations';
import { useAuth } from '../context/AuthContext';

const heroBackground =
  "https://images.unsplash.com/photo-1523580846011-d3a5bc25702b?auto=format&fit=crop&w=1600&q=80";

const LoginPage = ({ language, onLanguageChange }) => {
  const { login, loading } = useAuth();
  const t = getTranslation(language);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError('');

    try {
      await login(username, password);
    } catch (err) {
      if (err?.status === 401) {
        setError(t.errors.invalidCredentials);
        return;
      }

      if (err?.status === 403) {
        setError(t.errors.userDisabled);
        return;
      }

      if (err?.code === 'MISSING_ROLE') {
        setError(t.errors.missingRole);
        return;
      }

      if (err?.code === 'NETWORK_ERROR') {
        setError(t.errors.network);
        return;
      }

      setError(t.errors.unexpected);
    }
  };

  return (
    <div className="container-fluid min-vh-100 px-0">
      <div className="row g-0 min-vh-100">
        <div
          className="col-12 col-lg-6 position-relative d-flex flex-column justify-content-end text-white overflow-hidden"
          style={{ minHeight: '18rem' }}
        >
          <div
            className="position-absolute top-0 start-0 w-100 h-100"
            style={{
              backgroundImage: `url(${heroBackground})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              transform: 'scale(1.01)',
            }}
            aria-hidden="true"
          />
          <div
            className="position-absolute top-0 start-0 w-100 h-100"
            style={{
              background: 'linear-gradient(135deg, rgba(16, 24, 40, 0.75), rgba(59, 130, 246, 0.35))',
            }}
            aria-hidden="true"
          />
          <div className="position-absolute top-0 end-0 p-4 p-lg-5">
            <LanguageSelector
              value={language}
              onChange={onLanguageChange}
              variant="outline-light"
              size="sm"
            />
          </div>
          <div className="position-relative p-4 p-lg-5 mt-auto" style={{ maxWidth: '22rem' }}>
            <p className="fs-2 fw-semibold mb-0">{t.welcomeHeadline}</p>
          </div>
        </div>
        <div className="col-12 col-lg-6 d-flex align-items-center justify-content-center bg-body p-4 p-lg-5">
          <form className="w-100" style={{ maxWidth: '24rem' }} onSubmit={handleSubmit}>
            <h1 className="h3 fw-bold mb-4 text-dark">{t.loginTitle}</h1>
            <div className="mb-3">
              <label htmlFor="login-username" className="visually-hidden">
                {t.usernamePlaceholder}
              </label>
              <input
                id="login-username"
                type="text"
                className="form-control form-control-lg"
                autoComplete="username"
                placeholder={t.usernamePlaceholder}
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
              />
            </div>
            <div className="mb-3">
              <label htmlFor="login-password" className="visually-hidden">
                {t.passwordPlaceholder}
              </label>
              <input
                id="login-password"
                type="password"
                className="form-control form-control-lg"
                autoComplete="current-password"
                placeholder={t.passwordPlaceholder}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
            <div className="d-flex justify-content-end mb-3">
              <button type="button" className="btn btn-link link-primary p-0 fw-semibold">
                {t.forgotPassword}
              </button>
            </div>
            {error ? (
              <div className="alert alert-danger py-2" role="alert">
                {error}
              </div>
            ) : null}
            <button
              type="submit"
              className="btn btn-primary btn-lg w-100 rounded-pill py-3"
              disabled={loading}
            >
              {loading ? '...' : t.submit}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
