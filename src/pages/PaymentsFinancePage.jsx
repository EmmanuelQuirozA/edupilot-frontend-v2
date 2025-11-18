import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import GlobalToast from '../components/GlobalToast.jsx';
import ActionButton from '../components/ui/ActionButton.jsx';
import ExportButton from '../components/ui/buttons/ExportButton.jsx';
import FilterButton from '../components/ui/buttons/FilterButton.jsx';
import UiCard from '../components/ui/UiCard.jsx';
import Tabs from '../components/ui/Tabs.jsx';
import SearchInput from '../components/ui/SearchInput.jsx';
import GlobalTable from '../components/ui/GlobalTable.jsx';
import SidebarModal from '../components/ui/SidebarModal.jsx';
import StudentTableCell from '../components/ui/StudentTableCell.jsx';
import AddPaymentModal from '../components/payments/AddPaymentModal.jsx';
import AddPaymentRequestModal from '../components/payments/AddPaymentRequestModal.jsx';
import SchedulePaymentRequestModal from '../components/payments/SchedulePaymentRequestModal.jsx';
import { useModal } from '../components/modal/useModal';
import { API_BASE_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import { handleExpiredToken } from '../utils/auth';
import PaymentDetailPage from './PaymentDetailPage.jsx';
import PaymentRequestDetailPage from './PaymentRequestDetailPage.jsx';
import PaymentRequestScheduleDetailPage from './PaymentRequestScheduleDetailPage.jsx';
import PaymentRequestResultPage, {
  PAYMENT_REQUEST_RESULT_STORAGE_KEY,
  extractPaymentRequestResultPayload,
} from './PaymentRequestResultPage.jsx';
import './PaymentsFinancePage.css';

const DEFAULT_LIMIT = 10;
const MONTH_KEY_REGEX = /^[A-Za-z]{3}-\d{2}$/;
const DEFAULT_PAYMENTS_TAB_KEY = 'tuition';
const REQUESTS_VIEW_KEYS = { history: 'history', scheduled: 'scheduled' };

const getSwalInstance = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  const { Swal } = window;

  if (Swal && typeof Swal.fire === 'function') {
    return Swal;
  }

  return null;
};

const parseResultCount = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') {
      return null;
    }

    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
};

const normalizeResultEntries = (entries) => {
  if (!entries) {
    return [];
  }

  if (Array.isArray(entries)) {
    return entries;
  }

  if (typeof entries === 'object') {
    return Object.values(entries);
  }

  return [];
};

const summarizePaymentRequestResult = (result) => {
  const payload = extractPaymentRequestResultPayload(result);

  if (!payload || typeof payload !== 'object') {
    return { created: 0, duplicates: 0, massUpload: '' };
  }

  const createdEntries = normalizeResultEntries(payload.created);
  const duplicateEntries = normalizeResultEntries(payload.duplicates);

  const createdCount = parseResultCount(payload.created_count);
  const duplicateCount = parseResultCount(payload.duplicate_count);
  const massUploadValue = payload.mass_upload;

  return {
    created: createdCount ?? createdEntries.length ?? 0,
    duplicates: duplicateCount ?? duplicateEntries.length ?? 0,
    massUpload:
      massUploadValue !== undefined && massUploadValue !== null && String(massUploadValue).trim() !== ''
        ? String(massUploadValue).trim()
        : '',
  };
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

const DEFAULT_PAYMENT_REQUEST_FILTERS = {
  payment_request_id: '',
  pt_name: '',
  payment_reference: '',
  student_full_name: '',
  grade_group: '',
  ps_pr_name: '',
};

const DEFAULT_PAYMENT_RECURRENCE_FILTERS = {
  global_search: '',
  rule_name: '',
  school_id: '',
  group_id: '',
  student_id: '',
  due_start: '',
  due_end: '',
  active: '',
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
    addRequest: 'Crear Nueva Solicitud',
    addRequestMenu: {
      single: {
        title: 'Solicitud Única',
        description: 'Un cobro específico para uno o más alumnos',
      },
      scheduled: {
        title: 'Solicitud Programada',
        description: 'Un cobro recurrente (mes, año, etc).',
      },
    },
    scheduleRecurrenceComingSoon: 'Muy pronto podrás programar recurrencias.',
    filterRecurrences: 'Filtrar recurrencias',
    exportRecurrences: 'Exportar recurrencias',
    viewRequestResult: 'Ver detalle',
    viewScheduledRequestDetail: 'Ver solicitud programada',
    bulkUpload: 'Carga masiva',
    bulkUploadTooltip: 'Muy pronto podrás gestionar tus pagos desde aquí.',
    export: 'Exportar CSV',
    exporting: 'Exportando…',
  },
  requestsViews: {
    history: 'Historial de solicitudes',
    scheduled: 'Programaciones',
  },
  search: {
    placeholder: 'Buscar alumno por nombre',
  },
  dateRange: {
    start: 'Fecha inicio',
    end: 'Fecha fin',
  },
  requestsTable: {
    columns: {
      id: 'ID',
      student: 'Alumno',
      gradeGroup: 'Grado y grupo',
      scholarLevel: 'Nivel académico',
      concept: 'Concepto',
      amount: 'Monto solicitado',
      status: 'Estatus',
      dueDate: 'Fecha límite',
      actions: 'Acciones',
    },
    loading: 'Cargando solicitudes de pago...',
    empty: 'No se encontraron solicitudes registradas.',
    error: 'No fue posible cargar las solicitudes de pago.',
  },
  requestsRecurrencesTable: {
    columns: {
      id: 'ID',
      ruleName: 'Regla',
      concept: 'Concepto',
      recurrenceType: 'Tipo de recurrencia',
      appliesTo: 'Aplica a',
      amount: 'Monto programado',
      nextExecutionDate: 'Próxima ejecución',
      active: 'Activa',
      actions: 'Acciones',
    },
    loading: 'Cargando programaciones...',
    empty: 'No se encontraron programaciones registradas.',
    error: 'No fue posible cargar las programaciones de solicitudes.',
    activeYes: 'Sí',
    activeNo: 'No',
    viewDetail: 'Ver detalle',
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
  requestsFilters: {
    title: 'Filtros de solicitudes',
    reset: 'Borrar filtros',
    closeAria: 'Cerrar filtros',
    fields: {
      paymentRequestId: { label: 'ID de solicitud', placeholder: 'Ej. 257' },
      student: { label: 'Nombre del alumno', placeholder: 'Ej. EMMA PONCE' },
      reference: { label: 'Matrícula', placeholder: 'Ej. 1376' },
      gradeGroup: { label: 'Grado y grupo', placeholder: 'Ej. 4-A' },
      concept: { label: 'Concepto', placeholder: 'Ej. Colegiatura' },
      status: { label: 'Estatus', placeholder: 'Ej. Programado' },
    },
  },
  requestsRecurrencesFilters: {
    title: 'Filtros de programaciones',
    reset: 'Borrar filtros',
    closeAria: 'Cerrar filtros',
    fields: {
      globalSearch: {
        label: 'Búsqueda global',
        placeholder: 'Buscar por nombre, matrícula o nombre de regla',
      },
      ruleName: { label: 'Nombre de la regla', placeholder: 'Ej. Colegiatura mensual' },
      schoolId: { label: 'ID de escuela', placeholder: 'Ej. 125' },
      groupId: { label: 'ID de grupo', placeholder: 'Ej. 87' },
      studentId: { label: 'ID de alumno', placeholder: 'Ej. 1318' },
      dueStart: { label: 'Vencimiento inicial' },
      dueEnd: { label: 'Vencimiento final' },
      active: { label: 'Estado' },
    },
    activeOptions: {
      all: 'Todas',
      active: 'Activas',
      inactive: 'Inactivas',
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
  addPaymentRequest: {
    title: 'Agregar solicitud de pago',
    description: 'Crea solicitudes de pago para tus estudiantes.',
    scopeLabel: 'Aplicar a',
    scopeOptions: {
      school: 'Toda la escuela',
      group: 'Grupo',
      student: 'Alumno',
    },
    schoolLabel: 'Escuela',
    schoolPlaceholder: 'Selecciona una escuela',
    groupLabel: 'Grupo',
    groupPlaceholder: 'Selecciona un grupo',
    studentLabel: 'Alumno',
    studentPlaceholder: 'Selecciona un alumno',
    conceptLabel: 'Concepto de pago',
    conceptPlaceholder: 'Selecciona un concepto',
    amountLabel: 'Monto solicitado',
    dueDateLabel: 'Fecha límite de pago',
    commentsLabel: 'Comentarios',
    lateFeeLabel: 'Recargo',
    feeTypeLabel: 'Tipo de recargo',
    feeTypeOptions: {
      currency: '$',
      percentage: '%',
    },
    frequencyLabel: 'Frecuencia de recargo',
    paymentMonthLabel: 'Mes de pago',
    partialPaymentLabel: 'Permitir pago parcial',
    partialPaymentOptions: {
      true: 'Sí',
      false: 'No',
    },
    cancel: 'Cancelar',
    submit: 'Crear solicitudes',
    submitting: 'Creando…',
    success: 'Solicitudes de pago creadas correctamente.',
    error: 'No fue posible crear las solicitudes de pago.',
    requiredField: 'Completa los campos obligatorios.',
  },
  addScheduledPaymentRequest: {
    title: 'Programar solicitud de pago',
    description: 'Configura un cobro recurrente para tus estudiantes.',
    scopeLabel: 'Aplicar a',
    scopeOptions: {
      school: 'Toda la escuela',
      group: 'Grupo',
      student: 'Alumno',
    },
    schoolLabel: 'Escuela',
    schoolPlaceholder: 'Selecciona una escuela',
    groupLabel: 'Grupo',
    groupPlaceholder: 'Selecciona un grupo',
    studentLabel: 'Alumno',
    studentPlaceholder: 'Selecciona un alumno',
    ruleNameEsLabel: 'Nombre (ES)',
    ruleNameEnLabel: 'Nombre (EN)',
    conceptLabel: 'Concepto de pago',
    conceptPlaceholder: 'Selecciona un concepto',
    amountLabel: 'Monto',
    feeTypeLabel: 'Tipo de recargo',
    feeTypeOptions: {
      currency: '$',
      percentage: '%',
    },
    lateFeeLabel: 'Recargo',
    lateFeeFrequencyLabel: 'Frecuencia de recargo',
    paymentWindowLabel: 'Ventana de pago',
    periodLabel: 'Periodo de tiempo',
    periodPlaceholder: 'Selecciona un periodo',
    intervalLabel: 'Intervalo',
    startDateLabel: 'Fecha inicial',
    endDateLabel: 'Fecha final',
    nextExecutionDateLabel: 'Próxima ejecución',
    commentsLabel: 'Comentarios',
    cancel: 'Cancelar',
    submit: 'Crear programación',
    submitting: 'Creando…',
    success: 'Solicitud programada creada correctamente.',
    error: 'No fue posible crear la solicitud programada.',
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
  requestsDetail: {
    breadcrumbFallback: 'Detalle de solicitud',
    back: 'Volver a solicitudes',
    loading: 'Cargando solicitud de pago...',
    error: 'No fue posible cargar la solicitud de pago.',
    retry: 'Reintentar',
    generalTitle: 'Información de la solicitud',
    studentTitle: 'Información del alumno',
    fields: {
      id: 'ID de solicitud',
      concept: 'Concepto',
      amount: 'Monto solicitado',
      status: 'Estatus',
      dueDate: 'Fecha límite de pago',
      createdAt: 'Fecha de creación',
      level: 'Nivel académico',
      generation: 'Generación',
      gradeGroup: 'Grado y grupo',
      lateFee: 'Recargo',
      frequency: 'Frecuencia de recargo',
      feeType: 'Tipo de recargo',
      paymentMonth: 'Mes de pago',
    },
    open: 'Ver detalle',
    viewStudent: 'Ver detalle del alumno',
  },
  requestsResult: {
    title: 'Resultado de creación de solicitudes',
    description: 'Consulta el detalle de las solicitudes creadas y las duplicadas.',
    empty: 'No hay información disponible para mostrar.',
    back: 'Volver a solicitudes',
    download: 'Descargar CSV',
    createdTitle: 'Solicitudes creadas',
    duplicatesTitle: 'Solicitudes duplicadas',
    summary: {
      massUpload: 'Carga masiva',
      created: 'Creadas',
      duplicates: 'Duplicadas',
    },
    table: {
      columns: {
        status: 'Resultado',
        student: 'Alumno',
        request: 'Solicitud',
      },
      createdLabel: 'Creado',
      duplicateLabel: 'Duplicado',
      studentFallback: 'Sin nombre',
      studentMetaLabel: 'Matrícula',
      studentLinkAria: 'Ver detalle del alumno',
      viewRequest: 'Ver solicitud',
      requestIdFallback: '—',
      studentIdLabel: 'ID del alumno',
      requestIdLabel: 'ID de solicitud',
    },
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
  onPaymentRequestDetail,
  onPaymentRequestResult,
  onPaymentRequestScheduleDetail,
  activeSectionKey = DEFAULT_PAYMENTS_TAB_KEY,
  onSectionChange,
  routeSegments = [],
}) => {
  const { token, logout } = useAuth();
  const { openModal } = useModal();

  const normalizedLanguage = SUPPORTED_LANGUAGES.includes(language) ? language : 'es';
  const locale = getLocaleFromLanguage(normalizedLanguage);
  const paymentDetailBasePath = useMemo(
    () => `/${normalizedLanguage}/payments/payments`,
    [normalizedLanguage],
  );
  const paymentRequestsBasePath = useMemo(
    () => `/${normalizedLanguage}/payments/requests`,
    [normalizedLanguage],
  );
  const paymentRequestDetailBasePath = paymentRequestsBasePath;
  const paymentRequestScheduleDetailBasePath = useMemo(
    () => `${paymentRequestsBasePath}/scheduled`,
    [paymentRequestsBasePath],
  );

  const detailRouteSegments = Array.isArray(routeSegments) ? routeSegments : [];
  const primaryRouteSegment = detailRouteSegments[0] ?? null;
  const secondaryRouteSegment = detailRouteSegments[1] ?? null;
  const tertiaryRouteSegment = detailRouteSegments[2] ?? null;
  const isPaymentDetailRoute =
    primaryRouteSegment === 'payments' && detailRouteSegments.length > 1;
  const isPaymentRequestRoute = primaryRouteSegment === 'requests';
  const isPaymentRequestResultRoute = isPaymentRequestRoute && secondaryRouteSegment === 'result';
  const isPaymentRequestScheduledRoute = isPaymentRequestRoute && secondaryRouteSegment === 'scheduled';
  const isPaymentRequestScheduleDetailRoute =
    isPaymentRequestScheduledRoute && tertiaryRouteSegment != null;
  const isPaymentRequestDetailRoute =
    isPaymentRequestRoute &&
    Boolean(secondaryRouteSegment) &&
    secondaryRouteSegment !== 'scheduled' &&
    secondaryRouteSegment !== 'result';
  const paymentRequestScheduleDetailId = (() => {
    if (!isPaymentRequestScheduleDetailRoute) {
      return null;
    }

    const candidate = tertiaryRouteSegment;

    if (candidate == null) {
      return null;
    }

    if (typeof candidate !== 'string') {
      return candidate;
    }

    try {
      return decodeURIComponent(candidate);
    } catch (decodeError) {
      console.warn('Unable to decode payment request schedule id from route', decodeError);
      return candidate;
    }
  })();
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
  const paymentRequestDetailId = (() => {
    if (!isPaymentRequestDetailRoute) {
      return null;
    }

    const candidate = secondaryRouteSegment;

    if (candidate == null) {
      return null;
    }

    if (typeof candidate !== 'string') {
      return candidate;
    }

    try {
      return decodeURIComponent(candidate);
    } catch (decodeError) {
      console.warn('Unable to decode payment request id from route', decodeError);
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
  const requestsViewStrings = useMemo(
    () => ({ ...DEFAULT_PAYMENTS_STRINGS.requestsViews, ...(strings.requestsViews ?? {}) }),
    [strings.requestsViews],
  );
  const addRequestMenuStrings = useMemo(() => {
    const defaults = DEFAULT_PAYMENTS_STRINGS.actions.addRequestMenu;
    const overrides = actionStrings.addRequestMenu ?? defaults;

    return {
      single: { ...defaults.single, ...(overrides?.single ?? {}) },
      scheduled: { ...defaults.scheduled, ...(overrides?.scheduled ?? {}) },
    };
  }, [actionStrings.addRequestMenu]);
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
  const requestsTableStrings = useMemo(() => {
    const requestsOverrides = strings.requestsTable ?? {};
    const columns = {
      ...DEFAULT_PAYMENTS_STRINGS.requestsTable.columns,
      ...(requestsOverrides.columns ?? {}),
    };

    return {
      ...DEFAULT_PAYMENTS_STRINGS.requestsTable,
      ...requestsOverrides,
      columns,
    };
  }, [strings.requestsTable]);
  const requestsRecurrencesTableStrings = useMemo(() => {
    const overrides = strings.requestsRecurrencesTable ?? {};
    const columns = {
      ...DEFAULT_PAYMENTS_STRINGS.requestsRecurrencesTable.columns,
      ...(overrides.columns ?? {}),
    };

    return {
      ...DEFAULT_PAYMENTS_STRINGS.requestsRecurrencesTable,
      ...overrides,
      columns,
    };
  }, [strings.requestsRecurrencesTable]);
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
  const requestsFilterStrings = useMemo(() => {
    const filterOverrides = strings.requestsFilters ?? {};
    const fieldDefaults = DEFAULT_PAYMENTS_STRINGS.requestsFilters.fields;
    const fieldOverrides = filterOverrides.fields ?? {};

    return {
      ...DEFAULT_PAYMENTS_STRINGS.requestsFilters,
      ...filterOverrides,
      fields: {
        paymentRequestId: {
          ...fieldDefaults.paymentRequestId,
          ...(fieldOverrides.paymentRequestId ?? {}),
        },
        student: { ...fieldDefaults.student, ...(fieldOverrides.student ?? {}) },
        reference: { ...fieldDefaults.reference, ...(fieldOverrides.reference ?? {}) },
        gradeGroup: { ...fieldDefaults.gradeGroup, ...(fieldOverrides.gradeGroup ?? {}) },
        concept: { ...fieldDefaults.concept, ...(fieldOverrides.concept ?? {}) },
        status: { ...fieldDefaults.status, ...(fieldOverrides.status ?? {}) },
      },
    };
  }, [strings.requestsFilters]);
  const requestsRecurrenceFilterStrings = useMemo(() => {
    const overrides = strings.requestsRecurrencesFilters ?? {};
    const fieldDefaults = DEFAULT_PAYMENTS_STRINGS.requestsRecurrencesFilters.fields;
    const fieldOverrides = overrides.fields ?? {};
    const fields = {
      globalSearch: {
        ...fieldDefaults.globalSearch,
        ...(fieldOverrides.globalSearch ?? {}),
      },
      ruleName: { ...fieldDefaults.ruleName, ...(fieldOverrides.ruleName ?? {}) },
      schoolId: { ...fieldDefaults.schoolId, ...(fieldOverrides.schoolId ?? {}) },
      groupId: { ...fieldDefaults.groupId, ...(fieldOverrides.groupId ?? {}) },
      studentId: { ...fieldDefaults.studentId, ...(fieldOverrides.studentId ?? {}) },
      dueStart: { ...fieldDefaults.dueStart, ...(fieldOverrides.dueStart ?? {}) },
      dueEnd: { ...fieldDefaults.dueEnd, ...(fieldOverrides.dueEnd ?? {}) },
      active: { ...fieldDefaults.active, ...(fieldOverrides.active ?? {}) },
    };

    const activeOptions = {
      ...DEFAULT_PAYMENTS_STRINGS.requestsRecurrencesFilters.activeOptions,
      ...(overrides.activeOptions ?? {}),
    };

    return {
      ...DEFAULT_PAYMENTS_STRINGS.requestsRecurrencesFilters,
      ...overrides,
      fields,
      activeOptions,
    };
  }, [strings.requestsRecurrencesFilters]);
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
  const addPaymentRequestStrings = useMemo(
    () => ({
      ...DEFAULT_PAYMENTS_STRINGS.addPaymentRequest,
      ...(strings.addPaymentRequest ?? {}),
    }),
    [strings.addPaymentRequest],
  );
  const addScheduledPaymentRequestStrings = useMemo(
    () => ({
      ...DEFAULT_PAYMENTS_STRINGS.addScheduledPaymentRequest,
      ...(strings.addScheduledPaymentRequest ?? {}),
    }),
    [strings.addScheduledPaymentRequest],
  );
  const requestsDetailStrings = useMemo(
    () => ({
      ...DEFAULT_PAYMENTS_STRINGS.requestsDetail,
      ...(strings.requestsDetail ?? {}),
    }),
    [strings.requestsDetail],
  );
  const requestsResultStrings = useMemo(() => {
    const overrides = strings.requestsResult ?? {};
    const summary = {
      ...DEFAULT_PAYMENTS_STRINGS.requestsResult.summary,
      ...(overrides.summary ?? {}),
    };
    const tableOverrides = overrides.table ?? {};
    const tableColumns = {
      ...DEFAULT_PAYMENTS_STRINGS.requestsResult.table.columns,
      ...(tableOverrides.columns ?? {}),
    };
    const table = {
      ...DEFAULT_PAYMENTS_STRINGS.requestsResult.table,
      ...tableOverrides,
      columns: tableColumns,
    };

    return {
      ...DEFAULT_PAYMENTS_STRINGS.requestsResult,
      ...overrides,
      summary,
      table,
    };
  }, [strings.requestsResult]);
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
  const [paymentsOrderBy, setPaymentsOrderBy] = useState('');
  const [paymentsOrderDir, setPaymentsOrderDir] = useState('ASC');
  const [requestsFilters, setRequestsFilters] = useState(
    () => ({ ...DEFAULT_PAYMENT_REQUEST_FILTERS }),
  );
  const [requestsFiltersDraft, setRequestsFiltersDraft] = useState(
    () => ({ ...DEFAULT_PAYMENT_REQUEST_FILTERS }),
  );
  const [requestsOrderBy, setRequestsOrderBy] = useState('');
  const [requestsOrderDir, setRequestsOrderDir] = useState('ASC');
  const [recurrenceFilters, setRecurrenceFilters] = useState(
    () => ({ ...DEFAULT_PAYMENT_RECURRENCE_FILTERS }),
  );
  const [recurrenceFiltersDraft, setRecurrenceFiltersDraft] = useState(
    () => ({ ...DEFAULT_PAYMENT_RECURRENCE_FILTERS }),
  );
  const [showTuitionFilters, setShowTuitionFilters] = useState(false);
  const [showPaymentsFilters, setShowPaymentsFilters] = useState(false);
  const [showRequestsFilters, setShowRequestsFilters] = useState(false);
  const [showRecurrenceFilters, setShowRecurrenceFilters] = useState(false);
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

  const [requestsOffset, setRequestsOffset] = useState(0);
  const [requestsLimit] = useState(DEFAULT_LIMIT);
  const [requestsRows, setRequestsRows] = useState([]);
  const [requestsTotalElements, setRequestsTotalElements] = useState(0);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestsError, setRequestsError] = useState(null);
  const [recurrenceOffset, setRecurrenceOffset] = useState(0);
  const [recurrenceLimit] = useState(DEFAULT_LIMIT);
  const [recurrenceRows, setRecurrenceRows] = useState([]);
  const [recurrenceTotalElements, setRecurrenceTotalElements] = useState(0);
  const [recurrenceLoading, setRecurrenceLoading] = useState(false);
  const [recurrenceError, setRecurrenceError] = useState(null);
  const [recurrenceOrderBy, setRecurrenceOrderBy] = useState('');
  const [recurrenceOrderDir, setRecurrenceOrderDir] = useState('ASC');

  const [toast, setToast] = useState(null);
  const [isTuitionExporting, setIsTuitionExporting] = useState(false);
  const [isPaymentsExporting, setIsPaymentsExporting] = useState(false);
  const [isAddPaymentOpen, setIsAddPaymentOpen] = useState(false);
  const [isRequestsExporting, setIsRequestsExporting] = useState(false);
  const [isAddPaymentRequestOpen, setIsAddPaymentRequestOpen] = useState(false);
  const [isSchedulePaymentRequestOpen, setIsSchedulePaymentRequestOpen] = useState(false);
  const [requestsView, setRequestsView] = useState(REQUESTS_VIEW_KEYS.history);
  const [isRecurrenceExporting, setIsRecurrenceExporting] = useState(false);
  const [isCreateRequestMenuOpen, setIsCreateRequestMenuOpen] = useState(false);
  const createRequestMenuRef = useRef(null);

  const tabs = useMemo(
    () => [
      { key: 'tuition', label: tabStrings.tuition },
      { key: 'requests', label: tabStrings.requests },
      { key: 'payments', label: tabStrings.payments },
    ],
    [tabStrings.payments, tabStrings.requests, tabStrings.tuition],
  );

  const tabKeys = useMemo(() => tabs.map((tab) => tab.key), [tabs]);

  const requestsViewTabs = useMemo(
    () => [
      { key: REQUESTS_VIEW_KEYS.history, label: requestsViewStrings.history },
      { key: REQUESTS_VIEW_KEYS.scheduled, label: requestsViewStrings.scheduled },
    ],
    [requestsViewStrings.history, requestsViewStrings.scheduled],
  );

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

  useEffect(() => {
    if (activeTab !== 'requests') {
      return;
    }

    const nextView = isPaymentRequestScheduledRoute
      ? REQUESTS_VIEW_KEYS.scheduled
      : REQUESTS_VIEW_KEYS.history;

    setRequestsView((previous) => (previous === nextView ? previous : nextView));
  }, [activeTab, isPaymentRequestScheduledRoute]);

  const handleTabSelect = useCallback(
    (key) => {
      setActiveTab(key);
      onSectionChange?.(key);
    },
    [onSectionChange],
  );

  const isTuitionTab = activeTab === 'tuition';
  const isPaymentsTab = activeTab === 'payments';
  const isRequestsTab = activeTab === 'requests';
  const isRequestsHistoryView = requestsView === REQUESTS_VIEW_KEYS.history;
  const isRequestsScheduledView = requestsView === REQUESTS_VIEW_KEYS.scheduled;

  const columnLabels = tableStrings.columns;
  const currencyFormatter = useMemo(
    () => new Intl.NumberFormat(locale, { style: 'currency', currency: 'MXN' }),
    [locale],
  );
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
    [locale],
  );
  const parseDateWithoutTimezoneShift = useCallback((value) => {
    if (!value) {
      return null;
    }

    if (typeof value === 'string') {
      const trimmedValue = value.trim();
      const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmedValue);

      if (dateOnlyMatch) {
        const [, yearString, monthString, dayString] = dateOnlyMatch;
        const year = Number(yearString);
        const monthIndex = Number(monthString) - 1;
        const day = Number(dayString);
        const parsedDate = new Date(year, monthIndex, day);

        return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
      }
    }

    const parsedDate = new Date(value);
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
  }, []);
  const displayedColumns = useMemo(
    () => [
      {
        key: 'student',
        label: columnLabels.student,
        sortable: true,
        orderKey: 'student_full_name',
      },
      { key: 'generation', label: columnLabels.generation, sortable: false },
    ],
    [columnLabels.generation, columnLabels.student],
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

  const handlePaymentsSort = useCallback(
    (orderKey) => {
      if (!orderKey) {
        return;
      }

      const isSameColumn = paymentsOrderBy === orderKey;

      setPaymentsOrderDir((previousDir) => {
        if (isSameColumn) {
          return previousDir === 'ASC' ? 'DESC' : 'ASC';
        }

        return 'ASC';
      });

      setPaymentsOrderBy((previousOrderKey) =>
        previousOrderKey === orderKey ? previousOrderKey : orderKey,
      );
      setPaymentsOffset(0);
    },
    [paymentsOrderBy],
  );

  const handleRequestsSort = useCallback(
    (orderKey) => {
      if (!orderKey) {
        return;
      }

      const isSameColumn = requestsOrderBy === orderKey;

      setRequestsOrderDir((previousDir) => {
        if (isSameColumn) {
          return previousDir === 'ASC' ? 'DESC' : 'ASC';
        }

        return 'ASC';
      });

      setRequestsOrderBy((previousOrderKey) =>
        previousOrderKey === orderKey ? previousOrderKey : orderKey,
      );
      setRequestsOffset(0);
    },
    [requestsOrderBy],
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

  const renderPaymentsSortIndicator = useCallback(
    (orderKey) => {
      const isActive = paymentsOrderBy === orderKey;
      const direction = isActive ? paymentsOrderDir : null;
      const upColor = isActive && direction !== 'DESC' ? '#4338ca' : '#c7d2fe';
      const downColor = isActive && direction === 'DESC' ? '#4338ca' : '#c7d2fe';

      return (
        <svg viewBox="0 0 12 12" aria-hidden="true">
          <path d="M6 2l3 4H3l3-4Z" fill={upColor} />
          <path d="M6 10l3-4H3l3 4Z" fill={downColor} />
        </svg>
      );
    },
    [paymentsOrderBy, paymentsOrderDir],
  );

  const renderRequestsSortIndicator = useCallback(
    (orderKey) => {
      const isActive = requestsOrderBy === orderKey;
      const direction = isActive ? requestsOrderDir : null;
      const upColor = isActive && direction !== 'DESC' ? '#4338ca' : '#c7d2fe';
      const downColor = isActive && direction === 'DESC' ? '#4338ca' : '#c7d2fe';

      return (
        <svg viewBox="0 0 12 12" aria-hidden="true">
          <path d="M6 2l3 4H3l3-4Z" fill={upColor} />
          <path d="M6 10l3-4H3l3 4Z" fill={downColor} />
        </svg>
      );
    },
    [requestsOrderBy, requestsOrderDir],
  );

  const handleRecurrenceSort = useCallback(
    (orderKey) => {
      if (!orderKey) {
        return;
      }

      const isSameColumn = recurrenceOrderBy === orderKey;

      setRecurrenceOrderDir((previousDir) => {
        if (isSameColumn) {
          return previousDir === 'ASC' ? 'DESC' : 'ASC';
        }

        return 'ASC';
      });

      setRecurrenceOrderBy((previousOrderKey) =>
        previousOrderKey === orderKey ? previousOrderKey : orderKey,
      );
      setRecurrenceOffset(0);
    },
    [recurrenceOrderBy],
  );

  const renderRecurrenceSortIndicator = useCallback(
    (orderKey) => {
      const isActive = recurrenceOrderBy === orderKey;
      const direction = isActive ? recurrenceOrderDir : null;
      const upColor = isActive && direction !== 'DESC' ? '#4338ca' : '#c7d2fe';
      const downColor = isActive && direction === 'DESC' ? '#4338ca' : '#c7d2fe';

      return (
        <svg viewBox="0 0 12 12" aria-hidden="true">
          <path d="M6 2l3 4H3l3-4Z" fill={upColor} />
          <path d="M6 10l3-4H3l3 4Z" fill={downColor} />
        </svg>
      );
    },
    [recurrenceOrderBy, recurrenceOrderDir],
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
    () => {
      const sortableHeader = (label, key) => (
        <button
          type="button"
          className="payments-page__sortable"
          onClick={() => handlePaymentsSort(key)}
        >
          <span>{label}</span>
          {renderPaymentsSortIndicator(key)}
        </button>
      );

      return [
        { key: 'payment_id', header: sortableHeader(paymentsTableStrings.columns.id, 'payment_id') },
        {
          key: 'student',
          header: sortableHeader(paymentsTableStrings.columns.student, 'student_full_name'),
        },
        { key: 'pt_name', header: sortableHeader(paymentsTableStrings.columns.concept, 'pt_name') },
        {
          key: 'amount',
          header: sortableHeader(paymentsTableStrings.columns.amount, 'amount'),
          align: 'end',
        },
        { key: 'actions', header: paymentsTableStrings.columns.actions, align: 'end' },
      ];
    },
    [handlePaymentsSort, paymentsTableStrings.columns, renderPaymentsSortIndicator],
  );
  const paymentRequestsColumns = useMemo(
    () => {
      const sortableHeader = (label, key) => (
        <button
          type="button"
          className="payments-page__sortable"
          onClick={() => handleRequestsSort(key)}
        >
          <span>{label}</span>
          {renderRequestsSortIndicator(key)}
        </button>
      );

      return [
        {
          key: 'payment_request_id',
          header: sortableHeader(requestsTableStrings.columns.id, 'payment_request_id'),
        },
        {
          key: 'student',
          header: sortableHeader(requestsTableStrings.columns.student, 'student_full_name'),
        },
        { key: 'pt_name', header: sortableHeader(requestsTableStrings.columns.concept, 'pt_name') },
        {
          key: 'pr_amount',
          header: sortableHeader(requestsTableStrings.columns.amount, 'pr_amount'),
          align: 'end',
        },
        { key: 'ps_pr_name', header: sortableHeader(requestsTableStrings.columns.status, 'ps_pr_name') },
        { key: 'pr_pay_by', header: sortableHeader(requestsTableStrings.columns.dueDate, 'pr_pay_by') },
        { key: 'actions', header: requestsTableStrings.columns.actions, align: 'end' },
      ];
    },
    [handleRequestsSort, renderRequestsSortIndicator, requestsTableStrings.columns],
  );
  const paymentRecurrencesColumns = useMemo(() => {
    const sortableHeader = (label, key) => (
      <button type="button" className="payments-page__sortable" onClick={() => handleRecurrenceSort(key)}>
        <span>{label}</span>
        {renderRecurrenceSortIndicator(key)}
      </button>
    );

    return [
      {
        key: 'payment_request_scheduled_id',
        header: sortableHeader(requestsRecurrencesTableStrings.columns.id, 'payment_request_scheduled_id'),
      },
      {
        key: 'rule_name',
        header: sortableHeader(requestsRecurrencesTableStrings.columns.ruleName, 'rule_name'),
      },
      {
        key: 'pt_name',
        header: sortableHeader(requestsRecurrencesTableStrings.columns.concept, 'pt_name'),
      },
      {
        key: 'pot_name',
        header: sortableHeader(
          requestsRecurrencesTableStrings.columns.recurrenceType,
          'pot_name',
        ),
      },
      {
        key: 'applies_to',
        header: sortableHeader(requestsRecurrencesTableStrings.columns.appliesTo, 'applies_to'),
      },
      {
        key: 'amount',
        header: sortableHeader(requestsRecurrencesTableStrings.columns.amount, 'amount'),
        align: 'end',
      },
      {
        key: 'next_execution_date',
        header: sortableHeader(
          requestsRecurrencesTableStrings.columns.nextExecutionDate,
          'next_execution_date',
        ),
      },
      {
        key: 'active',
        header: sortableHeader(requestsRecurrencesTableStrings.columns.active, 'active'),
      },
      { key: 'actions', header: requestsRecurrencesTableStrings.columns.actions, align: 'end' },
    ];
  }, [
    handleRecurrenceSort,
    renderRecurrenceSortIndicator,
    requestsRecurrencesTableStrings.columns,
  ]);

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
  const requestsTotalPages = Math.max(1, Math.ceil(requestsTotalElements / requestsLimit));
  const requestsCurrentPage = Math.floor(requestsOffset / requestsLimit) + 1;
  const recurrenceTotalPages = Math.max(1, Math.ceil(recurrenceTotalElements / recurrenceLimit));
  const recurrenceCurrentPage = Math.floor(recurrenceOffset / recurrenceLimit) + 1;

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

    if (paymentsOrderBy) {
      params.set('order_by', paymentsOrderBy);
      params.set('order_dir', paymentsOrderDir === 'DESC' ? 'DESC' : 'ASC');
    }

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
  }, [
    normalizedLanguage,
    paymentsFilters,
    paymentsLimit,
    paymentsOffset,
    paymentsOrderBy,
    paymentsOrderDir,
  ]);

  const requestsQueryParams = useMemo(() => {
    const params = new URLSearchParams();

    params.set('lang', normalizedLanguage);
    params.set('offset', String(requestsOffset));
    params.set('limit', String(requestsLimit));
    params.set('export_all', 'false');

    if (requestsOrderBy) {
      params.set('order_by', requestsOrderBy);
      params.set('order_dir', requestsOrderDir === 'DESC' ? 'DESC' : 'ASC');
    }

    for (const [key, value] of Object.entries(requestsFilters)) {
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
    normalizedLanguage,
    requestsFilters,
    requestsLimit,
    requestsOffset,
    requestsOrderBy,
    requestsOrderDir,
  ]);
  const recurrenceQueryParams = useMemo(() => {
    const params = new URLSearchParams();

    params.set('lang', normalizedLanguage);
    params.set('offset', String(recurrenceOffset));
    params.set('limit', String(recurrenceLimit));
    params.set('export_all', 'false');

    if (recurrenceOrderBy) {
      params.set('order_by', recurrenceOrderBy);
      params.set('order_dir', recurrenceOrderDir === 'DESC' ? 'DESC' : 'ASC');
    }

    for (const [key, value] of Object.entries(recurrenceFilters)) {
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
    normalizedLanguage,
    recurrenceFilters,
    recurrenceLimit,
    recurrenceOffset,
    recurrenceOrderBy,
    recurrenceOrderDir,
  ]);

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

  const fetchPaymentRequests = useCallback(async () => {
    if (activeTab !== 'requests' || !isRequestsHistoryView) {
      return;
    }

    setRequestsLoading(true);
    setRequestsError(null);

    try {
      const url = `${API_BASE_URL}/reports/paymentrequests?${requestsQueryParams.toString()}`;
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        handleExpiredToken(response, logout);
        throw new Error(requestsTableStrings.error);
      }

      const payload = await response.json();
      const content = Array.isArray(payload?.content) ? payload.content : [];
      setRequestsRows(content);
      setRequestsTotalElements(Number(payload?.totalElements) || content.length || 0);
    } catch (requestError) {
      console.error('Payment requests fetch error', requestError);
      const fallbackMessage =
        requestError instanceof Error && requestError.message
          ? requestError.message
          : requestsTableStrings.error ?? tableStrings.unknownError;
      setRequestsError(fallbackMessage);
    } finally {
      setRequestsLoading(false);
    }
  }, [
    activeTab,
    logout,
    requestsQueryParams,
    requestsTableStrings.error,
    isRequestsHistoryView,
    tableStrings.unknownError,
    token,
  ]);

  const fetchPaymentRecurrences = useCallback(async () => {
    if (activeTab !== 'requests' || !isRequestsScheduledView) {
      return;
    }

    setRecurrenceLoading(true);
    setRecurrenceError(null);

    try {
      const url = `${API_BASE_URL}/reports/payment-request-schedule?${recurrenceQueryParams.toString()}`;
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        handleExpiredToken(response, logout);
        throw new Error(
          requestsRecurrencesTableStrings.error ?? tableStrings.unknownError,
        );
      }

      const payload = await response.json();
      const content = Array.isArray(payload?.content) ? payload.content : [];
      setRecurrenceRows(content);
      setRecurrenceTotalElements(Number(payload?.totalElements) || content.length || 0);
    } catch (requestError) {
      console.error('Payment schedule fetch error', requestError);
      const fallbackMessage =
        requestError instanceof Error && requestError.message
          ? requestError.message
          : requestsRecurrencesTableStrings.error ?? tableStrings.unknownError;
      setRecurrenceError(fallbackMessage);
    } finally {
      setRecurrenceLoading(false);
    }
  }, [
    activeTab,
    logout,
    recurrenceQueryParams,
    requestsRecurrencesTableStrings.error,
    isRequestsScheduledView,
    tableStrings.unknownError,
    token,
  ]);

  useEffect(() => {
    fetchPaymentRequests();
  }, [fetchPaymentRequests]);

  useEffect(() => {
    fetchPaymentRecurrences();
  }, [fetchPaymentRecurrences]);

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

  useEffect(() => {
    if (showRequestsFilters) {
      setRequestsFiltersDraft(requestsFilters);
    }
  }, [requestsFilters, showRequestsFilters]);

  useEffect(() => {
    if (showRecurrenceFilters) {
      setRecurrenceFiltersDraft(recurrenceFilters);
    }
  }, [recurrenceFilters, showRecurrenceFilters]);

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

  const handleToggleRequestsFilters = useCallback(() => {
    setShowRequestsFilters((previous) => !previous);
  }, []);

  const handleToggleRecurrenceFilters = useCallback(() => {
    setShowRecurrenceFilters((previous) => !previous);
  }, []);

  const handleOpenAddPayment = useCallback(() => {
    setIsAddPaymentOpen(true);
  }, []);

  const handleCloseAddPayment = useCallback(() => {
    setIsAddPaymentOpen(false);
  }, []);

  const handleOpenAddPaymentRequest = useCallback(() => {
    setIsAddPaymentRequestOpen(true);
  }, []);

  const handleCloseAddPaymentRequest = useCallback(() => {
    setIsAddPaymentRequestOpen(false);
  }, []);

  const handleOpenSchedulePaymentRecurrence = useCallback(() => {
    setIsSchedulePaymentRequestOpen(true);
  }, []);

  const handleCloseSchedulePaymentRecurrence = useCallback(() => {
    setIsSchedulePaymentRequestOpen(false);
  }, []);

  const handlePaymentsFilterChange = useCallback((key, value) => {
    setPaymentsFiltersDraft((previous) => ({ ...previous, [key]: value }));
  }, []);

  const handlePaymentsMonthChange = useCallback((value) => {
    setPaymentsFiltersDraft((previous) => ({ ...previous, payment_month: value }));
  }, []);

  const handleRequestsFilterChange = useCallback((key, value) => {
    setRequestsFiltersDraft((previous) => ({ ...previous, [key]: value }));
  }, []);

  const handleRecurrenceFilterChange = useCallback((key, value) => {
    setRecurrenceFiltersDraft((previous) => ({ ...previous, [key]: value }));
  }, []);

  const handleRequestsViewSelect = useCallback(
    (nextView) => {
      if (!Object.values(REQUESTS_VIEW_KEYS).includes(nextView)) {
        return;
      }

      setRequestsView((previous) => (previous === nextView ? previous : nextView));
      setRequestsOffset(0);
      setRecurrenceOffset(0);
      setRecurrenceOrderBy('');
      setRecurrenceOrderDir('ASC');
      setShowRequestsFilters(false);
      setShowRecurrenceFilters(false);
      setIsCreateRequestMenuOpen(false);

      const nextSubPath = nextView === REQUESTS_VIEW_KEYS.scheduled ? 'scheduled' : '';

      if (onSectionChange) {
        if (nextSubPath) {
          onSectionChange('requests', { subPath: nextSubPath });
        } else {
          onSectionChange('requests');
        }
        return;
      }

      if (typeof window !== 'undefined') {
        const suffix = nextSubPath ? `/${nextSubPath}` : '';
        window.location.assign(`${paymentRequestsBasePath}${suffix}`);
      }
    },
    [onSectionChange, paymentRequestsBasePath],
  );

  const handleToggleCreateRequestMenu = useCallback(() => {
    setIsCreateRequestMenuOpen((previous) => !previous);
  }, []);

  const handleCloseCreateRequestMenu = useCallback(() => {
    setIsCreateRequestMenuOpen(false);
  }, []);

  const handleCreateSingleRequest = useCallback(() => {
    handleCloseCreateRequestMenu();
    handleOpenAddPaymentRequest();
  }, [handleCloseCreateRequestMenu, handleOpenAddPaymentRequest]);

  const handleCreateScheduledRequest = useCallback(() => {
    handleCloseCreateRequestMenu();
    handleOpenSchedulePaymentRecurrence();
  }, [handleCloseCreateRequestMenu, handleOpenSchedulePaymentRecurrence]);

  const handlePaymentRequestDetailNavigation = useCallback(
    (requestId) => {
      if (requestId == null || requestId === '') {
        return;
      }

      const idValue = String(requestId);

      if (onPaymentRequestDetail) {
        onPaymentRequestDetail(idValue);
        return;
      }

      if (typeof window !== 'undefined') {
        const fallbackUrl = `${paymentRequestDetailBasePath}/${encodeURIComponent(idValue)}`;
        window.location.assign(fallbackUrl);
      }
    },
    [onPaymentRequestDetail, paymentRequestDetailBasePath],
  );

  const handlePaymentRequestScheduleDetailNavigation = useCallback(
    (scheduleId) => {
      if (scheduleId == null || scheduleId === '') {
        return;
      }

      const idValue = String(scheduleId);

      if (onPaymentRequestScheduleDetail) {
        onPaymentRequestScheduleDetail(idValue);
        return;
      }

      if (typeof window !== 'undefined') {
        const fallbackUrl = `${paymentRequestScheduleDetailBasePath}/${encodeURIComponent(idValue)}`;
        window.location.assign(fallbackUrl);
      }
    },
    [onPaymentRequestScheduleDetail, paymentRequestScheduleDetailBasePath],
  );

  const handlePaymentRequestListNavigation = useCallback(
    (options = {}) => {
      setActiveTab('requests');
      const normalizedSubPath =
        typeof options.subPath === 'string'
          ? options.subPath
              .split('/')
              .filter(Boolean)
              .map((segment) => encodeURIComponent(segment.trim()))
              .join('/')
          : '';

      if (onSectionChange) {
        onSectionChange('requests', options);
        return;
      }

      if (typeof window !== 'undefined') {
        const suffix = normalizedSubPath ? `/${normalizedSubPath}` : '';
        window.location.assign(`${paymentRequestsBasePath}${suffix}`);
      }
    },
    [onSectionChange, paymentRequestsBasePath, setActiveTab],
  );

  const handlePaymentRequestResultNavigation = useCallback(
    (options = {}) => {
      setActiveTab('requests');

      if (onPaymentRequestResult) {
        onPaymentRequestResult(options);
        return;
      }

      if (typeof window !== 'undefined') {
        const fallbackUrl = `${paymentRequestsBasePath}/result`;
        window.location.assign(fallbackUrl);
      }
    },
    [onPaymentRequestResult, paymentRequestsBasePath, setActiveTab],
  );

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

  const handlePaymentRequestCreated = useCallback(
    (result) => {
      const summary = summarizePaymentRequestResult(result);
      const fallbackMessage =
        result?.message ?? addPaymentRequestStrings.success ?? actionStrings.addRequest;
      const swalInstance = getSwalInstance();

      if (typeof window !== 'undefined') {
        try {
          window.sessionStorage.setItem(
            PAYMENT_REQUEST_RESULT_STORAGE_KEY,
            JSON.stringify(result ?? {}),
          );
        } catch (storageError) {
          console.error('Unable to store payment request result', storageError);
        }
      }

      if (swalInstance) {
        const summaryHtml = [
          `${requestsResultStrings.summary.massUpload}: <strong>${summary.massUpload || '—'}</strong>`,
          `${requestsResultStrings.summary.created}: <strong>${summary.created}</strong>`,
          `${requestsResultStrings.summary.duplicates}: <strong>${summary.duplicates}</strong>`,
        ]
          .map((item) => `<li>${item}</li>`)
          .join('');
        const messageParts = [];

        if (result?.message) {
          messageParts.push(`<p>${result.message}</p>`);
        }

        messageParts.push(`<ul style="text-align:left">${summaryHtml}</ul>`);

        swalInstance
          .fire({
            icon: result?.success ? 'success' : result?.type ?? 'info',
            title: result?.title ?? addPaymentRequestStrings.title,
            html: messageParts.join(''),
            confirmButtonText: actionStrings.viewRequestResult ?? 'Ver detalle',
            showCancelButton: true,
            cancelButtonText: addPaymentRequestStrings.cancel ?? 'Cerrar',
          })
          .then((dialogResult) => {
            if (dialogResult.isConfirmed) {
              handlePaymentRequestResultNavigation();
            }
          });
      } else {
        setToast({ type: result?.success ? 'success' : 'info', message: fallbackMessage });
      }

      if (requestsOffset !== 0) {
        setRequestsOffset(0);
      } else {
        fetchPaymentRequests();
      }
    },
    [
      actionStrings.viewRequestResult,
      addPaymentRequestStrings.cancel,
      addPaymentRequestStrings.success,
      addPaymentRequestStrings.title,
      fetchPaymentRequests,
      handlePaymentRequestResultNavigation,
      requestsOffset,
      requestsResultStrings,
    ],
  );

  const handleScheduledPaymentRequestCreated = useCallback(
    (result) => {
      const scheduleId =
        result?.data?.payment_request_scheduled_id ??
        result?.data?.payment_request_scheduledId ??
        null;
      const success = result?.success !== false;
      const message =
        result?.message ?? addScheduledPaymentRequestStrings.success ?? actionStrings.addRequest;
      const swalInstance = getSwalInstance();

      if (swalInstance) {
        swalInstance
          .fire({
            icon: result?.type ?? (success ? 'success' : 'info'),
            title: result?.title ?? addScheduledPaymentRequestStrings.title,
            text: message,
            showCancelButton: true,
            cancelButtonText: addScheduledPaymentRequestStrings.cancel ?? 'Cerrar',
            showConfirmButton: Boolean(scheduleId),
            confirmButtonText:
              actionStrings.viewScheduledRequestDetail ?? requestsRecurrencesTableStrings.viewDetail,
          })
          .then((dialogResult) => {
            if (dialogResult.isConfirmed && scheduleId != null) {
              handlePaymentRequestScheduleDetailNavigation(scheduleId);
            }
          });
      } else {
        setToast({ type: success ? 'success' : 'info', message });
        if (success && scheduleId != null) {
          handlePaymentRequestScheduleDetailNavigation(scheduleId);
        }
      }

      setActiveTab('requests');
      setRequestsView(REQUESTS_VIEW_KEYS.scheduled);

      if (recurrenceOffset !== 0) {
        setRecurrenceOffset(0);
      } else {
        fetchPaymentRecurrences();
      }
    },
    [
      actionStrings.addRequest,
      actionStrings.viewScheduledRequestDetail,
      addScheduledPaymentRequestStrings.cancel,
      addScheduledPaymentRequestStrings.success,
      addScheduledPaymentRequestStrings.title,
      fetchPaymentRecurrences,
      handlePaymentRequestScheduleDetailNavigation,
      recurrenceOffset,
      requestsRecurrencesTableStrings.viewDetail,
      setToast,
    ],
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

  const handleClearRequestsFilters = useCallback(() => {
    const reset = { ...DEFAULT_PAYMENT_REQUEST_FILTERS };
    setRequestsFilters(reset);
    setRequestsFiltersDraft(reset);
    setRequestsOffset(0);
    setShowRequestsFilters(false);
  }, []);

  const handleClearRecurrenceFilters = useCallback(() => {
    const reset = { ...DEFAULT_PAYMENT_RECURRENCE_FILTERS };
    setRecurrenceFilters(reset);
    setRecurrenceFiltersDraft(reset);
    setRecurrenceOffset(0);
    setRecurrenceOrderBy('');
    setRecurrenceOrderDir('ASC');
    setShowRecurrenceFilters(false);
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

  const handleApplyRequestsFilters = useCallback(
    (event) => {
      event?.preventDefault?.();
      setRequestsFilters({ ...requestsFiltersDraft });
      setRequestsOffset(0);
      setShowRequestsFilters(false);
    },
    [requestsFiltersDraft],
  );

  const handleApplyRecurrenceFilters = useCallback(
    (event) => {
      event?.preventDefault?.();
      setRecurrenceFilters({ ...recurrenceFiltersDraft });
      setRecurrenceOffset(0);
      setShowRecurrenceFilters(false);
    },
    [recurrenceFiltersDraft],
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

  const handleRequestsPageChange = useCallback(
    (nextPage) => {
      const safePage = Math.min(Math.max(nextPage, 1), requestsTotalPages);
      setRequestsOffset((safePage - 1) * requestsLimit);
    },
    [requestsLimit, requestsTotalPages],
  );

  const handleRecurrencePageChange = useCallback(
    (nextPage) => {
      const safePage = Math.min(Math.max(nextPage, 1), recurrenceTotalPages);
      setRecurrenceOffset((safePage - 1) * recurrenceLimit);
    },
    [recurrenceLimit, recurrenceTotalPages],
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

  const handleRequestsExport = useCallback(async () => {
    setIsRequestsExporting(true);

    try {
      const params = new URLSearchParams(requestsQueryParams.toString());
      params.set('offset', '0');
      params.set('export_all', 'true');

      const url = `${API_BASE_URL}/reports/paymentrequests?${params.toString()}`;
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
        requestsTableStrings.columns.id,
        requestsTableStrings.columns.student,
        tableStrings.studentIdLabel,
        requestsTableStrings.columns.gradeGroup,
        requestsTableStrings.columns.scholarLevel,
        requestsTableStrings.columns.concept,
        requestsTableStrings.columns.amount,
        requestsTableStrings.columns.status,
        requestsTableStrings.columns.dueDate,
      ];
      const headerRow = headerLabels.map(escapeValue).join(',');
      const csvRows = content.map((row) => {
        const amountValue =
          typeof row?.pr_amount === 'number'
            ? currencyFormatter.format(row.pr_amount)
            : row?.pr_amount ?? '';
        const dueDateValue = row?.pr_pay_by
          ? new Date(row.pr_pay_by).toISOString().slice(0, 10)
          : '';

        return [
          escapeValue(row?.payment_request_id),
          escapeValue(row?.student_full_name ?? row?.student),
          escapeValue(row?.payment_reference),
          escapeValue(row?.grade_group),
          escapeValue(row?.scholar_level_name),
          escapeValue(row?.pt_name),
          escapeValue(amountValue),
          escapeValue(row?.ps_pr_name ?? row?.status),
          escapeValue(dueDateValue),
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
      console.error('Payment requests export error', exportError);
      const errorMessage =
        exportError instanceof Error && exportError.message
          ? exportError.message
          : toastStrings.exportError;
      setToast({ type: 'error', message: errorMessage });
    } finally {
      setIsRequestsExporting(false);
    }
  }, [
    currencyFormatter,
    csvStrings.fileNamePrefix,
    errorStrings.export,
    logout,
    requestsQueryParams,
    requestsTableStrings.columns,
    tableStrings.studentIdLabel,
    toastStrings.exportEmpty,
    toastStrings.exportError,
    toastStrings.exportSuccess,
    token,
  ]);

  const handleRecurrenceExport = useCallback(async () => {
    setIsRecurrenceExporting(true);

    try {
      const params = new URLSearchParams(recurrenceQueryParams.toString());
      params.set('offset', '0');
      params.set('export_all', 'true');

      const url = `${API_BASE_URL}/reports/payment-request-schedule?${params.toString()}`;
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
        requestsRecurrencesTableStrings.columns.id,
        requestsRecurrencesTableStrings.columns.ruleName,
        requestsRecurrencesTableStrings.columns.concept,
        requestsRecurrencesTableStrings.columns.recurrenceType,
        requestsRecurrencesTableStrings.columns.appliesTo,
        requestsRecurrencesTableStrings.columns.amount,
        requestsRecurrencesTableStrings.columns.nextExecutionDate,
        requestsRecurrencesTableStrings.columns.active,
      ];
      const headerRow = headerLabels.map(escapeValue).join(',');
      const csvRows = content.map((row) => {
        const scheduleId =
          row?.payment_request_scheduled_id ??
          row?.payment_request_scheduledId ??
          row?.payment_request_id ??
          '';
        const normalizedAmount = normalizeAmount(row?.amount);
        const amountValue =
          normalizedAmount != null
            ? currencyFormatter.format(normalizedAmount)
            : row?.amount ?? '';
        const nextExecutionDateValue = row?.next_execution_date
          ? new Date(row.next_execution_date).toISOString().slice(0, 10)
          : '';
        const activeLabel = row?.active
          ? requestsRecurrencesTableStrings.activeYes
          : requestsRecurrencesTableStrings.activeNo;

        return [
          escapeValue(scheduleId),
          escapeValue(row?.rule_name),
          escapeValue(row?.pt_name),
          escapeValue(row?.pot_name),
          escapeValue(row?.applies_to),
          escapeValue(amountValue),
          escapeValue(nextExecutionDateValue),
          escapeValue(activeLabel),
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
      console.error('Payment schedule export error', exportError);
      const errorMessage =
        exportError instanceof Error && exportError.message
          ? exportError.message
          : toastStrings.exportError;
      setToast({ type: 'error', message: errorMessage });
    } finally {
      setIsRecurrenceExporting(false);
    }
  }, [
    currencyFormatter,
    csvStrings.fileNamePrefix,
    errorStrings.export,
    logout,
    recurrenceQueryParams,
    requestsRecurrencesTableStrings.activeNo,
    requestsRecurrencesTableStrings.activeYes,
    requestsRecurrencesTableStrings.columns,
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

  useEffect(() => {
    if ((activeTab !== 'requests' || !isRequestsHistoryView) && showRequestsFilters) {
      setShowRequestsFilters(false);
    }
  }, [activeTab, isRequestsHistoryView, showRequestsFilters]);

  useEffect(() => {
    if ((activeTab !== 'requests' || !isRequestsScheduledView) && showRecurrenceFilters) {
      setShowRecurrenceFilters(false);
    }
  }, [activeTab, isRequestsScheduledView, showRecurrenceFilters]);

  useEffect(() => {
    if (activeTab !== 'requests' && isAddPaymentRequestOpen) {
      setIsAddPaymentRequestOpen(false);
    }
  }, [activeTab, isAddPaymentRequestOpen]);

  useEffect(() => {
    if (!isCreateRequestMenuOpen) {
      return undefined;
    }

    const handleClickOutside = (event) => {
      if (createRequestMenuRef.current && !createRequestMenuRef.current.contains(event.target)) {
        setIsCreateRequestMenuOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsCreateRequestMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [createRequestMenuRef, isCreateRequestMenuOpen]);

  useEffect(() => {
    if (activeTab !== 'requests' && isCreateRequestMenuOpen) {
      setIsCreateRequestMenuOpen(false);
    }
  }, [activeTab, isCreateRequestMenuOpen]);

  useEffect(() => {
    if (isPaymentRequestResultRoute) {
      const breadcrumbLabel = requestsResultStrings.title ?? DEFAULT_PAYMENTS_STRINGS.requestsResult.title;
      onPaymentBreadcrumbChange?.(breadcrumbLabel);
    }
  }, [
    isPaymentRequestResultRoute,
    onPaymentBreadcrumbChange,
    requestsResultStrings.title,
  ]);

  const CreateRequestIcon = (
    <svg viewBox="0 0 20 20" aria-hidden="true" width="16" height="16">
      <path d="M9 3h2v6h6v2h-6v6H9v-6H3V9h6z" fill="currentColor" />
    </svg>
  );

  const CaretIcon = (
    <svg viewBox="0 0 20 20" aria-hidden="true" width="14" height="14">
      <path d="M5 7l5 6 5-6H5z" fill="currentColor" />
    </svg>
  );

  const SingleRequestIcon = (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20">
      <path
        d="M6 3h8.5L19 7.5V19a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M14.5 3v4.5H19"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M12 11v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M9 14h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );

  const ScheduledRequestIcon = (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20">
      <rect
        x="5"
        y="6"
        width="14"
        height="13"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M8 4v3m8-3v3M5 9.5h14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M12 12v3.25l2.5 1.25"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

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

  const requestsFiltersCount = useMemo(() => {
    return Object.entries(requestsFilters).reduce((count, [, value]) => {
      if (value === null || value === undefined) {
        return count;
      }

      const normalized = typeof value === 'string' ? value.trim() : value;

      if (normalized === '' || normalized === false) {
        return count;
      }

      return count + 1;
    }, 0);
  }, [requestsFilters]);
  const recurrenceFiltersCount = useMemo(() => {
    return Object.entries(recurrenceFilters).reduce((count, [, value]) => {
      if (value === null || value === undefined) {
        return count;
      }

      const normalized = typeof value === 'string' ? value.trim() : value;

      if (normalized === '' || normalized === false) {
        return count;
      }

      return count + 1;
    }, 0);
  }, [recurrenceFilters]);

  return (
    <div className="page">
      <GlobalToast alert={toast} onClose={() => setToast(null)} />

      <header className="page__header">
        <div>
          <p>{strings.header?.subtitle ?? description}</p>
        </div>
      </header>

      {isPaymentDetailRoute ? (
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
      ) : isPaymentRequestScheduleDetailRoute ? (
        <div className="page__layout">
          <section className="page__content">
            <PaymentRequestScheduleDetailPage
              scheduleId={paymentRequestScheduleDetailId}
              language={normalizedLanguage}
              strings={strings.requestsScheduleDetail ?? {}}
              onBreadcrumbChange={onPaymentBreadcrumbChange}
              onNavigateBack={() => {
                setActiveTab('requests');
                setRequestsView(REQUESTS_VIEW_KEYS.scheduled);
                handlePaymentRequestListNavigation({ replace: true, subPath: 'scheduled' });
              }}
              onStudentDetail={onStudentDetail}
              onPaymentRequestDetail={handlePaymentRequestDetailNavigation}
            />
          </section>
        </div>
      ) : isPaymentRequestDetailRoute ? (
        <div className="page__layout">
          <section className="page__content">
            <PaymentRequestDetailPage
              requestId={paymentRequestDetailId}
              language={normalizedLanguage}
              strings={strings.requestsDetail ?? {}}
              onBreadcrumbChange={onPaymentBreadcrumbChange}
              onNavigateBack={() => handlePaymentRequestListNavigation({ replace: true })}
              onStudentDetail={onStudentDetail}
              onPaymentDetail={handlePaymentDetailNavigation}
            />
          </section>
        </div>
      ) : isPaymentRequestResultRoute ? (
        <div className="page__layout">
          <section className="page__content">
            <PaymentRequestResultPage
              language={normalizedLanguage}
              strings={strings.requestsResult ?? {}}
              onNavigateBack={() => handlePaymentRequestListNavigation({ replace: true })}
              onStudentDetail={onStudentDetail}
              onPaymentRequestDetail={handlePaymentRequestDetailNavigation}
            />
          </section>
        </div>
      ) : (
        <>
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
          ) : activeKey === 'requests' ? (
            <>
              <div
                className={`payments-page__create-request ${
                  isCreateRequestMenuOpen ? 'is-open' : ''
                }`}
                ref={createRequestMenuRef}
              >
                <ActionButton
                  type="button"
                  onClick={handleToggleCreateRequestMenu}
                  className="payments-page__create-request-button"
                  icon={CreateRequestIcon}
                  aria-haspopup="menu"
                  aria-expanded={isCreateRequestMenuOpen}
                >
                  <span className="payments-page__create-request-label">
                    {actionStrings.addRequest}
                    <span className="payments-page__create-request-caret" aria-hidden="true">
                      {CaretIcon}
                    </span>
                  </span>
                </ActionButton>
                {isCreateRequestMenuOpen ? (
                  <div className="payments-page__create-request-menu" role="menu">
                    <button
                      type="button"
                      className="payments-page__create-request-option"
                      onClick={handleCreateSingleRequest}
                      role="menuitem"
                    >
                      <span className="payments-page__create-request-option-icon" aria-hidden="true">
                        {SingleRequestIcon}
                      </span>
                      <span className="payments-page__create-request-option-content">
                        <span className="payments-page__create-request-option-title">
                          {addRequestMenuStrings.single.title}
                        </span>
                        <span className="payments-page__create-request-option-description">
                          {addRequestMenuStrings.single.description}
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      className="payments-page__create-request-option"
                      onClick={handleCreateScheduledRequest}
                      role="menuitem"
                    >
                      <span className="payments-page__create-request-option-icon" aria-hidden="true">
                        {ScheduledRequestIcon}
                      </span>
                      <span className="payments-page__create-request-option-content">
                        <span className="payments-page__create-request-option-title">
                          {addRequestMenuStrings.scheduled.title}
                        </span>
                        <span className="payments-page__create-request-option-description">
                          {addRequestMenuStrings.scheduled.description}
                        </span>
                      </span>
                    </button>
                  </div>
                ) : null}
              </div>
              {isRequestsScheduledView ? (
                <>
                  <FilterButton
                    type="button"
                    onClick={handleToggleRecurrenceFilters}
                    aria-expanded={showRecurrenceFilters}
                    aria-controls="payment-recurrences-filters"
                    className="rounded-pill d-inline-flex align-items-center gap-2"
                  >
                    <span className="fw-semibold">{actionStrings.filterRecurrences}</span>
                    {recurrenceFiltersCount > 0 && (
                      <span className="badge text-bg-primary rounded-pill">{recurrenceFiltersCount}</span>
                    )}
                  </FilterButton>
                  <ExportButton
                    type="button"
                    onClick={handleRecurrenceExport}
                    disabled={isRecurrenceExporting}
                  >
                    {isRecurrenceExporting
                      ? actionStrings.exporting
                      : actionStrings.exportRecurrences}
                  </ExportButton>
                </>
              ) : (
                <>
                  <FilterButton
                    type="button"
                    onClick={handleToggleRequestsFilters}
                    aria-expanded={showRequestsFilters}
                    aria-controls="payment-requests-filters"
                    className="rounded-pill d-inline-flex align-items-center gap-2"
                  >
                    <span className="fw-semibold">{actionStrings.filter}</span>
                    {requestsFiltersCount > 0 && (
                      <span className="badge text-bg-primary rounded-pill">{requestsFiltersCount}</span>
                    )}
                  </FilterButton>
                  <ExportButton
                    type="button"
                    onClick={handleRequestsExport}
                    disabled={isRequestsExporting}
                  >
                    {isRequestsExporting ? actionStrings.exporting : actionStrings.export}
                  </ExportButton>
                </>
              )}
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
                      <td data-title={tableStrings.columns.student}>
                        <StudentTableCell
                          name={row.student}
                          fallbackName={tableStrings.studentFallback}
                          gradeGroup={row.class ?? row.grade_group}
                          scholarLevel={row.scholar_level_name}
                          enrollment={studentMetaValue}
                          onClick={() => handleStudentDetailClick(row)}
                          disabled={!canNavigateToStudent}
                          nameButtonProps={{ 'aria-label': studentName }}
                        />
                      </td>
                      <td data-title={tableStrings.columns.generation}>{row.generation ?? '--'}</td>
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
          ) : isRequestsTab ? (
            <>
              <Tabs
                className="payments-page__requests-tabs"
                tabs={requestsViewTabs}
                activeKey={requestsView}
                onSelect={handleRequestsViewSelect}
                navClassName="tabs nav-pills flex-wrap gap-2"
              />
              <UiCard className="page__table-card">
                {isRequestsScheduledView ? (
                  <GlobalTable
                    className="page__table-wrapper"
                    tableClassName="page__table mb-0"
                    columns={paymentRecurrencesColumns}
                    data={recurrenceRows}
                    getRowId={(row, index) =>
                      row?.payment_request_scheduled_id ??
                      row?.payment_request_scheduledId ??
                      row?.payment_request_id ??
                      `payment-schedule-${index}`
                    }
                    renderRow={(row, index) => {
                      const scheduleId =
                        row?.payment_request_scheduled_id ??
                        row?.payment_request_scheduledId ??
                        row?.payment_request_id ??
                        null;
                      const rowKey = scheduleId ?? `payment-schedule-${index}`;
                      const normalizedAmount = normalizeAmount(row?.amount);
                      const formattedAmount =
                        normalizedAmount != null
                          ? currencyFormatter.format(normalizedAmount)
                          : row?.amount != null
                          ? String(row.amount)
                          : '';
                      const nextExecutionDateLabel = (() => {
                        if (!row?.next_execution_date) {
                          return '';
                        }

                        const parsed = parseDateWithoutTimezoneShift(row.next_execution_date);
                        return parsed ? dateFormatter.format(parsed) : String(row.next_execution_date);
                      })();
                      const activeLabel = row?.active
                        ? requestsRecurrencesTableStrings.activeYes
                        : requestsRecurrencesTableStrings.activeNo;
                      const detailButtonLabel = scheduleId
                        ? `${requestsRecurrencesTableStrings.viewDetail} ${scheduleId}`
                        : requestsRecurrencesTableStrings.viewDetail;

                      return (
                        <tr key={rowKey}>
                          <td data-title={requestsRecurrencesTableStrings.columns.id} className="text-center">
                            {scheduleId ?? '--'}
                          </td>
                          <td data-title={requestsRecurrencesTableStrings.columns.ruleName}>
                            {row?.rule_name ?? (
                              <span>--</span>
                            )}
                          </td>
                          <td data-title={requestsRecurrencesTableStrings.columns.concept}>
                            {row?.pt_name ?? <span>--</span>}
                          </td>
                          <td data-title={requestsRecurrencesTableStrings.columns.recurrenceType}>
                            {row?.pot_name ?? <span>--</span>}
                          </td>
                          <td data-title={requestsRecurrencesTableStrings.columns.appliesTo}>
                            {row?.applies_to ?? <span>--</span>}
                          </td>
                          <td data-title={requestsRecurrencesTableStrings.columns.amount} className="text-end">
                            {formattedAmount ? (
                              formattedAmount
                            ) : (
                              <span>--</span>
                            )}
                          </td>
                          <td data-title={requestsRecurrencesTableStrings.columns.nextExecutionDate}>
                            {nextExecutionDateLabel ? (
                              nextExecutionDateLabel
                            ) : (
                              <span>--</span>
                            )}
                          </td>
                          <td data-title={requestsRecurrencesTableStrings.columns.active}>
                            {activeLabel}
                          </td>
                          <td data-title={requestsRecurrencesTableStrings.columns.actions} className="text-end">
                            <ActionButton
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() =>
                                scheduleId != null
                                  ? handlePaymentRequestScheduleDetailNavigation(scheduleId)
                                  : null
                              }
                              disabled={scheduleId == null}
                              aria-label={detailButtonLabel}
                              title={detailButtonLabel}
                            >
                              {requestsRecurrencesTableStrings.viewDetail}
                            </ActionButton>
                          </td>
                        </tr>
                      );
                    }}
                    loading={recurrenceLoading}
                    loadingMessage={requestsRecurrencesTableStrings.loading}
                    error={recurrenceError || null}
                    emptyMessage={requestsRecurrencesTableStrings.empty}
                    pagination={{
                      currentPage: recurrenceCurrentPage,
                      pageSize: recurrenceLimit,
                      totalItems: recurrenceTotalElements,
                      onPageChange: handleRecurrencePageChange,
                      previousLabel: tableStrings.pagination.previous ?? '←',
                      nextLabel: tableStrings.pagination.next ?? '→',
                      summary: paymentSummary,
                      pageLabel: paymentPageLabel,
                    }}
                  />
                ) : (
                  <GlobalTable
                    className="page__table-wrapper"
                    tableClassName="page__table mb-0"
                    columns={paymentRequestsColumns}
                    data={requestsRows}
                    getRowId={(row, index) =>
                      row?.payment_request_id ??
                      row?.paymentRequestId ??
                      row?.payment_reference ??
                      `payment-request-${index}`
                    }
                    renderRow={(row, index) => {
                      const rowKey =
                        row?.payment_request_id ??
                        row?.paymentRequestId ??
                        row?.payment_reference ??
                        `payment-request-${index}`;
                      const studentName = row?.student_full_name ?? row?.student ?? '';
                      const studentMeta = row?.payment_reference ?? '';
                      const amountRaw = row?.pr_amount ?? row?.amount;
                      const formattedAmount =
                        typeof amountRaw === 'number'
                          ? currencyFormatter.format(amountRaw)
                          : amountRaw != null && amountRaw !== ''
                          ? String(amountRaw)
                          : '';
                      const dueDateRaw = row?.pr_pay_by ?? row?.due_date;
                      const dueDateLabel = (() => {
                        if (!dueDateRaw) {
                          return '';
                        }

                        const parsed = new Date(dueDateRaw);
                        return Number.isNaN(parsed.getTime())
                          ? String(dueDateRaw)
                          : dateFormatter.format(parsed);
                      })();
                      const requestIdValue = row?.payment_request_id ?? row?.paymentRequestId ?? null;
                      const requestIdLabel = requestIdValue != null ? String(requestIdValue) : null;
                      const hasValidRequestId = !(
                        requestIdLabel == null ||
                        requestIdLabel.trim() === '' ||
                        requestIdLabel === 'null' ||
                        requestIdLabel === 'undefined'
                      );
                      const detailButtonLabel = hasValidRequestId
                        ? `${requestsDetailStrings.open} ${requestIdLabel}`
                        : requestsDetailStrings.open;

                      return (
                        <tr key={rowKey}>
                          <td data-title={requestsTableStrings.columns.id} className="text-center">
                            {row?.payment_request_id ?? '--'}
                          </td>
                          <td data-title={requestsTableStrings.columns.student}>
                            <StudentTableCell
                              name={studentName}
                              fallbackName={tableStrings.studentFallback}
                              gradeGroup={row?.grade_group}
                              scholarLevel={row?.scholar_level_name}
                              enrollment={studentMeta}
                              onClick={() =>
                                handleStudentDetailClick({
                                  ...row,
                                  student: studentName,
                                })
                              }
                              nameButtonProps={{
                                'aria-label': studentMeta
                                  ? `${studentName} (${tableStrings.studentIdLabel}: ${studentMeta})`
                                  : studentName,
                              }}
                            />
                          </td>
                          <td data-title={requestsTableStrings.columns.concept}>{row?.pt_name ?? '--'}</td>
                          <td data-title={requestsTableStrings.columns.amount} className="text-end">
                            {formattedAmount ? (
                              formattedAmount
                            ) : (
                              <span className="ui-table__empty-indicator">--</span>
                            )}
                          </td>
                          <td data-title={requestsTableStrings.columns.status}>
                            {row?.ps_pr_name ?? row?.status ?? '--'}
                          </td>
                          <td data-title={requestsTableStrings.columns.dueDate}>
                            {dueDateLabel ? (
                              dueDateLabel
                            ) : (
                              <span className="ui-table__empty-indicator">--</span>
                            )}
                          </td>
                          <td data-title={requestsTableStrings.columns.actions} className="text-end">
                            <ActionButton
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => handlePaymentRequestDetailNavigation(requestIdValue)}
                              disabled={!hasValidRequestId}
                              aria-label={detailButtonLabel}
                              title={detailButtonLabel}
                            >
                              {requestsDetailStrings.open}
                            </ActionButton>
                          </td>
                        </tr>
                      );
                    }}
                    loading={requestsLoading}
                    loadingMessage={requestsTableStrings.loading}
                    error={requestsError || null}
                    emptyMessage={requestsTableStrings.empty}
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
                )}
              </UiCard>
            </>
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
                        <StudentTableCell
                          name={studentName}
                          fallbackName={tableStrings.studentFallback}
                          gradeGroup={row?.grade_group}
                          scholarLevel={row?.scholar_level_name}
                          enrollment={studentMeta}
                        />
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

      <AddPaymentRequestModal
        isOpen={isAddPaymentRequestOpen}
        onClose={handleCloseAddPaymentRequest}
        token={token}
        logout={logout}
        language={normalizedLanguage}
        onSuccess={handlePaymentRequestCreated}
        strings={addPaymentRequestStrings}
      />

      <SchedulePaymentRequestModal
        isOpen={isSchedulePaymentRequestOpen}
        onClose={handleCloseSchedulePaymentRecurrence}
        token={token}
        logout={logout}
        language={normalizedLanguage}
        onSuccess={handleScheduledPaymentRequestCreated}
        strings={addScheduledPaymentRequestStrings}
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
        isOpen={showRequestsFilters}
        onClose={() => setShowRequestsFilters(false)}
        title={requestsFilterStrings.title}
        description={requestsFilterStrings.subtitle}
        id="payment-requests-filters"
        footer={
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
            <ActionButton variant="text" onClick={handleClearRequestsFilters} type="button">
              {requestsFilterStrings.reset}
            </ActionButton>
            <ActionButton type="submit" form="payment-requests-filters-form">
              {actionStrings.filter}
            </ActionButton>
          </div>
        }
      >
        <form
          id="payment-requests-filters-form"
          className="row g-3"
          onSubmit={handleApplyRequestsFilters}
        >
          <div className="col-sm-12">
            <label htmlFor="requests-filter-id" className="form-label">
              {requestsFilterStrings.fields.paymentRequestId.label}
            </label>
            <input
              id="requests-filter-id"
              type="text"
              className="form-control"
              value={requestsFiltersDraft.payment_request_id}
              onChange={(event) =>
                handleRequestsFilterChange('payment_request_id', event.target.value)
              }
              placeholder={requestsFilterStrings.fields.paymentRequestId.placeholder}
            />
          </div>
          <div className="col-sm-12">
            <label htmlFor="requests-filter-student" className="form-label">
              {requestsFilterStrings.fields.student.label}
            </label>
            <input
              id="requests-filter-student"
              type="text"
              className="form-control"
              value={requestsFiltersDraft.student_full_name}
              onChange={(event) =>
                handleRequestsFilterChange('student_full_name', event.target.value)
              }
              placeholder={requestsFilterStrings.fields.student.placeholder}
            />
          </div>
          <div className="col-sm-12">
            <label htmlFor="requests-filter-reference" className="form-label">
              {requestsFilterStrings.fields.reference.label}
            </label>
            <input
              id="requests-filter-reference"
              type="text"
              className="form-control"
              value={requestsFiltersDraft.payment_reference}
              onChange={(event) =>
                handleRequestsFilterChange('payment_reference', event.target.value)
              }
              placeholder={requestsFilterStrings.fields.reference.placeholder}
            />
          </div>
          <div className="col-sm-12">
            <label htmlFor="requests-filter-grade" className="form-label">
              {requestsFilterStrings.fields.gradeGroup.label}
            </label>
            <input
              id="requests-filter-grade"
              type="text"
              className="form-control"
              value={requestsFiltersDraft.grade_group}
              onChange={(event) => handleRequestsFilterChange('grade_group', event.target.value)}
              placeholder={requestsFilterStrings.fields.gradeGroup.placeholder}
            />
          </div>
          <div className="col-sm-12">
            <label htmlFor="requests-filter-concept" className="form-label">
              {requestsFilterStrings.fields.concept.label}
            </label>
            <input
              id="requests-filter-concept"
              type="text"
              className="form-control"
              value={requestsFiltersDraft.pt_name}
              onChange={(event) => handleRequestsFilterChange('pt_name', event.target.value)}
              placeholder={requestsFilterStrings.fields.concept.placeholder}
            />
          </div>
          <div className="col-sm-12">
            <label htmlFor="requests-filter-status" className="form-label">
              {requestsFilterStrings.fields.status.label}
            </label>
            <input
              id="requests-filter-status"
              type="text"
              className="form-control"
              value={requestsFiltersDraft.ps_pr_name}
              onChange={(event) => handleRequestsFilterChange('ps_pr_name', event.target.value)}
              placeholder={requestsFilterStrings.fields.status.placeholder}
            />
          </div>
        </form>
      </SidebarModal>

      <SidebarModal
        isOpen={showRecurrenceFilters}
        onClose={() => setShowRecurrenceFilters(false)}
        title={requestsRecurrenceFilterStrings.title}
        description={requestsRecurrenceFilterStrings.subtitle}
        id="payment-recurrences-filters"
        footer={
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
            <ActionButton variant="text" onClick={handleClearRecurrenceFilters} type="button">
              {requestsRecurrenceFilterStrings.reset}
            </ActionButton>
            <ActionButton type="submit" form="payment-recurrences-filters-form">
              {actionStrings.filterRecurrences ?? actionStrings.filter}
            </ActionButton>
          </div>
        }
      >
        <form
          id="payment-recurrences-filters-form"
          className="row g-3"
          onSubmit={handleApplyRecurrenceFilters}
        >
          <div className="col-sm-12">
            <label htmlFor="recurrence-filter-search" className="form-label">
              {requestsRecurrenceFilterStrings.fields.globalSearch.label}
            </label>
            <input
              id="recurrence-filter-search"
              type="text"
              className="form-control"
              value={recurrenceFiltersDraft.global_search}
              onChange={(event) =>
                handleRecurrenceFilterChange('global_search', event.target.value)
              }
              placeholder={requestsRecurrenceFilterStrings.fields.globalSearch.placeholder}
            />
          </div>
          <div className="col-sm-12">
            <label htmlFor="recurrence-filter-rule" className="form-label">
              {requestsRecurrenceFilterStrings.fields.ruleName.label}
            </label>
            <input
              id="recurrence-filter-rule"
              type="text"
              className="form-control"
              value={recurrenceFiltersDraft.rule_name}
              onChange={(event) => handleRecurrenceFilterChange('rule_name', event.target.value)}
              placeholder={requestsRecurrenceFilterStrings.fields.ruleName.placeholder}
            />
          </div>
          <div className="col-sm-12">
            <label htmlFor="recurrence-filter-school" className="form-label">
              {requestsRecurrenceFilterStrings.fields.schoolId.label}
            </label>
            <input
              id="recurrence-filter-school"
              type="text"
              className="form-control"
              value={recurrenceFiltersDraft.school_id}
              onChange={(event) => handleRecurrenceFilterChange('school_id', event.target.value)}
              placeholder={requestsRecurrenceFilterStrings.fields.schoolId.placeholder}
            />
          </div>
          <div className="col-sm-12">
            <label htmlFor="recurrence-filter-group" className="form-label">
              {requestsRecurrenceFilterStrings.fields.groupId.label}
            </label>
            <input
              id="recurrence-filter-group"
              type="text"
              className="form-control"
              value={recurrenceFiltersDraft.group_id}
              onChange={(event) => handleRecurrenceFilterChange('group_id', event.target.value)}
              placeholder={requestsRecurrenceFilterStrings.fields.groupId.placeholder}
            />
          </div>
          <div className="col-sm-12">
            <label htmlFor="recurrence-filter-student" className="form-label">
              {requestsRecurrenceFilterStrings.fields.studentId.label}
            </label>
            <input
              id="recurrence-filter-student"
              type="text"
              className="form-control"
              value={recurrenceFiltersDraft.student_id}
              onChange={(event) => handleRecurrenceFilterChange('student_id', event.target.value)}
              placeholder={requestsRecurrenceFilterStrings.fields.studentId.placeholder}
            />
          </div>
          <div className="col-sm-12">
            <label htmlFor="recurrence-filter-due-start" className="form-label">
              {requestsRecurrenceFilterStrings.fields.dueStart.label}
            </label>
            <input
              id="recurrence-filter-due-start"
              type="date"
              className="form-control"
              value={recurrenceFiltersDraft.due_start}
              onChange={(event) => handleRecurrenceFilterChange('due_start', event.target.value)}
            />
          </div>
          <div className="col-sm-12">
            <label htmlFor="recurrence-filter-due-end" className="form-label">
              {requestsRecurrenceFilterStrings.fields.dueEnd.label}
            </label>
            <input
              id="recurrence-filter-due-end"
              type="date"
              className="form-control"
              value={recurrenceFiltersDraft.due_end}
              onChange={(event) => handleRecurrenceFilterChange('due_end', event.target.value)}
            />
          </div>
          <div className="col-sm-12">
            <label htmlFor="recurrence-filter-active" className="form-label">
              {requestsRecurrenceFilterStrings.fields.active.label}
            </label>
            <select
              id="recurrence-filter-active"
              className="form-select"
              value={recurrenceFiltersDraft.active}
              onChange={(event) => handleRecurrenceFilterChange('active', event.target.value)}
            >
              <option value="">
                {requestsRecurrenceFilterStrings.activeOptions?.all ?? 'Todas'}
              </option>
              <option value="true">
                {requestsRecurrenceFilterStrings.activeOptions?.active ?? 'Activas'}
              </option>
              <option value="false">
                {requestsRecurrenceFilterStrings.activeOptions?.inactive ?? 'Inactivas'}
              </option>
            </select>
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
        </>
      )}
    </div>
  );
};

export default PaymentsFinancePage;
