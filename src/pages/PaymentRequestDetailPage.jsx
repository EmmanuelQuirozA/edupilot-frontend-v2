import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import GlobalToast from '../components/GlobalToast.jsx';
import ActionButton from '../components/ui/ActionButton.jsx';
import UiCard from '../components/ui/UiCard.jsx';
import StudentInfo from '../components/ui/StudentInfo.jsx';
import { API_BASE_URL } from '../config.js';
import { handleExpiredToken } from '../utils/auth.js';
import { useAuth } from '../context/AuthContext.jsx';
import PaymentRequestPaymentModal from '../components/payments/PaymentRequestPaymentModal.jsx';
import './PaymentRequestDetailPage.css';

const EmailIcon = () => (
  <svg
    className="payment-request-detail__contact-icon"
    viewBox="0 0 24 24"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zm0 2v.01L12 13l8-5.99V7H4zm0 10h16V9.24l-7.553 5.65a1 1 0 0 1-1.194 0L4 9.24V17z" />
  </svg>
);

const WhatsappIcon = () => (
  <i className="bi bi-whatsapp payment-request-detail__contact-icon" aria-hidden="true" />
);

const DEFAULT_STRINGS = {
  breadcrumbFallback: 'Detalle de solicitud',
  back: 'Volver a solicitudes',
  loading: 'Cargando solicitud de pago...',
  error: 'No fue posible cargar la solicitud de pago.',
  retry: 'Reintentar',
  generalTitle: 'Detalles de la solicitud',
  studentTitle: 'Información del alumno',
  viewStudent: 'Ver detalle del alumno',
  booleans: {
    yes: 'Sí',
    no: 'No',
  },
  contactLabels: {
    email: 'Correo electrónico',
    phone: 'Teléfono',
  },
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
    partialPayment: 'Permite pago parcial',
    closedAt: 'Fecha de cierre',
  },
  paymentInfo: {
    title: 'Resumen de pagos',
    fields: {
      totalPaid: 'Total pagado',
      latePeriods: 'Periodos con recargo',
      lateFeeTotal: 'Total de recargos',
      accumulatedFees: 'Cargos acumulados',
      pendingPayment: 'Pendiente de pago',
    },
  },
  payments: {
    title: 'Pagos relacionados',
    empty: 'No hay pagos registrados para esta solicitud.',
    columns: {
      id: 'ID de pago',
      concept: 'Concepto',
      status: 'Estatus',
      date: 'Fecha',
      amount: 'Monto',
      comments: 'Comentarios',
    },
  },
  breakdown: {
    title: 'Desglose de pagos',
    empty: 'No hay movimientos en el desglose.',
    columns: {
      id: 'ID de pago',
      concept: 'Concepto',
      status: 'Estado',
      date: 'Fecha',
      amount: 'Monto',
      balance: 'Saldo',
    },
    typeLabels: {
      payment: 'Pago',
      late_fee: 'Recargo',
      closed_at: 'Cierre',
      initial_payment_request: 'Solicitud inicial',
    },
  },
  tabs: {
    breakdown: 'Desglose',
    activity: 'Actividad y comentarios',
  },
  logs: {
    title: 'Actividad',
    empty: 'No hay actividad registrada.',
    error: 'No fue posible cargar los registros de actividad.',
  },
  comments: {
    title: 'Comentarios',
    empty: 'Sin comentarios registrados.',
  },
  edit: {
    button: 'Editar solicitud',
    cancel: 'Cancelar',
    save: 'Guardar cambios',
    formTitle: 'Editar solicitud',
    fields: {
      amount: 'Monto',
      pay_by: 'Fecha límite de pago',
      comments: 'Comentarios',
      late_fee: 'Recargo',
      fee_type: 'Tipo de recargo',
      late_fee_frequency: 'Frecuencia de recargo (días)',
      payment_month: 'Mes de pago',
      partial_payment: 'Permitir pagos parciales',
    },
    success: 'La solicitud se actualizó correctamente.',
    error: 'No fue posible actualizar la solicitud.',
  },
  statusActions: {
    close: 'Cerrar solicitud',
    cancel: 'Cancelar solicitud',
    success: 'El estatus de la solicitud se actualizó correctamente.',
    error: 'No fue posible actualizar el estatus de la solicitud.',
  },
  actions: {
    print: 'Imprimir',
    pay: 'Pagar solicitud',
  },
  printError: 'No fue posible preparar la impresión de la solicitud.',
  printWindowError: 'Habilita las ventanas emergentes para imprimir la solicitud.',
  paymentModal: {
    title: 'Registrar pago',
    description: 'Ingresa el pago correspondiente a esta solicitud.',
    amountLabel: 'Monto a pagar',
    commentsLabel: 'Comentarios',
    methodLabel: 'Método de pago',
    methodPlaceholder: 'Selecciona un método',
    methodLoading: 'Cargando métodos...',
    monthLabel: 'Mes del pago',
    conceptLabel: 'Concepto',
    partialLabel: 'Pago parcial',
    pendingLabel: 'Pendiente de pago',
    attachmentLabel: 'Adjuntar archivo',
    attachmentHint: 'Arrastra y suelta o haz clic para seleccionar',
    attachmentSelected: 'Archivo seleccionado',
    removeFile: 'Quitar archivo',
    cancel: 'Cancelar',
    submit: 'Registrar pago',
    submitting: 'Guardando...',
    success: 'Pago registrado correctamente.',
    error: 'No fue posible registrar el pago.',
    fileSizeError: 'El archivo supera el tamaño máximo permitido (5 MB).',
    requiredField: 'Completa los campos obligatorios.',
  },
};

const formatDate = (value, language) => {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
};

const formatDateTime = (value, language) => {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

const formatMonth = (value, language) => {
  if (!value) {
    return '';
  }

  const parsedValue = value.length > 7 ? value.slice(0, 7) : value;
  const date = new Date(`${parsedValue}-01`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'es-MX', {
    year: 'numeric',
    month: 'long',
  }).format(date);
};

const formatCurrency = (value, language) => {
  if (value == null || value === '') {
    return '';
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return String(value);
  }

  return new Intl.NumberFormat(language === 'en' ? 'en-US' : 'es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  }).format(numeric);
};

const decodeValue = (value) => {
  if (value == null) {
    return '';
  }

  const stringValue = typeof value === 'string' ? value : String(value);

  try {
    return decodeURIComponent(stringValue);
  } catch (decodeError) {
    return stringValue;
  }
};

const buildPaymentRequestBreadcrumbLabel = (payload, fallbackLabel, fallbackId) => {
  const studentName = [payload?.student?.full_name, payload?.student?.student].find(
    (candidate) => typeof candidate === 'string' && candidate.trim() !== '',
  );
  const normalizedFallbackId = decodeValue(fallbackId);
  const requestIdCandidate = [
    payload?.paymentRequest?.payment_request_id,
    payload?.paymentRequest?.payment_requestId,
    payload?.paymentRequest?.id,
    normalizedFallbackId,
  ].find((candidate) => candidate != null && String(candidate).trim() !== '');
  const requestId = requestIdCandidate != null ? String(requestIdCandidate).trim() : '';

  if (studentName && requestId) {
    return `${requestId}`;
  }

  if (studentName) {
    return studentName.trim();
  }

  if (requestId) {
    return `${fallbackLabel} → ${requestId}`;
  }

  return fallbackLabel;
};

const getFeeTypeLabel = (value, language) => {
  if (!value) {
    return '';
  }

  if (value === '%') {
    return language === 'en' ? 'Percentage' : 'Porcentaje';
  }

  if (value === '$') {
    return language === 'en' ? 'Fixed amount' : 'Monto fijo';
  }

  return value;
};

const parseNumericValue = (value) => {
  if (value == null || value === '') {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const getFriendlyText = (value) => {
  if (value == null) {
    return '';
  }

  const normalized = String(value).trim();
  if (!normalized) {
    return '';
  }

  const lower = normalized.toLowerCase();
  if (lower === 'null' || lower === 'undefined') {
    return '';
  }

  return normalized;
};

const getAmountClassName = (type) => {
  if (type === 'late_fee') {
    return 'payment-request-detail__amount--late';
  }

  if (type === 'payment') {
    return 'payment-request-detail__amount--payment';
  }

  return '';
};

const getBalanceClassName = (balance) => {
  const numeric = parseNumericValue(balance);
  if (numeric == null) {
    return '';
  }

  return numeric < 0
    ? 'payment-request-detail__balance--negative'
    : 'payment-request-detail__balance--positive';
};

const buildFormState = (paymentRequest) => ({
  amount: paymentRequest?.pr_amount ?? '',
  pay_by: paymentRequest?.pr_pay_by ? paymentRequest.pr_pay_by.slice(0, 10) : '',
  comments: paymentRequest?.pr_comments ?? '',
  late_fee: paymentRequest?.late_fee ?? '',
  fee_type: paymentRequest?.fee_type ?? '$',
  late_fee_frequency: paymentRequest?.late_fee_frequency ?? '',
  payment_month: paymentRequest?.payment_month
    ? paymentRequest.payment_month.slice(0, 7)
    : '',
  partial_payment: Boolean(paymentRequest?.partial_payment),
});

const PaymentRequestDetailPage = ({
  requestId,
  language = 'es',
  strings = {},
  onBreadcrumbChange,
  onNavigateBack,
  onStudentDetail,
}) => {
  const mergedStrings = useMemo(() => ({ ...DEFAULT_STRINGS, ...strings }), [strings]);
  const { token, logout } = useAuth();
  const [details, setDetails] = useState(null);
  const [logs, setLogs] = useState([]);
  const [logsError, setLogsError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('breakdown');
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const detailRef = useRef(null);

  const safeRequestId = requestId ? String(requestId) : '';

  const student = details?.student ?? null;
  const studentEmail = student?.email || student?.personal_email || student?.student_email;
  const studentPhone = student?.phone_number || student?.phoneNumber || student?.phone;
  const paymentRequest = details?.paymentRequest ?? null;
  const payments = Array.isArray(details?.payments) ? details.payments : [];
  const paymentInfo = details?.paymentInfo ?? null;
  const breakdown = Array.isArray(details?.breakdown) ? details.breakdown : [];
  const normalizedStudentEmail = typeof studentEmail === 'string' ? studentEmail.trim() : '';
  const normalizedStudentPhone = typeof studentPhone === 'string' ? studentPhone.trim() : '';
  const whatsappPhoneNumber = normalizedStudentPhone.replace(/\D+/g, '');
  const whatsappLink = whatsappPhoneNumber ? `https://wa.me/${whatsappPhoneNumber}` : '';
  const commentsValue = paymentRequest?.pr_comments;
  const commentsText = useMemo(() => getFriendlyText(commentsValue), [commentsValue]);
  const commentsContent = commentsText || mergedStrings.comments.empty;
  const yesLabel = mergedStrings.booleans?.yes ?? (language === 'en' ? 'Yes' : 'Sí');
  const noLabel = mergedStrings.booleans?.no ?? 'No';

  const fetchDetails = useCallback(async () => {
    if (!safeRequestId) {
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({
        lang: language ?? 'es',
        payment_request_id: safeRequestId,
      });

      const response = await fetch(
        `${API_BASE_URL}/reports/paymentrequest/details?${params.toString()}`,
        {
          headers: {
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        },
      );

      if (!response.ok) {
        handleExpiredToken(response, logout);
        throw new Error(mergedStrings.error);
      }

      const payload = await response.json();
      setDetails(payload);
      setFormData(buildFormState(payload?.paymentRequest));

      const breadcrumbLabel = buildPaymentRequestBreadcrumbLabel(
        payload,
        mergedStrings.breadcrumbFallback,
        safeRequestId,
      );
      onBreadcrumbChange?.(breadcrumbLabel);
    } catch (requestError) {
      console.error('Payment request detail error', requestError);
      const message =
        requestError instanceof Error && requestError.message
          ? requestError.message
          : mergedStrings.error;
      setError(message);
      setDetails(null);
      setFormData(null);
    } finally {
      setIsLoading(false);
    }
  }, [language, logout, mergedStrings.breadcrumbFallback, mergedStrings.error, onBreadcrumbChange, safeRequestId, token]);

  const fetchLogs = useCallback(async () => {
    if (!safeRequestId) {
      return;
    }

    setLogsError('');

    try {
      const response = await fetch(
        `${API_BASE_URL}/logs/payment-requests/${safeRequestId}?lang=${language ?? 'es'}`,
        {
          headers: {
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        },
      );

      if (!response.ok) {
        handleExpiredToken(response, logout);
        throw new Error(mergedStrings.logs.error);
      }

      const payload = await response.json();
      setLogs(Array.isArray(payload) ? payload : []);
    } catch (logsRequestError) {
      console.error('Payment request logs error', logsRequestError);
      const message =
        logsRequestError instanceof Error && logsRequestError.message
          ? logsRequestError.message
          : mergedStrings.logs.error;
      setLogsError(message);
      setLogs([]);
    }
  }, [language, logout, mergedStrings.logs?.error, safeRequestId, token]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const generalInformation = useMemo(() => {
    if (!paymentRequest) {
      return [];
    }

    return [
      { label: mergedStrings.fields.id, value: paymentRequest.payment_request_id },
      { label: mergedStrings.fields.concept, value: paymentRequest.pt_name },
      { label: mergedStrings.fields.amount, value: formatCurrency(paymentRequest.pr_amount, language) },
      { label: mergedStrings.fields.status, value: paymentRequest.ps_pr_name },
      { label: mergedStrings.fields.dueDate, value: formatDate(paymentRequest.pr_pay_by, language) },
      { label: mergedStrings.fields.createdAt, value: formatDate(paymentRequest.pr_created_at, language) },
      { label: mergedStrings.fields.level, value: student?.scholar_level_name },
      { label: mergedStrings.fields.generation, value: student?.generation },
      { label: mergedStrings.fields.gradeGroup, value: student?.grade_group },
      { label: mergedStrings.fields.lateFee, value: formatCurrency(paymentRequest.late_fee, language) },
      { label: mergedStrings.fields.frequency, value: paymentRequest.late_fee_frequency },
      { label: mergedStrings.fields.feeType, value: getFeeTypeLabel(paymentRequest.fee_type, language) },
      { label: mergedStrings.fields.paymentMonth, value: formatMonth(paymentRequest.payment_month, language) },
      { label: mergedStrings.fields.partialPayment, value: paymentRequest.partial_payment ? yesLabel : noLabel },
      { label: mergedStrings.fields.closedAt, value: formatDateTime(paymentRequest.closed_at, language) },
    ].filter((item) => item.value !== undefined && item.value !== null && item.value !== '');
  }, [language, mergedStrings.fields, noLabel, paymentRequest, student, yesLabel]);

  const paymentInfoItems = useMemo(() => {
    if (!paymentInfo) {
      return [];
    }

    return [
      {
        key: 'totalPaid',
        label: mergedStrings.paymentInfo.fields.totalPaid,
        value: formatCurrency(paymentInfo.totalPaid, language),
        rawValue: paymentInfo.totalPaid,
      },
      {
        key: 'latePeriods',
        label: mergedStrings.paymentInfo.fields.latePeriods,
        value: paymentInfo.latePeriods,
        rawValue: paymentInfo.latePeriods,
      },
      {
        key: 'lateFeeTotal',
        label: mergedStrings.paymentInfo.fields.lateFeeTotal,
        value: formatCurrency(paymentInfo.lateFeeTotal, language),
        rawValue: paymentInfo.lateFeeTotal,
      },
      {
        key: 'accumulatedFees',
        label: mergedStrings.paymentInfo.fields.accumulatedFees,
        value: formatCurrency(paymentInfo.accumulatedFees, language),
        rawValue: paymentInfo.accumulatedFees,
      },
      {
        key: 'pendingPayment',
        label: mergedStrings.paymentInfo.fields.pendingPayment,
        value: formatCurrency(paymentInfo.pendingPayment, language),
        rawValue: paymentInfo.pendingPayment,
      },
    ]
      .filter((item) => item.value !== undefined && item.value !== null && item.value !== '')
      .map((item) => ({
        ...item,
        valueClassName:
          item.key === 'pendingPayment' && parseNumericValue(item.rawValue) > 0
            ? 'payment-request-detail__summary-value--danger'
            : '',
      }));
  }, [language, mergedStrings.paymentInfo.fields, paymentInfo]);

  const breakdownWithLabels = useMemo(() => {
    return breakdown.map((item) => ({
      ...item,
      typeLabel: mergedStrings.breakdown?.typeLabels?.[item.type] ?? item.type,
    }));
  }, [breakdown, mergedStrings.breakdown]);

  const updatePaymentRequest = useCallback(
    async (payload) => {
      if (!safeRequestId) {
        return;
      }

      const response = await fetch(
        `${API_BASE_URL}/reports/payment-request/update/${safeRequestId}?lang=${language ?? 'es'}`,
        {
          method: 'PUT',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ data: payload }),
        },
      );

      if (!response.ok) {
        handleExpiredToken(response, logout);
        throw new Error(mergedStrings.edit.error);
      }

      return response.json();
    },
    [language, logout, mergedStrings.edit.error, safeRequestId, token],
  );

  const handleFormSubmit = useCallback(
    async (event) => {
      event.preventDefault();

      if (!formData) {
        return;
      }

      const payload = {
        amount: formData.amount === '' ? null : Number(formData.amount),
        pay_by: formData.pay_by ? `${formData.pay_by} 00:00:00` : null,
        comments: formData.comments ?? '',
        late_fee: formData.late_fee === '' ? null : Number(formData.late_fee),
        fee_type: formData.fee_type || '$',
        late_fee_frequency:
          formData.late_fee_frequency === '' ? null : Number(formData.late_fee_frequency),
        payment_month: formData.payment_month || null,
        partial_payment: Boolean(formData.partial_payment),
      };

      setIsSaving(true);
      try {
        await updatePaymentRequest(payload);
        setToast({ type: 'success', message: mergedStrings.edit.success });
        setIsEditing(false);
        await fetchDetails();
      } catch (updateError) {
        console.error('Failed to update payment request', updateError);
        setToast({ type: 'error', message: mergedStrings.edit.error });
      } finally {
        setIsSaving(false);
      }
    },
    [fetchDetails, formData, mergedStrings.edit.error, mergedStrings.edit.success, updatePaymentRequest],
  );

  const handleStatusChange = useCallback(
    async (statusId) => {
      if (!statusId) {
        return;
      }

      setIsSaving(true);
      try {
        await updatePaymentRequest({ payment_status_id: statusId });
        setToast({ type: 'success', message: mergedStrings.statusActions.success });
        await Promise.all([fetchDetails(), fetchLogs()]);
      } catch (statusError) {
        console.error('Failed to update payment request status', statusError);
        setToast({ type: 'error', message: mergedStrings.statusActions.error });
      } finally {
        setIsSaving(false);
      }
    },
    [fetchDetails, fetchLogs, mergedStrings.statusActions.error, mergedStrings.statusActions.success, updatePaymentRequest],
  );

  const handleInputChange = useCallback((event) => {
    const { name, value, type, checked } = event.target;
    setFormData((previous) => ({
      ...previous,
      [name]: type === 'checkbox' ? checked : value,
    }));
  }, []);

  const handleToggleEditing = useCallback(() => {
    if (!paymentRequest) {
      return;
    }

    setIsEditing((prev) => {
      const next = !prev;
      if (next) {
        setFormData(buildFormState(paymentRequest));
      }
      return next;
    });
  }, [paymentRequest]);

  const handleViewStudent = useCallback(() => {
    if (!student?.student_id) {
      return;
    }

    onStudentDetail?.({
      id: student.student_id,
      name: student.full_name,
      registerId: student.payment_reference,
    });
  }, [onStudentDetail, student]);

  const canViewStudent = Boolean(onStudentDetail && student?.student_id);
  const studentNameButtonProps = useMemo(() => {
    if (!mergedStrings.viewStudent) {
      return { 'aria-label': 'Ver detalle del alumno' };
    }

    return { 'aria-label': mergedStrings.viewStudent };
  }, [mergedStrings.viewStudent]);

  const handleEmailClick = useCallback(() => {
    if (!normalizedStudentEmail) {
      return;
    }

    const mailto = `mailto:${encodeURIComponent(normalizedStudentEmail)}`;
    if (typeof window !== 'undefined') {
      window.location.href = mailto;
    }
  }, [normalizedStudentEmail]);

  const handlePrint = useCallback(async () => {
    if (typeof window === 'undefined' || typeof document === 'undefined' || !detailRef.current) {
      return;
    }

    setIsPrinting(true);
    try {
      await new Promise((resolve) => {
        if (typeof window.requestAnimationFrame === 'function') {
          window.requestAnimationFrame(() => resolve());
        } else {
          setTimeout(resolve, 0);
        }
      });

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        setToast({ type: 'error', message: mergedStrings.printWindowError });
        return;
      }

      const printLocale = language === 'en' ? 'en-US' : 'es-MX';
      const formatter = new Intl.DateTimeFormat(printLocale, {
        dateStyle: 'long',
        timeStyle: 'short',
      });
      const printDate = formatter.format(new Date());
      const schoolName = student?.full_name || mergedStrings.breadcrumbFallback;
      const requestTitle = paymentRequest
        ? `Solicitud de pago #${paymentRequest.payment_request_id}`
        : mergedStrings.generalTitle;
      const faviconLink = document.querySelector('link[rel*="icon"]');
      const faviconUrl = faviconLink?.href || '/favicon.ico';
      const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
        .map((node) => node.outerHTML)
        .join('\n');

      const clonedContent = detailRef.current.cloneNode(true);
      const printDocument = printWindow.document;
      printDocument.open();
      printDocument.write(`
        <html>
          <head>
            <meta charset="utf-8" />
            <title>${requestTitle}</title>
            ${styles}
            <link rel="icon" href="${faviconUrl}" />
            <style>
              body {
                font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                padding: 2rem;
                background: #ffffff;
                color: #0f172a;
              }

              .print-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 1.5rem;
                border-bottom: 1px solid #e2e8f0;
                padding-bottom: 1rem;
              }

              .print-header__identity {
                display: flex;
                align-items: center;
                gap: 1rem;
              }

              .print-header__favicon {
                width: 48px;
                height: 48px;
              }

              .print-header__title {
                margin: 0;
                font-size: 1.5rem;
              }

              .print-header__subtitle {
                margin: 0;
                font-size: 1rem;
                color: #475569;
              }

              .print-header__meta {
                text-align: right;
                font-size: 0.95rem;
                color: #334155;
              }

              .payment-request-detail__actions,
              .ui-button,
              .payment-request-detail__tabs {
                display: none !important;
              }
            </style>
          </head>
          <body>
            <header class="print-header">
              <div class="print-header__identity">
                <img src="${faviconUrl}" alt="Logotipo" class="print-header__favicon" />
                <div>
                  <h1 class="print-header__title">${schoolName}</h1>
                  <p class="print-header__subtitle">${requestTitle}</p>
                </div>
              </div>
              <div class="print-header__meta">
                <span>${printDate}</span>
              </div>
            </header>
            ${clonedContent.outerHTML}
          </body>
        </html>
      `);
      printDocument.close();

      const finalizePrint = () => {
        printWindow.focus();
        printWindow.print();
        printWindow.close();
      };

      if (printWindow.document.readyState === 'complete') {
        finalizePrint();
      } else {
        printWindow.addEventListener('load', finalizePrint, { once: true });
      }
    } catch (printError) {
      console.error('Failed to print payment request', printError);
      setToast({ type: 'error', message: mergedStrings.printError });
    } finally {
      setIsPrinting(false);
    }
  }, [language, mergedStrings.breadcrumbFallback, mergedStrings.generalTitle, mergedStrings.printError, mergedStrings.printWindowError, paymentRequest, student]);

  const handleOpenPaymentModal = useCallback(() => {
    if (!details) {
      return;
    }
    setIsPaymentModalOpen(true);
  }, [details]);

  const handleClosePaymentModal = useCallback(() => {
    setIsPaymentModalOpen(false);
  }, []);

  const handlePaymentSuccess = useCallback(
    (message) => {
      setToast({ type: 'success', message: message || mergedStrings.paymentModal.success });
      fetchDetails();
    },
    [fetchDetails, mergedStrings.paymentModal.success],
  );

  const payButtonLabel =
    mergedStrings.actions?.pay || mergedStrings.paymentModal?.submit || DEFAULT_STRINGS.actions.pay;

  return (
    <div className="page">
      <header className="page__header page__header--actions">
        <ActionButton type="button" variant="text" onClick={() => onNavigateBack?.()}>
          {mergedStrings.back}
        </ActionButton>
        <div className="payment-request-detail__actions">
          <ActionButton type="button" onClick={handleOpenPaymentModal} disabled={!details}>
            {payButtonLabel}
          </ActionButton>
          <ActionButton
            type="button"
            variant="secondary"
            onClick={handlePrint}
            disabled={!details || isPrinting}
          >
            {mergedStrings.actions.print}
          </ActionButton>
        </div>
      </header>

      <div className="page__layout">
        <section className="page__content payment-request-detail" ref={detailRef}>
          {isLoading ? (
            <div className="page__empty-state">{mergedStrings.loading}</div>
          ) : error ? (
            <UiCard className="payment-request-detail__card">
              <p className="text-danger mb-3">{error}</p>
              <ActionButton type="button" onClick={fetchDetails}>
                {mergedStrings.retry}
              </ActionButton>
            </UiCard>
          ) : !paymentRequest ? (
            <div className="page__empty-state">{mergedStrings.error}</div>
          ) : (
            <>
              {paymentInfoItems.length > 0 && (
                <UiCard className="payment-request-detail__card">
                  <h2 className="payment-request-detail__title">{mergedStrings.paymentInfo.title}</h2>
                  <div className="payment-request-detail__summary-grid">
                    {paymentInfoItems.map((item) => (
                      <div key={item.label} className="payment-request-detail__summary-item">
                        <span>{item.label}</span>
                        <strong className={item.valueClassName || undefined}>{item.value ?? '—'}</strong>
                      </div>
                    ))}
                  </div>
                </UiCard>
              )}

              <UiCard className="payment-request-detail__card">
                <h2 className="payment-request-detail__title mb-3">{mergedStrings.studentTitle}</h2>
                <StudentInfo
                  name={student?.full_name}
                  fallbackName="—"
                  metaLabel={mergedStrings.fields.id}
                  metaValue={student?.payment_reference}
                  onClick={canViewStudent ? handleViewStudent : undefined}
                  disabled={!canViewStudent}
                  nameButtonProps={canViewStudent ? studentNameButtonProps : undefined}
                />
                <div className="payment-request-detail__student-extra">
                  <div>
                    <span>{mergedStrings.contactLabels.email}</span>
                    {normalizedStudentEmail ? (
                      <button
                        type="button"
                        className="payment-request-detail__email-button"
                        onClick={handleEmailClick}
                      >
                        <EmailIcon />
                        <span>{normalizedStudentEmail}</span>
                      </button>
                    ) : (
                      <strong>—</strong>
                    )}
                  </div>
                  <div>
                    <span>{mergedStrings.contactLabels.phone}</span>
                    {whatsappLink ? (
                      <a
                        href={whatsappLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="payment-request-detail__phone-link"
                      >
                        <WhatsappIcon />
                        <span>{normalizedStudentPhone}</span>
                      </a>
                    ) : (
                      <strong>{studentPhone || '—'}</strong>
                    )}
                  </div>
                </div>
              </UiCard>

              <UiCard className="payment-request-detail__card">
                <div className="payment-request-detail__card-header">
                  <h1 className="payment-request-detail__title">{mergedStrings.generalTitle}</h1>
                  <div className="payment-request-detail__actions">
                    <ActionButton
                      type="button"
                      variant="secondary"
                      onClick={handleToggleEditing}
                      disabled={!paymentRequest}
                    >
                      {isEditing ? mergedStrings.edit.cancel : mergedStrings.edit.button}
                    </ActionButton>
                  <ActionButton
                    type="button"
                    variant="primary"
                    onClick={() => handleStatusChange(7)}
                    disabled={isSaving}
                  >
                    {mergedStrings.statusActions.close}
                  </ActionButton>
                  <ActionButton
                    type="button"
                    variant="danger"
                    onClick={() => handleStatusChange(8)}
                    disabled={isSaving}
                  >
                    {mergedStrings.statusActions.cancel}
                  </ActionButton>
                  </div>
                </div>

                {!isEditing ? (
                  <dl className="payment-request-detail__list">
                    {generalInformation.map((item) => (
                      <div key={item.label} className="payment-request-detail__list-item">
                        <dt>{item.label}</dt>
                        <dd>{item.value || '—'}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <form className="payment-request-detail__form" onSubmit={handleFormSubmit}>
                    <h2 className="payment-request-detail__subtitle">{mergedStrings.edit.formTitle}</h2>
                    <div className="payment-request-detail__form-grid">
                      <label className="payment-request-detail__form-field">
                        <span>{mergedStrings.edit.fields.amount}</span>
                        <input
                          type="number"
                          step="0.01"
                          name="amount"
                          value={formData?.amount ?? ''}
                          onChange={handleInputChange}
                          required
                        />
                      </label>
                      <label className="payment-request-detail__form-field">
                        <span>{mergedStrings.edit.fields.pay_by}</span>
                        <input
                          type="date"
                          name="pay_by"
                          value={formData?.pay_by ?? ''}
                          onChange={handleInputChange}
                          required
                        />
                      </label>
                      <label className="payment-request-detail__form-field">
                        <span>{mergedStrings.edit.fields.late_fee}</span>
                        <input
                          type="number"
                          step="0.01"
                          name="late_fee"
                          value={formData?.late_fee ?? ''}
                          onChange={handleInputChange}
                        />
                      </label>
                      <label className="payment-request-detail__form-field">
                        <span>{mergedStrings.edit.fields.fee_type}</span>
                        <select
                          name="fee_type"
                          value={formData?.fee_type ?? '$'}
                          onChange={handleInputChange}
                        >
                          <option value="$">$</option>
                          <option value="%">%</option>
                        </select>
                      </label>
                      <label className="payment-request-detail__form-field">
                        <span>{mergedStrings.edit.fields.late_fee_frequency}</span>
                        <input
                          type="number"
                          name="late_fee_frequency"
                          value={formData?.late_fee_frequency ?? ''}
                          onChange={handleInputChange}
                        />
                      </label>
                      <label className="payment-request-detail__form-field">
                        <span>{mergedStrings.edit.fields.payment_month}</span>
                        <input
                          type="month"
                          name="payment_month"
                          value={formData?.payment_month ?? ''}
                          onChange={handleInputChange}
                        />
                      </label>
                      <label className="payment-request-detail__form-field payment-request-detail__form-field--full">
                        <span>{mergedStrings.edit.fields.comments}</span>
                        <textarea
                          name="comments"
                          rows={3}
                          value={formData?.comments ?? ''}
                          onChange={handleInputChange}
                        />
                      </label>
                      <label className="payment-request-detail__form-checkbox">
                        <input
                          type="checkbox"
                          name="partial_payment"
                          checked={Boolean(formData?.partial_payment)}
                          onChange={handleInputChange}
                        />
                        <span>{mergedStrings.edit.fields.partial_payment}</span>
                      </label>
                    </div>
                    <div className="payment-request-detail__form-actions">
                      <ActionButton
                        type="button"
                        variant="ghost"
                        onClick={handleToggleEditing}
                        disabled={isSaving}
                      >
                        {mergedStrings.edit.cancel}
                      </ActionButton>
                      <ActionButton type="submit" disabled={isSaving}>
                        {mergedStrings.edit.save}
                      </ActionButton>
                    </div>
                  </form>
                )}
              </UiCard>

              <UiCard className="payment-request-detail__card">
                <h2 className="payment-request-detail__title">{mergedStrings.payments.title}</h2>
                {payments.length === 0 ? (
                  <p className="payment-request-detail__empty">{mergedStrings.payments.empty}</p>
                ) : (
                  <div className="payment-request-detail__table-wrapper">
                    <table className="payment-request-detail__table">
                      <thead>
                        <tr>
                          <th>{mergedStrings.payments.columns.id}</th>
                          <th>{mergedStrings.payments.columns.concept}</th>
                          <th>{mergedStrings.payments.columns.status}</th>
                          <th>{mergedStrings.payments.columns.date}</th>
                          <th>{mergedStrings.payments.columns.amount}</th>
                          <th>{mergedStrings.payments.columns.comments}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payments.map((payment) => (
                          <tr key={payment.payment_id}>
                            <td>{payment.payment_id ?? '—'}</td>
                            <td>{payment.pt_name ?? payment.type ?? '—'}</td>
                            <td>{payment.payment_status_name ?? '—'}</td>
                            <td>{formatDateTime(payment.pay_created_at, language)}</td>
                            <td>{formatCurrency(payment.amount, language) || '—'}</td>
                            <td>{payment.comments ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </UiCard>

              <UiCard className="payment-request-detail__card">
                <div className="payment-request-detail__card-header">
                  <h2 className="payment-request-detail__title">{mergedStrings.breakdown.title}</h2>
                </div>
                <div className="payment-request-detail__tabs">
                  <button
                    type="button"
                    className={`payment-request-detail__tab ${
                      activeTab === 'breakdown' ? 'payment-request-detail__tab--active' : ''
                    }`}
                    onClick={() => setActiveTab('breakdown')}
                  >
                    {mergedStrings.tabs.breakdown}
                  </button>
                  <button
                    type="button"
                    className={`payment-request-detail__tab ${
                      activeTab === 'activity' ? 'payment-request-detail__tab--active' : ''
                    }`}
                    onClick={() => setActiveTab('activity')}
                  >
                    {mergedStrings.tabs.activity}
                  </button>
                </div>

                {activeTab === 'breakdown' ? (
                  breakdownWithLabels.length === 0 ? (
                    <p className="payment-request-detail__empty">{mergedStrings.breakdown.empty}</p>
                  ) : (
                    <div className="payment-request-detail__table-wrapper">
                      <table className="payment-request-detail__table">
                        <thead>
                          <tr>
                            <th>{mergedStrings.breakdown.columns.id}</th>
                            <th>{mergedStrings.breakdown.columns.concept}</th>
                            <th>{mergedStrings.breakdown.columns.status}</th>
                            <th>{mergedStrings.breakdown.columns.date}</th>
                            <th>{mergedStrings.breakdown.columns.amount}</th>
                            <th>{mergedStrings.breakdown.columns.balance}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {breakdownWithLabels.map((item, index) => (
                            <tr key={`${item.payment_id ?? 'row'}-${index}`}>
                              <td>{item.payment_id ?? '—'}</td>
                              <td>{item.typeLabel ?? '—'}</td>
                              <td>{item.status_name ?? '—'}</td>
                              <td>{formatDateTime(item.date, language)}</td>
                              <td
                                className={`payment-request-detail__amount ${getAmountClassName(item.type)}`.trim()}
                              >
                                {formatCurrency(item.amount, language) || '—'}
                              </td>
                              <td
                                className={`payment-request-detail__balance ${getBalanceClassName(item.balance)}`.trim()}
                              >
                                {formatCurrency(item.balance, language) || '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                ) : (
                  <div className="payment-request-detail__activity">
                  <div className="payment-request-detail__comments">
                    <h3>{mergedStrings.comments.title}</h3>
                    <p>{commentsContent}</p>
                  </div>
                    <div className="payment-request-detail__logs">
                      <h3>{mergedStrings.logs.title}</h3>
                      {logsError ? (
                        <p className="text-danger">{logsError}</p>
                      ) : logs.length === 0 ? (
                        <p>{mergedStrings.logs.empty}</p>
                      ) : (
                        <ul>
                          {logs.map((log, index) => (
                            <li key={`${log.payment_request_id}-${index}`} className="payment-request-detail__log-entry">
                              <div className="payment-request-detail__log-header">
                                <strong>{log.responsable_full_name}</strong>
                                <span>{log.role_name}</span>
                                <time>{formatDateTime(log.updated_at, language)}</time>
                              </div>
                              <p className="payment-request-detail__log-description">{log.log_type_name}</p>
                              {Array.isArray(log.changes) && log.changes.length > 0 && (
                                <ul className="payment-request-detail__log-changes">
                                  {log.changes.map((change, changeIndex) => (
                                    <li key={`${change.field}-${changeIndex}`}>
                                      <span className="payment-request-detail__log-field">{change.field}</span>
                                      <span>
                                        {change.from ?? '—'} → {change.to ?? '—'}
                                      </span>
                                      {change.comments ? <p>{change.comments}</p> : null}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}
              </UiCard>
            </>
          )}
        </section>
      </div>

      <PaymentRequestPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={handleClosePaymentModal}
        language={language}
        token={token}
        logout={logout}
        paymentRequest={paymentRequest}
        paymentInfo={paymentInfo}
        yesLabel={yesLabel}
        noLabel={noLabel}
        strings={mergedStrings.paymentModal}
        onSuccess={handlePaymentSuccess}
        studentId={student?.student_id}
      />
      <GlobalToast alert={toast} onClose={() => setToast(null)} />
    </div>
  );
};

export default PaymentRequestDetailPage;
