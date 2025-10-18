import { useEffect, useMemo, useState } from 'react';
import LanguageSelector from './LanguageSelector';
import { getTranslation } from '../i18n/translations';
import { useAuth } from '../context/AuthContext';
import PaymentsFinancePage from '../pages/PaymentsFinancePage';
import StudentsGroupsPage from '../pages/StudentsGroupsPage';
import TeachersPage from '../pages/TeachersPage';
import SchedulesTasksPage from '../pages/SchedulesTasksPage';
import GradesPage from '../pages/GradesPage';
import CommunicationsPage from '../pages/CommunicationsPage';

const COLLAPSE_BREAKPOINT = 1200;

const getIsDesktop = () =>
  typeof window === 'undefined' ? true : window.innerWidth >= COLLAPSE_BREAKPOINT;

const STAT_VARIANTS = {
  blue: 'primary',
  green: 'success',
  orange: 'warning',
  purple: 'info',
};

const STATUS_VARIANTS = {
  paid: 'success',
  pending: 'warning',
};

const sidebarTransition = {
  transition: 'transform 0.35s ease, opacity 0.35s ease',
};

const heroImage =
  'https://images.unsplash.com/photo-1588072432836-e10032774350?auto=format&fit=crop&w=720&q=80';

const HomePage = ({ language, onLanguageChange, activePage: activePageProp = 'dashboard', onNavigate }) => {
  const { user, logout } = useAuth();
  const t = getTranslation(language);

  const [activePage, setActivePage] = useState(activePageProp);
  const [isDesktop, setIsDesktop] = useState(getIsDesktop);
  const [isSidebarOpen, setIsSidebarOpen] = useState(getIsDesktop);

  useEffect(() => {
    setActivePage(activePageProp);
  }, [activePageProp]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return () => {};
    }

    const handleResize = () => {
      const desktop = getIsDesktop();
      setIsDesktop(desktop);
      setIsSidebarOpen(desktop);
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const displayName = user?.first_name ?? user?.name ?? user?.username ?? t.home.roleLabel;
  const initials = displayName
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');

  const menuItems = useMemo(
    () => [
      {
        key: 'dashboard',
        label: t.home.menu.items.dashboard,
        icon: (
          <svg viewBox="0 0 24 24" aria-hidden="true" width="21" height="21" className="me-2">
            <rect x="3" y="3" width="8" height="8" rx="2" fill="currentColor" />
            <rect x="13" y="3" width="8" height="5" rx="2" fill="currentColor" />
            <rect x="13" y="10" width="8" height="11" rx="2" fill="currentColor" />
            <rect x="3" y="13" width="8" height="8" rx="2" fill="currentColor" />
          </svg>
        ),
      },
      {
        key: 'payments',
        label: t.home.menu.items.payments,
        icon: (
          <svg viewBox="0 0 24 24" aria-hidden="true" width="21" height="21" className="me-2">
            <rect x="2" y="6" width="20" height="12" rx="2" fill="currentColor" opacity="0.2" />
            <rect x="2" y="8" width="20" height="3" fill="currentColor" />
            <rect x="4" y="14" width="6" height="2" rx="1" fill="currentColor" />
            <rect x="12" y="14" width="4" height="2" rx="1" fill="currentColor" />
          </svg>
        ),
      },
      {
        key: 'students',
        label: t.home.menu.items.students,
        icon: (
          <svg viewBox="0 0 24 24" aria-hidden="true" width="21" height="21" className="me-2">
            <path
              d="M12 3 2 8l10 5 7-3.5V15a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-2"
              fill="currentColor"
              opacity="0.2"
            />
            <path d="M12 3 2 8l10 5 10-5-10-5Z" fill="currentColor" />
            <path d="M19 10v6a2 2 0 0 0 2 2h1" fill="currentColor" />
          </svg>
        ),
      },
      {
        key: 'teachers',
        label: t.home.menu.items.teachers,
        icon: (
          <svg viewBox="0 0 24 24" aria-hidden="true" width="21" height="21" className="me-2">
            <rect x="9" y="4" width="12" height="8" rx="1.5" fill="currentColor" />
            <circle cx="6.5" cy="9" r="2.5" fill="currentColor" />
            <path d="M2 18a4.5 4.5 0 0 1 9 0v2H2v-2Z" fill="currentColor" />
            <rect x="11" y="13" width="8" height="2" rx="1" fill="currentColor" />
          </svg>
        ),
      },
      {
        key: 'schedules',
        label: t.home.menu.items.schedules,
        icon: (
          <svg viewBox="0 0 24 24" aria-hidden="true" width="21" height="21" className="me-2">
            <rect x="3" y="5" width="18" height="16" rx="2" fill="currentColor" opacity="0.2" />
            <rect x="3" y="8" width="18" height="3" fill="currentColor" />
            <rect x="7" y="3" width="2" height="4" rx="1" fill="currentColor" />
            <rect x="15" y="3" width="2" height="4" rx="1" fill="currentColor" />
            <path
              d="M9 16l2 2 4-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ),
      },
      {
        key: 'grades',
        label: t.home.menu.items.grades,
        icon: (
          <svg viewBox="0 0 24 24" aria-hidden="true" width="21" height="21" className="me-2">
            <path
              d="M6 3h8l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"
              fill="currentColor"
              opacity="0.2"
            />
            <path d="M14 3v5h5" fill="currentColor" />
            <rect x="8" y="12" width="8" height="2" rx="1" fill="currentColor" />
            <rect x="8" y="16" width="6" height="2" rx="1" fill="currentColor" />
          </svg>
        ),
      },
      {
        key: 'communications',
        label: t.home.menu.items.communications,
        icon: (
          <svg viewBox="0 0 24 24" aria-hidden="true" width="21" height="21" className="me-2">
            <path
              d="M4 4h10a3 3 0 0 1 3 3v4a3 3 0 0 1-3 3H9l-4 3V7a3 3 0 0 1 3-3Z"
              fill="currentColor"
            />
            <path d="M10 12h6a2 2 0 0 1 2 2v5l3-2" fill="currentColor" opacity="0.3" />
          </svg>
        ),
      },
    ],
    [t.home.menu.items],
  );

  const studentsPageStrings = t.home.studentsPage;

  const placeholderPages = useMemo(
    () => ({
      payments: <PaymentsFinancePage {...t.home.pages.payments} />,
      students: (
        <StudentsGroupsPage
          language={language}
          placeholder={t.home.pages.students}
          strings={studentsPageStrings}
        />
      ),
      teachers: <TeachersPage {...t.home.pages.teachers} />,
      schedules: <SchedulesTasksPage {...t.home.pages.schedules} />,
      grades: <GradesPage {...t.home.pages.grades} />,
      communications: <CommunicationsPage {...t.home.pages.communications} />,
    }),
    [language, studentsPageStrings, t.home.pages],
  );

  const headerTitle =
    activePage === 'dashboard'
      ? t.home.header.title
      : t.home.pages[activePage]?.title ?? t.home.header.title;

  const handleNavClick = (key) => {
    setActivePage(key);
    onNavigate?.(key);

    if (!isDesktop) {
      setIsSidebarOpen(false);
    }
  };

  const toggleSidebar = () => {
    setIsSidebarOpen((previous) => !previous);
  };

  const closeSidebar = () => {
    if (!isDesktop) {
      setIsSidebarOpen(false);
    }
  };

  const renderDashboard = () => {
    const { hero, stats, studentsCard, paymentsCard } = t.home.dashboard;

    return (
      <>
        <section className="bg-white rounded-4 shadow-sm overflow-hidden mb-4">
          <div className="row g-0 align-items-stretch">
            <div className="col-lg-7 p-4 p-lg-5">
              <span className="badge text-bg-primary rounded-pill px-3 py-2 mb-3 text-uppercase fw-semibold">
                {hero.tag}
              </span>
              <h2 className="display-6 fw-semibold mb-3">{hero.title}</h2>
              <p className="text-secondary mb-4">{hero.description}</p>
              <div className="d-flex flex-wrap gap-4">
                <div>
                  <h3 className="h1 mb-1">{hero.highlights.students.value}</h3>
                  <span className="text-secondary">{hero.highlights.students.label}</span>
                </div>
                <div>
                  <h3 className="h1 mb-1">{hero.highlights.retention.value}</h3>
                  <span className="text-secondary">{hero.highlights.retention.label}</span>
                </div>
              </div>
            </div>
            <div className="col-lg-5 position-relative" style={{ minHeight: '18rem' }}>
              <div
                className="position-absolute top-0 start-0 w-100 h-100"
                style={{
                  backgroundImage: `url(${heroImage})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
                aria-hidden="true"
              />
            </div>
          </div>
        </section>

        <section className="row row-cols-1 row-cols-sm-2 row-cols-xl-4 g-3 mb-4">
          {stats.map((stat) => {
            const variant = STAT_VARIANTS[stat.accent] ?? 'primary';
            return (
              <div className="col" key={stat.title}>
                <div
                  className={`card h-100 border-0 shadow-sm border-start border-${variant} border-4`}
                >
                  <div className="card-body">
                    <p className="text-uppercase text-secondary-emphasis fw-semibold small mb-1">
                      {stat.title}
                    </p>
                    <p className="text-secondary small mb-3">{stat.description}</p>
                    <strong className={`display-6 text-${variant}`}>{stat.value}</strong>
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        <section className="row g-4">
          <div className="col-12 col-xl-6">
            <div className="card h-100 shadow-sm border-0">
              <div className="card-body d-flex flex-column gap-3">
                <div className="d-flex justify-content-between align-items-start gap-3">
                  <div>
                    <h3 className="h5 mb-1">{studentsCard.title}</h3>
                    <p className="text-secondary mb-0">{studentsCard.subtitle}</p>
                  </div>
                  <button type="button" className="btn btn-sm btn-outline-primary rounded-pill">
                    {studentsCard.actionLabel}
                  </button>
                </div>
              </div>
              <ul className="list-group list-group-flush">
                {studentsCard.list.map((student) => {
                  const statusVariant = STATUS_VARIANTS[student.status] ?? 'secondary';
                  const avatar = student.name
                    .split(' ')
                    .map((part) => part.charAt(0).toUpperCase())
                    .slice(0, 2)
                    .join('');

                  return (
                    <li
                      key={`${student.name}-${student.grade}`}
                      className="list-group-item d-flex align-items-center justify-content-between gap-3"
                    >
                      <div className="d-flex align-items-center gap-3">
                        <div
                          className={`rounded-circle bg-${statusVariant}-subtle text-${statusVariant} fw-semibold d-flex align-items-center justify-content-center`}
                          style={{ width: '44px', height: '44px' }}
                          aria-hidden="true"
                        >
                          {avatar}
                        </div>
                        <div>
                          <p className="mb-0 fw-semibold">{student.name}</p>
                          <small className="text-secondary">{student.grade}</small>
                        </div>
                      </div>
                      <span className={`badge text-bg-${statusVariant} rounded-pill px-3`}>
                        {studentsCard.status[student.status]}
                      </span>
                      <span className="fw-semibold text-body">{student.amount}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          <div className="col-12 col-xl-6">
            <div className="card h-100 shadow-sm border-0">
              <div className="card-body d-flex flex-column gap-4">
                <div className="d-flex flex-wrap justify-content-between gap-3">
                  <div>
                    <h3 className="h5 mb-1">{paymentsCard.label}</h3>
                    <p className="text-secondary mb-0">{paymentsCard.summary}</p>
                  </div>
                  <div className="btn-group">
                    <button type="button" className="btn btn-sm btn-primary">
                      {paymentsCard.periodOptions[0]}
                    </button>
                    <button type="button" className="btn btn-sm btn-outline-primary">
                      {paymentsCard.periodOptions[1]}
                    </button>
                  </div>
                </div>

                <div className="bg-body-secondary rounded-4 p-4 d-flex flex-column gap-4">
                  <div className="d-flex flex-column flex-md-row justify-content-between gap-4">
                    <div>
                      <p className="text-secondary mb-1">{paymentsCard.nextPaymentTitle}</p>
                      <strong className="h4 mb-0">{paymentsCard.nextPayment.amount}</strong>
                    </div>
                    <div className="d-flex align-items-center gap-3">
                      <div
                        className="rounded-circle bg-primary-subtle text-primary fw-semibold d-flex align-items-center justify-content-center"
                        style={{ width: '48px', height: '48px' }}
                        aria-hidden="true"
                      >
                        {paymentsCard.nextPayment.student
                          .split(' ')
                          .map((part) => part.charAt(0).toUpperCase())
                          .slice(0, 2)
                          .join('')}
                      </div>
                      <div>
                        <p className="mb-0 fw-semibold">{paymentsCard.nextPayment.student}</p>
                        <small className="text-secondary">
                          {paymentsCard.nextPayment.grade} · {paymentsCard.nextPayment.dueIn}
                        </small>
                      </div>
                    </div>
                  </div>

                  <div className="row row-cols-1 row-cols-md-2 g-3">
                    {paymentsCard.totals.map((item) => (
                      <div className="col" key={item.label}>
                        <div className="p-3 bg-white rounded-3 h-100 d-flex flex-column">
                          <p className="text-secondary mb-1">{item.label}</p>
                          <strong className="h5 mb-1">{item.value}</strong>
                          <span className="text-success small">{item.change}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div>
                    <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-end gap-3 mb-3">
                      <div>
                        <h4 className="h6 mb-1">{paymentsCard.chart.caption}</h4>
                        <p className="text-secondary mb-0">{paymentsCard.chart.description}</p>
                      </div>
                      <span className="badge text-bg-primary rounded-pill px-3 py-2">
                        ${paymentsCard.chart.values.at(-1)}
                        {paymentsCard.chart.valueSuffix}
                      </span>
                    </div>
                    <svg
                      viewBox="0 0 180 80"
                      preserveAspectRatio="none"
                      role="img"
                      aria-label={paymentsCard.chart.ariaLabel}
                      className="w-100"
                      style={{ height: '120px' }}
                    >
                      <defs>
                        <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="rgba(59, 130, 246, 0.4)" />
                          <stop offset="100%" stopColor="rgba(59, 130, 246, 0)" />
                        </linearGradient>
                      </defs>
                      <path
                        d="M0 60 C 20 50, 40 55, 60 40 S 100 20, 120 30 160 60, 180 45 V 80 H 0 Z"
                        fill="url(#chartGradient)"
                      />
                      <path
                        d="M0 60 C 20 50, 40 55, 60 40 S 100 20, 120 30 160 60, 180 45"
                        fill="none"
                        stroke="rgba(37, 99, 235, 0.9)"
                        strokeWidth="3"
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="d-flex justify-content-between text-secondary text-uppercase small mt-2">
                      {paymentsCard.chart.months.map((month) => (
                        <span key={month}>{month}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </>
    );
  };

  const sidebarWidth = isDesktop ? '280px' : '20rem';

  return (
    <div
      className={`bg-light min-vh-100 d-flex${isSidebarOpen && !isDesktop ? ' overflow-hidden position-relative' : ''}`}
    >
      <aside
        className={`${
          isDesktop
            ? 'position-relative'
            : 'position-fixed top-0 start-0 h-100 shadow-lg'
        } bg-dark text-white d-flex flex-column flex-shrink-0 p-4 p-xl-5`}
        style={{
          width: sidebarWidth,
          maxWidth: isDesktop ? sidebarWidth : '85%',
          transform: !isDesktop && !isSidebarOpen ? 'translateX(-110%)' : 'translateX(0)',
          opacity: !isDesktop && !isSidebarOpen ? 0 : 1,
          ...sidebarTransition,
          zIndex: 1045,
        }}
      >
        {!isDesktop ? (
          <button
            type="button"
            className="btn btn-outline-light btn-sm align-self-end mb-3"
            onClick={closeSidebar}
            aria-label={t.home.header.closeMenu}
          >
            ×
          </button>
        ) : null}
        <div className="mb-4">
          <span className="d-block text-uppercase fw-bold fs-5">school</span>
          <span className="badge text-bg-light text-dark rounded-pill">EduPilot</span>
        </div>
        <div className="d-flex align-items-center gap-3 mb-4">
          <div
            className="rounded-circle bg-primary-subtle text-primary fw-semibold d-flex align-items-center justify-content-center"
            style={{ width: '48px', height: '48px' }}
            aria-hidden="true"
          >
            {initials || 'AD'}
          </div>
          <div>
            <p className="mb-0 fw-semibold text-white">{displayName}</p>
            <small className="text-white-50">{t.home.roleLabel}</small>
          </div>
        </div>
        <nav className="mb-4" aria-label={t.home.menu.main}>
          <p className="text-uppercase small text-white-50 mb-2">{t.home.menu.main}</p>
          <div className="nav nav-pills flex-column gap-1">
            {menuItems.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`nav-link text-start d-flex align-items-center fw-medium ${
                  activePage === item.key ? 'active' : 'text-white-50'
                }`}
                onClick={() => handleNavClick(item.key)}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>
        </nav>
        <div className="mb-4">
          <p className="text-uppercase small text-white-50 mb-2">{t.home.menu.settings}</p>
          <div className="nav flex-column gap-1">
            <span className="text-white-50">{t.home.menu.paymentCenter}</span>
            <span className="text-white-50">{t.home.menu.configuration}</span>
          </div>
        </div>
        <button type="button" className="btn btn-outline-light mt-auto" onClick={logout}>
          {t.home.logout}
        </button>
      </aside>

      {!isDesktop ? (
        <button
          type="button"
          className="navbar-toggler d-lg-none position-fixed top-0 start-0 m-3 shadow-sm bg-white"
          style={{ zIndex: 1050 }}
          onClick={toggleSidebar}
          aria-label={isSidebarOpen ? t.home.header.closeMenu : t.home.header.openMenu}
        >
          <span className="navbar-toggler-icon" />
        </button>
      ) : null}

      {!isDesktop && isSidebarOpen ? (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-50"
          style={{ zIndex: 1040 }}
          onClick={closeSidebar}
          aria-hidden="true"
        />
      ) : null}

      <div className="flex-grow-1 w-100">
        <header className="bg-white border-bottom sticky-top" style={{ zIndex: 1030 }}>
          <div className="container-fluid py-3 px-3 px-lg-4 d-flex flex-column flex-lg-row gap-3 align-items-lg-center justify-content-lg-between">
            <div>
              <h1 className="h4 mb-1">{headerTitle}</h1>
              <p className="text-secondary mb-0">{t.home.header.subtitle}</p>
            </div>
            <div className="d-flex flex-wrap align-items-center gap-3">
              <div className="input-group">
                <span className="input-group-text" id="dashboard-search-label">
                  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                    <path
                      d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16a6.471 6.471 0 0 0 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5Zm-6 0A4.5 4.5 0 1 1 14 9.5 4.505 4.505 0 0 1 9.5 14Z"
                      fill="currentColor"
                    />
                  </svg>
                </span>
                <input
                  id="dashboard-search"
                  type="search"
                  className="form-control"
                  placeholder={t.home.header.searchPlaceholder}
                  aria-label={t.home.header.searchPlaceholder}
                />
              </div>
              <LanguageSelector value={language} onChange={onLanguageChange} variant="outline-secondary" />
              <button
                type="button"
                className="btn btn-light position-relative"
                aria-label={t.home.header.notifications}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20">
                  <path
                    d="M12 3a5 5 0 0 0-5 5v2.17c0 .7-.28 1.37-.77 1.86L4.6 13.65A1 1 0 0 0 5.3 15h13.4a1 1 0 0 0 .7-1.35l-1.63-1.62a2.63 2.63 0 0 1-.77-1.86V8a5 5 0 0 0-5-5Zm0 18a2.5 2.5 0 0 1-2.45-2h4.9A2.5 2.5 0 0 1 12 21Z"
                    fill="currentColor"
                  />
                </svg>
                <span className="position-absolute top-0 start-100 translate-middle p-1 bg-danger border border-light rounded-circle" />
              </button>
              <div className="d-flex align-items-center gap-2 bg-white border rounded-pill px-3 py-2 shadow-sm">
                <div
                  className="rounded-circle bg-primary-subtle text-primary fw-semibold d-flex align-items-center justify-content-center"
                  style={{ width: '36px', height: '36px' }}
                  aria-hidden="true"
                >
                  {initials || 'AD'}
                </div>
                <div>
                  <p className="mb-0 fw-semibold">{displayName}</p>
                  <small className="text-secondary">{user?.role ?? t.home.roleLabel}</small>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="container-fluid py-4 px-3 px-lg-4">
          {activePage === 'dashboard' ? renderDashboard() : placeholderPages[activePage] ?? null}
        </main>
      </div>
    </div>
  );
};

export default HomePage;
