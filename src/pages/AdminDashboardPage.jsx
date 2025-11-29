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
  const summaryCards = Array.isArray(strings.summaryCards) ? strings.summaryCards : [];
  const billing = strings.billing ?? {};
  const upcomingPayments = Array.isArray(strings.upcomingPayments) ? strings.upcomingPayments : [];
  const pendingInvoices = Array.isArray(strings.pendingInvoices) ? strings.pendingInvoices : [];
  const userMix = Array.isArray(strings.userMix) ? strings.userMix : [];
  const systemHealth = Array.isArray(strings.systemHealth) ? strings.systemHealth : [];

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
            <div className="admin-dashboard__hero-metadata">
              <span className="admin-dashboard__badge" aria-hidden="true">
                {strings.badge}
              </span>
              {billing?.monthLabel ? (
                <span className="admin-dashboard__pill">{billing.monthLabel}</span>
              ) : null}
            </div>
          </div>
        </section>

        <section className="admin-dashboard__summary" aria-label={strings.keyMetricsLabel}>
          <div className="admin-dashboard__section-header">
            <h2>{strings.keyMetricsTitle}</h2>
            <p>{strings.keyMetricsHelper}</p>
          </div>
          <div className="admin-dashboard__summary-grid">
            {summaryCards.map((card) => (
              <article key={card.label} className="admin-dashboard__summary-card">
                <div className="admin-dashboard__summary-header">
                  <p className="admin-dashboard__summary-label">{card.label}</p>
                  {card.tag ? <span className="admin-dashboard__pill">{card.tag}</span> : null}
                </div>
                <p className="admin-dashboard__summary-value">{card.value}</p>
                <p className="admin-dashboard__summary-helper">{card.helper}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="admin-dashboard__grid" aria-label={strings.actionsLabel}>
          <div className="admin-dashboard__panel">
            <header className="admin-dashboard__panel-header">
              <div>
                <p className="admin-dashboard__panel-eyebrow">{strings.collectionsEyebrow}</p>
                <h3 className="admin-dashboard__panel-title">{strings.collectionsTitle}</h3>
                <p className="admin-dashboard__panel-helper">{strings.collectionsHelper}</p>
              </div>
              {billing?.nextCharge ? (
                <div className="admin-dashboard__panel-pill">
                  <span>{strings.nextChargeLabel}</span>
                  <strong>{billing.nextCharge}</strong>
                </div>
              ) : null}
            </header>
            <div className="admin-dashboard__tables">
              <div>
                <div className="admin-dashboard__table-header">
                  <p>{strings.upcomingPaymentsTitle}</p>
                  <span className="admin-dashboard__pill admin-dashboard__pill--muted">{strings.upcomingPaymentsHelper}</span>
                </div>
                <ul className="admin-dashboard__list" aria-label={strings.upcomingPaymentsTitle}>
                  {upcomingPayments.map((payment) => (
                    <li key={`${payment.school}-${payment.dueDate}`} className="admin-dashboard__list-item">
                      <div>
                        <p className="admin-dashboard__list-title">{payment.school}</p>
                        <p className="admin-dashboard__list-helper">{payment.dueDate}</p>
                      </div>
                      <div className="admin-dashboard__list-meta">
                        <span className="admin-dashboard__pill">{payment.amount}</span>
                        <span className="admin-dashboard__status admin-dashboard__status--warning">{payment.status}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="admin-dashboard__table-header">
                  <p>{strings.pendingInvoicesTitle}</p>
                  <span className="admin-dashboard__pill admin-dashboard__pill--muted">{strings.pendingInvoicesHelper}</span>
                </div>
                <ul className="admin-dashboard__list" aria-label={strings.pendingInvoicesTitle}>
                  {pendingInvoices.map((invoice) => (
                    <li key={`${invoice.school}-${invoice.amount}`} className="admin-dashboard__list-item">
                      <div>
                        <p className="admin-dashboard__list-title">{invoice.school}</p>
                        <p className="admin-dashboard__list-helper">{invoice.age}</p>
                      </div>
                      <div className="admin-dashboard__list-meta">
                        <span className="admin-dashboard__pill">{invoice.amount}</span>
                        <span className="admin-dashboard__status admin-dashboard__status--critical">{invoice.status}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="admin-dashboard__panel admin-dashboard__panel--secondary">
            <header className="admin-dashboard__panel-header">
              <div>
                <p className="admin-dashboard__panel-eyebrow">{strings.userMixEyebrow}</p>
                <h3 className="admin-dashboard__panel-title">{strings.userMixTitle}</h3>
                <p className="admin-dashboard__panel-helper">{strings.userMixHelper}</p>
              </div>
            </header>
            <ul className="admin-dashboard__list" aria-label={strings.userMixTitle}>
              {userMix.map((item) => (
                <li key={item.label} className="admin-dashboard__list-item admin-dashboard__list-item--simple">
                  <p className="admin-dashboard__list-title">{item.label}</p>
                  <div className="admin-dashboard__progress">
                    <div
                      className="admin-dashboard__progress-bar"
                      style={{ width: item.percentage }}
                      aria-hidden="true"
                    />
                  </div>
                  <p className="admin-dashboard__list-helper">{item.helper}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="admin-dashboard__grid" aria-label={strings.actionsLabel}>
          <div className="admin-dashboard__panel admin-dashboard__panel--tertiary">
            <header className="admin-dashboard__panel-header">
              <div>
                <p className="admin-dashboard__panel-eyebrow">{strings.healthEyebrow}</p>
                <h3 className="admin-dashboard__panel-title">{strings.healthTitle}</h3>
                <p className="admin-dashboard__panel-helper">{strings.healthHelper}</p>
              </div>
            </header>
            <ul className="admin-dashboard__health-list" aria-label={strings.healthTitle}>
              {systemHealth.map((item) => (
                <li key={item.label} className="admin-dashboard__health-item">
                  <div>
                    <p className="admin-dashboard__list-title">{item.label}</p>
                    <p className="admin-dashboard__list-helper">{item.helper}</p>
                  </div>
                  <span className={`admin-dashboard__status admin-dashboard__status--${item.statusVariant}`}>
                    {item.status}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="admin-dashboard__panel admin-dashboard__panel--actions">
            <header className="admin-dashboard__panel-header">
              <div>
                <p className="admin-dashboard__panel-eyebrow">{strings.actionsEyebrow}</p>
                <h3 className="admin-dashboard__panel-title">{strings.actionsTitle}</h3>
                <p className="admin-dashboard__panel-helper">{strings.actionsHelper}</p>
              </div>
            </header>
            <div className="admin-dashboard__card-grid">
              {quickLinks.map((link) => (
                <article key={link.title} className="admin-dashboard__card">
                  <div className="admin-dashboard__card-body">
                    <p className="admin-dashboard__card-title">{link.title}</p>
                    <p className="admin-dashboard__card-description">{link.description}</p>
                    {link.hint ? <p className="admin-dashboard__card-hint">{link.hint}</p> : null}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default AdminDashboardPage;
