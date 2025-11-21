import { useCallback, useEffect, useMemo, useState } from 'react';
import LanguageSelector from '../components/LanguageSelector';
import { API_BASE_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import { useModal } from '../components/modal/useModal';
import { getTranslation } from '../i18n/translations';
import { handleExpiredToken } from '../utils/auth';
import { buildMenuItemsForRole, getRoleLabel, normalizeRoleName } from '../utils/menuItems';
import { getRoleNameFromToken } from '../utils/jwt';
import Breadcrumbs from '../components/Breadcrumbs';
import '../components/HomePage.css';
import './StudentDashboardPage.css';

const DEFAULT_TUITION_MODAL_STRINGS = {
  title: 'Detalle de pagos de colegiatura',
  summary: {
    student: 'Alumno',
    class: 'Grupo',
    generation: 'Generación',
    level: 'Nivel académico',
    month: 'Mes de pago',
    total: 'Monto total',
    request: 'Solicitud de pago',
  },
  paymentsTitle: 'Pagos registrados',
  paymentsTable: {
    columns: {
      id: 'ID de pago',
      date: 'Fecha',
      amount: 'Monto',
      status: 'Estatus',
    },
    empty: 'No hay pagos registrados para este mes.',
    paymentLinkLabel: 'Abrir detalle del pago',
  },
  requestButton: 'Ver solicitud de pago',
  close: 'Cerrar',
};

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

const formatMonthKey = (date) => {
  const monthLabel = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(date);
  const year = String(date.getFullYear()).slice(-2);
  return `${monthLabel}-${year}`;
};

const formatMonthRangeDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
};

const buildMonthInputValue = (year, month) => `${year}-${String(month).padStart(2, '0')}`;

const parseMonthInputValue = (value) => {
  if (!value || typeof value !== 'string') {
    return null;
  }

  const [yearPart, monthPart] = value.split('-');
  const year = Number(yearPart);
  const month = Number(monthPart);

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return null;
  }

  return new Date(year, month - 1, 1);
};

const formatMonthLabel = (month) => {
  const label = month?.longLabel ?? month?.shortLabel ?? month?.key ?? '';

  if (!label) {
    return '';
  }

  return `${label.charAt(0).toUpperCase()}${label.slice(1)}`;
};

const getMonthAmount = (month) => {
  if (!month?.details) {
    return null;
  }

  const totalAmount = Number(month.details.totalAmount);
  if (Number.isFinite(totalAmount)) {
    return totalAmount;
  }

  if (Array.isArray(month.details.payments) && month.details.payments.length > 0) {
    const total = month.details.payments.reduce(
      (sum, payment) => sum + (Number(payment.amount) || 0),
      0,
    );

    return Number.isFinite(total) ? total : null;
  }

  return null;
};

const buildTuitionMonthRange = (locale) => {
  const today = new Date();
  const previousMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

  const months = [previousMonth, currentMonth, nextMonth].map((date, index) => ({
    key: formatMonthKey(date),
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    shortLabel: new Intl.DateTimeFormat(locale, { month: 'short' }).format(date),
    longLabel: new Intl.DateTimeFormat(locale, { month: 'long' }).format(date),
    isCurrent: index === 1,
  }));

  return {
    startDate: formatMonthRangeDate(previousMonth),
    endDate: formatMonthRangeDate(nextMonth),
    months,
  };
};

const safeParseTuitionValue = (value) => {
  if (!value) {
    return null;
  }

  if (typeof value === 'object') {
    return value;
  }

  if (typeof value !== 'string') {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch (parseError) {
    console.warn('Unable to parse tuition cell value', parseError);
    return null;
  }
};

const DEFAULT_PAYMENTS_PAGE_STRINGS = {
  title: 'Pagos',
  tuition: {
    title: 'Colegaturas',
    description: 'Filtra por rango de fechas para consultar tus colegiaturas.',
    filters: {
      startDate: 'Fecha inicio',
      endDate: 'Fecha fin',
    },
    table: {
      month: 'Mes',
      status: 'Estatus',
      amount: 'Monto',
      view: 'Ver detalle',
      empty: 'No hay colegiaturas registradas para este periodo.',
    },
  },
  requests: {
    title: 'Solicitudes de pago',
    columns: {
      id: 'ID',
      concept: 'Concepto',
      amount: 'Monto solicitado',
      status: 'Estatus',
      dueDate: 'Fecha límite',
      view: 'Ver detalle',
    },
    empty: 'No hay solicitudes registradas.',
  },
  payments: {
    title: 'Pagos',
    columns: {
      id: 'ID',
      concept: 'Concepto',
      amount: 'Monto',
      status: 'Estatus',
      date: 'Fecha creada',
      view: 'Ver detalle',
    },
    empty: 'No hay pagos registrados.',
  },
  requestDetail: {
    title: 'Detalle de solicitud',
    amount: 'Monto solicitado',
    dueDate: 'Fecha límite',
    status: 'Estatus',
    concept: 'Concepto',
  },
};

const StudentDashboardPage = ({ language = 'es', onLanguageChange, routeSegments = [], onNavigate }) => {
  const { token, user, logout } = useAuth();
  const { openModal } = useModal();
  const t = getTranslation(language);
  const strings = t.home?.studentDashboard ?? {};
  const locale = language === 'en' ? 'en-US' : 'es-MX';
  const tuitionModalStrings = useMemo(() => {
    const overrides = t.paymentsPage?.tuitionModal ?? {};
    const summary = { ...DEFAULT_TUITION_MODAL_STRINGS.summary, ...(overrides.summary ?? {}) };
    const paymentsTable = {
      ...DEFAULT_TUITION_MODAL_STRINGS.paymentsTable,
      ...(overrides.paymentsTable ?? {}),
      columns: {
        ...DEFAULT_TUITION_MODAL_STRINGS.paymentsTable.columns,
        ...((overrides.paymentsTable?.columns ?? {})),
      },
    };

    return {
      ...DEFAULT_TUITION_MODAL_STRINGS,
      ...overrides,
      summary,
      paymentsTable,
    };
  }, [t.paymentsPage?.tuitionModal]);
  const tokenRoleName = useMemo(() => getRoleNameFromToken(token), [token]);
  const roleName = tokenRoleName ?? user?.role_name ?? user?.role ?? user?.roleName ?? '';
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
  const [recentPayments, setRecentPayments] = useState([]);
  const [recharges, setRecharges] = useState([]);
  const [tuitionReportMonths, setTuitionReportMonths] = useState([]);
  const [tuitionReportLoading, setTuitionReportLoading] = useState(true);
  const [tuitionReportError, setTuitionReportError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [isDesktop, setIsDesktop] = useState(getIsDesktop);
  const [isSidebarOpen, setIsSidebarOpen] = useState(getIsDesktop);
  const [activeNav, setActiveNav] = useState(routeSegments[0] === 'payments' ? 'payments' : 'dashboard');
  const [selectedPaymentRequestId, setSelectedPaymentRequestId] = useState(
    routeSegments[0] === 'payments' && routeSegments[1] === 'requests'
      ? routeSegments[2] ?? null
      : null,
  );
  const [selectedPaymentRequest, setSelectedPaymentRequest] = useState(null);
  const [tuitionStartDate, setTuitionStartDate] = useState('');
  const [tuitionEndDate, setTuitionEndDate] = useState('');


  const studentDashboardBasePath = useMemo(() => `/${language}/student-dashboard`, [language]);

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen((value) => !value);
  }, []);

  const closeSidebar = useCallback(() => {
    setIsSidebarOpen(false);
  }, []);

  const handleNavClick = useCallback(
    (key, { preserveRequest } = {}) => {
      setActiveNav(key);
      if (!isDesktop) {
        setIsSidebarOpen(false);
      }

      if (!preserveRequest) {
        setSelectedPaymentRequest(null);
        setSelectedPaymentRequestId(null);
      }

      if (onNavigate) {
        const suffix = key === 'dashboard' ? '' : `/${key}`;
        onNavigate(`${studentDashboardBasePath}${suffix}`, { replace: true });
      }
    },
    [isDesktop, onNavigate, studentDashboardBasePath],
  );

  const headers = useMemo(
    () => ({
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }),
    [token],
  );

  const fetchJson = useCallback(
    async (path, { signal } = {}) => {
      const response = await fetch(path, { headers, signal });
      handleExpiredToken(response, logout);

      if (!response.ok) {
        const error = new Error('REQUEST_FAILED');
        error.status = response.status;
        throw error;
      }

      return response.json();
    },
    [headers, logout],
  );

  const paymentDetailBasePath = useMemo(() => `/${language}/payments/payments`, [language]);
  const paymentRequestDetailBasePath = useMemo(() => `/${language}/payments/requests`, [language]);

  const paymentsPageStrings = useMemo(() => {
    const overrides = strings.paymentsPage ?? {};
    return {
      ...DEFAULT_PAYMENTS_PAGE_STRINGS,
      ...overrides,
      tuition: {
        ...DEFAULT_PAYMENTS_PAGE_STRINGS.tuition,
        ...(overrides.tuition ?? {}),
        filters: {
          ...DEFAULT_PAYMENTS_PAGE_STRINGS.tuition.filters,
          ...(overrides.tuition?.filters ?? {}),
        },
        table: {
          ...DEFAULT_PAYMENTS_PAGE_STRINGS.tuition.table,
          ...(overrides.tuition?.table ?? {}),
        },
      },
      requests: {
        ...DEFAULT_PAYMENTS_PAGE_STRINGS.requests,
        ...(overrides.requests ?? {}),
        columns: {
          ...DEFAULT_PAYMENTS_PAGE_STRINGS.requests.columns,
          ...(overrides.requests?.columns ?? {}),
        },
      },
      payments: {
        ...DEFAULT_PAYMENTS_PAGE_STRINGS.payments,
        ...(overrides.payments ?? {}),
        columns: {
          ...DEFAULT_PAYMENTS_PAGE_STRINGS.payments.columns,
          ...(overrides.payments?.columns ?? {}),
        },
      },
      requestDetail: {
        ...DEFAULT_PAYMENTS_PAGE_STRINGS.requestDetail,
        ...(overrides.requestDetail ?? {}),
      },
    };
  }, [strings.paymentsPage]);


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
        const [profileData, pendingAmountData, pendingRequestsData, paymentsData, rechargeData] = await Promise.all([
          fetchJson(`${API_BASE_URL}/students/read-only`, { signal }),
          fetchJson(`${API_BASE_URL}/payment-requests/pending`, { signal }),
          fetchJson(`${API_BASE_URL}/payment-requests/student-pending-payments`, { signal }),
          fetchJson(`${API_BASE_URL}/reports/payments?lang=${language}&offset=0&limit=10&export_all=false`, { signal }),
          fetchJson(`${API_BASE_URL}/reports/balance-recharges?lang=${language}&offset=0&limit=10&export_all=false`, {
            signal,
          }),
        ]);

        setProfile(profileData ?? null);
        setPendingAmount(Number(pendingAmountData ?? 0));
        setPendingRequests(normalizeArray(pendingRequestsData));
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
  }, [fetchJson, language, refreshIndex, strings.loadError]);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    const monthRange = buildTuitionMonthRange(locale);

    setTuitionReportLoading(true);
    setTuitionReportError(null);
    setTuitionReportMonths(monthRange.months.map((month) => ({ ...month, details: null })));

    const loadTuitionReport = async () => {
      try {
        const params = new URLSearchParams({
          lang: language,
          limit: '10',
          start_date: monthRange.startDate,
          end_date: monthRange.endDate,
        });

        const data = await fetchJson(`${API_BASE_URL}/reports/payments/report?${params.toString()}`, { signal });
        const firstEntry = Array.isArray(data?.content) ? data.content[0] ?? null : null;

        const months = monthRange.months.map((month) => {
          const parsed = firstEntry ? safeParseTuitionValue(firstEntry?.[month.key]) : null;

          if (!parsed) {
            return { ...month, details: null };
          }

          const payments = Array.isArray(parsed.payments)
            ? parsed.payments.map((payment) => ({
                paymentId: payment.payment_id ?? payment.paymentId ?? null,
                amount: Number(payment.amount ?? 0),
                statusName:
                  payment.payment_status_name ??
                  payment.paymentStatusName ??
                  strings.cards?.tuitionStatus?.unknown ?? 'Sin validar',
                createdAt: payment.created_at ?? payment.createdAt ?? null,
              }))
            : [];

          const totalAmount = Number(parsed.total_amount ?? parsed.totalAmount ?? 0) || null;
          const paymentMonth = parsed.payment_month ?? parsed.paymentMonth ?? null;
          const paymentRequestId = parsed.payment_request_id ?? parsed.paymentRequestId ?? null;
          const statusName =
            payments[0]?.statusName ??
            parsed.payment_status_name ??
            parsed.paymentStatusName ??
            strings.cards?.tuitionStatus?.unknown ?? 'Sin validar';

          return {
            ...month,
            details: {
              payments,
              totalAmount,
              paymentMonth,
              paymentRequestId,
              statusName,
            },
          };
        });

        setTuitionReportMonths(months);
      } catch (requestError) {
        if (requestError?.name === 'AbortError') {
          return;
        }
        setTuitionReportMonths(monthRange.months.map((month) => ({ ...month, details: null })));
        setTuitionReportError(strings.loadError ?? 'No fue posible cargar la información.');
      } finally {
        setTuitionReportLoading(false);
      }
    };

    loadTuitionReport();

    return () => {
      controller.abort();
    };
  }, [fetchJson, language, locale, refreshIndex, strings.cards?.tuitionStatus?.unknown, strings.loadError]);

  const handleRefresh = () => {
    setRefreshIndex((value) => value + 1);
  };

  const studentName = profile?.fullName || profile?.username || user?.name || user?.username || 'Alumno';
  const reference = profile?.paymentReference || '—';
  const grade = profile?.gradeGroup || '—';
  const generation = profile?.generation || '—';
  const studentScholarLevel = profile?.scholar_level_name || profile?.scholarLevel || null;

  const activeTuitionMonth = useMemo(() => {
    const current = tuitionReportMonths.find((month) => month.isCurrent && month.details);
    if (current) {
      return current;
    }

    return tuitionReportMonths.find((month) => month.details) ?? tuitionReportMonths.find((month) => month.isCurrent) ?? null;
  }, [tuitionReportMonths]);

  const activeTuitionAmountText = useMemo(() => {
    const template = strings.cards?.tuitionStatus?.amount;
    const totalAmount = activeTuitionMonth?.details?.totalAmount ?? 0;
    const formattedAmount = formatCurrency(totalAmount, locale);
    return template ? template.replace('{amount}', formattedAmount) : formattedAmount;
  }, [activeTuitionMonth?.details?.totalAmount, locale, strings.cards?.tuitionStatus?.amount]);

  const tuitionStatusText = useMemo(() => {
    if (tuitionReportLoading) {
      return strings.loading ?? 'Cargando...';
    }

    if (activeTuitionMonth?.details) {
      const monthLabel = activeTuitionMonth.longLabel
        ? `${activeTuitionMonth.longLabel.charAt(0).toUpperCase()}${activeTuitionMonth.longLabel.slice(1)}`
        : activeTuitionMonth.key;
      const statusLabel =
        activeTuitionMonth.details.statusName || strings.cards?.tuitionStatus?.unknown || strings.loading || '';
      return `${monthLabel} ${statusLabel}`.trim();
    }

    if (tuitionReportError) {
      return tuitionReportError;
    }

    return strings.cards?.tuitionStatus?.empty ?? 'Sin registros recientes';
  }, [
    activeTuitionMonth,
    strings.cards?.tuitionStatus?.empty,
    strings.cards?.tuitionStatus?.unknown,
    strings.loading,
    tuitionReportError,
    tuitionReportLoading,
  ]);

  const hasTuitionReportDetails = useMemo(
    () => tuitionReportMonths.some((month) => Boolean(month.details)),
    [tuitionReportMonths],
  );

  const handleTuitionMonthClick = useCallback(
    (month) => {
      if (!month?.details) {
        return;
      }

      openModal({
        key: 'TuitionPaymentDetails',
        props: {
          studentName,
          className: grade || null,
          generation: generation || null,
          scholarLevel: studentScholarLevel,
          monthKey: month.key,
          paymentMonth: month.details.paymentMonth ?? `${month.year}_${String(month.month).padStart(2, '0')}`,
          totalAmount: month.details.totalAmount,
          paymentRequestId: month.details.paymentRequestId,
          payments: month.details.payments,
          locale,
          currency: 'MXN',
          strings: tuitionModalStrings,
          paymentDetailBasePath,
          paymentRequestDetailBasePath,
        },
      });
    },
    [
      generation,
      grade,
      locale,
      openModal,
      paymentDetailBasePath,
      paymentRequestDetailBasePath,
      studentName,
      studentScholarLevel,
      tuitionModalStrings,
    ],
  );

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

  const getRequestId = useCallback((request) => {
    if (!request) {
      return null;
    }

    return (
      request.paymentRequestId ||
      request.payment_request_id ||
      request.pr_id ||
      request.id ||
      request.payment_requestId ||
      null
    );
  }, []);

  const getDueLabel = useCallback(
    (dateValue) => {
      const baseLabel = strings.sections?.pendingRequests?.dueLabel ?? 'Vence';
      const expiredLabel = strings.sections?.pendingRequests?.dueLabelExpired ?? 'Venció';
      const todayLabel = strings.sections?.pendingRequests?.dueLabelToday ?? 'Vence hoy';
      if (!dateValue) {
        return baseLabel;
      }

      const dueDate = new Date(dateValue);
      if (Number.isNaN(dueDate.getTime())) {
        return baseLabel;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const normalizedDueDate = new Date(dueDate);
      normalizedDueDate.setHours(0, 0, 0, 0);

      if (normalizedDueDate.getTime() < today.getTime()) {
        return expiredLabel;
      }

      if (normalizedDueDate.getTime() === today.getTime()) {
        return todayLabel;
      }

      return baseLabel;
    },
    [strings.sections?.pendingRequests?.dueLabel, strings.sections?.pendingRequests?.dueLabelExpired, strings.sections?.pendingRequests?.dueLabelToday],
  );

  useEffect(() => {
    if (routeSegments[0] === 'payments') {
      setActiveNav('payments');
      if (routeSegments[1] === 'requests' && routeSegments[2]) {
        setSelectedPaymentRequestId(routeSegments[2]);
      }
      return;
    }

    setActiveNav('dashboard');
    setSelectedPaymentRequestId(null);
  }, [routeSegments]);

  useEffect(() => {
    if (tuitionReportMonths.length === 0 || (tuitionStartDate && tuitionEndDate)) {
      return;
    }

    const sortedMonths = [...tuitionReportMonths].sort((a, b) => {
      const aDate = new Date(a.year, a.month - 1, 1);
      const bDate = new Date(b.year, b.month - 1, 1);
      return aDate.getTime() - bDate.getTime();
    });

    const firstMonth = sortedMonths[0];
    const lastMonth = sortedMonths[sortedMonths.length - 1];

    setTuitionStartDate(buildMonthInputValue(firstMonth.year, firstMonth.month));
    setTuitionEndDate(buildMonthInputValue(lastMonth.year, lastMonth.month));
  }, [tuitionEndDate, tuitionReportMonths, tuitionStartDate]);

  useEffect(() => {
    if (!selectedPaymentRequestId) {
      setSelectedPaymentRequest(null);
      return;
    }

    const matchingRequest = pendingRequests.find((request) => {
      const id = getRequestId(request);
      return id && String(id) === String(selectedPaymentRequestId);
    });

    setSelectedPaymentRequest(matchingRequest ?? null);
  }, [getRequestId, pendingRequests, selectedPaymentRequestId]);

  const filteredTuitionMonths = useMemo(() => {
    return tuitionReportMonths.filter((month) => {
      const monthDate = new Date(month.year, month.month - 1, 1);
      const startDate = parseMonthInputValue(tuitionStartDate);
      const endDate = parseMonthInputValue(tuitionEndDate);

      if (startDate && monthDate.getTime() < startDate.getTime()) {
        return false;
      }

      if (endDate && monthDate.getTime() > endDate.getTime()) {
        return false;
      }

      return true;
    });
  }, [tuitionEndDate, tuitionReportMonths, tuitionStartDate]);

  const handlePaymentRequestSelect = useCallback(
    (request) => {
      const requestId = getRequestId(request);
      setSelectedPaymentRequest(request ?? null);
      setSelectedPaymentRequestId(requestId ? String(requestId) : null);
      handleNavClick('payments', { preserveRequest: true });

      if (onNavigate) {
        const suffix = requestId ? `/payments/requests/${encodeURIComponent(String(requestId))}` : '/payments';
        onNavigate(`${studentDashboardBasePath}${suffix}`, { replace: true });
      }
    },
    [getRequestId, handleNavClick, onNavigate, studentDashboardBasePath],
  );

  const handleViewAllPayments = useCallback(() => {
    handleNavClick('payments');
  }, [handleNavClick]);

  const handlePaymentDetailClick = useCallback(
    (paymentId) => {
      if (!paymentId) {
        return;
      }

      handleNavClick('payments', { preserveRequest: true });

      if (onNavigate) {
        onNavigate(`${studentDashboardBasePath}/payments/payments/${encodeURIComponent(String(paymentId))}`, { replace: true });
      }
    },
    [handleNavClick, onNavigate, studentDashboardBasePath],
  );

  const dashboardContent = (
    <div className="page">
        <div className="student-dashboard__hero col-md-12">
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
        </div>

        {error ? (
          <div className="student-dashboard__alert" role="alert">
            <p>{error}</p>
            <button type="button" onClick={handleRefresh}>
              {strings.actions?.retry}
            </button>
          </div>
        ) : null}

        <div className="card bg-transparent border-0">
          <div className="row row-cols-1 gy-3">
            <div className="col-md-4">
            <article className="student-dashboard__card h-100">
              <div>
                <p className="student-dashboard__card-label">{strings.cards?.balance}</p>
                <h2 className='text-success'>{formatCurrency(profile?.balance ?? 0, locale)}</h2>
                <p className="student-dashboard__muted">{strings.cards?.balanceHint}</p>
              </div>
              <div className="text-success p-2">
                <svg className='student-dashboard__cardIcons opacity-25' xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" data-lucide="wallet"><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"></path><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"></path></svg>
              </div>          
            </article>
            </div>
            <div className="col-md-4">
            <article className="student-dashboard__card h-100">
              <div>
                <p className="student-dashboard__card-label">{strings.cards?.pending}</p>
                <h2 className='text-danger'>{pendingAmount == null ? '—' : formatCurrency(pendingAmount, locale)}</h2>
                <p className="student-dashboard__muted">{strings.cards?.pendingHint}</p>
              </div>
              <div className="text-danger p-2">
                  <svg className='student-dashboard__cardIcons opacity-25' xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" data-lucide="alert-circle"><circle cx="12" cy="12" r="10"></circle><line x1="12" x2="12" y1="8" y2="12"></line><line x1="12" x2="12.01" y1="16" y2="16"></line></svg>
              </div>
            </article>
            </div>
            <div className="col-md-4">
              <div className="tuition-status-card">
                <div className="tuition-status-card__header">
                  <p className="student-dashboard__eyebrow text-light">{strings.cards?.tuitionStatus?.title}</p>
                  <h2 className="tuition-status-card__title">{tuitionStatusText}</h2>
                  {hasTuitionReportDetails ? (
                    <p className="tuition-status-card__caption">{activeTuitionAmountText}</p>
                  ) : null}
                  {tuitionReportLoading ? (
                    <p className="tuition-status-card__caption">{strings.loading}</p>
                  ) : null}
                </div>
                <div className="tuition-status-card__timeline justify-content-between" role="list">
                  {tuitionReportMonths.map((month) => {
                    const isDisabled = !month.details || tuitionReportLoading;
                    const monthLabel = month.shortLabel
                      ? `${month.shortLabel.charAt(0).toUpperCase()}${month.shortLabel.slice(1)}`
                      : month.key;

                    return (
                      <button
                        key={month.key}
                        type="button"
                        className={`tuition-status-card__month${month.isCurrent ? ' is-current' : ''}${
                          month.details ? ' has-details' : ''
                        }`}
                        onClick={() => handleTuitionMonthClick(month)}
                        disabled={isDisabled}
                        aria-label={`${monthLabel} ${month.details?.statusName ?? ''}`.trim()}
                        role="listitem"
                      >
                        <span className="tuition-status-card__month-label">{monthLabel}</span>
                        <span className="tuition-status-card__marker" aria-hidden="true">
                          {month.details ? '✓' : ''}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {tuitionReportError ? (
                  <p className="tuition-status-card__error" role="alert">{tuitionReportError}</p>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <section className="student-dashboard__two-column">
          <article className="student-dashboard__section">
            <div className="student-dashboard__section-header">
              <div>
                <h3>{strings.sections?.pendingRequests?.title}</h3>
                <p className="student-dashboard__muted">{strings.sections?.pendingRequests?.description}</p>
              </div>
              <button type="button" className="ghost-button" onClick={handleViewAllPayments} disabled={loading}>
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
                  <button
                    type="button"
                    className="tile tile--button"
                    key={request.paymentRequestId || request.payment_request_id}
                    onClick={() => handlePaymentRequestSelect(request)}
                  >
                    <div>
                      <p className="student-dashboard__muted">{strings.tables?.pending?.concept}</p>
                      <p className="fw-bold m-0">{request.pt_name || request.ptName || strings.tables?.pending?.unknown}</p>
                      <p className="student-dashboard__muted">
                        {getDueLabel(request.pr_pay_by || request.prPayBy)}: {formatDate(request.pr_pay_by || request.prPayBy, locale)}
                      </p>
                    </div>
                    <div className="tile__meta">
                      <span className="pill pill--warning">{request.ps_pr_name || request.psPrName || strings.tables?.pending?.statusPending}</span>
                      <strong>{formatCurrency(request.pr_amount ?? request.prAmount ?? 0, locale)}</strong>
                    </div>
                  </button>
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
                <p className='fw-bold text-muted'>{profile?.registerId || '—'}</p>
              </div>
              <div>
                <p className="student-dashboard__muted">{strings.sections?.studentInfo?.paymentReference}</p>
                <p className='fw-bold text-muted'>{reference}</p>
              </div>
              <div>
                <p className="student-dashboard__muted">{strings.sections?.studentInfo?.school}</p>
                <p className='fw-bold text-muted'>{profile?.commercialName || '—'}</p>
              </div>
              <div>
                <p className="student-dashboard__muted">{strings.sections?.studentInfo?.generation}</p>
                <p className='fw-bold text-muted'>{generation}</p>
              </div>
              <div>
                <p className="student-dashboard__muted">{strings.sections?.studentInfo?.grade}</p>
                <p className='fw-bold text-muted'>{grade}</p>
              </div>
              <div>
                <p className="student-dashboard__muted">{strings.sections?.studentInfo?.status}</p>
                <p className='fw-bold text-muted'>{profile?.userStatus || '—'}</p>
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
          </div>
        </section>
    </div>
  );

  const paymentsContent = (
    <div className="page">
      <section className="student-dashboard__section">
        <div className="student-dashboard__section-header">
          <div>
            <h3>{paymentsPageStrings.tuition.title}</h3>
            <p className="student-dashboard__muted">{paymentsPageStrings.tuition.description}</p>
          </div>
        </div>

        <form className="student-dashboard__filters" onSubmit={(event) => event.preventDefault()}>
          <label className="student-dashboard__filter-field">
            <span>{paymentsPageStrings.tuition.filters.startDate}</span>
            <input
              type="month"
              value={tuitionStartDate}
              onChange={(event) => setTuitionStartDate(event.target.value)}
            />
          </label>
          <label className="student-dashboard__filter-field">
            <span>{paymentsPageStrings.tuition.filters.endDate}</span>
            <input type="month" value={tuitionEndDate} onChange={(event) => setTuitionEndDate(event.target.value)} />
          </label>
        </form>

        {filteredTuitionMonths.length === 0 ? (
          <p className="student-dashboard__muted">{paymentsPageStrings.tuition.table.empty}</p>
        ) : (
          <div className="student-dashboard__table-wrapper">
            <table className="student-dashboard__table student-dashboard__table--months">
              <thead>
                <tr>
                  {filteredTuitionMonths.map((month) => (
                    <th key={month.key}>{formatMonthLabel(month)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {filteredTuitionMonths.map((month) => {
                    const monthAmount = getMonthAmount(month);
                    const hasDetails = Boolean(month.details);
                    const statusLabel =
                      month.details?.statusName ??
                      strings.cards?.tuitionStatus?.unknown ??
                      paymentsPageStrings.tuition.table.empty;
                    const amountLabel = monthAmount != null ? formatCurrency(monthAmount, locale) : '—';
                    const monthLabel = formatMonthLabel(month);

                    return (
                      <td key={`${month.key}-value`}>
                        <div className="student-dashboard__month-cell">
                          <button
                            type="button"
                            className="student-dashboard__amount-button"
                            onClick={() => handleTuitionMonthClick(month)}
                            disabled={!hasDetails}
                            aria-label={`${paymentsPageStrings.tuition.table.view} ${monthLabel}`.trim()}
                          >
                            <span>{amountLabel}</span>
                            {hasDetails ? (
                              <span className="student-dashboard__amount-button__cta">
                                {paymentsPageStrings.tuition.table.view}
                              </span>
                            ) : null}
                          </button>
                          <p className="student-dashboard__muted">{statusLabel}</p>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="student-dashboard__section">
        <div className="student-dashboard__section-header">
          <div>
            <h3>{paymentsPageStrings.requests.title}</h3>
            <p className="student-dashboard__muted">{strings.sections?.pendingRequests?.description}</p>
          </div>
        </div>

        {pendingRequests.length === 0 ? (
          <p className="student-dashboard__muted">{paymentsPageStrings.requests.empty}</p>
        ) : (
          <div className="student-dashboard__table-wrapper">
            <table className="student-dashboard__table">
              <thead>
                <tr>
                  <th>{paymentsPageStrings.requests.columns.id}</th>
                  <th>{paymentsPageStrings.requests.columns.concept}</th>
                  <th>{paymentsPageStrings.requests.columns.amount}</th>
                  <th>{paymentsPageStrings.requests.columns.status}</th>
                  <th>{paymentsPageStrings.requests.columns.dueDate}</th>
                  <th>{paymentsPageStrings.requests.columns.view}</th>
                </tr>
              </thead>
              <tbody>
                {pendingRequests.map((request) => {
                  const requestId = getRequestId(request);
                  return (
                    <tr key={requestId ?? request.pt_name}>
                      <td>{requestId ?? '—'}</td>
                      <td>{request.pt_name || request.ptName || paymentsPageStrings.requests.columns.concept}</td>
                      <td>{formatCurrency(request.pr_amount ?? request.prAmount ?? 0, locale)}</td>
                      <td>{request.ps_pr_name || request.psPrName || paymentsPageStrings.requests.columns.status}</td>
                      <td>
                        <div className="student-dashboard__due-label">
                          <span className="pill pill--ghost">{getDueLabel(request.pr_pay_by || request.prPayBy)}</span>
                          <span>{formatDate(request.pr_pay_by || request.prPayBy, locale)}</span>
                        </div>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() => handlePaymentRequestSelect(request)}
                        >
                          {paymentsPageStrings.requests.columns.view}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="student-dashboard__section">
        <div className="student-dashboard__section-header">
          <div>
            <h3>{paymentsPageStrings.payments.title}</h3>
            <p className="student-dashboard__muted">{strings.sections?.payments?.description ?? strings.sections?.history?.description}</p>
          </div>
        </div>

        {recentPayments.length === 0 ? (
          <p className="student-dashboard__muted">{paymentsPageStrings.payments.empty}</p>
        ) : (
          <div className="student-dashboard__table-wrapper">
            <table className="student-dashboard__table">
              <thead>
                <tr>
                  <th>{paymentsPageStrings.payments.columns.id}</th>
                  <th>{paymentsPageStrings.payments.columns.concept}</th>
                  <th>{paymentsPageStrings.payments.columns.amount}</th>
                  <th>{paymentsPageStrings.payments.columns.status}</th>
                  <th>{paymentsPageStrings.payments.columns.date}</th>
                  <th>{paymentsPageStrings.payments.columns.view}</th>
                </tr>
              </thead>
              <tbody>
                {recentPayments.map((payment) => {
                  const paymentIdValue = payment.payment_id ?? payment.paymentId ?? payment.id ?? '';
                  return (
                    <tr key={paymentIdValue || payment.pt_name}>
                      <td>{paymentIdValue || '—'}</td>
                      <td>{payment.pt_name || payment.partConceptName || paymentsPageStrings.payments.columns.concept}</td>
                      <td>{formatCurrency(payment.amount ?? 0, locale)}</td>
                      <td>{payment.payment_status_name || payment.paymentStatusName || paymentsPageStrings.payments.columns.status}</td>
                      <td>{formatDate(payment.payment_created_at || payment.paymentCreatedAt, locale)}</td>
                      <td>
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() => handlePaymentDetailClick(paymentIdValue)}
                          disabled={!paymentIdValue}
                        >
                          {paymentsPageStrings.payments.columns.view}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedPaymentRequest ? (
        <section className="student-dashboard__section">
          <div className="student-dashboard__section-header">
            <div>
              <h3>{paymentsPageStrings.requestDetail.title}</h3>
              <p className="student-dashboard__muted">{paymentsPageStrings.requests.columns.id}: {getRequestId(selectedPaymentRequest)}</p>
            </div>
          </div>
          <div className="student-dashboard__detail-grid">
            <div>
              <p className="student-dashboard__muted">{paymentsPageStrings.requestDetail.concept}</p>
              <p className="fw-bold">{selectedPaymentRequest.pt_name || selectedPaymentRequest.ptName || paymentsPageStrings.requests.columns.concept}</p>
            </div>
            <div>
              <p className="student-dashboard__muted">{paymentsPageStrings.requestDetail.amount}</p>
              <p className="fw-bold">{formatCurrency(selectedPaymentRequest.pr_amount ?? selectedPaymentRequest.prAmount ?? 0, locale)}</p>
            </div>
            <div>
              <p className="student-dashboard__muted">{paymentsPageStrings.requestDetail.dueDate}</p>
              <p className="fw-bold">{formatDate(selectedPaymentRequest.pr_pay_by || selectedPaymentRequest.prPayBy, locale)}</p>
            </div>
            <div>
              <p className="student-dashboard__muted">{paymentsPageStrings.requestDetail.status}</p>
              <p className="fw-bold">{selectedPaymentRequest.ps_pr_name || selectedPaymentRequest.psPrName || paymentsPageStrings.requests.columns.status}</p>
            </div>
          </div>
        </section>
      ) : null}

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
        </div>
      </section>
    </div>
  );

  const pageTitle = activeNav === 'payments' ? paymentsPageStrings.title : headerTitle;
  const pageSubtitle =
    activeNav === 'payments'
      ? strings.sections?.payments?.description ?? headerSubtitle
      : headerSubtitle;
  const mainContent = activeNav === 'payments' ? paymentsContent : dashboardContent;

  const breadcrumbs = useMemo(() => {
    const dashboardLabel = menuItems.find((item) => item.key === 'dashboard')?.label ?? headerTitle;
    const items = [
      {
        label: dashboardLabel,
        onClick: activeNav === 'dashboard' ? undefined : () => handleNavClick('dashboard'),
      },
    ];

    if (activeNav !== 'dashboard') {
      const activeLabel = menuItems.find((item) => item.key === activeNav)?.label ?? headerTitle;
      items.push({ label: activeLabel });
    }

    if (activeNav === 'payments' && selectedPaymentRequestId) {
      items.push({ label: `${paymentsPageStrings.requests.columns.id} ${selectedPaymentRequestId}` });
    }

    return items;
  }, [
    activeNav,
    handleNavClick,
    headerTitle,
    menuItems,
    paymentsPageStrings.requests.columns.id,
    selectedPaymentRequestId,
  ]);

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
              <h1>{pageTitle}</h1>
              <p className='dashboard__subtitle'>{pageSubtitle}</p>
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

        <Breadcrumbs items={breadcrumbs} />

        {mainContent}
      </div>
    </div>
  );
}

export default StudentDashboardPage;
