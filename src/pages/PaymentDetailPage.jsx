import { useCallback, useEffect, useMemo, useState } from 'react';
import GlobalToast from '../components/GlobalToast.jsx';
import ActionButton from '../components/ui/ActionButton.jsx';
import UiCard from '../components/ui/UiCard.jsx';
import { API_BASE_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import { handleExpiredToken } from '../utils/auth';
import './PaymentDetailPage.css';

const SUPPORTED_LANGUAGES = ['es', 'en'];

const DEFAULT_STRINGS = {
  back: 'Volver a pagos',
  breadcrumbFallback: 'Detalle de pago',
  loading: 'Cargando información del pago...',
  error: 'No fue posible cargar la información del pago.',
  retry: 'Reintentar',
  generalTitle: 'Información general',
  actions: {
    print: 'Imprimir',
    approve: 'Aprobar',
    reject: 'Rechazar',
  },
  editing: {
    editButton: 'Editar detalles',
    cancelButton: 'Cancelar edición',
    saveButton: 'Guardar cambios',
    savingButton: 'Guardando cambios...',
    unsavedChanges: 'Si sales, perderás los cambios sin guardar.',
    loadingOption: 'Cargando opciones...',
    validation: {
      conceptRequired: 'Selecciona un concepto de pago.',
      throughRequired: 'Selecciona un método de pago.',
      createdAtRequired: 'Ingresa la fecha de creación.',
      monthRequired: 'Selecciona el mes del pago.',
      amountRequired: 'Ingresa el monto del pago.',
    },
  },
  actionFeedback: {
    updateSuccess: 'El pago se actualizó correctamente.',
    updateError: 'No fue posible actualizar el pago.',
    detailsUpdateSuccess: 'Los detalles del pago se actualizaron correctamente.',
    detailsUpdateError: 'No fue posible actualizar los detalles del pago.',
    receiptUploadSuccess: 'El comprobante se guardó correctamente.',
    receiptUploadError: 'No fue posible guardar el comprobante.',
    printError: 'No fue posible preparar la impresión del pago.',
    printWindowError: 'Habilita las ventanas emergentes para imprimir el pago.',
  },
  confirmations: {
    confirmButtonText: 'Sí, continuar',
    cancelButtonText: 'Cancelar',
    approve: {
      title: '¿Aprobar pago?',
      message: 'Confirma que deseas aprobar el pago seleccionado.',
      confirmButtonText: 'Sí, aprobar',
      cancelButtonText: 'Cancelar',
    },
    reject: {
      title: '¿Rechazar pago?',
      message: 'Confirma que deseas rechazar el pago seleccionado.',
      confirmButtonText: 'Sí, rechazar',
      cancelButtonText: 'Cancelar',
    },
  },
  studentSection: {
    title: 'Información del estudiante',
    fields: {
      fullName: 'Nombre completo',
      email: 'Correo electrónico',
      personalEmail: 'Correo personal',
      reference: 'Referencia de pago',
      phone: 'Teléfono',
      generation: 'Generación',
      group: 'Grupo',
      scholarLevel: 'Grado escolar',
    },
  },
  paymentSection: {
    title: 'Detalles del pago',
    fields: {
      status: 'Estatus',
      createdAt: 'Fecha de creación',
      paymentMonth: 'Mes del pago',
      amount: 'Monto',
      paymentType: 'Método de pago',
      paymentConcept: 'Concepto de pago',
      comments: 'Comentarios',
    },
  },
  attachments: {
    title: 'Comprobantes',
    emptyDescription: 'No hay comprobante adjunto. Puedes adjuntar un archivo para complementar la validación.',
    uploadLabel: 'Adjuntar comprobante',
    replaceLabel: 'Actualizar comprobante',
    selectedFile: 'Archivo seleccionado:',
    submitLabel: 'Guardar comprobante',
    uploadingLabel: 'Guardando comprobante...',
    missingSelection: 'Selecciona un archivo para continuar.',
    viewLabel: 'Ver comprobante',
    downloadLabel: 'Descargar',
    closeLabel: 'Cerrar',
    missingFileName: 'Comprobante sin nombre',
    previewError: 'No fue posible cargar el comprobante.',
    previewLoading: 'Cargando comprobante...',
  },
  logs: {
    title: 'Registro de actividad',
    empty: 'No hay actividad registrada para este pago.',
    error: 'No fue posible cargar el historial de actividad.',
  },
};

const SKELETON_DETAIL_ITEMS = Array.from({ length: 6 }, (_, index) => index);
const SKELETON_ATTACHMENT_ROWS = Array.from({ length: 3 }, (_, index) => index);
const SKELETON_LOG_ROWS = Array.from({ length: 4 }, (_, index) => index);

const normalizeLanguage = (language) => (SUPPORTED_LANGUAGES.includes(language) ? language : 'es');

const formatDateTime = (value, language) => {
  if (!value) {
    return null;
  }

  try {
    const formatter = new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'es-MX', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    return formatter.format(new Date(value));
  } catch (error) {
    console.warn('Unable to format date', error);
    return String(value);
  }
};

const formatMonth = (value, language) => {
  if (!value) {
    return null;
  }

  try {
    const formatter = new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'es-MX', {
      month: 'long',
      year: 'numeric',
    });

    return formatter.format(new Date(value));
  } catch (error) {
    console.warn('Unable to format month', error);
    return String(value);
  }
};

const formatCurrency = (value, language) => {
  if (value == null || value === '') {
    return null;
  }

  const numeric = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(numeric)) {
    return String(value);
  }

  try {
    const formatter = new Intl.NumberFormat(language === 'en' ? 'en-US' : 'es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return formatter.format(numeric);
  } catch (error) {
    console.warn('Unable to format currency', error);
    return numeric.toFixed(2);
  }
};

const buildStatusVariant = (statusName) => {
  if (!statusName) {
    return 'neutral';
  }

  const normalized = statusName.toLowerCase();

  if (normalized.includes('valid') || normalized.includes('aprob')) {
    return 'success';
  }

  if (normalized.includes('rech')) {
    return 'danger';
  }

  if (normalized.includes('pend') || normalized.includes('sin')) {
    return 'warning';
  }

  return 'info';
};

const buildProtectedFilePath = (path) => {
  if (!path) {
    return null;
  }

  const segments = String(path)
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

  return `${API_BASE_URL}/protectedfiles/${segments}`;
};

const toDateTimeLocalValue = (value) => {
  if (!value) {
    return '';
  }

  const match = String(value).match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/);
  if (match) {
    return match[1];
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  return parsed.toISOString().slice(0, 16);
};

const normalizeDateTimeForPayload = (value) => {
  if (!value) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value)) {
    return value.length === 16 ? `${value}:00` : value;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toISOString().replace(/Z$/, '');
};

const toMonthInputValue = (value) => {
  if (!value) {
    return '';
  }

  const match = String(value).match(/^(\d{4}-\d{2})/);
  return match ? match[1] : '';
};

const buildMonthPayload = (value) => {
  if (!value) {
    return null;
  }

  if (/^\d{4}-\d{2}$/.test(value)) {
    return `${value}-01`;
  }

  return value;
};

const mergeCatalogOptions = (current = [], next = []) => {
  const map = new Map();
  [...current, ...next].forEach((option) => {
    if (!option || !option.id) {
      return;
    }
    if (!map.has(option.id)) {
      map.set(option.id, option);
    }
  });
  return Array.from(map.values());
};

const extractCatalogItems = (payload) => {
  if (!payload) {
    return [];
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  const candidates = [
    payload.content,
    payload.data,
    payload.items,
    payload.results,
    payload.list,
    payload.catalog,
    payload.catalogs,
    payload.response,
    payload.data?.items,
    payload.data?.results,
    payload.data?.data,
  ];

  return candidates.find(Array.isArray) ?? [];
};

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

const PaymentDetailPage = ({
  paymentId,
  language = 'es',
  strings = {},
  onBreadcrumbChange,
}) => {
  const normalizedLanguage = normalizeLanguage(language);
  const mergedStrings = useMemo(() => ({
    ...DEFAULT_STRINGS,
    ...strings,
    actions: { ...DEFAULT_STRINGS.actions, ...(strings.actions ?? {}) },
    editing: {
      ...DEFAULT_STRINGS.editing,
      ...(strings.editing ?? {}),
      validation: {
        ...DEFAULT_STRINGS.editing.validation,
        ...((strings.editing && strings.editing.validation) || {}),
      },
    },
    confirmations: {
      ...DEFAULT_STRINGS.confirmations,
      ...(strings.confirmations ?? {}),
      approve: {
        ...DEFAULT_STRINGS.confirmations.approve,
        ...((strings.confirmations && strings.confirmations.approve) || {}),
      },
      reject: {
        ...DEFAULT_STRINGS.confirmations.reject,
        ...((strings.confirmations && strings.confirmations.reject) || {}),
      },
    },
    studentSection: {
      ...DEFAULT_STRINGS.studentSection,
      ...(strings.studentSection ?? {}),
      fields: {
        ...DEFAULT_STRINGS.studentSection.fields,
        ...((strings.studentSection && strings.studentSection.fields) || {}),
      },
    },
    paymentSection: {
      ...DEFAULT_STRINGS.paymentSection,
      ...(strings.paymentSection ?? {}),
      fields: {
        ...DEFAULT_STRINGS.paymentSection.fields,
        ...((strings.paymentSection && strings.paymentSection.fields) || {}),
      },
    },
    attachments: {
      ...DEFAULT_STRINGS.attachments,
      ...(strings.attachments ?? {}),
    },
    logs: {
      ...DEFAULT_STRINGS.logs,
      ...(strings.logs ?? {}),
    },
    actionFeedback: {
      ...DEFAULT_STRINGS.actionFeedback,
      ...(strings.actionFeedback ?? {}),
    },
  }), [strings]);

  const { token, logout } = useAuth();

  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState(null);

  const [selectedFile, setSelectedFile] = useState(null);

  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [receiptError, setReceiptError] = useState(null);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState(null);
  const [receiptFileName, setReceiptFileName] = useState('');
  const [receiptUploadError, setReceiptUploadError] = useState('');
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);
  const receiptPath = payment?.receipt_path ?? null;
  const receiptDisplayName = payment?.receipt_file_name ?? null;
  const [toast, setToast] = useState(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSavingDetails, setIsSavingDetails] = useState(false);
  const [editValues, setEditValues] = useState({
    paymentConceptId: '',
    paymentThroughId: '',
    paymentCreatedAt: '',
    paymentMonth: '',
    amount: '',
    comments: '',
  });
  const [editError, setEditError] = useState('');
  const [conceptOptions, setConceptOptions] = useState([]);
  const [throughOptions, setThroughOptions] = useState([]);
  const [isLoadingConcepts, setIsLoadingConcepts] = useState(false);
  const [isLoadingThrough, setIsLoadingThrough] = useState(false);

  const { isApproved: isPaymentApproved, isRejected: isPaymentRejected } = useMemo(() => {
    if (!payment) {
      return { isApproved: false, isRejected: false };
    }

    const statusIdCandidates = [
      payment.payment_status_id,
      payment.paymentStatusId,
      payment.status_id,
      payment.statusId,
    ];

    let numericStatusId = null;

    for (const candidate of statusIdCandidates) {
      if (candidate != null && candidate !== '') {
        const numericValue = Number(candidate);
        if (!Number.isNaN(numericValue)) {
          numericStatusId = numericValue;
          break;
        }
      }
    }

    const statusName =
      payment.payment_status_name ||
      payment.status_name ||
      payment.status ||
      payment.statusName ||
      '';

    const normalizedStatus =
      typeof statusName === 'string' ? statusName.toLowerCase() : '';

    const isApproved =
      numericStatusId === 3 ||
      normalizedStatus.includes('aprob') ||
      normalizedStatus.includes('valid');
    const isRejected =
      numericStatusId === 4 || normalizedStatus.includes('rech');

    return { isApproved, isRejected };
  }, [payment]);

  const isPaymentFinalized = isPaymentApproved || isPaymentRejected;

  useEffect(() => {
    setIsReceiptModalOpen(false);
    setReceiptError(null);
    setReceiptLoading(false);
    setReceiptFileName('');
    setReceiptUploadError('');
    setSelectedFile(null);
    setFileInputKey((previous) => previous + 1);
    setReceiptPreviewUrl((previous) => {
      if (previous) {
        URL.revokeObjectURL(previous);
      }
      return null;
    });
  }, [paymentId]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return () => {};
    }

    if (isReceiptModalOpen) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }

    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [isReceiptModalOpen]);

  useEffect(() => {
    return () => {
      if (receiptPreviewUrl) {
        URL.revokeObjectURL(receiptPreviewUrl);
      }
    };
  }, [receiptPreviewUrl]);

  const requestPaymentDetail = useCallback(async () => {
    if (!paymentId) {
      return null;
    }

    const params = new URLSearchParams();
    params.set('payment_id', String(paymentId));
    params.set('lang', normalizedLanguage);

    const url = `${API_BASE_URL}/reports/payments?${params.toString()}`;
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch (parseError) {
      payload = null;
    }

    if (!response.ok) {
      handleExpiredToken(response, logout);
      const message =
        (payload && (payload.message || payload.error)) || mergedStrings.error || 'Error al cargar el pago.';
      throw new Error(message);
    }

    const content = Array.isArray(payload?.content) ? payload.content : [];
    return content[0] ?? null;
  }, [
    logout,
    mergedStrings.error,
    normalizedLanguage,
    paymentId,
    token,
  ]);

  const fetchPaymentDetail = useCallback(async () => {
    if (!paymentId) {
      setPayment(null);
      setError(mergedStrings.error);
      onBreadcrumbChange?.(mergedStrings.breadcrumbFallback);
      return null;
    }

    setLoading(true);
    setError(null);
    onBreadcrumbChange?.(mergedStrings.breadcrumbFallback);

    let detail = null;
    try {
      detail = await requestPaymentDetail();
      setPayment(detail);
      const breadcrumbLabel = [
        detail?.payment_id,
        detail?.paymentId,
        detail?.id,
        paymentId,
      ].find((value) => typeof value === 'string' || typeof value === 'number');

      if (breadcrumbLabel != null && breadcrumbLabel !== '') {
        onBreadcrumbChange?.(String(breadcrumbLabel));
      } else {
        onBreadcrumbChange?.(mergedStrings.breadcrumbFallback);
      }
    } catch (requestError) {
      console.error('Failed to load payment detail', requestError);
      const fallbackMessage =
        requestError instanceof Error && requestError.message
          ? requestError.message
          : mergedStrings.error;
      setError(fallbackMessage);
      onBreadcrumbChange?.(mergedStrings.breadcrumbFallback);
      setPayment(null);
    } finally {
      setLoading(false);
    }
    return detail;
  }, [
    mergedStrings.breadcrumbFallback,
    mergedStrings.error,
    normalizedLanguage,
    onBreadcrumbChange,
    paymentId,
    requestPaymentDetail,
  ]);

  const handleUpdateStatus = useCallback(
    async (statusId) => {
      if (!paymentId) {
        return;
      }

      const swalInstance = getSwalInstance();
      const actionKey = statusId === 3 ? 'approve' : statusId === 4 ? 'reject' : 'update';
      const confirmationConfig =
        (mergedStrings.confirmations && mergedStrings.confirmations[actionKey]) || {};
      const confirmButtonText =
        confirmationConfig.confirmButtonText || mergedStrings.confirmations?.confirmButtonText;
      const cancelButtonText =
        confirmationConfig.cancelButtonText || mergedStrings.confirmations?.cancelButtonText;
      const confirmTitle =
        confirmationConfig.title ||
        mergedStrings.actions?.[actionKey] ||
        mergedStrings.actionFeedback.updateSuccess;
      const confirmMessage = confirmationConfig.message || '';

      if (swalInstance) {
        const confirmation = await swalInstance.fire({
          title: confirmTitle,
          text: confirmMessage,
          icon: confirmationConfig.icon || 'question',
          showCancelButton: true,
          confirmButtonText: confirmButtonText || mergedStrings.actions?.[actionKey] || 'OK',
          cancelButtonText: cancelButtonText || mergedStrings.confirmations?.cancelButtonText || 'Cancelar',
          reverseButtons: true,
          focusCancel: true,
        });

        if (!confirmation.isConfirmed) {
          return;
        }
      } else if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
        const fallbackMessage = [confirmTitle, confirmMessage].filter(Boolean).join('\n\n');
        const confirmed = window.confirm(fallbackMessage || '');
        if (!confirmed) {
          return;
        }
      }

      setIsUpdatingStatus(true);
      try {
        const url = `${API_BASE_URL}/payments/update/${paymentId}?lang=${normalizedLanguage}`;
        const formData = new FormData();
        formData.append(
          'request',
          new Blob([JSON.stringify({ payment_status_id: statusId })], {
            type: 'application/json',
          }),
        );

        const response = await fetch(url, {
          method: 'PUT',
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: formData,
        });

        let payload = null;
        try {
          payload = await response.json();
        } catch (parseError) {
          payload = null;
        }

        if (!response.ok) {
          handleExpiredToken(response, logout);
          const message =
            (payload && (payload.message || payload.error)) || mergedStrings.actionFeedback.updateError;
          throw new Error(message);
        }

        const isSuccessful = payload?.success ?? true;
        const alertTitle =
          payload?.title ||
          (isSuccessful ? mergedStrings.actionFeedback.updateSuccess : mergedStrings.actionFeedback.updateError);
        const alertText = payload?.message ?? '';
        const alertIcon = payload?.type || (isSuccessful ? 'success' : 'error');

        if (isSuccessful) {
          await fetchPaymentDetail();
        }

        if (swalInstance) {
          await swalInstance.fire({
            title: alertTitle,
            text: alertText,
            icon: alertIcon,
          });
        } else if (typeof window !== 'undefined' && typeof window.alert === 'function') {
          const alertMessage = [alertTitle, alertText].filter(Boolean).join('\n\n');
          window.alert(alertMessage);
        }

        if (!isSuccessful) {
          return;
        }
      } catch (updateError) {
        console.error('Failed to update payment status', updateError);
        const fallbackMessage =
          updateError instanceof Error && updateError.message
            ? updateError.message
            : mergedStrings.actionFeedback.updateError;

        if (swalInstance) {
          await swalInstance.fire({
            title: mergedStrings.actionFeedback.updateError,
            text:
              fallbackMessage !== mergedStrings.actionFeedback.updateError ? fallbackMessage : undefined,
            icon: 'error',
          });
        } else if (typeof window !== 'undefined' && typeof window.alert === 'function') {
          const alertMessage = [mergedStrings.actionFeedback.updateError, fallbackMessage]
            .filter(Boolean)
            .join('\n\n');
          window.alert(alertMessage);
        }
      } finally {
        setIsUpdatingStatus(false);
      }
    },
    [
      fetchPaymentDetail,
      logout,
      mergedStrings,
      normalizedLanguage,
      paymentId,
      token,
    ],
  );

  const handlePrint = useCallback(async () => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    setIsPrinting(true);
    try {
      const detail = await fetchPaymentDetail();
      if (!detail) {
        throw new Error('Missing payment detail');
      }

      await new Promise((resolve) => {
        if (typeof window.requestAnimationFrame === 'function') {
          window.requestAnimationFrame(() => resolve());
        } else {
          setTimeout(resolve, 0);
        }
      });

      const cardElement = document.querySelector('.payment-detail__card');
      if (!cardElement) {
        throw new Error('Missing payment card');
      }

      const clonedCard = cardElement.cloneNode(true);
      const printWindow = window.open('', '_blank');

      if (!printWindow) {
        setToast({ type: 'error', message: mergedStrings.actionFeedback.printWindowError });
        return;
      }

      const printLocale = normalizedLanguage === 'en' ? 'en-US' : 'es-MX';
      const formatter = new Intl.DateTimeFormat(printLocale, {
        dateStyle: 'long',
        timeStyle: 'short',
      });
      const printDate = formatter.format(new Date());
      const schoolName =
        detail?.school_description || detail?.schoolDescription || detail?.school_name || 'Detalle de pago';
      const paymentTitle = `Pago #${paymentId ?? ''}`;
      const faviconLink = document.querySelector('link[rel*="icon"]');
      const faviconUrl = faviconLink?.href || '/favicon.ico';

      const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
        .map((node) => node.outerHTML)
        .join('\n');

      const printDocument = printWindow.document;
      printDocument.open();
      printDocument.write(`
        <html>
          <head>
            <meta charset="utf-8" />
            <title>${paymentTitle}</title>
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
            </style>
          </head>
          <body>
            <header class="print-header">
              <div class="print-header__identity">
                <img src="${faviconUrl}" alt="Logotipo" class="print-header__favicon" />
                <div>
                  <h1 class="print-header__title">${schoolName}</h1>
                  <p class="print-header__subtitle">${paymentTitle}</p>
                </div>
              </div>
              <div class="print-header__meta">
                <span>${printDate}</span>
              </div>
            </header>
            ${clonedCard.outerHTML}
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
      console.error('Failed to print payment detail', printError);
      setToast({ type: 'error', message: mergedStrings.actionFeedback.printError });
    } finally {
      setIsPrinting(false);
    }
  }, [fetchPaymentDetail, mergedStrings.actionFeedback, normalizedLanguage, paymentId]);

  const fetchPaymentLogs = useCallback(async () => {
    if (!paymentId) {
      setLogs([]);
      setLogsError(mergedStrings.logs.error);
      return;
    }

    setLogsLoading(true);
    setLogsError(null);

    try {
      const url = `${API_BASE_URL}/logs/payment/${encodeURIComponent(String(paymentId))}?lang=${encodeURIComponent(
        normalizedLanguage,
      )}`;

      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        handleExpiredToken(response, logout);
        throw new Error(mergedStrings.logs.error);
      }

      const payload = await response.json();
      setLogs(Array.isArray(payload) ? payload : []);
    } catch (requestError) {
      console.error('Failed to load payment logs', requestError);
      const fallbackMessage =
        requestError instanceof Error && requestError.message
          ? requestError.message
          : mergedStrings.logs.error;
      setLogsError(fallbackMessage);
    } finally {
      setLogsLoading(false);
    }
  }, [paymentId, mergedStrings.logs.error, normalizedLanguage, token, logout]);

  useEffect(() => {
    fetchPaymentDetail();
  }, [fetchPaymentDetail]);

  useEffect(() => {
    fetchPaymentLogs();
  }, [fetchPaymentLogs]);

  const handleFileSelect = useCallback((event) => {
    const file = event.target?.files?.[0];
    setSelectedFile(file ?? null);
    setReceiptUploadError('');
  }, []);

  const handleCloseReceiptModal = useCallback(() => {
    setIsReceiptModalOpen(false);
    setReceiptError(null);
    setReceiptLoading(false);
    setReceiptFileName('');
    setReceiptPreviewUrl((previous) => {
      if (previous) {
        URL.revokeObjectURL(previous);
      }
      return null;
    });
  }, []);

  const createReceiptPreview = useCallback(async () => {
    if (!receiptPath) {
      throw new Error('Invalid receipt path');
    }

    const requestUrl = buildProtectedFilePath(receiptPath);
    if (!requestUrl) {
      throw new Error('Invalid receipt path');
    }

    const response = await fetch(requestUrl, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok) {
      handleExpiredToken(response, logout);
      throw new Error(mergedStrings.attachments.previewError);
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    setReceiptPreviewUrl((previous) => {
      if (previous) {
        URL.revokeObjectURL(previous);
      }
      return objectUrl;
    });
    const resolvedName = receiptDisplayName || mergedStrings.attachments.missingFileName;
    setReceiptFileName(resolvedName);
    return objectUrl;
  }, [
    receiptPath,
    token,
    logout,
    mergedStrings.attachments.previewError,
    mergedStrings.attachments.missingFileName,
    receiptDisplayName,
  ]);

  const handleOpenReceipt = useCallback(async () => {
    if (!receiptPath) {
      return;
    }

    setReceiptError(null);
    setIsReceiptModalOpen(true);
    setReceiptLoading(true);

    try {
      await createReceiptPreview();
    } catch (requestError) {
      console.error('Failed to load receipt preview', requestError);
      const fallbackMessage =
        requestError instanceof Error && requestError.message
          ? requestError.message
          : mergedStrings.attachments.previewError;
      setReceiptError(fallbackMessage);
    } finally {
      setReceiptLoading(false);
    }
  }, [createReceiptPreview, mergedStrings.attachments.previewError, receiptPath]);

  const handleDownloadReceipt = useCallback(async () => {
    if (!receiptPath) {
      return;
    }

    setReceiptError(null);

    try {
      const objectUrl = receiptPreviewUrl ?? (await createReceiptPreview());
      const downloadName = receiptFileName || receiptDisplayName || 'comprobante.pdf';
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = downloadName;
      link.click();
    } catch (requestError) {
      console.error('Failed to download receipt', requestError);
      const fallbackMessage =
        requestError instanceof Error && requestError.message
          ? requestError.message
          : mergedStrings.attachments.previewError;
      setReceiptError(fallbackMessage);
      setIsReceiptModalOpen(true);
    }
  }, [
    createReceiptPreview,
    mergedStrings.attachments.previewError,
    receiptDisplayName,
    receiptFileName,
    receiptPreviewUrl,
    receiptPath,
  ]);

  const defaultEditValues = useMemo(() => {
    return {
      paymentConceptId:
        payment && payment.payment_concept_id != null
          ? String(payment.payment_concept_id)
          : '',
      paymentThroughId:
        payment && payment.payment_through_id != null
          ? String(payment.payment_through_id)
          : '',
      paymentCreatedAt: toDateTimeLocalValue(payment?.payment_created_at || payment?.created_at || ''),
      paymentMonth: toMonthInputValue(payment?.payment_month || ''),
      amount: payment && payment.amount != null ? String(payment.amount) : '',
      comments: payment?.comments ?? '',
    };
  }, [payment]);

  useEffect(() => {
    if (!isEditing) {
      setEditValues(defaultEditValues);
      setEditError('');
    }
  }, [defaultEditValues, isEditing]);

  useEffect(() => {
    if (!payment) {
      return;
    }

    if (payment.payment_concept_id != null) {
      setConceptOptions((previous) =>
        mergeCatalogOptions(previous, [
          {
            id: String(payment.payment_concept_id),
            name: payment.pt_name || mergedStrings.paymentSection.fields.paymentConcept,
          },
        ]),
      );
    }

    if (payment.payment_through_id != null) {
      setThroughOptions((previous) =>
        mergeCatalogOptions(previous, [
          {
            id: String(payment.payment_through_id),
            name: payment.payt_name || mergedStrings.paymentSection.fields.paymentType,
          },
        ]),
      );
    }
  }, [mergedStrings.paymentSection.fields.paymentConcept, mergedStrings.paymentSection.fields.paymentType, payment]);

  const isEditDirty = useMemo(() => {
    if (!isEditing) {
      return false;
    }

    return Object.keys(defaultEditValues).some((key) => defaultEditValues[key] !== editValues[key]);
  }, [defaultEditValues, editValues, isEditing]);

  useEffect(() => {
    if (!isEditDirty || typeof window === 'undefined') {
      return undefined;
    }

    const handleBeforeUnload = (event) => {
      const warning = mergedStrings.editing?.unsavedChanges;
      if (warning) {
        event.preventDefault();
        event.returnValue = warning;
      }
      return warning;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isEditDirty, mergedStrings.editing]);

  const loadPaymentConcepts = useCallback(async () => {
    setIsLoadingConcepts(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/catalog/payment-concepts?lang=${normalizedLanguage}`,
        {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        },
      );

      if (!response.ok) {
        handleExpiredToken(response, logout);
        throw new Error('Failed to load concepts');
      }

      const payload = await response.json();
      const list = extractCatalogItems(payload);
      const options = list.map((item, index) => ({
        id:
          String(
            item?.id ??
              item?.value ??
              item?.catalog_id ??
              item?.payment_concept_id ??
              index,
          ),
        name:
          item?.name ??
          item?.label ??
          item?.title ??
          item?.description ??
          item?.concept ??
          `Concepto ${index + 1}`,
      }));
      setConceptOptions((previous) => mergeCatalogOptions(previous, options));
    } catch (error) {
      console.error('Payment concepts fetch error', error);
    } finally {
      setIsLoadingConcepts(false);
    }
  }, [normalizedLanguage, token, logout]);

  const loadPaymentThrough = useCallback(async () => {
    setIsLoadingThrough(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/catalog/payment-through?lang=${normalizedLanguage}`,
        {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        },
      );

      if (!response.ok) {
        handleExpiredToken(response, logout);
        throw new Error('Failed to load through');
      }

      const payload = await response.json();
      const list = extractCatalogItems(payload);
      const options = list.map((item, index) => ({
        id:
          String(
            item?.id ??
              item?.value ??
              item?.catalog_id ??
              item?.payment_through_id ??
              index,
          ),
        name:
          item?.name ??
          item?.label ??
          item?.title ??
          item?.description ??
          item?.through ??
          `Método ${index + 1}`,
      }));
      setThroughOptions((previous) => mergeCatalogOptions(previous, options));
    } catch (error) {
      console.error('Payment through fetch error', error);
    } finally {
      setIsLoadingThrough(false);
    }
  }, [normalizedLanguage, token, logout]);

  useEffect(() => {
    if (!isEditing) {
      return;
    }

    loadPaymentConcepts();
    loadPaymentThrough();
  }, [isEditing, loadPaymentConcepts, loadPaymentThrough]);

  const handleToggleEdit = useCallback(async () => {
    if (!isEditing && isPaymentFinalized) {
      return;
    }

    if (isEditing) {
      if (isEditDirty) {
        const warning =
          mergedStrings.editing?.unsavedChanges || 'Si sales, perderás los cambios sin guardar.';
        const swalInstance = getSwalInstance();
        if (swalInstance) {
          const confirmation = await swalInstance.fire({
            title: warning,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: mergedStrings.confirmations?.confirmButtonText || 'Sí, continuar',
            cancelButtonText: mergedStrings.confirmations?.cancelButtonText || 'Cancelar',
            reverseButtons: true,
            focusCancel: true,
          });

          if (!confirmation.isConfirmed) {
            return;
          }
        } else if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
          const confirmed = window.confirm(warning || '');
          if (!confirmed) {
            return;
          }
        }
      }

      setIsEditing(false);
      setEditError('');
      setEditValues(defaultEditValues);
      return;
    }

    setEditError('');
    setIsEditing(true);
  }, [
    defaultEditValues,
    isEditDirty,
    isEditing,
    isPaymentFinalized,
    mergedStrings.confirmations,
    mergedStrings.editing,
  ]);

  useEffect(() => {
    if (isPaymentFinalized && isEditing) {
      setIsEditing(false);
      setEditError('');
      setEditValues(defaultEditValues);
    }
  }, [defaultEditValues, isEditing, isPaymentFinalized]);

  const validateEditValues = useCallback(() => {
    if (!mergedStrings.editing?.validation) {
      return '';
    }

    if (!editValues.paymentConceptId) {
      return mergedStrings.editing.validation.conceptRequired;
    }

    if (!editValues.paymentThroughId) {
      return mergedStrings.editing.validation.throughRequired;
    }

    if (!editValues.paymentCreatedAt) {
      return mergedStrings.editing.validation.createdAtRequired;
    }

    if (!editValues.paymentMonth) {
      return mergedStrings.editing.validation.monthRequired;
    }

    if (editValues.amount === '' || editValues.amount == null) {
      return mergedStrings.editing.validation.amountRequired;
    }

    return '';
  }, [editValues, mergedStrings.editing]);

  const handleSaveDetails = useCallback(
    async (event) => {
      event?.preventDefault?.();

      if (!paymentId) {
        return;
      }

      const validationError = validateEditValues();
      if (validationError) {
        setEditError(validationError);
        return;
      }

      setEditError('');
      setIsSavingDetails(true);

      const requestPayload = {
        payment_concept_id: Number(editValues.paymentConceptId),
        payment_through_id: Number(editValues.paymentThroughId),
        payment_created_at: normalizeDateTimeForPayload(editValues.paymentCreatedAt),
        payment_month: buildMonthPayload(editValues.paymentMonth),
        amount: String(editValues.amount),
        comments: editValues.comments ?? '',
      };

      try {
        const url = `${API_BASE_URL}/payments/update/${paymentId}?lang=${normalizedLanguage}`;
        const formData = new FormData();
        formData.append(
          'request',
          new Blob([JSON.stringify(requestPayload)], { type: 'application/json' }),
        );

        const response = await fetch(url, {
          method: 'PUT',
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: formData,
        });

        let payload = null;
        try {
          payload = await response.json();
        } catch (parseError) {
          payload = null;
        }

        if (!response.ok) {
          handleExpiredToken(response, logout);
          const message =
            (payload && (payload.message || payload.error)) ||
            mergedStrings.actionFeedback.detailsUpdateError;
          throw new Error(message);
        }

        await fetchPaymentDetail();
        setIsEditing(false);
        setToast({
          type: 'success',
          message:
            (payload && (payload.message || payload.title)) ||
            mergedStrings.actionFeedback.detailsUpdateSuccess,
        });
      } catch (updateError) {
        console.error('Failed to update payment details', updateError);
        const fallbackMessage =
          updateError instanceof Error && updateError.message
            ? updateError.message
            : mergedStrings.actionFeedback.detailsUpdateError;
        setEditError(fallbackMessage);
      } finally {
        setIsSavingDetails(false);
      }
    },
    [
      editValues,
      fetchPaymentDetail,
      logout,
      mergedStrings.actionFeedback.detailsUpdateError,
      mergedStrings.actionFeedback.detailsUpdateSuccess,
      normalizedLanguage,
      paymentId,
      token,
      validateEditValues,
    ],
  );

  useEffect(() => {
    if (!isEditing) {
      return;
    }

    setEditError('');
  }, [isEditing]);

  const handleUploadReceipt = useCallback(async () => {
    if (!paymentId) {
      return;
    }

    if (!selectedFile) {
      setReceiptUploadError(mergedStrings.attachments.missingSelection);
      return;
    }

    setReceiptUploadError('');
    setIsUploadingReceipt(true);

    try {
      const url = `${API_BASE_URL}/payments/update/${paymentId}?lang=${normalizedLanguage}`;
      const formData = new FormData();
      formData.append('request', new Blob([JSON.stringify({})], { type: 'application/json' }));
      formData.append('receipt', selectedFile);

      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });

      let payload = null;
      try {
        payload = await response.json();
      } catch (parseError) {
        payload = null;
      }

      if (!response.ok) {
        handleExpiredToken(response, logout);
        const message =
          (payload && (payload.message || payload.error)) ||
          mergedStrings.actionFeedback.receiptUploadError;
        throw new Error(message);
      }

      await fetchPaymentDetail();
      setSelectedFile(null);
      setFileInputKey((previous) => previous + 1);
      setReceiptUploadError('');
      setToast({
        type: 'success',
        message:
          (payload && (payload.message || payload.title)) ||
          mergedStrings.actionFeedback.receiptUploadSuccess,
      });
    } catch (error) {
      console.error('Failed to upload receipt', error);
      const fallbackMessage =
        error instanceof Error && error.message
          ? error.message
          : mergedStrings.actionFeedback.receiptUploadError;
      setReceiptUploadError(fallbackMessage);
    } finally {
      setIsUploadingReceipt(false);
    }
  }, [
    fetchPaymentDetail,
    logout,
    mergedStrings.actionFeedback.receiptUploadError,
    mergedStrings.actionFeedback.receiptUploadSuccess,
    mergedStrings.attachments.missingSelection,
    normalizedLanguage,
    paymentId,
    selectedFile,
    token,
  ]);

  const formattedStudentDetails = useMemo(() => {
    if (!payment) {
      return [];
    }

    return [
      {
        label: mergedStrings.studentSection.fields.fullName,
        value: payment.student_full_name || payment.studentFullName || payment.student_name || null,
      },
      {
        label: mergedStrings.studentSection.fields.email,
        value: payment.email || null,
      },
      {
        label: mergedStrings.studentSection.fields.personalEmail,
        value: payment.personal_email || payment.personalEmail || null,
      },
      {
        label: mergedStrings.studentSection.fields.reference,
        value: payment.payment_reference || payment.reference || null,
      },
      {
        label: mergedStrings.studentSection.fields.phone,
        value: payment.phone_number || payment.phone || null,
      },
      {
        label: mergedStrings.studentSection.fields.generation,
        value: payment.generation || null,
      },
      {
        label: mergedStrings.studentSection.fields.group,
        value: payment.grade_group || payment.group || null,
      },
      {
        label: mergedStrings.studentSection.fields.scholarLevel,
        value: payment.scholar_level_name || payment.scholarLevel || null,
      },
    ];
  }, [mergedStrings.studentSection.fields, payment]);

  const formattedPaymentDetails = useMemo(() => {
    if (!payment) {
      return [];
    }

    const statusName = payment.payment_status_name || payment.status || null;
    const statusVariant = buildStatusVariant(statusName || '');

    return [
      {
        label: mergedStrings.paymentSection.fields.status,
        value: statusName || null,
        variant: statusVariant,
      },
      {
        label: mergedStrings.paymentSection.fields.createdAt,
        value: formatDateTime(payment.payment_created_at || payment.created_at, normalizedLanguage),
      },
      {
        label: mergedStrings.paymentSection.fields.paymentMonth,
        value: formatMonth(payment.payment_month, normalizedLanguage),
      },
      {
        label: mergedStrings.paymentSection.fields.amount,
        value: formatCurrency(payment.amount, normalizedLanguage),
      },
      {
        label: mergedStrings.paymentSection.fields.paymentType,
        value: payment.payt_name || payment.payment_type || null,
      },
      {
        label: mergedStrings.paymentSection.fields.paymentConcept,
        value: payment.pt_name || payment.payment_concept || null,
      },
      {
        label: mergedStrings.paymentSection.fields.comments,
        value: payment.comments || null,
      },
    ];
  }, [mergedStrings.paymentSection.fields, normalizedLanguage, payment]);

  const formattedLogs = useMemo(() => {
    return logs.map((entry, index) => {
      const updatedAt = formatDateTime(entry?.updated_at, normalizedLanguage);
      const changes = Array.isArray(entry?.changes) ? entry.changes : [];

      return {
        key: `${entry?.updated_at ?? 'log'}-${index}`,
        responsable: entry?.responsable_full_name || entry?.responsable || entry?.user || null,
        role: entry?.role_name || null,
        type: entry?.log_type_name || null,
        updatedAt,
        changes: changes.map((change, changeIndex) => ({
          key: `${entry?.updated_at ?? 'change'}-${changeIndex}`,
          field: change?.field || null,
          from: change?.from || null,
          to: change?.to || null,
          comments: change?.comments || null,
        })),
      };
    });
  }, [logs, normalizedLanguage]);

  const hasReceipt = Boolean(payment?.receipt_path);


  return (
    <>
      <div className="payment-detail">
        {loading ? (
          <>
            <UiCard className="payment-detail__card">
              <div className="payment-detail__skeleton" role="status" aria-live="polite">
                <span className="payment-detail__sr-only">{mergedStrings.loading}</span>
                <div className="payment-detail__skeleton-header">
                  <div className="payment-detail__skeleton-line payment-detail__skeleton-line--title" />
                  <div className="payment-detail__skeleton-line payment-detail__skeleton-line--subtitle" />
                </div>
                <div className="payment-detail__skeleton-actions">
                  <div className="payment-detail__skeleton-pill" />
                  <div className="payment-detail__skeleton-pill" />
                  <div className="payment-detail__skeleton-pill" />
                </div>
                <div className="payment-detail__skeleton-section">
                  <div className="payment-detail__skeleton-line payment-detail__skeleton-line--section-title" />
                  <div className="payment-detail__skeleton-grid">
                    {SKELETON_DETAIL_ITEMS.map((item) => (
                      <div key={`student-skeleton-${item}`} className="payment-detail__skeleton-field" />
                    ))}
                  </div>
                </div>
                <div className="payment-detail__skeleton-section">
                  <div className="payment-detail__skeleton-line payment-detail__skeleton-line--section-title" />
                  <div className="payment-detail__skeleton-grid">
                    {SKELETON_DETAIL_ITEMS.map((item) => (
                      <div key={`payment-skeleton-${item}`} className="payment-detail__skeleton-field" />
                    ))}
                  </div>
                </div>
              </div>
            </UiCard>
            <UiCard className="payment-detail__card" aria-hidden="true">
              <div className="payment-detail__skeleton">
                <div className="payment-detail__skeleton-line payment-detail__skeleton-line--section-title" />
                <div className="payment-detail__skeleton-rows">
                  {SKELETON_ATTACHMENT_ROWS.map((item) => (
                    <div key={`attachment-skeleton-${item}`} className="payment-detail__skeleton-rectangle" />
                  ))}
                </div>
              </div>
            </UiCard>
            <UiCard className="payment-detail__card" aria-hidden="true">
              <div className="payment-detail__skeleton">
                <div className="payment-detail__skeleton-line payment-detail__skeleton-line--section-title" />
                <div className="payment-detail__skeleton-rows">
                  {SKELETON_LOG_ROWS.map((item) => (
                    <div key={`log-skeleton-${item}`} className="payment-detail__skeleton-rectangle" />
                  ))}
                </div>
              </div>
            </UiCard>
          </>
        ) : (
          <>
            <UiCard className="payment-detail__card">
              <div className="payment-detail__header">
                <div>
                  <h1 className="payment-detail__title">{`Pago #${paymentId ?? '--'}`}</h1>
                  <p className="payment-detail__subtitle">{mergedStrings.generalTitle}</p>
                </div>
                {payment ? (
                  <div className="payment-detail__header-actions">
                    {!isPaymentFinalized ? (
                      <ActionButton
                        variant={isEditing ? 'outline' : 'primary'}
                        onClick={handleToggleEdit}
                        disabled={!payment || isSavingDetails}
                        aria-pressed={isEditing ? 'true' : 'false'}
                      >
                        {isEditing ? mergedStrings.editing.cancelButton : mergedStrings.editing.editButton}
                      </ActionButton>
                    ) : null}
                    <ActionButton
                      variant="secondary"
                      onClick={handlePrint}
                      disabled={!payment || isPrinting || isUpdatingStatus}
                      aria-busy={isPrinting ? 'true' : undefined}
                    >
                      {mergedStrings.actions.print}
                    </ActionButton>
                    {!isPaymentFinalized ? (
                      <>
                        <ActionButton
                          variant="success"
                          className="payment-detail__approve-button"
                          onClick={() => handleUpdateStatus(3)}
                          disabled={isUpdatingStatus}
                          aria-busy={isUpdatingStatus ? 'true' : undefined}
                        >
                          {mergedStrings.actions.approve}
                        </ActionButton>
                        <ActionButton
                          variant="danger"
                          onClick={() => handleUpdateStatus(4)}
                          disabled={isUpdatingStatus}
                          aria-busy={isUpdatingStatus ? 'true' : undefined}
                        >
                          {mergedStrings.actions.reject}
                        </ActionButton>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {error ? (
                <div className="payment-detail__error" role="alert">
                  <p>{error}</p>
                  <ActionButton variant="secondary" onClick={fetchPaymentDetail}>
                    {mergedStrings.retry}
                  </ActionButton>
                </div>
              ) : payment ? (
                <>
                  <section className="payment-detail__section">
                    <h2 className="payment-detail__section-title">{mergedStrings.studentSection.title}</h2>
                    <dl className="payment-detail__details-grid">
                      {formattedStudentDetails.map((item) => (
                        <div key={item.label} className="payment-detail__details-item">
                          <dt>{item.label}</dt>
                          <dd>
                            {item.value && String(item.value).trim() !== '' ? (
                              item.value
                            ) : (
                              <span className="payment-detail__placeholder">--</span>
                            )}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </section>

                  <section className="payment-detail__section">
                    <h2 className="payment-detail__section-title">{mergedStrings.paymentSection.title}</h2>
                    {isEditing ? (
                      <form className="payment-detail__form" onSubmit={handleSaveDetails}>
                        <div className="payment-detail__details-grid">
                          <div className="payment-detail__details-item">
                            <dt>{mergedStrings.paymentSection.fields.status}</dt>
                            <dd>
                              {(() => {
                                const statusItem = formattedPaymentDetails.find(
                                  (item) => item.label === mergedStrings.paymentSection.fields.status,
                                );
                                if (!statusItem) {
                                  return <span className="payment-detail__placeholder">--</span>;
                                }
                                return (
                                  <span
                                    className={`payment-detail__status payment-detail__status--${
                                      statusItem.variant ?? 'neutral'
                                    }`}
                                  >
                                    {statusItem.value && String(statusItem.value).trim() !== '' ? (
                                      statusItem.value
                                    ) : (
                                      <span className="payment-detail__placeholder">--</span>
                                    )}
                                  </span>
                                );
                              })()}
                            </dd>
                          </div>
                          <div className="payment-detail__details-item">
                            <dt>{mergedStrings.paymentSection.fields.createdAt}</dt>
                            <dd>
                              <input
                                type="date"
                                className="payment-detail__form-input"
                                value={editValues.paymentCreatedAt}
                                onChange={(event) =>
                                  setEditValues((previous) => ({
                                    ...previous,
                                    paymentCreatedAt: event.target.value,
                                  }))
                                }
                                required
                              />
                            </dd>
                          </div>
                          <div className="payment-detail__details-item">
                            <dt>{mergedStrings.paymentSection.fields.paymentMonth}</dt>
                            <dd>
                              <input
                                type="month"
                                className="payment-detail__form-input"
                                value={editValues.paymentMonth}
                                onChange={(event) =>
                                  setEditValues((previous) => ({
                                    ...previous,
                                    paymentMonth: event.target.value,
                                  }))
                                }
                                required
                              />
                            </dd>
                          </div>
                          <div className="payment-detail__details-item">
                            <dt>{mergedStrings.paymentSection.fields.amount}</dt>
                            <dd>
                              <input
                                type="number"
                                className="payment-detail__form-input"
                                value={editValues.amount}
                                onChange={(event) =>
                                  setEditValues((previous) => ({
                                    ...previous,
                                    amount: event.target.value,
                                  }))
                                }
                                min="0"
                                step="0.01"
                                required
                              />
                            </dd>
                          </div>
                          <div className="payment-detail__details-item">
                            <dt>{mergedStrings.paymentSection.fields.paymentType}</dt>
                            <dd>
                              <select
                                className="payment-detail__form-input"
                                value={editValues.paymentThroughId}
                                onChange={(event) =>
                                  setEditValues((previous) => ({
                                    ...previous,
                                    paymentThroughId: event.target.value,
                                  }))
                                }
                                required
                              >
                                <option value="">--</option>
                                {throughOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </dd>
                          </div>
                          <div className="payment-detail__details-item">
                            <dt>{mergedStrings.paymentSection.fields.paymentConcept}</dt>
                            <dd>
                              <select
                                className="payment-detail__form-input"
                                value={editValues.paymentConceptId}
                                onChange={(event) =>
                                  setEditValues((previous) => ({
                                    ...previous,
                                    paymentConceptId: event.target.value,
                                  }))
                                }
                                required
                              >
                                <option value="">--</option>
                                {conceptOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </dd>
                          </div>
                          <div className="payment-detail__details-item payment-detail__details-item--full">
                            <dt>{mergedStrings.paymentSection.fields.comments}</dt>
                            <dd>
                              <textarea
                                className="payment-detail__form-input payment-detail__form-textarea"
                                value={editValues.comments}
                                onChange={(event) =>
                                  setEditValues((previous) => ({
                                    ...previous,
                                    comments: event.target.value,
                                  }))
                                }
                                rows={4}
                              />
                            </dd>
                          </div>
                        </div>
                        {editError ? <p className="payment-detail__form-error">{editError}</p> : null}
                        <div className="payment-detail__form-actions">
                          <ActionButton type="submit" variant="primary" disabled={isSavingDetails}>
                            {isSavingDetails
                              ? mergedStrings.editing.savingButton
                              : mergedStrings.editing.saveButton}
                          </ActionButton>
                          <ActionButton type="button" variant="secondary" onClick={handleToggleEdit}>
                            {mergedStrings.editing.cancelButton}
                          </ActionButton>
                        </div>
                      </form>
                    ) : (
                      <dl className="payment-detail__details-grid">
                        {formattedPaymentDetails.map((item) => (
                          <div key={item.label} className="payment-detail__details-item">
                            <dt>{item.label}</dt>
                            <dd>
                              {item.variant ? (
                                <span className={`payment-detail__status payment-detail__status--${item.variant}`}>
                                  {item.value && String(item.value).trim() !== '' ? item.value : '--'}
                                </span>
                              ) : item.value && String(item.value).trim() !== '' ? (
                                item.value
                              ) : (
                                <span className="payment-detail__placeholder">--</span>
                              )}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </section>
                </>
              ) : (
                <p className="payment-detail__status-text" role="status">
                  {mergedStrings.error}
                </p>
              )}
            </UiCard>

            {payment ? (
              <UiCard className="payment-detail__card">
                <div className="payment-detail__section-header">
                  <h2 className="payment-detail__section-title">{mergedStrings.attachments.title}</h2>
                </div>

                {hasReceipt ? (
                  <div className="payment-detail__receipt">
                    <div className="payment-detail__receipt-meta">
                      <div className="payment-detail__receipt-icon" aria-hidden="true">📎</div>
                      <div>
                        <p className="payment-detail__receipt-name">
                          {payment?.receipt_file_name || mergedStrings.attachments.missingFileName}
                        </p>
                        <p className="payment-detail__receipt-path">{payment?.receipt_path}</p>
                      </div>
                    </div>
                    <div className="payment-detail__receipt-actions">
                      <ActionButton variant="secondary" onClick={handleOpenReceipt}>
                        {mergedStrings.attachments.viewLabel}
                      </ActionButton>
                      <ActionButton variant="outline" onClick={handleDownloadReceipt}>
                        {mergedStrings.attachments.downloadLabel}
                      </ActionButton>
                    </div>
                  </div>
                ) : (
                  <div className="payment-detail__upload">
                    <p>{mergedStrings.attachments.emptyDescription}</p>
                  </div>
                )}

                <div className="payment-detail__upload payment-detail__upload--form">
                  <label className="payment-detail__upload-label">
                    {hasReceipt ? mergedStrings.attachments.replaceLabel : mergedStrings.attachments.uploadLabel}
                    <input
                      key={fileInputKey}
                      type="file"
                      className="payment-detail__upload-input"
                      onChange={handleFileSelect}
                    />
                  </label>
                  {selectedFile ? (
                    <p className="payment-detail__selected-file">
                      {mergedStrings.attachments.selectedFile}{' '}
                      <strong>{selectedFile.name}</strong>
                    </p>
                  ) : null}
                  {receiptUploadError ? (
                    <p className="payment-detail__upload-error" role="alert">
                      {receiptUploadError}
                    </p>
                  ) : null}
                  <div className="payment-detail__upload-actions">
                    <ActionButton
                      variant="primary"
                      onClick={handleUploadReceipt}
                      disabled={isUploadingReceipt}
                    >
                      {isUploadingReceipt
                        ? mergedStrings.attachments.uploadingLabel
                        : mergedStrings.attachments.submitLabel}
                    </ActionButton>
                  </div>
                </div>
              </UiCard>
            ) : null}

            <UiCard className="payment-detail__card">
              <div className="payment-detail__section-header">
                <h2 className="payment-detail__section-title">{mergedStrings.logs.title}</h2>
              </div>

              {logsLoading ? (
                <p className="payment-detail__status-text" role="status">
                  {mergedStrings.loading}
                </p>
              ) : logsError ? (
                <div className="payment-detail__error" role="alert">
                  <p>{logsError}</p>
                  <ActionButton variant="secondary" onClick={fetchPaymentLogs}>
                    {mergedStrings.retry}
                  </ActionButton>
                </div>
              ) : formattedLogs.length === 0 ? (
                <p className="payment-detail__status-text">{mergedStrings.logs.empty}</p>
              ) : (
                <ul className="payment-detail__logs">
                  {formattedLogs.map((log) => (
                    <li key={log.key} className="payment-detail__log-item">
                      <div className="payment-detail__log-header">
                        <div>
                          <p className="payment-detail__log-user">
                            {log.responsable ?? <span className="payment-detail__placeholder">--</span>}
                          </p>
                          <p className="payment-detail__log-role">
                            {log.role ? log.role : <span className="payment-detail__placeholder">--</span>}
                          </p>
                        </div>
                        <div className="payment-detail__log-meta">
                          <span className="payment-detail__log-type">{log.type ?? '--'}</span>
                          <span className="payment-detail__log-date">{log.updatedAt ?? '--'}</span>
                        </div>
                      </div>
                      {log.changes.length > 0 ? (
                        <ul className="payment-detail__log-changes">
                          {log.changes.map((change) => (
                            <li key={change.key}>
                              <div className="payment-detail__change-field">
                                <strong>{change.field ?? '—'}</strong>
                              </div>
                              <div className="payment-detail__change-values">
                                <span>
                                  <span className="payment-detail__change-label">De:</span>{' '}
                                  {change.from ?? <span className="payment-detail__placeholder">--</span>}
                                </span>
                                <span>
                                  <span className="payment-detail__change-label">A:</span>{' '}
                                  {change.to ?? <span className="payment-detail__placeholder">--</span>}
                                </span>
                              </div>
                              {change.comments ? (
                                <p className="payment-detail__change-comments">{change.comments}</p>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </UiCard>
          </>
        )}

        {isReceiptModalOpen ? (
          <div className="modal fade show payment-detail__modal" style={{ display: 'block' }} role="dialog" aria-modal="true">
            <div className="modal-dialog modal-xl modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h2 className="modal-title h5 mb-0">{receiptFileName || mergedStrings.attachments.viewLabel}</h2>
                  <button
                    type="button"
                    className="btn-close"
                    aria-label={mergedStrings.attachments.closeLabel}
                    onClick={handleCloseReceiptModal}
                  />
                </div>
                <div className="modal-body payment-detail__modal-body">
                  {receiptLoading ? (
                    <p className="payment-detail__status-text" role="status">
                      {mergedStrings.attachments.previewLoading}
                    </p>
                  ) : receiptError ? (
                    <div className="payment-detail__error" role="alert">
                      <p>{receiptError}</p>
                    </div>
                  ) : receiptPreviewUrl ? (
                    <iframe
                      src={receiptPreviewUrl}
                      title={receiptFileName || 'Comprobante'}
                      className="payment-detail__modal-preview"
                    />
                  ) : (
                    <p className="payment-detail__status-text" role="status">
                      {mergedStrings.attachments.previewLoading}
                    </p>
                  )}
                </div>
                <div className="modal-footer">
                  <ActionButton variant="secondary" onClick={handleDownloadReceipt}>
                    {mergedStrings.attachments.downloadLabel}
                  </ActionButton>
                  <ActionButton variant="ghost" onClick={handleCloseReceiptModal}>
                    {mergedStrings.attachments.closeLabel}
                  </ActionButton>
                </div>
              </div>
            </div>
            <div className="modal-backdrop fade show" />
          </div>
        ) : null}
      </div>
      <GlobalToast alert={toast} onClose={() => setToast(null)} />
    </>
  );

};

export default PaymentDetailPage;
