import { useCallback, useEffect, useMemo, useState } from 'react';
import GlobalToast from '../components/GlobalToast.jsx';
import ActionButton from '../components/ui/ActionButton.jsx';
import ExportButton from '../components/ui/buttons/ExportButton.jsx';
import FilterButton from '../components/ui/buttons/FilterButton.jsx';
import UiCard from '../components/ui/UiCard.jsx';
import Tabs from '../components/ui/Tabs.jsx';
import SearchInput from '../components/ui/SearchInput.jsx';
import GlobalTable from '../components/ui/GlobalTable.jsx';
import SidebarModal from '../components/ui/SidebarModal.jsx';
import StudentInfo from '../components/ui/StudentInfo.jsx';
import AddPaymentModal from '../components/payments/AddPaymentModal.jsx';
import { useModal } from '../components/modal/useModal';
import { API_BASE_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import { handleExpiredToken } from '../utils/auth';
import PaymentDetailPage from './PaymentDetailPage.jsx';
import './PaymentsFinancePage.css';

const DEFAULT_LIMIT = 10;
const MONTH_KEY_REGEX = /^[A-Za-z]{3}-\d{2}$/;
const DEFAULT_PAYMENTS_TAB_KEY = 'tuition';

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
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
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

const extractListFromPayload = (payload) => {
  if (!payload) {
    return [];
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  const candidates = [
    payload.data,
    payload.results,
    payload.items,
    payload.list,
    payload.schools,
    payload.content,
    payload.data?.items,
    payload.data?.results,
    payload.data?.data,
  ];

  return candidates.find(Array.isArray) ?? [];
};

const normalizeSelectOption = (item, index = 0) => {
  if (item == null) {
    return { value: '', label: '' };
  }

  if (typeof item !== 'object') {
    const stringValue = String(item);
    return { value: stringValue, label: stringValue };
  }

  const valueKeys = ['id', 'school_id', 'schoolId', 'value'];
  let value = '';

  for (const key of valueKeys) {
    const candidate = item[key];
    if (candidate !== undefined && candidate !== null && candidate !== '') {
      value = String(candidate);
      break;
    }
  }

  const labelKeys = ['name', 'label', 'title', 'description'];
  let label = '';

  for (const key of labelKeys) {
    const candidate = item[key];
    if (typeof candidate === 'string' && candidate.trim() !== '') {
      label = candidate;
      break;
    }
  }

  if (!label) {
    label = value || String(index + 1);
  }

  return { value, label };
};

const DEFAULT_TUITION_FILTERS = {
  group_status: '',
  user_status: '',
  student_full_name: '',
  payment_reference: '',
  generation: '',
  grade_group: '',
  scholar_level: '',
  school_id: '',
};

const DEFAULT_PAYMENTS_FILTERS = {
  payment_id: '',
  payment_request_id: '',
  student_full_name: '',
  payment_reference: '',
  generation: '',
  grade_group: '',
  pt_name: '',
  scholar_level_name: '',
  payment_month: '',
};

const DEFAULT_PAYMENTS_STRINGS = {
  placeholder: 'Muy pronto podrás gestionar tus pagos desde aquí.',
  tabs: {
    tuition: 'Colegiaturas',
    requests: 'Solicitudes de pago',
    payments: 'Pagos',
  },
  actions: {
    filter: 'Filtrar',
    debtActive: 'Mostrando morosos',
    debtInactive: 'Alumnos con deuda',
    add: 'Agregar pago',
    bulkUpload: 'Carga masiva',
    bulkUploadTooltip: 'Muy pronto podrás gestionar tus pagos desde aquí.',
    export: 'Exportar CSV',
    exporting: 'Exportando…',
  },
  search: {
    placeholder: 'Buscar alumno por nombre',
  },
  dateRange: {
    start: 'Fecha inicio',
    end: 'Fecha fin',
  },
  table: {
    columns: {
      student: 'Alumno',
      class: 'Grupo',
      generation: 'Generación',
      scholarLevel: 'Nivel académico',
    },
    loading: 'Cargando información de pagos...',
    empty: 'No se encontraron registros con los filtros seleccionados.',
    error: 'No fue posible cargar los pagos.',
    unknownError: 'Error desconocido',
    studentFallback: 'Sin nombre',
    studentIdLabel: 'Matrícula',
    pagination: {
      summary: 'Mostrando {start} - {end} de {total} registros',
      page: 'Página {current} de {total}',
      previous: 'Anterior',
      next: 'Siguiente',
    },
  },
  paymentsTable: {
    columns: {
      id: 'ID',
      student: 'Alumno',
      gradeGroup: 'Grado y grupo',
      scholarLevel: 'Nivel académico',
      concept: 'Concepto',
      amount: 'Monto',
      actions: 'Acciones',
    },
    loading: 'Cargando pagos...',
    empty: 'No se encontraron pagos registrados.',
    error: 'No fue posible cargar los pagos.',
    actionsPlaceholder: 'Próximamente',
  },
  filters: {
    title: 'Filtros',
    reset: 'Borrar filtros',
    closeAria: 'Cerrar filtros',
    fields: {
      student: { label: 'Nombre del alumno', placeholder: 'Ej. FATIMA MONTSERRAT' },
      reference: { label: 'Matrícula', placeholder: 'Ej. 1376' },
      generation: { label: 'Generación', placeholder: 'Ej. 2024-2025' },
      gradeGroup: { label: 'Grado y grupo', placeholder: 'Ej. 6-A' },
      scholarLevel: { label: 'Nivel académico', placeholder: 'Ej. Primaria' },
      school: { label: 'Escuela' },
    },
    schoolOptions: { all: 'Todas' },
    toggles: {
      activeGroups: 'Sólo grupos activos',
      activeStudents: 'Sólo alumnos activos',
    },
  },
  paymentsFilters: {
    title: 'Filtros de pagos',
    reset: 'Borrar filtros',
    closeAria: 'Cerrar filtros',
    fields: {
      paymentId: { label: 'ID de pago', placeholder: 'Ej. 1245' },
      paymentRequestId: { label: 'ID de solicitud', placeholder: 'Ej. 257' },
      student: { label: 'Nombre del alumno', placeholder: 'Ej. EMMA PONCE' },
      reference: { label: 'Matrícula', placeholder: 'Ej. 1376' },
      generation: { label: 'Generación', placeholder: 'Ej. 2024-2025' },
      gradeGroup: { label: 'Grado y grupo', placeholder: 'Ej. 4-A' },
      concept: { label: 'Concepto', placeholder: 'Ej. Colegiatura' },
      scholarLevel: { label: 'Nivel académico', placeholder: 'Ej. Primaria' },
      month: { label: 'Mes de pago' },
    },
  },
  toggles: {
    debtActive: 'Mostrando morosos',
    debtInactive: 'Alumnos con deuda',
  },
  toasts: {
    loadSchoolsError: 'No fue posible cargar las escuelas.',
    exportSuccess: 'Exportación generada correctamente.',
    exportEmpty: 'No hay información para exportar con los filtros actuales.',
    exportError: 'Error al exportar.',
  },
  errors: {
    loadSchools: 'No fue posible cargar las escuelas',
    export: 'No fue posible exportar la información.',
  },
  csv: {
    fileNamePrefix: 'reporte-pagos',
    headers: {
      student: 'Alumno',
      class: 'Grupo',
      generation: 'Generación',
      scholarLevel: 'Nivel académico',
    },
    studentIdLabel: 'Matrícula',
  },
  addPayment: {
    title: 'Agregar pago',
    description: 'Registra un nuevo pago para un alumno.',
    studentLabel: 'Estudiante',
    studentPlaceholder: 'Buscar por nombre',
    studentNoResults: 'No se encontraron alumnos.',
    studentLoading: 'Buscando alumnos...',
    studentLoadError: 'No fue posible cargar los alumnos.',
    conceptLabel: 'Concepto de pago',
    conceptPlaceholder: 'Selecciona un concepto',
    conceptLoading: 'Cargando conceptos...',
    throughLabel: 'Método de pago',
    throughPlaceholder: 'Selecciona un método',
    throughLoading: 'Cargando métodos de pago...',
    monthLabel: 'Mes de pago',
    amountLabel: 'Monto',
    commentsLabel: 'Comentarios',
    receiptLabel: 'Comprobante (PDF, máx. 5 MB)',
    receiptOptional: 'Opcional',
    receiptTypeError: 'El comprobante debe ser un archivo PDF.',
    receiptSizeError: 'El archivo debe ser menor a 5 MB.',
    cancel: 'Cancelar',
    submit: 'Guardar pago',
    submitting: 'Guardando...',
    success: 'Pago creado correctamente.',
    error: 'No fue posible crear el pago.',
    requiredField: 'Completa los campos obligatorios.',
  },
  tuitionModal: {
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
  },
};

const SUPPORTED_LANGUAGES = ['es', 'en'];

const getLocaleFromLanguage = (language) => (language === 'en' ? 'en-US' : 'es-MX');

const PaymentsFinancePage = ({
  description = '',
  language = 'es',
  strings = {},
  onStudentDetail,
  onPaymentDetail,
  onPaymentBreadcrumbChange,
  activeSectionKey = DEFAULT_PAYMENTS_TAB_KEY,
  onSectionChange,
  routeSegments = [],
}) => {
  const { token, logout } = useAuth();
  const { openModal } = useModal();

  const normalizedLanguage = SUPPORTED_LANGUAGES.includes(language) ? language : 'es';
  const locale = getLocaleFromLanguage(normalizedLanguage);
  const paymentDetailBasePath = useMemo(
    () => `/${normalizedLanguage}/payments/detail`,
    [normalizedLanguage],
  );
  const paymentRequestDetailBasePath = useMemo(
    () => `/${normalizedLanguage}/payments/requests/detail`,
    [normalizedLanguage],
  );

  const detailRouteSegments = Array.isArray(routeSegments) ? routeSegments : [];
  const isPaymentDetailRoute = detailRouteSegments[0] === 'detail';
  const paymentDetailId = (() => {
    if (!isPaymentDetailRoute) {
      return null;
    }

    const candidate = detailRouteSegments[1];

    if (candidate == null) {
      return null;
    }

    if (typeof candidate !== 'string') {
      return candidate;
    }

    try {
      return decodeURIComponent(candidate);
    } catch (decodeError) {
      console.warn('Unable to decode payment id from route', decodeError);
      return candidate;
    }
  })();

  const tabStrings = useMemo(
    () => ({ ...DEFAULT_PAYMENTS_STRINGS.tabs, ...(strings.tabs ?? {}) }),
    [strings.tabs],
  );
  const actionStrings = useMemo(
    () => ({ ...DEFAULT_PAYMENTS_STRINGS.actions, ...(strings.actions ?? {}) }),
    [strings.actions],
  );
  const dateRangeStrings = useMemo(
    () => ({ ...DEFAULT_PAYMENTS_STRINGS.dateRange, ...(strings.dateRange ?? {}) }),
    [strings.dateRange],
  );
  const tableStrings = useMemo(() => {
    const tableOverrides = strings.table ?? {};
    const columns = {
      ...DEFAULT_PAYMENTS_STRINGS.table.columns,
      ...(tableOverrides.columns ?? {}),
    };
    const pagination = {
      ...DEFAULT_PAYMENTS_STRINGS.table.pagination,
      ...(tableOverrides.pagination ?? {}),
    };

    return {
      ...DEFAULT_PAYMENTS_STRINGS.table,
      ...tableOverrides,
      columns,
      pagination,
    };
  }, [strings.table]);
  const paymentsTableStrings = useMemo(() => {
    const paymentsOverrides = strings.paymentsTable ?? {};
    const columns = {
      ...DEFAULT_PAYMENTS_STRINGS.paymentsTable.columns,
      ...(paymentsOverrides.columns ?? {}),
    };

    return {
      ...DEFAULT_PAYMENTS_STRINGS.paymentsTable,
      ...paymentsOverrides,
      columns,
      actionsPlaceholder:
        paymentsOverrides.actionsPlaceholder ??
        DEFAULT_PAYMENTS_STRINGS.paymentsTable.actionsPlaceholder,
    };
  }, [strings.paymentsTable]);
  const paymentDetailButtonLabel = paymentsTableStrings.paymentLinkLabel ?? 'Abrir detalle del pago';
  const tuitionModalStrings = useMemo(() => {
    const modalOverrides = strings.tuitionModal ?? {};
    const summary = {
      ...DEFAULT_PAYMENTS_STRINGS.tuitionModal.summary,
      ...(modalOverrides.summary ?? {}),
    };
    const paymentsTable = {
      ...DEFAULT_PAYMENTS_STRINGS.tuitionModal.paymentsTable,
      ...(modalOverrides.paymentsTable ?? {}),
      columns: {
        ...DEFAULT_PAYMENTS_STRINGS.tuitionModal.paymentsTable.columns,
        ...((modalOverrides.paymentsTable?.columns ?? {})),
      },
    };

    return {
      ...DEFAULT_PAYMENTS_STRINGS.tuitionModal,
      ...modalOverrides,
      summary,
      paymentsTable,
    };
  }, [strings.tuitionModal]);
  const tuitionFilterStrings = useMemo(() => {
    const filterOverrides = strings.filters ?? {};
    const fieldDefaults = DEFAULT_PAYMENTS_STRINGS.filters.fields;
    const fieldOverrides = filterOverrides.fields ?? {};
    const fields = {
      student: { ...fieldDefaults.student, ...(fieldOverrides.student ?? {}) },
      reference: { ...fieldDefaults.reference, ...(fieldOverrides.reference ?? {}) },
      generation: { ...fieldDefaults.generation, ...(fieldOverrides.generation ?? {}) },
      gradeGroup: { ...fieldDefaults.gradeGroup, ...(fieldOverrides.gradeGroup ?? {}) },
      scholarLevel: { ...fieldDefaults.scholarLevel, ...(fieldOverrides.scholarLevel ?? {}) },
      school: { ...fieldDefaults.school, ...(fieldOverrides.school ?? {}) },
    };

    return {
      ...DEFAULT_PAYMENTS_STRINGS.filters,
      ...filterOverrides,
      fields,
      schoolOptions: {
        ...DEFAULT_PAYMENTS_STRINGS.filters.schoolOptions,
        ...(filterOverrides.schoolOptions ?? {}),
      },
      toggles: {
        ...DEFAULT_PAYMENTS_STRINGS.filters.toggles,
        ...(filterOverrides.toggles ?? {}),
      },
    };
  }, [strings.filters]);
  const paymentsFilterStrings = useMemo(() => {
    const overrides = strings.paymentsFilters ?? {};
    const fieldDefaults = DEFAULT_PAYMENTS_STRINGS.paymentsFilters.fields;
    const fieldOverrides = overrides.fields ?? {};
    const fields = {
      paymentId: { ...fieldDefaults.paymentId, ...(fieldOverrides.paymentId ?? {}) },
      paymentRequestId: {
        ...fieldDefaults.paymentRequestId,
        ...(fieldOverrides.paymentRequestId ?? {}),
      },
      student: { ...fieldDefaults.student, ...(fieldOverrides.student ?? {}) },
      reference: { ...fieldDefaults.reference, ...(fieldOverrides.reference ?? {}) },
      generation: { ...fieldDefaults.generation, ...(fieldOverrides.generation ?? {}) },
      gradeGroup: { ...fieldDefaults.gradeGroup, ...(fieldOverrides.gradeGroup ?? {}) },
      concept: { ...fieldDefaults.concept, ...(fieldOverrides.concept ?? {}) },
      scholarLevel: { ...fieldDefaults.scholarLevel, ...(fieldOverrides.scholarLevel ?? {}) },
      month: { ...fieldDefaults.month, ...(fieldOverrides.month ?? {}) },
    };

    return {
      ...DEFAULT_PAYMENTS_STRINGS.paymentsFilters,
      ...overrides,
      fields,
    };
  }, [strings.paymentsFilters]);
  const debtToggleStrings = useMemo(
    () => ({ ...DEFAULT_PAYMENTS_STRINGS.toggles, ...(strings.toggles ?? {}) }),
    [strings.toggles],
  );
  const toastStrings = useMemo(
    () => ({ ...DEFAULT_PAYMENTS_STRINGS.toasts, ...(strings.toasts ?? {}) }),
    [strings.toasts],
  );
  const errorStrings = useMemo(
    () => ({ ...DEFAULT_PAYMENTS_STRINGS.errors, ...(strings.errors ?? {}) }),
    [strings.errors],
  );
  const csvStrings = useMemo(() => {
    const csvOverrides = strings.csv ?? {};
    const headers = {
      ...DEFAULT_PAYMENTS_STRINGS.csv.headers,
      ...(csvOverrides.headers ?? {}),
    };

    return {
      ...DEFAULT_PAYMENTS_STRINGS.csv,
      ...csvOverrides,
      headers,
      studentIdLabel:
        csvOverrides.studentIdLabel ?? DEFAULT_PAYMENTS_STRINGS.csv.studentIdLabel,
    };
  }, [strings.csv]);
  const addPaymentStrings = useMemo(
    () => ({ ...DEFAULT_PAYMENTS_STRINGS.addPayment, ...(strings.addPayment ?? {}) }),
    [strings.addPayment],
  );
  const placeholderMessage = strings.placeholder ?? DEFAULT_PAYMENTS_STRINGS.placeholder;
  const paymentsComingSoonLabel =
    actionStrings.bulkUploadTooltip ?? placeholderMessage;
  const searchPlaceholder =
    strings.search?.placeholder ?? DEFAULT_PAYMENTS_STRINGS.search.placeholder;

  const [activeTab, setActiveTab] = useState(activeSectionKey);
  const [tuitionFilters, setTuitionFilters] = useState(() => ({ ...DEFAULT_TUITION_FILTERS }));
  const [tuitionFiltersDraft, setTuitionFiltersDraft] = useState(
    () => ({ ...DEFAULT_TUITION_FILTERS }),
  );
  const [paymentsFilters, setPaymentsFilters] = useState(() => ({ ...DEFAULT_PAYMENTS_FILTERS }));
  const [paymentsFiltersDraft, setPaymentsFiltersDraft] = useState(
    () => ({ ...DEFAULT_PAYMENTS_FILTERS }),
  );
  const [showTuitionFilters, setShowTuitionFilters] = useState(false);
  const [showPaymentsFilters, setShowPaymentsFilters] = useState(false);
  const [schoolOptions, setSchoolOptions] = useState([]);
  const [isLoadingSchools, setIsLoadingSchools] = useState(false);

  const [startMonth, setStartMonth] = useState('');
  const [endMonth, setEndMonth] = useState('');
  const [showDebtOnly, setShowDebtOnly] = useState(false);

  const [orderBy, setOrderBy] = useState('');
  const [orderDir, setOrderDir] = useState('ASC');

  const [tuitionOffset, setTuitionOffset] = useState(0);
  const [tuitionLimit] = useState(DEFAULT_LIMIT);

  const [tuitionRows, setTuitionRows] = useState([]);
  const [tuitionTotalElements, setTuitionTotalElements] = useState(0);
  const [tuitionLoading, setTuitionLoading] = useState(false);
  const [tuitionError, setTuitionError] = useState(null);

  const [paymentsOffset, setPaymentsOffset] = useState(0);
  const [paymentsLimit] = useState(DEFAULT_LIMIT);
  const [paymentsRows, setPaymentsRows] = useState([]);
  const [paymentsTotalElements, setPaymentsTotalElements] = useState(0);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentsError, setPaymentsError] = useState(null);

  const [toast, setToast] = useState(null);
  const [isTuitionExporting, setIsTuitionExporting] = useState(false);
  const [isPaymentsExporting, setIsPaymentsExporting] = useState(false);
  const [isAddPaymentOpen, setIsAddPaymentOpen] = useState(false);

  const tabs = useMemo(
    () => [
      { key: 'tuition', label: tabStrings.tuition },
      { key: 'requests', label: tabStrings.requests },
      { key: 'payments', label: tabStrings.payments },
    ],
    [tabStrings.payments, tabStrings.requests, tabStrings.tuition],
  );

  const tabKeys = useMemo(() => tabs.map((tab) => tab.key), [tabs]);

  useEffect(() => {
    if (!tabKeys.includes(activeSectionKey)) {
      if (activeSectionKey !== DEFAULT_PAYMENTS_TAB_KEY) {
        onSectionChange?.(DEFAULT_PAYMENTS_TAB_KEY, { replace: true });
      }
      setActiveTab(DEFAULT_PAYMENTS_TAB_KEY);
      return;
    }

    setActiveTab(activeSectionKey);
  }, [activeSectionKey, onSectionChange, tabKeys]);

  const handleTabSelect = useCallback(
    (key) => {
      setActiveTab(key);
      onSectionChange?.(key);
    },
    [onSectionChange],
  );

  const isTuitionTab = activeTab === 'tuition';
  const isPaymentsTab = activeTab === 'payments';

  const columnLabels = tableStrings.columns;
  const currencyFormatter = useMemo(
    () => new Intl.NumberFormat(locale, { style: 'currency', currency: 'MXN' }),
    [locale],
  );
  const displayedColumns = useMemo(
    () => [
      { key: 'student', label: columnLabels.student, sortable: true, orderKey: 'student' },
      { key: 'class', label: columnLabels.class, sortable: true, orderKey: 'class' },
      { key: 'generation', label: columnLabels.generation, sortable: false },
      { key: 'scholar_level_name', label: columnLabels.scholarLevel, sortable: false },
    ],
    [columnLabels.class, columnLabels.generation, columnLabels.scholarLevel, columnLabels.student],
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

    return columns;
  }, [tuitionRows]);

  const handleSort = useCallback(
    (orderKey) => {
      if (!orderKey) {
        return;
      }

      const isSameColumn = orderBy === orderKey;

      setOrderDir((previousDir) => {
        if (isSameColumn) {
          return previousDir === 'ASC' ? 'DESC' : 'ASC';
        }

        return 'ASC';
      });

      setOrderBy((previousOrderKey) => (previousOrderKey === orderKey ? previousOrderKey : orderKey));
      setTuitionOffset(0);
    },
    [orderBy],
  );

  const renderSortIndicator = useCallback(
    (orderKey) => {
      const isActive = orderBy === orderKey;
      const direction = isActive ? orderDir : null;
      const upColor = isActive && direction !== 'DESC' ? '#4338ca' : '#c7d2fe';
      const downColor = isActive && direction === 'DESC' ? '#4338ca' : '#c7d2fe';

      return (
        <svg viewBox="0 0 12 12" aria-hidden="true">
          <path d="M6 2l3 4H3l3-4Z" fill={upColor} />
          <path d="M6 10l3-4H3l3 4Z" fill={downColor} />
        </svg>
      );
    },
    [orderBy, orderDir],
  );

  const paymentColumns = useMemo(() => {
    const sortableHeader = (label, key) => (
      <button
        type="button"
        className="payments-page__sortable"
        onClick={() => handleSort(key)}
      >
        <span>{label}</span>
        {renderSortIndicator(key)}
      </button>
    );

    const baseColumns = displayedColumns.map((column) => ({
      key: column.key,
      header: column.sortable ? sortableHeader(column.label, column.orderKey) : column.label,
    }));

    const dynamicMonths = monthColumns.map((month) => ({
      key: month,
      header: sortableHeader(month, month),
    }));

    return [...baseColumns, ...dynamicMonths];
  }, [displayedColumns, handleSort, monthColumns, renderSortIndicator]);

  const paymentsColumns = useMemo(
    () => [
      { key: 'payment_id', header: paymentsTableStrings.columns.id },
      { key: 'student', header: paymentsTableStrings.columns.student },
      { key: 'grade_group', header: paymentsTableStrings.columns.gradeGroup },
      { key: 'scholar_level_name', header: paymentsTableStrings.columns.scholarLevel },
      { key: 'pt_name', header: paymentsTableStrings.columns.concept },
      { key: 'amount', header: paymentsTableStrings.columns.amount, align: 'end' },
      { key: 'actions', header: paymentsTableStrings.columns.actions, align: 'end' },
    ],
    [paymentsTableStrings.columns],
  );

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

  const paymentPageLabel = useCallback(
    ({ page, totalPages }) => {
      const template = tableStrings.pagination?.page;
      const currentLabel = page.toLocaleString(locale);
      const totalLabel = totalPages.toLocaleString(locale);

      if (typeof template === 'string') {
        return template
          .replace('{current}', currentLabel)
          .replace('{total}', totalLabel);
      }

      return `${currentLabel} / ${totalLabel}`;
    },
    [locale, tableStrings.pagination],
  );

  const tuitionTotalPages = Math.max(1, Math.ceil(tuitionTotalElements / tuitionLimit));
  const tuitionCurrentPage = Math.floor(tuitionOffset / tuitionLimit) + 1;
  const paymentsTotalPages = Math.max(1, Math.ceil(paymentsTotalElements / paymentsLimit));
  const paymentsCurrentPage = Math.floor(paymentsOffset / paymentsLimit) + 1;

  const appliedFilters = useMemo(() => {
    const params = new URLSearchParams();

    params.set('lang', normalizedLanguage);
    params.set('offset', String(tuitionOffset));
    params.set('limit', String(tuitionLimit));
    params.set('export_all', 'false');

    if (startMonth) {
      params.set('start_date', `${startMonth}-01`);
    }

    if (endMonth) {
      params.set('end_date', `${endMonth}-30`);
    }

    if (showDebtOnly) {
      params.set('show_debt_only', 'true');
    }

    if (orderBy) {
      params.set('order_by', orderBy);
      params.set('order_dir', orderDir === 'DESC' ? 'DESC' : 'ASC');
    }

    for (const [key, value] of Object.entries(tuitionFilters)) {
      if (value === null || value === undefined) {
        continue;
      }

      const trimmed = typeof value === 'string' ? value.trim() : value;

      if (trimmed === '' || trimmed === false) {
        continue;
      }

      params.set(key, String(trimmed));
    }

    return params;
  }, [
    tuitionFilters,
    tuitionOffset,
    tuitionLimit,
    orderBy,
    orderDir,
    startMonth,
    endMonth,
    showDebtOnly,
    normalizedLanguage,
  ]);

  const paymentsQueryParams = useMemo(() => {
    const params = new URLSearchParams();

    params.set('lang', normalizedLanguage);
    params.set('offset', String(paymentsOffset));
    params.set('limit', String(paymentsLimit));
    params.set('export_all', 'false');

    for (const [key, value] of Object.entries(paymentsFilters)) {
      if (value === null || value === undefined) {
        continue;
      }

      const trimmed = typeof value === 'string' ? value.trim() : value;

      if (trimmed === '' || trimmed === false) {
        continue;
      }

      if (key === 'payment_month' && typeof trimmed === 'string') {
        params.set(key, `${trimmed}-01`);
        continue;
      }

      params.set(key, String(trimmed));
    }

    return params;
  }, [normalizedLanguage, paymentsFilters, paymentsLimit, paymentsOffset]);

  const fetchTuitionPayments = useCallback(async () => {
    if (activeTab !== 'tuition') {
      return;
    }

    setTuitionLoading(true);
    setTuitionError(null);

    try {
      const url = `${API_BASE_URL}/reports/payments/report?${appliedFilters.toString()}`;
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        handleExpiredToken(response, logout);
        throw new Error(tableStrings.error);
      }

      const payload = await response.json();
      const content = Array.isArray(payload?.content) ? payload.content : [];
      setTuitionRows(content);
      setTuitionTotalElements(Number(payload?.totalElements) || content.length || 0);
    } catch (requestError) {
      console.error('Payments fetch error', requestError);
      const fallbackMessage =
        requestError instanceof Error && requestError.message
          ? requestError.message
          : tableStrings.unknownError;
      setTuitionError(fallbackMessage);
    } finally {
      setTuitionLoading(false);
    }
  }, [activeTab, appliedFilters, logout, tableStrings.error, tableStrings.unknownError, token]);

  useEffect(() => {
    fetchTuitionPayments();
  }, [fetchTuitionPayments]);

  const fetchPaymentsList = useCallback(async () => {
    if (activeTab !== 'payments') {
      return;
    }

    setPaymentsLoading(true);
    setPaymentsError(null);

    try {
      const url = `${API_BASE_URL}/reports/payments?${paymentsQueryParams.toString()}`;
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        handleExpiredToken(response, logout);
        throw new Error(paymentsTableStrings.error);
      }

      const payload = await response.json();
      const content = Array.isArray(payload?.content) ? payload.content : [];
      setPaymentsRows(content);
      setPaymentsTotalElements(Number(payload?.totalElements) || content.length || 0);
    } catch (requestError) {
      console.error('Payments list fetch error', requestError);
      const fallbackMessage =
        requestError instanceof Error && requestError.message
          ? requestError.message
          : paymentsTableStrings.error ?? tableStrings.unknownError;
      setPaymentsError(fallbackMessage);
    } finally {
      setPaymentsLoading(false);
    }
  }, [
    activeTab,
    logout,
    paymentsQueryParams,
    paymentsTableStrings.error,
    tableStrings.unknownError,
    token,
  ]);

  useEffect(() => {
    fetchPaymentsList();
  }, [fetchPaymentsList]);

  useEffect(() => {
    if (showTuitionFilters) {
      setTuitionFiltersDraft(tuitionFilters);
    }
  }, [showTuitionFilters, tuitionFilters]);

  useEffect(() => {
    if (showPaymentsFilters) {
      setPaymentsFiltersDraft(paymentsFilters);
    }
  }, [paymentsFilters, showPaymentsFilters]);

  const fetchSchools = useCallback(async () => {
    setIsLoadingSchools(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/schools/list?lang=${normalizedLanguage}&status_filter=-1`,
        {
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        },
      );

      if (!response.ok) {
        handleExpiredToken(response, logout);
        throw new Error(errorStrings.loadSchools);
      }

      const payload = await response.json();
      const list = extractListFromPayload(payload);
      const options = list.map((item, index) => normalizeSelectOption(item, index));
      setSchoolOptions(options);
    } catch (schoolError) {
      console.error('Schools fetch error', schoolError);
      setToast({ type: 'error', message: toastStrings.loadSchoolsError });
      setSchoolOptions([]);
    } finally {
      setIsLoadingSchools(false);
    }
  }, [
    errorStrings.loadSchools,
    logout,
    normalizedLanguage,
    toastStrings.loadSchoolsError,
    token,
  ]);

  useEffect(() => {
    fetchSchools();
  }, [fetchSchools]);

  const handleFilterChange = useCallback((key, value) => {
    setTuitionFiltersDraft((previous) => ({ ...previous, [key]: value }));
  }, []);

  const handleTuitionSearchChange = useCallback((value) => {
    setTuitionFilters((previous) => ({ ...previous, student_full_name: value }));
    setTuitionFiltersDraft((previous) => ({ ...previous, student_full_name: value }));
    setTuitionOffset(0);
  }, []);

  const handleStartMonthChange = useCallback((value) => {
    setStartMonth(value);
    setTuitionOffset(0);
  }, []);

  const handleEndMonthChange = useCallback((value) => {
    setEndMonth(value);
    setTuitionOffset(0);
  }, []);

  const handleToggleDebt = useCallback(() => {
    setShowDebtOnly((previous) => !previous);
    setTuitionOffset(0);
  }, []);

  const handleToggleTuitionFilters = useCallback(() => {
    setShowTuitionFilters((previous) => !previous);
  }, []);

  const handleTogglePaymentsFilters = useCallback(() => {
    setShowPaymentsFilters((previous) => !previous);
  }, []);

  const handleOpenAddPayment = useCallback(() => {
    setIsAddPaymentOpen(true);
  }, []);

  const handleCloseAddPayment = useCallback(() => {
    setIsAddPaymentOpen(false);
  }, []);

  const handlePaymentsFilterChange = useCallback((key, value) => {
    setPaymentsFiltersDraft((previous) => ({ ...previous, [key]: value }));
  }, []);

  const handlePaymentsMonthChange = useCallback((value) => {
    setPaymentsFiltersDraft((previous) => ({ ...previous, payment_month: value }));
  }, []);

  const handlePaymentCreated = useCallback(
    (message) => {
      const feedbackMessage = message || addPaymentStrings.success;
      setToast({ type: 'success', message: feedbackMessage });

      if (paymentsOffset !== 0) {
        setPaymentsOffset(0);
      } else {
        fetchPaymentsList();
      }
    },
    [addPaymentStrings.success, fetchPaymentsList, paymentsOffset],
  );

  const handleClearTuitionFilters = useCallback(() => {
    const reset = { ...DEFAULT_TUITION_FILTERS };
    setTuitionFilters(reset);
    setTuitionFiltersDraft(reset);
    setShowDebtOnly(false);
    setStartMonth('');
    setEndMonth('');
    setOrderBy('');
    setOrderDir('ASC');
    setTuitionOffset(0);
    setShowTuitionFilters(false);
  }, []);

  const handleClearPaymentsFilters = useCallback(() => {
    const reset = { ...DEFAULT_PAYMENTS_FILTERS };
    setPaymentsFilters(reset);
    setPaymentsFiltersDraft(reset);
    setPaymentsOffset(0);
    setShowPaymentsFilters(false);
  }, []);

  const handleApplyTuitionFilters = useCallback(
    (event) => {
      event?.preventDefault?.();
      setTuitionFilters({ ...tuitionFiltersDraft });
      setTuitionOffset(0);
      setShowTuitionFilters(false);
    },
    [tuitionFiltersDraft],
  );

  const handleApplyPaymentsFilters = useCallback(
    (event) => {
      event?.preventDefault?.();
      setPaymentsFilters({ ...paymentsFiltersDraft });
      setPaymentsOffset(0);
      setShowPaymentsFilters(false);
    },
    [paymentsFiltersDraft],
  );

  const handleStudentDetailClick = useCallback(
    (row) => {
      const studentId = row?.student_id ?? row?.studentId ?? row?.student_uuid;

      if (!studentId) {
        return;
      }

      const fullName = row?.student ?? '';
      const registerId = row?.payment_reference ?? row?.register_id ?? row?.registration_id ?? '';

      onStudentDetail?.({ id: studentId, name: fullName, registerId });
    },
    [onStudentDetail],
  );

  const handleTuitionMonthClick = useCallback(
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
          className: row?.class ?? null,
          generation: row?.generation ?? null,
          scholarLevel: row?.scholar_level_name ?? null,
          monthKey,
          paymentMonth,
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

  const handlePaymentsPageChange = useCallback(
    (nextPage) => {
      const safePage = Math.min(Math.max(nextPage, 1), paymentsTotalPages);
      setPaymentsOffset((safePage - 1) * paymentsLimit);
    },
    [paymentsLimit, paymentsTotalPages],
  );

  const buildCsvRow = useCallback(
    (row, headerKeys) =>
      headerKeys
        .map((key) => {
          if (key === 'student_combined') {
            const studentName = row?.student ?? '';
            const paymentReference = row?.payment_reference ?? '';
            const combined = paymentReference
              ? `${studentName} (${csvStrings.studentIdLabel}: ${paymentReference})`
              : studentName;
            return `"${String(combined ?? '').replace(/"/g, '""')}"`;
          }

          const value = row?.[key] ?? '';
          const normalized =
            value === null || value === undefined || value === '' ? '' : String(value);
          return `"${normalized.replace(/"/g, '""')}"`;
        })
        .join(','),
    [csvStrings.studentIdLabel],
  );

  const handleTuitionExport = useCallback(async () => {
    setIsTuitionExporting(true);

    try {
      const params = new URLSearchParams(appliedFilters.toString());
      params.set('offset', '0');
      params.set('export_all', 'true');

      const url = `${API_BASE_URL}/reports/payments/report?${params.toString()}`;
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        handleExpiredToken(response, logout);
        throw new Error(errorStrings.export);
      }

      const payload = await response.json();
      const content = Array.isArray(payload?.content) ? payload.content : [];

      if (content.length === 0) {
        setToast({ type: 'warning', message: toastStrings.exportEmpty });
        return;
      }

      const monthKeys = [];
      for (const row of content) {
        if (!row || typeof row !== 'object') {
          continue;
        }

        for (const key of Object.keys(row)) {
          if (MONTH_KEY_REGEX.test(key) && !monthKeys.includes(key)) {
            monthKeys.push(key);
          }
        }
      }

      const headerKeys = ['student_combined', 'class', 'generation', 'scholar_level_name', ...monthKeys];
      const headerLabels = [
        csvStrings.headers.student,
        csvStrings.headers.class,
        csvStrings.headers.generation,
        csvStrings.headers.scholarLevel,
        ...monthKeys,
      ];

      const csvRows = [
        headerLabels.map((label) => `"${label.replace(/"/g, '""')}"`).join(','),
        ...content.map((row) => buildCsvRow(row, headerKeys)),
      ];

      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${csvStrings.fileNamePrefix}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);

      setToast({ type: 'success', message: toastStrings.exportSuccess });
    } catch (exportError) {
      console.error('Export error', exportError);
      const errorMessage =
        exportError instanceof Error && exportError.message
          ? exportError.message
          : toastStrings.exportError;
      setToast({ type: 'error', message: errorMessage });
    } finally {
      setIsTuitionExporting(false);
    }
  }, [
    appliedFilters,
    buildCsvRow,
    csvStrings,
    errorStrings.export,
    logout,
    toastStrings.exportEmpty,
    toastStrings.exportError,
    toastStrings.exportSuccess,
    token,
  ]);

  const handlePaymentsExport = useCallback(async () => {
    setIsPaymentsExporting(true);

    try {
      const params = new URLSearchParams(paymentsQueryParams.toString());
      params.set('offset', '0');
      params.set('export_all', 'true');

      const url = `${API_BASE_URL}/reports/payments?${params.toString()}`;
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        handleExpiredToken(response, logout);
        throw new Error(errorStrings.export);
      }

      const payload = await response.json();
      const content = Array.isArray(payload?.content) ? payload.content : [];

      if (content.length === 0) {
        setToast({ type: 'warning', message: toastStrings.exportEmpty });
        return;
      }

      const escapeValue = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
      const headerLabels = [
        paymentsTableStrings.columns.id,
        paymentsTableStrings.columns.student,
        tableStrings.studentIdLabel,
        paymentsTableStrings.columns.gradeGroup,
        paymentsTableStrings.columns.scholarLevel,
        paymentsTableStrings.columns.concept,
        paymentsTableStrings.columns.amount,
      ];
      const headerRow = headerLabels.map(escapeValue).join(',');
      const csvRows = content.map((row) => {
        const amountValue =
          typeof row?.amount === 'number'
            ? currencyFormatter.format(row.amount)
            : row?.amount ?? '';

        return [
          escapeValue(row?.payment_id),
          escapeValue(row?.student_full_name ?? row?.student),
          escapeValue(row?.payment_reference),
          escapeValue(row?.grade_group),
          escapeValue(row?.scholar_level_name),
          escapeValue(row?.pt_name),
          escapeValue(amountValue),
        ].join(',');
      });

      const csvContent = [headerRow, ...csvRows].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${csvStrings.fileNamePrefix}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);

      setToast({ type: 'success', message: toastStrings.exportSuccess });
    } catch (exportError) {
      console.error('Payments export error', exportError);
      const errorMessage =
        exportError instanceof Error && exportError.message
          ? exportError.message
          : toastStrings.exportError;
      setToast({ type: 'error', message: errorMessage });
    } finally {
      setIsPaymentsExporting(false);
    }
  }, [
    currencyFormatter,
    csvStrings.fileNamePrefix,
    errorStrings.export,
    logout,
    paymentsQueryParams,
    paymentsTableStrings.columns,
    tableStrings.studentIdLabel,
    toastStrings.exportEmpty,
    toastStrings.exportError,
    toastStrings.exportSuccess,
    token,
  ]);

  useEffect(() => {
    if (!isTuitionTab && showTuitionFilters) {
      setShowTuitionFilters(false);
    }
  }, [isTuitionTab, showTuitionFilters]);

  useEffect(() => {
    if (activeTab !== 'payments' && showPaymentsFilters) {
      setShowPaymentsFilters(false);
    }
  }, [activeTab, showPaymentsFilters]);

  useEffect(() => {
    if (activeTab !== 'payments' && isAddPaymentOpen) {
      setIsAddPaymentOpen(false);
    }
  }, [activeTab, isAddPaymentOpen]);

  const DebtIcon = (
    <svg viewBox="0 0 20 20" aria-hidden="true" width="16" height="16">
      <path d="M4 5h12v2H4zm0 4h8v2H4zm0 4h5v2H4z" fill="currentColor" />
    </svg>
  );

  const handlePaymentDetailNavigation = useCallback(
    (paymentId) => {
      if (paymentId == null || paymentId === '') {
        return;
      }

      const idValue = String(paymentId);

      if (onPaymentDetail) {
        onPaymentDetail(idValue);
        return;
      }

      if (typeof window !== 'undefined') {
        const fallbackUrl = `${paymentDetailBasePath}/${encodeURIComponent(idValue)}`;
        window.location.assign(fallbackUrl);
      }
    },
    [onPaymentDetail, paymentDetailBasePath],
  );

  if (isPaymentDetailRoute) {
    return (
      <div className="page">
        <GlobalToast alert={toast} onClose={() => setToast(null)} />
        <header className="page__header">
          <div>
            <p>{strings.header?.subtitle ?? description}</p>
          </div>
        </header>
        <div className="page__layout">
          <section className="page__content">
            <PaymentDetailPage
              paymentId={paymentDetailId}
              language={normalizedLanguage}
              strings={strings.detail ?? {}}
              onBreadcrumbChange={onPaymentBreadcrumbChange}
            />
          </section>
        </div>
      </div>
    );
  }

  const tuitionFiltersCount = useMemo(() => {
    return Object.entries(tuitionFilters).reduce((count, [, value]) => {
      if (value === null || value === undefined) {
        return count;
      }

      const normalized = typeof value === 'string' ? value.trim() : value;

      if (normalized === '' || normalized === false) {
        return count;
      }

      return count + 1;
    }, 0);
  }, [tuitionFilters]);

  const paymentsFiltersCount = useMemo(() => {
    return Object.entries(paymentsFilters).reduce((count, [, value]) => {
      if (value === null || value === undefined) {
        return count;
      }

      const normalized = typeof value === 'string' ? value.trim() : value;

      if (normalized === '' || normalized === false) {
        return count;
      }

      return count + 1;
    }, 0);
  }, [paymentsFilters]);

  return (
    <div className="page">
      <GlobalToast alert={toast} onClose={() => setToast(null)} />

      <header className="page__header">
        <div>
          <p>{strings.header?.subtitle ?? description}</p>
        </div>
      </header>

      <Tabs
        className="tabs-row"
        tabs={tabs}
        activeKey={activeTab}
        onSelect={handleTabSelect}
        navClassName="tabs nav-pills flex-wrap gap-2"
        actionsClassName="payments-page__actions"
        renderActions={({ activeKey }) =>
          activeKey === 'tuition' ? (
            <>
              <FilterButton
                type="button"
                onClick={handleToggleTuitionFilters}
                aria-expanded={showTuitionFilters}
                aria-controls="payments-page-filters"
                className="rounded-pill d-inline-flex align-items-center gap-2"
              >
                <span className="fw-semibold">{actionStrings.filter}</span>
                {tuitionFiltersCount > 0 && (
                  <span className="badge text-bg-primary rounded-pill">{tuitionFiltersCount}</span>
                )}
              </FilterButton>
              <ActionButton
                variant="ghost"
                onClick={handleToggleDebt}
                icon={DebtIcon}
                className={`payments-page__debt-button ${showDebtOnly ? 'is-active' : ''}`}
              >
                {showDebtOnly ? debtToggleStrings.debtActive : debtToggleStrings.debtInactive}
              </ActionButton>
              <ExportButton type="button" onClick={handleTuitionExport} disabled={isTuitionExporting}>
                {isTuitionExporting ? actionStrings.exporting : actionStrings.export}
              </ExportButton>
            </>
          ) : activeKey === 'payments' ? (
            <>
              <ActionButton type="button" onClick={handleOpenAddPayment}>
                {actionStrings.add}
              </ActionButton>
              <FilterButton
                type="button"
                onClick={handleTogglePaymentsFilters}
                aria-expanded={showPaymentsFilters}
                aria-controls="payments-table-filters"
                className="rounded-pill d-inline-flex align-items-center gap-2"
              >
                <span className="fw-semibold">{actionStrings.filter}</span>
                {paymentsFiltersCount > 0 && (
                  <span className="badge text-bg-primary rounded-pill">{paymentsFiltersCount}</span>
                )}
              </FilterButton>
              <ActionButton
                type="button"
                variant="upload"
                disabled
                title={paymentsComingSoonLabel}
              >
                {actionStrings.bulkUpload}
              </ActionButton>
              <ExportButton
                type="button"
                onClick={handlePaymentsExport}
                disabled={isPaymentsExporting}
              >
                {isPaymentsExporting ? actionStrings.exporting : actionStrings.export}
              </ExportButton>
            </>
          ) : null
        }
      />

      {isTuitionTab ? (
        <UiCard className="card-view">
          <div className="payments-page__toolbar">
            <SearchInput
              value={tuitionFilters.student_full_name}
              onChange={(event) => handleTuitionSearchChange(event.target.value)}
              placeholder={searchPlaceholder}
              className="payments-page__search-wrapper"
              wrapperProps={{ role: 'search' }}
            />
            <div className="payments-page__toolbar-controls">
              <label className="payments-page__month-input">
                {dateRangeStrings.start}
                <input
                  type="month"
                  value={startMonth}
                  onChange={(event) => handleStartMonthChange(event.target.value)}
                  max={endMonth || undefined}
                />
              </label>
              <label className="payments-page__month-input">
                {dateRangeStrings.end}
                <input
                  type="month"
                  value={endMonth}
                  onChange={(event) => handleEndMonthChange(event.target.value)}
                  min={startMonth || undefined}
                />
              </label>
            </div>
          </div>
        </UiCard>
      ) : null}

      <div className="page__layout">
        <section className="page__content">
          {isTuitionTab ? (
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
                  const canNavigateToStudent = Boolean(studentId);
                  const studentIdLabel = tableStrings.studentIdLabel;
                  const studentName = row.student ?? tableStrings.studentFallback;
                  const studentMetaValue = row.payment_reference ?? '';

                  return (
                    <tr key={rowKey}>
                      <td
                        data-title={tableStrings.columns.student}
                      >
                        <StudentInfo
                          name={row.student}
                          fallbackName={tableStrings.studentFallback}
                          metaLabel={studentMetaValue ? studentIdLabel : undefined}
                          metaValue={studentMetaValue}
                          onClick={() => handleStudentDetailClick(row)}
                          disabled={!canNavigateToStudent}
                          nameButtonProps={{ 'aria-label': studentName }}
                        />
                      </td>
                      <td data-title={tableStrings.columns.class}>{row.class ?? '--'}</td>
                      <td data-title={tableStrings.columns.generation}>{row.generation ?? '--'}</td>
                      <td data-title={tableStrings.columns.scholarLevel}>{row.scholar_level_name ?? '--'}</td>
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
                                onClick={() => handleTuitionMonthClick(row, month, details)}
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
                emptyMessage={tableStrings.empty}
                pagination={{
                  currentPage: tuitionCurrentPage,
                  pageSize: tuitionLimit,
                  totalItems: tuitionTotalElements,
                  onPageChange: handlePageChange,
                  previousLabel: tableStrings.pagination.previous ?? '←',
                  nextLabel: tableStrings.pagination.next ?? '→',
                  summary: paymentSummary,
                  pageLabel: paymentPageLabel,
                }}
              />
            </UiCard>
          ) : isPaymentsTab ? (
            <UiCard className="page__table-card">
              <GlobalTable
                className="page__table-wrapper"
                tableClassName="page__table mb-0"
                columns={paymentsColumns}
                data={paymentsRows}
                getRowId={(row, index) =>
                  row?.payment_id ?? row?.paymentId ?? row?.payment_reference ?? `payment-${index}`
                }
                renderRow={(row, index) => {
                  const rowKey =
                    row?.payment_id ?? row?.paymentId ?? row?.payment_reference ?? `payment-${index}`;
                  const studentName = row?.student_full_name ?? row?.student ?? '';
                  const studentMeta = row?.payment_reference ?? '';
                  const amountRaw = row?.amount;
                  const formattedAmount =
                    typeof amountRaw === 'number'
                      ? currencyFormatter.format(amountRaw)
                      : amountRaw != null && amountRaw !== ''
                      ? String(amountRaw)
                      : '';
                  const paymentIdValue = row?.payment_id ?? row?.paymentId ?? null;
                  const paymentIdLabel = paymentIdValue != null ? String(paymentIdValue) : null;
                  const hasValidPaymentId = !(
                    paymentIdLabel == null ||
                    paymentIdLabel.trim() === '' ||
                    paymentIdLabel === 'null' ||
                    paymentIdLabel === 'undefined'
                  );
                  const isDetailDisabled = !hasValidPaymentId;
                  const detailButtonLabel = hasValidPaymentId
                    ? `${paymentDetailButtonLabel} ${paymentIdLabel}`
                    : paymentDetailButtonLabel;

                  return (
                    <tr key={rowKey}>
                      <td data-title={paymentsTableStrings.columns.id} className="text-center">
                        {row?.payment_id ?? '--'}
                      </td>
                      <td data-title={paymentsTableStrings.columns.student}>
                        <StudentInfo
                          name={studentName}
                          fallbackName={tableStrings.studentFallback}
                          metaLabel={studentMeta ? tableStrings.studentIdLabel : undefined}
                          metaValue={studentMeta}
                        />
                      </td>
                      <td data-title={paymentsTableStrings.columns.gradeGroup}>
                        {row?.grade_group ?? '--'}
                      </td>
                      <td data-title={paymentsTableStrings.columns.scholarLevel}>
                        {row?.scholar_level_name ?? '--'}
                      </td>
                      <td data-title={paymentsTableStrings.columns.concept}>{row?.pt_name ?? '--'}</td>
                      <td data-title={paymentsTableStrings.columns.amount} className="text-end">
                        {formattedAmount ? (
                          formattedAmount
                        ) : (
                          <span className="ui-table__empty-indicator">--</span>
                        )}
                      </td>
                      <td data-title={paymentsTableStrings.columns.actions} className="text-end">
                        <ActionButton
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => handlePaymentDetailNavigation(paymentIdValue)}
                          disabled={isDetailDisabled}
                          aria-label={detailButtonLabel}
                          title={detailButtonLabel}
                        >
                          {paymentDetailButtonLabel}
                        </ActionButton>
                      </td>
                    </tr>
                  );
                }}
                loading={paymentsLoading}
                loadingMessage={paymentsTableStrings.loading}
                error={paymentsError || null}
                emptyMessage={paymentsTableStrings.empty}
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
            </UiCard>
          ) : (
            <div className="page__empty-state">
              {placeholderMessage}
            </div>
          )}
        </section>
      </div>

      <AddPaymentModal
        isOpen={isAddPaymentOpen}
        onClose={handleCloseAddPayment}
        token={token}
        logout={logout}
        language={normalizedLanguage}
        onSuccess={handlePaymentCreated}
        strings={addPaymentStrings}
      />

      <SidebarModal
        isOpen={showTuitionFilters}
        onClose={() => setShowTuitionFilters(false)}
        title={tuitionFilterStrings.title}
        description={tuitionFilterStrings.subtitle}
        id="payments-page-filters"
        footer={
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
            <ActionButton variant="text" onClick={handleClearTuitionFilters} type="button">
              {tuitionFilterStrings.reset}
            </ActionButton>
            <ActionButton type="submit" form="tuition-filters-form">
              {actionStrings.filter}
            </ActionButton>
          </div>
        }
      >
        <form id="tuition-filters-form" className="row g-3" onSubmit={handleApplyTuitionFilters}>
          <div className="col-sm-12">
            <label htmlFor="filter-student" className="form-label">
              {tuitionFilterStrings.fields.student.label}
            </label>
            <input
              id="filter-student"
              type="text"
              className="form-control"
              value={tuitionFiltersDraft.student_full_name}
              onChange={(event) => handleFilterChange('student_full_name', event.target.value)}
              placeholder={tuitionFilterStrings.fields.student.placeholder}
            />
          </div>
          <div className="col-sm-12">
            <label htmlFor="filter-reference" className="form-label">
              {tuitionFilterStrings.fields.reference.label}
            </label>
            <input
              id="filter-reference"
              type="text"
              className="form-control"
              value={tuitionFiltersDraft.payment_reference}
              onChange={(event) => handleFilterChange('payment_reference', event.target.value)}
              placeholder={tuitionFilterStrings.fields.reference.placeholder}
            />
          </div>
          <div className="col-sm-12">
            <label htmlFor="filter-generation" className="form-label">
              {tuitionFilterStrings.fields.generation.label}
            </label>
            <input
              id="filter-generation"
              type="text"
              className="form-control"
              value={tuitionFiltersDraft.generation}
              onChange={(event) => handleFilterChange('generation', event.target.value)}
              placeholder={tuitionFilterStrings.fields.generation.placeholder}
            />
          </div>
          <div className="col-sm-12">
            <label htmlFor="filter-grade" className="form-label">
              {tuitionFilterStrings.fields.gradeGroup.label}
            </label>
            <input
              id="filter-grade"
              type="text"
              className="form-control"
              value={tuitionFiltersDraft.grade_group}
              onChange={(event) => handleFilterChange('grade_group', event.target.value)}
              placeholder={tuitionFilterStrings.fields.gradeGroup.placeholder}
            />
          </div>
          <div className="col-sm-12">
            <label htmlFor="filter-scholar" className="form-label">
              {tuitionFilterStrings.fields.scholarLevel.label}
            </label>
            <input
              id="filter-scholar"
              type="text"
              className="form-control"
              value={tuitionFiltersDraft.scholar_level}
              onChange={(event) => handleFilterChange('scholar_level', event.target.value)}
              placeholder={tuitionFilterStrings.fields.scholarLevel.placeholder}
            />
          </div>
          <div className="col-sm-12">
            <label htmlFor="filter-school" className="form-label">
              {tuitionFilterStrings.fields.school.label}
            </label>
            <select
              id="filter-school"
              className="form-select"
              value={tuitionFiltersDraft.school_id}
              onChange={(event) => handleFilterChange('school_id', event.target.value)}
              disabled={isLoadingSchools}
            >
              <option value="">{tuitionFilterStrings.schoolOptions.all}</option>
              {schoolOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="col-sm-12">
            <div className="form-check">
              <input
                id="filter-active-groups"
                type="checkbox"
                className="form-check-input"
                checked={tuitionFiltersDraft.group_status === 'true'}
                onChange={(event) => handleFilterChange('group_status', event.target.checked ? 'true' : '')}
              />
              <label className="form-check-label" htmlFor="filter-active-groups">
                {tuitionFilterStrings.toggles.activeGroups}
              </label>
            </div>
          </div>
          <div className="col-sm-12">
            <div className="form-check">
              <input
                id="filter-active-students"
                type="checkbox"
                className="form-check-input"
                checked={tuitionFiltersDraft.user_status === 'true'}
                onChange={(event) => handleFilterChange('user_status', event.target.checked ? 'true' : '')}
              />
              <label className="form-check-label" htmlFor="filter-active-students">
                {tuitionFilterStrings.toggles.activeStudents}
              </label>
            </div>
          </div>
        </form>
      </SidebarModal>

      <SidebarModal
        isOpen={showPaymentsFilters}
        onClose={() => setShowPaymentsFilters(false)}
        title={paymentsFilterStrings.title}
        description={paymentsFilterStrings.subtitle}
        id="payments-table-filters"
        footer={
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
            <ActionButton variant="text" onClick={handleClearPaymentsFilters} type="button">
              {paymentsFilterStrings.reset}
            </ActionButton>
            <ActionButton type="submit" form="payments-filters-form">
              {actionStrings.filter}
            </ActionButton>
          </div>
        }
      >
        <form id="payments-filters-form" className="row g-3" onSubmit={handleApplyPaymentsFilters}>
          <div className="col-sm-12">
            <label htmlFor="payments-filter-id" className="form-label">
              {paymentsFilterStrings.fields.paymentId.label}
            </label>
            <input
              id="payments-filter-id"
              type="text"
              className="form-control"
              value={paymentsFiltersDraft.payment_id}
              onChange={(event) => handlePaymentsFilterChange('payment_id', event.target.value)}
              placeholder={paymentsFilterStrings.fields.paymentId.placeholder}
            />
          </div>
          <div className="col-sm-12">
            <label htmlFor="payments-filter-request" className="form-label">
              {paymentsFilterStrings.fields.paymentRequestId.label}
            </label>
            <input
              id="payments-filter-request"
              type="text"
              className="form-control"
              value={paymentsFiltersDraft.payment_request_id}
              onChange={(event) =>
                handlePaymentsFilterChange('payment_request_id', event.target.value)
              }
              placeholder={paymentsFilterStrings.fields.paymentRequestId.placeholder}
            />
          </div>
          <div className="col-sm-12">
            <label htmlFor="payments-filter-student" className="form-label">
              {paymentsFilterStrings.fields.student.label}
            </label>
            <input
              id="payments-filter-student"
              type="text"
              className="form-control"
              value={paymentsFiltersDraft.student_full_name}
              onChange={(event) =>
                handlePaymentsFilterChange('student_full_name', event.target.value)
              }
              placeholder={paymentsFilterStrings.fields.student.placeholder}
            />
          </div>
          <div className="col-sm-12">
            <label htmlFor="payments-filter-reference" className="form-label">
              {paymentsFilterStrings.fields.reference.label}
            </label>
            <input
              id="payments-filter-reference"
              type="text"
              className="form-control"
              value={paymentsFiltersDraft.payment_reference}
              onChange={(event) =>
                handlePaymentsFilterChange('payment_reference', event.target.value)
              }
              placeholder={paymentsFilterStrings.fields.reference.placeholder}
            />
          </div>
          <div className="col-sm-12">
            <label htmlFor="payments-filter-generation" className="form-label">
              {paymentsFilterStrings.fields.generation.label}
            </label>
            <input
              id="payments-filter-generation"
              type="text"
              className="form-control"
              value={paymentsFiltersDraft.generation}
              onChange={(event) => handlePaymentsFilterChange('generation', event.target.value)}
              placeholder={paymentsFilterStrings.fields.generation.placeholder}
            />
          </div>
          <div className="col-sm-12">
            <label htmlFor="payments-filter-grade" className="form-label">
              {paymentsFilterStrings.fields.gradeGroup.label}
            </label>
            <input
              id="payments-filter-grade"
              type="text"
              className="form-control"
              value={paymentsFiltersDraft.grade_group}
              onChange={(event) => handlePaymentsFilterChange('grade_group', event.target.value)}
              placeholder={paymentsFilterStrings.fields.gradeGroup.placeholder}
            />
          </div>
          <div className="col-sm-12">
            <label htmlFor="payments-filter-concept" className="form-label">
              {paymentsFilterStrings.fields.concept.label}
            </label>
            <input
              id="payments-filter-concept"
              type="text"
              className="form-control"
              value={paymentsFiltersDraft.pt_name}
              onChange={(event) => handlePaymentsFilterChange('pt_name', event.target.value)}
              placeholder={paymentsFilterStrings.fields.concept.placeholder}
            />
          </div>
          <div className="col-sm-12">
            <label htmlFor="payments-filter-scholar" className="form-label">
              {paymentsFilterStrings.fields.scholarLevel.label}
            </label>
            <input
              id="payments-filter-scholar"
              type="text"
              className="form-control"
              value={paymentsFiltersDraft.scholar_level_name}
              onChange={(event) =>
                handlePaymentsFilterChange('scholar_level_name', event.target.value)
              }
              placeholder={paymentsFilterStrings.fields.scholarLevel.placeholder}
            />
          </div>
          <div className="col-sm-12">
            <label htmlFor="payments-filter-month" className="form-label">
              {paymentsFilterStrings.fields.month.label}
            </label>
            <input
              id="payments-filter-month"
              type="month"
              className="form-control"
              value={paymentsFiltersDraft.payment_month}
              onChange={(event) => handlePaymentsMonthChange(event.target.value)}
            />
          </div>
        </form>
      </SidebarModal>
    </div>
  );
};

export default PaymentsFinancePage;
