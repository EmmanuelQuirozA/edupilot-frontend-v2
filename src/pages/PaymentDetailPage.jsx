import { useCallback, useEffect, useMemo, useState } from 'react';
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

  const fetchPaymentDetail = useCallback(async () => {
    if (!paymentId) {
      setPayment(null);
      setError(mergedStrings.error);
      onBreadcrumbChange?.(mergedStrings.breadcrumbFallback);
      return;
    }

    setLoading(true);
    setError(null);
    onBreadcrumbChange?.(mergedStrings.breadcrumbFallback);

    try {
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

      if (!response.ok) {
        handleExpiredToken(response, logout);
        throw new Error(mergedStrings.error);
      }

      const payload = await response.json();
      const content = Array.isArray(payload?.content) ? payload.content : [];
      const detail = content[0] ?? null;
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
    } finally {
      setLoading(false);
    }
  }, [
    mergedStrings.breadcrumbFallback,
    mergedStrings.error,
    normalizedLanguage,
    onBreadcrumbChange,
    paymentId,
    token,
    logout,
  ]);

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
    <div className="payment-detail">
      <UiCard className="payment-detail__card">
        <div className="payment-detail__header">
          <div>
            <h1 className="payment-detail__title">{`Pago #${paymentId ?? '--'}`}</h1>
            <p className="payment-detail__subtitle">{mergedStrings.generalTitle}</p>
          </div>
          <div className="payment-detail__header-actions">
            <ActionButton variant="secondary">{mergedStrings.actions.print}</ActionButton>
            <ActionButton variant="success">{mergedStrings.actions.approve}</ActionButton>
            <ActionButton variant="danger">{mergedStrings.actions.reject}</ActionButton>
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
  );
};

export default PaymentDetailPage;
