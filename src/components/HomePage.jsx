import { useCallback, useEffect, useMemo, useState } from 'react';
import LanguageSelector from './LanguageSelector';
import { getTranslation } from '../i18n/translations';
import { useAuth } from '../context/AuthContext';
import PaymentsFinancePage from '../pages/PaymentsFinancePage';
import StudentsGroupsPage from '../pages/StudentsGroupsPage';
import StudentsBulkUploadPage from '../pages/StudentsBulkUploadPage';
import TeachersPage from '../pages/TeachersPage';
import SchedulesTasksPage from '../pages/SchedulesTasksPage';
import GradesPage from '../pages/GradesPage';
import CommunicationsPage from '../pages/CommunicationsPage';
import { buildMenuItemsForRole, getRoleLabel, normalizeRoleName } from '../utils/menuItems';
import Breadcrumbs from './Breadcrumbs';
import StudentDetailPage from '../pages/StudentDetailPage';
import './HomePage.css';
import { getRoleNameFromToken } from '../utils/jwt';

const COLLAPSE_BREAKPOINT = 1200;

const getIsDesktop = () =>
  typeof window === 'undefined' ? true : window.innerWidth >= COLLAPSE_BREAKPOINT;

const decodeRouteSegment = (segment) => {
  if (segment == null) {
    return '';
  }

  const stringValue = typeof segment === 'string' ? segment : String(segment);

  try {
    return decodeURIComponent(stringValue);
  } catch (decodeError) {
    return stringValue;
  }
};

const HomePage = ({
  language,
  onLanguageChange,
  activePage: activePageProp = 'dashboard',
  onNavigate,
  routeSegments = [],
  onNavigateToStudentDetail,
  onNavigateToBulkUpload,
  onPaymentsSectionChange,
  onStudentsSectionChange,
  onNavigateToPaymentDetail,
  onNavigateToPaymentRequestDetail,
  onNavigateToPaymentRequestScheduleDetail,
  onNavigateToPaymentRequestResult,
}) => {
  const { token, user, logout } = useAuth();
  const t = getTranslation(language);
  const tokenRoleName = useMemo(() => getRoleNameFromToken(token), [token]);
  const roleName = tokenRoleName ?? user?.role_name ?? user?.role ?? user?.roleName ?? '';
  const normalizedRole = normalizeRoleName(roleName);
  const roleLabel = getRoleLabel(t, roleName);

  const [activePage, setActivePage] = useState(activePageProp);
  const [isDesktop, setIsDesktop] = useState(getIsDesktop);
  const [isSidebarOpen, setIsSidebarOpen] = useState(getIsDesktop);
  const [detailBreadcrumbLabel, setDetailBreadcrumbLabel] = useState(
    t.home.studentsPage.detail.breadcrumbFallback,
  );
  const [paymentDetailBreadcrumbLabel, setPaymentDetailBreadcrumbLabel] = useState(
    t.home.paymentsPage.detail?.breadcrumbFallback || t.home.menu.items.payments,
  );

  const paymentsRouteSegments = activePage === 'payments' ? routeSegments : [];
  const paymentsPrimarySegment = paymentsRouteSegments[0] ?? '';
  const paymentsSecondarySegment = paymentsRouteSegments[1] ?? '';
  const paymentsTertiarySegment = paymentsRouteSegments[2] ?? '';
  const isPaymentRequestRoute = activePage === 'payments' && paymentsPrimarySegment === 'requests';
  const isPaymentsTabRoute =
    activePage === 'payments' && paymentsPrimarySegment === 'payments' && !paymentsSecondarySegment;
  const isPaymentDetailRoute =
    activePage === 'payments' && paymentsPrimarySegment === 'payments' && Boolean(paymentsSecondarySegment);
  const isPaymentRequestResultRoute = isPaymentRequestRoute && paymentsSecondarySegment === 'result';
  const isPaymentRequestScheduledRoute = isPaymentRequestRoute && paymentsSecondarySegment === 'scheduled';
  const isPaymentRequestScheduleDetailRoute =
    isPaymentRequestScheduledRoute && paymentsRouteSegments.length > 2;
  const isPaymentRequestDetailRoute =
    isPaymentRequestRoute &&
    Boolean(paymentsSecondarySegment) &&
    paymentsSecondarySegment !== 'scheduled' &&
    paymentsSecondarySegment !== 'result';
  const isPaymentDetailActive =
    isPaymentDetailRoute ||
    isPaymentRequestDetailRoute ||
    isPaymentRequestResultRoute ||
    isPaymentRequestScheduleDetailRoute;
  const paymentsSectionKey = (() => {
    if (activePage !== 'payments') {
      return 'tuition';
    }

    if (isPaymentRequestDetailRoute || isPaymentRequestResultRoute || isPaymentRequestScheduleDetailRoute) {
      return 'requests';
    }

    if (isPaymentDetailRoute || isPaymentsTabRoute) {
      return 'payments';
    }

    if (!paymentsPrimarySegment || paymentsPrimarySegment === 'tuition') {
      return 'tuition';
    }

    return paymentsPrimarySegment;
  })();

  const studentsRouteSegments = activePage === 'students' ? routeSegments : [];
  const studentsPrimarySegment = studentsRouteSegments[0] ?? '';
  const isBulkUploadActive = activePage === 'students' && studentsPrimarySegment === 'bulk-upload';
  const isStudentsTabRoute = activePage === 'students' && studentsPrimarySegment === 'tab';
  const studentsTabKey =
    activePage === 'students'
      ? isStudentsTabRoute
        ? studentsRouteSegments[1] ?? 'students'
        : 'students'
      : 'students';
  const isStudentDetailActive =
    activePage === 'students' && !isBulkUploadActive && !isStudentsTabRoute && studentsRouteSegments.length > 0;
  const studentDetailId = isStudentDetailActive ? studentsPrimarySegment : null;

  useEffect(() => {
    setActivePage(activePageProp);
  }, [activePageProp]);

  useEffect(() => {
    if (isStudentDetailActive) {
      setDetailBreadcrumbLabel(t.home.studentsPage.detail.breadcrumbFallback);
    }
  }, [isStudentDetailActive, studentDetailId, t.home.studentsPage.detail.breadcrumbFallback]);

  useEffect(() => {
    if (!isStudentDetailActive) {
      setDetailBreadcrumbLabel(t.home.studentsPage.detail.breadcrumbFallback);
    }
  }, [isStudentDetailActive, t.home.studentsPage.detail.breadcrumbFallback]);

  useEffect(() => {
    if (!isPaymentDetailActive) {
      setPaymentDetailBreadcrumbLabel(
        t.home.paymentsPage.detail?.breadcrumbFallback || t.home.menu.items.payments,
      );
    }
  }, [
    isPaymentDetailActive,
    t.home.menu.items.payments,
    t.home.paymentsPage.detail?.breadcrumbFallback,
  ]);

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

  const displayName = user?.first_name ?? user?.name ?? user?.username ?? roleLabel;
  const initials = displayName
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');

  const menuItems = useMemo(
    () => buildMenuItemsForRole(normalizedRole, t.home.menu.items),
    [normalizedRole, t.home.menu.items],
  );

  const studentsPageStrings = t.home.studentsPage;
  const studentsBulkStrings = studentsPageStrings.bulkUploadPage ?? {};
  const studentsDetailStrings = studentsPageStrings.detail ?? {};

  const handlePaymentsSectionChange = useCallback(
    (sectionKey, options) => {
      onPaymentsSectionChange?.(sectionKey, options);
    },
    [onPaymentsSectionChange],
  );

  const handleStudentsSectionChange = useCallback(
    (sectionKey, options) => {
      onStudentsSectionChange?.(sectionKey, options);
    },
    [onStudentsSectionChange],
  );

  const handleNavClick = useCallback(
    (key) => {
      setActivePage(key);
      onNavigate?.(key);

      if (!isDesktop) {
        setIsSidebarOpen(false);
      }
    },
    [isDesktop, onNavigate],
  );

  const handleDetailBreadcrumbChange = useCallback(
    (label) => {
      const trimmed = typeof label === 'string' ? label.trim() : '';
      setDetailBreadcrumbLabel(trimmed || t.home.studentsPage.detail.breadcrumbFallback);
    },
    [t.home.studentsPage.detail.breadcrumbFallback],
  );

  const handleStudentDetailNavigate = useCallback(
    (student) => {
      if (!student || !student.id) {
        return;
      }

      if (student.name) {
        setDetailBreadcrumbLabel(student.name);
      } else {
        setDetailBreadcrumbLabel(t.home.studentsPage.detail.breadcrumbFallback);
      }

      onNavigateToStudentDetail?.(student.id);
    },
    [onNavigateToStudentDetail, t.home.studentsPage.detail.breadcrumbFallback],
  );

  const handlePaymentDetailNavigate = useCallback(
    (paymentId) => {
      if (!paymentId) {
        return;
      }

      onNavigateToPaymentDetail?.(paymentId);
    },
    [onNavigateToPaymentDetail],
  );

  const handlePaymentRequestDetailNavigate = useCallback(
    (requestId, options) => {
      if (!requestId) {
        return;
      }

      onNavigateToPaymentRequestDetail?.(requestId, options);
    },
    [onNavigateToPaymentRequestDetail],
  );

  const handlePaymentRequestScheduleDetailNavigate = useCallback(
    (scheduleId, options) => {
      if (!scheduleId) {
        return;
      }

      onNavigateToPaymentRequestScheduleDetail?.(scheduleId, options);
    },
    [onNavigateToPaymentRequestScheduleDetail],
  );

  const handlePaymentRequestResultNavigate = useCallback(
    (options) => {
      onNavigateToPaymentRequestResult?.(options);
    },
    [onNavigateToPaymentRequestResult],
  );

  const paymentsContent = (
    <PaymentsFinancePage
      title={t.home.pages.payments.title}
      description={t.home.pages.payments.description}
      language={language}
      strings={t.home.paymentsPage}
      onStudentDetail={handleStudentDetailNavigate}
      onPaymentDetail={handlePaymentDetailNavigate}
      onPaymentRequestDetail={handlePaymentRequestDetailNavigate}
      onPaymentRequestScheduleDetail={handlePaymentRequestScheduleDetailNavigate}
      onPaymentRequestResult={handlePaymentRequestResultNavigate}
      onPaymentBreadcrumbChange={setPaymentDetailBreadcrumbLabel}
      activeSectionKey={paymentsSectionKey}
      onSectionChange={handlePaymentsSectionChange}
      routeSegments={paymentsRouteSegments}
    />
  );

  const genericPages = useMemo(
    () => ({
      teachers: <TeachersPage {...t.home.pages.teachers} />,
      schedules: <SchedulesTasksPage {...t.home.pages.schedules} />,
      grades: <GradesPage {...t.home.pages.grades} />,
      communications: <CommunicationsPage {...t.home.pages.communications} />,
    }),
    [t.home.pages],
  );

  const studentsContent = isStudentDetailActive ? (
    <StudentDetailPage
      studentId={studentDetailId}
      language={language}
      strings={studentsDetailStrings}
      onBreadcrumbChange={handleDetailBreadcrumbChange}
      onNavigateToStudents={() => handleNavClick('students')}
    />
  ) : isBulkUploadActive ? (
    <StudentsBulkUploadPage
      language={language}
      strings={studentsBulkStrings}
      onNavigateBack={() => handleNavClick('students')}
    />
  ) : (
    <StudentsGroupsPage
      language={language}
      placeholder={t.home.pages.students}
      strings={studentsPageStrings}
      onStudentDetail={handleStudentDetailNavigate}
      onBulkUpload={onNavigateToBulkUpload}
      activeSectionKey={studentsTabKey}
      onSectionChange={handleStudentsSectionChange}
    />
  );

  const headerTitle =
    activePage === 'dashboard'
      ? t.home.header.title
      : t.home.pages[activePage]?.title ?? t.home.header.title;

  const breadcrumbs = useMemo(() => {
    const items = [
      {
        label: t.home.menu.items.dashboard,
        onClick: () => handleNavClick('dashboard'),
      },
    ];

    if (activePage === 'dashboard' && !isStudentDetailActive) {
      return items;
    }

    if (isStudentDetailActive) {
      items.push({
        label: t.home.menu.items.students,
        onClick: () => handleNavClick('students'),
      });
      items.push({
        label: detailBreadcrumbLabel,
      });
      return items;
    }

    if (isBulkUploadActive) {
      items.push({
        label: t.home.menu.items.students,
        onClick: () => handleNavClick('students'),
      });
      items.push({
        label: studentsBulkStrings.breadcrumb ?? studentsPageStrings.actions.bulkUpload,
      });
      return items;
    }

    if (activePage === 'payments') {
      items.push({
        label: t.home.menu.items.payments,
        onClick: () => handleNavClick('payments'),
      });

      if (isPaymentRequestRoute) {
        const requestsLabel =
          t.home.paymentsPage.tabs?.requests ?? t.home.menu.items.payments;
        items.push({
          label: requestsLabel,
          onClick: () => handlePaymentsSectionChange('requests'),
        });

        if (isPaymentRequestScheduledRoute) {
          const scheduledLabel =
            t.home.paymentsPage.requestsViews?.scheduled ?? requestsLabel;
          items.push({
            label: scheduledLabel,
            onClick: () => handlePaymentsSectionChange('requests', { subPath: 'scheduled' }),
          });
        }

        const scheduleFallbackLabel =
          t.home.paymentsPage.detail?.breadcrumbFallback || t.home.menu.items.payments;
        const scheduleDetailId = decodeRouteSegment(paymentsTertiarySegment);
        const scheduleDetailLabel = scheduleDetailId
          ? `${scheduleDetailId}`
          : scheduleFallbackLabel;
        const detailLabel = isPaymentRequestScheduleDetailRoute
          ? scheduleDetailLabel
          : paymentDetailBreadcrumbLabel;

        if (isPaymentDetailActive) {
          items.push({
            label: detailLabel,
          });
        }

        return items;
      }

      if (paymentsPrimarySegment === 'payments') {
        const paymentsLabel = t.home.paymentsPage.tabs?.payments ?? t.home.menu.items.payments;
        items.push({
          label: paymentsLabel,
          onClick: () => handlePaymentsSectionChange('payments'),
        });

        if (isPaymentDetailRoute) {
          items.push({
            label: paymentDetailBreadcrumbLabel,
          });
        }

        return items;
      }

      if (paymentsPrimarySegment && paymentsPrimarySegment !== 'tuition') {
        const paymentsLabel =
          t.home.paymentsPage.tabs?.[paymentsPrimarySegment] ?? t.home.menu.items.payments;
        items.push({
          label: paymentsLabel,
          onClick: () => handlePaymentsSectionChange(paymentsPrimarySegment),
        });
      }

      return items;
    }

    items.push({
      label: t.home.menu.items[activePage] ?? headerTitle,
    });

    return items;
  }, [
    activePage,
    detailBreadcrumbLabel,
    handleNavClick,
    handlePaymentsSectionChange,
    headerTitle,
    isBulkUploadActive,
    isPaymentDetailActive,
    isPaymentDetailRoute,
    isPaymentRequestRoute,
    isPaymentRequestScheduledRoute,
    isPaymentRequestScheduleDetailRoute,
    paymentsPrimarySegment,
    paymentsTertiarySegment,
    isStudentDetailActive,
    paymentDetailBreadcrumbLabel,
    studentsBulkStrings.breadcrumb,
    studentsPageStrings.actions.bulkUpload,
    t.home.menu.items,
    t.home.menu.items.payments,
    t.home.paymentsPage.detail?.breadcrumbFallback,
    t.home.paymentsPage.requestsViews?.scheduled,
    t.home.paymentsPage.tabs?.payments,
    t.home.paymentsPage.tabs?.requests,
  ]);

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
      <div className='page'>
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
      </div>
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
        {/* <div className="sidebar__brand">
          <span className="sidebar__brand-mark">school</span>
          <span className="sidebar__brand-badge">EduPilot</span>
        </div> */}
        <div className="sidebar__profile">
          <div className="sidebar__avatar" aria-hidden="true">
            {initials || 'AD'}
          </div>
          <div>
            <p className="sidebar__name">{displayName}</p>
            <span className="sidebar__role">{roleLabel}</span>
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
                <span>{user?.role ?? roleLabel}</span>
              </div>
            </div>
          </div>
        </header>

        <Breadcrumbs items={breadcrumbs} />
        {activePage === 'dashboard'
          ? renderDashboard()
          : activePage === 'students'
          ? studentsContent
          : activePage === 'payments'
          ? paymentsContent
          : genericPages[activePage] ?? null}
      </div>
    </div>
  );
};

export default HomePage;
