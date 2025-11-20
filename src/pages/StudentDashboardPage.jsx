import { useEffect, useMemo, useState } from 'react';
import LanguageSelector from '../components/LanguageSelector';
import { API_BASE_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import { getTranslation } from '../i18n/translations';
import { handleExpiredToken } from '../utils/auth';
import './StudentDashboardPage.css';

const formatCurrency = (value, locale = 'es-MX') => {
  const normalized = Number.isFinite(value) ? value : Number(value) || 0;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  }).format(normalized);
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

const StudentDashboardPage = ({ language = 'es', onLanguageChange }) => {
  const { token, user, logout } = useAuth();
  const t = getTranslation(language);
  const strings = t.home?.studentDashboard ?? {};
  const locale = language === 'en' ? 'en-US' : 'es-MX';

  const [profile, setProfile] = useState(null);
  const [pendingAmount, setPendingAmount] = useState(null);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [tuitionPayments, setTuitionPayments] = useState([]);
  const [recentPayments, setRecentPayments] = useState([]);
  const [recharges, setRecharges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshIndex, setRefreshIndex] = useState(0);

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

  return (
    <div className="student-dashboard">
      <header className="student-dashboard__header">
        <div>
          <p className="student-dashboard__eyebrow">{strings.title}</p>
          <h1>{studentName}</h1>
          <p className="student-dashboard__subtitle">{strings.subtitle}</p>
        </div>
        <div className="student-dashboard__header-actions">
          <LanguageSelector language={language} onLanguageChange={onLanguageChange} />
          <button type="button" className="student-dashboard__refresh" onClick={handleRefresh} disabled={loading}>
            {strings.actions?.refresh}
          </button>
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
        <article className="student-dashboard__card">
          <p className="student-dashboard__card-label">{strings.cards?.pending}</p>
          <h2>{pendingAmount == null ? '—' : formatCurrency(pendingAmount, locale)}</h2>
          <p className="student-dashboard__muted">{strings.cards?.pendingHint}</p>
        </article>
        <article className="student-dashboard__card">
          <p className="student-dashboard__card-label">{strings.cards?.balance}</p>
          <h2>{formatCurrency(profile?.balance ?? 0, locale)}</h2>
          <p className="student-dashboard__muted">{strings.cards?.balanceHint}</p>
        </article>
        <article className="student-dashboard__card">
          <p className="student-dashboard__card-label">{strings.cards?.requests}</p>
          <h2>{pendingRequests.length}</h2>
          <p className="student-dashboard__muted">{strings.cards?.requestsHint}</p>
        </article>
      </section>

      <section className="student-dashboard__section">
        <div className="student-dashboard__section-header">
          <h3>{strings.sections?.studentInfo?.title}</h3>
          <p className="student-dashboard__muted">{strings.sections?.studentInfo?.description}</p>
        </div>
        <div className="student-dashboard__info-grid">
          <div>
            <p className="student-dashboard__muted">{strings.sections?.studentInfo?.registerId}</p>
            <p>{profile?.registerId || '—'}</p>
          </div>
          <div>
            <p className="student-dashboard__muted">{strings.sections?.studentInfo?.paymentReference}</p>
            <p>{profile?.paymentReference || '—'}</p>
          </div>
          <div>
            <p className="student-dashboard__muted">{strings.sections?.studentInfo?.school}</p>
            <p>{profile?.commercialName || '—'}</p>
          </div>
          <div>
            <p className="student-dashboard__muted">{strings.sections?.studentInfo?.generation}</p>
            <p>{profile?.generation || '—'}</p>
          </div>
          <div>
            <p className="student-dashboard__muted">{strings.sections?.studentInfo?.grade}</p>
            <p>{profile?.gradeGroup || '—'}</p>
          </div>
          <div>
            <p className="student-dashboard__muted">{strings.sections?.studentInfo?.status}</p>
            <p>{profile?.userStatus || '—'}</p>
          </div>
        </div>
      </section>

      <section className="student-dashboard__section">
        <div className="student-dashboard__section-header">
          <h3>{strings.sections?.pendingRequests?.title}</h3>
          <p className="student-dashboard__muted">{strings.sections?.pendingRequests?.description}</p>
        </div>
        {loading && pendingRequests.length === 0 ? (
          <p className="student-dashboard__muted">{strings.loading}</p>
        ) : null}
        {!loading && pendingRequests.length === 0 ? (
          <p className="student-dashboard__muted">{strings.sections?.pendingRequests?.empty}</p>
        ) : null}
        {pendingRequests.length > 0 ? (
          <div className="student-dashboard__table" role="table">
            <div className="student-dashboard__table-row student-dashboard__table-head" role="row">
              <span role="columnheader">{strings.tables?.pending?.concept}</span>
              <span role="columnheader">{strings.tables?.pending?.amount}</span>
              <span role="columnheader">{strings.tables?.pending?.dueDate}</span>
              <span role="columnheader">{strings.tables?.pending?.status}</span>
            </div>
            {pendingRequests.map((request) => (
              <div className="student-dashboard__table-row" role="row" key={request.paymentRequestId || request.payment_request_id}>
                <span role="cell">{request.pt_name || request.ptName || strings.tables?.pending?.unknown}</span>
                <span role="cell">{formatCurrency(request.pr_amount ?? request.prAmount ?? 0, locale)}</span>
                <span role="cell">{formatDate(request.pr_pay_by || request.prPayBy, locale)}</span>
                <span role="cell" className="status-chip status-chip--warning">
                  {request.ps_pr_name || request.psPrName || strings.tables?.pending?.statusPending}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="student-dashboard__section">
        <div className="student-dashboard__section-header">
          <h3>{strings.sections?.tuition?.title}</h3>
          <p className="student-dashboard__muted">{strings.sections?.tuition?.description}</p>
        </div>
        {tuitionPayments.length === 0 ? (
          <p className="student-dashboard__muted">{strings.sections?.tuition?.empty}</p>
        ) : (
          <div className="student-dashboard__tuition-grid">
            {tuitionPayments.map((yearBlock) => (
              <article className="student-dashboard__tuition-card" key={yearBlock.year}>
                <header>
                  <p className="student-dashboard__muted">{strings.sections?.tuition?.yearLabel}</p>
                  <h4>{yearBlock.year}</h4>
                </header>
                <div className="student-dashboard__tuition-list">
                  {yearBlock.months?.map((month) => (
                    <div key={`${yearBlock.year}-${month.month}`} className="student-dashboard__tuition-row">
                      <div>
                        <p className="student-dashboard__muted">{strings.sections?.tuition?.monthLabel}</p>
                        <p>
                          {month.month.toString().padStart(2, '0')}/{yearBlock.year}
                        </p>
                      </div>
                      <div>
                        <p className="student-dashboard__muted">{strings.sections?.tuition?.totalLabel}</p>
                        <p>{formatCurrency(month.total ?? 0, locale)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="student-dashboard__section">
        <div className="student-dashboard__section-header">
          <h3>{strings.sections?.payments?.title}</h3>
          <p className="student-dashboard__muted">{strings.sections?.payments?.description}</p>
        </div>
        {recentPayments.length === 0 ? (
          <p className="student-dashboard__muted">{strings.sections?.payments?.empty}</p>
        ) : (
          <div className="student-dashboard__table" role="table">
            <div className="student-dashboard__table-row student-dashboard__table-head" role="row">
              <span role="columnheader">{strings.tables?.payments?.concept}</span>
              <span role="columnheader">{strings.tables?.payments?.amount}</span>
              <span role="columnheader">{strings.tables?.payments?.date}</span>
              <span role="columnheader">{strings.tables?.payments?.status}</span>
            </div>
            {recentPayments.map((payment) => (
              <div className="student-dashboard__table-row" role="row" key={payment.payment_id || payment.paymentId}>
                <span role="cell">{payment.pt_name || payment.partConceptName || strings.tables?.payments?.unknown}</span>
                <span role="cell">{formatCurrency(payment.amount ?? 0, locale)}</span>
                <span role="cell">{formatDate(payment.payment_created_at || payment.paymentCreatedAt, locale)}</span>
                <span role="cell" className="status-chip">
                  {payment.payment_status_name || payment.paymentStatusName || strings.tables?.payments?.statusPending}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="student-dashboard__section">
        <div className="student-dashboard__section-header">
          <h3>{strings.sections?.recharges?.title}</h3>
          <p className="student-dashboard__muted">{strings.sections?.recharges?.description}</p>
        </div>
        {recharges.length === 0 ? (
          <p className="student-dashboard__muted">{strings.sections?.recharges?.empty}</p>
        ) : (
          <div className="student-dashboard__table" role="table">
            <div className="student-dashboard__table-row student-dashboard__table-head" role="row">
              <span role="columnheader">{strings.tables?.recharges?.amount}</span>
              <span role="columnheader">{strings.tables?.recharges?.date}</span>
              <span role="columnheader">{strings.tables?.recharges?.receipt}</span>
            </div>
            {recharges.map((recharge) => (
              <div className="student-dashboard__table-row" role="row" key={recharge.balance_recharge_id || recharge.balanceRechargeId}>
                <span role="cell">{formatCurrency(recharge.amount ?? 0, locale)}</span>
                <span role="cell">{formatDate(recharge.created_at || recharge.createdAt, locale, { timeStyle: 'short' })}</span>
                <span role="cell">{recharge.ticket || strings.tables?.recharges?.noTicket}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default StudentDashboardPage;
