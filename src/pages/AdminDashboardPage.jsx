import LanguageSelector from '../components/LanguageSelector';
import { useAuth } from '../context/AuthContext';
import { getTranslation } from '../i18n/translations';
import './AdminDashboardPage.css';

const AdminDashboardPage = ({ language, onLanguageChange }) => {
  const { user, logout } = useAuth();
  const t = getTranslation(language);
  const strings = t.adminDashboard ?? {};
  const displayName = user?.first_name ?? user?.name ?? user?.username ?? '';
  const quickLinks = Array.isArray(strings.quickLinks) ? strings.quickLinks : [];

  return (
    <div className="admin-dashboard">
      <header className="admin-dashboard__header">
        <div className="admin-dashboard__identity">
          <p className="admin-dashboard__eyebrow">{strings.eyebrow}</p>
          <h1 className="admin-dashboard__title">{strings.title}</h1>
          <p className="admin-dashboard__greeting">
            {strings.greeting} {displayName}
          </p>
        </div>
        <div className="admin-dashboard__controls">
          <LanguageSelector value={language} onChange={onLanguageChange} />
          <button type="button" className="admin-dashboard__logout" onClick={logout}>
            {strings.logout ?? t.home.logout}
          </button>
        </div>
      </header>

      <main className="admin-dashboard__main">
        <section className="admin-dashboard__hero" aria-labelledby="admin-dashboard-hero">
          <div>
            <p className="admin-dashboard__subtitle">{strings.subtitle}</p>
            <p className="admin-dashboard__helper">{strings.helper}</p>
          </div>
          <div className="admin-dashboard__badge" aria-hidden="true">
            <span>{strings.badge}</span>
          </div>
        </section>

        <section className="admin-dashboard__grid" aria-label={strings.actionsLabel}>
          {quickLinks.map((link) => (
            <article key={link.title} className="admin-dashboard__card">
              <div className="admin-dashboard__card-body">
                <p className="admin-dashboard__card-title">{link.title}</p>
                <p className="admin-dashboard__card-description">{link.description}</p>
                {link.hint ? <p className="admin-dashboard__card-hint">{link.hint}</p> : null}
              </div>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
};

export default AdminDashboardPage;
