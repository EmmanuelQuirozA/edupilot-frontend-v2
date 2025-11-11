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
  actionFeedback: {
    updateSuccess: 'El pago se actualizó correctamente.',
    updateError: 'No fue posible actualizar el pago.',
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
    selectedFile: 'Archivo seleccionado:',
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
  const receiptPath = payment?.receipt_path ?? null;
  const receiptDisplayName = payment?.receipt_file_name ?? null;
  const [toast, setToast] = useState(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
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
        const response = await fetch(url, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ payment_status_id: statusId }),
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
        const alertText = payload?.message && payload?.message !== payload?.title ? payload.message : '';

        if (isSuccessful) {
          await fetchPaymentDetail();
        }

        if (swalInstance) {
          await swalInstance.fire({
            title: alertTitle,
            text: alertText,
            icon: isSuccessful ? 'success' : 'error',
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
        <UiCard className="payment-detail__card">
        <div className="payment-detail__header">
          <div>
            <h1 className="payment-detail__title">{`Pago #${paymentId ?? '--'}`}</h1>
            <p className="payment-detail__subtitle">{mergedStrings.generalTitle}</p>
          </div>
          <div className="payment-detail__header-actions">
            <ActionButton
              variant="secondary"
              onClick={handlePrint}
              disabled={isPrinting || isUpdatingStatus}
              aria-busy={isPrinting ? 'true' : undefined}
            >
              {mergedStrings.actions.print}
            </ActionButton>
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
          </div>
        </div>

        {loading ? (
          <p className="payment-detail__status-text" role="status">
            {mergedStrings.loading}
          </p>
        ) : error ? (
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
                    <dd>{item.value && String(item.value).trim() !== '' ? item.value : <span className="payment-detail__placeholder">--</span>}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="payment-detail__section">
              <h2 className="payment-detail__section-title">{mergedStrings.paymentSection.title}</h2>
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
            </section>
          </>
        ) : (
          <p className="payment-detail__status-text" role="status">
            {mergedStrings.error}
          </p>
        )}
      </UiCard>

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
            <label className="payment-detail__upload-label">
              {mergedStrings.attachments.uploadLabel}
              <input type="file" className="payment-detail__upload-input" onChange={handleFileSelect} />
            </label>
            {selectedFile ? (
              <p className="payment-detail__selected-file">
                {mergedStrings.attachments.selectedFile} <strong>{selectedFile.name}</strong>
              </p>
            ) : null}
          </div>
        )}
      </UiCard>

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
                    <p className="payment-detail__log-user">{log.responsable ?? <span className="payment-detail__placeholder">--</span>}</p>
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
