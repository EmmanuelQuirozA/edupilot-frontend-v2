import { useCallback, useEffect, useMemo, useState } from 'react';
import LanguageSelector from '../components/LanguageSelector';
import { API_BASE_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import { getTranslation } from '../i18n/translations';
import { handleExpiredToken } from '../utils/auth';
import { buildMenuItemsForRole, getRoleLabel, normalizeRoleName } from '../utils/menuItems';
import '../components/HomePage.css';
import './StudentDashboardPage.css';

const formatCurrency = (value, locale = 'es-MX') => {
  const normalized = Number.isFinite(value) ? value : Number(value) || 0;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  }).format(normalized);
};

const getMonthName = (monthNumber, locale = 'es-MX') => {
  if (!Number.isFinite(monthNumber)) {
    return '';
  }

  return new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(2000, monthNumber - 1, 1));
};

const formatDate = (value, locale = 'es-MX', options = {}) => {
  if (!value) {
    return '—';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    ...options,
  }).format(date);
};

const normalizeArray = (data) => {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.content)) {
    return data.content;
  }

  return [];
};

const COLLAPSE_BREAKPOINT = 1200;
const getIsDesktop = () => (typeof window === 'undefined' ? true : window.innerWidth >= COLLAPSE_BREAKPOINT);

const StudentDashboardPage = ({ language = 'es', onLanguageChange }) => {
  const { token, user, logout } = useAuth();
  const t = getTranslation(language);
  const strings = t.home?.studentDashboard ?? {};
  const locale = language === 'en' ? 'en-US' : 'es-MX';
  const roleName = user?.role_name ?? user?.role ?? user?.roleName ?? '';
  const normalizedRole = normalizeRoleName(roleName);
  const roleLabel = getRoleLabel(t, roleName);
  const menuItems = useMemo(() => buildMenuItemsForRole(normalizedRole, t.home.menu.items), [normalizedRole, t.home.menu.items]);
  const displayName = user?.first_name ?? user?.name ?? user?.username ?? roleLabel;
  const initials = displayName
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');
  const headerTitle = strings.title ?? t.home.header.title;
  const headerSubtitle = strings.subtitle ?? t.home.header.subtitle;

  const [profile, setProfile] = useState(null);
  const [pendingAmount, setPendingAmount] = useState(null);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [tuitionPayments, setTuitionPayments] = useState([]);
  const [recentPayments, setRecentPayments] = useState([]);
  const [recharges, setRecharges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [isDesktop, setIsDesktop] = useState(getIsDesktop);
  const [isSidebarOpen, setIsSidebarOpen] = useState(getIsDesktop);
  const [activeNav, setActiveNav] = useState('dashboard');


  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen((value) => !value);
  }, []);

  const closeSidebar = useCallback(() => {
    setIsSidebarOpen(false);
  }, []);

  const handleNavClick = useCallback(
    (key) => {
      setActiveNav(key);
      if (!isDesktop) {
        setIsSidebarOpen(false);
      }
    },
    [isDesktop],
  );

  const headers = useMemo(
    () => ({
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }),
    [token],
  );

  const fetchJson = async (path, { signal } = {}) => {
    const response = await fetch(path, { headers, signal });
    handleExpiredToken(response, logout);

    if (!response.ok) {
      const error = new Error('REQUEST_FAILED');
      error.status = response.status;
      throw error;
    }

    return response.json();
  };


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

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        const [profileData, pendingAmountData, pendingRequestsData, tuitionData, paymentsData, rechargeData] =
          await Promise.all([
            fetchJson(`${API_BASE_URL}/students/read-only`, { signal }),
            fetchJson(`${API_BASE_URL}/payment-requests/pending`, { signal }),
            fetchJson(`${API_BASE_URL}/payment-requests/student-pending-payments`, { signal }),
            fetchJson(`${API_BASE_URL}/payments/grouped?lang=${language}&tuitions=true`, { signal }),
            fetchJson(`${API_BASE_URL}/reports/payments?lang=${language}&offset=0&limit=10&export_all=false`, {
              signal,
            }),
            fetchJson(`${API_BASE_URL}/reports/balance-recharges?lang=${language}&offset=0&limit=10&export_all=false`, {
              signal,
            }),
          ]);

        setProfile(profileData ?? null);
        setPendingAmount(Number(pendingAmountData ?? 0));
        setPendingRequests(normalizeArray(pendingRequestsData));
        setTuitionPayments(Array.isArray(tuitionData) ? tuitionData : []);
        setRecentPayments(normalizeArray(paymentsData));
        setRecharges(normalizeArray(rechargeData));
      } catch (requestError) {
        if (requestError?.name === 'AbortError') {
          return;
        }
        setError(strings.loadError ?? 'No fue posible cargar la información.');
      } finally {
        setLoading(false);
      }
    };

    loadData();

    return () => {
      controller.abort();
    };
  }, [headers, language, logout, refreshIndex, strings.loadError]);

  const handleRefresh = () => {
    setRefreshIndex((value) => value + 1);
  };

  const studentName = profile?.fullName || profile?.username || user?.name || user?.username || 'Alumno';
  const reference = profile?.paymentReference || '—';
  const grade = profile?.gradeGroup || '—';
  const generation = profile?.generation || '—';

  const tuitionStatus = useMemo(() => {
    const allMonths = tuitionPayments.flatMap((block) =>
      (block.months || []).map((month) => ({
        ...month,
        year: block.year,
        sortKey: block.year * 100 + (Number(month.month) || 0),
      })),
    );

    if (!allMonths.length) {
      return null;
    }

    const latest = allMonths.reduce((acc, current) => {
      if (!acc || current.sortKey > acc.sortKey) {
        return current;
      }
      return acc;
    }, null);

    const firstItem = Array.isArray(latest.items) ? latest.items[0] : null;
    const label = `${getMonthName(latest.month, locale)} ${latest.year}`;
    const status = firstItem?.paymentStatusName || firstItem?.payment_status_name || strings.cards?.tuitionStatus?.unknown;
    const amount = latest.total ?? firstItem?.amount ?? 0;

    return {
      label,
      status,
      amount: formatCurrency(amount, locale),
    };
  }, [locale, strings.cards?.tuitionStatus?.unknown, tuitionPayments]);

  const tuitionAmountText = useMemo(() => {
    const template = strings.cards?.tuitionStatus?.amount;
    const formattedAmount = tuitionStatus?.amount || formatCurrency(0, locale);
    return template ? template.replace('{amount}', formattedAmount) : formattedAmount;
  }, [locale, strings.cards?.tuitionStatus?.amount, tuitionStatus?.amount]);

  const recentEvents = useMemo(() => {
    const payments = recentPayments.map((payment) => ({
      id: payment.payment_id || payment.paymentId,
      type: 'payment',
      concept: payment.pt_name || payment.partConceptName || strings.tables?.payments?.unknown,
      amount: formatCurrency(payment.amount ?? 0, locale),
      status: payment.payment_status_name || payment.paymentStatusName || strings.tables?.payments?.statusPending,
      date: payment.payment_created_at || payment.paymentCreatedAt,
    }));

    const rechargeItems = recharges.map((recharge) => ({
      id: recharge.balance_recharge_id || recharge.balanceRechargeId,
      type: 'recharge',
      concept: strings.tables?.recharges?.rechargeLabel,
      amount: formatCurrency(recharge.amount ?? 0, locale),
      status: strings.tables?.recharges?.completed,
      date: recharge.created_at || recharge.createdAt,
    }));

    return [...payments, ...rechargeItems]
      .filter((item) => item.date)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 6);
  }, [locale, recentPayments, recharges, strings.tables?.payments, strings.tables?.recharges]);

  const dashboardContent = (
    <div className="student-dashboard">
      <header className="student-dashboard__header">
        <div className="student-dashboard__hero">
          <div>
            <p className="student-dashboard__eyebrow">{strings.title}</p>
            <h1>
              {strings.greeting} {studentName} 👋
            </h1>
            <p className="student-dashboard__subtitle">{strings.subtitle}</p>
            <div className="student-dashboard__hero-tags" aria-label={strings.hero?.ariaLabel}>
              <span className="badge">{strings.hero?.referenceLabel}: {reference}</span>
              <span className="badge">{strings.hero?.gradeLabel}: {grade}</span>
              <span className="badge">{strings.hero?.generationLabel}: {generation}</span>
            </div>
          </div>
          <div className="student-dashboard__header-actions">
            <button type="button" className="student-dashboard__refresh" onClick={handleRefresh} disabled={loading}>
              {strings.actions?.refresh}
            </button>
          </div>
        </div>
        <div className="student-dashboard__quick-links">
          <p className="student-dashboard__muted">{strings.quickActions?.title}</p>
          <div className="student-dashboard__quick-actions">
            <button type="button" className="ghost-button" onClick={handleRefresh} disabled={loading}>
              {strings.quickActions?.seeHistory}
            </button>
            <button type="button" className="primary-outline" disabled={loading}>
              {strings.quickActions?.contact}
            </button>
          </div>
        </div>
      </header>

      {error ? (
        <div className="student-dashboard__alert" role="alert">
          <p>{error}</p>
          <button type="button" onClick={handleRefresh}>
            {strings.actions?.retry}
          </button>
        </div>
      ) : null}

      <section className="student-dashboard__grid">
        <article className="student-dashboard__card student-dashboard__card--success">
          <div>
            <p className="student-dashboard__card-label">{strings.cards?.balance}</p>
            <h2>{formatCurrency(profile?.balance ?? 0, locale)}</h2>
            <p className="student-dashboard__muted">{strings.cards?.balanceHint}</p>
          </div>
          <span className="pill pill--success">{strings.cards?.available}</span>
        </article>
        <article className="student-dashboard__card student-dashboard__card--danger">
          <div>
            <p className="student-dashboard__card-label">{strings.cards?.pending}</p>
            <h2>{pendingAmount == null ? '—' : formatCurrency(pendingAmount, locale)}</h2>
            <p className="student-dashboard__muted">{strings.cards?.pendingHint}</p>
          </div>
          <button type="button" className="primary-button" disabled={pendingAmount === 0 || pendingAmount == null}>
            {strings.cards?.payNow}
          </button>
        </article>
        <article className="student-dashboard__card student-dashboard__card--warning">
          <div>
            <p className="student-dashboard__card-label">{strings.cards?.requests}</p>
            <h2>{pendingRequests.length}</h2>
            <p className="student-dashboard__muted">{strings.cards?.requestsHint}</p>
          </div>
          <span className="pill pill--warning">{strings.cards?.pendingTag}</span>
        </article>
        <article className="student-dashboard__card student-dashboard__card--info">
          <div>
            <p className="student-dashboard__card-label">{strings.cards?.tuitionStatus?.title}</p>
            <h2>{tuitionStatus?.label || strings.cards?.tuitionStatus?.empty}</h2>
            <p className="student-dashboard__muted">{tuitionAmountText}</p>
          </div>
          <span className="pill">{tuitionStatus?.status || strings.cards?.tuitionStatus?.unknown}</span>
        </article>
      </section>

      <section className="student-dashboard__two-column">
        <article className="student-dashboard__section">
          <div className="student-dashboard__section-header">
            <div>
              <h3>{strings.sections?.pendingRequests?.title}</h3>
              <p className="student-dashboard__muted">{strings.sections?.pendingRequests?.description}</p>
            </div>
            <button type="button" className="ghost-button" onClick={handleRefresh} disabled={loading}>
              {strings.sections?.pendingRequests?.viewAll}
            </button>
          </div>
          {loading && pendingRequests.length === 0 ? <p className="student-dashboard__muted">{strings.loading}</p> : null}
          {!loading && pendingRequests.length === 0 ? (
            <p className="student-dashboard__muted">{strings.sections?.pendingRequests?.empty}</p>
          ) : null}
          {pendingRequests.length > 0 ? (
            <div className="student-dashboard__tiles">
              {pendingRequests.map((request) => (
                <div className="tile" key={request.paymentRequestId || request.payment_request_id}>
                  <div>
                    <p className="student-dashboard__muted">{strings.tables?.pending?.concept}</p>
                    <p className="tile__title">{request.pt_name || request.ptName || strings.tables?.pending?.unknown}</p>
                    <p className="student-dashboard__muted">
                      {strings.sections?.pendingRequests?.dueLabel}: {formatDate(request.pr_pay_by || request.prPayBy, locale)}
                    </p>
                  </div>
                  <div className="tile__meta">
                    <span className="pill pill--warning">{request.ps_pr_name || request.psPrName || strings.tables?.pending?.statusPending}</span>
                    <strong>{formatCurrency(request.pr_amount ?? request.prAmount ?? 0, locale)}</strong>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </article>

        <article className="student-dashboard__section">
          <div className="student-dashboard__section-header">
            <div>
              <h3>{strings.sections?.studentInfo?.title}</h3>
              <p className="student-dashboard__muted">{strings.sections?.studentInfo?.description}</p>
            </div>
          </div>
          <div className="student-dashboard__info-grid">
            <div>
              <p className="student-dashboard__muted">{strings.sections?.studentInfo?.registerId}</p>
              <p>{profile?.registerId || '—'}</p>
            </div>
            <div>
              <p className="student-dashboard__muted">{strings.sections?.studentInfo?.paymentReference}</p>
              <p>{reference}</p>
            </div>
            <div>
              <p className="student-dashboard__muted">{strings.sections?.studentInfo?.school}</p>
              <p>{profile?.commercialName || '—'}</p>
            </div>
            <div>
              <p className="student-dashboard__muted">{strings.sections?.studentInfo?.generation}</p>
              <p>{generation}</p>
            </div>
            <div>
              <p className="student-dashboard__muted">{strings.sections?.studentInfo?.grade}</p>
              <p>{grade}</p>
            </div>
            <div>
              <p className="student-dashboard__muted">{strings.sections?.studentInfo?.status}</p>
              <p>{profile?.userStatus || '—'}</p>
            </div>
          </div>
        </article>
      </section>

      <section className="student-dashboard__section">
        <div className="student-dashboard__section-header">
          <div>
            <h3>{strings.sections?.history?.title}</h3>
            <p className="student-dashboard__muted">{strings.sections?.history?.description}</p>
          </div>
          <button type="button" className="ghost-button" disabled={loading}>
            {strings.sections?.history?.viewAll}
          </button>
        </div>
        {recentEvents.length === 0 ? (
          <p className="student-dashboard__muted">{strings.sections?.history?.empty}</p>
        ) : (
          <div className="student-dashboard__timeline">
            {recentEvents.map((event) => (
              <div className="timeline-item" key={`${event.type}-${event.id}`}>
                <div className={`timeline-icon timeline-icon--${event.type}`}>{event.type === 'recharge' ? '+' : '$'}</div>
                <div className="timeline-content">
                  <div className="timeline-header">
                    <p className="timeline-title">{event.concept}</p>
                    <span className="pill pill--ghost">{event.status}</span>
                  </div>
                  <p className="timeline-amount">{event.amount}</p>
                  <p className="student-dashboard__muted">{formatDate(event.date, locale, { timeStyle: 'short' })}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="student-dashboard__section student-dashboard__support">
        <div>
          <p className="student-dashboard__eyebrow">{strings.support?.title}</p>
          <h3>{strings.support?.headline}</h3>
          <p className="student-dashboard__muted">{strings.support?.description}</p>
        </div>
        <div className="student-dashboard__support-actions">
          <button type="button" className="primary-button" disabled={loading}>
            {strings.support?.contact}
          </button>
          <button type="button" className="ghost-button" onClick={handleRefresh} disabled={loading}>
            {strings.support?.refresh}
          </button>
        </div>
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
            type='button'
            className='sidebar__close'
            onClick={closeSidebar}
            aria-label={t.home.header.closeMenu}
          >
            ×
          </button>
        ) : null}
        <div className='sidebar__profile'>
          <div className='sidebar__avatar' aria-hidden='true'>
            {initials || 'AD'}
          </div>
          <div>
            <p className='sidebar__name'>{displayName}</p>
            <span className='sidebar__role'>{roleLabel}</span>
          </div>
        </div>
        <nav className='sidebar__nav' aria-label={t.home.menu.main}>
          <p className='sidebar__section'>{t.home.menu.main}</p>
          <ul>
            {menuItems.map((item) => (
              <li
                key={item.key}
                className={activeNav === item.key ? 'is-active' : ''}
                onClick={() => handleNavClick(item.key)}
              >
                {item.icon} {item.label}
              </li>
            ))}
          </ul>
          <p className='sidebar__section'>{t.home.menu.settings}</p>
          <ul>
            <li>{t.home.menu.paymentCenter}</li>
            <li>{t.home.menu.configuration}</li>
          </ul>
        </nav>
        <button type='button' className='sidebar__logout' onClick={logout}>
          {t.home.logout}
        </button>
      </aside>

      {!isDesktop ? (
        <button
          type='button'
          className='dashboard__menu-toggle'
          onClick={toggleSidebar}
          aria-label={isSidebarOpen ? t.home.header.closeMenu : t.home.header.openMenu}
        >
          <span />
          <span />
          <span />
        </button>
      ) : null}

      {!isDesktop && isSidebarOpen ? <div className='dashboard__overlay' onClick={closeSidebar} aria-hidden='true' /> : null}

      <div className='dashboard__main'>
        <header className='dashboard__header'>
          <div className='dashboard__header-title'>
            <div>
              <h1>{headerTitle}</h1>
              <p className='dashboard__subtitle'>{headerSubtitle}</p>
            </div>
          </div>
          <div className='dashboard__actions'>
            <LanguageSelector value={language} onChange={onLanguageChange} />
            <div className='dashboard__user-chip'>
              <div className='dashboard__user-initials' aria-hidden='true'>
                {initials || 'AD'}
              </div>
              <div>
                <p>{displayName}</p>
                <span>{user?.role ?? roleLabel}</span>
              </div>
            </div>
          </div>
        </header>

        {dashboardContent}
      </div>
    </div>
  );
}

export default StudentDashboardPage;
