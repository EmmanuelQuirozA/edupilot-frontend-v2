import { useState } from 'react';
import LanguageSelector from './LanguageSelector';
import { getTranslation } from '../i18n/translations';
import { useAuth } from '../context/AuthContext';
import './LoginPage.css';

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
    <div className="login-page">
      <div className="login-page__media">
        <div className="login-page__media-overlay" />
        <div className="login-page__language-selector">
          <LanguageSelector value={language} onChange={onLanguageChange} />
        </div>
        <div className="login-page__headline">
          <p>{t.welcomeHeadline}</p>
        </div>
      </div>
      <div className="login-page__form-wrapper">
        <form className="login-form" onSubmit={handleSubmit}>
          <h1 className="login-form__title">{t.loginTitle}</h1>
          <label className="login-form__field">
            <span className="sr-only">{t.usernamePlaceholder}</span>
            <input
              type="text"
              autoComplete="username"
              placeholder={t.usernamePlaceholder}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
          </label>
          <label className="login-form__field">
            <span className="sr-only">{t.passwordPlaceholder}</span>
            <input
              type="password"
              autoComplete="current-password"
              placeholder={t.passwordPlaceholder}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          <div className="login-form__actions">
            <button type="button" className="btn btn-link p-0 text-decoration-none">
              {t.forgotPassword}
            </button>
          </div>
          {error ? <p className="login-form__error" role="alert">{error}</p> : null}
          <button
            type="submit"
            className="btn btn-primary rounded-pill fw-semibold w-100"
            disabled={loading}
          >
            {loading ? '...' : t.submit}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
