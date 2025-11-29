import LanguageSelector from '../components/LanguageSelector';
import { useAuth } from '../context/AuthContext';
import { getTranslation } from '../i18n/translations';
import './RoleLandingPage.css';

const RoleLandingPage = ({ language, onLanguageChange, roleKey }) => {
  const { logout } = useAuth();
  const t = getTranslation(language);
  const strings = t.rolePortals ?? {};
  const roleName = strings.roles?.[roleKey] ?? strings.roles?.default ?? roleKey;
  const title = strings.title?.replace('{role}', roleName) ?? '';
  const description = strings.description?.replace('{role}', roleName) ?? '';

  return (
    <div className="role-landing">
      <header className="role-landing__header">
        <LanguageSelector value={language} onChange={onLanguageChange} />
        <div className="role-landing__chip">
          <span>{roleName}</span>
        </div>
      </header>

      <main className="role-landing__content" aria-labelledby="role-landing-title">
        <h1 id="role-landing-title">{title}</h1>
        <p className="role-landing__description">{description}</p>
        <p className="role-landing__hint">{strings.hint}</p>
        <div className="role-landing__actions">
          <button type="button" className="role-landing__logout" onClick={logout}>
            {strings.logout ?? t.home.logout}
          </button>
        </div>
      </main>
    </div>
  );
};

export default RoleLandingPage;
