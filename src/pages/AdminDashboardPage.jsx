import LanguageSelector from '../components/LanguageSelector';
import { useAuth } from '../context/AuthContext';
import { getTranslation } from '../i18n/translations';

const STATUS_VARIANT_MAP = {
  success: 'success',
  warning: 'warning',
  critical: 'danger',
  info: 'info',
};

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
    <div className="container-fluid py-4">
      <header className="d-flex flex-column flex-lg-row align-items-start align-items-lg-center justify-content-between gap-3 mb-4">
        <div>
          <p className="text-uppercase text-secondary fw-semibold small mb-1">{strings.eyebrow}</p>
          <h1 className="h3 mb-1">{strings.title}</h1>
          <p className="text-body-secondary mb-0">
            {strings.greeting} {displayName}
          </p>
        </div>
        <div className="d-flex align-items-center gap-2">
          <LanguageSelector value={language} onChange={onLanguageChange} />
          <button type="button" className="btn btn-outline-secondary" onClick={logout}>
            {strings.logout ?? t.home.logout}
          </button>
        </div>
      </header>

      <main className="d-flex flex-column gap-4">
        <section className="card border-0 shadow-sm" aria-labelledby="admin-dashboard-hero">
          <div className="card-body p-4">
            <p className="text-uppercase text-secondary fw-semibold small mb-1">{strings.subtitle}</p>
            <p className="lead mb-3">{strings.helper}</p>
            <div className="d-flex flex-wrap align-items-center gap-2">
              {strings.badge ? (
                <span className="badge text-bg-primary px-3 py-2">{strings.badge}</span>
              ) : null}
              {billing?.monthLabel ? (
                <span className="badge text-bg-light text-primary border border-primary px-3 py-2">
                  {billing.monthLabel}
                </span>
              ) : null}
            </div>
          </div>
        </section>

        <section aria-label={strings.keyMetricsLabel} className="d-flex flex-column gap-3">
          <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2">
            <div>
              <h2 className="h5 mb-1">{strings.keyMetricsTitle}</h2>
              <p className="text-body-secondary mb-0">{strings.keyMetricsHelper}</p>
            </div>
          </div>
          <div className="row g-3">
            {summaryCards.map((card) => (
              <div key={card.label} className="col-12 col-sm-6 col-lg-3">
                <article className="card h-100 shadow-sm border-0">
                  <div className="card-body d-flex flex-column gap-2">
                    <div className="d-flex justify-content-between align-items-start">
                      <p className="text-body-secondary text-uppercase small fw-semibold mb-0">{card.label}</p>
                      {card.tag ? (
                        <span className="badge text-bg-light text-primary border border-primary">{card.tag}</span>
                      ) : null}
                    </div>
                    <p className="h4 mb-0">{card.value}</p>
                    <p className="text-body-secondary mb-0">{card.helper}</p>
                  </div>
                </article>
              </div>
            ))}
          </div>
        </section>

        <section aria-label={strings.actionsLabel} className="row g-3">
          <div className="col-12 col-lg-8 d-flex flex-column gap-3">
            <div className="card h-100 shadow-sm border-0">
              <div className="card-body p-4 d-flex flex-column gap-3">
                <div className="d-flex flex-column flex-lg-row justify-content-between gap-2">
                  <div>
                    <p className="text-uppercase text-secondary fw-semibold small mb-1">{strings.collectionsEyebrow}</p>
                    <h3 className="h5 mb-1">{strings.collectionsTitle}</h3>
                    <p className="text-body-secondary mb-0">{strings.collectionsHelper}</p>
                  </div>
                  {billing?.nextCharge ? (
                    <div className="d-flex align-items-center gap-2 bg-light border rounded px-3 py-2">
                      <span className="text-body-secondary small">{strings.nextChargeLabel}</span>
                      <strong>{billing.nextCharge}</strong>
                    </div>
                  ) : null}
                </div>

                <div className="row g-3">
                  <div className="col-12 col-lg-6 d-flex flex-column gap-2">
                    <div className="d-flex justify-content-between align-items-center">
                      <p className="fw-semibold mb-0">{strings.upcomingPaymentsTitle}</p>
                      <span className="badge text-bg-light text-secondary border border-secondary">
                        {strings.upcomingPaymentsHelper}
                      </span>
                    </div>
                    <ul className="list-group list-group-flush">
                      {upcomingPayments.map((payment) => (
                        <li
                          key={`${payment.school}-${payment.dueDate}`}
                          className="list-group-item d-flex justify-content-between align-items-start gap-3 px-0"
                        >
                          <div>
                            <p className="fw-semibold mb-0">{payment.school}</p>
                            <p className="text-body-secondary mb-0">{payment.dueDate}</p>
                          </div>
                          <div className="d-flex flex-column align-items-end gap-1">
                            <span className="badge text-bg-primary">{payment.amount}</span>
                            <span className="badge text-bg-warning text-dark">{payment.status}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="col-12 col-lg-6 d-flex flex-column gap-2">
                    <div className="d-flex justify-content-between align-items-center">
                      <p className="fw-semibold mb-0">{strings.pendingInvoicesTitle}</p>
                      <span className="badge text-bg-light text-secondary border border-secondary">
                        {strings.pendingInvoicesHelper}
                      </span>
                    </div>
                    <ul className="list-group list-group-flush">
                      {pendingInvoices.map((invoice) => (
                        <li
                          key={`${invoice.school}-${invoice.amount}`}
                          className="list-group-item d-flex justify-content-between align-items-start gap-3 px-0"
                        >
                          <div>
                            <p className="fw-semibold mb-0">{invoice.school}</p>
                            <p className="text-body-secondary mb-0">{invoice.age}</p>
                          </div>
                          <div className="d-flex flex-column align-items-end gap-1">
                            <span className="badge text-bg-primary">{invoice.amount}</span>
                            <span className="badge text-bg-danger">{invoice.status}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="col-12 col-lg-4 d-flex flex-column gap-3">
            <div className="card h-100 shadow-sm border-0">
              <div className="card-body p-4">
                <p className="text-uppercase text-secondary fw-semibold small mb-1">{strings.userMixEyebrow}</p>
                <h3 className="h5 mb-1">{strings.userMixTitle}</h3>
                <p className="text-body-secondary">{strings.userMixHelper}</p>
                <ul className="list-group list-group-flush">
                  {userMix.map((item) => (
                    <li key={item.label} className="list-group-item px-0">
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <span className="fw-semibold">{item.label}</span>
                        <span className="text-body-secondary small">{item.helper}</span>
                      </div>
                      <div className="progress" role="presentation" aria-hidden="true">
                        <div
                          className="progress-bar"
                          style={{ width: item.percentage }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section aria-label={strings.actionsLabel} className="row g-3">
          <div className="col-12 col-lg-6 d-flex flex-column gap-3">
            <div className="card h-100 shadow-sm border-0">
              <div className="card-body p-4">
                <p className="text-uppercase text-secondary fw-semibold small mb-1">{strings.healthEyebrow}</p>
                <h3 className="h5 mb-1">{strings.healthTitle}</h3>
                <p className="text-body-secondary">{strings.healthHelper}</p>
                <ul className="list-group list-group-flush">
                  {systemHealth.map((item) => (
                    <li key={item.label} className="list-group-item px-0 d-flex justify-content-between align-items-start">
                      <div>
                        <p className="fw-semibold mb-0">{item.label}</p>
                        <p className="text-body-secondary mb-0">{item.helper}</p>
                      </div>
                      <span
                        className={`badge text-bg-${
                          STATUS_VARIANT_MAP[item.statusVariant] ?? 'secondary'
                        }`}
                      >
                        {item.status}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="col-12 col-lg-6">
            <div className="card h-100 shadow-sm border-0">
              <div className="card-body p-4">
                <p className="text-uppercase text-secondary fw-semibold small mb-1">{strings.actionsEyebrow}</p>
                <h3 className="h5 mb-1">{strings.actionsTitle}</h3>
                <p className="text-body-secondary">{strings.actionsHelper}</p>
                <div className="row g-3 mt-2">
                  {quickLinks.map((link) => (
                    <div key={link.title} className="col-12 col-md-6">
                      <article className="card h-100 border shadow-sm">
                        <div className="card-body d-flex flex-column gap-2">
                          <p className="fw-semibold mb-0">{link.title}</p>
                          <p className="text-body-secondary mb-0">{link.description}</p>
                          {link.hint ? (
                            <p className="text-body-secondary small mb-0">{link.hint}</p>
                          ) : null}
                        </div>
                      </article>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default AdminDashboardPage;
