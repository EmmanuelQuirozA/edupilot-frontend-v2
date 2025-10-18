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
import './HomePage.css';

const COLLAPSE_BREAKPOINT = 1200;

const getIsDesktop = () =>
  typeof window === 'undefined' ? true : window.innerWidth >= COLLAPSE_BREAKPOINT;

const HomePage = ({ language, onLanguageChange }) => {
  const { user, logout } = useAuth();
  const t = getTranslation(language);

  const [activePage, setActivePage] = useState('dashboard');
  const [isDesktop, setIsDesktop] = useState(getIsDesktop);
  const [isSidebarOpen, setIsSidebarOpen] = useState(getIsDesktop);

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
      { key: 'dashboard', 
        label: t.home.menu.items.dashboard, 
        icon : 
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="3" width="8" height="8" rx="2" fill="currentColor"/>
          <rect x="13" y="3" width="8" height="5" rx="2" fill="currentColor"/>
          <rect x="13" y="10" width="8" height="11" rx="2" fill="currentColor"/>
          <rect x="3" y="13" width="8" height="8" rx="2" fill="currentColor"/>
        </svg> 
      },
      { key: 'payments', 
        label: t.home.menu.items.payments, 
        icon : 
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="2" y="6" width="20" height="12" rx="2" fill="currentColor" opacity="0.2"/>
          <rect x="2" y="8" width="20" height="3" fill="currentColor"/>
          <rect x="4" y="14" width="6" height="2" rx="1" fill="currentColor"/>
          <rect x="12" y="14" width="4" height="2" rx="1" fill="currentColor"/>
        </svg>
      },
      { key: 'students', 
        label: t.home.menu.items.students, 
        icon : 
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3 2 8l10 5 7-3.5V15a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-2" fill="currentColor" opacity="0.2"/>
          <path d="M12 3 2 8l10 5 10-5-10-5Z" fill="currentColor"/>
          <path d="M19 10v6a2 2 0 0 0 2 2h1" fill="currentColor"/>
        </svg> 
      },
      { key: 'teachers', 
        label: t.home.menu.items.teachers, 
        icon : 
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="9" y="4" width="12" height="8" rx="1.5" fill="currentColor"/>
          <circle cx="6.5" cy="9" r="2.5" fill="currentColor"/>
          <path d="M2 18a4.5 4.5 0 0 1 9 0v2H2v-2Z" fill="currentColor"/>
          <rect x="11" y="13" width="8" height="2" rx="1" fill="currentColor"/>
        </svg>
      },
      { key: 'schedules', 
        label: t.home.menu.items.schedules, 
        icon : 
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="5" width="18" height="16" rx="2" fill="currentColor" opacity="0.2"/>
          <rect x="3" y="8" width="18" height="3" fill="currentColor"/>
          <rect x="7" y="3" width="2" height="4" rx="1" fill="currentColor"/>
          <rect x="15" y="3" width="2" height="4" rx="1" fill="currentColor"/>
          <path d="M9 16l2 2 4-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      },
      { key: 'grades', 
        label: t.home.menu.items.grades, 
        icon : 
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 3h8l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" fill="currentColor" opacity="0.2"/>
          <path d="M14 3v5h5" fill="currentColor"/>
          <rect x="8" y="12" width="8" height="2" rx="1" fill="currentColor"/>
          <rect x="8" y="16" width="6" height="2" rx="1" fill="currentColor"/>
        </svg>
      },
      { key: 'communications', 
        label: t.home.menu.items.communications, 
        icon :
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 4h10a3 3 0 0 1 3 3v4a3 3 0 0 1-3 3H9l-4 3V7a3 3 0 0 1 3-3Z" fill="currentColor"/>
          <path d="M10 12h6a2 2 0 0 1 2 2v5l3-2" fill="currentColor" opacity="0.3"/>
        </svg>
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
        <section className="dashboard__hero">
          <div className="hero__content">
            <span className="hero__tag">{hero.tag}</span>
            <h2>{hero.title}</h2>
            <p>{hero.description}</p>
            <div className="hero__highlights">
              <div>
                <h3>{hero.highlights.students.value}</h3>
                <span>{hero.highlights.students.label}</span>
              </div>
              <div>
                <h3>{hero.highlights.retention.value}</h3>
                <span>{hero.highlights.retention.label}</span>
              </div>
            </div>
          </div>
          <div className="hero__media" aria-hidden="true">
            <img
              src="https://images.unsplash.com/photo-1588072432836-e10032774350?auto=format&fit=crop&w=720&q=80"
              alt=""
            />
          </div>
        </section>

        <section className="dashboard__stats">
          {stats.map((stat) => (
            <article key={stat.title} className={`stat-card stat-card--${stat.accent}`}>
              <header>
                <p>{stat.title}</p>
                <span>{stat.description}</span>
              </header>
              <strong>{stat.value}</strong>
            </article>
          ))}
        </section>

        <section className="dashboard__grid">
          <article className="students-card">
            <header className="students-card__header">
              <div>
                <h3>{studentsCard.title}</h3>
                <p>{studentsCard.subtitle}</p>
              </div>
              <button type="button">{studentsCard.actionLabel}</button>
            </header>
            <ul className="students-card__list">
              {studentsCard.list.map((student) => (
                <li key={`${student.name}-${student.grade}`}>
                  <div className="students-card__identity">
                    <div className="students-card__avatar" aria-hidden="true">
                      {student.name
                        .split(' ')
                        .map((part) => part.charAt(0).toUpperCase())
                        .slice(0, 2)
                        .join('')}
                    </div>
                    <div>
                      <p>{student.name}</p>
                      <span>{student.grade}</span>
                    </div>
                  </div>
                  <span className={`students-card__status students-card__status--${student.status}`}>
                    {studentsCard.status[student.status]}
                  </span>
                  <span className="students-card__amount">{student.amount}</span>
                </li>
              ))}
            </ul>
          </article>

          <article className="payments-card">
            <header className="payments-card__header">
              <div>
                <h3>{paymentsCard.label}</h3>
                <p>{paymentsCard.summary}</p>
              </div>
              <div className="payments-card__period">
                <button type="button" className="is-active">
                  {paymentsCard.periodOptions[0]}
                </button>
                <button type="button">{paymentsCard.periodOptions[1]}</button>
              </div>
            </header>

            <div className="payments-card__content">
              <div className="payments-card__next">
                <div className="payments-card__next-info">
                  <p>{paymentsCard.nextPaymentTitle}</p>
                  <strong>{paymentsCard.nextPayment.amount}</strong>
                </div>
                <div className="payments-card__next-student">
                  <div className="payments-card__avatar" aria-hidden="true">
                    {paymentsCard.nextPayment.student
                      .split(' ')
                      .map((part) => part.charAt(0).toUpperCase())
                      .slice(0, 2)
                      .join('')}
                  </div>
                  <div>
                    <p>{paymentsCard.nextPayment.student}</p>
                    <span>
                      {paymentsCard.nextPayment.grade} · {paymentsCard.nextPayment.dueIn}
                    </span>
                  </div>
                </div>
              </div>

              <div className="payments-card__totals">
                {paymentsCard.totals.map((item) => (
                  <div key={item.label}>
                    <p>{item.label}</p>
                    <strong>{item.value}</strong>
                    <span>{item.change}</span>
                  </div>
                ))}
              </div>

              <div className="payments-card__chart">
                <div className="payments-card__chart-header">
                  <div>
                    <h4>{paymentsCard.chart.caption}</h4>
                    <p>{paymentsCard.chart.description}</p>
                  </div>
                  <span className="payments-card__chart-total">
                    ${paymentsCard.chart.values.at(-1)}
                    {paymentsCard.chart.valueSuffix}
                  </span>
                </div>
                <svg
                  viewBox="0 0 180 80"
                  preserveAspectRatio="none"
                  role="img"
                  aria-label={paymentsCard.chart.ariaLabel}
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
                <div className="payments-card__chart-footer">
                  {paymentsCard.chart.months.map((month) => (
                    <span key={month}>{month}</span>
                  ))}
                </div>
              </div>
            </div>
          </article>
        </section>
      </>
    );
  };

  return (
    <div className={`dashboard${isSidebarOpen && !isDesktop ? ' has-overlay' : ''}`}>
      <aside
        className={`dashboard__sidebar${isSidebarOpen ? ' is-visible' : ''}${isDesktop ? '' : ' is-collapsible'}`}
      >
        {!isDesktop ? (
          <button
            type="button"
            className="sidebar__close"
            onClick={closeSidebar}
            aria-label={t.home.header.closeMenu}
          >
            ×
          </button>
        ) : null}
        <div className="sidebar__brand">
          <span className="sidebar__brand-mark">school</span>
          <span className="sidebar__brand-badge">EduPilot</span>
        </div>
        <div className="sidebar__profile">
          <div className="sidebar__avatar" aria-hidden="true">
            {initials || 'AD'}
          </div>
          <div>
            <p className="sidebar__name">{displayName}</p>
            <span className="sidebar__role">{t.home.roleLabel}</span>
          </div>
        </div>
        <nav className="sidebar__nav" aria-label={t.home.menu.main}>
          <p className="sidebar__section">{t.home.menu.main}</p>
          <ul>
            {menuItems.map((item) => (
              <li
                key={item.key}
                className={activePage === item.key ? 'is-active' : ''}
                onClick={() => handleNavClick(item.key)}
              >
                {item.icon} {item.label}
              </li>
            ))}
          </ul>
          <p className="sidebar__section">{t.home.menu.settings}</p>
          <ul>
            <li>{t.home.menu.paymentCenter}</li>
            <li>{t.home.menu.configuration}</li>
          </ul>
        </nav>
        <button type="button" className="sidebar__logout" onClick={logout}>
          {t.home.logout}
        </button>
      </aside>

      {!isDesktop ? (
        <button
          type="button"
          className="dashboard__menu-toggle"
          onClick={toggleSidebar}
          aria-label={isSidebarOpen ? t.home.header.closeMenu : t.home.header.openMenu}
        >
          <span />
          <span />
          <span />
        </button>
      ) : null}

      {!isDesktop && isSidebarOpen ? <div className="dashboard__overlay" onClick={closeSidebar} aria-hidden="true" /> : null}

      <div className="dashboard__main">
        <header className="dashboard__header">
          <div className="dashboard__header-title">
            <div>
              <h1>{headerTitle}</h1>
              <p className="dashboard__subtitle">{t.home.header.subtitle}</p>
            </div>
          </div>
          <div className="dashboard__actions">
            <label className="dashboard__search" htmlFor="dashboard-search">
              <span className="visually-hidden">{t.home.header.searchPlaceholder}</span>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16a6.471 6.471 0 0 0 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5Zm-6 0A4.5 4.5 0 1 1 14 9.5 4.505 4.505 0 0 1 9.5 14Z"
                  fill="currentColor"
                />
              </svg>
              <input id="dashboard-search" type="search" placeholder={t.home.header.searchPlaceholder} />
            </label>
            <LanguageSelector value={language} onChange={onLanguageChange} />
            <button type="button" className="dashboard__notification" aria-label={t.home.header.notifications}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M12 3a5 5 0 0 0-5 5v2.17c0 .7-.28 1.37-.77 1.86L4.6 13.65A1 1 0 0 0 5.3 15h13.4a1 1 0 0 0 .7-1.35l-1.63-1.62a2.63 2.63 0 0 1-.77-1.86V8a5 5 0 0 0-5-5Zm0 18a2.5 2.5 0 0 1-2.45-2h4.9A2.5 2.5 0 0 1 12 21Z"
                  fill="currentColor"
                />
              </svg>
              <span />
            </button>
            <div className="dashboard__user-chip">
              <div className="dashboard__user-initials" aria-hidden="true">
                {initials || 'AD'}
              </div>
              <div>
                <p>{displayName}</p>
                <span>{user?.role ?? t.home.roleLabel}</span>
              </div>
            </div>
          </div>
        </header>

        {activePage === 'dashboard' ? renderDashboard() : placeholderPages[activePage] ?? null}
      </div>
    </div>
  );
};

export default HomePage;
