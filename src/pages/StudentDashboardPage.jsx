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
import GlobalTable from '../components/ui/GlobalTable.jsx';
import ActionButton from '../components/ui/ActionButton.jsx';
import UiCard from '../components/ui/UiCard.jsx';
import SidebarModal from '../components/ui/SidebarModal.jsx';
import FilterButton from '../components/ui/buttons/FilterButton.jsx';
import StudentTableCell from '../components/ui/StudentTableCell.jsx';
import PaymentDetailPage from './PaymentDetailPage.jsx';
import PaymentRequestDetailPage from './PaymentRequestDetailPage.jsx';
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
const PENDING_REQUESTS_THREE_COLUMNS_BREAKPOINT = 992;
const getIsDesktop = () => (typeof window === 'undefined' ? true : window.innerWidth >= COLLAPSE_BREAKPOINT);
const getCanShowThreePendingRequests = () =>
  typeof window === 'undefined' ? true : window.innerWidth >= PENDING_REQUESTS_THREE_COLUMNS_BREAKPOINT;
const MONTH_KEY_REGEX = /^[A-Za-z]{3}-\d{2}$/;

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

const parseMonthKeyToDate = (key) => {
  const match = MONTH_KEY_REGEX.exec(key ?? '');

  if (!match) {
    return null;
  }

  const [monthLabel, yearLabel] = match[0].split('-');
  const year = Number(`20${yearLabel}`);
  const date = new Date(`${monthLabel} 1, ${year}`);

  return Number.isNaN(date.getTime()) ? null : date;
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

const parseTuitionCellValue = (value) => {
  if (value == null || value === '') {
    return null;
  }

  if (typeof value === 'object') {
    return value;
  }

  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (parseError) {
      console.warn('Unable to parse tuition cell value', parseError);
      return null;
    }
  }

  return null;
};

const normalizeAmount = (candidate) => {
  if (typeof candidate === 'number' && Number.isFinite(candidate)) {
    return candidate;
  }

  if (typeof candidate === 'string') {
    const parsed = Number(candidate);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (candidate && typeof candidate === 'object') {
    const amount = candidate.amount ?? candidate.totalAmount ?? candidate.total_amount;
    const parsed = Number(amount);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const normalizePaymentList = (payments) => {
  if (!Array.isArray(payments)) {
    return [];
  }

  return payments.map((payment) => {
    const rawId =
      payment?.payment_id ?? payment?.paymentId ?? payment?.id ?? null;

    const rawAmount = payment?.amount ?? payment?.total ?? null;
    const createdAt =
      typeof payment?.created_at === 'string'
        ? payment.created_at
        : typeof payment?.date === 'string'
        ? payment.date
        : null;
    const statusName =
      typeof payment?.payment_status_name === 'string'
        ? payment.payment_status_name
        : typeof payment?.status_name === 'string'
        ? payment.status_name
        : typeof payment?.payment_status === 'string'
        ? payment.payment_status
        : typeof payment?.status === 'string'
        ? payment.status
        : null;

    return {
      paymentId: rawId != null ? rawId : null,
      amount: normalizeAmount(rawAmount),
      createdAt,
      statusName,
    };
  });
};

const extractTuitionCellDetails = (value) => {
  const parsed = parseTuitionCellValue(value);
  if (!parsed) {
    return null;
  }

  const totalAmount = normalizeAmount(parsed.total_amount ?? parsed.totalAmount);
  const paymentMonth =
    typeof parsed.payment_month === 'string'
      ? parsed.payment_month
      : typeof parsed.paymentMonth === 'string'
      ? parsed.paymentMonth
      : null;
  const paymentRequestId =
    parsed.payment_request_id ?? parsed.paymentRequestId ?? null;
  const payments = normalizePaymentList(parsed.payments);

  return {
    totalAmount,
    paymentMonth,
    paymentRequestId,
    payments,
  };
};

const DEFAULT_PAYMENTS_PAGE_STRINGS = {
  title: 'Pagos',
  tuition: {
    title: 'Colegiaturas',
    description: 'Filtra por rango de fechas para consultar tus colegiaturas.',
    filters: {
      startDate: 'Fecha inicio',
      endDate: 'Fecha fin',
    },
    table: {
      columns: {
        student: 'Alumno',
        generation: 'Generación',
      },
      studentIdLabel: 'Matrícula',
      studentFallback: 'Alumno sin nombre',
      loading: 'Cargando...',
      month: 'Mes',
      status: 'Estatus',
      amount: 'Monto',
      view: 'Ver detalle',
      empty: 'No hay colegiaturas registradas para este periodo.',
      pagination: {
        previous: 'Anterior',
        next: 'Siguiente',
      },
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

const StudentDashboardPage = ({
  language = 'es',
  onLanguageChange,
  routeSegments = [],
  sectionKey = 'student-dashboard',
  onNavigate,
}) => {
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
  const schoolName = useMemo(() => {
    if (user?.school_name) {
      return user.school_name;
    }

    if (typeof window === 'undefined') {
      return '';
    }

    try {
      const storedUser = JSON.parse(localStorage.getItem('user') ?? '{}');
      return storedUser?.school_name ?? '';
    } catch (error) {
      return '';
    }
  }, [user?.school_name]);
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
  const [tuitionRows, setTuitionRows] = useState([]);
  const [tuitionTotalElements, setTuitionTotalElements] = useState(0);
  const [tuitionLoading, setTuitionLoading] = useState(false);
  const [tuitionError, setTuitionError] = useState(null);
  const [tuitionOffset, setTuitionOffset] = useState(0);
  const [tuitionLimit] = useState(10);
  const [requestsLimit] = useState(10);
  const [requestsOffset, setRequestsOffset] = useState(0);
  const [requestsTotalElements, setRequestsTotalElements] = useState(0);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [requestsError, setRequestsError] = useState(null);
  const [paymentsLimit] = useState(10);
  const [paymentsOffset, setPaymentsOffset] = useState(0);
  const [paymentsTotalElements, setPaymentsTotalElements] = useState(0);
  const [paymentsLoading, setPaymentsLoading] = useState(true);
  const [paymentsError, setPaymentsError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [isDesktop, setIsDesktop] = useState(getIsDesktop);
  const [isSidebarOpen, setIsSidebarOpen] = useState(getIsDesktop);
  const [activeNav, setActiveNav] = useState(sectionKey === 'payments' ? 'payments' : 'dashboard');
  const [selectedPaymentRequestId, setSelectedPaymentRequestId] = useState(null);
  const [selectedPaymentRequest, setSelectedPaymentRequest] = useState(null);
  const [canShowThreePendingRequests, setCanShowThreePendingRequests] = useState(
    getCanShowThreePendingRequests,
  );
  const paymentsBasePath = useMemo(() => `/${language}/payments`, [language]);
  const dashboardBasePath = useMemo(() => `/${language}/student-dashboard`, [language]);
  const paymentsRouteSegments = Array.isArray(routeSegments) ? routeSegments : [];
  const paymentsPrimarySegment = paymentsRouteSegments[0] ?? null;
  const paymentsSecondarySegment = paymentsRouteSegments[1] ?? null;
  const paymentRequestDetailId =
    sectionKey === 'payments' && paymentsPrimarySegment === 'requests' && paymentsSecondarySegment
      ? paymentsSecondarySegment
      : null;
  const paymentDetailId =
    sectionKey === 'payments' && paymentsPrimarySegment === 'payments' && paymentsSecondarySegment
      ? paymentsSecondarySegment
      : null;
  const isPaymentDetailRoute = sectionKey === 'payments' && Boolean(paymentDetailId);
  const isPaymentRequestDetailRoute = sectionKey === 'payments' && Boolean(paymentRequestDetailId);
  const [tuitionStartDate, setTuitionStartDate] = useState('');
  const [tuitionEndDate, setTuitionEndDate] = useState('');
  const [requestsFilters, setRequestsFilters] = useState({
    payment_request_id: '',
    student_full_name: '',
    payment_reference: '',
    grade_group: '',
    pt_name: '',
    ps_pr_name: '',
  });
  const [requestsFiltersDraft, setRequestsFiltersDraft] = useState({
    payment_request_id: '',
    student_full_name: '',
    payment_reference: '',
    grade_group: '',
    pt_name: '',
    ps_pr_name: '',
  });
  const [paymentsFilters, setPaymentsFilters] = useState({
    payment_id: '',
    payment_request_id: '',
    student_full_name: '',
    payment_reference: '',
    generation: '',
    grade_group: '',
    pt_name: '',
    scholar_level: '',
    payment_month: '',
  });
  const [paymentsFiltersDraft, setPaymentsFiltersDraft] = useState({
    payment_id: '',
    payment_request_id: '',
    student_full_name: '',
    payment_reference: '',
    generation: '',
    grade_group: '',
    pt_name: '',
    scholar_level: '',
    payment_month: '',
  });
  const [showRequestsFilters, setShowRequestsFilters] = useState(false);
  const [showPaymentsFilters, setShowPaymentsFilters] = useState(false);
  const resolvedPaymentsTab = useMemo(() => {
    if (paymentsPrimarySegment === 'requests') {
      return 'requests';
    }

    if (paymentsPrimarySegment === 'payments') {
      return 'payments';
    }

    return 'tuition';
  }, [paymentsPrimarySegment]);
  const [paymentsTab, setPaymentsTab] = useState(resolvedPaymentsTab);

  useEffect(() => {
    setPaymentsTab(resolvedPaymentsTab);
    setActiveNav(sectionKey === 'payments' ? 'payments' : 'dashboard');

    if (paymentRequestDetailId) {
      setSelectedPaymentRequestId(String(paymentRequestDetailId));
    } else if (sectionKey === 'payments' && paymentsPrimarySegment !== 'requests') {
      setSelectedPaymentRequestId(null);
    }
  }, [paymentRequestDetailId, paymentsPrimarySegment, resolvedPaymentsTab, sectionKey]);

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
        const basePath = key === 'payments' ? paymentsBasePath : dashboardBasePath;
        const suffix = key === 'dashboard' || key === 'payments' ? '' : `/${key}`;
        onNavigate(`${basePath}${suffix}`, { replace: true });
      }
    },
    [dashboardBasePath, isDesktop, onNavigate, paymentsBasePath],
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

  const handlePaymentsTabChange = useCallback(
    (nextTab, { replace = false } = {}) => {
      const safeTab = ['payments', 'requests', 'tuition'].includes(nextTab) ? nextTab : 'tuition';
      setPaymentsTab(safeTab);

      if (onNavigate) {
        const tabSuffix = safeTab === 'tuition' ? '' : `/${safeTab}`;
        onNavigate(`${paymentsBasePath}${tabSuffix}`, { replace });
      }
    },
    [onNavigate, paymentsBasePath],
  );

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
  const requestsFilterStrings = t.paymentsPage?.requestsFilters ?? {};
  const paymentsFilterStrings = t.paymentsPage?.paymentsFilters ?? {};
  const paymentsActionsStrings = t.paymentsPage?.actions ?? {};
  const paymentsTabs = useMemo(
    () => [
      { key: 'tuition', label: paymentsPageStrings.tuition.title },
      { key: 'requests', label: paymentsPageStrings.requests.title },
      { key: 'payments', label: paymentsPageStrings.payments.title },
    ],
    [
      paymentsPageStrings.payments.title,
      paymentsPageStrings.requests.title,
      paymentsPageStrings.tuition.title,
    ],
  );


  useEffect(() => {
    if (typeof window === 'undefined') {
      return () => {};
    }

    const handleResize = () => {
      const desktop = getIsDesktop();
      setIsDesktop(desktop);
      setIsSidebarOpen(desktop);
      setCanShowThreePendingRequests(getCanShowThreePendingRequests());
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
        const [profileData, pendingAmountData, rechargeData] = await Promise.all([
          fetchJson(`${API_BASE_URL}/students/read-only`, { signal }),
          fetchJson(`${API_BASE_URL}/payment-requests/pending`, { signal }),
          fetchJson(`${API_BASE_URL}/reports/balance-recharges?lang=${language}&offset=0&limit=10&export_all=false`, {
            signal,
          }),
        ]);

        setProfile(profileData ?? null);
        setPendingAmount(Number(pendingAmountData ?? 0));
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
    const selectedStartDate = parseMonthInputValue(tuitionStartDate);
    const selectedEndDate = parseMonthInputValue(tuitionEndDate);

    setTuitionReportLoading(true);
    setTuitionReportError(null);
    setTuitionReportMonths(monthRange.months.map((month) => ({ ...month, details: null })));
    setTuitionLoading(true);
    setTuitionError(null);

    const loadTuitionReport = async () => {
      try {
        const params = new URLSearchParams({
          lang: language,
          limit: String(tuitionLimit),
          offset: String(tuitionOffset),
        });

        if (selectedStartDate) {
          params.set('start_date', formatMonthRangeDate(selectedStartDate));
        }

        if (selectedEndDate) {
          params.set('end_date', formatMonthRangeDate(selectedEndDate));
        }

        const data = await fetchJson(`${API_BASE_URL}/reports/payments/report?${params.toString()}`, { signal });
        const content = Array.isArray(data?.content) ? data.content : [];
        const firstEntry = content[0] ?? null;

        setTuitionRows(content);
        setTuitionTotalElements(Number(data?.totalElements) || content.length || 0);

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
        setTuitionError(strings.loadError ?? 'No fue posible cargar la información.');
      } finally {
        setTuitionReportLoading(false);
        setTuitionLoading(false);
      }
    };

    loadTuitionReport();

    return () => {
      controller.abort();
    };
  }, [
    fetchJson,
    language,
    locale,
    refreshIndex,
    strings.cards?.tuitionStatus?.unknown,
    strings.loadError,
    tuitionEndDate,
    tuitionLimit,
    tuitionOffset,
    tuitionStartDate,
  ]);

  const requestsQueryParams = useMemo(() => {
    const params = new URLSearchParams({
      lang: language,
      offset: String(requestsOffset),
      limit: String(requestsLimit),
      export_all: 'false',
    });

    Object.entries(requestsFilters).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      }
    });

    return params;
  }, [language, requestsFilters, requestsLimit, requestsOffset]);

  const paymentsQueryParams = useMemo(() => {
    const params = new URLSearchParams({
      lang: language,
      offset: String(paymentsOffset),
      limit: String(paymentsLimit),
      export_all: 'false',
    });

    Object.entries(paymentsFilters).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      }
    });

    return params;
  }, [language, paymentsFilters, paymentsLimit, paymentsOffset]);

  const requestsFiltersCount = useMemo(
    () => Object.values(requestsFilters).filter(Boolean).length,
    [requestsFilters],
  );

  const paymentsFiltersCount = useMemo(
    () => Object.values(paymentsFilters).filter(Boolean).length,
    [paymentsFilters],
  );

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    setRequestsLoading(true);
    setRequestsError(null);

    fetchJson(`${API_BASE_URL}/reports/paymentrequests?${requestsQueryParams.toString()}`, { signal })
      .then((payload) => {
        const content = Array.isArray(payload?.content) ? payload.content : [];
        setPendingRequests(content);
        setRequestsTotalElements(Number(payload?.totalElements) || content.length || 0);
      })
      .catch((requestError) => {
        if (requestError?.name === 'AbortError') {
          return;
        }
        console.error('Student payment requests fetch error', requestError);
        setRequestsError(strings.loadError ?? 'No fue posible cargar la información.');
      })
      .finally(() => {
        setRequestsLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [fetchJson, requestsQueryParams, strings.loadError]);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    setPaymentsLoading(true);
    setPaymentsError(null);

    fetchJson(`${API_BASE_URL}/reports/payments?${paymentsQueryParams.toString()}`, { signal })
      .then((payload) => {
        const content = Array.isArray(payload?.content) ? payload.content : [];
        setRecentPayments(content);
        setPaymentsTotalElements(Number(payload?.totalElements) || content.length || 0);
      })
      .catch((requestError) => {
        if (requestError?.name === 'AbortError') {
          return;
        }
        console.error('Student payments fetch error', requestError);
        setPaymentsError(strings.loadError ?? 'No fue posible cargar la información.');
      })
      .finally(() => {
        setPaymentsLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [fetchJson, paymentsQueryParams, strings.loadError]);

  const handleRefresh = () => {
    setRefreshIndex((value) => value + 1);
  };

  const handleRequestsFilterChange = (field, value) => {
    setRequestsFiltersDraft((previous) => ({ ...previous, [field]: value }));
  };

  const handlePaymentsFilterChange = (field, value) => {
    setPaymentsFiltersDraft((previous) => ({ ...previous, [field]: value }));
  };

  const handleApplyRequestsFilters = useCallback(
    (event) => {
      event?.preventDefault();
      setRequestsFilters(requestsFiltersDraft);
      setRequestsOffset(0);
      setShowRequestsFilters(false);
    },
    [requestsFiltersDraft],
  );

  const handleApplyPaymentsFilters = useCallback(
    (event) => {
      event?.preventDefault();
      setPaymentsFilters(paymentsFiltersDraft);
      setPaymentsOffset(0);
      setShowPaymentsFilters(false);
    },
    [paymentsFiltersDraft],
  );

  const handleResetRequestsFilters = useCallback(() => {
    const defaultFilters = {
      payment_request_id: '',
      student_full_name: '',
      payment_reference: '',
      grade_group: '',
      pt_name: '',
      ps_pr_name: '',
    };
    setRequestsFilters(defaultFilters);
    setRequestsFiltersDraft(defaultFilters);
    setRequestsOffset(0);
  }, []);

  const handleResetPaymentsFilters = useCallback(() => {
    const defaultFilters = {
      payment_id: '',
      payment_request_id: '',
      student_full_name: '',
      payment_reference: '',
      generation: '',
      grade_group: '',
      pt_name: '',
      scholar_level: '',
      payment_month: '',
    };
    setPaymentsFilters(defaultFilters);
    setPaymentsFiltersDraft(defaultFilters);
    setPaymentsOffset(0);
  }, []);

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

  const getHistoryStatusVariant = useCallback((statusLabel) => {
    const normalized = (statusLabel || '').toLowerCase();

    if (normalized.includes('exito') || normalized.includes('éxito') || normalized.includes('success')) {
      return 'success';
    }

    if (normalized.includes('pend') || normalized.includes('valid') || normalized.includes('review')) {
      return 'warning';
    }

    return 'ghost';
  }, []);

  const recentHistoryRows = useMemo(() => {
    const payments = recentPayments.map((payment) => {
      const amountValue = normalizeAmount(payment.amount ?? payment.total ?? 0) ?? 0;
      return {
        id: payment.payment_id || payment.paymentId || payment.id,
        type: 'payment',
        concept: payment.pt_name || payment.partConceptName || strings.tables?.payments?.unknown,
        amount: amountValue,
        formattedAmount: formatCurrency(amountValue, locale),
        status: payment.payment_status_name || payment.paymentStatusName || strings.tables?.payments?.statusPending,
        statusVariant: getHistoryStatusVariant(
          payment.payment_status_name || payment.paymentStatusName || strings.tables?.payments?.statusPending,
        ),
        date: payment.payment_created_at || payment.paymentCreatedAt,
        method:
          payment.payment_method_name ||
          payment.paymentMethodName ||
          payment.payment_method ||
          strings.sections?.history?.methodFallback,
        link: payment.payment_id || payment.paymentId || payment.id,
      };
    });

    const rechargeItems = recharges.map((recharge) => {
      const amountValue = normalizeAmount(recharge.amount ?? recharge.total ?? 0) ?? 0;
      return {
        id: recharge.balance_recharge_id || recharge.balanceRechargeId,
        type: 'recharge',
        concept: strings.tables?.recharges?.rechargeLabel,
        amount: amountValue,
        formattedAmount: `+${formatCurrency(amountValue, locale)}`,
        status: strings.tables?.recharges?.completed,
        statusVariant: 'success',
        date: recharge.created_at || recharge.createdAt,
        method: recharge.payment_method || recharge.paymentMethod || strings.sections?.history?.methodFallback,
        link: null,
      };
    });

    return [...payments, ...rechargeItems]
      .filter((item) => item.date)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [
    getHistoryStatusVariant,
    locale,
    recentPayments,
    recharges,
    strings.sections?.history?.methodFallback,
    strings.tables?.payments,
    strings.tables?.recharges,
  ]);

  const historyRowsToShow = useMemo(() => recentHistoryRows.slice(0, 4), [recentHistoryRows]);
  const showHistoryViewMore = recentHistoryRows.length > 4;

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

  const getDueStatus = useCallback((dateValue) => {
    if (!dateValue) {
      return { isExpired: false, isToday: false };
    }

    const parsedDate = new Date(dateValue);
    if (Number.isNaN(parsedDate.getTime())) {
      return { isExpired: false, isToday: false };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const normalizedDate = new Date(parsedDate);
    normalizedDate.setHours(0, 0, 0, 0);

    if (normalizedDate.getTime() < today.getTime()) {
      return { isExpired: true, isToday: false };
    }

    if (normalizedDate.getTime() === today.getTime()) {
      return { isExpired: false, isToday: true };
    }

    return { isExpired: false, isToday: false };
  }, []);

  const pendingRequestsLimit = canShowThreePendingRequests ? 3 : 4;
  const visiblePendingRequests = useMemo(
    () => pendingRequests.slice(0, pendingRequestsLimit),
    [pendingRequests, pendingRequestsLimit],
  );

  useEffect(() => {
    if (sectionKey === 'payments') {
      setActiveNav('payments');
      if (paymentsPrimarySegment === 'requests' && paymentsSecondarySegment) {
        setSelectedPaymentRequestId(paymentsSecondarySegment);
      } else {
        setSelectedPaymentRequestId(null);
      }
      return;
    }

    setActiveNav('dashboard');
    setSelectedPaymentRequestId(null);
  }, [paymentsPrimarySegment, paymentsSecondarySegment, sectionKey]);

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

  const tableStrings = paymentsPageStrings.tuition.table;
  const tableColumns = tableStrings.columns ?? {};
  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'MXN',
        minimumFractionDigits: 2,
      }),
    [locale],
  );
  const monthColumns = useMemo(() => {
    const columns = [];

    for (const row of tuitionRows) {
      if (!row || typeof row !== 'object') {
        continue;
      }

      for (const key of Object.keys(row)) {
        if (!MONTH_KEY_REGEX.test(key)) {
          continue;
        }

        if (!columns.includes(key)) {
          columns.push(key);
        }
      }
    }

    return columns.filter((column) => {
      const monthDate = parseMonthKeyToDate(column);
      const startDate = parseMonthInputValue(tuitionStartDate);
      const endDate = parseMonthInputValue(tuitionEndDate);

      if (startDate && monthDate && monthDate.getTime() < startDate.getTime()) {
        return false;
      }

      if (endDate && monthDate && monthDate.getTime() > endDate.getTime()) {
        return false;
      }

      return true;
    });
  }, [tuitionRows, tuitionEndDate, tuitionStartDate]);
  const paymentColumns = useMemo(
    () =>
      monthColumns.map((month) => ({
        key: month,
        header: tableStrings.months?.[month]?.label ?? month,
      })),
    [monthColumns, tableStrings.months],
  );
  const tuitionTotalPages = Math.max(1, Math.ceil(Math.max(tuitionTotalElements, 1) / tuitionLimit));
  const tuitionCurrentPage = Math.min(tuitionTotalPages, Math.floor(tuitionOffset / tuitionLimit) + 1);
  const paymentSummary = useCallback(
    ({ from, to, total }) => {
      const template = tableStrings.pagination?.summary;
      const startLabel = from.toLocaleString(locale);
      const endLabel = to.toLocaleString(locale);
      const totalLabel = total.toLocaleString(locale);

      if (typeof template === 'string') {
        return template
          .replace('{start}', startLabel)
          .replace('{end}', endLabel)
          .replace('{total}', totalLabel);
      }

      return `Mostrando ${startLabel}-${endLabel} de ${totalLabel}`;
    },
    [locale, tableStrings.pagination],
  );
  const tuitionSummary = paymentSummary;
  const paymentPageLabel = useCallback(
    ({ page, totalPages }) => {
      const template = tableStrings.pagination?.page;
      const currentLabel = page.toLocaleString(locale);
      const totalLabel = totalPages.toLocaleString(locale);

      if (typeof template === 'string') {
        return template.replace('{current}', currentLabel).replace('{total}', totalLabel);
      }

      return `${currentLabel} / ${totalLabel}`;
    },
    [locale, tableStrings.pagination],
  );
  const pageLabel = paymentPageLabel;
  const handleRequestsPageChange = useCallback(
    (page) => {
      setRequestsOffset((page - 1) * requestsLimit);
    },
    [requestsLimit],
  );

  const handlePaymentsPageChange = useCallback(
    (page) => {
      setPaymentsOffset((page - 1) * paymentsLimit);
    },
    [paymentsLimit],
  );

  const requestsTotalPages = Math.max(1, Math.ceil(Math.max(requestsTotalElements, 1) / requestsLimit));
  const requestsCurrentPage = Math.min(requestsTotalPages, Math.floor(requestsOffset / requestsLimit) + 1);
  const paymentsTotalPages = Math.max(1, Math.ceil(Math.max(paymentsTotalElements, 1) / paymentsLimit));
  const paymentsCurrentPage = Math.min(paymentsTotalPages, Math.floor(paymentsOffset / paymentsLimit) + 1);

  const handlePaymentRequestSelect = useCallback(
    (request) => {
      const requestId = getRequestId(request);
      setSelectedPaymentRequest(request ?? null);
      setSelectedPaymentRequestId(requestId ? String(requestId) : null);
      handleNavClick('payments', { preserveRequest: true });
      handlePaymentsTabChange('requests', { replace: true });

      if (onNavigate) {
        const suffix = requestId ? `/requests/${encodeURIComponent(String(requestId))}` : '';
        onNavigate(`${paymentsBasePath}${suffix}`, { replace: true });
      }
    },
    [getRequestId, handleNavClick, handlePaymentsTabChange, onNavigate, paymentsBasePath],
  );

  const renderRequestsPagination = useCallback(() => {
    const totalPages = Math.max(1, Math.ceil(Math.max(requestsTotalElements, 1) / requestsLimit));
    const hasItems = requestsTotalElements > 0;
    const safePage = Math.min(Math.max(requestsCurrentPage, 1), totalPages);
    const from = hasItems ? (safePage - 1) * requestsLimit + 1 : 0;
    const to = hasItems ? Math.min(safePage * requestsLimit, requestsTotalElements) : 0;
    const summaryContent = paymentSummary
      ? paymentSummary({ from, to, total: requestsTotalElements, page: safePage, totalPages })
      : hasItems
      ? `Mostrando ${from}-${to} de ${requestsTotalElements} registros`
      : 'Mostrando 0 de 0 registros';

    const handlePageChange = (nextPage) => {
      if (nextPage < 1 || nextPage > totalPages || nextPage === safePage) {
        return;
      }

      handleRequestsPageChange(nextPage);
    };

    return (
      <div className="payment-request-card__pagination">
        <div className="global-table__summary text-muted">{summaryContent}</div>
        <nav aria-label="Table pagination">
          <ul className="pagination justify-content-lg-end mb-0">
            <li className={`page-item ${safePage <= 1 ? 'disabled' : ''}`}>
              <button
                type="button"
                className="page-link"
                onClick={() => handlePageChange(safePage - 1)}
                aria-label={tableStrings.pagination.previous ?? 'Página anterior'}
              >
                {tableStrings.pagination.previous ?? '←'}
              </button>
            </li>
            <li className="page-item disabled">
              <span className="page-link">
                {paymentPageLabel
                  ? paymentPageLabel({ page: safePage, totalPages })
                  : `${safePage} / ${totalPages}`}
              </span>
            </li>
            <li className={`page-item ${safePage >= totalPages ? 'disabled' : ''}`}>
              <button
                type="button"
                className="page-link"
                onClick={() => handlePageChange(safePage + 1)}
                aria-label={tableStrings.pagination.next ?? 'Página siguiente'}
              >
                {tableStrings.pagination.next ?? '→'}
              </button>
            </li>
          </ul>
        </nav>
      </div>
    );
  }, [
    handleRequestsPageChange,
    paymentPageLabel,
    paymentSummary,
    requestsCurrentPage,
    requestsLimit,
    requestsTotalElements,
    tableStrings.pagination,
  ]);

  const renderPaymentsPagination = useCallback(() => {
    const totalPages = Math.max(1, Math.ceil(Math.max(paymentsTotalElements, 1) / paymentsLimit));
    const hasItems = paymentsTotalElements > 0;
    const safePage = Math.min(Math.max(paymentsCurrentPage, 1), totalPages);
    const from = hasItems ? (safePage - 1) * paymentsLimit + 1 : 0;
    const to = hasItems ? Math.min(safePage * paymentsLimit, paymentsTotalElements) : 0;
    const summaryContent = paymentSummary
      ? paymentSummary({ from, to, total: paymentsTotalElements, page: safePage, totalPages })
      : hasItems
      ? `Mostrando ${from}-${to} de ${paymentsTotalElements} registros`
      : 'Mostrando 0 de 0 registros';

    const handlePageChange = (nextPage) => {
      if (nextPage < 1 || nextPage > totalPages || nextPage === safePage) {
        return;
      }

      handlePaymentsPageChange(nextPage);
    };

    return (
      <div className="payment-request-card__pagination">
        <div className="global-table__summary text-muted">{summaryContent}</div>
        <nav aria-label="Table pagination">
          <ul className="pagination justify-content-lg-end mb-0">
            <li className={`page-item ${safePage <= 1 ? 'disabled' : ''}`}>
              <button
                type="button"
                className="page-link"
                onClick={() => handlePageChange(safePage - 1)}
                aria-label={tableStrings.pagination.previous ?? 'Página anterior'}
              >
                {tableStrings.pagination.previous ?? '←'}
              </button>
            </li>
            <li className="page-item disabled">
              <span className="page-link">
                {paymentPageLabel
                  ? paymentPageLabel({ page: safePage, totalPages })
                  : `${safePage} / ${totalPages}`}
              </span>
            </li>
            <li className={`page-item ${safePage >= totalPages ? 'disabled' : ''}`}>
              <button
                type="button"
                className="page-link"
                onClick={() => handlePageChange(safePage + 1)}
                aria-label={tableStrings.pagination.next ?? 'Página siguiente'}
              >
                {tableStrings.pagination.next ?? '→'}
              </button>
            </li>
          </ul>
        </nav>
      </div>
    );
  }, [
    handlePaymentsPageChange,
    paymentPageLabel,
    paymentSummary,
    paymentsCurrentPage,
    paymentsLimit,
    paymentsTotalElements,
    tableStrings.pagination,
  ]);

  const renderMobileRequests = useCallback(() => {
    if (requestsLoading) {
      return (
        <div className="payment-request-card__state text-center">
          <div className="spinner-border text-primary" role="status" aria-hidden="true" />
          <span className="d-block mt-3">{tableStrings.loading}</span>
        </div>
      );
    }

    if (requestsError) {
      return (
        <p className="payment-request-card__state text-center text-danger">
          {typeof requestsError === 'string' ? requestsError : requestsError?.message}
        </p>
      );
    }

    if (!pendingRequests || pendingRequests.length === 0) {
      return (
        <p className="payment-request-card__state text-center text-muted">
          {paymentsPageStrings.requests.empty}
        </p>
      );
    }

    return pendingRequests.map((request, index) => {
      const requestId = getRequestId(request);
      const paymentStatusId = request.payment_status_id;
      const concept = request.pt_name || request.ptName || paymentsPageStrings.requests.columns.concept;
      const statusLabel = request.ps_pr_name || request.psPrName || paymentsPageStrings.requests.columns.status;
      const dueDateValue = request.pr_pay_by || request.prPayBy;
      const dueLabel = getDueLabel(dueDateValue);
      const dueStatus = getDueStatus(dueDateValue);
      const dueDateText = formatDate(dueDateValue, locale);
      const baseAmount = Number(request.pr_amount ?? request.prAmount ?? 0);
      const lateFee = Number(
        request.late_fee_total ?? request.lateFeeTotal ?? request.late_fee ?? request.lateFee ?? 0,
      );
      const totalAmount = baseAmount + lateFee;
      const gradeLabel = [
        request.scholar_level_name || request.scholarLevelName,
        request.grade_group || request.gradeGroup,
      ]
        .filter(Boolean)
        .join(' · ');
      const paymentReference = request.payment_reference || request.paymentReference || '—';
      const paymentMonth = request.payment_month || request.paymentMonth;
      const paymentMonthLabel = paymentMonth ? formatDate(paymentMonth, locale) : null;

      return (
        <details
          key={requestId ?? concept ?? `request-${index}`}
          className="payment-request-card"
          data-request-id={requestId ?? undefined}
        >
          <summary>
            <div className="d-flex justify-content-between"> 
              <div className="payment-request-card__badges">
                <span className="pill pill--ghost payment-request-card__pill">{concept?.toUpperCase?.() ?? concept}</span>
                <span
                  className={[
                    'pill',
                    'payment-request-card__pill',
                    paymentStatusId === 7 ? 'pill--success' : 'pill--warning',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {statusLabel}
                </span>
              </div>
              <span className="payment-request-card__chevron" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </span>
            </div>
              
            <div className="payment-request-card__meta">
              <span className={`payment-request-card__due ${dueStatus.isExpired ? 'is-expired' : ''}`}>
                {dueLabel}: {dueDateText || '—'}
              </span>
            </div>
          </summary>
          <div className="payment-request-card__content">
            <div className="payment-request-card__detail-row">
              <div className="payment-request-card__label">Monto Base</div>
              <div className="fw-bold">{formatCurrency(baseAmount, locale)}</div>
            </div>
            <div className="payment-request-card__detail-row">
              <div className="payment-request-card__label">Recargo Mora</div>
              <div className="fw-bold text-danger">
                {lateFee > 0 ? `+${formatCurrency(lateFee, locale)}` : formatCurrency(lateFee, locale)}
              </div>
            </div>
            <div className="payment-request-card__divider" />
            <div className="payment-request-card__detail-row payment-request-card__detail-row--total">
              <div className="payment-request-card__label">Total</div>
              <div className="fw-bold text-danger">
                {formatCurrency(totalAmount, locale)}
              </div>
            </div>
            <div className="d-flex justify-content-between">
              <div className="payment-request-card__footer-meta">
                {paymentMonthLabel ? (
                  <span className="payment-request-card__subtitle">Mes: {paymentMonthLabel}</span>
                ) : null}
              </div>
              <div className="payment-request-card__actions">
                <button type="button" className="ghost-button" onClick={() => handlePaymentRequestSelect(request)}>
                  {paymentsPageStrings.requests.columns.view}
                </button>
              </div>
            </div>
          </div>
        </details>
      );
    });
  }, [
    getDueLabel,
    getDueStatus,
    getRequestId,
    handlePaymentRequestSelect,
    locale,
    paymentsPageStrings.requests.columns.concept,
    paymentsPageStrings.requests.columns.status,
    paymentsPageStrings.requests.columns.view,
    paymentsPageStrings.requests.empty,
    pendingRequests,
    requestsError,
    requestsLoading,
    tableStrings.loading,
  ]);

  const handlePaymentDetailClick = useCallback(
    (paymentId) => {
      if (!paymentId) {
        return;
      }

      handleNavClick('payments', { preserveRequest: true });
      handlePaymentsTabChange('payments', { replace: true });

      if (onNavigate) {
        onNavigate(`${paymentsBasePath}/payments/${encodeURIComponent(String(paymentId))}`, { replace: true });
      }
    },
    [handleNavClick, handlePaymentsTabChange, onNavigate, paymentsBasePath],
  );

  const renderMobilePayments = useCallback(() => {
    if (paymentsLoading) {
      return (
        <div className="payment-request-card__state text-center">
          <div className="spinner-border text-primary" role="status" aria-hidden="true" />
          <span className="d-block mt-3">{tableStrings.loading}</span>
        </div>
      );
    }

    if (paymentsError) {
      return (
        <p className="payment-request-card__state text-center text-danger">
          {typeof paymentsError === 'string' ? paymentsError : paymentsError?.message}
        </p>
      );
    }

    if (!recentPayments || recentPayments.length === 0) {
      return (
        <p className="payment-request-card__state text-center text-muted">
          {paymentsPageStrings.payments.empty}
        </p>
      );
    }

    return recentPayments.map((payment, index) => {
      const paymentIdValue = payment.payment_id ?? payment.paymentId ?? payment.id ?? '';
      const paymentIdLabel = paymentIdValue || '—';
      const concept =
        payment.pt_name || payment.partConceptName || paymentsPageStrings.payments.columns.concept;
      const amountValue = Number(payment.amount ?? 0);
      const statusLabel =
        payment.payment_status_name ||
        payment.paymentStatusName ||
        paymentsPageStrings.payments.columns.status;
      const createdAtValue =
        payment.payment_created_at || payment.paymentCreatedAt || payment.created_at || payment.createdAt;
      const createdAtLabel = createdAtValue ? formatDate(createdAtValue, locale) : '—';
      const paymentReference = payment.payment_reference || payment.paymentReference;
      const paymentStatusId = payment.payment_status_id;
      const paymentMonth = payment.payment_month || payment.paymentMonth;
      const paymentMonthLabel = paymentMonth ? formatDate(paymentMonth, locale) : null;
      return (
        <details
          key={paymentIdValue || concept || `payment-${index}`}
          className="payment-card"
          data-payment-id={paymentIdValue || undefined}
        >
          <summary>
            <div className="d-flex justify-content-between"> 
              <div className="payment-request-card__badges">
                <span className="pill pill--ghost payment-card__pill">{concept?.toUpperCase?.() ?? concept}</span>
                <span
                  className={[
                    'pill',
                    'payment-request-card__pill',
                    paymentStatusId === 3 ? 'pill--success' : 'pill--warning',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {statusLabel}
                </span>
              </div>
              <div>
                <span className="payment-request-card__chevron" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </span>
              </div>
            </div>
            <div className="payment-card__summary-row">
              <div>
                <p className="payment-card__subtitle">
                  {paymentsPageStrings.payments.columns.date}: {createdAtLabel}
                </p>
              </div>
              <div className="payment-card__amount">{formatCurrency(amountValue, locale)}</div>
            </div>
          </summary>
          <div className="payment-card__content">
            <div className="payment-card__detail-row">
              <div className="payment-card__label">{paymentsPageStrings.payments.columns.concept}</div>
              <div className="fw-bold">{concept}</div>
            </div>
            <div className="payment-card__detail-row">
              <div className="payment-card__label">{paymentsPageStrings.payments.columns.amount}</div>
              <div className="fw-bold payment-card__value--total">
                {formatCurrency(amountValue, locale)}
              </div>
            </div>
            <div className="payment-card__detail-row">
              <div className="payment-card__label">{paymentsPageStrings.payments.columns.status}</div>
              <div className="fw-bold">{statusLabel}</div>
            </div>
            <div className="payment-request-card__divider" />
            <div className="d-flex justify-content-between">
              <div className="payment-request-card__footer-meta">
                {paymentMonthLabel ? (
                  <span className="payment-request-card__subtitle">Mes: {paymentMonthLabel}</span>
                ) : null}
              </div>
              <button type="button" className="ghost-button" onClick={() => handlePaymentDetailClick(paymentIdValue)} disabled={!paymentIdValue}>
                {paymentsPageStrings.payments.columns.view}
              </button>
            </div>
          </div>
        </details>
      );
    });
  }, [
    formatCurrency,
    formatDate,
    handlePaymentDetailClick,
    locale,
    paymentsError,
    paymentsLoading,
    paymentsPageStrings.payments.columns.amount,
    paymentsPageStrings.payments.columns.concept,
    paymentsPageStrings.payments.columns.date,
    paymentsPageStrings.payments.columns.id,
    paymentsPageStrings.payments.columns.status,
    paymentsPageStrings.payments.columns.view,
    paymentsPageStrings.payments.empty,
    recentPayments,
    tableStrings.loading,
  ]);
  const requestsColumns = useMemo(
    () => [
      { key: 'payment_request_id', header: paymentsPageStrings.requests.columns.id },
      { key: 'pt_name', header: paymentsPageStrings.requests.columns.concept },
      { key: 'pr_amount', header: paymentsPageStrings.requests.columns.amount, align: 'end' },
      { key: 'ps_pr_name', header: paymentsPageStrings.requests.columns.status },
      { key: 'pr_pay_by', header: paymentsPageStrings.requests.columns.dueDate },
      { key: 'actions', header: paymentsPageStrings.requests.columns.view, align: 'end' },
    ],
    [paymentsPageStrings.requests.columns],
  );
  const paymentsColumns = useMemo(
    () => [
      { key: 'payment_id', header: paymentsPageStrings.payments.columns.id },
      { key: 'pt_name', header: paymentsPageStrings.payments.columns.concept },
      { key: 'amount', header: paymentsPageStrings.payments.columns.amount, align: 'end' },
      { key: 'payment_status_name', header: paymentsPageStrings.payments.columns.status },
      { key: 'payment_created_at', header: paymentsPageStrings.payments.columns.date },
      { key: 'actions', header: paymentsPageStrings.payments.columns.view, align: 'end' },
    ],
    [paymentsPageStrings.payments.columns],
  );

  const handleViewAllPayments = useCallback(() => {
    handleNavClick('payments');
    handlePaymentsTabChange('payments');
  }, [handleNavClick, handlePaymentsTabChange]);

  const handleHistoryViewMore = useCallback(() => {
    handleNavClick('payments');
    handlePaymentsTabChange('payments', { replace: true });

    if (onNavigate) {
      onNavigate(`${paymentsBasePath}/payments`, { replace: true });
    }
  }, [handleNavClick, handlePaymentsTabChange, onNavigate, paymentsBasePath]);

  const handlePaymentsBackNavigation = useCallback(() => {
    handleNavClick('payments');
    handlePaymentsTabChange(resolvedPaymentsTab, { replace: true });

    if (onNavigate) {
      const suffix = resolvedPaymentsTab === 'tuition' ? '' : `/${resolvedPaymentsTab}`;
      onNavigate(`${paymentsBasePath}${suffix}`, { replace: true });
    }
  }, [handleNavClick, handlePaymentsTabChange, onNavigate, paymentsBasePath, resolvedPaymentsTab]);

  const handlePaymentsRootNavigation = useCallback(() => {
    handleNavClick('payments');
    handlePaymentsTabChange('tuition', { replace: true });

    if (onNavigate) {
      onNavigate(paymentsBasePath, { replace: true });
    }
  }, [handleNavClick, handlePaymentsTabChange, onNavigate, paymentsBasePath]);

  const handlePaymentRequestsNavigation = useCallback(() => {
    handleNavClick('payments', { preserveRequest: true });
    handlePaymentsTabChange('requests', { replace: true });

    if (onNavigate) {
      onNavigate(`${paymentsBasePath}/requests`, { replace: true });
    }
  }, [handleNavClick, handlePaymentsTabChange, onNavigate, paymentsBasePath]);

  const handlePaymentsListNavigation = useCallback(() => {
    handleNavClick('payments', { preserveRequest: true });
    handlePaymentsTabChange('payments', { replace: true });

    if (onNavigate) {
      onNavigate(`${paymentsBasePath}/payments`, { replace: true });
    }
  }, [handleNavClick, handlePaymentsTabChange, onNavigate, paymentsBasePath]);
  const handleStudentDetailClick = useCallback((row) => {
    if (!row) {
      return;
    }

    const studentId = row.student_id ?? row.studentId ?? row.student_uuid;
    if (studentId && onNavigate) {
      onNavigate(`${dashboardBasePath}/students/${encodeURIComponent(String(studentId))}`);
    }
  }, [dashboardBasePath, onNavigate]);
  const handleTuitionTableMonthClick = useCallback(
    (row, monthKey, details) => {
      if (!details) {
        return;
      }

      const { totalAmount, payments, paymentMonth, paymentRequestId } = details;
      const hasDetails =
        totalAmount != null || (payments && payments.length > 0) || paymentRequestId != null;

      if (!hasDetails) {
        return;
      }

      const studentName = row?.student ?? tableStrings.studentFallback;

      openModal({
        key: 'TuitionPaymentDetails',
        props: {
          studentName,
          className: row?.class ?? row?.grade_group ?? null,
          generation: row?.generation ?? null,
          scholarLevel: row?.scholar_level_name ?? null,
          monthKey,
          paymentMonth: paymentMonth ?? monthKey,
          totalAmount,
          paymentRequestId,
          payments,
          locale,
          currency: 'MXN',
          strings: tuitionModalStrings,
          paymentDetailBasePath,
          paymentRequestDetailBasePath,
        },
      });
    },
    [
      locale,
      openModal,
      paymentDetailBasePath,
      paymentRequestDetailBasePath,
      tableStrings.studentFallback,
      tuitionModalStrings,
    ],
  );
  const handlePageChange = useCallback(
    (nextPage) => {
      const safePage = Math.min(Math.max(nextPage, 1), tuitionTotalPages);
      setTuitionOffset((safePage - 1) * tuitionLimit);
    },
    [tuitionLimit, tuitionTotalPages],
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
              <span className="badge">{strings.hero?.concept}: {generation}</span>
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
            {requestsLoading && pendingRequests.length === 0 ? (
              <p className="student-dashboard__muted">{strings.loading}</p>
            ) : null}
            {!requestsLoading && pendingRequests.length === 0 ? (
              <p className="student-dashboard__muted">{strings.sections?.pendingRequests?.empty}</p>
            ) : null}
            {pendingRequests.length > 0 ? (
              <div className="student-dashboard__tiles">
                {visiblePendingRequests.map((request) => (
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
            <button type="button" className="ghost-button" onClick={handleHistoryViewMore} disabled={loading}>
              {strings.sections?.history?.viewAll}
            </button>
          </div>
          {recentHistoryRows.length === 0 ? (
            <p className="student-dashboard__muted">{strings.sections?.history?.empty}</p>
          ) : (
            <div className="student-dashboard__history-table-wrapper">
              <table className="student-dashboard__history-table">
                <thead>
                  <tr>
                    <th scope="col">{strings.sections?.history?.columns?.concept}</th>
                    <th scope="col">{strings.sections?.history?.columns?.date}</th>
                    <th scope="col">{strings.sections?.history?.columns?.method}</th>
                    <th scope="col">{strings.sections?.history?.columns?.status}</th>
                    <th scope="col" className="text-end">{strings.sections?.history?.columns?.amount}</th>
                    <th scope="col" className="text-end">{strings.sections?.history?.viewDetail}</th>
                  </tr>
                </thead>
                <tbody>
                  {historyRowsToShow.map((event) => (
                    <tr key={`${event.type}-${event.id ?? event.date}`}>
                      <td data-title={strings.sections?.history?.columns?.concept}>{event.concept}</td>
                      <td data-title={strings.sections?.history?.columns?.date}>
                        {formatDate(event.date, locale)}
                      </td>
                      <td data-title={strings.sections?.history?.columns?.method}>
                        {event.method || strings.sections?.history?.methodFallback}
                      </td>
                      <td data-title={strings.sections?.history?.columns?.status}>
                        <span className={`pill pill--${event.statusVariant}`}>{event.status}</span>
                      </td>
                      <td data-title={strings.sections?.history?.columns?.amount} className="text-end">
                        {event.formattedAmount || formatCurrency(event.amount ?? 0, locale)}
                      </td>
                      <td className="text-end">
                        <button
                          type="button"
                          className="ghost-button ghost-button--small"
                          onClick={() => handlePaymentDetailClick(event.link)}
                          disabled={event.type !== 'payment' || !event.link}
                        >
                          {strings.sections?.history?.viewDetail}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {showHistoryViewMore ? (
                    <tr className="student-dashboard__history-view-more">
                      <td colSpan={6}>
                        <button
                          type="button"
                          className="student-dashboard__link-button"
                          onClick={handleHistoryViewMore}
                          disabled={loading}
                        >
                          {strings.sections?.history?.viewMore ?? strings.sections?.history?.viewAll}
                        </button>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
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
      <div className="page__tabs-row">
        <div className="tabs" role="tablist" aria-label={paymentsPageStrings.title}>
          {paymentsTabs.map((tab) => (
            <button
              key={tab.key}
              type='button'
              role='tab'
              aria-selected={paymentsTab === tab.key}
              className={`nav-link${paymentsTab === tab.key ? ' active' : ''}`}
              onClick={() => handlePaymentsTabChange(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {paymentsTab === 'tuition' ? (
        <section role='tabpanel' aria-label={paymentsPageStrings.tuition.title}>
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

          <UiCard className="page__table-card">
            <GlobalTable
              className="page__table-wrapper"
              tableClassName="page__table mb-0"
              columns={paymentColumns}
              data={tuitionRows}
              getRowId={(row, index) => {
                const studentId = row?.student_id ?? row?.studentId ?? row?.student_uuid;
                return studentId ?? row?.payment_reference ?? `${row?.student ?? 'row'}-${index}`;
              }}
              renderRow={(row, index) => {
                const studentId = row?.student_id ?? row?.studentId ?? row?.student_uuid;
                const rowKey = studentId ?? row?.payment_reference ?? `${row?.student ?? 'row'}-${index}`;

                return (
                  <tr key={rowKey}>
                    {monthColumns.map((month) => {
                      const value = row?.[month];
                      const details = extractTuitionCellDetails(value);
                      const hasDetails =
                        details &&
                        (details.totalAmount != null ||
                          (details.payments && details.payments.length > 0) ||
                          details.paymentRequestId != null);
                      const displayAmount =
                        details?.totalAmount != null
                          ? currencyFormatter.format(details.totalAmount)
                          : null;
                      const fallbackAmount = normalizeAmount(value);
                      const fallbackContent =
                        fallbackAmount != null
                          ? currencyFormatter.format(fallbackAmount)
                          : (
                              <span className="ui-table__empty-indicator">--</span>
                            );
                      const cellClassName = !hasDetails && fallbackAmount == null ? 'page__amount-null' : '';

                      return (
                        <td
                          key={`${rowKey}-${month}`}
                          data-title={month}
                          className={cellClassName}
                        >
                          {hasDetails ? (
                            <button
                              type="button"
                              className="page__amount-button"
                              onClick={() => handleTuitionTableMonthClick(row, month, details)}
                            >
                              {displayAmount ?? (
                                <span className="ui-table__empty-indicator">--</span>
                              )}
                            </button>
                          ) : (
                            fallbackContent
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              }}
              loading={tuitionLoading}
              loadingMessage={tableStrings.loading}
              error={tuitionError || null}
              emptyMessage={paymentsPageStrings.tuition.empty}
              pagination={{
                currentPage: tuitionCurrentPage,
                pageSize: tuitionLimit,
                totalItems: tuitionTotalElements,
                onPageChange: handlePageChange,
                previousLabel: tableStrings.pagination.previous ?? '←',
                nextLabel: tableStrings.pagination.next ?? '→',
                summary: tuitionSummary,
                pageLabel,
              }}
            />
          </UiCard>
        </section>
      ) : null}

      {paymentsTab === 'requests' ? (
        <section role='tabpanel' aria-label={paymentsPageStrings.requests.title}>
          <div className="student-dashboard__section-header">
            <div>
              <h3>{paymentsPageStrings.requests.title}</h3>
              <p className="student-dashboard__muted">{paymentsPageStrings.requests.description}</p>
            </div>
            <div className="student-dashboard__header-actions">
              <FilterButton
                type="button"
                onClick={() => setShowRequestsFilters(true)}
                aria-expanded={showRequestsFilters}
                aria-controls="student-dashboard-requests-filters"
                className="rounded-pill d-inline-flex align-items-center gap-2"
              >
                <span className="fw-semibold">{paymentsActionsStrings.filter ?? strings.actions?.filter ?? 'Filtrar'}</span>
                {requestsFiltersCount > 0 ? (
                  <span className="badge text-bg-primary rounded-pill">{requestsFiltersCount}</span>
                ) : null}
              </FilterButton>
            </div>
          </div>

          <UiCard className="page__table-card">
            {isDesktop ? (
              <GlobalTable
                className="page__table-wrapper"
                tableClassName="page__table mb-0"
                columns={requestsColumns}
                data={pendingRequests}
                getRowId={(request, index) => request.payment_request_id ?? request.paymentRequestId ?? request.pt_name ?? `request-${index}`}
                renderRow={(request, index) => {
                  const requestId = getRequestId(request);
                  const rowKey = requestId ?? request.pt_name ?? `request-${index}`;

                  return (
                    <tr key={rowKey}>
                      <td data-title={paymentsPageStrings.requests.columns.id}>{requestId ?? '—'}</td>
                      <td data-title={paymentsPageStrings.requests.columns.concept}>
                        {request.pt_name || request.ptName || paymentsPageStrings.requests.columns.concept}
                      </td>
                      <td data-title={paymentsPageStrings.requests.columns.amount} className="text-end">
                        {formatCurrency(request.pr_amount ?? request.prAmount ?? 0, locale)}
                      </td>
                      <td data-title={paymentsPageStrings.requests.columns.status}>
                        {request.ps_pr_name || request.psPrName || paymentsPageStrings.requests.columns.status}
                      </td>
                      <td data-title={paymentsPageStrings.requests.columns.dueDate}>
                        <div className="student-dashboard__due-label">
                          <span className="pill pill--ghost">{getDueLabel(request.pr_pay_by || request.prPayBy)}</span>
                          <span className='d-flex justify-content-center'>{formatDate(request.pr_pay_by || request.prPayBy, locale)}</span>
                        </div>
                      </td>
                      <td data-title={paymentsPageStrings.requests.columns.view} className="text-end">
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
                }}
                loading={requestsLoading}
                loadingMessage={tableStrings.loading}
                error={requestsError || null}
                emptyMessage={paymentsPageStrings.requests.empty}
                pagination={{
                  currentPage: requestsCurrentPage,
                  pageSize: requestsLimit,
                  totalItems: requestsTotalElements,
                  onPageChange: handleRequestsPageChange,
                  previousLabel: tableStrings.pagination.previous ?? '←',
                  nextLabel: tableStrings.pagination.next ?? '→',
                  summary: paymentSummary,
                  pageLabel: paymentPageLabel,
                }}
              />
            ) : (
              <div className="payment-requests-mobile">
                {renderMobileRequests()}
                {pendingRequests && pendingRequests.length > 0 ? renderRequestsPagination() : null}
              </div>
            )}
          </UiCard>
        </section>
      ) : null}

      {paymentsTab === 'payments' ? (
        <section role='tabpanel' aria-label={paymentsPageStrings.payments.title}>
          <div className="student-dashboard__section-header">
            <div>
              <h3>{paymentsPageStrings.payments.title}</h3>
            </div>
            <div className="student-dashboard__header-actions">
              <FilterButton
                type="button"
                onClick={() => setShowPaymentsFilters(true)}
                aria-expanded={showPaymentsFilters}
                aria-controls="student-dashboard-payments-filters"
                className="rounded-pill d-inline-flex align-items-center gap-2"
              >
                <span className="fw-semibold">
                  {paymentsActionsStrings.filter ?? strings.actions?.filter ?? 'Filtrar'}
                </span>
                {paymentsFiltersCount > 0 ? (
                  <span className="badge text-bg-primary rounded-pill">{paymentsFiltersCount}</span>
                ) : null}
              </FilterButton>
            </div>
          </div>

          <UiCard className="page__table-card">
            {isDesktop ? (
              <GlobalTable
                className="page__table-wrapper"
                tableClassName="page__table mb-0"
                columns={paymentsColumns}
                data={recentPayments}
                getRowId={(payment, index) =>
                  payment.payment_id ?? payment.paymentId ?? payment.id ?? payment.pt_name ?? `payment-${index}`
                }
                renderRow={(payment, index) => {
                  const paymentIdValue = payment.payment_id ?? payment.paymentId ?? payment.id ?? '';
                  const rowKey = paymentIdValue || payment.pt_name || `payment-${index}`;

                  return (
                    <tr key={rowKey}>
                      <td data-title={paymentsPageStrings.payments.columns.id}>{paymentIdValue || '—'}</td>
                      <td data-title={paymentsPageStrings.payments.columns.concept}>
                        {payment.pt_name || payment.partConceptName || paymentsPageStrings.payments.columns.concept}
                      </td>
                      <td data-title={paymentsPageStrings.payments.columns.amount} className="text-end">
                        {formatCurrency(payment.amount ?? 0, locale)}
                      </td>
                      <td data-title={paymentsPageStrings.payments.columns.status}>
                        {payment.payment_status_name || payment.paymentStatusName || paymentsPageStrings.payments.columns.status}
                      </td>
                      <td data-title={paymentsPageStrings.payments.columns.date}>
                        {formatDate(payment.payment_created_at || payment.paymentCreatedAt, locale)}
                      </td>
                      <td data-title={paymentsPageStrings.payments.columns.view} className="text-end">
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
                }}
                loading={paymentsLoading}
                loadingMessage={tableStrings.loading}
                error={paymentsError || null}
                emptyMessage={paymentsPageStrings.payments.empty}
                pagination={{
                  currentPage: paymentsCurrentPage,
                  pageSize: paymentsLimit,
                  totalItems: paymentsTotalElements,
                  onPageChange: handlePaymentsPageChange,
                  previousLabel: tableStrings.pagination.previous ?? '←',
                  nextLabel: tableStrings.pagination.next ?? '→',
                  summary: paymentSummary,
                  pageLabel: paymentPageLabel,
                }}
              />
            ) : (
              <div className="payment-requests-mobile">
                {renderMobilePayments()}
                {recentPayments && recentPayments.length > 0 ? renderPaymentsPagination() : null}
              </div>
            )}
          </UiCard>
        </section>
      ) : null}
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

      <SidebarModal
        isOpen={showRequestsFilters}
        onClose={() => setShowRequestsFilters(false)}
        title={requestsFilterStrings.title ?? paymentsActionsStrings.filter ?? strings.sections?.pendingRequests?.title}
        description={requestsFilterStrings.subtitle ?? strings.sections?.pendingRequests?.description}
        id="student-dashboard-requests-filters"
        footer={
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
            <ActionButton variant="text" onClick={handleResetRequestsFilters} type="button">
              {requestsFilterStrings.reset ?? strings.actions?.reset ?? 'Borrar filtros'}
            </ActionButton>
            <ActionButton type="submit" form="payment-recurrences-filters-form">
              {paymentsActionsStrings.filter ?? strings.actions?.filter ?? 'Filtrar'}
            </ActionButton>
          </div>
        }
      >
        <form className="student-dashboard__filters" onSubmit={handleApplyRequestsFilters}>
          <label className="student-dashboard__filter-field">
            <span>{requestsFilterStrings.fields?.paymentRequestId?.label ?? paymentsPageStrings.requests.columns.id}</span>
            <input
              type="text"
              value={requestsFiltersDraft.payment_request_id}
              onChange={(event) => handleRequestsFilterChange('payment_request_id', event.target.value)}
              placeholder={requestsFilterStrings.fields?.paymentRequestId?.placeholder ?? ''}
            />
          </label>
          <label className="student-dashboard__filter-field">
            <span>{requestsFilterStrings.fields?.concept?.label ?? paymentsPageStrings.requests.columns.concept}</span>
            <input
              type="text"
              value={requestsFiltersDraft.pt_name}
              onChange={(event) => handleRequestsFilterChange('pt_name', event.target.value)}
              placeholder={requestsFilterStrings.fields?.concept?.placeholder ?? ''}
            />
          </label>
          <label className="student-dashboard__filter-field">
            <span>{requestsFilterStrings.fields?.status?.label ?? paymentsPageStrings.requests.columns.status}</span>
            <input
              type="text"
              value={requestsFiltersDraft.ps_pr_name}
              onChange={(event) => handleRequestsFilterChange('ps_pr_name', event.target.value)}
              placeholder={requestsFilterStrings.fields?.status?.placeholder ?? ''}
            />
          </label>
        </form>
      </SidebarModal>

      <SidebarModal
        isOpen={showPaymentsFilters}
        onClose={() => setShowPaymentsFilters(false)}
        title={paymentsFilterStrings.title ?? paymentsActionsStrings.filter ?? strings.sections?.payments?.title}
        description={paymentsFilterStrings.subtitle ?? strings.sections?.payments?.description}
        id="student-dashboard-payments-filters"
        footer={
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
            <ActionButton variant="text" onClick={handleResetPaymentsFilters} type="button">
              {requestsFilterStrings.reset ?? strings.actions?.reset ?? 'Borrar filtros'}
            </ActionButton>
            <ActionButton type="submit" form="payment-recurrences-filters-form">
              {paymentsActionsStrings.filter ?? strings.actions?.filter ?? 'Filtrar'}
            </ActionButton>
          </div>
        }
      >
        <form className="student-dashboard__filters" onSubmit={handleApplyPaymentsFilters}>
          <label className="student-dashboard__filter-field">
            <span>{paymentsFilterStrings.fields?.paymentId?.label ?? paymentsPageStrings.payments.columns.id}</span>
            <input
              type="text"
              value={paymentsFiltersDraft.payment_id}
              onChange={(event) => handlePaymentsFilterChange('payment_id', event.target.value)}
              placeholder={paymentsFilterStrings.fields?.paymentId?.placeholder ?? ''}
            />
          </label>
          <label className="student-dashboard__filter-field">
            <span>{paymentsFilterStrings.fields?.concept?.label ?? paymentsPageStrings.payments.columns.concept}</span>
            <input
              type="text"
              value={paymentsFiltersDraft.pt_name}
              onChange={(event) => handlePaymentsFilterChange('pt_name', event.target.value)}
              placeholder={paymentsFilterStrings.fields?.concept?.placeholder ?? ''}
            />
          </label>
          <label className="student-dashboard__filter-field">
            <span>{paymentsFilterStrings.fields?.month?.label ?? paymentsPageStrings.tuition.table.month}</span>
            <input
              type="text"
              value={paymentsFiltersDraft.payment_month}
              onChange={(event) => handlePaymentsFilterChange('payment_month', event.target.value)}
              placeholder={paymentsFilterStrings.fields?.month?.placeholder ?? ''}
            />
          </label>
        </form>
      </SidebarModal>
    </div>
  );

  const pageTitle = isPaymentDetailRoute
    ? `${paymentsPageStrings.payments.columns.id} ${paymentDetailId ?? ''}`.trim()
    : isPaymentRequestDetailRoute
    ? `${paymentsPageStrings.requests.columns.id} ${paymentRequestDetailId ?? ''}`.trim()
    : activeNav === 'payments'
    ? paymentsPageStrings.title
    : headerTitle;
  const pageSubtitle =
    activeNav === 'payments'
      ? strings.sections?.payments?.description ?? headerSubtitle
      : headerSubtitle;
  const mainContent = isPaymentDetailRoute ? (
    <div className="page__layout">
      <section className="page__content">
        <PaymentDetailPage
          paymentId={paymentDetailId}
          language={language}
          strings={strings.paymentsPage?.detail ?? {}}
          readOnly
        />
      </section>
    </div>
  ) : isPaymentRequestDetailRoute ? (
    <div className="page__layout">
      <section className="page__content">
        <PaymentRequestDetailPage
          requestId={paymentRequestDetailId}
          language={language}
          strings={strings.paymentsPage?.requestsDetail ?? {}}
          readOnly
          onNavigateBack={handlePaymentsBackNavigation}
          onPaymentDetail={handlePaymentDetailClick}
        />
      </section>
    </div>
  ) : activeNav === 'payments' ? (
    paymentsContent
  ) : (
    dashboardContent
  );

  const breadcrumbs = useMemo(() => {
    const dashboardLabel = menuItems.find((item) => item.key === 'dashboard')?.label ?? headerTitle;
    const paymentsLabel = menuItems.find((item) => item.key === 'payments')?.label ?? paymentsPageStrings.title;
    const requestsLabel = paymentsPageStrings.requests?.title ?? paymentsPageStrings.requests.columns.id;
    const paymentsListLabel = paymentsPageStrings.payments?.title ?? paymentsPageStrings.payments.columns.id;
    const items = [
      {
        label: dashboardLabel,
        onClick: activeNav === 'dashboard' ? undefined : () => handleNavClick('dashboard'),
      },
    ];

    if (activeNav === 'payments') {
      items.push({
        label: paymentsLabel,
        onClick: isPaymentDetailRoute || isPaymentRequestDetailRoute || paymentsTab !== 'tuition'
          ? handlePaymentsRootNavigation
          : undefined,
      });

      if (isPaymentRequestDetailRoute || paymentsTab === 'requests' || selectedPaymentRequestId) {
        items.push({
          label: requestsLabel,
          onClick: isPaymentRequestDetailRoute ? handlePaymentRequestsNavigation : undefined,
        });
      }

      if (isPaymentDetailRoute || paymentsTab === 'payments') {
        items.push({
          label: paymentsListLabel,
          onClick: isPaymentDetailRoute ? handlePaymentsListNavigation : undefined,
        });
      }

      if (isPaymentRequestDetailRoute && paymentRequestDetailId) {
        items.push({ label: `${paymentsPageStrings.requests.columns.id} ${paymentRequestDetailId}` });
      } else if (selectedPaymentRequestId) {
        items.push({ label: `${paymentsPageStrings.requests.columns.id} ${selectedPaymentRequestId}` });
      }

      if (isPaymentDetailRoute && paymentDetailId) {
        items.push({ label: `${paymentsPageStrings.payments.columns.id} ${paymentDetailId}` });
      }
    }

    if (activeNav !== 'payments' && activeNav !== 'dashboard') {
      const activeLabel = menuItems.find((item) => item.key === activeNav)?.label ?? headerTitle;
      items.push({ label: activeLabel });
    }

    return items;
  }, [
    activeNav,
    handleNavClick,
    handlePaymentRequestsNavigation,
    handlePaymentsListNavigation,
    handlePaymentsRootNavigation,
    headerTitle,
    isPaymentDetailRoute,
    isPaymentRequestDetailRoute,
    menuItems,
    paymentDetailId,
    paymentRequestDetailId,
    paymentsPageStrings.payments.columns.id,
    paymentsPageStrings.payments?.title,
    paymentsPageStrings.requests.columns.id,
    paymentsPageStrings.requests?.title,
    paymentsPageStrings.title,
    paymentsTab,
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

      {!isDesktop && isSidebarOpen ? <div className='dashboard__overlay' onClick={closeSidebar} aria-hidden='true' /> : null}

      <div className='dashboard__main'>
        <header className='dashboard__header'>
          <div className='dashboard__header-title'>
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
            <div>
              <h1>{pageTitle}</h1>
              <p className='dashboard__subtitle'>{schoolName ? schoolName : pageSubtitle}</p>
            </div>
          </div>
          {!isDesktop ? (
            <div className='student-dashboard__header-actions'>
              <div className='dashboard__user-initials' aria-hidden='true'>
                {initials || 'AD'}
              </div>
            </div>
            ) : 
            <div className='student-dashboard__header-actions'>
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
          }
        </header>

        <Breadcrumbs items={breadcrumbs} />

        {mainContent}
      </div>
    </div>
  );
}

export default StudentDashboardPage;
